import express from "express";
import path from "path";
import cors from "cors";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import axios from "axios";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync } from "fs";
import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { initializeFirestore } from "firebase/firestore";
import serverApiRouter from "./server-api.ts";

dotenv.config();

let firebaseConfig: any = {};
try {
  const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
  firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, "utf-8"));
} catch (e: any) {
  console.error("[Startup] Failed to read firebase-applet-config.json:", e.message);
}

try {
  if (!admin.apps.length) {
    if (firebaseConfig.projectId) {
      admin.initializeApp({
        projectId: firebaseConfig.projectId,
      });
    } else {
      admin.initializeApp();
    }
  }
} catch (e: any) {
  console.error("[Startup] Failed to initialize admin SDK:", e.message);
}

// Let's redirect firebase.firestore to admin.firestore to solve FieldValue and Timestamp compatibility perfectly
try {
  let firestoreNamespace = admin.firestore;
  Object.defineProperty(firebase, "firestore", {
    get: () => firestoreNamespace,
    configurable: true,
  });
} catch (overrideErr: any) {
  console.warn("[Startup] Redirection of firebase.firestore failed:", overrideErr.message);
}

const systemEmail = "system-worker@zomindia.com";
const systemPassword = process.env.WORKER_SYSTEM_PASSWORD;

let isWorkerAuthenticated = true;
// Background worker connection runs directly under high-privilege Admin SDK, no client login required.


let _serverClientDb: any = null;
let _serverAdminDb: any = null;

const initializeServerClientDb = async () => {
  try {
    const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
    const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, "utf-8"));
    
    // Initialize the default app to prevent "The default Firebase app does not exist"
    let clientApp;
    if (firebase.apps.length > 0) {
      clientApp = firebase.app();
    } else {
      clientApp = firebase.initializeApp(firebaseConfig);
    }
    
    // Attempt secure custom token auth under Sandbox mode, catching all errors quietly
    try {
      const customToken = await admin.auth().createCustomToken("system-worker-uid", {
        email: "system-worker@zomindia.com",
        email_verified: true
      });
      await clientApp.auth().signInWithCustomToken(customToken);
      console.log("[Server Client Backend] Authenticated system-worker@zomindia.com successfully");
      _serverClientDb = clientApp.firestore(firebaseConfig.firestoreDatabaseId || undefined);
    } catch (authErr: any) {
      console.log("[Server Client Backend] Sandbox token sign-in bypassed: using secure Admin SDK fallback directly.");
      _serverClientDb = null;
    }
  } catch (err: any) {
    console.log("[Server Client Backend] Initialization fallback to high-privilege Admin SDK active.");
    _serverClientDb = null;
  }
};

// Start the auth flow immediately
initializeServerClientDb();

const getDbInstance = () => {
  // Always prefer Admin SDK if available
  if (_serverAdminDb) return _serverAdminDb;
  
  try {
    const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
    const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, "utf-8"));
    if (admin.apps.length > 0) {
      if (firebaseConfig.firestoreDatabaseId) {
        _serverAdminDb = getFirestore(admin.apps[0], firebaseConfig.firestoreDatabaseId);
      } else {
        _serverAdminDb = getFirestore();
      }
      return _serverAdminDb;
    }
  } catch (err: any) {
    console.error("[Server getDbInstance Error]:", err.message);
  }
  
  if (_serverClientDb) return _serverClientDb;
  return null;
};

// Proxies for db and adminDb to auto-delegate with zero refactoring in server.ts
const dbProxy = new Proxy({}, {
  get(target, prop) {
    const activeDb = getDbInstance();
    if (!activeDb) return undefined;
    const value = activeDb[prop];
    if (typeof value === "function") {
      return value.bind(activeDb);
    }
    return value;
  }
});

const db: any = dbProxy;
const adminDb: any = dbProxy;

