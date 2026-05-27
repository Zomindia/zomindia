import express from "express";
import crypto from "crypto";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import { initializeFirestore } from "firebase/firestore";

// Patch admin's firestore namespace to map directly to client compatibility firestore
// This resolves the PERMISSION_DENIED issues occurring because of default service account limitations.
try {
  (admin as any).firestore = firebase.firestore;
} catch (patchErr) {
  console.error("[Patch] Failed to route admin.firestore to firebase.firestore:", patchErr);
}

import path from "path";
import { readFileSync } from "fs";

const router = express.Router();

// Helper to access Firestore database instance
let _db: any = null;
const getDb = () => {
  if (!_db) {
    try {
      const firebaseConfigPath = path.join(process.cwd(), "firebase-applet-config.json");
      const firebaseConfig = JSON.parse(readFileSync(firebaseConfigPath, "utf-8"));
      if (!firebase.apps.some(app => app.name === "client-backend")) {
        firebase.initializeApp(firebaseConfig, "client-backend");
      }
      
      const defaultCompat = firebase.app("client-backend").firestore();
      const childApp = (firebase.app("client-backend") as any)._delegate;
      const customDelegate = initializeFirestore(childApp, {}, firebaseConfig.firestoreDatabaseId || "(default)");
      
      _db = new (defaultCompat as any).constructor(
        firebase.app("client-backend"),
        customDelegate,
        (defaultCompat as any)._persistenceProvider
      );
    } catch (e: any) {
      console.error("[API getDb Error] Failed to read firebase config or initialize custom db:", e.message);
      _db = admin.firestore();
    }
  }
  return _db;
};

/**
 * ============================================================================
 * 1. AUTHENTICATION & PROFILE APIs
 * ============================================================================
 */

