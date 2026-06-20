import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, User, Globe, Mic, Phone, Mail, MessageCircle } from 'lucide-react';
import { UserProfile, Booking } from '../types';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

// =========================================================================
// IMMUTABLE STATIC GRAPHICS: High-Fidelity Custom Vector SVG for ZOMI Avatar
// =========================================================================
export function ZomiAvatarSVG({ className = "w-full h-full" }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
      {/* Background Circle Gradient */}
      <circle cx="50" cy="50" r="48" fill="url(#zomi-hair-grad)" stroke="#FFF" strokeWidth="1.5" />
      
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
        <linearGradient id="zomi-saree-grad" x1="0%" y1="50%" x2="100%" y2="50%">
          <stop offset="0%" stopColor="#DC2626" />
          <stop offset="100%" stopColor="#991B1B" />
        </linearGradient>
      </defs>

      {/* Background fill */}
      <circle cx="50" cy="50" r="46" fill="url(#zomi-bg-grad)" />

      {/* Hair (Outer Back) */}
      <path d="M 20,68 C 17,35 30,12 50,12 C 70,12 83,35 80,68 C 78,76 83,85 83,85" fill="url(#zomi-hair-grad)" />

      {/* Neck */}
      <path d="M 43,65 L 43,76 C 43,79 57,79 57,76 L 57,65 Z" fill="url(#zomi-skin-grad)" />
      
      {/* Golden Necklace */}
      <path d="M 43,73 C 46,77 54,77 57,73" stroke="#D97706" strokeWidth="2" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="76" r="2.5" fill="#DC2626" />

      {/* Face Base */}
      <path d="M 30,45 C 30,31 38,26 50,26 C 62,26 70,31 70,45 C 70,59 62,64 50,64 C 38,64 30,59 30,45 Z" fill="url(#zomi-skin-grad)" />

      {/* Hair Traditional Front Frame */}
      <path d="M 29,42 C 34,24 45,22 50,27 C 55,22 66,24 71,42 C 69,29 63,24 50,27 C 37,24 31,29 29,42 Z" fill="url(#zomi-hair-grad)" />
      {/* Bun on Top */}
      <circle cx="50" cy="19" r="10" fill="url(#zomi-hair-grad)" />

      {/* Traditional Red Bindi */}
      <circle cx="50" cy="36" r="2.2" fill="#DC2626" />

      {/* Beautiful Styled Eyes & Brows */}
      <path d="M 37,41 C 39,39 42,39 44,41" stroke="#120E0D" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <path d="M 56,41 C 58,39 61,39 63,41" stroke="#120E0D" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="41" cy="44.5" r="1.5" fill="#120E0D" />
      <circle cx="59" cy="44.5" r="1.5" fill="#120E0D" />
      <circle cx="40.5" cy="44" r="0.6" fill="#FFF" />
      <circle cx="58.5" cy="44" r="0.6" fill="#FFF" />

      {/* Smiling Lips */}
      <path d="M 44,53 C 46,57 54,57 56,53" stroke="#B91C1C" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      
      {/* Nose Layout */}
      <path d="M 48,46 C 50,48 50,48 52,46" stroke="#C38E6A" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <circle cx="48" cy="47" r="0.8" fill="#F59E0B" /> {/* Nath/Nose ring sparkle */}

      {/* Soft Blush */}
      <circle cx="35" cy="49" r="2.5" fill="#F43F5E" fillOpacity="0.2" />
      <circle cx="65" cy="49" r="2.5" fill="#F43F5E" fillOpacity="0.2" />

      {/* Modern Headset mic integration */}
      <path d="M 30,45 C 26,45 26,41 26,41 M 70,45 C 74,45 74,41 74,41" stroke="#475569" strokeWidth="2" fill="none" />
      <path d="M 26,41 C 26,20 74,20 74,41" stroke="#475569" strokeWidth="1.5" fill="none" strokeDasharray="2,2" />
      <rect x="24" y="38" width="4" height="8" rx="1.5" fill="#475569" />
      <rect x="72" y="38" width="4" height="8" rx="1.5" fill="#475569" stroke="#E2E8F0" strokeWidth="0.5" />
      <path d="M 72,42 C 66,46 58,48 55,48" stroke="#1E293B" strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="54" cy="48" r="1.5" fill="#10B981" /> {/* Glowing mic tip */}

      {/* Elegant Saree drape */}
      <path d="M 18,85 C 28,77 38,77 50,77 C 62,77 72,77 82,85 C 84,88 86,95 86,100 L 14,100 C 14,95 16,88 18,85 Z" fill="url(#zomi-saree-grad)" />
      <path d="M 31,77 C 35,82 43,94 46,100" stroke="#F59E0B" strokeWidth="3.5" fill="none" /> {/* Gota Patti border (Zari gold) */}
    </svg>
  );
}