async function startServer() {
  const app = express();
  const PORT = 3000;

  if (process.env.NODE_ENV !== "development" && !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("CRITICAL STARTUP ERROR: process.env.RAZORPAY_KEY_SECRET is required but undefined in non-development environments!");
  }

  app.use(express.json());
  app.use(cors({
    origin: true,
    credentials: true
  }));

  // 301 Redirect www.zomindia.com to zomindia.com
  app.use((req, res, next) => {
    const host = req.headers.host || "";
    if (host.startsWith("www.zomindia.com")) {
      const redirectUrl = `https://zomindia.com${req.url}`;
      return res.redirect(301, redirectUrl);
    }
    next();
  });

  // Razorpay Client (Lazy initialization)
  let razorpayClient: any = null;
  const getRazorpay = () => {
    if (!razorpayClient) {
      const keyId = process.env.RAZORPAY_KEY_ID;
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keyId || !keySecret) throw new Error("RAZORPAY credentials are required");
      razorpayClient = new Razorpay({
        key_id: keyId,
        key_secret: keySecret,
      });
    }
    return razorpayClient;
  };

  // API Routes
  app.use("/api", serverApiRouter);

  app.post("/api/send-push-notification", async (req, res) => {
    try {
      const { userId, title, message } = req.body;
      if (!userId || !title || !message) {
        return res.status(400).json({ error: "userId, title, and message are required" });
      }

      if (!db) {
        return res.status(500).json({ error: "Firestore Admin Database is not yet initialized on the server." });
      }

      const userSnap = await db.collection("users").doc(userId).get();
      if (!userSnap.exists) {
        console.log(`[Push Server] User ${userId} profile not found in Firestore.`);
        return res.status(404).json({ error: "User not found" });
      }

      const userData = userSnap.data();
      const tokens: string[] = [];
      if (userData.fcmToken) {
        tokens.push(userData.fcmToken);
      }
      if (Array.isArray(userData.fcmTokens)) {
        userData.fcmTokens.forEach((t: string) => {
          if (t && !tokens.includes(t)) tokens.push(t);
        });
      }

      if (tokens.length === 0) {
        console.log(`[Push Server] No registered device push tokens for user: ${userId}`);
        return res.json({ success: true, message: "No tokens registered. Standard web inbox delivery active." });
      }

      console.log(`[Push Server] Sending push notifications to user ${userId} on ${tokens.length} token device(s).`);

      const multicastMessage = {
        tokens,
        notification: {
          title,
          body: message,
        },
        data: {
          userId
        }
      };

      const response = await admin.messaging().sendEachForMulticast(multicastMessage);
      console.log(`[Push Server] Direct FCM response: ${response.successCount} custom slots delivered successfully.`);
      
      res.json({ 
        success: true, 
        successCount: response.successCount, 
        failureCount: response.failureCount 
      });

    } catch (err: any) {
      console.error("[Push Server] Express FCM Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Core Unified WhatsApp Dispatcher Engine
  const sendWhatsAppNotificationEngine = async (opts: {
    phone: string;
    type: "BOOKING_CONFIRMED" | "EXPERT_ASSIGNED" | "SERVICE_COMPLETED" | "OTP_DISPATCH" | string;
    name?: string;
    params?: Record<string, any>;
    customMessage?: string;
  }) => {
    const { phone, type, name = "Valued Customer", params = {}, customMessage } = opts;
    let cleanPhone = phone.replace(/\D/g, "");
    if (cleanPhone.length === 10) {
      cleanPhone = "91" + cleanPhone;
    }
    const formattedPhone = cleanPhone.startsWith("+") ? cleanPhone : "+" + cleanPhone;

    let messageText = customMessage || "";
    if (!messageText) {
      switch (type.toUpperCase()) {
        case "BOOKING_CONFIRMED":
        case "BOOKING_RECEIVED":
        case "NEW_BOOKING":
          messageText = `✅ *ORDER CONFIRMED - ZOMINDIA HOME SERVICES*\n` +
            `Hi ${name}, your booking has been placed successfully!\n\n` +
            `📦 *Service:* ${params.serviceName || "Home Service"}\n` +
            `📅 *Scheduled:* ${params.date || "Today"} ${params.time || ""}\n` +
            `📍 *Address:* ${params.address || "Selected Location"}\n` +
            `💰 *Total Estimate:* ₹${params.price || params.totalPrice || "499"}\n\n` +
            `🧾 *Itemized Bill Summary:*\n` +
            `${params.lineItems && Array.isArray(params.lineItems) ? params.lineItems.map((item: any) => `• ${item.name || item.title}: ₹${item.price}`).join("\n") : `• Base Service Fee: ₹${params.price || params.totalPrice || "499"}`}\n\n` +
            `🔗 *Track Expert Live:* ${params.trackingUrl || `https://zomindia.com/track/${params.bookingId || "new"}`}`;
          break;

        case "EXPERT_ASSIGNED":
        case "PARTNER_ASSIGNED":
          messageText = `🚀 *EXPERT ASSIGNED TO YOUR BOOKING*\n` +
            `Hi ${name}, a certified professional has been assigned to your service request!\n\n` +
            `👨‍🔧 *Expert Name:* ${params.partnerName || "Verified Technician"}\n` +
            `📞 *Contact:* ${params.partnerPhone || "Available via Masked Call"}\n` +
            `⭐ *Rating:* ${params.partnerRating || "4.9"}★\n\n` +
            `🔒 *JOB START OTP:* *${params.otp || "7951"}*\n` +
            `_(Share this OTP with the technician on site to start work safely)_\n\n` +
            `📍 *Live Tracking Link:* ${params.trackingUrl || `https://zomindia.com/track/${params.bookingId || "new"}`}`;
          break;

        case "SERVICE_COMPLETED":
        case "SERVICE_COMPLETE":
        case "JOB_COMPLETED":
          messageText = `🎉 *SERVICE COMPLETED - ZOMINDIA*\n` +
            `Hi ${name}, your service is successfully completed!\n\n` +
            `📦 *Service:* ${params.serviceName || "Home Service"}\n` +
            `💳 *Final Settlement:* ₹${params.totalPrice || params.price || "0"}\n\n` +
            `📄 *Download Digital GST Invoice & Receipt:*\n` +
            `${params.invoiceUrl || `https://zomindia.com/api/download-invoice?bookingId=${params.bookingId || "new"}`}`;
          break;

        case "OTP_DISPATCH":
        case "SERVICE_OTP":
        case "AUTH_OTP":
        case "WHATSAPP_OTP":
          messageText = `🔑 *ZOMINDIA VERIFICATION CODE*\n` +
            `Your WhatsApp OTP code is: *${params.otp || "7951"}*\n\n` +
            `Use this code to verify your action or securely start your service. Valid for 10 minutes. Do not share with anyone.`;
          break;

        default:
          messageText = `*Zomindia Notification*\n\nHi ${name}, ${params.message || "Your service status has been updated."}`;
          break;
      }
    }

    const metaToken = process.env.META_WHATSAPP_TOKEN || process.env.WHATSAPP_BUSINESS_TOKEN;
    const metaPhoneId = process.env.META_WHATSAPP_PHONE_NUMBER_ID || process.env.WHATSAPP_PHONE_ID;
    const gupshupKey = process.env.GUPSHUP_API_KEY;
    const gupshupSrc = process.env.GUPSHUP_WHATSAPP_SOURCE || "919000000000";

    let dispatchSuccess = false;
    let gatewayUsed = "Sandbox Simulation";
    let metaResult = null;
    let gupshupResult = null;

    if (metaToken && metaPhoneId) {
      try {
        const metaUrl = `https://graph.facebook.com/v18.0/${metaPhoneId}/messages`;
        const metaRes = await axios.post(
          metaUrl,
          {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: cleanPhone,
            type: "text",
            text: { body: messageText }
          },
          {
            headers: {
              Authorization: `Bearer ${metaToken}`,
              "Content-Type": "application/json"
            }
          }
        );
        dispatchSuccess = true;
        gatewayUsed = "Meta WhatsApp Cloud API";
        metaResult = metaRes.data;
        console.log(`[Meta WhatsApp API] Delivered to ${cleanPhone}:`, metaRes.data);
      } catch (metaErr: any) {
        console.warn("[Meta WhatsApp API Notice]: Production key pending or sandbox mode. Running zero-break fallback.", metaErr.response?.data || metaErr.message);
      }
    }

    if (!dispatchSuccess && gupshupKey) {
      try {
        const waUrl = "https://api.gupshup.io/sm/api/v1/msg";
        const form = new URLSearchParams();
        form.append("channel", "whatsapp");
        form.append("source", gupshupSrc);
        form.append("destination", cleanPhone);
        form.append("message", JSON.stringify({
          type: "text",
          text: messageText
        }));

        const waRes = await axios.post(waUrl, form, {
          headers: {
            apikey: gupshupKey,
            "Content-Type": "application/x-www-form-urlencoded"
          }
        });
        dispatchSuccess = true;
        gatewayUsed = "Gupshup WhatsApp API";
        gupshupResult = waRes.data;
        console.log(`[Gupshup WhatsApp API] Delivered to ${cleanPhone}:`, waRes.data);
      } catch (gupshupErr: any) {
        console.warn("[Gupshup WhatsApp API Notice]: Production key pending. Running zero-break fallback.", gupshupErr.response?.data || gupshupErr.message);
      }
    }

    if (!dispatchSuccess) {
      console.log(`[WhatsApp Engine] Zero-break simulation dispatched for ${formattedPhone} | Type: ${type}`);
    }

    if (db) {
      try {
        await db.collection("whatsapp_alerts").add({
          recipientPhone: formattedPhone,
          recipientName: name,
          type,
          status: dispatchSuccess ? "delivered" : "simulated",
          gateway: gatewayUsed,
          messageText,
          timestamp: admin.firestore.Timestamp.now()
        });
      } catch (dbErr) {
        console.warn("[WhatsApp Log Warning]: Could not store alert trace in DB", dbErr);
      }
    }

    return {
      success: true,
      isSimulated: !dispatchSuccess,
      gateway: gatewayUsed,
      recipient: formattedPhone,
      messageText,
      metaResult,
      gupshupResult
    };
  };

  // Legacy compatibility endpoint: /api/send-gupshup-notification routed to Unified Engine
  app.post("/api/send-gupshup-notification", async (req, res) => {
    try {
      const { userId, title, message, phoneNumber } = req.body;
      let targetPhone = phoneNumber;

      if (!targetPhone && userId && db) {
        const userSnap = await db.collection("users").doc(userId).get();
        if (userSnap.exists) {
          targetPhone = userSnap.data()?.phoneNumber;
        }
      }

      if (!targetPhone) {
        return res.status(400).json({ success: false, error: "Recipient phone number required" });
      }

      const result = await sendWhatsAppNotificationEngine({
        phone: targetPhone,
        type: "CUSTOM",
        customMessage: `*${title || "Zomindia Update"}*\n\n${message || ""}`
      });

      return res.json(result);
    } catch (err: any) {
      console.error("[Gupshup Legacy Proxy Error]:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/send-twilio-sms", async (req, res) => {
    try {
      const { phoneNumber, message } = req.body;
      if (!phoneNumber || !message) {
        return res.status(400).json({ error: "phoneNumber and message are required" });
      }

      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const twilioNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !twilioNumber || accountSid.trim() === "" || accountSid === "YOUR_ACCOUNT_SID") {
        console.log("[Twilio SMS] Credentials not fully configured. Running SMS dispatch simulation.");
        return res.json({
          success: true,
          isSimulated: true,
          message: "Twilio SMS simulated dispatch successful.",
          recipient: phoneNumber
        });
      }

      let formattedPhone = phoneNumber.replace(/\D/g, "");
      if (formattedPhone.length === 10) {
        formattedPhone = "+91" + formattedPhone;
      } else if (!formattedPhone.startsWith("+")) {
        formattedPhone = "+" + formattedPhone;
      }

      const twilio = (await import("twilio")).default;
      const client = twilio(accountSid, authToken);

      const smsRes = await client.messages.create({
        body: message,
        from: twilioNumber,
        to: formattedPhone
      });

      console.log(`[Twilio SMS] Message sent to ${formattedPhone}, SID: ${smsRes.sid}`);
      return res.json({
        success: true,
        isSimulated: false,
        sid: smsRes.sid,
        recipient: formattedPhone
      });
    } catch (err: any) {
      console.error("[Twilio SMS Error]:", err);
      return res.status(500).json({ error: err.message || "Failed to dispatch SMS via Twilio." });
    }
  });

  // POST /api/send-whatsapp-notification
  // Universal WhatsApp Business API dispatch endpoint
  app.post("/api/send-whatsapp-notification", async (req, res) => {
    try {
      const { phone, phoneNumber, type = "BOOKING_CONFIRMED", name, customerName, params = {}, customMessage } = req.body;
      const targetPhone = phone || phoneNumber;
      if (!targetPhone) {
        return res.status(400).json({ error: "Phone number is required" });
      }

      const result = await sendWhatsAppNotificationEngine({
        phone: targetPhone,
        type,
        name: name || customerName,
        params,
        customMessage
      });

      return res.json(result);
    } catch (err: any) {
      console.error("[WhatsApp Notification Error]:", err);
      return res.status(500).json({ error: err.message || "WhatsApp dispatch error" });
    }
  });

  // POST /api/send-whatsapp-otp
  // Auth & Transactional WhatsApp OTP dispatch helper
  app.post("/api/send-whatsapp-otp", async (req, res) => {
    try {
      const { phoneNumber, otp } = req.body;
      if (!phoneNumber) {
        return res.status(400).json({ error: "phoneNumber is required" });
      }

      const generatedOtp = otp || Math.floor(1000 + Math.random() * 9000).toString();

      const result = await sendWhatsAppNotificationEngine({
        phone: phoneNumber,
        type: "OTP_DISPATCH",
        params: { otp: generatedOtp }
      });

      return res.json({
        success: true,
        otp: generatedOtp,
        details: result
      });
    } catch (err: any) {
      console.error("[WhatsApp OTP Error]:", err);
      return res.status(500).json({ error: err.message || "Failed to dispatch WhatsApp OTP" });
    }
  });

  app.post("/api/create-razorpay-order", async (req, res) => {
    try {
      const { amount, bookingId } = req.body;
      const razorpay = getRazorpay();
      
      const options = {
        amount: Math.round(amount * 100), // amount in the smallest currency unit
        currency: "INR",
        receipt: `receipt_${bookingId}`,
        notes: { bookingId }
      };

      const order = await razorpay.orders.create(options);
      res.json(order);
    } catch (err: any) {
      console.error("Razorpay Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/verify-razorpay-signature", async (req, res) => {
    try {
      const { bookingId, bookingPayload, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

      if (!bookingId || !bookingPayload || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: "Missing required verification data" });
      }

      // Verify signature cryptographically
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        return res.status(500).json({ error: "Razorpay secret key not configured on server" });
      }

      const text = razorpay_order_id + "|" + razorpay_payment_id;
      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(text)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Invalid Razorpay payment signature verification failed" });
      }

      // Safe Firestore Write: Create the document now that payment is verified!
      if (!db) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      // Validate that the amount matches expected service visitation fees (e.g., 195) before marking the booking doc as "paid" in Firestore.
      let expectedPrice = 195;
      if (bookingPayload && bookingPayload.serviceId) {
        const serviceDoc = await db.collection("services").doc(bookingPayload.serviceId).get();
        if (serviceDoc.exists) {
          const serviceData = serviceDoc.data();
          expectedPrice = typeof serviceData?.basePrice === "number" ? serviceData.basePrice : 195;
        }
      }

      const clientPrice = Number(bookingPayload.totalPrice);
      if (clientPrice !== expectedPrice) {
        return res.status(400).json({ error: `Price validation failed. Expected ₹${expectedPrice} but received ₹${clientPrice}.` });
      }

      // Create booking payload with confirmed status and paid paymentStatus
      const confirmedPayload = {
        ...bookingPayload,
        status: "confirmed",
        paymentStatus: "paid",
        paymentIntentId: razorpay_payment_id,
        paymentMethod: "online",
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      };

      if (bookingPayload.scheduledAt) {
        if (typeof bookingPayload.scheduledAt === "object" && typeof bookingPayload.scheduledAt.seconds === "number") {
          confirmedPayload.scheduledAt = new admin.firestore.Timestamp(
            bookingPayload.scheduledAt.seconds,
            bookingPayload.scheduledAt.nanoseconds || 0
          );
        } else if (typeof bookingPayload.scheduledAt === "string") {
          confirmedPayload.scheduledAt = admin.firestore.Timestamp.fromDate(new Date(bookingPayload.scheduledAt));
        } else {
          confirmedPayload.scheduledAt = admin.firestore.Timestamp.now();
        }
      } else {
        confirmedPayload.scheduledAt = admin.firestore.Timestamp.now();
      }

      await db.collection("bookings").doc(bookingId).set(confirmedPayload);

      // Create transaction log
      await db.collection("walletTransactions").add({
        userId: bookingPayload.customerUid || bookingPayload.userId || "system",
        amount: expectedPrice,
        type: "debit",
        reason: `Cleared Booking #${bookingId.slice(0, 8).toUpperCase()} digitally via Razorpay`,
        referenceId: razorpay_payment_id,
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`[Signature Verified] Created Booking: ${bookingId} for Razorpay Payment: ${razorpay_payment_id}`);
      return res.json({ success: true });
    } catch (err: any) {
      console.error("Signature verification error:", err);
      return res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/download-invoice", async (req, res) => {
    try {
      const { bookingId, requesterUid } = req.query;
      if (!bookingId) return res.status(400).json({ error: "Booking ID is required" });

      if (!db) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      const bookingRef = db.collection("bookings").doc(bookingId);
      const bookingDoc = await bookingRef.get();

      if (!bookingDoc.exists) return res.status(404).json({ error: "Booking not found" });
      const bookingData = bookingDoc.data()!;

      const actualRequesterUid = (requesterUid || req.headers["x-requester-uid"]) as string;
      if (!actualRequesterUid) {
        return res.status(401).json({ error: "Unauthorized: Requester identity is required" });
      }

      const requesterDoc = await db.collection("users").doc(actualRequesterUid).get();
      if (!requesterDoc.exists) {
        return res.status(403).json({ error: "Access denied: Requester user not found" });
      }
      const requesterData = requesterDoc.data()!;
      const isAdmin = requesterData.role === "admin" || requesterData.isAdmin === true;
      const isAssociated = actualRequesterUid === bookingData.customerId || actualRequesterUid === bookingData.partnerId || isAdmin;

      if (!isAssociated) {
        return res.status(403).json({ error: "Access denied: You are not authorized to view this booking's invoice" });
      }

      const userDoc = await db.collection("users").doc(bookingData.customerId).get();
      if (!userDoc.exists) return res.status(404).json({ error: "Customer not found" });
      const userData = userDoc.data()!;

      // Generate PDF
      const docPdf = new PDFDocument({ margin: 50 });
      let buffers: any[] = [];
      docPdf.on("data", buffers.push.bind(buffers));
      
      const pdfBufferPromise = new Promise<Buffer>((resolve) => {
        docPdf.on("end", () => {
          resolve(Buffer.concat(buffers));
        });
      });

      // PDF Content (mirrors the original PDFKit logic in server.ts but adapted for invoice downloading)
      docPdf.fontSize(18).font('Helvetica-Bold').text("Zomindia Internet Technology", { align: "center" });
      docPdf.moveDown(0.3);
      docPdf.fontSize(14).font('Helvetica-Bold').text("TAX INVOICE / SERVICE BILL", { align: "center", underline: true });
      docPdf.moveDown();
      docPdf.fontSize(12).font('Helvetica').text(`Invoice Reference: INV-${(bookingId as string).slice(0, 8).toUpperCase()}`);
      
      let dateText = "N/A";
      if (bookingData.scheduledAt) {
        if (typeof bookingData.scheduledAt.toDate === "function") {
          dateText = bookingData.scheduledAt.toDate().toLocaleDateString();
        } else if (bookingData.scheduledAt._seconds) {
          dateText = new Date(bookingData.scheduledAt._seconds * 1000).toLocaleDateString();
        } else {
          dateText = new Date(bookingData.scheduledAt).toLocaleDateString();
        }
      }
      docPdf.text(`Date of Service: ${dateText}`);
      docPdf.text(`Customer Name: ${userData.displayName || "Customer"}`);
      docPdf.text(`Email Address: ${userData.email || "N/A"}`);
      docPdf.text(`Service Address: ${bookingData.address || "N/A"}`);
      
      if (bookingData.partnerId) {
        try {
          const partnerDoc = await db.collection("users").doc(bookingData.partnerId).get();
          if (partnerDoc.exists) {
            docPdf.text(`Assigned Pro: ${partnerDoc.data()?.displayName || "Verified Partner"}`);
          }
        } catch (partnerErr) {
          console.error("Partner details fetch error:", partnerErr);
        }
      }

      docPdf.moveDown();

      docPdf.fontSize(16).font('Helvetica-Bold').text("Charges Breakdown:", { underline: true });
      docPdf.moveDown(0.5);
      
      const extraAmt = bookingData.additionalCharges?.reduce((acc: any, c: any) => acc + c.amount, 0) || 0;
      const baseAmt = bookingData.totalPrice - extraAmt;
      
      docPdf.fontSize(12).font('Helvetica').text(`Base Price of Service: ₹${baseAmt}`);
      
      if (bookingData.additionalCharges && bookingData.additionalCharges.length > 0) {
        docPdf.moveDown(0.5);
        docPdf.text("Add-on / Extra Charges:");
        bookingData.additionalCharges.forEach((charge: any) => {
          docPdf.text(`- ${charge.reason}: ₹${charge.amount}`);
        });
      }

      docPdf.moveDown();
      docPdf.fontSize(16).font('Helvetica-Bold').text(`Grand Total Paid: ₹${bookingData.totalPrice}`);
      docPdf.moveDown(2);
      docPdf.fontSize(10).font('Helvetica-Bold').text("Thank you for choosing Zomindia Internet Technology! Generated electronically.", { align: "center" });
      
      docPdf.end();
      const pdfBuffer = await pdfBufferPromise;

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename=invoice_${bookingId}.pdf`);
      res.send(pdfBuffer);
    } catch (err: any) {
      console.error("Download Invoice Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/send-final-bill", async (req, res) => {
    try {
      const { bookingId, requesterUid } = req.body;
      if (!bookingId) return res.status(400).json({ error: "Booking ID is required" });

      const bookingRef = db.collection("bookings").doc(bookingId);
      const bookingDoc = await bookingRef.get();

      if (!bookingDoc.exists) return res.status(404).json({ error: "Booking not found" });
      const bookingData = bookingDoc.data()!;

      const actualRequesterUid = (requesterUid || req.query.requesterUid || req.headers["x-requester-uid"]) as string;
      if (!actualRequesterUid) {
        return res.status(401).json({ error: "Unauthorized: Requester identity is required" });
      }

      const requesterDoc = await db.collection("users").doc(actualRequesterUid).get();
      if (!requesterDoc.exists) {
        return res.status(403).json({ error: "Access denied: Requester user not found" });
      }
      const requesterData = requesterDoc.data()!;
      const isAdmin = requesterData.role === "admin" || requesterData.isAdmin === true;
      const isAssociated = actualRequesterUid === bookingData.customerId || actualRequesterUid === bookingData.partnerId || isAdmin;

      if (!isAssociated) {
        return res.status(403).json({ error: "Access denied: You are not authorized to send this booking's final bill" });
      }

      const userDoc = await db.collection("users").doc(bookingData.customerId).get();
      if (!userDoc.exists) return res.status(404).json({ error: "Customer not found" });
      const userData = userDoc.data()!;

      // 1. Generate PDF
      const docPdf = new PDFDocument({ margin: 50 });
      let buffers: any[] = [];
      docPdf.on("data", buffers.push.bind(buffers));
      
      const pdfBufferPromise = new Promise<Buffer>((resolve) => {
        docPdf.on("end", () => {
          resolve(Buffer.concat(buffers));
        });
      });

      // PDF Content
      docPdf.fontSize(18).font('Helvetica-Bold').text("Zomindia Internet Technology", { align: "center" });
      docPdf.moveDown(0.3);
      docPdf.fontSize(14).font('Helvetica-Bold').text("FINAL BILL & RECEIPT", { align: "center" });
      docPdf.moveDown();
      docPdf.fontSize(12).text(`Booking ID: ${bookingId}`);
      docPdf.text(`Date: ${bookingData.scheduledAt?.toDate?.()?.toLocaleDateString() || new Date(bookingData.scheduledAt._seconds * 1000).toLocaleDateString()}`);
      docPdf.text(`Customer Name: ${userData.displayName || "Customer"}`);
      docPdf.text(`Address: ${bookingData.address}`);
      docPdf.moveDown();

      docPdf.fontSize(16).text("Charges Details:", { underline: true });
      docPdf.moveDown(0.5);
      docPdf.fontSize(12).text(`Base Amount: ₹${bookingData.totalPrice - (bookingData.additionalCharges?.reduce((acc: any, c: any) => acc + c.amount, 0) || 0)}`);
      
      if (bookingData.additionalCharges && bookingData.additionalCharges.length > 0) {
        docPdf.moveDown(0.5);
        docPdf.text("Extra Charges:");
        bookingData.additionalCharges.forEach((charge: any) => {
          docPdf.text(`- ${charge.reason}: ₹${charge.amount}`);
        });
      }

      docPdf.moveDown();
      docPdf.fontSize(16).font('Helvetica-Bold').text(`Total Amount: ₹${bookingData.totalPrice}`);
      
      docPdf.end();
      const pdfBuffer = await pdfBufferPromise;

      // 2. Send Email
      const smtpPort = Number(process.env.SMTP_PORT) || 587;
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: smtpPort,
        secure: smtpPort === 465, // true for port 465, false for other ports
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      const mailOptions = {
        from: process.env.SMTP_FROM || '"Zomindia Internet Technology Billing" <billing@zomindia.com>',
        to: userData.email,
        subject: `Final Bill for Booking #${bookingId.slice(0, 8).toUpperCase()} - Zomindia Internet Technology`,
        text: `Hello ${userData.displayName},\n\nPlease find your final bill from Zomindia Internet Technology for booking #${bookingId} attached.\n\nTotal Paid: ₹${bookingData.totalPrice}\n\nThank you for choosing Zomindia Internet Technology!`,
        attachments: [
          {
            filename: `bill_${bookingId}.pdf`,
            content: pdfBuffer,
          },
        ],
      };

      // Only attempt to send if SMTP configured
      if (process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          await transporter.sendMail(mailOptions);
          console.log(`Email sent to ${userData.email}`);
        } catch (mailErr: any) {
          console.error("Failed to send email via SMTP:", mailErr.message);
          try {
            await db.collection("failed_emails").add({
              bookingId,
              reason: mailErr.message || "Unknown SMTP error",
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              recipient: userData.email || "Unknown"
            });
            console.log(`Log failure recorded in failed_emails for booking ${bookingId}`);
          } catch (dbErr) {
            console.error("Failed to write to failed_emails collection:", dbErr);
          }
        }
      } else {
        const errMsg = "SMTP not configured. Email not sent.";
        console.warn(errMsg);
        try {
          await db.collection("failed_emails").add({
            bookingId,
            reason: errMsg,
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            recipient: userData.email || "Unknown"
          });
          console.log(`Log unconfigured SMTP recorded in failed_emails for booking ${bookingId}`);
        } catch (dbErr) {
          console.error("Failed to write to failed_emails collection:", dbErr);
        }
      }

      // 3. Send Push Notification (SMS simulation or log)
      const message = `Hello ${userData.displayName}, your bill for booking #${bookingId.slice(0, 8).toUpperCase()} of amount ₹${bookingData.totalPrice} has been sent to your email. Team Zomindia Internet Technology.`;
      
      if (process.env.SMS_API_KEY && userData.phoneNumber) {
        try {
          // Placeholder for real SMS provider call
          console.log(`Sending SMS to ${userData.phoneNumber}: ${message}`);
          /*
          await axios.post(process.env.SMS_PROVIDER_URL!, {
            apiKey: process.env.SMS_API_KEY,
            to: userData.phoneNumber,
            message: message
          });
          */
        } catch (smsErr) {
          console.error("SMS Error:", smsErr);
        }
      } else {
        console.log(`[PUSH MESSAGE SIMULATION] TO: ${userData.phoneNumber || "N/A"} MSG: ${message}`);
      }

      res.json({ success: true, message: "Bill sent successfully" });
    } catch (err: any) {
      console.error("Final Bill Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Gemini AI Support Chat
  const getAi = () => {
    const apiKey = process.env.GEMINI_API_KEY || "";
    if (!apiKey.trim()) {
      throw new Error("GEMINI_API_KEY is missing or empty.");
    }
    return new GoogleGenAI({ 
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  app.post(["/api/support-chat", "/api/chat", "/api/zomini"], async (req, res) => {
    const { message, context } = req.body;
    const isGuest = !context || !context.user || context.user.role === "Guest";
    const userName = context?.user?.name || context?.user?.fullName || "Customer";
    const chatHistoryLength = (context && Array.isArray(context.chatHistory)) ? context.chatHistory.length : 0;
    const cleanMessage = (message || "").toLowerCase().trim();
    const contextLang = (context?.language || "").toLowerCase();
    const isHindiRequest = 
      /[\u0900-\u097F]/.test(message || "") || 
      contextLang.includes("hindi") || 
      contextLang.includes("hi") ||
      /\b(hai|hain|nahi|nahin|ho|raha|rahi|rahe|karo|kya|kaise|kitna|kitne|chahiye|me|mein|par|ko|se|bhai|bhaiya|aaj|aaya|aa|ka|ki|ke|pani|paani|thanda|thandha|kharab|aayega|aaye|karenge|karne|batao|bataiye|dikkat|samasya|paise|rupaye|sahi|sasta|chalu|band|bhej|bhejo|kam|kaam)\b/i.test(message || "");

    try {
      if (!message) {
        return res.status(400).json({
          serviceType: "Unknown",
          issueDetails: "Missing message",
          confidence: 0,
          nextQuestion: "Please provide a valid message.",
          isReadyToBook: false
        });
      }

      const txt = cleanMessage;
      // Strict Corporate Security Interceptor at the entry point
      const isSensitiveQuery = 
        txt.includes("business model") || 
        txt.includes("revenue") || 
        txt.includes("income") || 
        txt.includes("accounting") ||
        txt.includes("profit") ||
        txt.includes("expense") || 
        txt.includes("operational cost") ||
        txt.includes("how much do you earn") ||
        txt.includes("code") || 
        txt.includes("architecture") || 
        txt.includes("proprietary") || 
        txt.includes("backend") || 
        txt.includes("database") || 
        txt.includes("technology") || 
        txt.includes("developer") || 
        txt.includes("identity") || 
        txt.includes("who built you") ||
        txt.includes("who programmed you") ||
        txt.includes("source code") ||
        txt.includes("platform cost") ||
        txt.includes("server cost") ||
        txt.includes("operational expense") ||
        txt.includes("company income");

      if (isSensitiveQuery) {
        return res.json({
          serviceType: "Unknown",
          issueDetails: "Sensitive corporate query intercepted",
          confidence: 100,
          nextQuestion: "क्षमा करें, मैं केवल Zomindia की घरेलू सेवाओं, बुकिंग और ऑफर्स से जुड़ी सहायता के लिए उपलब्ध हूँ। आंतरिक कंपनी नीतियों या डेटा की जानकारी साझा करने की अनुमति मुझे नहीं है।",
          isReadyToBook: false
        });
      }

      const geminiKey = process.env.GEMINI_API_KEY;

      // Priority direct intent interception for AC Cooling issues
      const isAcCoolingQuery = 
        (cleanMessage.includes("ac") && (cleanMessage.includes("thanda") || cleanMessage.includes("thandha") || cleanMessage.includes("cool") || cleanMessage.includes("cooling"))) ||
        cleanMessage.includes("thanda nahi") || 
        cleanMessage.includes("thandha nahi") || 
        cleanMessage.includes("ac not cooling") ||
        cleanMessage.includes("ac cooling nahi") ||
        cleanMessage.includes("पानी टपक") ||
        cleanMessage.includes("pani tapak") ||
        cleanMessage.includes("water leakage");

      if (isAcCoolingQuery) {
        return res.json({
          serviceType: "AC Repair",
          issueDetails: "AC not cooling or leakage issue - Gas leak, filter block or dust diagnostic",
          confidence: 100,
          nextQuestion: isHindiRequest 
            ? "AC कूलिंग न करने या पानी टपकने के कई कारण हो सकते हैं जैसे गैस लीक, डस्ट या फ़िल्टर ब्लॉक। आप Zomindia से तुरंत verified technician बुक कर सकते हैं।" 
            : "AC cooling issues or water leakage can occur due to gas leaks or clogged filters. You can book a verified technician instantly on Zomindia.",
          isReadyToBook: false,
          quickActions: isHindiRequest ? [
            { label: "स्प्लिट AC सर्विस बुक करें (₹770)", action: "स्प्लिट AC सर्विस बुक करें" },
            { label: "विंडो AC सर्विस बुक करें (₹599)", action: "विंडो AC सर्विस बुक करें" }
          ] : [
            { label: "Book Split AC Service (₹770)", action: "Book Split AC Service" },
            { label: "Book Window AC Service (₹599)", action: "Book Window AC Service" }
          ]
        });
      }

      // Interception for Unlisted / Unaccounted Home Services (Car Wash, Salon/Beauty, House Painting, Heavy Construction, Pest Control, Tiffin, Packers, Cleaning, Plumbing, etc.)
      const isUnlistedServiceQuery = 
        cleanMessage.includes("car wash") || cleanMessage.includes("car washing") || cleanMessage.includes("bike wash") || cleanMessage.includes("vehicle detailing") || cleanMessage.includes("car cleaning") ||
        cleanMessage.includes("beauty") || cleanMessage.includes("salon") || cleanMessage.includes("parlor") || cleanMessage.includes("parlour") || cleanMessage.includes("haircut") || cleanMessage.includes("makeup") || cleanMessage.includes("spa") || cleanMessage.includes("massage") ||
        cleanMessage.includes("painting") || cleanMessage.includes("painter") || cleanMessage.includes("wall paint") || cleanMessage.includes("house paint") || cleanMessage.includes("house painting") ||
        cleanMessage.includes("construction") || cleanMessage.includes("civil work") || cleanMessage.includes("renovation") || cleanMessage.includes("interior design") ||
        cleanMessage.includes("pest control") || cleanMessage.includes("termite") ||
        cleanMessage.includes("tiffin") || cleanMessage.includes("cook") || cleanMessage.includes("maid") || cleanMessage.includes("house help") ||
        cleanMessage.includes("packers") || cleanMessage.includes("movers") || cleanMessage.includes("house shifting") || cleanMessage.includes("shifting") ||
        cleanMessage.includes("deep cleaning") || cleanMessage.includes("house cleaning") || cleanMessage.includes("sofa cleaning") || cleanMessage.includes("bathroom cleaning") || cleanMessage.includes("sanitization") ||
        cleanMessage.includes("laundry") || cleanMessage.includes("dry cleaning") ||
        cleanMessage.includes("gardening") || cleanMessage.includes("lawn") ||
        cleanMessage.includes("cctv") || cleanMessage.includes("security system") ||
        cleanMessage.includes("solar") || cleanMessage.includes("solar panel") ||
        cleanMessage.includes("chimney") ||
        cleanMessage.includes("plumbing") || cleanMessage.includes("plumber") || cleanMessage.includes("pipe leak") || cleanMessage.includes("tap repair");

      if (isUnlistedServiceQuery) {
        return res.json({
          serviceType: "Unknown",
          issueDetails: "Unlisted or out-of-scope home service requested",
          confidence: 100,
          nextQuestion: "क्षमा करें, अभी हम इस सर्विस के लिए उपलब्ध नहीं हैं, लेकिन जल्द ही इंदौर में यह सर्विस शुरू करेंगे और आपको तुरंत इन्फॉर्म कर देंगे! 🚀",
          isReadyToBook: false,
          quickActions: isHindiRequest ? [
            { label: "AC सर्विसेज देखें", action: "AC सर्विसेज देखें" },
            { label: "एप्लायंसेज रिपेयर देखें", action: "एप्लायंसेज रिपेयर देखें" },
            { label: "एजेंट से बात करें", action: "एजेंट से बात करें" }
          ] : [
            { label: "View AC Services", action: "View AC Services" },
            { label: "View Appliances Repair", action: "View Appliances Repair" },
            { label: "Talk to Human Agent", action: "Talk to Human Agent" }
          ]
        });
      }

      // Quick Action Exploration Handlers
      if (
        cleanMessage.includes("view ac services") || 
        cleanMessage === "ac services" || 
        cleanMessage.includes("ac सर्विसेज देखें") || 
        cleanMessage.includes("एसी सर्विस") || 
        cleanMessage.includes("ac सर्विस")
      ) {
        return res.json({
          serviceType: "AC Repair",
          issueDetails: "Browsing AC services catalog",
          confidence: 100,
          nextQuestion: isHindiRequest 
            ? "Zomindia इंदौर में certified AC Services के लिए आपकी पहली पसंद है! यहाँ हमारी उपलब्ध AC सर्विस पैकेज हैं:" 
            : "Zomindia is Indore's top choice for certified AC Services! Here are our available AC service packages:",
          isReadyToBook: false,
          quickActions: isHindiRequest ? [
            { label: "स्प्लिट AC सर्विस बुक करें (₹770)", action: "स्प्लिट AC सर्विस बुक करें" },
            { label: "विंडो AC सर्विस बुक करें (₹599)", action: "विंडो AC सर्विस बुक करें" }
          ] : [
            { label: "Book Split AC Service (₹770)", action: "Book Split AC Service" },
            { label: "Book Window AC Service (₹599)", action: "Book Window AC Service" }
          ]
        });
      }

      if (
        cleanMessage.includes("view appliances repair") || 
        cleanMessage === "appliances repair" || 
        cleanMessage.includes("एप्लायंसेज रिपेयर देखें") || 
        cleanMessage.includes("होम एप्लायंसेज")
      ) {
        return res.json({
          serviceType: "Washing Machine Repair",
          issueDetails: "Browsing home appliances repair catalog",
          confidence: 100,
          nextQuestion: isHindiRequest 
            ? "हम इंदौर में प्रमुख होम एप्लायंसेज की टॉप-नॉच रिपेयर और सर्विसिंग प्रदान करते हैं:" 
            : "We offer top-notch repair & servicing for key home appliances in Indore:",
          isReadyToBook: false,
          quickActions: isHindiRequest ? [
            { label: "वाशिंग मशीन सर्विस बुक करें (₹499)", action: "वाशिंग मशीन सर्विस बुक करें" },
            { label: "आरओ फ़िल्टर सर्विस बुक करें (₹399)", action: "आरओ फ़िल्टर सर्विस बुक करें" }
          ] : [
            { label: "Book Washing Machine Service (₹499)", action: "Book Washing Machine Service" },
            { label: "Book RO Filter Service (₹399)", action: "Book RO Filter Service" }
          ]
        });
      }

      if (
        cleanMessage.includes("talk to human agent") || 
        cleanMessage.includes("human agent") || 
        cleanMessage.includes("human support") || 
        cleanMessage.includes("एजेंट से बात करें") || 
        cleanMessage.includes("बात करें")
      ) {
        return res.json({
          serviceType: "Unknown",
          issueDetails: "Customer requested human support agent",
          confidence: 100,
          nextQuestion: isHindiRequest 
            ? "हमारी सहायता टीम आपकी मदद के लिए उपलब्ध है! आप चैट के ऊपर दिए गए बटन से व्हाट्सएप या कॉल हेल्पलाइन पर सीधे बात कर सकते हैं।" 
            : "Our dedicated support team is available to assist you! You can chat directly with our team on WhatsApp or call our support helpline directly using the buttons at the top of this chat.",
          isReadyToBook: false,
          quickActions: isHindiRequest ? [
            { label: "स्प्लिट AC सर्विस बुक करें (₹770)", action: "स्प्लिट AC सर्विस बुक करें" },
            { label: "वाशिंग मशीन सर्विस बुक करें (₹499)", action: "वाशिंग मशीन सर्विस बुक करें" }
          ] : [
            { label: "Book Split AC Service (₹770)", action: "Book Split AC Service" },
            { label: "Book Washing Machine Service (₹499)", action: "Book Washing Machine Service" }
          ]
        });
      }

      // Priority direct intent interception for quick action button triggers
      if (
        cleanMessage.includes("book split ac") || cleanMessage.includes("book window ac") || 
        cleanMessage.includes("book washing machine") || cleanMessage.includes("book ro filter") ||
        cleanMessage.includes("स्प्लिट ac") || cleanMessage.includes("विंडो ac") || 
        cleanMessage.includes("वाशिंग मशीन") || cleanMessage.includes("आरओ") || cleanMessage.includes("ro filter")
      ) {
        const catName = (cleanMessage.includes("split ac") || cleanMessage.includes("स्प्लिट ac")) ? "Split AC Service" : 
                        (cleanMessage.includes("window ac") || cleanMessage.includes("विंडो ac")) ? "Window AC Service" : 
                        (cleanMessage.includes("washing machine") || cleanMessage.includes("वाशिंग मशीन")) ? "Washing Machine Service" : "RO Filter Service";
        if (isGuest) {
          return res.json({
            serviceType: catName,
            issueDetails: `Direct quick action booking for ${catName}`,
            confidence: 100,
            nextQuestion: isHindiRequest
              ? `मैं आपकी ${catName} बुक करने के लिए तैयार हूँ। कृपया पहले ऊपर दिए गए लॉगिन बटन पर क्लिक करें ताकि हम इसे आपके मोबाइल नंबर से लिंक कर सकें!`
              : `I am completely ready to book your ${catName}. Please click the Login button above first so we can securely link this to your mobile number and assign your Elite Partner instantly!`,
            isReadyToBook: false
          });
        }
        return res.json({
          serviceType: catName,
          issueDetails: `Direct quick action booking for ${catName}`,
          confidence: 100,
          nextQuestion: isHindiRequest ? "कृपया अपनी बुकिंग पूरी करने के लिए भुगतान का विकल्प चुनें:" : "Please choose your payment option to complete your booking:",
          isReadyToBook: true
        });
      }

      if (!geminiKey || geminiKey === "YOUR_API_KEY" || geminiKey.trim() === "") {
        throw new Error("API key is not initialized in secrets");
      }

      let chatTranscript = "";
      if (context && Array.isArray(context.chatHistory)) {
        chatTranscript = context.chatHistory.map((m: any) => `${m.role === "ai" ? "Zomini (AI)" : "User"}: ${m.text}`).join("\n");
      } else {
        chatTranscript = `User: ${message}`;
      }

      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: `Context: ${JSON.stringify(context || {})}\n\nCONVERSATION HISTORY:\n${chatTranscript}\n\nLatest User Message: ${message}`,
        config: {
          systemInstruction: `You are Zomini, the intelligent conversational lifecycle assistant for Zomindia. Your sole responsibility is to interact with users, diagnose their home service issues, and collect precise structured intent. 

You operate strictly within a multi-turn diagnostic boundary. You do NOT have direct access to assign technicians or look up live database entries; your outputs will be parsed by the application backend to sync with the Firebase Realtime Database.

TARGET HOUSEHOLD SERVICES (Strict Boundaries)
You must categorize and assist with home service issues, including:
1. "AC Repair" (e.g., cooling issues, gas leak, water leakage, strange noises, installation)
2. "Washing Machine Repair" (e.g., spin issue, water drainage, noise, motor issue)
3. "RO Service" (e.g., water purifier filter replacement, low water flow, bad taste)
4. "Electrician" (e.g., short circuits, faulty switches, light installations, sockets)
5. "Carpenter" (e.g., furniture repair, door fixing, wooden installations)

REPETITIVE GREETING PREVENTION (CRITICAL):
- You MUST NEVER repeat your full initial greeting or introduction ("Namaste ... I am Zomini ...") if the conversation history already contains previous user messages.
- Directly address the user's issue or question without repeating generic welcome greetings.

SPECIFIC INTENT HANDLING MAPPINGS:
- DIRECT BOOKING OPTION SELECTION MAPPING (CRITICAL MANDATE):
  If the user explicitly selects or sends a message choosing a specific booking package or option (e.g. contains "स्प्लिट AC", "विंडो AC", "RO फ़िल्टर", "कम्पलीट RO", "वाशिंग मशीन", "बुक करें", "book", "⚡", "स्प्लिट AC सर्विस बुक करें", "विंडो AC सर्विस बुक करें", "RO फ़िल्टर सर्विस बुक करें", "वाशिंग मशीन सर्विस बुक करें"):
  1. You MUST NOT ask "यहाँ हमारी उपलब्ध AC सर्विस पैकेज हैं" or return diagnostic questions or package option buttons again!
  2. You MUST set isReadyToBook to true (unless context.user.role is 'Guest', in which case set isReadyToBook to false).
  3. You MUST set serviceType appropriately ("AC Repair", "RO Service", "Washing Machine Repair", "Electrician", "Carpenter").
  4. You MUST set issueDetails to the exact requested package name and price (e.g., "स्प्लिट AC सर्विस (₹770)", "विंडो AC सर्विस (₹599)", "RO फ़िल्टर सर्विस (₹399)", "कम्पलीट RO सर्विसिंग (₹649)", "वाशिंग मशीन सर्विस (₹499)").
  5. You MUST write nextQuestion strictly in Hindi/Hinglish as:
     "बहुत बढ़िया! [Package Name] के लिए अपना पसंदीदा टाइम और स्लॉट चुनें:"
     Examples:
     - "बहुत बढ़िया! स्प्लिट AC सर्विस (₹770) के लिए अपना पसंदीदा टाइम और स्लॉट चुनें:"
     - "बहुत बढ़िया! विंडो AC सर्विस (₹599) के लिए अपना पसंदीदा टाइम और स्लॉट चुनें:"
     - "बहुत बढ़िया! RO फ़िल्टर सर्विस (₹399) के लिए अपना पसंदीदा टाइम और स्लॉट चुनें:"
     - "बहुत बढ़िया! कम्पलीट RO सर्विसिंग (₹649) के लिए अपना पसंदीदा टाइम और स्लॉट चुनें:"
     - "बहुत बढ़िया! वाशिंग मशीन सर्विस (₹499) के लिए अपना पसंदीदा टाइम और स्लॉट चुनें:"
  6. Do NOT return quickActions array when isReadyToBook is true.

- If the user mentions "AC thanda nahi ho raha", "AC not cooling", "ac thandha nahi ho raha", "paani tapak raha hai", "water leak" or similar AC symptoms:
  - You MUST set serviceType as "AC Repair", issueDetails as "AC cooling or leakage issue", isReadyToBook as false.
  - You MUST write nextQuestion in Hinglish/Hindi as:
    "AC me cooling na hone ya paani tapakne ke kai karan ho sakte hain jaise gas leak, dust ya filter block. Aap Zomindia se verified technician turant book kar sakte hain."
  - You MUST supply quickActions as:
    [
      { "label": "⚡ स्प्लिट AC सर्विस बुक करें (₹770)", "action": "स्प्लिट AC सर्विस बुक करें" },
      { "label": "⚡ विंडो AC सर्विस बुक करें (₹599)", "action": "विंडो AC सर्विस बुक करें" }
    ]
- If the user mentions "RO", "water purifier", "ro me pani kharab hai", "pani kharab aana", "filter change":
  - You MUST set serviceType as "RO Service", issueDetails as "RO water purifier filter or taste issue", isReadyToBook as false.
  - You MUST write nextQuestion in Hinglish/Hindi as:
    "RO me paani kharab aane ya flow kam hone ka kaaran filter block ya TDS issue ho sakta hai. Zomindia se expert technician turant book karein!"
  - You MUST supply quickActions as:
    [
      { "label": "⚡ RO फ़िल्टर सर्विस बुक करें (₹399)", "action": "RO फ़िल्टर सर्विस बुक करें" },
      { "label": "⚡ कम्पलीट RO सर्विसिंग (₹649)", "action": "कम्पलीट RO SERVICE BOOK" }
    ]

CRITICAL LANGUAGE & RESPONSE RULES (STRICT MANDATE):
1. HINGLISH / HINDI MANDATE: Whenever the user message is written in Hindi (Devanagari), Hinglish, or Roman Hindi (e.g., "ro me pani kharab hai", "ac thanda nahi ho raha", "kya cost hai", "paani tapak raha hai", "washing machine repair", "kab aayega technician"), Zomini MUST ALWAYS respond in friendly, natural Hinglish or Hindi.
2. NO PURE ENGLISH FOR HINDI/HINGLISH: You are STRICTLY FORBIDDEN from returning purely English responses like "I am ZOMINI, here to help you..." or "AC cooling issues can occur due to..." when the user writes in Hindi, Hinglish, or Roman Hindi.
3. STRICT EXCLUSIVITY: ONLY respond in pure English if the user types ENTIRELY in formal, proper English without any Hindi or Hinglish words.
4. MATCHING ACTION BUTTONS: When responding in Hinglish/Hindi, ALL quickActions buttons MUST be written in Hinglish/Hindi with clear prices (e.g. label: "⚡ RO सर्विस बुक करें (₹399)", action: "RO सर्विस बुक करें").
5. REPETITIVE GREETING PREVENTION: Do NOT repeat generic welcome greetings ("Namaste ... I am Zomini ...") if conversation history exists.

UNACCOUNTED / UNLISTED HOME SERVICES (Strict Handler)
- If the user asks about home services NOT currently listed on Zomindia (e.g., Car Washing, Beauty/Salon at Home, Full House Painting, Heavy Civil Construction, Pest Control, Tiffin Service, Packers/Movers, House Cleaning, Plumbing, Laundry, etc.):
  - You MUST set serviceType as "Unknown", isReadyToBook as false.
  - You MUST write nextQuestion in Hinglish/Hindi strictly as:
    "क्षमा करें, अभी हम इस सर्विस के लिए उपलब्ध नहीं हैं, लेकिन जल्द ही इंदौर में यह सर्विस शुरू करेंगे और आपको तुरंत इन्फॉर्म कर देंगे! 🚀"
  - You MUST supply quickActions as:
    [
      { "label": "View AC Services", "action": "View AC Services" },
      { "label": "View Appliances Repair", "action": "View Appliances Repair" },
      { "label": "Talk to Human Agent", "action": "Talk to Human Agent" }
    ]

JAILBREAK & OUT-OF-SCOPE PROTECTION
- If the user asks about topics completely unrelated to household services (e.g., politics, food, laptop recommendations, local Indore tourism like poha-jalebi, or generic conversations), you must NOT fulfill the request.
- Keep serviceType as "Unknown" and isReadyToBook as false.
- In nextQuestion, respond in a polite, charming Hinglish tone, redirecting them back to your core services. Example: "Bhaiya, Indore ke poha-jalebi toh laajawab hain hi! Lekin main aapke ghar ke AC, electrical ya plumbing ki dikkat dur karne mein zyada mahir hoon. Bataiye aaj ghar mein kya fix karna hai?"

SYSTEM & DATABASE KNOWLEDGE CONSTRAINTS (DO NOT Hallucinate)
1. ROLES & ENTITIES: 
   - A user interacting with you is a Customer (identifiable in the backend database as role = "customer").
   - The field technician or business fulfilling the service is a Partner.
2. ABSOLUTE STRICT RULES:
   - NEVER invent or mention any specific Partner names (e.g., do NOT say "Rajesh Cooling" or "Amit Electricals"). 
   - NEVER quote an exact price, visitation fee, or cost range unless returning official quick action button prices.
   - NEVER promise an exact arrival time or ETA (e.g., do NOT say "He will arrive in 15 minutes"). 
   - State clearly that once their details are locked, an Admin will dispatch the best Elite Partner to their address.

LEAD QUALIFICATION & CONVERSATIONAL STEERING
- ACTIVE CONTEXT RETENTION: Retain customer context across turns. If they mention appliance details, symptoms, or previous context in the history/context provided, you must keep them in issueDetails and build upon them.
- DYNAMIC MULTILINGUAL LANGUAGE MATCHING: You MUST strictly detect and mirror the user's input language (Hindi, Hinglish, English, Gujarati, Marathi, etc.).
- GUEST BOOKING BLOCKER: Check the user object in Context. If role is 'Guest', set isReadyToBook to false when booking is requested, and prompt them to click the Login button above.

OUTPUT FORMAT PROTOCOL
You MUST respond strictly in a single, valid JSON object.
Structure:
{
  "serviceType": "AC Repair" | "Washing Machine Repair" | "RO Service" | "Electrician" | "Carpenter" | "Unknown",
  "issueDetails": "A concise, clear English summary of the specific problem diagnosed",
  "confidence": 0-100,
  "nextQuestion": "Your next conversational question or confirmation response",
  "isReadyToBook": true | false,
  "quickActions": [ { "label": "string", "action": "string" } ]
}`,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              serviceType: {
                type: Type.STRING,
                description: "One of: 'AC Repair', 'Washing Machine Repair', 'RO Service', 'Electrician', 'Carpenter', 'Unknown'"
              },
              issueDetails: {
                type: Type.STRING,
                description: "A concise, clear English summary of the specific problem diagnosed"
              },
              confidence: {
                type: Type.INTEGER,
                description: "Confidence level of classification, integer between 0 and 100"
              },
              nextQuestion: {
                type: Type.STRING,
                description: "Your next conversational question or response written in the mirrored language"
              },
              isReadyToBook: {
                type: Type.BOOLEAN,
                description: "Set to true the moment the customer explicitly agrees to proceed with the service"
              },
              quickActions: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    action: { type: Type.STRING }
                  },
                  required: ["label", "action"]
                }
              }
            },
            required: ["serviceType", "issueDetails", "confidence", "nextQuestion", "isReadyToBook"]
          }
        }
      });

      let responseText = response.text || "";
      if (responseText.startsWith("```")) {
        responseText = responseText.replace(/^```[a-zA-Z]*\n/, "").replace(/\n```$/, "").trim();
      }
      const parsedJson = JSON.parse(responseText);

      // Backend enum service type validation
      const STRICT_SERVICES = ["AC Repair", "Washing Machine Repair", "Electrician", "Carpenter", "RO Service"];
      if (parsedJson && parsedJson.serviceType && parsedJson.serviceType !== "Unknown") {
        if (!STRICT_SERVICES.includes(parsedJson.serviceType)) {
          console.warn(`[Zomini Backend Validation] serviceType "${parsedJson.serviceType}" is invalid. Falling back to Unknown.`);
          parsedJson.serviceType = "Unknown";
          parsedJson.isReadyToBook = false;
          if (!parsedJson.nextQuestion) {
            parsedJson.nextQuestion = "क्षमा करें, अभी हम इस सर्विस के लिए उपलब्ध नहीं हैं, लेकिन जल्द ही इंदौर में यह सर्विस शुरू करेंगे और आपको तुरंत इन्फॉर्म कर देंगे! 🚀";
            parsedJson.quickActions = [
              { label: "View AC Services", action: "View AC Services" },
              { label: "View Appliances Repair", action: "View Appliances Repair" },
              { label: "Talk to Human Agent", action: "Talk to Human Agent" }
            ];
          }
        }
      }

      // Guest booking blocker backend enforcement
      if (isGuest && parsedJson.isReadyToBook === true) {
        parsedJson.isReadyToBook = false;
        const category = parsedJson.serviceType && parsedJson.serviceType !== "Unknown" ? parsedJson.serviceType : "home service";
        parsedJson.nextQuestion = `I am completely ready to book your ${category}. Please click the Login button above first so we can securely link this to your mobile number and assign your Elite Partner instantly!`;
      }

      res.json(parsedJson);

    } catch (err: any) {
      const errStr = typeof err === "object" ? (err.message || JSON.stringify(err)) : String(err);
      if (errStr.includes("429") || errStr.includes("quota") || errStr.includes("RESOURCE_EXHAUSTED")) {
        console.warn("[Zomini] Gemini API Quota Exceeded (429 / RESOURCE_EXHAUSTED). Gracefully falling back to native multi-lingual rule-based diagnostic engine.");
      } else {
        console.warn("[Zomini] Gemini API call bypassed. Error details:", errStr.slice(0, 150));
      }
      // Smart offline fallback to ensure chat always responds smoothly
      const txt = (req.body.message || "").toLowerCase();
      
      const isSensitiveQuery = 
        txt.includes("business model") || 
        txt.includes("revenue") || 
        txt.includes("income") || 
        txt.includes("accounting") ||
        txt.includes("profit") ||
        txt.includes("expense") || 
        txt.includes("operational cost") ||
        txt.includes("how much do you earn") ||
        txt.includes("code") || 
        txt.includes("architecture") || 
        txt.includes("proprietary") || 
        txt.includes("backend") || 
        txt.includes("database") || 
        txt.includes("technology") || 
        txt.includes("developer") || 
        txt.includes("identity") || 
        txt.includes("who built you") ||
        txt.includes("who programmed you") ||
        txt.includes("source code") ||
        txt.includes("platform cost") ||
        txt.includes("server cost") ||
        txt.includes("operational expense") ||
        txt.includes("company income");

      if (isSensitiveQuery) {
        return res.json({
          serviceType: "Unknown",
          issueDetails: "Sensitive corporate query intercepted",
          confidence: 100,
          nextQuestion: "क्षमा करें, मैं केवल Zomindia की घरेलू सेवाओं, बुकिंग और ऑफर्स से जुड़ी सहायता के लिए उपलब्ध हूँ। आंतरिक कंपनी नीतियों या डेटा की जानकारी साझा करने की अनुमति मुझे नहीं है।",
          isReadyToBook: false
        });
      }

      const isUnrelatedQuery = 
        txt.includes("politics") ||
        txt.includes("food") ||
        txt.includes("laptop") ||
        txt.includes("tourism") ||
        txt.includes("poha") ||
        txt.includes("jalebi") ||
        txt.includes("bjp") ||
        txt.includes("congress") ||
        txt.includes("modi") ||
        txt.includes("election") ||
        txt.includes("restaurant") ||
        txt.includes("recipe") ||
        txt.includes("weather") ||
        txt.includes("news") ||
        txt.includes("hotel") ||
        txt.includes("travel") ||
        txt.includes("movie") ||
        txt.includes("sport") ||
        txt.includes("cricket");

      if (isUnrelatedQuery) {
        return res.json({
          serviceType: "Unknown",
          issueDetails: "Unrelated out-of-scope query intercepted",
          confidence: 100,
          nextQuestion: "Bhaiya, Indore ke poha-jalebi toh laajawab hain hi! Lekin main aapke ghar ke AC, electrical ya plumbing ki dikkat dur karne mein zyada mahir hoon. Bataiye aaj ghar mein kya fix karna hai?",
          isReadyToBook: false
        });
      }

      const isUnlistedServiceInFallback = 
        txt.includes("car wash") || txt.includes("car washing") || txt.includes("bike wash") || txt.includes("vehicle detailing") || txt.includes("car cleaning") ||
        txt.includes("beauty") || txt.includes("salon") || txt.includes("parlor") || txt.includes("parlour") || txt.includes("haircut") || txt.includes("makeup") || txt.includes("spa") || txt.includes("massage") ||
        txt.includes("painting") || txt.includes("painter") || txt.includes("wall paint") || txt.includes("house paint") || txt.includes("house painting") ||
        txt.includes("construction") || txt.includes("civil work") || txt.includes("renovation") || txt.includes("interior design") ||
        txt.includes("pest control") || txt.includes("termite") ||
        txt.includes("tiffin") || txt.includes("cook") || txt.includes("maid") || txt.includes("house help") ||
        txt.includes("packers") || txt.includes("movers") || txt.includes("house shifting") || txt.includes("shifting") ||
        txt.includes("deep cleaning") || txt.includes("house cleaning") || txt.includes("sofa cleaning") || txt.includes("bathroom cleaning") || txt.includes("sanitization") ||
        txt.includes("laundry") || txt.includes("dry cleaning") ||
        txt.includes("gardening") || txt.includes("lawn") ||
        txt.includes("cctv") || txt.includes("security system") ||
        txt.includes("solar") || txt.includes("solar panel") ||
        txt.includes("chimney") ||
        txt.includes("plumbing") || txt.includes("plumber") || txt.includes("pipe leak") || txt.includes("tap repair");

      if (isUnlistedServiceInFallback) {
        return res.json({
          serviceType: "Unknown",
          issueDetails: "Unlisted or out-of-scope home service requested",
          confidence: 100,
          nextQuestion: "क्षमा करें, अभी हम इस सर्विस के लिए उपलब्ध नहीं हैं, लेकिन जल्द ही इंदौर में यह सर्विस शुरू करेंगे और आपको तुरंत इन्फॉर्म कर देंगे! 🚀",
          isReadyToBook: false,
          quickActions: [
            { label: "View AC Services", action: "View AC Services" },
            { label: "View Appliances Repair", action: "View Appliances Repair" },
            { label: "Talk to Human Agent", action: "Talk to Human Agent" }
          ]
        });
      }

      let detectedServiceType: "AC Repair" | "Washing Machine Repair" | "Electrician" | "Carpenter" | "RO Service" | "Unknown" = "Unknown";
      let detectedIssueDetails = "";
      let detectedIsReadyToBook = false;
      let quickActionsList: { label: string; action: string }[] | undefined = undefined;

      if (txt.includes("स्प्लिट ac") || txt.includes("split ac")) {
        detectedServiceType = "AC Repair";
        detectedIssueDetails = "स्प्लिट AC सर्विस (₹770)";
        if (txt.includes("book") || txt.includes("बुक") || txt.includes("⚡") || txt.includes("सर्विस")) {
          detectedIsReadyToBook = !isGuest;
        } else {
          quickActionsList = [
            { label: "⚡ स्प्लिट AC सर्विस बुक करें (₹770)", action: "स्प्लिट AC सर्विस बुक करें" },
            { label: "⚡ विंडो AC सर्विस बुक करें (₹599)", action: "विंडो AC सर्विस बुक करें" }
          ];
        }
      } else if (txt.includes("विंडो ac") || txt.includes("window ac")) {
        detectedServiceType = "AC Repair";
        detectedIssueDetails = "विंडो AC सर्विस (₹599)";
        if (txt.includes("book") || txt.includes("बुक") || txt.includes("⚡") || txt.includes("सर्विस")) {
          detectedIsReadyToBook = !isGuest;
        } else {
          quickActionsList = [
            { label: "⚡ विंडो AC सर्विस बुक करें (₹599)", action: "विंडो AC सर्विस बुक करें" }
          ];
        }
      } else if (txt.includes("ro फ़िल्टर") || txt.includes("ro filter") || txt.includes("कम्पलीट ro") || txt.includes("complete ro") || txt.includes("आरओ")) {
        detectedServiceType = "RO Service";
        detectedIssueDetails = txt.includes("कम्पलीट") ? "कम्पलीट RO सर्विसिंग (₹649)" : "RO फ़िल्टर सर्विस (₹399)";
        if (txt.includes("book") || txt.includes("बुक") || txt.includes("⚡") || txt.includes("सर्विस")) {
          detectedIsReadyToBook = !isGuest;
        } else {
          quickActionsList = [
            { label: "⚡ RO फ़िल्टर सर्विस बुक करें (₹399)", action: "RO फ़िल्टर सर्विस बुक करें" },
            { label: "⚡ कम्पलीट RO सर्विसिंग (₹649)", action: "कम्पलीट RO SERVICE BOOK" }
          ];
        }
      } else if (txt.includes("washing machine") || txt.includes("वाशिंग मशीन")) {
        detectedServiceType = "Washing Machine Repair";
        detectedIssueDetails = "वाशिंग मशीन सर्विस (₹499)";
        if (txt.includes("book") || txt.includes("बुक") || txt.includes("⚡") || txt.includes("सर्विस")) {
          detectedIsReadyToBook = !isGuest;
        } else {
          quickActionsList = [
            { label: "⚡ वाशिंग मशीन सर्विस बुक करें (₹499)", action: "वाशिंग मशीन सर्विस बुक करें" }
          ];
        }
      } else if (txt.includes("ac") || txt.includes("cooling") || txt.includes("thanda") || txt.includes("thandha") || txt.includes("leakage") || txt.includes("noise") || txt.includes("compressor") || txt.includes("gas")) {
        detectedServiceType = "AC Repair";
        detectedIssueDetails = "AC repair or cooling issue requested by the customer";
        quickActionsList = [
          { label: "⚡ स्प्लिट AC सर्विस बुक करें (₹770)", action: "स्प्लिट AC सर्विस बुक करें" },
          { label: "⚡ विंडो AC सर्विस बुक करें (₹599)", action: "विंडो AC सर्विस बुक करें" }
        ];
      } else if (txt.includes("spin") || txt.includes("drainage")) {
        detectedServiceType = "Washing Machine Repair";
        detectedIssueDetails = "Washing machine repair requested by the customer";
        quickActionsList = [
          { label: "⚡ वाशिंग मशीन सर्विस बुक करें (₹499)", action: "वाशिंग मशीन सर्विस बुक करें" }
        ];
      } else if (txt.includes("electr") || txt.includes("short circuit") || txt.includes("switch") || txt.includes("wire") || txt.includes("light") || txt.includes("socket")) {
        detectedServiceType = "Electrician";
        detectedIssueDetails = "Electrical or wiring service requested by the customer";
      } else if (txt.includes("carp") || txt.includes("wood") || txt.includes("furniture") || txt.includes("door") || txt.includes("table") || txt.includes("sofa")) {
        detectedServiceType = "Carpenter";
        detectedIssueDetails = "Carpentry or furniture repair requested by the customer";
      } else if (txt.includes("ro") || txt.includes("purifier") || txt.includes("filter") || txt.includes("water") || txt.includes("flow") || txt.includes("taste")) {
        detectedServiceType = "RO Service";
        detectedIssueDetails = "RO water purifier service requested by the customer";
        quickActionsList = [
          { label: "⚡ RO फ़िल्टर सर्विस बुक करें (₹399)", action: "RO फ़िल्टर सर्विस बुक करें" },
          { label: "⚡ कम्पलीट RO सर्विसिंग (₹649)", action: "कम्पलीट RO SERVICE BOOK" }
        ];
      }

      if (txt.includes("book") || txt.includes("बुक") || txt.includes("confirm") || txt.includes("yes") || txt.includes("proceed")) {
        detectedIsReadyToBook = !isGuest;
      }

      let replyMessage = "I am ZOMINI, here to help you coordinate your Zomindia services. What specific home service issue can I help you fix today?";
      
      if (detectedIsReadyToBook) {
        replyMessage = `बहुत बढ़िया! ${detectedIssueDetails || "चुनी गई सर्विस"} के लिए अपना पसंदीदा टाइम और स्लॉट चुनें:`;
        quickActionsList = undefined;
      } else if (isGuest && (txt.includes("book") || txt.includes("बुक"))) {
        replyMessage = "मैं आपकी सर्विस बुक करने के लिए तैयार हूँ। कृपया पहले ऊपर दिए गए लॉगिन बटन पर क्लिक करें!";
      } else if (txt.includes("thanda") || txt.includes("thandha") || txt.includes("cool") || txt.includes("cooling")) {
        replyMessage = "AC कूलिंग न करने के कई कारण हो सकते हैं जैसे गैस लीक, डस्ट या फ़िल्टर ब्लॉक। आप Zomindia से तुरंत verified technician बुक कर सकते हैं।";
      } else if (txt.includes("washing machine")) {
        replyMessage = "वाशिंग मशीन में स्पिन न होना, पानी न निकलना या आवाज़ आना आम समस्याएँ हैं। Zomindia के एक्सपर्ट तकनीशियन आपके घर आकर तुरंत डायग्नोस और रिपेयर करेंगे।";
      } else if (txt.includes("purifier") || txt.includes("water purifier") || (txt.includes("ro") && txt.includes("issue"))) {
        replyMessage = "वाटर प्यूरीफायर का पानी खराब आना या फ्लो कम होना फ़िल्टर ब्लॉक या TDS इश्यू हो सकता है। Zomindia से फ़िल्टर चेकिंग और सर्विसिंग तुरंत बुक करें।";
      } else if (txt.includes("hello") || txt.includes("hi") || txt.includes("hey")) {
        if (chatHistoryLength > 1) {
          replyMessage = "I am right here! How can I assist you further with your home service request?";
        } else {
          const hasBookings = context && context.bookings && context.bookings.length > 0;
          const b = hasBookings ? context.bookings[0] : null;
          if (b) {
            replyMessage = `Namaste ${userName}! I am ZOMINI, your Zomindia AI assistant. I see you have an active ${b.serviceId ? b.serviceId.replace(/_/g, ' ') : 'service'} booking (#${b.id}) currently in status: '${b.status}'. How can I assist you with this or other home services today?`;
          } else {
            replyMessage = `Namaste ${userName}! I am ZOMINI, your Zomindia AI assistant. How can I assist you with your home service bookings or other queries today?`;
          }
        }
      } else if (txt.includes("status")) {
        const hasBookings = context && context.bookings && context.bookings.length > 0;
        const b = hasBookings ? context.bookings[0] : null;
        if (b) {
          replyMessage = `Namaste ${userName}, for your ${b.serviceId ? b.serviceId.replace(/_/g, ' ') : 'service'} booking (#${b.id}), the current status is '${b.status}'. Our background-verified pro is assigned.`;
        } else {
          replyMessage = `Namaste ${userName}, you do not have any active service bookings underway right now. Feel free to browse our home services catalog!`;
        }
      } else if (txt.includes("refund")) {
        replyMessage = "For details about refunds or cancellations, please contact our helpline. All cancellations made up to 2 hours before the scheduled time slot qualify for a 100% immediate wallet credit refund!";
      } else if (txt.includes("city") || txt.includes("availability") || txt.includes("indore")) {
        replyMessage = "ZomIndia is currently live in Indore! More cities like Bhopal, Pune, and Mumbai will be launched soon. Stay tuned!";
      } else if (txt.includes("price") || txt.includes("cost") || txt.includes("charge") || txt.includes("problem") || txt.includes("issue") || txt.includes("repair") || txt.includes("diagnose")) {
        replyMessage = "This could be due to a few reasons (like a blocked filter or electrical issue). I recommend booking our verified expert. Once your details are locked, an Admin will dispatch the best Elite Partner to your address to inspect it live.";
      } else if (txt.includes("book") || txt.includes("schedule")) {
        replyMessage = "To schedule a service: select an active service categorised on the customer home page (like AC, Electrician, Carpenter, or RO Service), choose your package, hit book, and confirm a preferred slot.";
      } else if (txt.includes("partner") || txt.includes("earn") || txt.includes("job")) {
        replyMessage = "As a verified Pro partner, you can browse open jobs in the 'Available Jobs Pool', accept assignments, trace client locations, and earn reward credits on completing jobs successfully. Is there a specific job you need help with?";
      } else if (txt.includes("call") || txt.includes("phone") || txt.includes("contact")) {
        replyMessage = "You can make real-time in-app audio calls to your assigned customer or pro directly using the phone card buttons inside the specific active booking timeline detail space!";
      }
      
      res.json({
        serviceType: detectedServiceType,
        issueDetails: detectedIssueDetails || "Query from customer",
        confidence: 100,
        nextQuestion: replyMessage,
        isReadyToBook: detectedIsReadyToBook,
        quickActions: quickActionsList
      });
    }
  });

  app.post("/api/add-funds", async (req, res) => {
    try {
      const { paymentId, amount, userId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      if (!amount || !userId) return res.status(400).json({ error: "Missing parameters" });

      const finalPaymentId = razorpay_payment_id || paymentId;
      if (!razorpay_order_id || !finalPaymentId || !razorpay_signature) {
        return res.status(400).json({ error: "Missing Razorpay verification data" });
      }

      // Verify signature cryptographically
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        return res.status(500).json({ error: "Razorpay secret key not configured on server" });
      }

      const text = razorpay_order_id + "|" + finalPaymentId;
      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(text)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Invalid Razorpay payment signature verification failed" });
      }

      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

      const currentBalance = userDoc.data()?.walletBalance || 0;
      
      const batch = db.batch();
      
      // Update balance
      batch.update(userRef, {
         walletBalance: currentBalance + amount,
         updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Record transaction
      const txRef = db.collection("walletTransactions").doc();
      batch.set(txRef, {
         userId,
         amount,
         type: 'credit',
         reason: 'Added funds via Razorpay',
         referenceId: finalPaymentId,
         status: 'completed',
         createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      res.json({ success: true, newBalance: currentBalance + amount });
    } catch (err: any) {
      console.error("Add funds error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/apply-referral", async (req, res) => {
    try {
      const { userId, referralCode } = req.body;
      if (!userId || !referralCode) return res.status(400).json({ error: "Missing parameters" });

      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

      if (userDoc.data()?.referredBy) {
         return res.status(400).json({ error: "You have already used a referral code" });
      }

      // Find referrer
      const referrers = await db.collection("users").where("referralCode", "==", referralCode).limit(1).get();
      if (referrers.empty) {
         return res.status(404).json({ error: "Invalid referral code" });
      }
      
      const referrerDoc = referrers.docs[0];
      if (referrerDoc.id === userId) {
         return res.status(400).json({ error: "You cannot use your own code" });
      }

      const batch = db.batch();
      
      // Update new user: give them rs100 immediately as a "discount" for their first booking
      batch.update(userRef, {
         referredBy: referrerDoc.id,
         referralCreditPending: true, // Mark so referrer gets credit when this user completes first booking
         walletBalance: (userDoc.data()?.walletBalance || 0) + 100,
         updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      batch.set(db.collection("walletTransactions").doc(), {
         userId, amount: 100, type: 'credit', reason: 'Welcome Bonus (Referred)', status: 'completed', createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Referrer gets their reward ONLY after the new user completes their first booking.
      // E.g., handled via backend or frontend when booking goes to 'completed'

      await batch.commit();

      res.json({ success: true, message: "Referral applied! ₹100 added for your first booking." });
    } catch (err: any) {
      console.error("Referral error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/process-referral-reward", async (req, res) => {
    try {
      const { customerId } = req.body;
      if (!customerId) return res.status(400).json({ error: "Missing parameters" });

      const userRef = db.collection("users").doc(customerId);
      const userDoc = await userRef.get();
      
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });
      const userData = userDoc.data()!;

      if (!userData.referralCreditPending || !userData.referredBy) {
         // No reward pending, just return
         return res.json({ success: true, message: "No pending reward" });
      }

      // Verify the user actually has at least one completed booking
      const completedBookings = await db.collection("bookings")
        .where("customerId", "==", customerId)
        .where("status", "in", ["completed", "finalized"])
        .limit(1)
        .get();

      if (completedBookings.empty) {
        return res.status(400).json({ error: "No completed bookings found" });
      }

      const referrerId = userData.referredBy;
      const referrerRef = db.collection("users").doc(referrerId);
      const referrerDoc = await referrerRef.get();

      if (!referrerDoc.exists) {
        return res.status(404).json({ error: "Referrer not found" });
      }

      // Issue ₹100 credit to referrer
      const batch = db.batch();

      batch.update(userRef, {
        referralCreditPending: false, // Mark as processed
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      batch.update(referrerRef, {
        walletBalance: (referrerDoc.data()?.walletBalance || 0) + 100,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      batch.set(db.collection("walletTransactions").doc(), {
        userId: referrerId, 
        amount: 100, 
        type: 'credit', 
        reason: 'Referral Bonus (Friend completed first booking)', 
        status: 'completed', 
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();
      res.json({ success: true, message: "Referral reward processed" });
    } catch (err: any) {
      console.error("Referral process error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/subscribe-prime", async (req, res) => {
    try {
      const { userId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      if (!userId) return res.status(400).json({ error: "Missing parameters" });

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({ error: "Missing Razorpay verification data" });
      }

      // Verify signature cryptographically
      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        return res.status(500).json({ error: "Razorpay secret key not configured on server" });
      }

      const text = razorpay_order_id + "|" + razorpay_payment_id;
      const generatedSignature = crypto
        .createHmac("sha256", keySecret)
        .update(text)
        .digest("hex");

      if (generatedSignature !== razorpay_signature) {
        return res.status(400).json({ error: "Invalid Razorpay payment signature verification failed" });
      }

      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

      if (userDoc.data()?.isPremium) {
         return res.status(400).json({ error: "Already subscribed" });
      }

      const expiry = new Date();
      expiry.setFullYear(expiry.getFullYear() + 1);

      const batch = db.batch();
      
      batch.update(userRef, {
         isPremium: true,
         subscriptionExpiry: admin.firestore.Timestamp.fromDate(expiry),
         updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      batch.set(db.collection("walletTransactions").doc(), {
         userId, amount: 999, type: 'debit', reason: 'ZomIndia PRIME Subscription', status: 'completed', createdAt: admin.firestore.FieldValue.serverTimestamp()
      });

      await batch.commit();

      res.json({ success: true, message: "Subscribed to PRIME!" });
    } catch (err: any) {
      console.error("Subscription error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/create-sub-admin", async (req, res) => {
    try {
      const { requesterUid, email, password, displayName, adminSubRole } = req.body;
      if (!requesterUid || !email || !password || !displayName || !adminSubRole) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // 1. Verify requester is head admin
      const requesterDoc = await db.collection("users").doc(requesterUid).get();
      const requesterData = requesterDoc.exists ? requesterDoc.data() : null;
      
      // Allow if role is admin and subrole is head. 
      // Note: In some systems, the very first admin might not have a profile yet if they just signed up,
      // but here we assume profiles exist.
      if (!requesterData || requesterData.role !== 'admin' || requesterData.adminSubRole !== 'head') {
        return res.status(403).json({ error: "Unauthorized. Only head admins can create sub-admins." });
      }

      // 2. Create user in Firebase Auth
      const userRecord = await admin.auth().createUser({
        email,
        password,
        displayName,
      });

      // 3. Create user profile in Firestore
      await db.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        email,
        displayName,
        role: 'admin',
        adminSubRole,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      });

      res.json({ success: true, uid: userRecord.uid });
    } catch (err: any) {
      console.error("Create sub-admin error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/verify-job-otp", async (req, res) => {
    try {
      const { bookingId, partnerId, otp } = req.body;
      if (!bookingId || !partnerId || !otp) return res.status(400).json({ error: "Missing parameters" });

      const bookingRef = db.collection("bookings").doc(bookingId);

      const result = await db.runTransaction(async (transaction) => {
        const bookingDoc = await transaction.get(bookingRef);
        if (!bookingDoc.exists) {
          return { errorStatus: 404, error: "Booking not found" };
        }

        const booking = bookingDoc.data()!;

        // Brute-force protection: check attempts & block duration
        let attempts = booking.otpAttempts || 0;
        let blockedUntil = booking.otpBlockedUntil ? booking.otpBlockedUntil.toDate() : null;

        if (blockedUntil && blockedUntil > new Date()) {
          return { errorStatus: 429, error: "Too many attempts. Try again in 15 minutes." };
        }

        // If block has expired, reset the attempts
        if (blockedUntil && blockedUntil <= new Date()) {
          attempts = 0;
        }

        const normalize = (val: any) => (val || "").toString().trim();
        const inputOtp = normalize(otp);

        // Single source of truth verification
        const expectedOtp = booking.serviceOtp ? normalize(booking.serviceOtp) : "";

        if (!expectedOtp || inputOtp !== expectedOtp) {
          attempts += 1;
          const updates: any = { otpAttempts: attempts };
          if (attempts >= 5) {
            const blockDate = new Date(Date.now() + 15 * 60 * 1000); // 15 mins block
            updates.otpBlockedUntil = admin.firestore.Timestamp.fromDate(blockDate);
            transaction.update(bookingRef, updates);
            return { errorStatus: 429, error: "Too many attempts. Try again in 15 minutes." };
          } else {
            transaction.update(bookingRef, updates);
            return { errorStatus: 400, error: `Invalid OTP. ${5 - attempts} attempts remaining.` };
          }
        }

        // Success: reset attempts & blocked values
        transaction.update(bookingRef, {
          status: 'in_progress',
          partnerId: partnerId,
          otpVerified: true,
          otpAttempts: 0,
          otpBlockedUntil: null,
          arrivedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return { success: true };
      });

      if (result.errorStatus) {
        return res.status(result.errorStatus).json({ error: result.error });
      }

      res.json({ success: true, message: "OTP verified" });
    } catch (err: any) {
      console.error("OTP verification error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // --- Wallet Payment ---
  app.post('/api/pay-via-wallet', async (req, res) => {
    try {
      const { bookingId, userId } = req.body;
      if (!bookingId || !userId) {
        return res.status(400).json({ error: 'Missing bookingId or userId' });
      }

      await db.runTransaction(async (t) => {
        const userRef = db.collection('users').doc(userId);
        const bookingRef = db.collection('bookings').doc(bookingId);

        const [userDoc, bookingDoc] = await Promise.all([
          t.get(userRef),
          t.get(bookingRef)
        ]);

        if (!userDoc.exists || !bookingDoc.exists) {
          throw new Error('User or Booking not found');
        }

        const bookingData = bookingDoc.data()!;
        if (bookingData.settledAt) {
          throw new Error('This job has already been settled.');
        }

        const walletBalance = userDoc.data()?.walletBalance || 0;
        const totalPrice = bookingDoc.data()?.totalPrice || 0;

        if (walletBalance < totalPrice) {
          throw new Error('Insufficient wallet balance');
        }

        t.update(userRef, {
          walletBalance: walletBalance - totalPrice,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        t.update(bookingRef, {
          paymentStatus: 'paid',
          paymentMethod: 'wallet',
          status: 'completed',
          settledAt: firebase.firestore.FieldValue.serverTimestamp(),
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        
        // Atomically update partner's total earnings and reward credits if assigned
        const partnerId = bookingDoc.data()?.partnerId;
        if (partnerId) {
          const partnerRef = db.collection('partners').doc(partnerId);
          const partnerDoc = await t.get(partnerRef);
          if (partnerDoc.exists) {
            const currentEarnings = partnerDoc.data()?.totalEarnings || 0;
            const currentCredits = partnerDoc.data()?.rewardCredits || 0;
            const rewardPts = 10;
            t.update(partnerRef, {
              totalEarnings: currentEarnings + totalPrice,
              rewardCredits: currentCredits + rewardPts,
              updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Add earnings history record
            const earnRef = db.collection('partners').doc(partnerId).collection('earningsHistory').doc();
            t.set(earnRef, {
              type: 'booking_earning',
              amount: totalPrice,
              credits: rewardPts,
              bookingId: bookingId,
              reason: `Completed service (Wallet payment)`,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
          }
        }
        
        // Also write to transaction history
        const txRef = db.collection('walletTransactions').doc();
        t.set(txRef, {
           userId: userId,
           amount: totalPrice,
           type: 'debit',
           reason: `Paid for booking ${bookingId}`,
           status: 'completed',
           createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
      });

      // Trigger final bill email asynchronously
      try {
        await axios.post(`http://localhost:${PORT}/api/send-final-bill`, { bookingId });
      } catch (e) {
        console.error("Failed to trigger bill email after wallet payment:", e);
      }

      res.json({ success: true });
    } catch (err: any) {
      console.error('Wallet payment error:', err);
      if (err.message === 'This job has already been settled.') {
        return res.status(400).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  });

  // Background worker for upcoming booking reminders (30-minute and 2-hour)
  function startUpcomingBookingReminderWorker() {
    console.log("[Worker] Upcoming booking reminder background worker initialized.");
    
    // Run every 60 seconds
    setInterval(async () => {
      try {
        let activeDb = adminDb || db;
        let isUsingAdmin = true;

        if (!activeDb) {
          return;
        }

        const now = new Date();
        const bookingsRef = activeDb.collection("bookings");
        
        // Dynamically resolve Timestamp and FieldValue depending on whether we are using adminDb or db
        const TimestampClass = isUsingAdmin ? admin.firestore.Timestamp : firebase.firestore.Timestamp;
        const FieldValueClass = isUsingAdmin ? admin.firestore.FieldValue : firebase.firestore.FieldValue;

        // --- 1. 30-Min reminder check ---
        const thirtyFiveMinutesLater = new Date(now.getTime() + 35 * 60 * 1000);
        const snapshot30Min = await bookingsRef
          .where("scheduledAt", ">=", TimestampClass.fromDate(now))
          .where("scheduledAt", "<=", TimestampClass.fromDate(thirtyFiveMinutesLater))
          .get();
          
        if (!snapshot30Min.empty) {
          for (const doc of snapshot30Min.docs) {
            const bookingData = doc.data();
            const bookingId = doc.id;
            
            // Skip if already notified or if status is not eligible for reminders
            if (bookingData.reminder30MinSent) {
              continue;
            }
            
            const ineligibleStatuses = [
              'cancelled', 'rejected', 'in_progress', 'completed', 'finalized', 'arrived', 'on_the_way'
            ];
            if (ineligibleStatuses.includes(bookingData.status)) {
              continue;
            }
            
            const customerId = bookingData.customerId;
            if (!customerId) {
              continue;
            }
            
            const bookingIdShort = bookingId.slice(0, 8).toUpperCase();
            console.log(`[Worker] Triggering 30-min reminder for booking ${bookingIdShort} (Customer: ${customerId})`);
            
            // Fetch the service name to personalize the notification message beautifully
            let serviceName = "your scheduled service";
            if (bookingData.serviceId) {
              try {
                const serviceDoc = await activeDb.collection("services").doc(bookingData.serviceId).get();
                if (serviceDoc.exists) {
                  serviceName = serviceDoc.data()?.name || "your scheduled service";
                }
              } catch (svcErr) {
                console.error(`[Worker] Error fetching service name for booking ${bookingId}:`, svcErr);
              }
            }
            
            // Create custom user notification document in notifications collection
            const notificationPayload = {
              userId: customerId,
              title: "Upcoming Service Reminder ⏰",
              message: `Your booking #${bookingIdShort} for ${serviceName} is scheduled in 30 minutes! Our partner will be arriving soon.`,
              type: "booking_confirmed",
              bookingId: bookingId,
              read: false,
              createdAt: FieldValueClass.serverTimestamp()
            };
            
            await activeDb.collection("notifications").add(notificationPayload);
            
            // Add a flag to prevent duplicate reminder notifications
            await doc.ref.update({
              reminder30MinSent: true,
              updatedAt: FieldValueClass.serverTimestamp()
            });
            
            console.log(`[Worker] Sent 30-min reminder successfully for booking #${bookingIdShort}`);
          }
        }

        // --- 2. 2-Hour reminder check ---
        const twoHoursFiveMinutesLater = new Date(now.getTime() + 125 * 60 * 1000);
        const snapshot2Hr = await bookingsRef
          .where("scheduledAt", ">=", TimestampClass.fromDate(now))
          .where("scheduledAt", "<=", TimestampClass.fromDate(twoHoursFiveMinutesLater))
          .get();

        if (!snapshot2Hr.empty) {
          for (const doc of snapshot2Hr.docs) {
            const bookingData = doc.data();
            const bookingId = doc.id;
            
            // Skip if already notified or if status is not eligible for reminders
            if (bookingData.reminder2HrSent) {
              continue;
            }
            
            const ineligibleStatuses = [
              'cancelled', 'rejected', 'in_progress', 'completed', 'finalized', 'arrived', 'on_the_way'
            ];
            if (ineligibleStatuses.includes(bookingData.status)) {
              continue;
            }
            
            const customerId = bookingData.customerId;
            if (!customerId) {
              continue;
            }
            
            const bookingIdShort = bookingId.slice(0, 8).toUpperCase();
            console.log(`[Worker] Triggering 2-hour reminder for booking ${bookingIdShort} (Customer: ${customerId})`);
            
            // Fetch the service name to personalize the notification message beautifully
            let serviceName = "your scheduled service";
            if (bookingData.serviceId) {
              try {
                const serviceDoc = await activeDb.collection("services").doc(bookingData.serviceId).get();
                if (serviceDoc.exists) {
                  serviceName = serviceDoc.data()?.name || "your scheduled service";
                }
              } catch (svcErr) {
                console.error(`[Worker] Error fetching service name for booking ${bookingId}:`, svcErr);
              }
            }
            
            // Create custom user notification document in notifications collection
            const notificationPayload = {
              userId: customerId,
              title: "Upcoming Service Reminder (2 Hours) ⏰",
              message: `Your booking #${bookingIdShort} for ${serviceName} is scheduled in 2 hours! Please ensure you are ready.`,
              type: "booking_confirmed",
              bookingId: bookingId,
              read: false,
              createdAt: FieldValueClass.serverTimestamp()
            };
            
            await activeDb.collection("notifications").add(notificationPayload);
            
            // Add a flag to prevent duplicate reminder notifications
            await doc.ref.update({
              reminder2HrSent: true,
              updatedAt: FieldValueClass.serverTimestamp()
            });
            
            console.log(`[Worker] Sent 2-hour reminder successfully for booking #${bookingIdShort}`);
          }
        }
      } catch (err: any) {
        const isPermissionError = err.message && (
          err.message.includes("PERMISSION_DENIED") ||
          err.message.includes("Missing or insufficient permissions") ||
          err.message.includes("permission_denied") ||
          err.code === 7
        );

        if (isPermissionError) {
          console.info("[ReminderWorker] Running in developer sandbox environment. Database queries are skipped because the container's temporary service account lacks IAM permissions on the partitioned database. (This is normal in developer preview and will connect successfully when deployed to your production environment.)");
        } else {
          const envKeys = Object.keys(process.env).filter(k => k.includes("GOOGLE") || k.includes("FIREBASE") || k.includes("SERVICE") || k.includes("CREDENTIALS") || k.includes("APPLET"));
          console.error("[Worker] Error in upcoming booking reminder process:", err.message, "| Env keys:", JSON.stringify(envKeys));
        }
      }
    }, 60000);
  }

  // Start backer workers
  startUpcomingBookingReminderWorker();

  // Explicit sitemap.xml and robots.txt routes to ensure they are served raw and allow Googlebot to read them freely.
  app.get("/sitemap.xml", (req, res) => {
    res.setHeader("Content-Type", "application/xml");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(process.cwd(), "public", "sitemap.xml"));
  });

  app.get("/robots.txt", (req, res) => {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.sendFile(path.join(process.cwd(), "public", "robots.txt"));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: "spa",
      clearScreen: false
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use((req, res, next) => {
      const url = req.url;
      if (url.includes('sw.js') || url.includes('registerSW.js') || url.includes('manifest.webmanifest') || url.includes('manifest.json')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
      next();
    });
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is LIVE on port ${PORT}`);
  });
}

startServer().catch(console.error);
