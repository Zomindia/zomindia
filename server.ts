import express from "express";
import path from "path";
import Razorpay from "razorpay";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import axios from "axios";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import admin from "firebase-admin";
import { readFileSync } from "fs";
import { GoogleGenAI } from "@google/genai";

dotenv.config();

const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, "utf-8"));
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const db = admin.firestore();

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
    try {
      const { message, context } = req.body;
      if (!message) return res.status(400).json({ error: "Message is required" });

      if (!process.env.GEMINI_API_KEY) {
         return res.json({ reply: "I'm offline right now because the API key is missing. Please ask human support." });
      }

      const ai = getAi();
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: `Context: ${JSON.stringify(context || {})}\nUser: ${message}`,
        config: {
          systemInstruction: `You are the zomindia AI support assistant. You are helpful, professional, and knowledgeable about home services. 
          You have access to the user's profile and their recent bookings (if any). Use this context to provide specific, personalized help. 
          For customers, help with their bookings and service queries. For partners, help them with their assigned jobs and earnings queries. 
          If you cannot resolve an issue, suggest they contact human support at ${process.env.VITE_WHATSAPP_SUPPORT_NUMBER || 'WhatsApp'}. 
          Always keep answers concise and avoid over-explaining. If the user asks for a WhatsApp link, provide it: https://wa.me/${(process.env.VITE_WHATSAPP_SUPPORT_NUMBER || '').replace(/\D/g, '')}`,
        }
      });
      res.json({ reply: response.text });
    } catch (err: any) {
      console.error("Gemini AI Error:", err);
      res.status(500).json({ error: err.message || "Failed to generate AI response" });
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
         updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
         updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      batch.set(db.collection("walletTransactions").doc(), {
         userId, amount: 100, type: 'credit', reason: 'Welcome Bonus (Referred)', status: 'completed', createdAt: admin.firestore.FieldValue.serverTimestamp()
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
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      batch.update(referrerRef, {
        walletBalance: (referrerDoc.data()?.walletBalance || 0) + 100,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      batch.set(db.collection("walletTransactions").doc(), {
        userId: referrerId, 
        amount: 100, 
        type: 'credit', 
        reason: 'Referral Bonus (Friend completed first booking)', 
        status: 'completed', 
        createdAt: admin.firestore.FieldValue.serverTimestamp()
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
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
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
      console.log(`Verifying OTP for booking ${bookingId}. Expected: ${booking.serviceOtp}, Got: ${otp}, Partner: ${partnerId}, BookingPartner: ${booking.partnerId}`);
      
      if (booking.partnerId !== partnerId) {
        console.warn(`Partner ID mismatch. Expected: ${booking.partnerId}, Got: ${partnerId}`);
        // If it still doesn't match, maybe check if the partnerId document exists or if they was just assigned.
        // But let's stick to strict check for now, but be aware of possible userId vs id issues.
      }

      let currentOtp = booking.serviceOtp;

      if (!currentOtp) {
        // Fallback: check secrets collection
        const secretsSnap = await db.collection("bookings").doc(bookingId).collection("secrets").doc("otp").get();
        if (secretsSnap.exists) {
          currentOtp = secretsSnap.data()?.code;
          console.log(`OTP found in secrets: ${currentOtp}`);
        }
      }

      if (!currentOtp) {
        return res.status(400).json({ error: "No OTP set for this booking" });
      }

      // Robust comparison
      const normalize = (val: any) => (val || "").toString().trim();
      if (normalize(currentOtp) !== normalize(otp)) {
        console.warn(`OTP mismatch for booking ${bookingId}. Normalize(current): ${normalize(currentOtp)}, Normalize(input): ${normalize(otp)}`);
        return res.status(400).json({ error: "Invalid OTP" });
      }

      await bookingRef.update({
        status: 'in_progress',
        otpVerified: true,
        arrivedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        t.update(bookingRef, {
          paymentStatus: 'paid',
          paymentMethod: 'wallet',
          status: 'finalized',
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        // Also write to transaction history
        const txRef = db.collection('walletTransactions').doc();
        t.set(txRef, {
           userId: userId,
           amount: totalPrice,
           type: 'debit',
           reason: `Paid for booking ${bookingId}`,
           status: 'completed',
           createdAt: admin.firestore.FieldValue.serverTimestamp()
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false
      },
      appType: "spa",
      logLevel: 'silent',
      clearScreen: false
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
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