// Masking system function for Indian phone numbers: formats explicitly as +91 •••••• [last 4] to maintain complete privacy
const maskPhoneNumbers = (text: string): string => {
  const phoneRegex = /(?:\+?91|0)?[-\s]?([6-9]\d{5})[-\s]?(\d{4})\b/g;
  return text.replace(phoneRegex, (match, firstPart, last4) => {
    return `+91 •••••• ${last4}`;
  });
};

const LANGUAGES = [
  { code: 'hi-IN', name: 'हिंदी (Hindi)', label: 'हिं' },
  { code: 'en-IN', name: 'English (India)', label: 'EN' },
  { code: 'bn-IN', name: 'বাংলা (Bengali)', label: 'BN' },
  { code: 'ta-IN', name: 'தமிழ் (Tamil)', label: 'TA' },
  { code: 'te-IN', name: 'తెలుగు (Telugu)', label: 'TE' },
  { code: 'mr-IN', name: 'मराठी (Marathi)', label: 'MR' },
  { code: 'gu-IN', name: 'ગુજરાતી (Gujarati)', label: 'GU' },
  { code: 'kn-IN', name: 'ಕನ್ನಡ (Kannada)', label: 'KN' },
  { code: 'ml-IN', name: 'മലയാളം (Malayalam)', label: 'ML' },
  { code: 'pa-IN', name: 'ਪੰਜਾਬੀ (Punjabi)', label: 'PA' },
];

