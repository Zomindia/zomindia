import React, { useState, useEffect, useRef, FormEvent, useMemo } from "react";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { ChatMessage, UserProfile, Booking } from "../types";
import { formatTime12Hour } from "../utils/formatTime";
import { handleFirestoreError, OperationType } from "../lib/firestore-errors";
import { motion, AnimatePresence } from "motion/react";
import {
  Send,
  X,
  User,
  MessageSquare,
  Phone,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { sendNotification } from "../lib/notifications";
import { CORPORATE_LANDLINE_GATEWAY } from "../lib/telephony";

export interface ChatWindowProps {
  booking: Booking;
  otherUser: UserProfile | null;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export default function ChatWindow({
  booking,
  otherUser,
  onClose,
  isEmbedded = false,
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [callNotice, setCallNotice] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isCustomerUser = auth.currentUser?.uid === booking.customerUid;

  const shortBookingId = booking.id ? booking.id.slice(-6).toUpperCase() : "ZOMINDIA";
  const serviceName = (booking as any)?.serviceName || "Service Booking";
  const bookingTotal = booking?.totalPrice || (booking as any)?.totalAmount || 345;
  const rawStatus = (booking.status || "pending").toLowerCase();

  // Real-time Firestore sync
  useEffect(() => {
    const messagesRef = collection(db, "bookings", booking.id, "messages");
    const q = query(messagesRef, orderBy("createdAt", "asc"));

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        const msgs = snap.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as ChatMessage[];
        setMessages(msgs);
        setLoading(false);
      },
      (err) => {
        handleFirestoreError(err, OperationType.LIST, `bookings/${booking.id}/messages`);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [booking.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Context-driven 1-tap quick action chips
  const quickActionChips = useMemo(() => {
    if (rawStatus === "searching" || rawStatus === "pending") {
      return [
        "Where is my partner?",
        "Change visit time slot",
        "Talk to human agent",
      ];
    }
    if (
      rawStatus === "assigned" ||
      rawStatus === "on_the_way" ||
      rawStatus === "in_transit" ||
      rawStatus === "arrived"
    ) {
      return [
        "Partner running late?",
        "Share landmark details",
        "Cancel service",
      ];
    }
    if (rawStatus === "in_progress") {
      return [
        "Need spare parts update",
        "Quality check inquiry",
        "Talk to human agent",
      ];
    }
    if (rawStatus === "completed" || rawStatus === "closed" || rawStatus === "finalized") {
      return [
        "Download invoice / bill",
        "Claim 30-day warranty",
        "Report service issue",
      ];
    }
    if (rawStatus === "cancelled") {
      return [
        "Why was this cancelled?",
        "Book a replacement slot",
        "Talk to human agent",
      ];
    }
    return [
      "Where is my partner?",
      "Change visit time slot",
      "Talk to human agent",
    ];
  }, [rawStatus]);

  // Smart assistant context-aware response generator
  const getSmartResponse = (queryText: string): string => {
    const q = queryText.toLowerCase();

    if (q.includes("where is my partner") || q.includes("location")) {
      return `We are currently assigning the nearest verified technician in Indore for your ${serviceName}. As soon as the pro is allocated, you can track their live GPS location right from your dashboard!`;
    }
    if (q.includes("running late") || q.includes("late")) {
      return `We have checked the route. City traffic or the previous service might cause a slight delay. You can track their live route on the map or tap [📞 Direct Call] above to speak directly with our Indore desk!`;
    }
    if (q.includes("change visit") || q.includes("time slot") || q.includes("reschedule")) {
      return `You can reschedule this appointment to your preferred slot anytime with zero penalty. Would you like today's evening slot (5 PM - 6 PM) or tomorrow morning (10 AM - 11 AM)?`;
    }
    if (q.includes("talk to human") || q.includes("agent") || q.includes("call me")) {
      return `Connecting you directly to our Senior Support Executive at the Indore Headquarters. You can also tap the [📞 Direct Call] button at the top to connect immediately via ${CORPORATE_LANDLINE_GATEWAY}.`;
    }
    if (q.includes("landmark") || q.includes("address") || q.includes("gate")) {
      return `Got it! Please reply with your exact gate number or landmark (e.g. Near C21 Mall / Near Apollo DB City). We will transmit it directly to your assigned pro's navigation screen.`;
    }
    if (q.includes("cancel") || q.includes("refund")) {
      return `Cancellations prior to service start carry ₹0 fee and 100% immediate refund if prepaid. You can tap 'Cancel' directly on the booking card or let us know here.`;
    }
    if (q.includes("invoice") || q.includes("bill") || q.includes("receipt")) {
      return `Your official GST tax invoice for #${shortBookingId} is available anytime! You can click 'Download Bill' on your completed booking card to get an instant PDF.`;
    }
    if (q.includes("warranty") || q.includes("rework")) {
      return `Your service includes Zomindia's 30-Day Free Rework Guarantee. If any issue reoccurs, our senior technician will re-inspect and fix it at ₹0 cost!`;
    }
    return `Thank you for reaching out to Zomindia Priority Support! We have received your query regarding ${serviceName} (#${shortBookingId}). An executive is reviewing this and our team is standing by to assist you.`;
  };

  const handleSendMessage = async (textToSend: string) => {
    const messageText = textToSend.trim();
    if (!messageText || !auth.currentUser) return;

    setNewMessage("");
    setIsTyping(true);

    try {
      const messagesRef = collection(db, "bookings", booking.id, "messages");
      await addDoc(messagesRef, {
        senderId: auth.currentUser?.uid,
        senderName: auth.currentUser?.displayName || "Customer",
        text: messageText,
        createdAt: serverTimestamp(),
      });

      if (otherUser?.uid) {
        await sendNotification(
          otherUser.uid,
          `New message regarding #${shortBookingId}`,
          messageText,
          "booking_pending",
          booking.id
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `bookings/${booking.id}/messages`);
    }

    // Trigger instant assistant response
    setTimeout(async () => {
      const reply = getSmartResponse(messageText);
      try {
        const messagesRef = collection(db, "bookings", booking.id, "messages");
        await addDoc(messagesRef, {
          senderId: "support-agent",
          senderName: "Zomindia Priority Desk",
          text: reply,
          isAi: true,
          createdAt: serverTimestamp(),
        });
      } catch (e) {}
      setIsTyping(false);
    }, 700);
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    handleSendMessage(newMessage);
  };

  // Direct Call Action
  const handleDirectCall = () => {
    setCallNotice(`Routing call to Indore Desk (${CORPORATE_LANDLINE_GATEWAY})...`);
    setTimeout(() => {
      window.open(`tel:${CORPORATE_LANDLINE_GATEWAY}`);
      setTimeout(() => setCallNotice(null), 3000);
    }, 300);
  };

  // WhatsApp Action
  const handleSwitchToWhatsApp = () => {
    const message = encodeURIComponent(
      `Hi Zomindia Priority Support, I need assistance with booking #${shortBookingId} (${serviceName}).`
    );
    window.open(`https://wa.me/919630234563?text=${message}`, "_blank");
  };

  const content = (
    <div className={`flex flex-col h-full ${isEmbedded ? "bg-transparent" : "bg-white"}`}>
      {/* 1. Context-Aware Premium Header */}
      {!isEmbedded && (
        <div className="bg-slate-900 text-white px-4 py-3 sm:px-5 sm:py-3.5 shrink-0 border-b border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center font-black text-xs shrink-0 shadow-xs">
                <ShieldCheck size={16} className="text-slate-950" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3 className="font-extrabold text-xs sm:text-sm tracking-tight text-white truncate">
                    Zomindia Priority Support
                  </h3>
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
                </div>
                <p className="text-[10px] text-slate-400 font-medium">
                  🟢 Online (Indore Desk) • {otherUser?.displayName ? `Partner: ${otherUser.displayName}` : "24x7 Help"}
                </p>
              </div>
            </div>

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Close Window"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Active Booking Mini-Pill */}
          <div className="mt-2.5 px-2.5 py-1.5 bg-slate-800/90 border border-slate-700/80 rounded-xl flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0 font-medium text-slate-200 text-[11px] truncate">
              <span className="font-mono font-bold text-amber-400 shrink-0">
                #{shortBookingId}
              </span>
              <span className="text-slate-500">•</span>
              <span className="truncate">{serviceName}</span>
            </div>
            <span className="font-black text-emerald-400 text-[11px] shrink-0">
              ₹{bookingTotal}
            </span>
          </div>

          {/* Quick Actions Row */}
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleDirectCall}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Phone size={13} className="text-emerald-400" />
              <span>Direct Call</span>
            </button>

            <button
              type="button"
              onClick={handleSwitchToWhatsApp}
              className="px-2.5 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <MessageCircle size={13} className="fill-white" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>
      )}

      {/* Call Notice Banner */}
      <AnimatePresence>
        {callNotice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold text-center flex items-center justify-center gap-2"
          >
            <Phone size={12} className="animate-bounce" />
            <span>{callNotice}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Feed */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 scroll-smooth ${
          isEmbedded ? "min-h-[300px] max-h-[500px]" : "bg-slate-50/60"
        }`}
      >
        {loading ? (
          <div className="space-y-4">
            <div className="h-8 w-44 bg-slate-200/60 rounded-2xl animate-pulse" />
            <div className="h-10 w-56 bg-slate-200/40 rounded-2xl ml-auto animate-pulse" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-6 py-8">
            <div className="w-12 h-12 bg-white rounded-2xl mb-3 shadow-sm border border-slate-200/60 flex items-center justify-center text-blue-600">
              <MessageSquare size={22} />
            </div>
            <h5 className="text-sm font-bold text-slate-800 mb-0.5">Priority Support Desk</h5>
            <p className="text-xs text-slate-500 max-w-xs">
              Welcome! Tap any quick suggestion below or send a message to connect instantly.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === auth.currentUser?.uid && !(msg as any).isAi;

            return (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                key={msg.id}
                className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                    isMe
                      ? "bg-blue-600 text-white rounded-tr-xs font-medium"
                      : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs font-medium"
                  }`}
                >
                  {!isMe && (
                    <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-1">
                      <Sparkles size={11} className="text-emerald-600" />
                      <span>{otherUser?.displayName ? otherUser.displayName : "Indore Priority Desk"}</span>
                    </div>
                  )}
                  <p className="whitespace-pre-wrap">{msg.text}</p>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold mt-1 px-1">
                  {msg.createdAt
                    ? formatTime12Hour(
                        typeof (msg.createdAt as any)?.toDate === "function"
                          ? (msg.createdAt as any).toDate()
                          : msg.createdAt,
                        false
                      ) || "Just now"
                    : "Just now"}
                </span>
              </motion.div>
            );
          })
        )}

        {/* Typing indicator */}
        {isTyping && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-1.5 p-2 bg-white rounded-2xl border border-slate-200 w-fit shadow-2xs text-xs text-slate-500 font-medium"
          >
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.15s]" />
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:0.3s]" />
            <span className="text-[11px] ml-1 text-slate-600 font-bold">
              Priority Support typing...
            </span>
          </motion.div>
        )}
      </div>

      {/* 2. Instant Quick-Action Suggestions & Input */}
      <div className={`p-3 sm:p-4 bg-white border-t border-slate-100 flex flex-col gap-2.5`}>
        {/* Quick action chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          {quickActionChips.map((chip, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(chip)}
              className="px-2.5 py-1 rounded-full text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 transition-colors whitespace-nowrap cursor-pointer active:scale-95 shadow-2xs"
            >
              💬 {chip}
            </button>
          ))}
          {isCustomerUser && (
            <button
              type="button"
              onClick={async () => {
                const num = prompt("Please enter secondary contact mobile number:");
                if (num && num.trim()) {
                  const cleanedNum = num.trim();
                  try {
                    await updateDoc(doc(db, "bookings", booking.id), {
                      secondaryContact: cleanedNum,
                    });
                    await handleSendMessage(
                      `📱 Secondary Contact configured at: +91 ${cleanedNum}`
                    );
                  } catch (err) {
                    console.error(err);
                  }
                }
              }}
              className="px-2.5 py-1 rounded-full text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/80 transition-colors whitespace-nowrap cursor-pointer active:scale-95 shadow-2xs"
            >
              📱 Add Secondary Phone
            </button>
          )}
        </div>

        {/* Input box */}
        <form onSubmit={handleFormSubmit} className="flex items-center gap-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type your message or inquiry..."
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white font-medium transition-all"
          />
          <button
            type="submit"
            disabled={!newMessage.trim()}
            className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
            title="Send Message"
          >
            <Send size={15} />
          </button>
        </form>
      </div>
    </div>
  );

  if (isEmbedded) return content;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-end sm:p-6 p-0 pointer-events-none">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs pointer-events-auto"
        />

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.96 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="pointer-events-auto relative w-full sm:w-[440px] h-[92dvh] sm:h-[680px] max-h-[92dvh] sm:max-h-[85vh] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden z-10"
        >
          {content}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
