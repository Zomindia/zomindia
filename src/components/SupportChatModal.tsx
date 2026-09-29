import React, { useState, useEffect, useRef, useMemo } from "react";
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
  Sparkles,
  User,
  AlertCircle,
  HelpCircle,
  ChevronDown,
} from "lucide-react";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { Booking, UserProfile } from "../types";
import { CORPORATE_LANDLINE_GATEWAY } from "../lib/telephony";
import { formatTime12Hour } from "../utils/formatTime";

export interface SupportChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  booking: Booking | null;
  otherUser?: UserProfile | null;
  isPartner?: boolean;
}

interface ChatItem {
  id: string;
  senderId: string;
  senderName?: string;
  text: string;
  createdAt: any;
  isAi?: boolean;
}

export const SupportChatModal: React.FC<SupportChatModalProps> = ({
  isOpen,
  onClose,
  booking,
  otherUser,
  isPartner = false,
}) => {
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [callNotification, setCallNotification] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const bookingId = booking?.id || "";
  const serviceName = (booking as any)?.serviceName || "Home Service";
  const bookingTotal =
    booking?.totalPrice || (booking as any)?.totalAmount || 345;
  const shortBookingId = bookingId ? bookingId.slice(-6).toUpperCase() : "ZOMINDIA";
  const rawStatus = (booking?.status || "pending").toLowerCase();

  // Scroll to bottom smoothly
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        scrollToBottom();
        inputRef.current?.focus();
      }, 150);
    }
  }, [isOpen, messages.length, isTyping]);

  // Firestore real-time listener for booking messages if booking exists
  useEffect(() => {
    if (!bookingId || !isOpen) return;

    try {
      const messagesRef = collection(db, "bookings", bookingId, "messages");
      const q = query(messagesRef, orderBy("createdAt", "asc"));

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (!snap.empty) {
            const list: ChatItem[] = snap.docs.map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                senderId: data.senderId || "system",
                senderName: data.senderName,
                text: data.text || "",
                createdAt: data.createdAt,
                isAi: data.isAi || data.senderId === "support-agent" || data.senderId === "system",
              };
            });
            setMessages(list);
          } else {
            // Seed initial greeting message
            setMessages([
              {
                id: "welcome-1",
                senderId: "support-agent",
                senderName: "Zomindia Priority Desk",
                text: `Namaste! Welcome to Zomindia Priority Support (Indore Desk). I have your booking details for ${serviceName} (#${shortBookingId}) ready. How can I assist you right away?`,
                createdAt: new Date(),
                isAi: true,
              },
            ]);
          }
        },
        (err) => {
          console.warn("[SupportChat] Realtime messages notice:", err.message);
          // Fallback to local session
          if (messages.length === 0) {
            setMessages([
              {
                id: "welcome-local",
                senderId: "support-agent",
                senderName: "Zomindia Priority Desk",
                text: `Namaste! Welcome to Zomindia Priority Support (Indore Desk). I have your booking details for ${serviceName} (#${shortBookingId}) ready. How can I assist you right away?`,
                createdAt: new Date(),
                isAi: true,
              },
            ]);
          }
        }
      );

      return () => unsubscribe();
    } catch (e) {
      console.warn("[SupportChat] Init notice:", e);
    }
  }, [bookingId, isOpen, serviceName, shortBookingId]);

  // Dynamic context-driven chips based on booking status
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

    if (q.includes("where is my partner") || q.includes("kaha hai") || q.includes("location")) {
      return `We are currently assigning the nearest verified technician in Indore for your ${serviceName}. As soon as the pro is allocated, you can track their live GPS location right from your dashboard!`;
    }
    if (q.includes("running late") || q.includes("late") || q.includes("der")) {
      return `We have checked the route. City traffic or the previous service might cause a slight 5-10 minute delay. You can track their live location or tap [📞 Direct Call] above to speak directly with our Indore desk!`;
    }
    if (q.includes("change visit") || q.includes("time slot") || q.includes("reschedule") || q.includes("time")) {
      return `You can reschedule this appointment to your preferred slot anytime with zero penalty. Would you like today's evening slot (5 PM - 6 PM) or tomorrow morning (10 AM - 11 AM)?`;
    }
    if (q.includes("talk to human") || q.includes("agent") || q.includes("call me") || q.includes("executive")) {
      return `Connecting you directly to our Senior Support Executive at the Indore Headquarters. You can also tap the [📞 Direct Call] button at the top to connect immediately via ${CORPORATE_LANDLINE_GATEWAY}.`;
    }
    if (q.includes("landmark") || q.includes("address") || q.includes("gate")) {
      return `Got it! Please reply with your exact gate number or landmark (e.g. Near C21 Mall / Near Apollo DB City). We will transmit it directly to your assigned pro's navigation screen.`;
    }
    if (q.includes("cancel") || q.includes("refund")) {
      return `Cancellations prior to service start carry ₹0 fee and 100% immediate refund if prepaid. You can tap 'Cancel' directly on the booking card or let us know here and we will cancel it for you.`;
    }
    if (q.includes("invoice") || q.includes("bill") || q.includes("receipt")) {
      return `Your official GST tax invoice for #${shortBookingId} is available anytime! You can click 'Download Bill' on your completed booking card to get an instant PDF.`;
    }
    if (q.includes("warranty") || q.includes("rework") || q.includes("guarantee")) {
      return `Your service includes Zomindia's 30-Day Free Rework Guarantee. If any issue reoccurs, our senior technician will re-inspect and fix it at ₹0 cost!`;
    }
    return `Thank you for reaching out to Zomindia Priority Support! We have received your query regarding ${serviceName} (#${shortBookingId}). An executive is reviewing this and our team is standing by to assist you.`;
  };

  // Dispatch a message (user + smart response)
  const handleSendMessage = async (textToSend: string) => {
    const text = textToSend.trim();
    if (!text) return;

    const currentUserId = auth.currentUser?.uid || "customer";
    const currentUserName = auth.currentUser?.displayName || "You";

    const userMsg: ChatItem = {
      id: `user-${Date.now()}`,
      senderId: currentUserId,
      senderName: currentUserName,
      text,
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    // Save user message to Firestore if booking exists
    if (bookingId && db) {
      try {
        const messagesRef = collection(db, "bookings", bookingId, "messages");
        await addDoc(messagesRef, {
          senderId: currentUserId,
          senderName: currentUserName,
          text,
          createdAt: serverTimestamp(),
        });
      } catch (err: any) {
        // Non-blocking in sandbox
      }
    }

    // Trigger instant intelligent assistant response
    setTimeout(async () => {
      const reply = getSmartResponse(text);
      const aiMsg: ChatItem = {
        id: `ai-${Date.now()}`,
        senderId: "support-agent",
        senderName: "Zomindia Priority Desk",
        text: reply,
        createdAt: new Date(),
        isAi: true,
      };

      setMessages((prev) => [...prev, aiMsg]);
      setIsTyping(false);

      if (bookingId && db) {
        try {
          const messagesRef = collection(db, "bookings", bookingId, "messages");
          await addDoc(messagesRef, {
            senderId: "support-agent",
            senderName: "Zomindia Priority Desk",
            text: reply,
            isAi: true,
            createdAt: serverTimestamp(),
          });
        } catch (err: any) {}
      }
    }, 700);
  };

  // Direct Call Action
  const handleDirectCall = () => {
    setCallNotification(`Routing to Indore Priority Support Desk (${CORPORATE_LANDLINE_GATEWAY})...`);
    setTimeout(() => {
      window.open(`tel:${CORPORATE_LANDLINE_GATEWAY}`);
      setTimeout(() => setCallNotification(null), 3000);
    }, 400);
  };

  // WhatsApp Action
  const handleSwitchToWhatsApp = () => {
    const message = encodeURIComponent(
      `Hi Zomindia Priority Support, I need assistance with booking #${shortBookingId} (${serviceName}).`
    );
    window.open(`https://wa.me/919630234563?text=${message}`, "_blank");
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[1000] flex items-end sm:items-center justify-end sm:p-6 p-0 pointer-events-none">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs pointer-events-auto"
        />

        {/* Modal / Drawer Card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.96 }}
          transition={{ type: "spring", damping: 28, stiffness: 320 }}
          className="pointer-events-auto relative w-full sm:w-[440px] h-[92dvh] sm:h-[680px] max-h-[92dvh] sm:max-h-[85vh] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl border border-slate-200/90 flex flex-col overflow-hidden z-10"
        >
          {/* Direct Call Toast Banner */}
          <AnimatePresence>
            {callNotification && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="absolute top-16 left-4 right-4 z-50 bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center justify-between shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <Phone size={14} className="animate-bounce" />
                  <span>{callNotification}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setCallNotification(null)}
                  className="text-white/80 hover:text-white"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 1. Context-Aware Premium Header */}
          <div className="bg-slate-900 text-white px-4 py-3 sm:px-5 sm:py-3.5 shrink-0 border-b border-slate-800">
            {/* Top row: Agent Badge + Close */}
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
                    🟢 Online (Indore Desk) • 24x7 Help
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Close Support Window"
              >
                <X size={16} />
              </button>
            </div>

            {/* Active Booking Mini-Pill */}
            {booking && (
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
            )}

            {/* Quick Actions Header Row: [📞 Direct Call] and [💬 Switch to WhatsApp] */}
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleDirectCall}
                className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                title="Connect toll-free corporate line"
              >
                <Phone size={13} className="text-emerald-400" />
                <span>Direct Call</span>
              </button>

              <button
                type="button"
                onClick={handleSwitchToWhatsApp}
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600/90 hover:bg-emerald-600 active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                title="Switch to WhatsApp"
              >
                <MessageCircle size={13} className="fill-white" />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>

          {/* 3. Messages Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 bg-slate-50/60 scroll-smooth">
            {messages.map((msg) => {
              const isUser = msg.senderId === (auth.currentUser?.uid || "customer") && !msg.isAi;

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.18 }}
                  className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-xs sm:text-[13px] leading-relaxed shadow-2xs ${
                      isUser
                        ? "bg-blue-600 text-white rounded-tr-xs font-medium"
                        : "bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs font-medium"
                    }`}
                  >
                    {!isUser && (
                      <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-wider text-emerald-700 mb-1">
                        <Sparkles size={11} className="text-emerald-600" />
                        <span>Indore Priority Desk</span>
                      </div>
                    )}
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>

                  <span className="text-[10px] text-slate-400 font-semibold mt-1 px-1">
                    {msg.createdAt
                      ? formatTime12Hour(
                          typeof msg.createdAt?.toDate === "function"
                            ? msg.createdAt.toDate()
                            : msg.createdAt,
                          false
                        ) || "Just now"
                      : "Just now"}
                  </span>
                </motion.div>
              );
            })}

            {/* Typing Indicator */}
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

            <div ref={messagesEndRef} />
          </div>

          {/* 2. Instant Quick-Action Suggestions (Chips) + Input */}
          <div className="p-3 sm:p-4 bg-white border-t border-slate-100 flex flex-col gap-2.5">
            {/* Context-driven 1-tap chips */}
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
            </div>

            {/* Input Row */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage(inputText);
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Type your message or inquiry..."
                className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:bg-white font-medium transition-all"
              />
              <button
                type="submit"
                disabled={!inputText.trim()}
                className="w-10 h-10 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
                title="Send Message"
              >
                <Send size={15} />
              </button>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default SupportChatModal;
