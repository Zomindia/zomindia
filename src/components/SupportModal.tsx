import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  X,
  Send,
  Phone,
  MessageCircle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  MapPin,
  Calendar,
  Sparkles,
  User,
  ChevronRight,
  RotateCcw,
  Star,
  Lock,
} from "lucide-react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Booking, Service, UserProfile, PartnerProfile, SupportTicket } from "../types";
import { CORPORATE_LANDLINE_GATEWAY } from "../lib/telephony";
import { formatTime12Hour } from "../utils/formatTime";

export interface SupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  service?: Service;
  partnerUser?: UserProfile | null;
  partnerDetail?: PartnerProfile | null;
  customerProfile?: UserProfile | null;
  activeTicket?: SupportTicket | null;
  onTicketCreated?: (ticket: SupportTicket) => void;
  onReschedule?: (bookingId: string, newDate: string, newTime: string) => void;
  onCancelBooking?: (booking: Booking) => void;
}

interface ChatItem {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: any;
  isAi?: boolean;
}

type SelfServeTab = "none" | "partner_status" | "reschedule" | "cancellation";

const QUICK_TIME_SLOTS = [
  { label: "10:00 AM", value: "10:00" },
  { label: "12:00 PM", value: "12:00" },
  { label: "02:00 PM", value: "14:00" },
  { label: "04:00 PM", value: "16:00" },
  { label: "06:00 PM", value: "18:00" },
];

// Hinglish / Hindi conversational token dictionary for language detection
const HINGLISH_TOKENS = [
  "kab",
  "kaha",
  "kahan",
  "aayega",
  "ayega",
  "aayenge",
  "pahucha",
  "pahuncha",
  "pahuche",
  "kitni",
  "kitna",
  "kitne",
  "der",
  "kidhar",
  "bhaiya",
  "bhai",
  "kya",
  "hai",
  "hain",
  "ho",
  "mera",
  "meri",
  "mere",
  "aap",
  "apka",
  "aapka",
  "badalna",
  "kal",
  "parso",
  "aaj",
  "nahi",
  "nhi",
  "chahiye",
  "band",
  "mat",
  "aao",
  "aana",
  "paise",
  "paisa",
  "rupya",
  "rupaye",
  "wapas",
  "baat",
  "karo",
  "karna",
  "karein",
  "sampark",
  "kharab",
  "theek",
  "thik",
  "sikayat",
  "shikayat",
  "dikkat",
  "namaste",
  "pranam",
  "ram",
  "suno",
  "ji",
  "batao",
  "bataiye",
  "madad",
  "sahayata",
  "abhi",
  "tak",
  "kyu",
  "kyun",
  "kaise",
  "kaun",
  "ghar",
  "kb",
  "kha",
  "krna",
  "kro",
  "cancle",
];

// Intent Token Arrays
const ETA_PATTERNS = [
  "kab aayega",
  "kaha hai",
  "kahan hai",
  "kahan tak pahucha",
  "pahuncha",
  "pahucha",
  "kitni der",
  "kitna time",
  "kidhar",
  "late",
  "bhaiya kahan",
  "technician",
  "pro",
  "specialist",
  "where",
  "eta",
  "status",
  "location",
  "कब आएगा",
  "कहाँ पहुंचे",
  "किधर",
  "कहाँ है",
];

const OTP_PATTERNS = [
  "start otp",
  "start code",
  "otp",
  "code",
  "pin",
  "password",
  "ओटीपी",
  "कोड",
  "पिन",
];

const RESCHEDULE_PATTERNS = [
  "time badalna",
  "kal aana",
  "parso aana",
  "aaj nahi",
  "der se",
  "change time",
  "timing",
  "slot",
  "postpone",
  "reschedule",
  "shift",
  "समय बदलना",
  "कल",
  "परसों",
];

const CANCEL_PATTERNS = [
  "nahi chahiye",
  "order band",
  "mat aao",
  "paise wapas",
  "cancel",
  "cancle",
  "refund",
  "return",
  "रद्द",
  "रिफंड",
  "कैंसिल",
];