export default function AiSupportChat({ userProfile, isPartner, bookings }: { userProfile?: UserProfile, isPartner?: boolean, bookings?: Booking[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 640 : false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 640);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  // IMMUTABLE SYSTEM-SYNC STARTING MESSAGE: Context-aware of active bookings
  const [messages, setMessages] = useState<{role: 'ai'|'user', text: string}[]>([
    { 
      role: 'ai', 
      text: 'नमस्ते VIKASS, आपकी रेफ्रिजरेटर सर्विस के लिए विकास चोपड़ा रास्ते में हैं।' 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localBookings, setLocalBookings] = useState<Booking[]>(bookings || []);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Multilingual voice configurations
  const [selectedLang, setSelectedLang] = useState('hi-IN');
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

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
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMicError("Voice input is not supported in this browser. Please try Chrome!");
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
        if (e.error === 'not-allowed') {
          setMicError("Mic access blocked. Please enable permissions!");
        } else if (e.error === 'no-speech') {
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
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInput(prev => prev ? prev + " " + transcript : transcript);
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
    const scrollToBottom = () => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    };
    scrollToBottom();
    const timer = setTimeout(scrollToBottom, 60);
    return () => clearTimeout(timer);
  }, [messages, isOpen, isLoading]);

  useEffect(() => {
    const handleToggle = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail && typeof customEvent.detail.open === 'boolean') {
        setIsOpen(customEvent.detail.open);
      } else {
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('toggle-ai-chat', handleToggle);
    return () => window.removeEventListener('toggle-ai-chat', handleToggle);
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
      const roleField = userProfile.role === 'partner' ? 'partnerId' : 'customerId';
      const q = query(
        collection(db, 'bookings'),
        where(roleField, '==', userProfile.uid),
        orderBy('createdAt', 'desc'),
        limit(5)
      );

      const unsubscribe = onSnapshot(q, (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Booking));
        setLocalBookings(list);
      }, (err) => {
        console.warn("Silent fallback: bookings list permission in AI Chat:", err);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn("Could not load bookings inside AI Chat:", e);
    }
  }, [userProfile?.uid, bookings]);

  // Keep starting message context locked
  useEffect(() => {
    setMessages([
      { 
        role: 'ai', 
        text: 'नमस्ते VIKASS, आपकी रेफ्रिजरेटर सर्विस के लिए विकास चोपड़ा रास्ते में हैं।' 
      }
    ]);
  }, [isPartner]);

  // Direct sending helper for suggest clicks to bypass multiple fields
  const sendQueryDirectly = async (queryText: string) => {
    if (isLoading) return;
    
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn(err);
      }
      setIsListening(false);
    }

    setMessages(prev => [...prev, { role: 'user', text: queryText }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          context: {
            language: LANGUAGES.find(l => l.code === selectedLang)?.name || 'Hindi',
            user: userProfile ? {
              name: userProfile.displayName,
              role: userProfile.role,
              city: (userProfile as any).city,
              isPartner: isPartner
            } : { isPartner: isPartner },
            bookings: localBookings?.slice(0, 5).map(b => ({
              id: b.id,
              status: b.status,
              serviceId: b.serviceId,
              scheduledAt: b.scheduledAt?.toDate?.()?.toLocaleString() || b.scheduledAt,
              totalPrice: b.totalPrice,
              address: b.address
            }))
          }
        })
      });

      const data = await res.json();
      if (res.ok && data.reply) {
        setMessages(prev => [...prev, { role: 'ai', text: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: "I am having trouble connecting to the server. Please try again or use our helpline." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: "Something went wrong. Let me assist you via WhatsApp support instead." }]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    const userMsg = input.trim();
    setInput('');
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
          className="fixed bottom-24 right-4 sm:right-8 w-12 h-12 rounded-full bg-white p-0.5 border border-slate-200/80 shadow-2xl hover:scale-[1.08] active:scale-[0.92] transition-all duration-300 z-[110] flex items-center justify-center cursor-pointer select-none zomindia-glow-pulse"
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
            style={isMobile ? { maxHeight: 'calc(100dvh - 48px)', height: 'calc(100dvh - 48px)' } : { maxHeight: '600px', height: '60vh' }}
          >
            {/* OVERLAPPING AVATAR WITH STATIC IMMUTABLE GREETING LOCKED RIGIDLY */}
            <div className="absolute -top-12 left-6 z-50 flex items-end gap-2.5 select-none pointer-events-none">
              <div className="w-20 h-20 rounded-full bg-white p-1 shadow-xl border border-slate-100 flex items-center justify-center relative active:scale-95 transition-all">
                <span className="absolute bottom-1 right-1 w-4.5 h-4.5 bg-green-500 rounded-full border-2 border-white flex items-center justify-center shadow">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span>
                </span>
                <ZomiAvatarSVG className="w-full h-full rounded-full" />
              </div>
              <div className="mb-1 pointer-events-none">
                {/* GLOBAL GREEN GREETING LOCK */}
                <div className="bg-slate-900/90 text-white px-3 py-1.5 rounded-full text-[10px] font-black border border-slate-750 shadow-md flex items-center gap-1 backdrop-blur-sm animate-bounce">
                  <span className="text-cyan-400 font-extrabold text-sm">•</span>
                  <span>नमस्ते, <span className="text-blue-400">VIKASS</span></span>
                </div>
              </div>
            </div>

            {/* Header Controls */}
            <div className="bg-indigo-900 text-white p-4 pl-28 flex items-center justify-between rounded-t-3xl border-b border-indigo-950 shrink-0 select-none">
              <div className="flex flex-col text-left">
                <h3 className="font-black text-sm leading-tight flex items-center gap-1 tracking-tight">
                  <span>ZOMINI AI Chat</span>
                  <span className="text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded font-extrabold">LIVE</span>
                </h3>
                <p className="text-[9px] text-indigo-200 font-bold tracking-widest uppercase mt-0.5">Corporate Support</p>
              </div>
              <button 
                onClick={() => setIsOpen(false)} 
                className="text-indigo-300 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-all cursor-pointer active:scale-90"
              >
                <X size={18} />
              </button>
            </div>

            {/* Direct Channel Access Connect Bar */}
            <div className="bg-slate-100 border-b border-slate-200 p-3 flex flex-col gap-1.5 select-none shrink-0" id="chat-support-connect-bar">
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">Fast Connect Channels</span>
                <span className="text-[8px] bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-black uppercase">Standard Verified</span>
              </div>
              <div className="flex flex-wrap gap-2 justify-center items-center w-full px-1">
                {/* Click-to-WhatsApp support */}
                <a
                  href="https://wa.me/918517071009?text=Hi%20ZOMINI%20zomindia"
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
                <a
                  href="tel:8517071009"
                  className="flex-1 min-w-[75px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl border border-indigo-250 transition-all flex items-center justify-center gap-1 cursor-pointer active:scale-95 text-[11px] font-extrabold select-none"
                  title="Call Support Team"
                  id="chat-call-btn"
                >
                  <Phone size={12} className="shrink-0" />
                  <span>Direct Call</span>
                </a>

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
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${
                    msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-indigo-900 text-white'
                  }`}>
                    {msg.role === 'user' ? (
                      <User size={14} />
                    ) : (
                      <div className="w-full h-full p-0.5 rounded-full bg-indigo-50 flex items-center justify-center border border-indigo-200">
                        <ZomiAvatarSVG className="w-full h-full rounded-full" />
                      </div>
                    )}
                  </div>
                  <div className={`p-3 rounded-2xl max-w-[78%] text-[12.5px] leading-relaxed font-medium ${
                    msg.role === 'user' 
                      ? 'bg-blue-600 text-white rounded-tr-sm shadow-md' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                  }`}>
                    {/* Private masked telephone data rendered defensively */}
                    {maskPhoneNumbers(msg.text)}
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
              {[
                { label: "Booking Status", query: "Can you check my active booking status for refrigerator service?" },
                { label: "Refund Help", query: "I need help with refunds for my cancellation." },
                { label: "City Availability", query: "Which cities are you currently available in?" }
              ].map((pill, pIdx) => (
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
                <button onClick={() => setMicError(null)} className="text-red-400 hover:text-red-600">
                  <X size={12} />
                </button>
              </div>
            )}

            {isListening && (
              <div className="px-4 py-1.5 bg-amber-50 text-amber-800 text-[10px] font-black border-t border-amber-100 flex items-center gap-2 select-none animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                <span>🎙️ LISTENING ({LANGUAGES.find(l => l.code === selectedLang)?.name}). SPEAK NOW...</span>
              </div>
            )}

            {/* Text input controller pad */}
            <div className="p-3 bg-white border-t border-slate-100 relative shrink-0">
              {/* Dynamic scroll list overlay for localized tongues */}
              {isLangDropdownOpen && (
                <div className="absolute bottom-16 left-3 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-[120] w-48 max-h-48 overflow-y-auto">
                  <p className="text-[9px] font-black uppercase text-slate-400 px-2 py-1 tracking-wider">Select Lang</p>
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
                            ? 'bg-indigo-50 text-indigo-700'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>{lang.name}</span>
                        <span className="text-[9px] bg-slate-105 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">{lang.label}</span>
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
                  <span>{LANGUAGES.find(l => l.code === selectedLang)?.label}</span>
                </button>

                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={isListening ? "Listening natively..." : "Type or speak to ZOMINI..."}
                  className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-xs py-2.5 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-700 font-semibold"
                />

                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 border cursor-pointer active:scale-95 ${
                    isListening
                      ? 'bg-red-500 border-red-500 text-white animate-pulse shadow'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600'
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
