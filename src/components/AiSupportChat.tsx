import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Send,
  User,
  Globe,
  Mic,
  Phone,
  Mail,
  MessageCircle,
  CreditCard,
  ShieldCheck,
  Lock,
  Check,
  AlertCircle,
} from "lucide-react";
import { UserProfile, Booking } from "../types";
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
  doc,
  setDoc,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { CORPORATE_LANDLINE_GATEWAY } from "../lib/telephony";
import confetti from "canvas-confetti";

// =========================================================================
// IMMUTABLE STATIC GRAPHICS: High-Fidelity Custom Vector SVG for ZOMI Avatar
// =========================================================================
export function ZomiAvatarSVG({
  className = "w-full h-full",
}: {
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background Circle Gradient */}
      <circle
        cx="50"
        cy="50"
        r="48"
        fill="url(#zomi-hair-grad)"
        stroke="#FFF"
        strokeWidth="1.5"
      />
      {/* Gradients */}
      <defs>
        <radialGradient id="zomi-bg-grad" cx="50%" cy="40%" r="50%">
          <stop offset="0%" stopColor="#FFF4ED" />
          <stop offset="100%" stopColor="#FFE0CC" />
        </radialGradient>
        <linearGradient id="zomi-skin-grad" x1="50%" y1="20%" x2="50%" y2="80%">
          <stop offset="0%" stopColor="#FAD3B6" />
          <stop offset="100%" stopColor="#E2A175" />
        </linearGradient>
        <linearGradient id="zomi-hair-grad" x1="50%" y1="0%" x2="50%" y2="100%">
          <stop offset="0%" stopColor="#25211E" />
          <stop offset="100%" stopColor="#120E0C" />
        </linearGradient>
        <linearGradient
          id="zomi-saree-grad"
          x1="0%"
          y1="50%"
          x2="100%"
          y2="50%"
        >
          <stop offset="0%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#991B1B" />
        </linearGradient>
      </defs>
      {/* Background fill */}
      <circle cx="50" cy="50" r="46" fill="url(#zomi-bg-grad)" />
      {/* Hair (Outer Back) */}
      <path
        d="M 20,68 C 17,35 30,12 50,12 C 70,12 83,35 80,68 C 78,76 83,85 83,85"
        fill="url(#zomi-hair-grad)"
      />
      {/* Neck */}
      <path
        d="M 43,65 L 43,76 C 43,79 57,79 57,76 L 57,65 Z"
        fill="url(#zomi-skin-grad)"
      />
      {/* Golden Necklace */}
      <path
        d="M 43,73 C 46,77 54,77 57,73"
        stroke="#D97706"
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="50" cy="76" r="2.5" fill="#DC2626" />
      {/* Face Base */}
      <path
        d="M 30,45 C 30,31 38,26 50,26 C 62,26 70,31 70,45 C 70,59 62,64 50,64 C 38,64 30,59 30,45 Z"
        fill="url(#zomi-skin-grad)"
      />
      {/* Hair Traditional Front Frame */}
      <path
        d="M 29,42 C 34,24 45,22 50,27 C 55,22 66,24 71,42 C 69,29 63,24 50,27 C 37,24 31,29 29,42 Z"
        fill="url(#zomi-hair-grad)"
      />
      {/* Bun on Top */}
      <circle cx="50" cy="19" r="10" fill="url(#zomi-hair-grad)" />
      {/* Traditional Red Bindi */}
      <circle cx="50" cy="36" r="2.2" fill="#DC2626" />
      {/* Beautiful Styled Eyes & Brows */}
      <path
        d="M 37,41 C 39,39 42,39 44,41"
        stroke="#120E0D"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M 56,41 C 58,39 61,39 63,41"
        stroke="#120E0D"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="41" cy="44.5" r="1.5" fill="#120E0D" />
      <circle cx="59" cy="44.5" r="1.5" fill="#120E0D" />
      <circle cx="40.5" cy="44" r="0.6" fill="#FFF" />
      <circle cx="58.5" cy="44" r="0.6" fill="#FFF" />
      {/* Smiling Lips */}
      <path
        d="M 44,53 C 46,57 54,57 56,53"
        stroke="#B91C1C"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      {/* Nose Layout */}
      <path
        d="M 48,46 C 50,48 50,48 52,46"
        stroke="#C38E6A"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="48" cy="47" r="0.8" fill="#F59E0B" />{" "}
      {/* Nath/Nose ring sparkle */}
      {/* Soft Blush */}
      <circle cx="35" cy="49" r="2.5" fill="#F43F5E" fillOpacity="0.2" />
      <circle cx="65" cy="49" r="2.5" fill="#F43F5E" fillOpacity="0.2" />
      {/* Modern Headset mic integration */}
      <path
        d="M 30,45 C 26,45 26,41 26,41 M 70,45 C 74,45 74,41 74,41"
        stroke="#475569"
        strokeWidth="2"
        fill="none"
      />
      <path
        d="M 26,41 C 26,20 74,20 74,41"
        stroke="#475569"
        strokeWidth="1.5"
        fill="none"
        strokeDasharray="2,2"
      />
      <rect x="24" y="38" width="4" height="8" rx="1.5" fill="#475569" />
      <rect
        x="72"
        y="38"
        width="4"
        height="8"
        rx="1.5"
        fill="#475569"
        stroke="#E2E8F0"
        strokeWidth="0.5"
      />
      <path
        d="M 72,42 C 66,46 58,48 55,48"
        stroke="#1E293B"
        strokeWidth="1.5"
        fill="none"
        strokeLinecap="round"
      />
      <circle cx="54" cy="48" r="1.5" fill="#10B981" /> {/* Glowing mic tip */}
      {/* Elegant Saree drape */}
      <path
        d="M 18,85 C 28,77 38,77 50,77 C 62,77 72,77 82,85 C 84,88 86,95 86,100 L 14,100 C 14,95 16,88 18,85 Z"
        fill="url(#zomi-saree-grad)"
      />
      <path
        d="M 31,77 C 35,82 43,94 46,100"
        stroke="#F59E0B"
        strokeWidth="3.5"
        fill="none"
      />{" "}
      {/* Gota Patti border (Zari gold) */}
    </svg>
  );
}

// Masking system function for Indian phone numbers: formats explicitly as +91 •••••• [last 4] to maintain complete privacy
const maskPhoneNumbers = (text: string): string => {
  // Tightened phone number extraction regex to standard 10-digit Indian mobile formats
  const phoneRegex = /\+?91[-.\s]?[6-9]\d{3}[-.\s]?\d{4}[-.\s]?\d{3}(?!\d)/g;
  const exact10DigitRegex = /(?:\+?91|0)?[-\s]?([6-9]\d{5})[-\s]?(\d{4})\b/g;

  let formatted = text.replace(phoneRegex, (match) => {
    const digits = match.replace(/\D/g, "");
    const last4 = digits.slice(-4);
    return `+91 •••••• ${last4}`;
  });

  formatted = formatted.replace(exact10DigitRegex, (match, firstPart, last4) => {
    return `+91 •••••• ${last4}`;
  });

  return formatted;
};

// Time slots definition matching main app standards (2-hour advance booking required for Today)
export const TIME_SLOTS = [
  { label: "10:00 AM - 12:00 PM", shortLabel: "10:00 AM", startHour: 10, startMin: 0 },
  { label: "02:00 PM - 04:00 PM", shortLabel: "02:00 PM", startHour: 14, startMin: 0 },
  { label: "05:00 PM - 07:00 PM", shortLabel: "05:00 PM", startHour: 17, startMin: 0 },
];

export const getISTNow = (): Date => {
  const now = new Date();
  try {
    const istString = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
    return new Date(istString);
  } catch (e) {
    return now;
  }
};

export const isSlotAvailable = (dateType: "today" | "tomorrow", slotLabel: string): boolean => {
  if (dateType === "tomorrow") return true;

  const slot = TIME_SLOTS.find((s) => s.label === slotLabel || s.shortLabel === slotLabel);
  if (!slot) return true;

  const nowIST = getISTNow();
  const slotTime = new Date(nowIST);
  slotTime.setHours(slot.startHour, slot.startMin, 0, 0);

  const diffInMs = slotTime.getTime() - nowIST.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);

  // Require at least 2 hours advance booking for Today
  return diffInHours >= 2;
};

export const getFirstAvailableSlot = (dateType: "today" | "tomorrow"): string | null => {
  for (const slot of TIME_SLOTS) {
    if (isSlotAvailable(dateType, slot.label)) {
      return slot.label;
    }
  }
  return null;
};

export const isDateFullyBooked = (dateType: "today" | "tomorrow"): boolean => {
  return getFirstAvailableSlot(dateType) === null;
};

const LANGUAGES = [
  { code: "hi-IN", name: "हिंदी (Hindi)", label: "हिं" },
  { code: "en-IN", name: "English (India)", label: "EN" },
  { code: "bn-IN", name: "বাংলা (Bengali)", label: "BN" },
  { code: "ta-IN", name: "தமிழ் (Tamil)", label: "TA" },
  { code: "te-IN", name: "తెలుగు (Telugu)", label: "TE" },
  { code: "mr-IN", name: "मराठी (Marathi)", label: "MR" },
  { code: "gu-IN", name: "ગુજરાતી (Gujarati)", label: "GU" },
  { code: "kn-IN", name: "ಕನ್ನಡ (Kannada)", label: "KN" },
  { code: "ml-IN", name: "മലയാളം (Malayalam)", label: "ML" },
  { code: "pa-IN", name: "ਪੰਜਾਬੀ (Punjabi)", label: "PA" },
];