const CALL_PATTERNS = [
  "baat karo",
  "customer care",
  "call",
  "phone",
  "number",
  "sampark",
  "desk",
  "कॉल",
  "बात",
  "फोन",
];

const PRICE_PATTERNS = [
  "kitne paise",
  "kitna rupya",
  "bill",
  "price",
  "rate",
  "cost",
  "total",
  "cash",
  "online",
  "रुपये",
  "पैसे",
  "बिल",
];

const WARRANTY_PATTERNS = [
  "theek nahi",
  "warranty",
  "kharab",
  "problem",
  "sikayat",
  "shikayat",
  "issue",
  "damage",
  "rework",
  "वॉरंटी",
  "शिकायत",
  "खराब",
];

const GREETING_PATTERNS = [
  "ram ram",
  "namaste",
  "pranam",
  "hello",
  "hey",
  "suno",
  "bhai",
  "hi",
  "नमस्ते",
  "प्रणाम",
  "हेलो",
];

const matchesIntent = (queryText: string, patterns: string[]): boolean => {
  return patterns.some((pattern) => {
    // Multi-word or Devanagari phrase match
    if (pattern.includes(" ") || /[\u0900-\u097F]/.test(pattern)) {
      return queryText.includes(pattern);
    }
    // Whole-word or prefix match for ASCII keywords
    const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`(?:^|\\s|[?.!,])${escaped}(?:$|\\s|[?.!,])`, "i");
    return regex.test(queryText) || queryText.includes(pattern);
  });
};

const detectHindiOrHinglish = (queryText: string): boolean => {
  if (/[\u0900-\u097F]/.test(queryText)) {
    return true;
  }
  const words = queryText
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  return words.some((w) => HINGLISH_TOKENS.includes(w));
};

