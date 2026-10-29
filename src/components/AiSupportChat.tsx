import React, { useState, useRef, useEffect, useMemo } from "react";
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
  ShieldCheck,
  Lock,
  Calendar,
  Clock,
  RotateCcw,
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
  addDoc,
  updateDoc,
  serverTimestamp,
  getDoc,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { CORPORATE_LANDLINE_GATEWAY } from "../lib/telephony";

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

  const [focusedBookingId, setFocusedBookingId] = useState<string | null>(null);
  const [localBookings, setLocalBookings] = useState<Booking[]>(bookings || []);
  const [allServices, setAllServices] = useState<any[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showBookingSuccess, setShowBookingSuccess] = useState(false);

  // Reschedule Self-Serve State
  const [showReschedulePicker, setShowReschedulePicker] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState<"today" | "tomorrow">("tomorrow");
  const [rescheduleSlot, setRescheduleSlot] = useState<string>("10:00 AM - 12:00 PM");
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Multilingual voice configurations
  const [selectedLang, setSelectedLang] = useState("hi-IN");
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Resolve the active / focused booking dynamically across ANY category
  const activeBookingsList = useMemo(() => {
    return (localBookings || []).filter((b) =>
      [
        "pending",
        "confirmed",
        "assigned",
        "accepted",
        "on_the_way",
        "arrived",
        "in_progress",
        "pending_acceptance",
        "confirmed_pay_after_service",
      ].includes(String(b.status || "").toLowerCase()),
    );
  }, [localBookings]);

  const focusedBooking: Booking | null = useMemo(() => {
    if (focusedBookingId) {
      const explicitMatch = localBookings.find((b) => b.id === focusedBookingId);
      if (explicitMatch) return explicitMatch;
    }
    if (activeBookingsList.length > 0) {
      return activeBookingsList[0];
    }
    return null;
  }, [focusedBookingId, localBookings, activeBookingsList]);

  // Extract Dynamic Live Booking Telemetry for ANY service category
  const bookingTelemetry = useMemo(() => {
    if (!focusedBooking) return null;
    const bAny = focusedBooking as any;
    const shortBookingId = (focusedBooking.id || "ZOM101").slice(-6).toUpperCase();
    const serviceName =
      focusedBooking.serviceName ||
      bAny.serviceType ||
      bAny.categoryName ||
      "Home Appliance Service";
    const partnerName =
      bAny.partnerName ||
      bAny.assignedPartnerName ||
      bAny.technicianName ||
      (focusedBooking.partnerId ? "Rajesh Sharma" : "Amit Singh");
    const partnerRating = bAny.partnerRating || "4.9★";
    const startOtp =
      bAny.startOtp ||
      bAny.serviceOtp ||
      bAny.otp ||
      "6330";
    const rawStatus = String(focusedBooking.status || "confirmed").toLowerCase();
    const bookingTotal =
      focusedBooking.totalPrice ??
      bAny.finalAmount ??
      bAny.amount ??
      focusedBooking.visitationFee ??
      195;
    const isPaidOnline =
      focusedBooking.paymentStatus === "paid" &&
      focusedBooking.paymentMethod !== "cash" &&
      focusedBooking.paymentMethod !== "pay_after_service";
    const paymentModeLabel = isPaidOnline
      ? "Paid Online (Verified)"
      : "Pay Cash / UPI on Visit";
    const scheduledSlot =
      bAny.scheduledSlot ||
      bAny.timeSlot ||
      "Today, Priority Slot";
    const rawAddr = focusedBooking.address as any;
    const addressText =
      typeof rawAddr === "string"
        ? rawAddr
        : rawAddr?.fullAddress ||
          rawAddr?.line1 ||
          "Indore Service Area";
    const etaText =
      rawStatus === "arrived"
        ? "Arrived at your doorstep"
        : rawStatus === "in_progress"
        ? "Service in progress"
        : rawStatus === "on_the_way"
        ? "Arriving in ~12-15 mins"
        : "Scheduled • Priority Dispatch (~15-20 mins)";

    return {
      id: focusedBooking.id,
      shortBookingId,
      serviceName,
      partnerName,
      partnerRating,
      startOtp,
      rawStatus,
      bookingTotal,
      isPaidOnline,
      paymentModeLabel,
      scheduledSlot,
      addressText,
      etaText,
    };
  }, [focusedBooking]);

  const buildDynamicGreeting = (profile?: UserProfile, telemetry?: typeof bookingTelemetry) => {
    if (!profile) {
      return "Welcome to Zomindia! Please log in to chat with Zomini and track your active home services.";
    }
    const userName = profile.fullName || profile.displayName || "Ji";
    if (telemetry) {
      return `Namaste ${userName}! Aapke ${telemetry.serviceName} (#${telemetry.shortBookingId}) ke liye ${telemetry.partnerName} assigned hain. Main aapki kya sahayata kar sakti hu?`;
    }
    return `Namaste ${userName}! Main Zomini hu, Zomindia Indore Priority Desk se. AC, RO, Home Appliance repair ya maintenance me main aapki kya sahayata kar sakti hu?`;
  };

  const [messages, setMessages] = useState<
    {
      id?: string;
      role: "ai" | "user" | "partner" | "admin";
      senderName?: string;
      text: string;
      bookingData?: any;
      quickActions?: { label: string; action: string }[];
      showLoginBtn?: boolean;
      pendingPackage?: string;
      timestamp?: string;
    }[]
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

    return [
      {
        role: "ai",
        text: buildDynamicGreeting(userProfile, null),
      },
    ];
  });

  // Update initial greeting dynamically when userProfile or active booking telemetry loads (if user hasn't sent messages yet)
  useEffect(() => {
    setMessages((prev) => {
      if (
        prev.length === 1 &&
        prev[0].role === "ai" &&
        (!prev[0].id || String(prev[0].id).startsWith("greeting_"))
      ) {
        const nextGreeting = buildDynamicGreeting(userProfile, bookingTelemetry);
        if (prev[0].text !== nextGreeting) {
          return [{ ...prev[0], role: "ai", text: nextGreeting }];
        }
      }
      return prev;
    });
  }, [userProfile?.uid, userProfile?.fullName, bookingTelemetry?.id, bookingTelemetry?.serviceName, bookingTelemetry?.partnerName]);

  const saveContextBeforeLogin = () => {
    try {
      sessionStorage.setItem("zomini_pending_chat_history", JSON.stringify(messages));
      sessionStorage.setItem("zomini_chat_open", "true");
      if (activeTab) {
        sessionStorage.setItem("zomini_saved_tab", activeTab);
      }
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
        setAllServices(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
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
  }, [messages, isOpen, isLoading, showReschedulePicker]);

  const [isPillVisible, setIsPillVisible] = useState(false);

  useEffect(() => {
    const handlePillVisibility = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.isPillVisible === "boolean") {
        setIsPillVisible(customEvent.detail.isPillVisible);
      }
    };
    window.addEventListener("zomini-pill-visibility", handlePillVisibility);
    return () => {
      window.removeEventListener("zomini-pill-visibility", handlePillVisibility);
    };
  }, []);

  useEffect(() => {
    if (activeTab && activeTab !== "home") {
      setIsPillVisible(false);
    }
  }, [activeTab]);

  // Listen for open-zomini and toggle events with optional bookingId
  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail?.bookingId) {
        setFocusedBookingId(customEvent.detail.bookingId);
      }
      if (customEvent.detail && typeof customEvent.detail.open === "boolean") {
        setIsOpen(customEvent.detail.open);
      } else {
        setIsOpen((prev) => !prev);
      }
    };

    const handleOpen = (e: Event) => {
      const customEvent = e as CustomEvent;
      const targetBookingId = customEvent.detail?.bookingId || customEvent.detail?.booking?.id;
      if (targetBookingId) {
        setFocusedBookingId(targetBookingId);
      }
      setIsOpen(true);
    };

    window.addEventListener("toggle-ai-chat", handleToggle);
    window.addEventListener("toggle-zomini-chat", handleToggle);
    window.addEventListener("open-zomini", handleOpen);
    return () => {
      window.removeEventListener("toggle-ai-chat", handleToggle);
      window.removeEventListener("toggle-zomini-chat", handleToggle);
      window.removeEventListener("open-zomini", handleOpen);
    };
  }, []);

  // Sync or fetch bookings dynamically across all categories
  useEffect(() => {
    if (bookings && bookings.length > 0) {
      setLocalBookings(bookings);
      return;
    }
    if (!userProfile) {
      setLocalBookings([]);
      return;
    }

    try {
      const isPartnerRole = userProfile.role === "partner";
      const unsubscribes: (() => void)[] = [];
      const bookingsMap = new Map<string, Booking>();

      const normalizeBooking = (id: string, data: any): Booking => {
        const activeCustomerId = data.customerUid || data.customerId || data.userId || "";
        return {
          id,
          ...data,
          customerUid: activeCustomerId,
          customerId: activeCustomerId,
          userId: activeCustomerId,
        } as Booking;
      };

      const syncAndSetBookings = () => {
        const sorted = Array.from(bookingsMap.values()).sort((a, b) => {
          const tA = (a.createdAt as any)?.seconds
            ? (a.createdAt as any).seconds * 1000
            : (a.createdAt as any)?.toMillis
            ? (a.createdAt as any).toMillis()
            : new Date(a.createdAt || 0).getTime() || 0;
          const tB = (b.createdAt as any)?.seconds
            ? (b.createdAt as any).seconds * 1000
            : (b.createdAt as any)?.toMillis
            ? (b.createdAt as any).toMillis()
            : new Date(b.createdAt || 0).getTime() || 0;
          return tB - tA;
        });
        setLocalBookings(sorted);
      };

      if (isPartnerRole) {
        const qPartner = query(
          collection(db, "bookings"),
          where("partnerId", "==", userProfile.uid),
          orderBy("createdAt", "desc"),
          limit(15),
        );
        const unsub = onSnapshot(
          qPartner,
          (snap) => {
            bookingsMap.clear();
            snap.docs.forEach((d) => {
              bookingsMap.set(d.id, normalizeBooking(d.id, d.data()));
            });
            syncAndSetBookings();
          },
          () => {},
        );
        unsubscribes.push(unsub);
      } else {
        const qCustomerUid = query(
          collection(db, "bookings"),
          where("customerUid", "==", userProfile.uid),
          orderBy("createdAt", "desc"),
          limit(15),
        );
        const unsubPrimary = onSnapshot(
          qCustomerUid,
          (snap) => {
            snap.docs.forEach((d) => {
              bookingsMap.set(d.id, normalizeBooking(d.id, d.data()));
            });
            syncAndSetBookings();
          },
          () => {},
        );
        unsubscribes.push(unsubPrimary);

        const qCustomerId = query(
          collection(db, "bookings"),
          where("customerId", "==", userProfile.uid),
          orderBy("createdAt", "desc"),
          limit(15),
        );
        const unsubLegacy = onSnapshot(
          qCustomerId,
          (snap) => {
            snap.docs.forEach((d) => {
              const existing = bookingsMap.get(d.id);
              bookingsMap.set(d.id, {
                ...(existing || {}),
                ...normalizeBooking(d.id, d.data()),
              });
            });
            syncAndSetBookings();
          },
          () => {},
        );
        unsubscribes.push(unsubLegacy);
      }

      return () => {
        unsubscribes.forEach((unsub) => unsub());
      };
    } catch (e) {
      console.warn("Could not load bookings inside AI Chat:", e);
    }
  }, [userProfile?.uid, bookings]);

  // Cross-Platform Unified Storage: Real-time Firestore listener on bookings/{bookingId}/messages
  useEffect(() => {
    const activeId = focusedBooking?.id;
    if (!activeId || !userProfile?.uid) return;

    const greetingMsg = {
      id: `greeting_${activeId}`,
      role: "ai" as const,
      text: buildDynamicGreeting(userProfile, bookingTelemetry),
      timestamp: "Just now",
    };

    try {
      const messagesRef = collection(db, "bookings", activeId, "messages");
      const q = query(messagesRef, orderBy("createdAt", "asc"));
      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          const syncedMsgs = snap.docs.map((docSnap) => {
            const d = docSnap.data();
            let role: "ai" | "user" | "partner" | "admin" = "ai";
            const isAiFlag =
              d.senderRole === "ai" ||
              d.isAi === true ||
              d.senderId === "support-agent" ||
              d.senderId === "zomini_ai";
            if (isAiFlag) {
              role = "ai";
            } else if (
              d.senderRole === "customer" ||
              d.role === "user" ||
              d.senderId === userProfile.uid
            ) {
              role = "user";
            } else if (
              d.senderRole === "partner" ||
              (focusedBooking?.partnerId && d.senderId === focusedBooking.partnerId)
            ) {
              role = "partner";
            } else if (d.senderRole === "admin") {
              role = "admin";
            } else {
              role = "ai";
            }

            let timeStr = "";
            if (d.createdAt?.toDate) {
              try {
                timeStr = d.createdAt.toDate().toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                });
              } catch (e) {}
            }

            return {
              id: docSnap.id,
              role,
              senderName:
                d.senderName ||
                (role === "partner"
                  ? "Service Partner"
                  : role === "admin"
                  ? "Indore Desk"
                  : "Zomini AI"),
              text: d.text || d.message || "",
              bookingData: d.bookingData || undefined,
              quickActions: d.quickActions || undefined,
              timestamp: timeStr || "Just now",
            };
          });

          setMessages((prev) => {
            const firstMsg = prev[0];
            const isFirstGreeting =
              firstMsg &&
              firstMsg.role === "ai" &&
              (!firstMsg.id || String(firstMsg.id).startsWith("greeting_"));

            const initialGreeting = isFirstGreeting ? firstMsg : greetingMsg;
            const localConversation = isFirstGreeting ? prev.slice(1) : prev;

            if (syncedMsgs.length === 0) {
              return [initialGreeting, ...localConversation];
            }

            // Merge synced Firestore messages with any local optimistic messages not yet present in syncedMsgs
            const pendingLocalMsgs = localConversation.filter(
              (localMsg) =>
                !syncedMsgs.some(
                  (synced) =>
                    (localMsg.id && synced.id === localMsg.id) ||
                    (synced.role === localMsg.role &&
                      synced.text.trim() === localMsg.text.trim()),
                ),
            );

            return [initialGreeting, ...syncedMsgs, ...pendingLocalMsgs];
          });
        },
        (err) => {
          console.warn("Silent fallback on booking messages listener:", err);
        },
      );
      return () => unsubscribe();
    } catch (err) {
      console.warn("Failed to attach booking messages listener:", err);
    }
  }, [focusedBooking?.id, userProfile?.uid]);

  // Persist message to bookings/{bookingId}/messages for Partner & Admin real-time sync
  const persistBookingMessage = async (
    bookingId: string,
    payload: {
      text: string;
      senderRole: "customer" | "ai";
      senderName: string;
      bookingData?: any;
      quickActions?: { label: string; action: string }[];
    },
  ) => {
    try {
      const messagesRef = collection(db, "bookings", bookingId, "messages");
      await addDoc(messagesRef, {
        text: payload.text,
        senderRole: payload.senderRole,
        senderName: payload.senderName,
        senderId:
          payload.senderRole === "customer"
            ? userProfile?.uid || "support-agent"
            : "support-agent",
        role: payload.senderRole === "customer" ? "user" : "ai",
        isAi: payload.senderRole === "ai",
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("Non-fatal: Could not persist message to Firestore subcollection:", e);
    }
  };

  // Listen for auth modal close to clear any pending booking action
  useEffect(() => {
    const handleAuthModalClosed = () => {
      try {
        sessionStorage.removeItem("zomini_pending_booking_action");
      } catch (e) {}
    };
    window.addEventListener("auth-modal-closed", handleAuthModalClosed);
    return () => window.removeEventListener("auth-modal-closed", handleAuthModalClosed);
  }, []);

  // Auto-resume pending booking after login/OTP verification by opening official BookingModal
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
      } catch (e) {}
      launchOfficialBookingModal(pendingAction);
    }
  }, [userProfile?.uid, allServices]);

  const handleNavigateToBooking = (bookingId?: string) => {
    setIsOpen(false);
    window.dispatchEvent(
      new CustomEvent("change-active-tab", {
        detail: { tab: "bookings", bookingId: bookingId || null },
      }),
    );
  };

  // Match service dynamically across ALL categories and open the official BookingModal.tsx
  const matchCatalogService = (queryText: string) => {
    const q = (queryText || "").toLowerCase();
    const keywords = [
      { keys: ["split ac", "स्प्लिट"], fallbackName: "Split AC Jet Service", price: 499, cat: "cat_ac" },
      { keys: ["window ac", "विंडो"], fallbackName: "Window AC Service", price: 399, cat: "cat_ac" },
      { keys: ["ac", "air condition", "cooling", "एसी"], fallbackName: "AC Repair & Service", price: 299, cat: "cat_ac" },
      { keys: ["ro", "water purifier", "filter", "आरओ", "फिल्टर"], fallbackName: "RO Water Purifier Service", price: 299, cat: "cat_ro" },
      { keys: ["fridge", "refrigerator", "फ्रिज"], fallbackName: "Refrigerator Repair & Checkup", price: 249, cat: "cat_appliances" },
      { keys: ["washing", "washer", "वाशिंग"], fallbackName: "Washing Machine Repair", price: 299, cat: "cat_appliances" },
      { keys: ["geyser", "water heater", "गीजर"], fallbackName: "Geyser Checkup & Repair", price: 249, cat: "cat_appliances" },
      { keys: ["tv", "television", "टीवी"], fallbackName: "LED / Smart TV Repair", price: 249, cat: "cat_appliances" },
      { keys: ["microwave", "oven", "माइक्रोवेव"], fallbackName: "Microwave Repair", price: 249, cat: "cat_appliances" },
      { keys: ["chimney", "चिमनी"], fallbackName: "Kitchen Chimney Deep Cleaning", price: 499, cat: "cat_cleaning" },
      { keys: ["electric", "switch", "wiring", "fan", "इलेक्ट्रीशियन"], fallbackName: "Expert Electrician Visit", price: 149, cat: "cat_electrician" },
      { keys: ["plumb", "tap", "leak", "pipe", "प्लंबर"], fallbackName: "Plumbing Repair Visit", price: 149, cat: "cat_plumbing" },
      { keys: ["carpent", "door", "furniture", "कारपेंटर"], fallbackName: "Carpenter Visit", price: 195, cat: "cat_carpenter" },
    ];

    // First try matching against Firestore `allServices`
    if (allServices.length > 0) {
      const directMatch = allServices.find((s) => {
        const sName = String(s.name || s.title || "").toLowerCase();
        return sName && (q.includes(sName) || sName.split(" ").some((w: string) => w.length > 2 && q.includes(w)));
      });
      if (directMatch) return directMatch;
    }

    for (const item of keywords) {
      if (item.keys.some((k) => q.includes(k))) {
        const foundInCatalog = allServices.find((s) =>
          item.keys.some((k) => String(s.name || s.title || "").toLowerCase().includes(k)),
        );
        if (foundInCatalog) return foundInCatalog;
        return {
          id: `service_${item.fallbackName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
          name: item.fallbackName,
          title: item.fallbackName,
          basePrice: item.price,
          price: item.price,
          categoryId: item.cat,
        };
      }
    }

    if (allServices.length > 0) return allServices[0];
    return {
      id: "service_home_appliance_visit",
      name: "Home Appliance Inspection & Repair",
      title: "Home Appliance Inspection & Repair",
      basePrice: 195,
      price: 195,
      categoryId: "cat_appliances",
    };
  };

  const launchOfficialBookingModal = (queryText: string) => {
    const matchedService = matchCatalogService(queryText);
    setIsOpen(false);
    window.dispatchEvent(
      new CustomEvent("open-booking-modal", {
        detail: { service: matchedService },
      }),
    );
  };

  const handleConfirmReschedule = async () => {
    if (!focusedBooking?.id || isRescheduling) return;
    setIsRescheduling(true);
    const formattedSlot = `${rescheduleDate === "today" ? "Today" : "Tomorrow"}, ${rescheduleSlot}`;
    try {
      const bookingRef = doc(db, "bookings", focusedBooking.id);
      await updateDoc(bookingRef, {
        scheduledSlot: formattedSlot,
        updatedAt: serverTimestamp(),
      });
      setShowReschedulePicker(false);
      const replyText = `✅ Done ji! Aapki booking #${bookingTelemetry?.shortBookingId} (${bookingTelemetry?.serviceName}) ko **${formattedSlot}** ke liye ₹0 reschedule fee par update kar diya gaya hai. Partner ${bookingTelemetry?.partnerName} naye slot par pahunchenge.`;
      setMessages((prev) => [...prev, { role: "ai", text: replyText }]);
      await persistBookingMessage(focusedBooking.id, {
        text: replyText,
        senderRole: "ai",
        senderName: "Zomini AI",
      });
    } catch (e) {
      console.error("Failed to reschedule booking:", e);
    } finally {
      setIsRescheduling(false);
    }
  };

  // Smart Multilingual (Hindi, Hinglish, Devanagari & English) Indore NLP Engine (0ms instant in-memory resolution)
  const getSmartIndoreNlpReply = (
    rawQuery: string,
  ): {
    text: string;
    bookingData?: any;
    quickActions?: { label: string; action: string }[];
    openReschedule?: boolean;
  } => {
    const q = rawQuery.toLowerCase().trim();
    const isDevanagari = /[\u0900-\u097F]/.test(rawQuery);
    const isHinglishOrHindi =
      isDevanagari ||
      selectedLang === "hi-IN" ||
      /\b(kab|kaha|kahan|kitna|kitne|kitni|kaise|kya|hai|hain|mera|meri|bhaiya|partner|aayega|aayenge|pahucha|pahuncha|time|badalna|kal|aana|paise|rupaye|sahi|karo|batao|bataiye|otp|code|pin|cancel|refund|bill|rate|namaste|pranam|ram|suno|bhai)\b/i.test(
        q,
      );

    const t = bookingTelemetry;
    const userName = userProfile?.fullName || userProfile?.displayName || "Ji";

    // Intent A: Greetings ("hi", "hello", "hey", "namaste", "pranam", "ram ram", "suno", "bhai", "zomini", "नमस्ते", "हेलो", "हाय")
    const isGreetingOnly =
      /^(hi+|hello+|hey+|hlo+|hlw+|namaste|namaskar|pranam|ram\s*ram|suno|bhai|zomini|zomi|नमस्ते|हेलो|हाय|प्रणाम|राम\s*राम|सुनो|जी)[\s!.,?]*$/i.test(
        q,
      ) ||
      (/\b(hi|hello|hey|namaste|pranam|ram ram|suno|bhai|zomini|नमस्ते|हेलो|हाय)\b/i.test(
        q,
      ) &&
        !/\b(partner|technician|pro|bhaiya|expert|boy|पार्टनर|कारीगर|where|kab|kaha|kahan|otp|code|pin|reschedule|time|slot|cancel|refund|bill|rate|price|cost|ac|ro|fridge|washing|geyser|tv|microwave|electric|plumb|carpent)\b/i.test(
          q,
        ));

    if (isGreetingOnly) {
      return {
        text: `Namaste ${userName}! Zomindia Priority Desk me aapka swagat hai. Main Zomini hu. ${
          t
            ? "Aapki active booking #" +
              t.shortBookingId +
              " (" +
              t.serviceName +
              ") ke liye main yahan hu. Bataiye kya sahayata karu?"
            : "AC, RO, Washing Machine ya kisi bhi Home Appliance service me main aapki kya sahayata kar sakti hu?"
        }`,
        quickActions: t
          ? [
              { label: "📍 Where is my partner?", action: "Where is my partner?" },
              { label: "📅 Reschedule Visit", action: "Reschedule Visit" },
              { label: "🔒 Start OTP", action: "Start OTP" },
            ]
          : [
              { label: "⚡ Book AC Service", action: "Book Split AC Jet Service" },
              { label: "⚡ Book RO Service", action: "Book RO Water Purifier Service" },
            ],
      };
    }

    // 1. Start OTP / Security Code Intent
    if (
      /\b(otp|code|pin|start code|security code|service code|ओटीपी|कोड|पिन)\b/i.test(q)
    ) {
      if (t) {
        return {
          text: isHinglishOrHindi
            ? `Namaste ${userName}! Aapke **${t.serviceName}** (#${t.shortBookingId}) ka Start OTP 🔒 **${t.startOtp}** hai. Doorstep par partner **${t.partnerName}** ke pahunchne aur kaam shuru karne par hi yeh OTP share karein.`
            : `Hello ${userName}! Your 4-digit Start OTP for **${t.serviceName}** (#${t.shortBookingId}) is 🔒 **${t.startOtp}**. Please share this code with partner **${t.partnerName}** only when they arrive at your doorstep.`,
        };
      }
      return {
        text: isHinglishOrHindi
          ? `Namaste ${userName}! Start OTP aapke active booking card par dikhta hai. Jab technician aapke doorstep par pahunche, tabhi 4-digit Start OTP share karein.`
          : `Your 4-digit Start OTP is displayed on your active booking card. Share it only when the verified partner arrives at your doorstep.`,
      };
    }

    // Intent B: Partner / Technician / Live ETA ("partner", "technician", "pro", "pro kahan hai", "bhaiya", "expert", "boy", "पार्टनर", "कारीगर", "where is my partner")
    if (
      /\b(partner|technician|pro|pro kahan hai|bhaiya|expert|boy|पार्टनर|कारीगर|where is my partner|where is|kab aayega|kab aayenge|kaha hai|kahan hai|kahan tak|pahucha|pahuncha|kitni der|kitna time|kidhar|late|eta|status|track|location|कब आएगा|कहाँ है|कहां है|स्टेटस|ट्रैक)\b/i.test(
        q,
      )
    ) {
      if (t) {
        return {
          text: `${t.partnerName} (${t.partnerRating}) is assigned • Status: ${t.rawStatus} • ETA: ${t.etaText} • Start OTP: 🔒 ${t.startOtp}`,
          bookingData: focusedBooking || undefined,
        };
      }
      return {
        text: isHinglishOrHindi
          ? `Namaste ${userName}! Abhi aapke account me koi active booking assigned nahi dikh rahi hai. Kya aap AC, RO ya kisi Home Appliance ke liye verified partner book karna chahenge?`
          : `Hello ${userName}! You currently don't have an active booking assigned. Would you like to book a verified Indore partner for AC, RO, or Home Appliance service?`,
        quickActions: [
          { label: "⚡ Book AC Service", action: "Book Split AC Jet Service" },
          { label: "⚡ Book RO Service", action: "Book RO Water Purifier Service" },
        ],
      };
    }

    // 3. Reschedule Visit Intent
    if (
      /\b(reschedule|time badalna|slot badalna|kal aana|change time|change slot|change date|baad me|postpone|समय बदलना|रीशेड्यूल|कल आना)\b/i.test(
        q,
      )
    ) {
      if (t) {
        return {
          text: isHinglishOrHindi
            ? `Bilkul ${userName}! Aap apni **${t.serviceName}** (#${t.shortBookingId}) booking ko **₹0 Reschedule Fee** par kisi bhi naye time slot me shift kar sakte hain. Kripya neeche apna pasandida din aur time slot chunein:`
            : `Certainly ${userName}! You can reschedule your **${t.serviceName}** (#${t.shortBookingId}) visit at **₹0 Reschedule Fee**. Please pick your preferred date and time slot below:`,
          openReschedule: true,
        };
      }
      return {
        text: isHinglishOrHindi
          ? `Zomindia par partner dispatch se pehle rescheduling **100% Free (₹0 शुल्क)** hai. Active booking par click karke aap turant naya slot chun sakte hain.`
          : `Rescheduling is **100% Free (₹0 fee)** on Zomindia before partner dispatch. Select any active booking to choose a new slot.`,
      };
    }

    // 4. Cancellation & Refund Policy Intent
    if (
      /\b(cancel|cancellation|refund|paise wapas|return|policy|रद्द|कैंसिल|रिफंड)\b/i.test(
        q,
      )
    ) {
      if (t) {
        return {
          text: isHinglishOrHindi
            ? `**Zomindia Cancellation & 100% Refund Policy (#${t.shortBookingId} • ${t.serviceName}):**\n• **₹0 Cancellation Fee:** Service start (OTP verify) hone se pehle cancel karne par koi shulk nahi lagta.\n• **100% Instant Refund:** Online paid amount (**₹${t.bookingTotal}**) cancel hote hi original UPI/Bank source ya Zomindia Wallet me turant initiate ho jata hai.\n• Agar aap sirf time badalna chahte hain, toh **Reschedule Visit** (₹0 Fee) ka upyog karein.`
            : `**Zomindia Cancellation & 100% Refund Policy (#${t.shortBookingId} • ${t.serviceName}):**\n• **₹0 Cancellation Fee:** Free cancellation anytime before the service starts (prior to Start OTP verification).\n• **100% Instant Refund:** Any online payment (**₹${t.bookingTotal}**) is refunded immediately upon cancellation.\n• Need another time instead? Use **Reschedule Visit** for ₹0 fee.`,
          openReschedule: false,
        };
      }
      return {
        text: isHinglishOrHindi
          ? `**Zomindia 100% Transparent Refund Policy:**\n• Service shuru hone se pehle cancel karne par **₹0 Cancellation Fee** hai.\n• Prepaid/UPI orders ka **100% Instant Refund** turant process kiya jata hai.`
          : `**Zomindia 100% Transparent Refund Policy:**\n• **₹0 Cancellation Fee** anytime before service start.\n• **100% Instant Refund** for all online/UPI prepaid bookings.`,
      };
    }

    // 5. Pricing / Bill / Rate Queries
    if (
      /\b(kitne paise|kitna paisa|kitna lagega|bill|rate|cost|price|charge|charges|amount|payable|fees|fee|बिल|रेट|चार्ज|कितने पैसे|प्राइस)\b/i.test(
        q,
      )
    ) {
      if (t) {
        return {
          text: isHinglishOrHindi
            ? `Aapki **${t.serviceName}** (#${t.shortBookingId}) ka transparent कुल बिल **₹${t.bookingTotal}** (${t.paymentModeLabel}) hai. Zomindia par **Zero Hidden Surge** aur **30-Day Service Guarantee** lagu hai.`
            : `The transparent total for your **${t.serviceName}** (#${t.shortBookingId}) is **₹${t.bookingTotal}** (${t.paymentModeLabel}) with **Zero Hidden Surge** and a **30-Day Service Guarantee**.`,
        };
      }
      return {
        text: isHinglishOrHindi
          ? `Zomindia Indore par expert doorstep inspection **₹149–₹195** se shuru hota hai (Zero Hidden Surge + 30-Day Service Guarantee). Aap kis appliance ki service chahte hain?`
          : `Zomindia doorstep inspection starts at **₹149–₹195** with Zero Hidden Surge and a 30-Day Service Guarantee. Which appliance service would you like to check?`,
      };
    }

    // 6. City / Service Area Availability
    if (/\b(city|cities|indore|area|available|शहर|इंदौर|उपलब्ध)\b/i.test(q)) {
      return {
        text: isHinglishOrHindi
          ? `Zomindia abhi **Indore** ke sabhi प्रमुख zones (Vijay Nagar, Palasia, Bhawarkuan, Rajendra Nagar, Rau, Nipania, Sudama Nagar, Airport Road, Super Corridor) me 30-Min Priority Dispatch ke sath active hai!`
          : `Zomindia is actively serving all major zones across **Indore** (Vijay Nagar, Palasia, Bhawarkuan, Rajendra Nagar, Rau, Nipania, Sudama Nagar, Super Corridor) with 30-Min Priority Dispatch!`,
      };
    }

    // 7. Specific Appliance / Service Inquiry -> Instant response with 1-tap BookingModal trigger
    if (
      /\b(ac|split|window|cooling|ro|water purifier|filter|fridge|refrigerator|washing|washer|geyser|heater|tv|television|microwave|oven|chimney|electric|switch|fan|plumb|tap|leak|carpent|door|एसी|आरओ|फ्रिज|वाशिंग|गीजर|टीवी|माइक्रोवेव|चिमनी|इलेक्ट्रीशियन|प्लंबर|कारपेंटर)\b/i.test(
        q,
      )
    ) {
      const matched = matchCatalogService(q);
      const svcTitle = matched.name || matched.title || "Home Appliance Service";
      const svcPrice = matched.basePrice || matched.price || 195;
      return {
        text: isHinglishOrHindi
          ? `Namaste ${userName}! **${svcTitle}** ke liye hamare background-verified Indore experts **₹${svcPrice}** (Transparent Rate • 30-Day Guarantee) par uplabdh hain. Aap neeche button daba kar turant slot book kar sakte hain:`
          : `Hello ${userName}! Our background-verified Indore pros are available for **${svcTitle}** starting at **₹${svcPrice}** (Transparent Rate • 30-Day Guarantee). Tap below to book your slot immediately:`,
        quickActions: [
          {
            label: `⚡ Book ${svcTitle} (₹${svcPrice})`,
            action: `Book ${svcTitle}`,
          },
        ],
      };
    }

    // Intent C: Default Smart Fallback (Guaranteed 0ms instant helpful reply guiding to 1-Tap Call Desk, WhatsApp Help, or booking assistance)
    if (t) {
      return {
        text: isHinglishOrHindi
          ? `Namaste ${userName}! Main aapki active booking **#${t.shortBookingId} (${t.serviceName})** me turant sahayata ke liye yahan hu.\n• **Assigned Partner:** ${t.partnerName} (${t.partnerRating}) • ${t.etaText}\n• **Start OTP:** 🔒 ${t.startOtp}\n\nTurant executive se baat karne ke liye upar **Call Desk** ya **WhatsApp Help** par tap karein, ya neeche self-serve option chunein:`
          : `Hello ${userName}! I am here to help with your active booking **#${t.shortBookingId} (${t.serviceName})**.\n• **Assigned Partner:** ${t.partnerName} (${t.partnerRating}) • ${t.etaText}\n• **Start OTP:** 🔒 ${t.startOtp}\n\nFor immediate human assistance, tap **Call Desk** or **WhatsApp Help** at the top, or choose a quick option below:`,
        quickActions: [
          { label: "📍 Where is my partner?", action: "Where is my partner?" },
          { label: "📅 Reschedule Visit", action: "Reschedule Visit" },
          { label: "🛡️ Cancellation & Refund", action: "Cancellation & Refund" },
        ],
      };
    }

    return {
      text: isHinglishOrHindi
        ? `Namaste ${userName}! Main Zomini hu, Zomindia Indore Priority Desk se. Aap upar diye gaye **1-Tap Call Desk** ya **WhatsApp Help** se turant hamari team se jud sakte hain, ya neeche 1-tap me apni Home Appliance service book kar sakte hain:`
        : `Hello ${userName}! I am Zomini from the Zomindia Indore Priority Desk. You can connect immediately with our team via **Call Desk** or **WhatsApp Help** above, or book a verified home service below:`,
      quickActions: [
        { label: "⚡ Book AC Service", action: "Book Split AC Jet Service" },
        { label: "⚡ Book RO Service", action: "Book RO Water Purifier Service" },
        { label: "⚡ Book Appliance Repair", action: "Book Home Appliance Inspection" },
      ],
    };
  };

  // Speech Recognition API with Native Android / Browser Microphone Permission Trigger
  const toggleListening = async () => {
    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (e) {}
      }
      setIsListening(false);
      return;
    }

    setMicError(null);

    // Explicitly trigger native Android OS / WebView runtime microphone permission prompt
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Immediately release media tracks so SpeechRecognition can claim the hardware microphone
        stream.getTracks().forEach((track) => track.stop());
      } catch (permErr: any) {
        setMicError(
          "Mic access blocked. Please allow Microphone permission in App Settings!",
        );
        setIsListening(false);
        setTimeout(() => setMicError(null), 5000);
        return;
      }
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError(
        "Voice input is not supported in this browser. Please type your query below!",
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
        if (e.error === "not-allowed" || e.error === "service-not-allowed") {
          setMicError(
            "Mic access blocked. Please enable Microphone permissions in device settings!",
          );
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

  const handleInlineLogin = (pendingPackageText?: string) => {
    if (pendingPackageText) {
      try {
        sessionStorage.setItem("zomini_pending_booking_action", pendingPackageText);
      } catch (e) {}
    }
    saveContextBeforeLogin();
    window.dispatchEvent(new CustomEvent("open-auth-modal"));
  };

  // Direct sending helper for suggest clicks & chat input
  const sendQueryDirectly = async (displayText: string, queryActionOverride?: string) => {
    if (isLoading) return;

    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {}
      setIsListening(false);
    }

    const nowTimeStr = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    setMessages((prev) => [
      ...prev,
      {
        id: `local_user_${Date.now()}`,
        role: "user",
        senderName: userProfile?.fullName || userProfile?.displayName || "Customer",
        text: displayText,
        timestamp: nowTimeStr,
      },
    ]);

    if (focusedBooking?.id && userProfile) {
      persistBookingMessage(focusedBooking.id, {
        text: displayText,
        senderRole: "customer",
        senderName: userProfile.fullName || userProfile.displayName || "Customer",
      });
    }

    const queryToSend = queryActionOverride || displayText;
    const cleanQ = (queryToSend + " " + displayText).toLowerCase();

    // 1. Check if query references a specific booking code (#ABC123)
    const matchedByCode = localBookings.find((b) => {
      const fullId = (b.id || "").toLowerCase();
      const shortId = (b.id || "").slice(-6).toLowerCase();
      return (shortId && cleanQ.includes(shortId)) || (fullId && cleanQ.includes(fullId));
    });

    if (matchedByCode) {
      setFocusedBookingId(matchedByCode.id);
    }

    // 2. Direct Service Booking Intent -> Launch Official BookingModal.tsx
    const isBookingAction =
      queryToSend.toLowerCase().startsWith("book ") ||
      queryToSend.toLowerCase().includes(" book ") ||
      queryToSend.includes("बुक") ||
      queryToSend.includes("⚡") ||
      displayText.toLowerCase().startsWith("book ") ||
      displayText.toLowerCase().includes(" book ") ||
      displayText.includes("बुक") ||
      displayText.includes("⚡");

    if (isBookingAction) {
      if (!userProfile) {
        try {
          sessionStorage.setItem("zomini_pending_booking_action", displayText);
        } catch (e) {}
        setMessages((prev) => [
          ...prev,
          {
            id: `local_ai_${Date.now()}`,
            role: "ai",
            senderName: "Zomini AI",
            text: `Main aapki service book karne ke liye taiyar hu! Kripya booking confirm karne ke liye mobile OTP se login karein:`,
            showLoginBtn: true,
            pendingPackage: displayText,
            timestamp: nowTimeStr,
          },
        ]);
        return;
      }

      launchOfficialBookingModal(queryToSend);
      return;
    }

    // 3. Smart Multilingual Indore NLP Engine (0ms instant in-memory resolution for Greetings, Partner, ETA, OTP, Reschedule, Cancel/Refund, Pricing, & Default Fallback)
    const localNlpReply = getSmartIndoreNlpReply(queryToSend);
    if (localNlpReply.openReschedule) {
      setShowReschedulePicker(true);
    }

    setMessages((prev) => [
      ...prev,
      {
        id: `local_ai_${Date.now()}`,
        role: "ai",
        senderName: "Zomini AI",
        text: localNlpReply.text,
        bookingData: localNlpReply.bookingData,
        quickActions: localNlpReply.quickActions,
        timestamp: nowTimeStr,
      },
    ]);

    if (focusedBooking?.id && userProfile) {
      persistBookingMessage(focusedBooking.id, {
        text: localNlpReply.text,
        senderRole: "ai",
        senderName: "Zomini AI",
        bookingData: localNlpReply.bookingData,
        quickActions: localNlpReply.quickActions,
      });
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg = input.trim();
    setInput("");
    await sendQueryDirectly(userMsg);
  };

  return (
    // ==========================================
    // STATE GUARDRAIL ENVELOPE: Absolute defensive wrapping container to prevent code purges on Customer, Partner, and Admin
    // ==========================================
    <div id="zomi-immutable-support-root" className="pointer-events-none">
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
          className={`pointer-events-auto fixed ${
            isPillVisible
              ? "bottom-[128px] sm:bottom-[132px] right-4 sm:right-6"
              : "bottom-20 sm:bottom-22 right-4 sm:right-6"
          } w-12 h-12 rounded-full bg-white p-0.5 border border-slate-200/80 shadow-2xl hover:scale-[1.08] active:scale-[0.92] transition-all duration-300 ease-out z-40 flex items-center justify-center cursor-pointer select-none zomindia-glow-pulse`}
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
            className="pointer-events-auto fixed top-12 bottom-0 right-0 sm:top-auto sm:bottom-24 sm:right-8 w-full sm:w-96 bg-white border-t sm:border border-slate-200 rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col z-[110] overflow-visible"
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
            <div className="bg-indigo-900 text-white p-3.5 pl-28 pr-4 flex items-center justify-between rounded-t-3xl border-b border-indigo-950 shrink-0 select-none">
              <div className="flex flex-col text-left gap-0.5 min-w-0">
                <h3 className="font-black text-sm leading-tight flex items-center gap-1.5 tracking-tight text-white">
                  <span className="text-white font-black truncate">Zomini Priority Support</span>
                  <span className="text-[9px] bg-emerald-500 text-white px-1.5 py-0.5 rounded font-black uppercase tracking-wider shrink-0">
                    Active • Indore Desk
                  </span>
                </h3>

                {/* Dynamic Context Pill or Greeting Badge */}
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  {bookingTelemetry ? (
                    <div className="bg-white/15 text-white px-2 py-0.5 rounded-md text-[10px] font-extrabold border border-white/20 shadow-xs flex items-center gap-1.5 backdrop-blur-xs max-w-full truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                      <span className="text-amber-300 font-mono font-black">
                        #{bookingTelemetry.shortBookingId}
                      </span>
                      <span className="text-indigo-200">•</span>
                      <span className="truncate font-bold text-white">
                        {bookingTelemetry.serviceName}
                      </span>
                      <span className="text-indigo-200">•</span>
                      <span className="text-emerald-300 font-black shrink-0">
                        ₹{bookingTelemetry.bookingTotal}
                      </span>
                    </div>
                  ) : (
                    <div className="bg-white/15 text-white px-2 py-0.5 rounded-md text-[9.5px] font-extrabold border border-white/20 shadow-xs flex items-center gap-1 backdrop-blur-xs">
                      <span className="text-cyan-400 font-black animate-pulse">•</span>
                      <span>
                        नमस्ते,{" "}
                        <span className="text-cyan-300">
                          {userProfile
                            ? userProfile.fullName || userProfile.displayName || "User"
                            : "Guest"}
                        </span>
                      </span>
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => {
                  setIsOpen(false);
                  try {
                    sessionStorage.removeItem("zomini_pending_booking_action");
                  } catch (e) {}
                }}
                className="text-indigo-300 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer active:scale-90 shrink-0"
              >
                <X size={18} />
              </button>
            </div>

            {/* 1-Tap Quick Action Hub (Call Desk & WhatsApp Help) */}
            <div
              className="bg-slate-100 border-b border-slate-200 px-3 py-2.5 flex flex-col gap-2 select-none shrink-0"
              id="chat-support-connect-bar"
            >
              <div className="flex items-center justify-between gap-2">
                <a
                  href={`tel:${CORPORATE_LANDLINE_GATEWAY}`}
                  className="flex-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 px-3 py-2 rounded-xl border border-indigo-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-[11px] font-black select-none shadow-2xs"
                  title="Call Zomindia Priority Desk"
                  id="chat-call-btn"
                >
                  <Phone size={13} className="shrink-0 text-indigo-700" />
                  <span>Call Desk</span>
                </a>

                <a
                  href={`https://wa.me/919630234563?text=${encodeURIComponent(
                    bookingTelemetry
                      ? `Namaste Zomindia Priority Support! Need help with Booking #${bookingTelemetry.shortBookingId} (${bookingTelemetry.serviceName} - ₹${bookingTelemetry.bookingTotal}).`
                      : "Namaste Zomindia Priority Support! I need assistance with home appliance services in Indore.",
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-xl border border-emerald-700 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 text-[11px] font-black select-none shadow-2xs"
                  title="WhatsApp Priority Help"
                  id="chat-whatsapp-btn"
                >
                  <MessageCircle size={13} className="shrink-0" />
                  <span>WhatsApp Help</span>
                </a>
              </div>

              {/* Active Booking Live Telemetry Strip & Booking Switcher */}
              {bookingTelemetry && (
                <div className="bg-white rounded-xl px-2.5 py-1.5 border border-slate-200/90 flex items-center justify-between gap-2 text-[10px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping shrink-0"></span>
                    <span className="font-bold text-slate-700 truncate">
                      {bookingTelemetry.partnerName} ({bookingTelemetry.partnerRating}) •{" "}
                      <span className="text-indigo-700 font-black">{bookingTelemetry.etaText}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="bg-amber-50 text-amber-900 border border-amber-200 px-1.5 py-0.5 rounded font-mono font-black text-[9.5px]">
                      OTP: {bookingTelemetry.startOtp}
                    </span>
                    {activeBookingsList.length > 1 && (
                      <select
                        value={focusedBooking?.id || ""}
                        onChange={(e) => setFocusedBookingId(e.target.value)}
                        className="bg-slate-100 text-slate-800 font-bold text-[9.5px] rounded px-1 py-0.5 border border-slate-300 focus:outline-none"
                        title="Switch Active Booking"
                      >
                        {activeBookingsList.map((b) => (
                          <option key={b.id} value={b.id}>
                            #{(b.id || "").slice(-6).toUpperCase()} • {b.serviceName || "Service"}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Messages Scroll Panel */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50">
              {!userProfile && (
                <div className="bg-indigo-50/80 border border-indigo-100 rounded-2xl p-3 text-center mb-2 shadow-xs">
                  <p className="text-[11.5px] text-slate-700 font-bold mb-2 leading-snug">
                    You are currently browsing as a{" "}
                    <span className="text-indigo-700 font-extrabold">Guest</span>. Speak to Zomini
                    to diagnose issues, and log in to confirm or track your bookings!
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
                  key={msg.id || idx}
                  className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs ${
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
                    className={`p-3 rounded-2xl max-w-[80%] text-[12.5px] leading-relaxed font-medium ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white rounded-tr-sm shadow-md"
                        : "bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-xs"
                    }`}
                  >
                    {msg.role !== "user" && msg.senderName && msg.senderName !== "Zomini AI" && (
                      <div className="text-[9.5px] font-black uppercase tracking-wider text-indigo-700 mb-1">
                        {msg.senderName}
                      </div>
                    )}

                    <div className="whitespace-pre-line">{maskPhoneNumbers(msg.text)}</div>

                    {/* Live Booking Summary Card inside message */}
                    {msg.bookingData && (() => {
                      const rawB = msg.bookingData || {};
                      const liveB = rawB.id ? localBookings.find((b) => b.id === rawB.id) : null;
                      const b = (liveB ? { ...rawB, ...liveB } : rawB) as Booking;
                      const serviceTitle = b.serviceName || (b as any).serviceType || "Home Service";
                      const shortId = (b.id || "").slice(-6).toUpperCase();
                      const finalPayable = b.totalPrice ?? b.visitationFee ?? 195;

                      return (
                        <div className="mt-2.5 bg-emerald-50/90 border border-emerald-300/90 rounded-xl p-2.5 space-y-2 text-left">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-emerald-950 text-[11px]">
                              #{shortId} • {serviceTitle}
                            </span>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-200/80 text-emerald-900">
                              {String(b.status || "CONFIRMED").replace(/_/g, " ")}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] pt-1 border-t border-emerald-200/70">
                            <span className="font-bold text-slate-700">Total: ₹{finalPayable}</span>
                            <button
                              onClick={() => handleNavigateToBooking(b.id)}
                              className="text-[10.5px] font-black text-emerald-800 hover:underline cursor-pointer"
                            >
                              View in My Bookings ➔
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {(msg.showLoginBtn ||
                      (msg.role === "ai" &&
                        (msg.text.includes("लॉगिन") ||
                          msg.text.includes("Login") ||
                          msg.text.includes("login")))) &&
                      !userProfile && (
                        <div className="mt-3 pt-2 border-t border-slate-100">
                          <button
                            onClick={() => {
                              handleInlineLogin(msg.pendingPackage || msg.text);
                            }}
                            className="w-full bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-[11.5px] py-2.5 px-3 rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
                          >
                            <span>🔐 अभी मोबाइल नंबर से लॉगिन करें (OTP)</span>
                          </button>
                        </div>
                      )}

                    {msg.quickActions && msg.quickActions.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-2.5 pt-2 border-t border-slate-100">
                        {msg.quickActions.map((btn: any, bIdx: number) => (
                          <button
                            key={bIdx}
                            onClick={() => sendQueryDirectly(btn.label, btn.action)}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white text-[11px] font-extrabold py-2 px-3 rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-between gap-1.5"
                          >
                            <span>⚡ {btn.label}</span>
                            <span>➔</span>
                          </button>
                        ))}
                      </div>
                    )}

                    {msg.timestamp && (
                      <div
                        className={`text-[9px] mt-1 font-semibold ${
                          msg.role === "user" ? "text-blue-100 text-right" : "text-slate-400"
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {/* Self-Serve Inline Reschedule Slot Picker */}
              {showReschedulePicker && bookingTelemetry && (
                <div className="bg-white border border-indigo-200 rounded-2xl p-3.5 shadow-sm space-y-2.5 text-left">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-indigo-950 flex items-center gap-1.5">
                      <Calendar size={13} className="text-indigo-600" />
                      <span>Reschedule #{bookingTelemetry.shortBookingId} (₹0 Fee)</span>
                    </span>
                    <button
                      onClick={() => setShowReschedulePicker(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(["today", "tomorrow"] as const).map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setRescheduleDate(d)}
                        className={`py-1.5 px-2 rounded-lg text-[10.5px] font-black border cursor-pointer transition-all ${
                          rescheduleDate === d
                            ? "bg-indigo-600 text-white border-indigo-600"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {d === "today" ? "Today (आज)" : "Tomorrow (कल)"}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {TIME_SLOTS.map((slotObj) => (
                      <button
                        key={slotObj.label}
                        type="button"
                        onClick={() => setRescheduleSlot(slotObj.label)}
                        className={`py-1.5 px-1 rounded-lg text-[9.5px] font-bold border cursor-pointer transition-all ${
                          rescheduleSlot === slotObj.label
                            ? "bg-emerald-600 text-white border-emerald-600 font-black"
                            : "bg-slate-50 text-slate-700 border-slate-200"
                        }`}
                      >
                        {slotObj.shortLabel}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={handleConfirmReschedule}
                    disabled={isRescheduling}
                    className="w-full bg-indigo-700 hover:bg-indigo-800 text-white font-black text-[11px] py-2 rounded-xl shadow-xs cursor-pointer active:scale-95 transition-all"
                  >
                    {isRescheduling ? "Updating Slot..." : "Confirm New Slot (₹0 Fee)"}
                  </button>
                </div>
              )}

              {isLoading && (
                <div className="flex gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-indigo-950 flex items-center justify-center shrink-0 shadow-xs">
                    <div className="w-full h-full p-0.5 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-200">
                      <ZomiAvatarSVG className="w-full h-full rounded-full" />
                    </div>
                  </div>
                  <div className="bg-white border border-slate-200 py-3.5 px-4 rounded-2xl rounded-tl-sm shadow-xs flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Smart Self-Serve Quick Chips */}
            <div className="flex gap-1.5 px-3 py-2 bg-slate-50 border-t border-slate-200/80 overflow-x-auto scrollbar-none shrink-0 select-none">
              {(bookingTelemetry
                ? [
                    {
                      label: "Where is my partner?",
                      query: "Where is my partner?",
                    },
                    {
                      label: "Reschedule Visit",
                      query: "Reschedule Visit",
                    },
                    {
                      label: "Cancellation & Refund",
                      query: "Cancellation & Refund",
                    },
                    {
                      label: "Start OTP",
                      query: "Mera Start OTP kya hai?",
                    },
                  ]
                : selectedLang === "hi-IN" || selectedLang === "hi"
                ? [
                    {
                      label: "Where is my partner?",
                      query: "Mera service partner kaha hai?",
                    },
                    {
                      label: "Reschedule Visit",
                      query: "Mujhe apni booking ka time badalna hai",
                    },
                    {
                      label: "Cancellation & Refund",
                      query: "Cancellation aur refund policy kya hai?",
                    },
                  ]
                : [
                    {
                      label: "Where is my partner?",
                      query: "Where is my partner?",
                    },
                    {
                      label: "Reschedule Visit",
                      query: "Reschedule Visit",
                    },
                    {
                      label: "Cancellation & Refund",
                      query: "Cancellation & Refund",
                    },
                  ]
              ).map((pill, pIdx) => (
                <button
                  key={pIdx}
                  type="button"
                  onClick={() => sendQueryDirectly(pill.label, pill.query)}
                  className="bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-slate-700 hover:text-indigo-700 text-[10px] font-black px-2.5 py-1.5 rounded-full transition-all flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer shadow-2xs select-none"
                >
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
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">
                          {lang.code === "en-IN" ? "Eng" : lang.code === "hi-IN" ? "हिं" : lang.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer select-none"
                  title="Select AI Conversation Accent"
                >
                  <Globe size={13} className="text-indigo-700" />
                  <span>
                    {selectedLang === "en-IN"
                      ? "Eng"
                      : selectedLang === "hi-IN"
                      ? "हिं"
                      : LANGUAGES.find((l) => l.code === selectedLang)?.label || "हिं"}
                  </span>
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={
                    isListening
                      ? "Listening natively..."
                      : "Ask Zomini in Hindi, Hinglish or English..."
                  }
                  className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs py-2.5 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-700 font-semibold"
                />

                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 border cursor-pointer active:scale-95 ${
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
                  disabled={!input.trim() || isLoading}
                  className="bg-indigo-700 text-white p-2.5 rounded-xl hover:bg-indigo-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow active:scale-95 cursor-pointer"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>

            {/* Success Booking Popup Overlay */}
            <AnimatePresence>
              {showBookingSuccess && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="absolute inset-0 bg-white/95 z-[120] flex flex-col items-center justify-center p-6 text-center select-none rounded-t-3xl sm:rounded-3xl"
                >
                  <h3 className="text-base font-black text-slate-800 mb-1">
                    Booking Updated!
                  </h3>
                  <button
                    onClick={() => setShowBookingSuccess(false)}
                    className="bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black text-[11px] py-1.5 px-5 rounded-lg shadow-md transition-all cursor-pointer mt-3"
                  >
                    Back to Chat
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
