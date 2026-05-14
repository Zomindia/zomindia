import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Razorpay from "razorpay";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import axios from "axios";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import admin from "firebase-admin";
import { readFileSync } from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
const firebaseConfig = JSON.parse(readFileSync(new URL('./firebase-applet-config.json', import.meta.url), 'utf-8'));
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
      docPdf.fontSize(16).text(`Total Amount: ₹${bookingData.totalPrice}`, { bold: true });
      
      docPdf.end();
      const pdfBuffer = await pdfBufferPromise;

      // 2. Send Email
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.gmail.com",
        port: Number(process.env.SMTP_PORT) || 587,
        secure: false, 
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
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${userData.email}`);
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

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(console.error);