// Helper to dynamically detect if a string matches a specific language script or Hinglish
const detectLanguage = (text: string, currentLang?: string): string | null => {
  if (!text) return null;
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN"; // Gujarati
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN"; // Bengali
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN"; // Tamil
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN"; // Telugu
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN"; // Kannada
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN"; // Malayalam
  if (/[\u0A00-\u0A7F]/.test(text)) return "pa-IN"; // Punjabi
  if (/[\u0900-\u097F]/.test(text)) {
    // If the current language is Marathi, don't overwrite with Hindi
    if (currentLang === "mr-IN") return "mr-IN";
    return "hi-IN";
  }
  // Check if the text contains Hinglish / Roman Hindi words or phrases
  const hinglishRegex = /\b(hai|hain|nahi|nahin|ho|raha|rahi|rahe|karo|kya|kaise|kitna|kitne|chahiye|me|mein|par|ko|se|bhai|bhaiya|aaj|aaya|aa|ka|ki|ke|pani|paani|thanda|thandha|kharab|aayega|aaye|karenge|karne|batao|bataiye|dikkat|samasya|paise|rupaye|sahi|sasta|chalu|band|bhej|bhejo|kam|kaam)\b/i;
  if (hinglishRegex.test(text)) {
    return "hi-IN";
  }
  const pureEnglishRegex = /\b(the|is|are|am|was|were|be|have|has|had|do|does|did|where|why|how|what|which|who|whom|when|please|help|could|would|should|can|will|service|booking|repair|check|status|cancel|refund)\b/i;
  if (pureEnglishRegex.test(text) && !hinglishRegex.test(text)) {
    return "en-IN";
  }
  return null;
};