const renderFormattedMessage = (text: string) => {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
      return (
        <strong key={idx} className="font-extrabold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
};

export const SupportModal: React.FC<SupportModalProps> = ({
  isOpen,
  onClose,
  booking,
  service,
  partnerUser,
  partnerDetail,
  customerProfile,
  onReschedule,
  onCancelBooking,
}) => {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [activeSelfServe, setActiveSelfServe] = useState<SelfServeTab>("none");

  // Reschedule state
  const tomorrowIso = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const [selectedDate, setSelectedDate] = useState<string>(tomorrowIso);
  const [selectedTime, setSelectedTime] = useState<string>("10:00");
  const [isRescheduling, setIsRescheduling] = useState<boolean>(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Live Booking Telemetry Extraction
  const bookingId = booking?.id || "";
  const shortBookingId = bookingId ? bookingId.slice(-6).toUpperCase() : "ZOM-IND";
  const serviceName =
    service?.name || (booking as any)?.serviceName || "Home Service";
  const bookingTotal =
    booking?.totalPrice || (booking as any)?.totalAmount || 345;
  const rawStatus = String(booking?.status || "pending").toLowerCase();

  const isCompleted = ["completed", "finalized", "closed"].includes(rawStatus);
  const isCancelled = ["cancelled", "canceled", "rejected", "declined"].includes(rawStatus);
  const hasPartner = Boolean(
    booking?.partnerId ||
      partnerUser ||
      (booking as any)?.partnerName ||
      (booking as any)?.assignedPartner
  );
  const partnerName =
    partnerUser?.displayName ||
    (booking as any)?.partnerName ||
    (booking as any)?.assignedPartner?.name ||
    "Amit Singh";
  const partnerRating =
    partnerDetail?.rating || (booking as any)?.partnerRating || 4.9;
  const startOtp = String(
    (booking as any)?.startOtp ||
      (booking as any)?.otp ||
      (booking as any)?.serviceOtp ||
      "6330"
  );

  const paymentMethodRaw = String(
    (booking as any)?.paymentMethod || (booking as any)?.paymentMode || "cash"
  ).toLowerCase();
  const paymentStatusRaw = String((booking as any)?.paymentStatus || "").toLowerCase();
  const isPaidOnline =
    paymentStatusRaw === "paid" ||
    paymentStatusRaw === "completed" ||
    paymentMethodRaw === "online" ||
    paymentMethodRaw === "razorpay" ||
    paymentMethodRaw === "wallet" ||
    Boolean((booking as any)?.razorpayPaymentId);

  const bookingAddress =
    typeof booking?.address === "string"
      ? booking.address
      : (booking?.address as any)?.fullAddress ||
        (booking?.address as any)?.line1 ||
        (booking as any)?.customerAddress ||
        "Aapke diye gaye address";

  // Reset active self-serve card when modal closes or booking changes
  useEffect(() => {
    if (!isOpen) {
      setActiveSelfServe("none");
      setInputText("");
    }
  }, [isOpen, bookingId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        scrollToBottom();
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [isOpen, messages.length, isTyping, activeSelfServe]);

  // Real-time Firestore listener for booking chat messages
  useEffect(() => {
    if (!bookingId || !isOpen) return;

    const initialWelcome: ChatItem = {
      id: "welcome-1",
      senderId: "support-agent",
      senderName: "Zomindia Priority Support",
      text: `Namaste ji! Zomindia Indore Priority Desk me aapka swagat hai. Main aapki booking #${shortBookingId} (${serviceName}) ke liye yahan hu. Aap Hindi, Hinglish ya English me apna sawal pooch sakte hain 😊`,
      createdAt: new Date(),
      isAi: true,
    };

    try {
      const messagesRef = collection(db, "bookings", bookingId, "messages");
      const q = query(messagesRef, orderBy("createdAt", "asc"));

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const loaded: ChatItem[] = snap.docs.map((docSnap) => {
              const data = docSnap.data();
              return {
                id: docSnap.id,
                senderId: data.senderId || "system",
                senderName: data.senderName,
                text: data.text || "",
                createdAt: data.createdAt,
                isAi:
                  Boolean(data.isAi) ||
                  data.senderId === "support-agent" ||
                  data.senderId === "system",
              };
            });
            setMessages(loaded);
          } else {
            setMessages([initialWelcome]);
          }
        },
        () => {
          setMessages((prev) => (prev.length > 0 ? prev : [initialWelcome]));
        }
      );

      return () => unsubscribe();
    } catch {
      setMessages([initialWelcome]);
    }
  }, [bookingId, isOpen, serviceName, shortBookingId]);

  // Smart Multilingual (Hindi, Hinglish & English) NLP Engine & Live Booking Telemetry
  const getAssistantReply = (userQuery: string): string => {
    const q = userQuery.trim().toLowerCase();
    const isHindi = detectHindiOrHinglish(q);

    // 1. Start OTP / Verification Code Query
    if (matchesIntent(q, OTP_PATTERNS)) {
      if (isHindi) {
        return `Aapka Start OTP: 🔒 **${startOtp}** hai. Yeh OTP technician ${partnerName} ke aapke ghar pahunchne ke baad hi unke sath share karein.`;
      }
      return `Aapka Start OTP: 🔒 **${startOtp}** hai. Yeh OTP technician ${partnerName} ke aapke ghar pahunchne ke baad hi unke sath share karein.`;
    }

    // 2. Reschedule / Timing Change
    if (matchesIntent(q, RESCHEDULE_PATTERNS)) {
      if (isHindi) {
        return `Aap bilkul free (₹0 fee) me service ka time badal sakte hain! Upar diye gaye 'Reschedule Visit' chip par tap karein aur apni manpasand date aur time slot choose kar lein 📅.`;
      }
      return `You can reschedule your service time for FREE (₹0 fee)! Tap the 'Reschedule Visit' chip above and choose your preferred date and time slot 📅.`;
    }

    // 3. Cancellation & 100% Refund
    if (matchesIntent(q, CANCEL_PATTERNS)) {
      if (isHindi) {
        return `Technician ke aane se pehle cancel karna bilkul FREE (₹0 fee) hai. Agar aapne online ₹${bookingTotal} pay kiye the, toh turant 100% refund ho jayenge. Cancellation ke liye upar 'Cancellation & Refund' button par click karein.`;
      }
      return `Cancelling before the technician arrives is 100% FREE (₹0 fee). If you paid ₹${bookingTotal} online, you will get an instant 100% refund. Click the 'Cancellation & Refund' button above to proceed.`;
    }

    // 4. ETA / Live Location / Partner Query
    if (matchesIntent(q, ETA_PATTERNS)) {
      if (isHindi) {
        if (rawStatus === "on_the_way" || rawStatus === "in_transit") {
          return `Namaste ji! Aapke ${serviceName} ke liye verified pro ${partnerName} nikal chuke hain aur lagbhag 10–15 minute me aapke doorstep par honge. Aap booking card par live GPS bhi track kar sakte hain 🛵.`;
        }
        if (rawStatus === "arrived") {
          return `Namaste! ${partnerName} aapke doorstep par pahunch chuke hain. Kripya service shuru karne ke liye unhe Start OTP (${startOtp}) share kar dijiye 🚪.`;
        }
        if (rawStatus === "in_progress") {
          return `${partnerName} abhi aapke yahan ${serviceName} ka kaam kar rahe hain. Kisi bhi zaroorat par Indore Desk aapke sath hai.`;
        }
        if (rawStatus === "pending" && !hasPartner) {
          return `Hum aapke area me sabse kareebi specialist ko match kar rahe hain. 5–10 minute me pro assign ho jayega.`;
        }
        return `Namaste ji! Aapke ${serviceName} ke liye verified pro ${partnerName} nikal chuke hain aur lagbhag 10–15 minute me aapke doorstep par honge. Aap booking card par live GPS bhi track kar sakte hain 🛵.`;
      } else {
        if (rawStatus === "on_the_way" || rawStatus === "in_transit") {
          return `Namaste! Verified pro ${partnerName} (${partnerRating.toFixed(1)}★) is on the way for your ${serviceName} and will reach your doorstep in ~10–15 minutes. You can also track live GPS on your booking card 🛵.`;
        }
        if (rawStatus === "arrived") {
          return `Namaste! ${partnerName} has arrived at your doorstep. Please share your Start OTP (${startOtp}) with them to begin the service 🚪.`;
        }
        if (rawStatus === "in_progress") {
          return `${partnerName} is currently performing your ${serviceName}. Our Indore Desk is right here with you if you need anything.`;
        }
        if (rawStatus === "pending" && !hasPartner) {
          return `We are matching the closest verified specialist in your area. A pro will be assigned within 5–10 minutes.`;
        }
        return `Verified pro ${partnerName} (${partnerRating.toFixed(1)}★) is assigned for your ${serviceName} and will reach your doorstep (${bookingAddress}) in ~10–15 minutes. You can track live GPS on your booking card 🛵.`;
      }
    }

    // 5. Calling & Direct Support
    if (matchesIntent(q, CALL_PATTERNS)) {
      if (isHindi) {
        return `Aap upar bane black **'Call Desk'** button se hamare Indore Support Desk par turant baat kar sakte hain, ya booking card par bane Call button se seedhe ${partnerName} ko call kar sakte hain 📞.`;
      }
      return `Aap upar bane black **'Call Desk'** button se hamare Indore Support Desk par turant baat kar sakte hain, ya booking card par bane Call button se seedhe ${partnerName} ko call kar sakte hain 📞.`;
    }

    // 6. Price / Bill / Payment Method
    if (matchesIntent(q, PRICE_PATTERNS)) {
      if (isHindi) {
        return `Aapke #${shortBookingId} (${serviceName}) ka kul bill ₹${bookingTotal} hai (${
          isPaidOnline ? "Paid Online" : "Pay After Service via Cash ya UPI"
        }). Koi extra ya hidden charge nahi hai.`;
      }
      return `Aapke #${shortBookingId} (${serviceName}) ka kul bill ₹${bookingTotal} hai (${
        isPaidOnline ? "Paid Online" : "Pay After Service via Cash ya UPI"
      }). Koi extra ya hidden charge nahi hai.`;
    }

    // 7. Warranty / Complaints / Rework
    if (matchesIntent(q, WARRANTY_PATTERNS)) {
      if (isHindi) {
        return `Aapki har booking Zomindia ki 30-Day Free Rework Guarantee ke sath aati hai. Agar kaam me koi dikkat aayi hai, toh Indore Priority Desk aapke liye free re-visit arrange karega 🛡️.`;
      }
      return `Aapki har booking Zomindia ki 30-Day Free Rework Guarantee ke sath aati hai. Agar kaam me koi dikkat aayi hai, toh Indore Priority Desk aapke liye free re-visit arrange karega 🛡️.`;
    }

    // 8. Greetings & Small Talk
    if (matchesIntent(q, GREETING_PATTERNS)) {
      return `Namaste ji! Zomindia Indore Priority Desk me aapka swagat hai. Main aapki booking #${shortBookingId} (${serviceName}) ke liye yahan hu. Bataiye aaj aapki kya sahayata kar sakta hu? 😊`;
    }

    // Contextual Fallback (Hindi/Hinglish vs English)
    if (isHindi) {
      return `Namaste ji! Aapki booking #${shortBookingId} (${serviceName} • ₹${bookingTotal}) ke liye verified pro ${partnerName} (${partnerRating.toFixed(1)}★) aapke address (${bookingAddress}) ke liye assigned hain. Aapka Start OTP 🔒 **${startOtp}** hai. Turant sahayata ke liye upar **'Call Desk'** ya **'WhatsApp Help'** par tap karein 🙏.`;
    }

    return `Thank you! Our Indore Priority Desk has received your message for #${shortBookingId} (${serviceName} • ₹${bookingTotal}). Verified pro ${partnerName} (${partnerRating.toFixed(1)}★, Start OTP: 🔒 **${startOtp}**) is assigned for ${bookingAddress}. Tap **'Call Desk'** or **'WhatsApp Help'** above for instant live assistance.`;
  };

  const appendAndPersistMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text) return;

    const currentUserId = auth.currentUser?.uid || customerProfile?.uid || "customer";
    const currentUserName =
      customerProfile?.displayName || auth.currentUser?.displayName || "You";

    const userMsg: ChatItem = {
      id: `user-${Date.now()}`,
      senderId: currentUserId,
      senderName: currentUserName,
      text,
      createdAt: new Date(),
      isAi: false,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    if (bookingId && db) {
      try {
        await addDoc(collection(db, "bookings", bookingId, "messages"), {
          senderId: currentUserId,
          senderName: currentUserName,
          text,
          createdAt: serverTimestamp(),
        });
      } catch {
        // Non-blocking fallback
      }
    }

    setTimeout(async () => {
      const reply = getAssistantReply(text);
      const aiMsg: ChatItem = {
        id: `ai-${Date.now()}`,
        senderId: "support-agent",
        senderName: "Zomindia Priority Support",
        text: reply,
        createdAt: new Date(),
        isAi: true,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);

      if (bookingId && db) {
        try {
          await addDoc(collection(db, "bookings", bookingId, "messages"), {
            senderId: "support-agent",
            senderName: "Zomindia Priority Support",
            text: reply,
            isAi: true,
            createdAt: serverTimestamp(),
          });
        } catch {
          // Non-blocking fallback
        }
      }
    }, 450);
  };

  const handleChipClick = (tab: SelfServeTab, promptText: string) => {
    setActiveSelfServe((prev) => (prev === tab ? "none" : tab));
    appendAndPersistMessage(promptText);
  };

  const handleConfirmReschedule = async () => {
    if (!booking || !selectedDate || !selectedTime) return;
    setIsRescheduling(true);
    try {
      if (onReschedule) {
        await onReschedule(booking.id, selectedDate, selectedTime);
      } else {
        const combinedDateTime = new Date(`${selectedDate}T${selectedTime}`);
        await updateDoc(doc(db, "bookings", booking.id), {
          scheduledAt: Timestamp.fromDate(combinedDateTime),
          updatedAt: serverTimestamp(),
        });
      }

      const formattedDate = new Date(`${selectedDate}T${selectedTime}`).toLocaleString(
        "en-IN",
        {
          weekday: "short",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }
      );

      if (typeof (window as any).__showToast === "function") {
        (window as any).__showToast(`Visit rescheduled to ${formattedDate}`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `sys-resched-${Date.now()}`,
          senderId: "support-agent",
          senderName: "Zomindia Priority Support",
          text: `✅ Done! Aapki ${serviceName} (#${shortBookingId}) ab ${formattedDate} ke liye reschedule ho gayi hai.`,
          createdAt: new Date(),
          isAi: true,
        },
      ]);
      setActiveSelfServe("none");
    } catch (err) {
      console.error("Failed to reschedule:", err);
      if (typeof (window as any).__showToast === "function") {
        (window as any).__showToast("Could not reschedule right now. Please try again.");
      }
    } finally {
      setIsRescheduling(false);
    }
  };

  const whatsappHref = `https://wa.me/919630234563?text=${encodeURIComponent(
    `Hi Zomindia Priority Support, I need help with Booking #${shortBookingId} (${serviceName} - ₹${bookingTotal}).`
  )}`;

  const formatMessageTime = (ts: any): string => {
    if (!ts) return "Just now";
    const dateObj =
      typeof ts?.toDate === "function"
        ? ts.toDate()
        : ts instanceof Date
          ? ts
          : new Date(ts);
    if (isNaN(dateObj.getTime())) return "Just now";
    return formatTime12Hour(dateObj, false) || "Just now";
  };

  return (
    <AnimatePresence>
      {isOpen && booking && (
        <div
          id="zomindia-support-bottom-sheet"
          className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-center p-0 sm:p-4 pointer-events-none"
        >
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs pointer-events-auto"
          />

          {/* Slide-Up Bottom Sheet */}
          <motion.div
            initial={{ y: "100%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 320, mass: 0.85 }}
            className="pointer-events-auto relative w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[90dvh] sm:max-h-[84vh] overflow-hidden z-10"
          >
            {/* 1. Top Header with Rounded Drag Handle */}
            <div className="bg-white px-4 pt-2.5 pb-3.5 sm:px-5 border-b border-slate-100 shrink-0">
              {/* Drag Handle */}
              <div className="w-10 h-1.5 bg-slate-200 rounded-full mx-auto mb-3" />

              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-emerald-200/80 flex items-center justify-center text-emerald-600 shrink-0 shadow-2xs">
                    <ShieldCheck size={20} className="stroke-[2.2]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h3 className="font-extrabold text-sm sm:text-base text-slate-900 tracking-tight truncate">
                        Zomindia Priority Support
                      </h3>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                      <span className="text-[11px] font-bold text-emerald-700">
                        Active • Indore Desk
                      </span>
                      <span className="text-slate-300 text-[10px]">•</span>
                      <span className="text-[11px] text-slate-500 font-medium">
                        Hindi / English
                      </span>
                    </div>
                  </div>
                </div>

                {/* Crisp Close (X) Button */}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close Support Sheet"
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shrink-0 active:scale-95"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Booking Context Pill: "#{booking.id} • {booking.serviceName}" */}
              <div className="mt-3 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono font-bold text-xs text-blue-700 bg-blue-50 border border-blue-200/70 px-2 py-0.5 rounded-lg shrink-0">
                    #{shortBookingId}
                  </span>
                  <span className="text-slate-400 font-bold text-xs">•</span>
                  <span className="text-xs font-bold text-slate-800 truncate">
                    {serviceName}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[10px] font-bold text-slate-700 bg-white border border-slate-200 px-2 py-0.5 rounded-full">
                    <Lock size={9} className="text-blue-600" />
                    OTP: {startOtp}
                  </span>
                  <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2.5 py-0.5 rounded-full">
                    ₹{bookingTotal}
                  </span>
                </div>
              </div>

              {/* 2. Quick Action Hub (1-Tap Resolution): Call Desk & WhatsApp Help */}
              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <a
                  href={`tel:${CORPORATE_LANDLINE_GATEWAY}`}
                  className="py-2.5 px-3 rounded-2xl bg-slate-900 hover:bg-slate-800 active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <Phone size={14} className="text-emerald-400 shrink-0" />
                  <span>Call Desk</span>
                </a>

                <a
                  href={whatsappHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="py-2.5 px-3 rounded-2xl bg-[#25D366] hover:bg-[#1ebe5d] active:scale-98 text-white text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-xs cursor-pointer"
                >
                  <MessageCircle size={14} className="fill-white text-white shrink-0" />
                  <span>WhatsApp Help</span>
                </a>
              </div>

              {/* 3. Smart Self-Serve Chips */}
              <div className="mt-3 flex items-center gap-2 overflow-x-auto no-scrollbar pb-0.5">
                <button
                  type="button"
                  onClick={() =>
                    handleChipClick("partner_status", "Technician kab aayega?")
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${
                    activeSelfServe === "partner_status"
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/80"
                  }`}
                >
                  <MapPin size={12} />
                  <span>Where is my partner?</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleChipClick("reschedule", "Time badalna hai (Reschedule)")
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${
                    activeSelfServe === "reschedule"
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/80"
                  }`}
                >
                  <Calendar size={12} />
                  <span>Reschedule Visit</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    handleChipClick("cancellation", "Cancel & Refund policy")
                  }
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 shrink-0 active:scale-95 ${
                    activeSelfServe === "cancellation"
                      ? "bg-blue-600 text-white border-blue-600 shadow-2xs"
                      : "bg-slate-100 hover:bg-slate-200/80 text-slate-700 border-slate-200/80"
                  }`}
                >
                  <RotateCcw size={12} />
                  <span>Cancellation & Refund</span>
                </button>
              </div>
            </div>

            {/* Interactive Self-Serve Expandable Drawer (when a chip is selected) */}
            <AnimatePresence initial={false}>
              {activeSelfServe !== "none" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="bg-slate-50 border-b border-slate-200/80 overflow-hidden shrink-0"
                >
                  <div className="p-3.5 sm:p-4">
                    {/* Chip 1: Where is my partner? */}
                    {activeSelfServe === "partner_status" && (
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-black text-xs shrink-0">
                            {hasPartner ? (
                              partnerName.slice(0, 2).toUpperCase()
                            ) : (
                              <Clock size={16} className="animate-spin" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-extrabold text-slate-900 truncate">
                                {partnerName}
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-md border border-amber-200/60">
                                <Star size={9} className="fill-amber-500 text-amber-500" />
                                {partnerRating.toFixed(1)}
                              </span>
                              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded-md border border-blue-200/60">
                                🔒 OTP: {startOtp}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-600 font-medium mt-0.5 truncate">
                              {isCompleted
                                ? "Service completed • Covered by 30-day warranty"
                                : rawStatus === "arrived"
                                  ? `Arrived at doorstep • Share Start OTP (${startOtp})`
                                  : `ETA ~10–15 mins • ${bookingAddress}`}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveSelfServe("none")}
                          className="text-[11px] font-bold text-slate-400 hover:text-slate-700 px-2 py-1 cursor-pointer"
                        >
                          Hide
                        </button>
                      </div>
                    )}

                    {/* Chip 2: Reschedule Visit */}
                    {activeSelfServe === "reschedule" && (
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                            <Calendar size={13} className="text-blue-600" />
                            Pick New Date & Time Slot (₹0 Fee)
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveSelfServe("none")}
                            className="text-[11px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            Close
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <input
                            type="date"
                            min={new Date().toISOString().split("T")[0]}
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600"
                          />
                          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                            {QUICK_TIME_SLOTS.map((slot) => (
                              <button
                                key={slot.value}
                                type="button"
                                onClick={() => setSelectedTime(slot.value)}
                                className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border whitespace-nowrap cursor-pointer transition-all ${
                                  selectedTime === slot.value
                                    ? "bg-blue-600 text-white border-blue-600"
                                    : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                }`}
                              >
                                {slot.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={isRescheduling || isCompleted || isCancelled}
                          onClick={handleConfirmReschedule}
                          className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs"
                        >
                          <CheckCircle2 size={13} />
                          <span>
                            {isCompleted || isCancelled
                              ? "Reschedule Unavailable for Past Bookings"
                              : isRescheduling
                                ? "Updating Schedule..."
                                : "Confirm New Slot"}
                          </span>
                        </button>
                      </div>
                    )}

                    {/* Chip 3: Cancellation & Refund Policy Summary */}
                    {activeSelfServe === "cancellation" && (
                      <div className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-2xs space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-emerald-600" />
                            Zomindia Cancellation & Refund Policy
                          </span>
                          <button
                            type="button"
                            onClick={() => setActiveSelfServe("none")}
                            className="text-[11px] font-bold text-slate-400 hover:text-slate-700 cursor-pointer"
                          >
                            Close
                          </button>
                        </div>

                        <ul className="space-y-1.5 text-[11px] text-slate-600 font-medium pl-1">
                          <li className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <span>
                              <strong className="text-slate-800">₹0 Cancellation Fee:</strong>{" "}
                              Free cancellation anytime before the specialist starts work.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <span>
                              <strong className="text-slate-800">100% Instant Refund:</strong>{" "}
                              Online & Wallet payments (₹{bookingTotal}) are refunded immediately upon cancellation.
                            </span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                            <span>
                              <strong className="text-slate-800">30-Day Rework Guarantee:</strong>{" "}
                              Completed services include zero-cost re-inspection within 30 days.
                            </span>
                          </li>
                        </ul>

                        {!isCompleted && !isCancelled && onCancelBooking && (
                          <button
                            type="button"
                            onClick={() => {
                              onClose();
                              onCancelBooking(booking);
                            }}
                            className="w-full mt-1 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1"
                          >
                            <span>Proceed to Cancel Booking</span>
                            <ChevronRight size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 4. In-App Quick Chat UI */}
            <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5 space-y-3.5 bg-slate-50/70 min-h-[220px] max-h-[360px] scroll-smooth">
              {messages.map((msg) => {
                const isUser =
                  msg.senderId ===
                    (auth.currentUser?.uid || customerProfile?.uid || "customer") &&
                  !msg.isAi;

                return (
                  <motion.div
                    key={msg.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.16 }}
                    className={`flex items-end gap-2 ${
                      isUser ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* Professional Assistant Avatar */}
                    {!isUser && (
                      <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs mb-4">
                        <Sparkles size={13} />
                      </div>
                    )}

                    <div
                      className={`flex flex-col max-w-[82%] ${
                        isUser ? "items-end" : "items-start"
                      }`}
                    >
                      <div
                        className={`px-3.5 py-2.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                          isUser
                            ? "bg-blue-600 text-white rounded-br-xs font-medium"
                            : "bg-white text-slate-800 border border-slate-200/90 rounded-bl-xs font-medium"
                        }`}
                      >
                        {!isUser && (
                          <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 mb-0.5">
                            <span>Zomindia Support</span>
                            <CheckCircle2 size={10} className="text-emerald-600" />
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">
                          {renderFormattedMessage(msg.text)}
                        </p>
                      </div>

                      <span className="text-[10px] text-slate-400 font-medium mt-1 px-1">
                        {formatMessageTime(msg.createdAt)}
                      </span>
                    </div>

                    {isUser && (
                      <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 mb-4 text-[10px] font-bold">
                        <User size={12} />
                      </div>
                    )}
                  </motion.div>
                );
              })}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Sparkles size={13} />
                  </div>
                  <div className="px-3.5 py-2.5 bg-white rounded-2xl rounded-bl-xs border border-slate-200/90 flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.15s]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.3s]" />
                    <span className="text-[11px] text-slate-500 font-semibold ml-1">
                      Indore Desk typing...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* 5. Clean Input Bar at Bottom (Padded for Mobile Keyboards / Safe Area) */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                appendAndPersistMessage(inputText);
              }}
              className="px-4 pt-3 pb-[max(0.875rem,env(safe-area-inset-bottom))] bg-white border-t border-slate-100 flex items-center gap-2 shrink-0"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Ask in Hindi, Hinglish or English (e.g. technician kab aayega)..."
                className="flex-1 bg-slate-50 border border-slate-200/90 rounded-2xl px-4 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white font-medium transition-all"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                aria-label="Send support message"
                className="w-10 h-10 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              >
                <Send size={15} />
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default SupportModal;
