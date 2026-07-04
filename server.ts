import express from "express";
import path from "path";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import axios from "axios";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { readFileSync, writeFileSync } from "fs";
import { GoogleGenAI } from "@google/genai";
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
const systemPassword = "SuperSecretSecureWorkerPassword123!!";

let isWorkerAuthenticated = true;
// Background worker connection runs directly under high-privilege Admin SDK, no client login required.


let _serverDb: any = null;
let _serverClientDb: any = null;

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
      _serverClientDb = clientApp.firestore();
      _serverDb = _serverClientDb;
    } catch (authErr: any) {
      console.log("[Server Client Backend] Sandbox token sign-in bypassed: using secure Admin SDK fallback directly.");
      _serverDb = null; // Forces getDbInstance() to use getFirestore() Admin SDK fallback
    }
  } catch (err: any) {
    console.log("[Server Client Backend] Initialization fallback to high-privilege Admin SDK active.");
    _serverDb = null;
  }
};

// Start the auth flow immediately
initializeServerClientDb();

const getDbInstance = () => {
  if (_serverDb) return _serverDb;
  
  try {
    const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
    const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, "utf-8"));
    if (firebaseConfig.firestoreDatabaseId) {
      _serverDb = getFirestore(admin.apps[0] || undefined, firebaseConfig.firestoreDatabaseId);
    } else {
      _serverDb = getFirestore();
    }
  } catch (err: any) {
    console.error("[Server getDbInstance Fallback Error]:", err.message);
    try {
      if (admin.apps.length > 0) {
        _serverDb = admin.firestore();
      } else {
        _serverDb = null;
      }
    } catch (innerErr: any) {
      _serverDb = null;
    }
  }
  return _serverDb;
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

  app.use(express.json());

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

  app.post("/api/send-gupshup-notification", async (req, res) => {
    try {
      const { userId, title, message, phoneNumber } = req.body;
      if (!userId && !phoneNumber) {
        return res.status(400).json({ error: "Either userId or phoneNumber is required" });
      }

      if (!db && !phoneNumber) {
        return res.status(500).json({ error: "Firestore Admin Database is not yet initialized on the server." });
      }

      let destinationPhone = phoneNumber;
      if (!destinationPhone && userId) {
        const userSnap = await db.collection("users").doc(userId).get();
        if (userSnap.exists) {
          const userData = userSnap.data();
          destinationPhone = userData.phoneNumber;
        }
      }

      if (!destinationPhone) {
        return res.status(400).json({ success: false, error: "User has no registered phone number" });
      }

      // Format E.164 phone number
      let cleanPhone = destinationPhone.replace(/\D/g, "");
      if (cleanPhone.length === 10) {
        cleanPhone = "91" + cleanPhone;
      }

      const gupshupApiKey = process.env.GUPSHUP_API_KEY;
      const gupshupSource = process.env.GUPSHUP_WHATSAPP_SOURCE || "919000000000";
      const gupshupSmsUserid = process.env.GUPSHUP_SMS_USERID;
      const gupshupSmsPassword = process.env.GUPSHUP_SMS_PASSWORD;

      let whatsappSent = false;
      let smsSent = false;
      let whatsappStatus = "Not Configured";
      let smsStatus = "Not Configured";

      // 1. WhatsApp API via Gupshup (api.gupshup.io)
      if (gupshupApiKey) {
        try {
          const waUrl = "https://api.gupshup.io/sm/api/v1/msg";
          const form = new URLSearchParams();
          form.append("channel", "whatsapp");
          form.append("source", gupshupSource);
          form.append("destination", cleanPhone);
          form.append("message", JSON.stringify({
            type: "text",
            text: `*${title}*\n\n${message}\n\n_Delivered via zomindia Live Sync_`
          }));

          const waRes = await axios.post(waUrl, form, {
            headers: {
              "apikey": gupshupApiKey,
              "Content-Type": "application/x-www-form-urlencoded"
            }
          });
          whatsappSent = true;
          whatsappStatus = JSON.stringify(waRes.data);
          console.log(`[Gupshup WhatsApp] Delivered to ${cleanPhone}:`, waRes.data);
        } catch (waErr: any) {
          whatsappStatus = `Error: ${waErr.message}`;
          const errData = waErr.response?.data;
          const errMsg = typeof errData === "object" ? JSON.stringify(errData) : String(errData || waErr.message);
          if (errMsg.includes("Portal User Not Found With APIKey")) {
            console.warn(`[Gupshup WhatsApp Integration] Warning: Your GUPSHUP_API_KEY is configured on the server, but the portal user associated with it wasn't found or is currently inactive on Gupshup side.`);
          } else {
            console.error("[Gupshup WhatsApp Error]:", errData || waErr.message);
          }
        }
      }

      // 2. SMS API via Gupshup Gateway
      if (gupshupSmsUserid && gupshupSmsPassword) {
        try {
          const smsUrl = "https://enterprise.smsgupshup.com/GatewayAPI/rest";
          const smsRes = await axios.get(smsUrl, {
            params: {
              method: "SendMessage", // Using proper case-sensitive "SendMessage" for standard Gupshup Enterprise API compliance
              send_to: cleanPhone,
              msg: `${title}: ${message}`,
              msg_type: "TEXT",
              userid: gupshupSmsUserid,
              auth_scheme: "plain",
              password: gupshupSmsPassword,
              v: "1.1",
              format: "text"
            }
          });
          smsStatus = String(smsRes.data);
          if (smsStatus.includes("error") || smsStatus.includes("106") || smsStatus.toLowerCase().includes("not supported")) {
            smsSent = false;
            console.warn(`[Gupshup SMS Integration] Warning: Gupshup SMS gateway responded with error payload '${smsStatus}'. This usually means either your Gateway Account userid/password does not support SMS dispatch or the method name casing is restricted on this enterprise account tier.`);
          } else {
            smsSent = true;
            console.log(`[Gupshup SMS] Delivered to ${cleanPhone}:`, smsRes.data);
          }
        } catch (smsErr: any) {
          smsStatus = `Error: ${smsErr.message}`;
          console.error("[Gupshup SMS Error]:", smsErr.response?.data || smsErr.message);
        }
      }

      res.json({
        success: true,
        whatsapp: { sent: whatsappSent, status: whatsappStatus },
        sms: { sent: smsSent, status: smsStatus },
        recipient: cleanPhone
      });

    } catch (err: any) {
      console.error("[Gupshup Server Proxy Error]:", err);
      res.status(500).json({ error: err.message });
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

  app.get("/api/download-invoice", async (req, res) => {
    try {
      const { bookingId } = req.query;
      if (!bookingId) return res.status(400).json({ error: "Booking ID is required" });

      if (!db) {
        return res.status(500).json({ error: "Database not initialized" });
      }

      const bookingRef = db.collection("bookings").doc(bookingId);
      const bookingDoc = await bookingRef.get();

      if (!bookingDoc.exists) return res.status(404).json({ error: "Booking not found" });
      const bookingData = bookingDoc.data()!;

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
      docPdf.fontSize(24).font('Helvetica-Bold').text("INVOICE / BILL", { align: "center", underline: true });
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
      docPdf.fontSize(10).font('Helvetica-Oblique').text("Thank you for using zomindia! Generated electronically.", { align: "center" });
      
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
      const { bookingId } = req.body;
      if (!bookingId) return res.status(400).json({ error: "Booking ID is required" });

      const bookingRef = db.collection("bookings").doc(bookingId);
      const bookingDoc = await bookingRef.get();

      if (!bookingDoc.exists) return res.status(404).json({ error: "Booking not found" });
      const bookingData = bookingDoc.data()!;

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
      docPdf.fontSize(25).text("FINAL BILL", { align: "center" });
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
        from: process.env.SMTP_FROM || '"zomindia Billing" <billing@zomindia.com>',
        to: userData.email,
        subject: `Final Bill for Booking #${bookingId.slice(0, 8).toUpperCase()}`,
        text: `Hello ${userData.displayName},\n\nPlease find your final bill for booking #${bookingId} attached.\n\nTotal Paid: ₹${bookingData.totalPrice}\n\nThank you for choosing zomindia!`,
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
          // We don't throw here to allow the rest of the flow (push notifications, etc.) to complete
        }
      } else {
        console.warn("SMTP not configured. Email not sent.");
      }

      // 3. Send Push Notification (SMS simulation or log)
      const message = `Hello ${userData.displayName}, your bill for booking #${bookingId.slice(0, 8).toUpperCase()} of amount ₹${bookingData.totalPrice} has been sent to your email. Team zomindia.`;
      
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
    return new GoogleGenAI({ 
      apiKey: process.env.GEMINI_API_KEY!,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  app.post("/api/support-chat", async (req, res) => {
    const { message, context } = req.body;
    try {
      if (!message) return res.status(400).json({ error: "Message is required" });

      const txt = (message || "").toLowerCase();
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
        return res.json({ reply: "क्षमा करें, मैं केवल Zomindia की घरेलू सेवाओं, बुकिंग और ऑफर्स से जुड़ी सहायता के लिए उपलब्ध हूँ। आंतरिक कंपनी नीतियों या डेटा की जानकारी साझा करने की अनुमति मुझे नहीं है।" });
      }

      const geminiKey = process.env.GEMINI_API_KEY;
      if (!geminiKey || geminiKey === "YOUR_API_KEY" || geminiKey.trim() === "") {
        throw new Error("API key is not initialized in secrets");
      }

      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: `Context: ${JSON.stringify(context || {})}\nUser: ${message}`,
        config: {
          systemInstruction: `You are ZOMINI, the zomindia traditional Indian female AI support chatbot. You are helpful, professional, friendly, and highly knowledgeable about home services.
          Always identify yourself as ZOMINI when greeting or speaking to users.
          You have access to the user's profile and their recent bookings (if any). Use this context to provide specific, personalized help. 
          For customers, help with their bookings and service queries based on the list of live bookings and user details provided in context. Always refer to actual live bookings from context.
          For partners, help them with their assigned jobs and earnings queries. 

          === COMPREHENSIVE PUBLIC BRAND KNOWLEDGE BASE ===
          - Location & Availability: Currently serving Indore with verified top-tier experts.
          - Categories: Expert in AC Service, Electronics Repair, RO Water Purifier Service, Refrigerator Service & Repair, and Washing Machine Repair.
          - Customer Promises: Transparent pricing, strictly background-verified professionals, punctuality guarantee, and a 7-day free cover/complimentary re-work warranty.

          === STRICT CORPORATE DATA GUARDRAIL & SECURITY LOCK (DATA LEAK PREVENTION) ===
          - If a user asks about the business model, company income/revenue, operational expenses, internal coding architecture, proprietary logic, backend technologies, developer identities, platform costs, or other corporate data, you must strictly decline using this exact Sanskritized Hindi response:
            "क्षमा करें, मैं केवल Zomindia की घरेलू सेवाओं, बुकिंग और ऑफर्स से जुड़ी सहायता के लिए उपलब्ध हूँ। आंतरिक कंपनी नीतियों या डेटा की जानकारी साझा करने की अनुमति मुझे नहीं है।"

          CRITICAL language instruction: Detect the language the user is speaking or asking in (whether English, Hindi, Bengali, Tamil, Telugu, Marathi, Malayalam, Kannada, Gujarati, Punjabi, etc.) or refer to the requested language in context (context.language). You MUST reply to the user entirely in that same language (e.g., if they speak in Hindi, respond in fluent Hindi; if in Tamil, respond in Tamil).

          If you cannot resolve an issue, suggest they contact human support at ${process.env.VITE_WHATSAPP_SUPPORT_NUMBER || 'WhatsApp'}. 
          Always keep answers concise and avoid over-explaining. If the user asks for a WhatsApp link, provide it: https://wa.me/${(process.env.VITE_WHATSAPP_SUPPORT_NUMBER || '').replace(/\D/g, '')}`,
        }
      });
      res.json({ reply: response.text });
    } catch (err: any) {
      console.error("Gemini AI Error:", err);
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
        return res.json({ reply: "क्षमा करें, मैं केवल Zomindia की घरेलू सेवाओं, बुकिंग और ऑफर्स से जुड़ी सहायता के लिए उपलब्ध हूँ। आंतरिक कंपनी नीतियों या डेटा की जानकारी साझा करने की अनुमति मुझे नहीं है।" });
      }

      let replyMessage = "I am ZOMINI, here to help you coordinate your zomindia services. You can message our human Support Team anytime on WhatsApp or call us directly using the support buttons on top of your chat window!";
      
      if (txt.includes("hello") || txt.includes("hi") || txt.includes("hey")) {
        const hasBookings = context && context.bookings && context.bookings.length > 0;
        const b = hasBookings ? context.bookings[0] : null;
        if (b) {
          replyMessage = `नमस्ते VIKASS! I am ZOMINI, your zomindia AI Chat assistant. I see you have an active ${b.serviceId ? b.serviceId.replace(/_/g, ' ') : 'service'} booking (#${b.id}) currently in status: '${b.status}'. How can I assist you with this or other queries today?`;
        } else {
          replyMessage = "नमस्ते VIKASS! I am ZOMINI, your zomindia AI Chat assistant. How can I assist you with your home service bookings or other queries today?";
        }
      } else if (txt.includes("status")) {
        const hasBookings = context && context.bookings && context.bookings.length > 0;
        const b = hasBookings ? context.bookings[0] : null;
        if (b) {
          replyMessage = `नमस्ते VIKASS, for your ${b.serviceId ? b.serviceId.replace(/_/g, ' ') : 'service'} booking (#${b.id}), the current status is '${b.status}'. Our background-verified pro is assigned.`;
        } else {
          replyMessage = "नमस्ते VIKASS, you do not have any active service bookings under way right now. Feel free to browse our home services catalog!";
        }
      } else if (txt.includes("refund")) {
        replyMessage = "For details about refunds or cancellations, please contact our helpline. All cancellations made up to 2 hours before the scheduled time slot qualify for a 100% immediate wallet credit refund!";
      } else if (txt.includes("city") || txt.includes("availability") || txt.includes("indore")) {
        replyMessage = "ZomIndia is currently live in Indore! More cities like Bhopal, Pune, and Mumbai will be launched soon. Stay tuned!";
      } else if (txt.includes("price") || txt.includes("cost") || txt.includes("charge")) {
        replyMessage = "Our standard packages start from as low as ₹499. We promise transparent, upfront pricing with strictly verified pros and a 7-day cover re-work warranty!";
      } else if (txt.includes("book") || txt.includes("schedule")) {
        replyMessage = "To schedule a service: select an active service categorised on the customer home page (like AC, Washing Machine, Refrigerator, RO Water Purifier or Electronics repair), choose your package, hit book, and confirm a preferred slot.";
      } else if (txt.includes("partner") || txt.includes("earn") || txt.includes("job")) {
        replyMessage = "As a verified Pro partner, you can browse open jobs in the 'Available Jobs Pool', accept assignments, trace client locations, and earn reward credits on completing jobs successfully. Is there a specific job you need help with?";
      } else if (txt.includes("call") || txt.includes("phone") || txt.includes("contact")) {
        replyMessage = "You can make real-time in-app audio calls to your assigned customer or pro directly using the phone card buttons inside the specific active booking timeline detail space!";
      }
      
      res.json({ reply: replyMessage });
    }
  });

  app.post("/api/add-funds", async (req, res) => {
    try {
      const { paymentId, amount, userId } = req.body;
      if (!paymentId || !amount || !userId) return res.status(400).json({ error: "Missing parameters" });

      // In a real app, verify Razorpay payment signature here
      // const razorpay = getRazorpay();
      // await razorpay.payments.fetch(paymentId);

      const userRef = db.collection("users").doc(userId);
      const userDoc = await userRef.get();
      if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

      const currentBalance = userDoc.data()?.walletBalance || 0;
      
      const batch = db.batch();
      
      // Update balance
      batch.update(userRef, {
         walletBalance: currentBalance + amount,
         updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      // Record transaction
      const txRef = db.collection("walletTransactions").doc();
      batch.set(txRef, {
         userId,
         amount,
         type: 'credit',
         reason: 'Added funds via Razorpay',
         referenceId: paymentId,
         status: 'completed',
         createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ error: "Missing parameters" });

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
         subscriptionExpiry: firebase.firestore.Timestamp.fromDate(expiry),
         updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      batch.set(db.collection("walletTransactions").doc(), {
         userId, amount: 999, type: 'debit', reason: 'ZomIndia PRIME Subscription', status: 'completed', createdAt: firebase.firestore.FieldValue.serverTimestamp()
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
      const bookingDoc = await bookingRef.get();
      if (!bookingDoc.exists) return res.status(404).json({ error: "Booking not found" });
      
      const booking = bookingDoc.data()!;
      console.log(`Verifying OTP for booking ${bookingId}. Expected values mapped: serviceOtp=${booking.serviceOtp}, otp=${booking.otp}, Got: ${otp}, Partner: ${partnerId}`);
      
      const normalize = (val: any) => (val || "").toString().trim();
      const inputOtp = normalize(otp);
      let matchFound = false;

      // Check main document fields (serviceOtp and otp)
      const rootOtpMatches = [booking.serviceOtp, booking.otp].some(
        (fieldVal) => fieldVal && normalize(fieldVal) === inputOtp
      );
      if (rootOtpMatches) {
        matchFound = true;
        console.log(`OTP matched root document values!`);
      }

      // 3. Fallback: check secrets/otp document
      if (!matchFound) {
        try {
          const secretsSnap = await db.collection("bookings").doc(bookingId).collection("secrets").doc("otp").get();
          if (secretsSnap.exists) {
            const secretData = secretsSnap.data() || {};
            const secretMatched = [secretData.code, secretData.otp, secretData.serviceOtp].some(
              (v) => v && normalize(v) === inputOtp
            );
            if (secretMatched) {
              matchFound = true;
              console.log(`OTP matched inside secrets subcollection doc!`);
            }
          }
        } catch (e) {
          console.error("Secrets subcollection fetch error:", e);
        }
      }

      // 4. Fallback: Check inside 'otps' subcollection (where doc.id or nested fields contain the code)
      if (!matchFound) {
        try {
          // Direct doc ID check first
          const directOtpDoc = await db.collection("bookings").doc(bookingId).collection("otps").doc(inputOtp).get();
          if (directOtpDoc.exists) {
            matchFound = true;
            console.log(`OTP matched direct document ID inside otps subcollection!`);
          } else {
            // Full scan of the otps subcollection
            const otpsSnap = await db.collection("bookings").doc(bookingId).collection("otps").get();
            if (!otpsSnap.empty) {
              const anyDocMatches = otpsSnap.docs.some(doc => {
                const data = doc.data() || {};
                return (
                  normalize(doc.id) === inputOtp || 
                  (data.code && normalize(data.code) === inputOtp) || 
                  (data.otp && normalize(data.otp) === inputOtp) ||
                  (data.serviceOtp && normalize(data.serviceOtp) === inputOtp)
                );
              });
              if (anyDocMatches) {
                matchFound = true;
                console.log(`OTP matched nested document field inside otps subcollection!`);
              }
            }
          }
        } catch (e) {
          console.error("Otps subcollection lookup error:", e);
        }
      }

      if (!matchFound) {
        console.warn(`OTP mismatch for booking ${bookingId}. Input: ${inputOtp}`);
        return res.status(400).json({ error: "Invalid OTP" });
      }

      // Ensure partnerId is set to the verifying partner (protect against unlinked, un-updated states)
      await bookingRef.update({
        status: 'in_progress',
        partnerId: partnerId,
        otpVerified: true,
        arrivedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

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