export default function AiSupportChat({
  userProfile,
  isPartner,
  bookings,
  activeTab,
}: {
  userProfile?: UserProfile;
  isPartner?: boolean;
  bookings?: Booking[];
  activeTab?: string;
}) {
  const [isOpen, setIsOpen] = useState(() => {
    try {
      const savedOpen = sessionStorage.getItem("zomini_chat_open");
      if (savedOpen === "true") {
        sessionStorage.removeItem("zomini_chat_open");
        return true;
      }
    } catch (e) {
      console.warn(e);
    }
    return false;
  });
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );

  // IMMUTABLE SYSTEM-SYNC STARTING MESSAGE: Context-aware of active bookings
  const [messages, setMessages] = useState<
    { role: "ai" | "user"; text: string; bookingData?: any }[]
  >(() => {
    try {
      const saved = sessionStorage.getItem("zomini_pending_chat_history");
      if (saved) {
        sessionStorage.removeItem("zomini_pending_chat_history");
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn(e);
    }

    const defaultMsg = "Welcome to Zomindia! Please log in to chat with Zomini and track your active home services.";
    if (userProfile) {
      const userName = userProfile.fullName || userProfile.displayName || "User";
      return [
        {
          role: "ai",
          text: `Namaste ${userName}, your refrigerator service expert is on the way.`,
        },
      ];
    }
    return [
      {
        role: "ai",
        text: defaultMsg,
      },
    ];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [localBookings, setLocalBookings] = useState<Booking[]>(bookings || []);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);
  const [draftBookings, setDraftBookings] = useState<Record<string, any>>({});
  const [selectedSlots, setSelectedSlots] = useState<Record<string, { date: string; slot: string }>>({});
  const [selectedAddresses, setSelectedAddresses] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef<boolean>(false);
  
  // PhonePe Payment Gateway In Chat State
  const [activePhonePePayment, setActivePhonePePayment] = useState<{
    bookingId: string;
    amount: number;
    serviceType: string;
    merchantTransactionId: string;
    redirectUrl?: string;
  } | null>(null);
  const [isConfirmingPhonePe, setIsConfirmingPhonePe] = useState(false);
  const [phonePeError, setPhonePeError] = useState<string | null>(null);

  // Multilingual voice configurations
  const [selectedLang, setSelectedLang] = useState("hi-IN");
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const saveContextBeforeLogin = () => {
    try {
      sessionStorage.setItem("zomini_pending_chat_history", JSON.stringify(messages));
      sessionStorage.setItem("zomini_chat_open", "true");
      if (activeTab) {
        sessionStorage.setItem("zomini_saved_tab", activeTab);
      }
      console.log("[Zomini] Saved pending chat history, active tab, and active toggle in sessionStorage.");
    } catch (err) {
      console.warn("Failed to save pending chat history:", err);
    }
  };

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Dynamic language detection based on current conversation context or user input
  useEffect(() => {
    if (input.trim().length > 1) {
      const detected = detectLanguage(input, selectedLang);
      if (detected && detected !== selectedLang) {
        setSelectedLang(detected);
      }
    } else if (messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const detected = detectLanguage(lastMsg.text, selectedLang);
      if (detected && detected !== selectedLang) {
        setSelectedLang(detected);
      }
    }
  }, [input, messages, selectedLang]);

  const updateBookingSlot = (bookingId: string, date: string, slot: string) => {
    setSelectedSlots((prev) => ({ ...prev, [bookingId]: { date, slot } }));
    setDraftBookings((prev) => {
      const existing = prev[bookingId] || {};
      return {
        ...prev,
        [bookingId]: {
          ...existing,
          scheduledSlot: `${date === "today" ? "Today" : "Tomorrow"}, ${slot}`
        }
      };
    });
  };

  const updateBookingAddress = (bookingId: string, address: string) => {
    setSelectedAddresses((prev) => ({ ...prev, [bookingId]: address }));
    setDraftBookings((prev) => {
      const existing = prev[bookingId] || {};
      return {
        ...prev,
        [bookingId]: {
          ...existing,
          address
        }
      };
    });
  };

  const handleNavigateToBooking = (bookingId?: string) => {
    setIsOpen(false);
    window.dispatchEvent(
      new CustomEvent("change-active-tab", {
        detail: { tab: "bookings", bookingId: bookingId || null }
      })
    );
  };

  const handlePayAfterService = async (bookingId: string) => {
    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      let bookingPayload = draftBookings[bookingId];
      if (!bookingPayload) {
        const foundMsg = messages.find((m: any) => m.bookingData?.id === bookingId);
        if (foundMsg && (foundMsg as any).bookingData) {
          bookingPayload = (foundMsg as any).bookingData;
        }
      }

      const selectedAddress = selectedAddresses[bookingId] || bookingPayload?.address || "Indore (Zomindia Service Area)";
      const chosenSlotObj = selectedSlots[bookingId];
      const todayFullyBooked = isDateFullyBooked("today");
      const defaultDateVal = todayFullyBooked ? "tomorrow" : "today";
      const curDate = chosenSlotObj?.date || defaultDateVal;
      const curSlot = chosenSlotObj?.slot || getFirstAvailableSlot(curDate as any) || "10:00 AM - 12:00 PM";
      const scheduledSlot = `${curDate === "today" ? "Today" : "Tomorrow"}, ${curSlot}`;

      const activeUid = userProfile?.uid || auth.currentUser?.uid || "guest";
      const resolvedName = userProfile?.fullName || userProfile?.displayName || auth.currentUser?.displayName || "Customer";
      const resolvedMobile = userProfile?.mobile || userProfile?.phoneNumber || auth.currentUser?.phoneNumber || "9876543210";

      const resolvedEmail = userProfile?.email || auth.currentUser?.email || "";

      const bookingRef = doc(db, "bookings", bookingId);
      const fee = bookingPayload?.totalPrice || bookingPayload?.visitationFee || 195;
      const confirmedPayload = {
        customerUid: activeUid,
        userId: activeUid,
        customerId: activeUid,
        serviceId: bookingPayload?.serviceId || "service_home_service",
        partnerId: bookingPayload?.partnerId || null,
        serviceType: bookingPayload?.serviceType || bookingPayload?.issueDetails || "Home Service",
        issueDetails: bookingPayload?.issueDetails || bookingPayload?.serviceType || "Home Service",
        visitationFee: fee,
        totalPrice: fee,
        originalBillValue: fee,
        paidAmount: 0,
        walletDeductAmount: 0,
        discountApplied: 0,
        promoCode: null,
        isAmcBooking: false,
        amcId: null,
        scheduledSlot,
        scheduledAt: Timestamp.now(),
        address: selectedAddress,
        lat: (bookingPayload?.lat !== undefined && bookingPayload?.lat !== null && !isNaN(Number(bookingPayload.lat))) ? Number(bookingPayload.lat) : null,
        lng: (bookingPayload?.lng !== undefined && bookingPayload?.lng !== null && !isNaN(Number(bookingPayload.lng))) ? Number(bookingPayload.lng) : null,
        status: "pending",
        paymentMethod: "cash",
        paymentStatus: "pay_after_service",
        serviceOtp: bookingPayload?.serviceOtp || String(Math.floor(1000 + Math.random() * 9000)),
        otpVerified: false,
        customerBookedName: resolvedName,
        customerBookedPhone: resolvedMobile,
        customerBookedEmail: resolvedEmail,
        customerName: resolvedName,
        customerMobile: resolvedMobile,
        customerData: {
          fullName: resolvedName,
          mobile: resolvedMobile,
          email: resolvedEmail
        },
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      await setDoc(bookingRef, confirmedPayload, { merge: true });

      setMessages((prev) =>
        prev.map((m: any) => {
          if (m.bookingData && m.bookingData.id === bookingId) {
            return {
              ...m,
              text: "✅ Cash Booking Confirmed - Pay After Service",
              bookingData: {
                ...m.bookingData,
                status: "pending",
                paymentStatus: "pay_after_service",
                paymentMethod: "cash"
              }
            };
          }
          return m;
        })
      );

      // Post AI confirmation message in chat
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: `🎉 Cash Booking Confirmed! Your booking #${bookingId.slice(-6).toUpperCase()} is registered for Pay After Service (COD). Our expert technician will arrive as scheduled.`
        }
      ]);

      setShowBookingSuccess(true);
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 }
      });
    } catch (err) {
      console.error("Error confirming Pay After Service:", err);
      alert("Failed to confirm booking. Please try again.");
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handlePayOnline = async (bookingId: string) => {
    if (isSubmittingRef.current || isSubmitting) return;
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setPhonePeError(null);

    try {
      let bookingPayload = draftBookings[bookingId];
      if (!bookingPayload) {
        const foundLocal = localBookings.find((b) => b.id === bookingId);
        if (foundLocal) {
          bookingPayload = foundLocal;
        } else {
          const foundMsg = messages.find((m: any) => m.bookingData?.id === bookingId);
          if (foundMsg && (foundMsg as any).bookingData) {
            bookingPayload = (foundMsg as any).bookingData;
          }
        }
      }

      const selectedAddress = selectedAddresses[bookingId] || bookingPayload?.address || "Indore (Zomindia Service Area)";
      const chosenSlotObj = selectedSlots[bookingId];
      const todayFullyBooked = isDateFullyBooked("today");
      const defaultDateVal = todayFullyBooked ? "tomorrow" : "today";
      const curDate = chosenSlotObj?.date || defaultDateVal;
      const curSlot = chosenSlotObj?.slot || getFirstAvailableSlot(curDate as any) || "10:00 AM - 12:00 PM";
      const scheduledSlot = `${curDate === "today" ? "Today" : "Tomorrow"}, ${curSlot}`;

      const activeUid = userProfile?.uid || auth.currentUser?.uid || "guest";
      const resolvedName = userProfile?.fullName || userProfile?.displayName || auth.currentUser?.displayName || "Customer";
      const resolvedMobile = userProfile?.mobile || userProfile?.phoneNumber || auth.currentUser?.phoneNumber || "9876543210";

      const updatedPayload = {
        ...(bookingPayload || {}),
        id: bookingId,
        customerUid: activeUid,
        userId: activeUid,
        customerId: activeUid,
        serviceType: bookingPayload?.serviceType || bookingPayload?.issueDetails || "Home Service",
        issueDetails: bookingPayload?.issueDetails || bookingPayload?.serviceType || "Home Service",
        visitationFee: bookingPayload?.visitationFee || 195,
        totalPrice: bookingPayload?.totalPrice || bookingPayload?.visitationFee || 195,
        scheduledSlot,
        address: selectedAddress,
        status: "pending_checkout",
        paymentStatus: "unpaid",
        paymentMethod: "online",
        customerName: resolvedName,
        customerMobile: resolvedMobile,
        updatedAt: Timestamp.now()
      };

      setDraftBookings((prev) => ({ ...prev, [bookingId]: updatedPayload }));

      try {
        const bookingRef = doc(db, "bookings", bookingId);
        await setDoc(bookingRef, { ...updatedPayload, createdAt: Timestamp.now() }, { merge: true });
      } catch (fErr) {
        console.warn("Firestore draft save warning:", fErr);
      }

      const amountToPay = updatedPayload.totalPrice || updatedPayload.visitationFee || 195;

      const payRes = await fetch("/api/phonepe/pay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: amountToPay,
          bookingId,
          customerUid: activeUid,
          mobileNumber: resolvedMobile
        })
      });

      let merchantTransactionId = `PHONEPE_${Date.now()}`;
      let redirectUrl = "";

      if (payRes.ok) {
        const payData = await payRes.json();
        if (payData.merchantTransactionId) merchantTransactionId = payData.merchantTransactionId;
        if (payData.redirectUrl) redirectUrl = payData.redirectUrl;
      }

      // Launch PhonePe PG Modal in Chat
      setActivePhonePePayment({
        bookingId,
        amount: amountToPay,
        serviceType: updatedPayload.serviceType,
        merchantTransactionId,
        redirectUrl
      });
    } catch (err: any) {
      console.error("Error launching PhonePe payment:", err);
      alert(`Error starting PhonePe checkout: ${err.message || err}`);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const handleExecutePhonePePayment = async () => {
    if (!activePhonePePayment) return;
    setIsConfirmingPhonePe(true);
    setPhonePeError(null);

    const { bookingId, amount, merchantTransactionId } = activePhonePePayment;
    const activeUid = userProfile?.uid || auth.currentUser?.uid || "guest";

    try {
      const verifyRes = await fetch("/api/phonepe/verify-and-confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          customerUid: activeUid,
          merchantTransactionId
        })
      });

      if (!verifyRes.ok) {
        const errJson = await verifyRes.json().catch(() => ({}));
        throw new Error(errJson.error || "PhonePe gateway confirmation failed");
      }

      // Update Firestore document to confirmed & paid
      try {
        const bookingRef = doc(db, "bookings", bookingId);
        await setDoc(
          bookingRef,
          {
            status: "confirmed",
            paymentStatus: "paid",
            paymentMethod: "online",
            paymentIntentId: merchantTransactionId,
            updatedAt: Timestamp.now()
          },
          { merge: true }
        );
      } catch (dbErr) {
        console.warn("Firestore confirm update notice:", dbErr);
      }

      // Update message state in chat
      setMessages((prev) =>
        prev.map((m: any) => {
          if (m.bookingData && m.bookingData.id === bookingId) {
            return {
              ...m,
              bookingData: {
                ...m.bookingData,
                status: "confirmed",
                paymentStatus: "paid",
                paymentMethod: "online"
              }
            };
          }
          return m;
        })
      );

      // Zomini posts confirmation message in chat
      const confirmMsg = `🎉 Payment Received! Your booking #${bookingId.slice(-6).toUpperCase()} is now CONFIRMED.`;
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: confirmMsg,
          bookingData: {
            id: bookingId,
            serviceType: activePhonePePayment.serviceType,
            visitationFee: amount,
            status: "confirmed",
            paymentStatus: "paid"
          }
        }
      ]);

      setShowBookingSuccess(true);
      confetti({
        particleCount: 150,
        spread: 80,
        origin: { y: 0.6 }
      });

      setActivePhonePePayment(null);
    } catch (err: any) {
      console.error("PhonePe execution error:", err);
      setPhonePeError(err.message || "Payment verification failed. Please try again.");
    } finally {
      setIsConfirmingPhonePe(false);
    }
  };

  const handleCancelPhonePePayment = () => {
    if (!activePhonePePayment) return;
    const { bookingId, amount, serviceType } = activePhonePePayment;

    setActivePhonePePayment(null);
    setIsConfirmingPhonePe(false);
    setPhonePeError(null);

    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: `Payment process was paused. You can complete payment anytime using the 💳 PAY NOW button on your booking summary card below, or choose Pay Cash on Delivery (COD).`,
        bookingData: draftBookings[bookingId] || {
          id: bookingId,
          serviceType: serviceType || "Home Service",
          visitationFee: amount || 195,
          status: "pending_checkout",
          paymentStatus: "unpaid"
        }
      }
    ]);
  };

  // Speech Recognition API
  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    setMicError(null);
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError(
        "Voice input is not supported in this browser. Please try Chrome!",
      );
      setTimeout(() => setMicError(null), 5000);
      return;
    }

    try {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = selectedLang;

      rec.onstart = () => {
        setIsListening(true);
      };

      rec.onerror = (e: any) => {
        console.error("Speech Recognition Error:", e);
        if (e.error === "not-allowed") {
          setMicError("Mic access blocked. Please enable permissions!");
        } else if (e.error === "no-speech") {
          setMicError("No voice detected. Please speak closer to microphone.");
        } else {
          setMicError(`Voice error: ${e.error}`);
        }
        setIsListening(false);
        setTimeout(() => setMicError(null), 5000);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      rec.onresult = (event: any) => {
        if (
          event &&
          event.results &&
          event.results[0] &&
          event.results[0][0] &&
          typeof event.results[0][0].transcript === "string"
        ) {
          const transcript = event.results[0][0].transcript.trim();
          if (transcript) {
            setInput((prev) => (prev ? prev + " " + transcript : transcript));
          }
        }
      };

      recognitionRef.current = rec;
      rec.start();
    } catch (err) {
      console.error("Error starting speech recognition:", err);
      setIsListening(false);
    }
  };

  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  useEffect(() => {
    try {
      const q = query(collection(db, "services"));
      const unsubscribe = onSnapshot(q, (snap) => {
        setAllServices(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Could not load services for AI Chat mapping:", e);
    }
  }, []);

  useEffect(() => {
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({
          behavior: "smooth",
          block: "end",
        });
      }
    };
    scrollToBottom();
    const timer = setTimeout(scrollToBottom, 60);
    return () => clearTimeout(timer);
  }, [messages, isOpen, isLoading]);

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.open === "boolean") {
        setIsOpen(customEvent.detail.open);
      } else {
        setIsOpen((prev) => !prev);
      }
    };
    window.addEventListener("toggle-ai-chat", handleToggle);
    return () => window.removeEventListener("toggle-ai-chat", handleToggle);
  }, []);

  // Sync or fetch bookings dynamically
  useEffect(() => {
    if (bookings) {
      setLocalBookings(bookings);
      return;
    }
    if (!userProfile) {
      setLocalBookings([]);
      return;
    }

    try {
      const roleField =
        userProfile.role === "partner" ? "partnerId" : "customerId";
      const q = query(
        collection(db, "bookings"),
        where(roleField, "==", userProfile.uid),
        orderBy("createdAt", "desc"),
        limit(5),
      );

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          const list = snap.docs.map(
            (doc) => ({ id: doc.id, ...doc.data() }) as Booking,
          );
          setLocalBookings(list);
        },
        (err) => {
          console.warn(
            "Silent fallback: bookings list permission in AI Chat:",
            err,
          );
        },
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn("Could not load bookings inside AI Chat:", e);
    }
  }, [userProfile?.uid, bookings]);

  // Page Refresh Recovery: Restore active checkouts/confirmations dynamically
  useEffect(() => {
    if (!userProfile || localBookings.length === 0) return;

    const recoverable = localBookings.filter(
      (b) =>
        b.status === "pending_checkout" ||
        b.status === "confirmed" ||
        b.status === "confirmed_pay_after_service"
    );

    if (recoverable.length === 0) return;

    setMessages((prev) => {
      let updated = [...prev];
      let changed = false;

      recoverable.forEach((booking) => {
        const hasMsg = updated.some(
          (m) => (m as any).bookingData?.id === booking.id
        );
        if (!hasMsg) {
          changed = true;
          const bAny = booking as any;
          if (booking.status === "pending_checkout") {
            // Restore draft details so offline/online actions work immediately
            setDraftBookings((prevDrafts) => {
              if (prevDrafts[booking.id]) return prevDrafts;
              return { ...prevDrafts, [booking.id]: booking };
            });

            updated.push({
              role: "ai",
              text: `Welcome back! You have an unfinished checkout. Please choose your payment option to complete your booking for ${bAny.serviceType || "Home Service"}:`,
              bookingData: {
                id: booking.id,
                serviceType: bAny.serviceType || "Home Service",
                visitationFee: bAny.visitationFee || 195,
                status: "pending_checkout"
              }
            });
          } else {
            updated.push({
              role: "ai",
              text:
                booking.status === "confirmed_pay_after_service"
                  ? `Welcome back! Your booking for ${bAny.serviceType || "Home Service"} has been successfully confirmed (Pay After Service).`
                  : `Welcome back! Your booking for ${bAny.serviceType || "Home Service"} is paid and fully confirmed.`,
              bookingData: {
                id: booking.id,
                serviceType: bAny.serviceType || "Home Service",
                visitationFee: bAny.visitationFee || 195,
                status: booking.status
              }
            });
          }
        }
      });

      return changed ? updated : prev;
    });
  }, [userProfile, localBookings]);

  // Keep starting message context locked and updated dynamically
  useEffect(() => {
    let startingMessage = "Welcome to Zomindia! Please log in to chat with Zomini and track your active home services.";
    if (userProfile) {
      const userName = userProfile.fullName || userProfile.displayName || "User";
      const activeBooking = localBookings.find(b => b.status !== 'completed' && b.status !== 'cancelled');
      if (activeBooking) {
        const serviceLabel = (activeBooking as any)?.serviceName || "active home";
        startingMessage = `Namaste ${userName}, your ${serviceLabel.toLowerCase()} service expert is on the way.`;
      } else {
        startingMessage = `Namaste ${userName}! I am Zomini, your Zomindia AI Assistant. How can I help you with your home services today?`;
      }
    }

    setMessages((prev) => {
      if (prev.length === 0) {
        return [{ role: "ai", text: startingMessage }];
      }
      // ONLY update the initial greeting message if conversation has NOT started (i.e. prev has only 1 message)
      if (prev.length === 1 && prev[0].role === "ai") {
        return [{ role: "ai", text: startingMessage }];
      }
      return prev;
    });
  }, [userProfile, localBookings, isPartner]);

  const handleInlineLogin = (pendingPackageText?: string) => {
    if (pendingPackageText) {
      try {
        sessionStorage.setItem("zomini_pending_booking_action", pendingPackageText);
      } catch (e) {
        console.warn(e);
      }
    }
    saveContextBeforeLogin();
    window.dispatchEvent(new CustomEvent("open-auth-modal"));
  };

  const triggerDirectBookingFlow = (actionText: string, currentUser: UserProfile) => {
    let packageName = "स्प्लिट AC सर्विस (₹770)";
    let detectedType = "AC Repair";

    const textCheck = actionText.toLowerCase();

    if (textCheck.includes("स्प्लिट") || textCheck.includes("split")) {
      packageName = "स्प्लिट AC सर्विस (₹770)";
      detectedType = "AC Repair";
    } else if (textCheck.includes("विंडो") || textCheck.includes("window")) {
      packageName = "विंडो AC सर्विस (₹599)";
      detectedType = "AC Repair";
    } else if (textCheck.includes("कम्पलीट ro") || textCheck.includes("complete ro")) {
      packageName = "कम्पलीट RO सर्विसिंग (₹649)";
      detectedType = "RO Service";
    } else if (textCheck.includes("ro") || textCheck.includes("आरओ") || textCheck.includes("फ़िल्टर") || textCheck.includes("filter")) {
      packageName = "RO फ़िल्टर सर्विस (₹399)";
      detectedType = "RO Service";
    } else if (textCheck.includes("वाशिंग") || textCheck.includes("washing")) {
      packageName = "वाशिंग मशीन सर्विस (₹499)";
      detectedType = "Washing Machine Repair";
    } else {
      packageName = actionText.replace(/⚡/g, "").trim() || "होम सर्विस पैकेज (₹195)";
    }

    let matchedService = allServices.find(s => 
      s.name?.toLowerCase().includes(detectedType.toLowerCase()) ||
      detectedType.toLowerCase().includes(s.name?.toLowerCase() || "") ||
      (detectedType.toLowerCase().includes("ac") && s.name?.toLowerCase().includes("ac")) ||
      (detectedType.toLowerCase().includes("washing") && s.name?.toLowerCase().includes("washing")) ||
      (detectedType.toLowerCase().includes("ro") && s.name?.toLowerCase().includes("ro"))
    );

    if (!matchedService) {
      matchedService = {
        id: `service_${detectedType.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
        name: detectedType,
        basePrice: 195,
        categoryId: "cat_home_service"
      };
    }

    const resolvedServiceId = matchedService.id;
    const activeUid = currentUser.uid;
    const resolvedFullName = currentUser.fullName || currentUser.displayName || "Customer";
    const resolvedMobile = currentUser.mobile || currentUser.phoneNumber || "9876543210";
    const resolvedEmail = currentUser.email || "";
    const serviceOtp = String(Math.floor(1000 + Math.random() * 9000));

    const draftBookingId = `ZOM_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const defaultDate = isDateFullyBooked("today") ? "tomorrow" : "today";
    const defaultSlot = getFirstAvailableSlot(defaultDate as any) || "10:00 AM - 12:00 PM";
    const initialScheduledSlot = `${defaultDate === "today" ? "Today" : "Tomorrow"}, ${defaultSlot}`;

    setSelectedSlots((prev) => ({
      ...prev,
      [draftBookingId]: { date: defaultDate, slot: defaultSlot }
    }));

    const bookingPayload = {
      customerUid: activeUid,
      userId: activeUid,
      customerId: activeUid,
      serviceId: resolvedServiceId,
      serviceType: packageName,
      issueDetails: packageName,
      visitationFee: 195,
      totalPrice: 195,
      status: "pending_checkout",
      paymentStatus: "unpaid",
      paymentMethod: "cash",
      scheduledSlot: initialScheduledSlot,
      scheduledAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      address: (currentUser as any)?.address || "Indore (Zomindia Service Area)",
      customerBookedEmail: resolvedEmail,
      customerBookedPhone: resolvedMobile,
      customerBookedName: resolvedFullName,
      customerName: resolvedFullName,
      customerMobile: resolvedMobile,
      customerData: {
        fullName: resolvedFullName,
        mobile: resolvedMobile,
        email: resolvedEmail
      },
      otpVerified: false,
      serviceOtp
    };

    const fullDraftBooking = { id: draftBookingId, ...bookingPayload };

    setDraftBookings((prev) => ({
      ...prev,
      [draftBookingId]: fullDraftBooking
    }));

    setMessages((prev) => [
      ...prev,
      {
        role: "ai",
        text: `बहुत बढ़िया! ${packageName} के लिए अपना स्लॉट चुनें:`,
        bookingData: fullDraftBooking,
        quickActions: undefined
      }
    ]);
  };

  // Auto-resume pending booking after login/OTP verification
  useEffect(() => {
    if (!userProfile) return;

    let pendingAction = "";
    try {
      pendingAction = sessionStorage.getItem("zomini_pending_booking_action") || "";
    } catch (e) {
      console.warn(e);
    }

    if (pendingAction) {
      try {
        sessionStorage.removeItem("zomini_pending_booking_action");
      } catch (e) {
        console.warn(e);
      }

      setIsOpen(true);
      triggerDirectBookingFlow(pendingAction, userProfile);
    }
  }, [userProfile?.uid, allServices]);

  // Direct sending helper for suggest clicks to bypass multiple fields
  const sendQueryDirectly = async (displayText: string, queryActionOverride?: string) => {
    if (isSubmitting || isLoading) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn(err);
      }
      setIsListening(false);
    }

    // Always render the exact text of the clicked button/pill on the screen
    setMessages((prev) => [...prev, { role: "user", text: displayText }]);

    const queryToSend = queryActionOverride || displayText;
    const isBookingAction =
      queryToSend.includes("बुक") ||
      queryToSend.includes("Book") ||
      queryToSend.includes("book") ||
      queryToSend.includes("⚡") ||
      displayText.includes("बुक") ||
      displayText.includes("Book") ||
      displayText.includes("book") ||
      displayText.includes("⚡");

    if (isBookingAction) {
      if (!userProfile) {
        let packageName = "स्प्लिट AC सर्विस (₹770)";
        const textCheck = (queryToSend + " " + displayText).toLowerCase();

        if (textCheck.includes("स्प्लिट") || textCheck.includes("split")) {
          packageName = "स्प्लिट AC सर्विस (₹770)";
        } else if (textCheck.includes("विंडो") || textCheck.includes("window")) {
          packageName = "विंडो AC सर्विस (₹599)";
        } else if (textCheck.includes("कम्पलीट ro") || textCheck.includes("complete ro")) {
          packageName = "कम्पलीट RO सर्विसिंग (₹649)";
        } else if (textCheck.includes("ro") || textCheck.includes("आरओ") || textCheck.includes("फ़िल्टर") || textCheck.includes("filter")) {
          packageName = "RO फ़िल्टर सर्विस (₹399)";
        } else if (textCheck.includes("वाशिंग") || textCheck.includes("washing")) {
          packageName = "वाशिंग मशीन सर्विस (₹499)";
        } else {
          packageName = displayText.replace(/⚡/g, "").trim() || "होम सर्विस पैकेज (₹195)";
        }

        try {
          sessionStorage.setItem("zomini_pending_booking_action", displayText);
        } catch (e) {
          console.warn(e);
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: `मैं आपकी ${packageName} बुक करने के लिए तैयार हूँ। कृपया सर्विस कन्फर्म करने के लिए अभी लॉगिन करें:`,
            showLoginBtn: true,
            pendingPackage: displayText
          }
        ]);
        return;
      }

      triggerDirectBookingFlow(displayText, userProfile);
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: queryToSend,
          context: {
            language:
              LANGUAGES.find((l) => l.code === selectedLang)?.name || "Hindi",
            user: userProfile
              ? {
                  name: userProfile.displayName || userProfile.fullName,
                  role: userProfile.role || "customer",
                  city: (userProfile as any).city,
                  isPartner: isPartner,
                }
              : { isPartner: isPartner, role: 'Guest' },
            bookings: localBookings?.slice(0, 5).map((b) => ({
              id: b.id,
              status: b.status,
              serviceId: b.serviceId,
              scheduledAt:
                b.scheduledAt?.toDate?.()?.toLocaleString() || b.scheduledAt,
              totalPrice: b.totalPrice,
              address: b.address,
            })),
            chatHistory: [...messages, { role: "user", text: displayText }],
          },
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const isGuest = !userProfile;
        if (data.isReadyToBook === true && !isGuest) {
          try {
            // Strictly validate serviceType against catalog services with resilient fallback
            const detectedType = data.serviceType || "AC Repair";
            let matchedService = allServices.find(s => 
              s.name?.toLowerCase().includes(detectedType.toLowerCase()) ||
              detectedType.toLowerCase().includes(s.name?.toLowerCase() || "") ||
              (detectedType.toLowerCase().includes("ac") && s.name?.toLowerCase().includes("ac")) ||
              (detectedType.toLowerCase().includes("washing") && s.name?.toLowerCase().includes("washing")) ||
              (detectedType.toLowerCase().includes("ro") && s.name?.toLowerCase().includes("ro"))
            );

            if (!matchedService) {
              matchedService = {
                id: `service_${detectedType.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
                name: detectedType,
                basePrice: 195,
                categoryId: "cat_home_service"
              };
            }

            const resolvedServiceId = matchedService.id;
            const activeUid = userProfile!.uid;
            const resolvedFullName = userProfile!.fullName || userProfile!.displayName || "Customer";
            const resolvedMobile = userProfile!.mobile || userProfile!.phoneNumber || "9876543210";
            const resolvedEmail = userProfile!.email || "";

            // Create a randomized 4-digit service OTP
            const serviceOtp = String(Math.floor(1000 + Math.random() * 9000));

            const bookingPayload = {
              customerUid: activeUid,
              userId: activeUid,
              customerId: activeUid,
              serviceId: resolvedServiceId,
              serviceType: data.issueDetails || matchedService.name,
              issueDetails: data.issueDetails || "Zomini Diagnosed Issue",
              visitationFee: 195,
              totalPrice: 195,
              status: "pending_checkout",
              paymentStatus: "unpaid",
              paymentMethod: "cash",
              scheduledAt: Timestamp.now(),
              createdAt: Timestamp.now(),
              updatedAt: Timestamp.now(),
              address: (userProfile as any)?.address || "Indore (Zomindia Service Area)",
              customerBookedEmail: resolvedEmail,
              customerBookedPhone: resolvedMobile,
              customerBookedName: resolvedFullName,
              customerName: resolvedFullName,
              customerMobile: resolvedMobile,
              customerData: {
                fullName: resolvedFullName,
                mobile: resolvedMobile,
                email: resolvedEmail
              },
              otpVerified: false,
              serviceOtp
            };

            // Pre-generate unique client-side ID for the draft booking (preventing premature DB save)
            const draftBookingId = `ZOM_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
            const fullDraftBooking = { id: draftBookingId, ...bookingPayload };

            setDraftBookings((prev) => ({
              ...prev,
              [draftBookingId]: fullDraftBooking
            }));

            setMessages((prev) => [
              ...prev,
              {
                role: "ai",
                text: data.nextQuestion || "बहुत बढ़िया! चुनी गई सर्विस के लिए अपना पसंदीदा टाइम और स्लॉट चुनें:",
                bookingData: fullDraftBooking,
                quickActions: undefined
              },
            ]);
            return;
          } catch (e) {
            console.error("Error creating draft booking card in AI Chat:", e);
          }
        }

        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: data.nextQuestion || data.reply || "I am ZOMINI, here to assist with your home services.",
            quickActions: data.quickActions || undefined
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: "ai",
            text: "I am having trouble connecting to the server. Please try again or use our helpline.",
          },
        ]);
      }
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "ai",
          text: "Something went wrong. Let me assist you via WhatsApp support instead.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (isSubmitting || !input.trim()) return;

    const userMsg = input.trim();
    setInput("");
    await sendQueryDirectly(userMsg);
  };

  return (
    // ==========================================
    // STATE GUARDRAIL ENVELOPE: Absolute defensive wrapping container to prevent code purges on Customer, Partner, and Admin
    // ==========================================
    <div id="zomi-immutable-support-root" className="contents">
      <style>{`
        @keyframes zomindia-green-pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(222, 255, 154, 0.8);
          }
          70% {
            box-shadow: 0 0 0 10px rgba(222, 255, 154, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(222, 255, 154, 0);
          }
        }
        .zomindia-glow-pulse {
          animation: zomindia-green-pulse 2s infinite;
        }
      `}</style>
      {/* 1. Visual Identity & Avatar: Closed-State Compact FAB Layout (48x48px) */}
      {!isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-4 sm:right-8 w-12 h-12 rounded-full bg-white p-0.5 border border-slate-200/80 shadow-2xl hover:scale-[1.08] active:scale-[0.92] transition-all duration-300 z-[50] flex items-center justify-center cursor-pointer select-none zomindia-glow-pulse"
          id="zomi-compact-floating-fab"
          title="Ask ZOMINI AI Assistant"
        >
          <div className="w-full h-full rounded-full relative overflow-visible">
            <ZomiAvatarSVG className="w-full h-full rounded-full" />
            <span
              id="zomi-compact-badge"
              className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border border-white flex items-center justify-center shadow"
            >
              <span className="w-1 h-1 bg-white rounded-full animate-pulse"></span>
            </span>
          </div>
        </motion.div>
      )}

      {/* 2. Visual Identity & Avatar: Open Chat Sheet bottom expansion */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 70, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 70, scale: 0.97 }}
            transition={{ duration: 0.12, ease: "easeOut" }} // Premium quick 120ms animation layout transition
            className="fixed top-12 bottom-0 right-0 sm:top-auto sm:bottom-24 sm:right-8 w-full sm:w-96 bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col z-[110] overflow-visible"
            style={
              isMobile
                ? {
                    maxHeight: "calc(100dvh - 48px)",
                    height: "calc(100dvh - 48px)",
                  }
                : { maxHeight: "600px", height: "60vh" }
            }
          >
            {/* OVERLAPPING AVATAR */}
            <div className="absolute -top-12 left-6 z-50 flex items-end select-none pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-white p-1 shadow-xl border border-slate-100 flex items-center justify-center relative active:scale-95 transition-all">
                <span className="absolute bottom-1 right-1 w-4.5 h-4.5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center shadow">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                </span>
                <ZomiAvatarSVG className="w-full h-full rounded-full" />
              </div>
            </div>

            {/* Header Controls */}
            <div className="bg-indigo-900 text-white p-4 pl-28 pr-4 flex items-center justify-between rounded-t-3xl border-b border-indigo-950 shrink-0 select-none">
              <div className="flex flex-col text-left gap-0.5">
                <h3 className="font-black text-sm leading-tight flex items-center gap-1.5 tracking-tight text-white">
                  <span className="text-white font-black">ZOMINI AI Chat</span>
                  <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded font-extrabold">
                    LIVE
                  </span>
                </h3>
                
                {/* Greeting Badge placed inside the header beautifully to avoid overlapping */}
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <span className="text-[9px] text-indigo-200 font-bold tracking-widest uppercase">
                    Support
                  </span>
                  <span className="text-indigo-400 font-bold">•</span>
                  <div className="bg-white/15 text-white px-1.5 py-0.5 rounded-md text-[9px] font-extrabold border border-white/20 shadow-sm flex items-center gap-1 backdrop-blur-sm">
                    <span className="text-cyan-400 font-black animate-pulse">•</span>
                    <span>
                      नमस्ते, <span className="text-cyan-300">{userProfile ? (userProfile.fullName || userProfile.displayName || "User") : "Guest"}</span>
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-indigo-300 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer active:scale-90"
              >
                <X size={18} />
              </button>
            </div>

            {/* Direct Channel Access Connect Bar */}
            <div
              className="bg-slate-100 border-b border-slate-200 p-3 flex flex-col gap-1.5 select-none shrink-0"
              id="chat-support-connect-bar"
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                  Fast Connect Channels
                </span>
                <span className="text-[8px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase">
                  Standard Verified
                </span>
              </div>
              <div className="flex flex-wrap gap-2 justify-center items-center w-full px-1">
                {/* Click-to-WhatsApp support */}
                <a
                  href="https://wa.me/919630234563?text=Hi%20ZOMINI%20zomindia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 min-w-[75px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-xl border border-emerald-200 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 text-[11px] font-extrabold select-none"
                  title="Connect via WhatsApp"
                  id="chat-whatsapp-btn"
                >
                  <MessageCircle size={12} className="shrink-0" />
                  <span>WhatsApp</span>
                </a>

                {/* Click-to-Call */}
                <button
                  onClick={() => {
                    if (
                      typeof (window as any).__showToast ===
                      "function"
                    ) {
                      (window as any).__showToast(
                        `Routing call via masked corporate gateway: ${CORPORATE_LANDLINE_GATEWAY}...`,
                      );
                    } else {
                      alert(
                        `[Zomindia Telephony Router]\nInitiating corporate bridge call.\nGateway number: ${CORPORATE_LANDLINE_GATEWAY}\nConnection status: Secure`,
                      );
                    }
                  }}
                  className="flex-1 min-w-[75px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-250 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 text-[11px] font-extrabold select-none"
                  title="Call Support Team"
                  id="chat-call-btn"
                >
                  <Phone size={12} className="shrink-0" />
                  <span>Call Gate</span>
                </button>

                {/* Click-to-Email */}
                <a
                  href="mailto:help@zomindia.com?subject=zomindia%20Support%20Request"
                  className="flex-1 min-w-[75px] bg-slate-50 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-xl border border-slate-200 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 text-[11px] font-extrabold select-none"
                  title="Email help@zomindia.com"
                  id="chat-email-btn"
                >
                  <Mail size={12} className="text-slate-500 shrink-0" />
                  <span>Email Help</span>
                </a>
              </div>
            </div>

            {/* Messages Scroll Panel */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {!userProfile && (
                <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl p-3 text-center mb-2 shadow-sm">
                  <p className="text-[11.5px] text-slate-700 font-bold mb-2 leading-snug">
                    You are currently browsing as a <span className="text-indigo-700 font-extrabold">Guest</span>. Speak to Zomini to diagnose issues, and log in to confirm your booking!
                  </p>
                  <button
                    onClick={() => {
                      saveContextBeforeLogin();
                      setIsOpen(false);
                      window.dispatchEvent(new CustomEvent("open-auth-modal"));
                    }}
                    className="bg-indigo-700 hover:bg-indigo-800 text-white text-[11px] font-black py-1.5 px-4 rounded-xl transition-all shadow-md active:scale-95 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>🔐 Login / Sign Up</span>
                  </button>
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                      msg.role === "user"
                        ? "bg-slate-200 text-slate-600"
                        : "bg-indigo-900 text-white"
                    }`}
                  >
                    {msg.role === "user" ? (
                      <User size={14} />
                    ) : (
                      <div className="w-full h-full p-0.5 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-200">
                        <ZomiAvatarSVG className="w-full h-full rounded-full" />
                      </div>
                    )}
                  </div>
                  <div
                    className={`p-3 rounded-2xl max-w-[78%] text-[12.5px] leading-relaxed font-medium ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm shadow-md"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm"
                    }`}
                  >
                    {/* Private masked telephone data rendered defensively */}
                    {(msg as any).bookingData ? (
                      (msg as any).bookingData.status === "pending_checkout" ? (
                        <div className="bg-slate-50 border border-indigo-200 rounded-xl p-3 shadow-md space-y-2.5 relative overflow-hidden text-left">
                          {/* Pulsing subtle background indicator */}
                          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-16 h-16 bg-indigo-100/60 rounded-full blur-xl animate-pulse"></div>

                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-[10px]">
                                ⚡
                              </div>
                              <span className="font-extrabold text-indigo-900 text-[11px] uppercase tracking-wider">डायरेक्ट बुक करें (Direct Booking)</span>
                            </div>
                            <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-1.5 py-0.5 rounded-full">
                              ₹{(msg as any).bookingData.visitationFee || 195} Inspection
                            </span>
                          </div>

                          <div className="bg-white p-2 rounded-lg border border-indigo-100 space-y-2">
                            <div>
                              <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">चुनी गई सर्विस पैकेज</p>
                              <p className="text-[11.5px] font-black text-slate-900">
                                {(msg as any).bookingData.issueDetails || (msg as any).bookingData.serviceType}
                              </p>
                            </div>

                            {/* Slot Selection */}
                            <div className="pt-1.5 border-t border-slate-100 space-y-1">
                              <span className="text-[9.5px] font-extrabold text-slate-700 block">📅 टाइम व स्लॉट चुनें (Choose Slot):</span>
                              
                              {(() => {
                                const bookingId = (msg as any).bookingData.id;
                                const todayFullyBooked = isDateFullyBooked("today");
                                const defaultDateVal = todayFullyBooked ? "tomorrow" : "today";
                                const curDate = selectedSlots[bookingId]?.date || defaultDateVal;
                                const curSlot = selectedSlots[bookingId]?.slot || getFirstAvailableSlot(curDate as any) || "";

                                return (
                                  <>
                                    <div className="grid grid-cols-2 gap-1">
                                      {["today", "tomorrow"].map((dVal) => {
                                        const isToday = dVal === "today";
                                        const isSel = curDate === dVal;
                                        const isFull = isToday && todayFullyBooked;
                                        const labelText = isToday ? (isFull ? "आज (Full)" : "आज (Today)") : "कल (Tomorrow)";

                                        return (
                                          <button
                                            key={dVal}
                                            type="button"
                                            onClick={() => {
                                              if (isToday && isFull) {
                                                updateBookingSlot(bookingId, "today", "");
                                                return;
                                              }
                                              const nextSlot = isToday
                                                ? (isSlotAvailable("today", curSlot) ? curSlot : (getFirstAvailableSlot("today") || ""))
                                                : (curSlot || "10:00 AM - 12:00 PM");
                                              updateBookingSlot(bookingId, dVal, nextSlot);
                                            }}
                                            className={`py-1 px-1.5 rounded-md text-[10px] font-extrabold transition-all border cursor-pointer ${
                                              isSel
                                                ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                                : isFull
                                                ? "bg-slate-100 text-slate-400 border-slate-200"
                                                : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                            }`}
                                          >
                                            {labelText}
                                          </button>
                                        );
                                      })}
                                    </div>

                                    {curDate === "today" && todayFullyBooked && (
                                      <p className="text-[9px] font-bold text-amber-700 bg-amber-50 p-1.5 rounded border border-amber-200 text-center leading-tight">
                                        ⚠️ आज के सभी स्लॉट समाप्त हो चुके हैं। केवल 'कल (Tomorrow)' का स्लॉट उपलब्ध है।
                                      </p>
                                    )}

                                    <div className="grid grid-cols-3 gap-1 pt-0.5">
                                      {TIME_SLOTS.map((slotObj, tIdx) => {
                                        const isAvail = isSlotAvailable(curDate as any, slotObj.label);
                                        const isSelected = isAvail && curSlot === slotObj.label;

                                        return (
                                          <button
                                            key={tIdx}
                                            type="button"
                                            disabled={!isAvail}
                                            onClick={() => {
                                              if (isAvail) {
                                                updateBookingSlot(bookingId, curDate, slotObj.label);
                                              }
                                            }}
                                            className={`py-1 px-0.5 text-center rounded-md text-[9px] font-bold border transition-all cursor-pointer ${
                                              !isAvail
                                                ? "bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed opacity-60 line-through"
                                                : isSelected
                                                ? "bg-emerald-600 text-white border-emerald-600 font-black shadow-xs ring-2 ring-emerald-300 ring-offset-1"
                                                : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300 hover:bg-slate-50"
                                            }`}
                                          >
                                            {slotObj.shortLabel}
                                          </button>
                                        );
                                      })}
                                    </div>
                                  </>
                                );
                              })()}
                            </div>

                            {/* Service Address Input */}
                            <div className="pt-1.5 border-t border-slate-100">
                              <span className="text-[9px] font-extrabold text-slate-500 uppercase tracking-wider block mb-0.5">📍 सर्विस एड्रेस (Address)</span>
                              <input
                                type="text"
                                value={selectedAddresses[(msg as any).bookingData.id] ?? ((msg as any).bookingData.address || "Indore (Zomindia Service Area)")}
                                onChange={(e) => updateBookingAddress((msg as any).bookingData.id, e.target.value)}
                                className="w-full text-[10.5px] font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-md px-2 py-1 focus:outline-none focus:border-indigo-500"
                                placeholder="Enter address in Indore"
                              />
                            </div>
                          </div>

                          {(() => {
                            const bookingId = (msg as any).bookingData.id;
                            const todayFullyBooked = isDateFullyBooked("today");
                            const defaultDateVal = todayFullyBooked ? "tomorrow" : "today";
                            const curDate = selectedSlots[bookingId]?.date || defaultDateVal;
                            const curSlot = selectedSlots[bookingId]?.slot || getFirstAvailableSlot(curDate as any) || "";
                            const isValidSlotSelected = Boolean(curSlot && isSlotAvailable(curDate as any, curSlot));

                            return (
                              <div className="flex flex-col gap-1.5 pt-0.5">
                                {!isValidSlotSelected && (
                                  <p className="text-[9.5px] font-bold text-amber-600 text-center leading-tight py-0.5">
                                    ⚠️ कृपया ऊपर से एक सक्रिय टाइम स्लॉट चुनें
                                  </p>
                                )}
                                <button
                                  onClick={() => handlePayOnline(bookingId)}
                                  disabled={isSubmitting || !isValidSlotSelected}
                                  className={`w-full bg-[#5f259f] hover:bg-[#4a1c7f] active:scale-95 text-white font-black text-[11px] py-2.5 px-3 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 group ${
                                    isSubmitting || !isValidSlotSelected ? "opacity-50 cursor-not-allowed pointer-events-none grayscale" : ""
                                  }`}
                                >
                                  <CreditCard size={14} className="text-purple-200 group-hover:scale-110 transition-transform" />
                                  <span>{isSubmitting ? "Launching PhonePe..." : "💳 Pay via PhonePe / UPI"}</span>
                                </button>
                                <button
                                  onClick={() => handlePayAfterService(bookingId)}
                                  disabled={isSubmitting || !isValidSlotSelected}
                                  className={`w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-[10.5px] py-2 px-3 rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                                    isSubmitting || !isValidSlotSelected ? "opacity-50 cursor-not-allowed pointer-events-none grayscale" : ""
                                  }`}
                                >
                                  <span>💵 Pay Cash on Delivery (COD)</span>
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      ) : (
                        <div className="bg-emerald-50 border border-emerald-300 rounded-xl p-3 shadow-sm space-y-2.5 relative overflow-hidden text-left">
                          {/* Success background glow */}
                          <div className="absolute top-0 right-0 -mr-4 -mt-4 w-12 h-12 bg-emerald-200/40 rounded-full blur-xl"></div>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center font-extrabold text-[10px]">
                                ✓
                              </div>
                              <span className="font-extrabold text-emerald-800 text-xs">
                                {(msg as any).bookingData.status === "confirmed_pay_after_service" 
                                  ? "Cash Booking Confirmed" 
                                  : "Booking Paid & Confirmed"
                                }
                              </span>
                            </div>

                            {/* Interactive PAY NOW button for unpaid or Cash bookings */}
                            {((msg as any).bookingData.status === "confirmed_pay_after_service" || (msg as any).bookingData.paymentStatus === "unpaid") && (
                              <button
                                onClick={() => handlePayOnline((msg as any).bookingData.id)}
                                disabled={isSubmitting}
                                className="bg-[#5f259f] hover:bg-[#4a1c7f] active:scale-95 text-white font-black text-[10px] px-2.5 py-1 rounded-lg shadow-sm transition-all cursor-pointer flex items-center gap-1 animate-pulse"
                              >
                                <CreditCard size={12} className="text-purple-200" />
                                <span>💳 PAY NOW</span>
                              </button>
                            )}
                          </div>

                          <div className="space-y-0.5">
                            <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Service Type</p>
                            <p className="text-[11.5px] font-black text-slate-800">{(msg as any).bookingData.serviceType}</p>
                          </div>

                          <div className="space-y-0.5">
                            <p className="text-[9px] text-emerald-600 font-bold uppercase tracking-wider">Inspection Fee</p>
                            <p className="text-[11.5px] font-black text-slate-800">
                              ₹{(msg as any).bookingData.visitationFee || 195} 
                              <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">
                                {(msg as any).bookingData.status === "confirmed_pay_after_service" || (msg as any).bookingData.paymentStatus === "unpaid" ? "Pay After Service (COD)" : "Paid via PhonePe"}
                              </span>
                            </p>
                          </div>

                          <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between gap-2">
                            <button
                              onClick={() => handleNavigateToBooking((msg as any).bookingData?.id)}
                              className="text-[10.5px] font-extrabold text-emerald-700 hover:text-emerald-800 flex items-center gap-0.5 hover:underline cursor-pointer"
                            >
                              <span>Track Status ➔</span>
                            </button>
                            <span className="text-[9px] text-emerald-600/70 font-mono">ID: #{((msg as any).bookingData.id || "").slice(-6).toUpperCase()}</span>
                          </div>
                        </div>
                      )
                    ) : (
                      <div>
                        <div>{maskPhoneNumbers(msg.text)}</div>
                        {((msg as any).showLoginBtn || (msg.role === "ai" && (msg.text.includes("लॉगिन") || msg.text.includes("Login") || msg.text.includes("login")))) && !userProfile && (
                          <div className="mt-3 pt-2 border-t border-slate-100">
                            <button
                              onClick={() => {
                                handleInlineLogin((msg as any).pendingPackage || msg.text);
                              }}
                              className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-[11.5px] py-2.5 px-3 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                            >
                              <span>🔐 अभी मोबाइल नंबर से लॉगिन करें (OTP)</span>
                            </button>
                          </div>
                        )}
                        {(msg as any).quickActions && (msg as any).quickActions.length > 0 && (
                          <div className="flex flex-col gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                            {(msg as any).quickActions.map((btn: any, bIdx: number) => (
                              <button
                                key={bIdx}
                                onClick={() => sendQueryDirectly(btn.label, btn.action)}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] font-extrabold py-2 px-3 rounded-xl transition-all shadow-sm cursor-pointer flex items-center justify-between gap-1.5"
                              >
                                <span>⚡ {btn.label}</span>
                                <span>➔</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-950 flex items-center justify-center shrink-0 shadow-sm">
                    <div className="w-full h-full p-0.5 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-200">
                      <ZomiAvatarSVG className="w-full h-full rounded-full" />
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 py-3.5 px-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Suggestion Pills Section */}
            <div className="flex gap-2 p-2 bg-slate-50 border-t border-slate-100 overflow-x-auto scrollbar-none shrink-0 select-none">
              {(selectedLang === "hi-IN" || selectedLang === "hi"
                ? [
                    {
                      label: "बुकिंग स्टेटस",
                      query: "क्या आप मेरी एक्टिव सर्विस बुकिंग का स्टेटस चेक कर सकते हैं?",
                    },
                    {
                      label: "रिफंड सहायता",
                      query: "मुझे कैंसिलेशन और रिफंड की जानकारी चाहिए।",
                    },
                    {
                      label: "शहर में उपलब्धता",
                      query: "Zomindia अभी किन-किन शहरों में उपलब्ध है?",
                    },
                  ]
                : [
                    {
                      label: "Booking Status",
                      query:
                        "Can you check my active booking status for refrigerator service?",
                    },
                    {
                      label: "Refund Help",
                      query: "I need help with refunds for my cancellation.",
                    },
                    {
                      label: "City Availability",
                      query: "Which cities are you currently available in?",
                    },
                  ]
              ).map((pill, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => sendQueryDirectly(pill.query)}
                  className="bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 text-[10px] font-black px-2.5 py-1.5 rounded-full transition-all flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer shadow-sm select-none"
                >
                  <span className="text-[11px]">💡</span>
                  <span>{pill.label}</span>
                </button>
              ))}
            </div>

            {/* Mic voice feedback error strip */}
            {micError && (
              <div className="px-4 py-1.5 bg-red-50 text-red-600 text-[10.5px] font-extrabold border-t border-red-100 flex items-center justify-between animate-pulse select-none">
                <span>{micError}</span>
                <button
                  onClick={() => setMicError(null)}
                  className="text-red-400 hover:text-red-600"
                >
                  <X size={12} />
                </button>
              </div>
            )}

            {isListening && (
              <div className="px-4 py-1.5 bg-amber-50 text-amber-800 text-[10px] font-black border-t border-amber-100 flex items-center gap-2 select-none animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                <span>
                  🎙️ LISTENING (
                  {LANGUAGES.find((l) => l.code === selectedLang)?.name}). SPEAK
                  NOW...
                </span>
              </div>
            )}

            {/* Text input controller pad */}
            <div className="p-3 bg-white border-t border-slate-100 relative shrink-0">
              {/* Dynamic scroll list overlay for localized tongues */}
              {isLangDropdownOpen && (
                <div className="absolute bottom-16 left-3 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-[120] w-48 max-h-48 overflow-y-auto">
                  <p className="text-[9px] font-black uppercase text-slate-400 px-2 py-1 tracking-wider">
                    Select Lang
                  </p>
                  <div className="scrollable-container space-y-1">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setSelectedLang(lang.code);
                          setIsLangDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center justify-between ${
                          selectedLang === lang.code
                            ? "bg-indigo-50 text-indigo-700"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span>{lang.name}</span>
                        <span className="text-[9px] bg-slate-105 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">
                          {lang.code === "en-IN" ? "Eng" : lang.code === "hi-IN" ? "हिं" : lang.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {/* Globe translation trigger button */}
                <button
                  type="button"
                  onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer select-none"
                  title="Select AI Conversation Accent"
                >
                  <Globe size={13} className="text-indigo-700" />
                  <span>
                    {selectedLang === "en-IN" ? "Eng" : selectedLang === "hi-IN" ? "हिं" : (LANGUAGES.find((l) => l.code === selectedLang)?.label || "हिं")}
                  </span>
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  disabled={isSubmitting}
                  placeholder={
                    isListening
                      ? "Listening natively..."
                      : isSubmitting
                      ? "Processing booking..."
                      : "Type or speak to ZOMINI..."
                  }
                  className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs py-2.5 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-700 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                />

                <button
                  type="button"
                  onClick={toggleListening}
                  disabled={isSubmitting}
                  className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 border cursor-pointer active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                    isListening
                      ? "bg-red-500 border-red-500 text-white animate-pulse shadow"
                      : "bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600"
                  }`}
                  title="Talk With Headset"
                >
                  <Mic size={15} />
                </button>

                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading || isSubmitting}
                  className="bg-indigo-700 text-white p-2.5 rounded-xl hover:bg-indigo-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow active:scale-95 cursor-pointer"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>

            {/* PhonePe Gateway In-Chat Modal Overlay */}
            <AnimatePresence>
              {activePhonePePayment && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 bg-slate-900/80 backdrop-blur-xs z-[130] flex items-center justify-center p-3 rounded-t-3xl sm:rounded-3xl"
                >
                  <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden border border-purple-200 flex flex-col text-left">
                    {/* PhonePe Header */}
                    <div className="bg-[#5f259f] text-white p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center font-black text-white text-xs border border-white/20 shadow-xs">
                          पे
                        </div>
                        <div>
                          <h4 className="text-xs font-black tracking-wide flex items-center gap-1">
                            PhonePe Payment Gateway
                          </h4>
                          <p className="text-[9px] text-purple-200 font-semibold flex items-center gap-1">
                            <ShieldCheck size={11} className="text-emerald-300" />
                            100% SECURE • 256-BIT ENCRYPTION
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={handleCancelPhonePePayment}
                        disabled={isConfirmingPhonePe}
                        className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
                        title="Cancel Payment"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Order Details */}
                    <div className="p-4 space-y-3 bg-gradient-to-b from-purple-50/50 to-white">
                      <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-xs space-y-2">
                        <div className="flex justify-between items-center text-[10px] text-slate-500 font-bold">
                          <span>Booking Ref</span>
                          <span className="font-mono text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            #{activePhonePePayment.bookingId.slice(-6).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex justify-between items-center pt-1 border-t border-slate-100">
                          <span className="text-[11px] font-black text-slate-800">{activePhonePePayment.serviceType}</span>
                          <span className="text-[#5f259f] font-black text-base">₹{activePhonePePayment.amount}</span>
                        </div>
                      </div>

                      {/* Payment Method Selector */}
                      <div className="space-y-1.5">
                        <label className="text-[9.5px] font-black uppercase text-slate-500 tracking-wider">Payment Options</label>
                        
                        <div className="p-2.5 rounded-xl border-2 border-[#5f259f] bg-purple-50/60 flex items-center justify-between shadow-xs cursor-pointer">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-[#5f259f] text-white flex items-center justify-center text-[10px] font-black shadow-xs">
                              UPI
                            </div>
                            <div>
                              <p className="text-[11px] font-black text-slate-900">PhonePe UPI / Instant QR</p>
                              <p className="text-[9px] text-purple-700 font-semibold">Zero transaction fee • Instant confirmation</p>
                            </div>
                          </div>
                          <div className="w-4 h-4 rounded-full bg-[#5f259f] text-white flex items-center justify-center text-[10px] font-bold">
                            ✓
                          </div>
                        </div>

                        <div className="p-2.5 rounded-xl border border-slate-200 bg-slate-50/80 opacity-60 flex items-center justify-between cursor-not-allowed">
                          <div className="flex items-center gap-2.5">
                            <CreditCard size={18} className="text-slate-500" />
                            <div>
                              <p className="text-[10px] font-bold text-slate-700">Cards / NetBanking</p>
                              <p className="text-[8.5px] text-slate-400">Supported on PhonePe Gateway</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {phonePeError && (
                        <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-rose-600 text-[10px] font-semibold text-center flex items-center justify-center gap-1">
                          <AlertCircle size={12} />
                          <span>{phonePeError}</span>
                        </div>
                      )}
                    </div>

                    {/* Footer Actions */}
                    <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex flex-col gap-2">
                      <button
                        onClick={handleExecutePhonePePayment}
                        disabled={isConfirmingPhonePe}
                        className="w-full bg-[#5f259f] hover:bg-[#4c1d82] active:scale-95 text-white font-black text-xs py-2.5 px-4 rounded-xl transition-all shadow-md shadow-purple-900/20 cursor-pointer flex items-center justify-center gap-2"
                      >
                        {isConfirmingPhonePe ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>Verifying PhonePe Gateway...</span>
                          </>
                        ) : (
                          <>
                            <Lock size={13} />
                            <span>PAY ₹{activePhonePePayment.amount} WITH PHONEPE</span>
                          </>
                        )}
                      </button>

                      <button
                        onClick={handleCancelPhonePePayment}
                        disabled={isConfirmingPhonePe}
                        className="w-full text-[10px] font-bold text-slate-500 hover:text-slate-700 py-1 cursor-pointer text-center"
                      >
                        Cancel & Pay Cash on Delivery
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Success Booking Popup Overlay */}
            <AnimatePresence>
              {showBookingSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 bg-white/95 z-[120] flex flex-col items-center justify-center p-6 text-center select-none rounded-t-3xl sm:rounded-3xl"
                >
                  {/* Animated Checkmark */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: [0, 1.2, 1] }}
                    transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
                    className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mb-3 shadow-inner relative"
                  >
                    <motion.svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={4}
                      stroke="currentColor"
                      className="w-8 h-8"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ delay: 0.3, duration: 0.4 }}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </motion.svg>
                    {/* Floating confetti-like particles */}
                    {[...Array(12)].map((_, i) => {
                      const angle = (i * 30 * Math.PI) / 180;
                      const x = Math.cos(angle) * 40;
                      const y = Math.sin(angle) * 40;
                      return (
                        <motion.div
                          key={i}
                          initial={{ x: 0, y: 0, opacity: 1, scale: 0.5 }}
                          animate={{ x, y, opacity: 0, scale: 1.2 }}
                          transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                          className={`absolute w-1.5 h-1.5 rounded-full ${
                            i % 3 === 0 ? "bg-yellow-400" : i % 3 === 1 ? "bg-emerald-500" : "bg-indigo-500"
                          }`}
                        />
                      );
                    })}
                  </motion.div>

                  <motion.h3
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.45 }}
                    className="text-base font-black text-slate-800 mb-1"
                  >
                    Booking Confirmed!
                  </motion.h3>
                  <motion.p
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.55 }}
                    className="text-[11.5px] text-slate-500 max-w-[220px] leading-relaxed mb-5"
                  >
                    We have successfully assigned an Elite Partner for your home service.
                  </motion.p>
                  
                  <motion.button
                    initial={{ y: 8, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.65 }}
                    onClick={() => setShowBookingSuccess(false)}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-[11px] py-1.5 px-5 rounded-lg shadow-md transition-all cursor-pointer"
                  >
                    View Chat
                  </motion.button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