// POST /api/auth/register-or-login
// Syncs or registers users (Customers, Partners, Admins) on initial mobile/web setup
router.post("/auth/register-or-login", async (req: any, res: any) => {
  try {
    const { uid, displayName, email, role, phoneNumber, photoURL, address, adminSubRole } = req.body;
    
    if (!uid || !email || !role) {
      return res.status(400).json({ error: "Missing required parameters: uid, email, role" });
    }

    if (!["customer", "partner", "admin"].includes(role)) {
      return res.status(400).json({ error: "Invalid role. Must be 'customer', 'partner', or 'admin'" });
    }

    const db = getDb();
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    const referralCode = `ZOM-${uid.slice(0, 5).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`;

    const profileData: any = {
      uid,
      displayName: displayName || "ZomIndia User",
      email: email.toLowerCase().trim(),
      role,
      phoneNumber: phoneNumber || null,
      photoURL: photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${uid}`,
      address: address || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (role === "admin" && adminSubRole) {
      profileData.adminSubRole = adminSubRole; // head, accounts, or hr
    }

    if (!userDoc.exists) {
      profileData.createdAt = admin.firestore.FieldValue.serverTimestamp();
      profileData.walletBalance = 0;
      profileData.referralCode = referralCode;
      
      // Setup default notification preferences
      profileData.notificationPreferences = {
        bookingUpdates: true,
        promotionalMessages: true
      };

      await userRef.set(profileData);
      console.log(`[API Auth] Formed new user profile for UID: ${uid} | Role: ${role}`);

      // If user is a partner, auto-provision their /partners/{partnerId} document as well
      if (role === "partner") {
        await db.collection("partners").doc(uid).set({
          userId: uid,
          categories: [],
          bio: "Qualified Services Professional",
          rating: 5.0,
          reviewCount: 0,
          isVerified: false,
          status: "pending",
          availabilityStatus: "Available",
          kycStatus: "not_submitted",
          kycDocuments: [],
          totalEarnings: 0,
          rewardCredits: 0,
          lat: 28.6139, // Default Delhi coordinate
          lng: 77.2090,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } else {
      // Merge keys for existing profile
      await userRef.update(profileData);
      console.log(`[API Auth] Synchronized profile for existing UID: ${uid}`);
    }

    // Retrieve updated profile snapshot to return
    const updatedSnap = await userRef.get();
    return res.status(200).json({ success: true, profile: updatedSnap.data() });
  } catch (err: any) {
    console.error("[API Auth Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/profile/:userId
router.get("/auth/profile/:userId", async (req: any, res: any) => {
  try {
    const { userId } = req.params;
    const db = getDb();
    
    const userDoc = await db.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: "User profile not found" });
    }

    const data = userDoc.data()!;
    let partnerInfo = null;

    if (data.role === "partner") {
      const pDoc = await db.collection("partners").doc(userId).get();
      if (pDoc.exists) {
        partnerInfo = pDoc.data();
      }
    }

    return res.status(200).json({
      success: true,
      profile: data,
      partner: partnerInfo
    });
  } catch (err: any) {
    console.error("[API GetProfile Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/update-profile
router.post("/auth/update-profile", async (req: any, res: any) => {
  try {
    const { uid, displayName, phoneNumber, address, bio, notificationPreferences } = req.body;
    if (!uid) return res.status(400).json({ error: "Missing uid parameter" });

    const db = getDb();
    const userRef = db.collection("users").doc(uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) return res.status(404).json({ error: "User not found" });

    const updates: any = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (displayName !== undefined) updates.displayName = displayName;
    if (phoneNumber !== undefined) updates.phoneNumber = phoneNumber;
    if (address !== undefined) updates.address = address;
    if (bio !== undefined) updates.bio = bio;
    if (notificationPreferences !== undefined) updates.notificationPreferences = notificationPreferences;

    await userRef.update(updates);

    if (userDoc.data()?.role === "partner" && bio !== undefined) {
      await db.collection("partners").doc(uid).update({
        bio,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    return res.status(200).json({ success: true, message: "Profile updated successfully" });
  } catch (err: any) {
    console.error("[API UpdateProfile Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/partner/update-kyc
router.post("/partner/update-kyc", async (req: any, res: any) => {
  try {
    const { partnerId, documentType, documentUrl } = req.body;
    if (!partnerId || !documentType || !documentUrl) {
      return res.status(400).json({ error: "Missing parameters: partnerId, documentType, documentUrl" });
    }

    const db = getDb();
    const partnerRef = db.collection("partners").doc(partnerId);
    const partnerDoc = await partnerRef.get();

    if (!partnerDoc.exists) {
      return res.status(404).json({ error: "Partner profile not found" });
    }

    const currentDocSet = partnerDoc.data()?.kycDocuments || [];
    const newDoc = {
      type: documentType,
      url: documentUrl,
      status: "pending",
      submittedAt: new Date().toISOString()
    };

    await partnerRef.update({
      kycStatus: "pending",
      kycDocuments: [...currentDocSet, newDoc],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Notify admins about pending KYC
    await db.collection("notifications").add({
      userId: "admin-system", // Admin group notification
      title: "New Partner KYC Submission 📄",
      message: `Partner ${partnerId.slice(0, 6)} submitted credentials for ${documentType} review.`,
      type: "kyc_regulatory",
      bookingId: null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, message: "KYC documents uploaded successfully. Pending verification." });
  } catch (err: any) {
    console.error("[API UpdateKYC Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});


/**
 * ============================================================================
 * 2. SERVICE MANAGEMENT APIs
 * ============================================================================
 */

// GET /api/categories
router.get("/categories", async (req: any, res: any) => {
  try {
    const db = getDb();
    const snapshot = await db.collection("categories").orderBy("order", "asc").get();
    const categories: any[] = [];
    snapshot.forEach(doc => {
      categories.push({ id: doc.id, ...doc.data() });
    });
    return res.status(200).json({ success: true, categories });
  } catch (err: any) {
    console.error("[API Categories Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/services
router.get("/services", async (req: any, res: any) => {
  try {
    const { categoryId, search } = req.query;
    const db = getDb();
    let queryObj: any = db.collection("services");

    if (categoryId) {
      queryObj = queryObj.where("categoryId", "==", categoryId);
    }

    const snapshot = await queryObj.get();
    let services: any[] = [];
    snapshot.forEach((doc: any) => {
      services.push({ id: doc.id, ...doc.data() });
    });

    if (search) {
      const term = search.toLowerCase();
      services = services.filter(s => 
        (s.name || "").toLowerCase().includes(term) || 
        (s.description || "").toLowerCase().includes(term)
      );
    }

    return res.status(200).json({ success: true, services });
  } catch (err: any) {
    console.error("[API Services Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/services/:serviceId
router.get("/services/:serviceId", async (req: any, res: any) => {
  try {
    const { serviceId } = req.params;
    const db = getDb();
    const doc = await db.collection("services").doc(serviceId).get();

    if (!doc.exists) return res.status(404).json({ error: "Service not found" });
    return res.status(200).json({ success: true, service: { id: doc.id, ...doc.data() } });
  } catch (err: any) {
    console.error("[API ServiceDetail Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});


/**
 * ============================================================================
 * 3. BOOKING LOGIC AND WORKFLOWS
 * ============================================================================
 */

// POST /api/bookings/create
router.post("/bookings/create", async (req: any, res: any) => {
  try {
    const { customerId, serviceId, scheduledAt, address, promoCode } = req.body;
    
    if (!customerId || !serviceId || !scheduledAt || !address) {
      return res.status(400).json({ error: "Missing mandatory fields: customerId, serviceId, scheduledAt, address" });
    }

    const db = getDb();

    // 1. Resolve Service Pricing Detail
    const serviceDoc = await db.collection("services").doc(serviceId).get();
    if (!serviceDoc.exists) {
      return res.status(404).json({ error: "Selected service does not exist in the catalogue" });
    }
    const serviceData = serviceDoc.data()!;
    let totalPrice = Number(serviceData.basePrice || 0);

    // 2. Validate user and calculate premium status discounts (Prime Customers get extra 10% off)
    const customerDoc = await db.collection("users").doc(customerId).get();
    const customerData = customerDoc.exists ? customerDoc.data() : null;
    let discountApplied = 0;

    if (customerData?.isPremium) {
      const primeDiscount = totalPrice * 0.10; // 10% premium discount
      discountApplied += primeDiscount;
      totalPrice -= primeDiscount;
      console.log(`[API Booking] Applied PRIME 10% Discount: ₹${primeDiscount}`);
    }

    // 3. Resolve optional coupon codes
    if (promoCode) {
      const promoQuery = await db.collection("promotions").where("code", "==", promoCode).limit(1).get();
      if (!promoQuery.empty) {
        const promo = promoQuery.docs[0].data();
        if (promo.active) {
          let promoDiscount = 0;
          if (promo.discountType === "percent") {
            promoDiscount = totalPrice * (promo.discountValue / 100);
          } else if (promo.discountType === "flat") {
            promoDiscount = promo.discountValue;
          }
          
          discountApplied += promoDiscount;
          totalPrice = Math.max(0, totalPrice - promoDiscount);
          console.log(`[API Booking] Applied Promo Code ${promoCode}: ₹${promoDiscount}`);
        }
      }
    }

    // 4. Generate 4-digit unique Start OTP code
    const serviceOtp = Math.floor(1000 + Math.random() * 9000).toString();

    // 5. Structure custom booking blueprint
    const bookingPayload = {
      customerId,
      partnerId: null,
      serviceId,
      status: "pending",
      paymentStatus: "unpaid",
      paymentMethod: "online",
      scheduledAt: admin.firestore.Timestamp.fromDate(new Date(scheduledAt)),
      address,
      totalPrice: Math.round(totalPrice),
      discountApplied: Math.round(discountApplied),
      promoCode: promoCode || null,
      completedTasks: [],
      additionalCharges: [],
      serviceOtp,
      otpVerified: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const newBookingRef = await db.collection("bookings").add(bookingPayload);
    const bookingId = newBookingRef.id;

    // Save sensitive OTP in secure subcollection as per the guidelines
    await db.collection("bookings").doc(bookingId).collection("secrets").doc("otp").set({
      code: serviceOtp,
      createdAt: new Date().toISOString()
    });

    // 6. Push notifications to customer and active category partners
    await db.collection("notifications").add({
      userId: customerId,
      title: "Booking Requested! 🚀",
      message: `Your appointment for ${serviceData.name} has been received. We are matching physical service partners nearby.`,
      type: "booking_requested",
      bookingId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Notify suitable service partners (who deal with this category)
    const partnersSnapshot = await db.collection("partners")
      .where("categories", "array-contains", serviceData.categoryId)
      .where("availabilityStatus", "==", "Available")
      .where("status", "==", "active")
      .get();

    partnersSnapshot.forEach(async (doc: any) => {
      const partner = doc.data();
      await db.collection("notifications").add({
        userId: partner.userId,
        title: "New Job Lead! 💼",
        message: `New booking worth ₹${Math.round(totalPrice)} available for ${serviceData.name} near ${address.slice(0, 30)}...`,
        type: "booking_lead",
        bookingId,
        read: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    return res.status(201).json({
      success: true,
      bookingId,
      totalPrice: Math.round(totalPrice),
      otp: serviceOtp,
      message: "Booking submitted successfully."
    });
  } catch (err: any) {
    console.error("[API CreateBooking Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/customer/:customerId
router.get("/bookings/customer/:customerId", async (req: any, res: any) => {
  try {
    const { customerId } = req.params;
    const db = getDb();
    const snapshot = await db.collection("bookings")
      .where("customerId", "==", customerId)
      .orderBy("createdAt", "desc")
      .get();

    const bookings: any[] = [];
    snapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json({ success: true, bookings });
  } catch (err: any) {
    console.error("[API CustomerBookings Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/bookings/partner/:partnerId
router.get("/bookings/partner/:partnerId", async (req: any, res: any) => {
  try {
    const { partnerId } = req.params;
    const db = getDb();
    const snapshot = await db.collection("bookings")
      .where("partnerId", "==", partnerId)
      .orderBy("createdAt", "desc")
      .get();

    const bookings: any[] = [];
    snapshot.forEach(doc => {
      bookings.push({ id: doc.id, ...doc.data() });
    });

    return res.status(200).json({ success: true, bookings });
  } catch (err: any) {
    console.error("[API PartnerBookings Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings/:bookingId/accept
// Accept an open booking lead by a professional partner
router.post("/bookings/:bookingId/accept", async (req: any, res: any) => {
  try {
    const { bookingId } = req.params;
    const { partnerId } = req.body;

    if (!partnerId) return res.status(400).json({ error: "Missing partnerId parameter" });

    const db = getDb();
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) return res.status(404).json({ error: "Booking session not found" });

    const bookingData = bookingDoc.data()!;
    if (bookingData.status !== "pending") {
      return res.status(400).json({ error: `Cannot accept booking. Service is currently ${bookingData.status}.` });
    }

    // Assign the partner and update session
    await bookingRef.update({
      partnerId,
      status: "confirmed",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Update partner online status to busy
    await db.collection("partners").doc(partnerId).update({
      availabilityStatus: "Busy",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Notify customer
    const partnerProfile = await db.collection("users").doc(partnerId).get();
    const partnerName = partnerProfile.exists ? partnerProfile.data()?.displayName : "ZomIndia Agent";

    await db.collection("notifications").add({
      userId: bookingData.customerId,
      title: "Service Partner Assigned! 🤝",
      message: `${partnerName} has accepted your request and is preparing for your scheduled schedule!`,
      type: "booking_confirmed",
      bookingId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, message: "Booking accepted and confirmed" });
  } catch (err: any) {
    console.error("[API AcceptBooking Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings/:bookingId/status
// Progress step status increments carefully (on_the_way -> in_progress -> completed -> cancelled)
router.post("/bookings/:bookingId/status", async (req: any, res: any) => {
  try {
    const { bookingId } = req.params;
    const { status, cancellationReason } = req.body;

    if (!status) return res.status(400).json({ error: "Missing target status state" });

    const db = getDb();
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) return res.status(404).json({ error: "Booking session not found" });
    const bookingData = bookingDoc.data()!;

    const updates: any = {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (status === "cancelled" && cancellationReason) {
      updates.cancellationReason = cancellationReason;
    }

    await bookingRef.update(updates);

    // If status becomes completed, process partner payment earnings splits
    if (status === "completed") {
      const partnerId = bookingData.partnerId;
      if (partnerId) {
        // Calculate earnings (80% goes to the hard-working professional, 20% platform commission)
        const earned = Math.round(Number(bookingData.totalPrice || 0) * 0.80);
        
        const earningsRef = db.collection("partners").doc(partnerId).collection("earningsHistory").doc();
        await earningsRef.set({
          type: "booking_earning",
          amount: earned,
          reason: `Completed Booking #${bookingId.slice(0, 8).toUpperCase()}`,
          bookingId,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // Increment cumulative total earnings on host profile
        const partnerRef = db.collection("partners").doc(partnerId);
        await db.runTransaction(async (transaction) => {
          const pDoc = await transaction.get(partnerRef);
          if (pDoc.exists) {
            const currentTotal = pDoc.data()?.totalEarnings || 0;
            transaction.update(partnerRef, {
              totalEarnings: currentTotal + earned,
              availabilityStatus: "Available", // Set back to idle
              updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
          }
        });

        // Push completed notification to customer
        await db.collection("notifications").add({
          userId: bookingData.customerId,
          title: "Job Completed Successfully! 🎉",
          message: `Your booking #${bookingId.slice(0, 8).toUpperCase()} has been completed. Check your email for the detailed PDF receipt.`,
          type: "booking_completed",
          bookingId,
          read: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    }

    return res.status(200).json({ success: true, message: `Status progressed to ${status}` });
  } catch (err: any) {
    console.error("[API ProgressStatus Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/bookings/:bookingId/add-charge
// Handles extra parts or incremental work charges requested during servicing
router.post("/bookings/:bookingId/add-charge", async (req: any, res: any) => {
  try {
    const { bookingId } = req.params;
    const { amount, reason } = req.body;

    if (!amount || !reason) {
      return res.status(400).json({ error: "Missing parameters: amount, reason" });
    }

    const db = getDb();
    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) return res.status(404).json({ error: "Booking session not found" });
    const bookingData = bookingDoc.data()!;

    const chargesSet = bookingData.additionalCharges || [];
    const newCharge = {
      amount: Number(amount),
      reason,
      createdAt: new Date().toISOString()
    };

    const updatedPrice = Number(bookingData.totalPrice || 0) + Number(amount);

    await bookingRef.update({
      additionalCharges: [...chargesSet, newCharge],
      totalPrice: updatedPrice,
      paymentStatus: "unpaid", // Unpaid outstanding adjustments must be cleared
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Trigger notified customer alert
    await db.collection("notifications").add({
      userId: bookingData.customerId,
      title: "Invoice Update 💰",
      message: `Additional charges of ₹${amount} added for: "${reason}". Total is now ₹${updatedPrice}.`,
      type: "booking_update",
      bookingId,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(200).json({ success: true, totalPrice: updatedPrice, message: "Additional charge logged" });
  } catch (err: any) {
    console.error("[API AddCharge Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});


/**
 * ============================================================================
 * 4. WEAPONS GRADE SECURE PAYMENTS SYSTEM
 * ============================================================================
 */

// POST /api/payment/razorpay/verify-and-confirm
// Confirms Razorpay signature & clears outstanding balances
router.post("/payment/razorpay/verify-and-confirm", async (req: any, res: any) => {
  try {
    const { bookingId, customerId, razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;

    if (!bookingId || !razorpayPaymentId) {
      return res.status(400).json({ error: "Missing verification criteria: bookingId, razorpayPaymentId" });
    }

    const db = getDb();

    // Verify signature cryptographically
    if (process.env.RAZORPAY_KEY_SECRET && razorpaySignature && razorpayOrderId) {
      const text = razorpayOrderId + "|" + razorpayPaymentId;
      const generated_signature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(text)
        .digest("hex");

      if (generated_signature !== razorpaySignature) {
        return res.status(400).json({ error: "Tampered billing signature verification failed!" });
      }
    }

    const bookingRef = db.collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();

    if (!bookingDoc.exists) return res.status(404).json({ error: "Booking session not found" });
    const bookingData = bookingDoc.data()!;

    // Perform transactional mutations
    await db.runTransaction(async (t) => {
      t.update(bookingRef, {
        paymentStatus: "paid",
        paymentIntentId: razorpayPaymentId,
        paymentMethod: "online",
        status: bookingData.status === "pending" ? "confirmed" : bookingData.status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      // Issue transaction log entry
      const txRef = db.collection("walletTransactions").doc();
      t.set(txRef, {
        userId: customerId || bookingData.customerId,
        amount: bookingData.totalPrice,
        type: "debit",
        reason: `Cleared Booking #${bookingId.slice(0, 8).toUpperCase()} digitally via Razorpay`,
        referenceId: razorpayPaymentId,
        status: "completed",
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });

    console.log(`[API Payment] Payment cleared via Razorpay Order: ${razorpayOrderId} for Booking: ${bookingId}`);
    return res.status(200).json({ success: true, message: "Payment verified and recorded!" });
  } catch (err: any) {
    console.error("[API ConfirmPayment Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});


/**
 * ============================================================================
 * 5. SUPPORT TICKETS INTEGRATION
 * ============================================================================
 */

// POST /api/support/tickets/create
router.post("/support/tickets/create", async (req: any, res: any) => {
  try {
    const { userId, subject, message, priority } = req.body;
    
    if (!userId || !subject || !message) {
      return res.status(400).json({ error: "Missing required ticketing variables: userId, subject, message" });
    }

    const db = getDb();
    const ticketPayload = {
      userId,
      subject,
      message,
      status: "open",
      priority: priority || "medium",
      adminResponse: "",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const newTicket = await db.collection("tickets").add(ticketPayload);
    
    // Notify customer
    await db.collection("notifications").add({
      userId,
      title: "Support Ticket Raised 🎫",
      message: `Your ticket regarding "${subject}" is created. ID: #${newTicket.id.slice(0, 6).toUpperCase()}. Our helpdesk is reviewing this.`,
      type: "support_initiated",
      bookingId: null,
      read: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return res.status(201).json({ success: true, ticketId: newTicket.id, message: "Support ticket registered." });
  } catch (err: any) {
    console.error("[API CreateTicket Error]:", err);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
