import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Bot, User, Globe, Mic, Phone, Mail, MessageCircle } from 'lucide-react';
import { UserProfile, Booking } from '../types';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

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
  const [messages, setMessages] = useState<{role: 'ai'|'user', text: string}[]>([
    { 
      role: 'ai', 
      text: 'hi welcom to zomindia ai chat support and i am sarthak to help you' 
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [localBookings, setLocalBookings] = useState<Booking[]>(bookings || []);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Multilingual voice-to-text configurations
  const [selectedLang, setSelectedLang] = useState('hi-IN'); // Defaulting to Hindi as asked - "sarthak" friendly greeting
  const [isLangDropdownOpen, setIsLangDropdownOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Speech Recognition API setup
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
      setMicError("Voice input is not supported in this browser. Please try Chrome or Safari!");
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

  // Turn off mic when shutting chat view
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
    // Use a small timeout to let the DOM settle before measuring and scrolling
    const timer = setTimeout(scrollToBottom, 60);
    return () => clearTimeout(timer);
  }, [messages, isOpen, isLoading]);

  // Support customized trigger from anywhere
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

  // Update starting message when role switches
  useEffect(() => {
    setMessages([
      { 
        role: 'ai', 
        text: 'hi welcom to zomindia ai chat support and i am sarthak to help you' 
      }
    ]);
  }, [isPartner]);

  const sendMessage = async () => {
    if (!input.trim()) return;
    
    // Auto turn-off recording if active when sending
    if (isListening && recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        console.warn(err);
      }
      setIsListening(false);
    }

    const userMsg = input.trim();
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/support-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          context: {
            language: LANGUAGES.find(l => l.code === selectedLang)?.name || 'Hindi',
            user: userProfile ? {
              name: userProfile.displayName,
              role: userProfile.role,
              city: (userProfile as any).city, // city might be custom or in address
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
        setMessages(prev => [...prev, { role: 'ai', text: "I'm having trouble connecting to the server. Please try again later." }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'ai', text: "Something went wrong on our end. Please reach out to email support if this continues." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-24 right-6 sm:bottom-8 sm:right-8 bg-blue-700 text-white p-4 rounded-full shadow-2xl hover:scale-110 transition-transform z-[110] flex items-center justify-center border-2 border-white/20 hover:bg-blue-800"
        >
          <MessageSquare size={24} />
        </button>
      )}

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 right-4 sm:bottom-24 sm:right-8 w-[calc(100vw-32px)] sm:w-96 bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col z-[110] overflow-hidden"
            style={{ maxHeight: '600px', height: '60vh' }}
          >
            {/* Header */}
            <div className="bg-blue-700 text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bot size={20} className="text-amber-400" />
                <div>
                  <h3 className="font-bold text-sm">Sarthak</h3>
                  <p className="text-[10px] text-slate-200 font-medium tracking-widest uppercase">zomindia AI Chatbot</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Direct Support Connect Bar */}
            <div className="bg-slate-100 border-b border-slate-200 px-4 py-2 flex items-center justify-between text-xs text-slate-600 font-semibold select-none shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Live Connect</span>
              <div className="flex items-center gap-2">
                {/* Click-to-WhatsApp */}
                <a
                  href="https://wa.me/918517071009?text=Hi%20Sarthak%20zomindia"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-600 p-1.5 rounded-lg border border-emerald-200 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                  title="Connect via WhatsApp"
                >
                  <MessageCircle size={15} />
                </a>

                {/* Click-to-Call */}
                <a
                  href="tel:8517071009"
                  className="bg-blue-50 hover:bg-blue-100 text-blue-600 p-1.5 rounded-lg border border-blue-200 transition-all flex items-center justify-center cursor-pointer active:scale-95"
                  title="Call Support Team"
                >
                  <Phone size={15} />
                </a>

                {/* Click-to-Email */}
                <a
                  href="mailto:help@zomindia.com?subject=zomindia%20Support%20Request"
                  className="bg-slate-50 hover:bg-slate-200 text-slate-700 hover:text-blue-700 px-2 py-1 rounded-lg border border-slate-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 font-bold text-[10px]"
                  title="Email help@zomindia.com"
                >
                  <Mail size={13} className="text-slate-500 shrink-0" />
                  <span>help@zomindia.com</span>
                </a>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    msg.role === 'user' ? 'bg-slate-200 text-slate-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                  </div>
                  <div className={`p-3 rounded-2xl max-w-[75%] text-sm ${
                    msg.role === 'user' 
                      ? 'bg-blue-700 text-white rounded-tr-sm' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-sm shadow-sm'
                  }`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                    <Bot size={14} />
                  </div>
                  <div className="bg-white border border-slate-200 p-3 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Language Selection Bar / Alerts */}
            {micError && (
              <div className="px-4 py-1.5 bg-red-50 text-red-600 text-xs font-semibold border-t border-red-100 flex items-center justify-between animate-pulse">
                <span>{micError}</span>
                <button onClick={() => setMicError(null)} className="text-red-400 hover:text-red-600">
                  <X size={12} />
                </button>
              </div>
            )}

            {isListening && (
              <div className="px-4 py-1.5 bg-amber-50 text-amber-700 text-[11px] font-semibold border-t border-amber-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                <span>🎙️ Listening in <span className="font-bold underline">{LANGUAGES.find(l => l.code === selectedLang)?.name}</span>. Speak now...</span>
              </div>
            )}

            {/* Input Area */}
            <div className="p-3 bg-white border-t border-slate-100 relative">
              {/* Language Selector Dropdown */}
              {isLangDropdownOpen && (
                <div className="absolute bottom-16 left-3 bg-white border border-slate-200 rounded-2xl shadow-xl p-2 z-[120] w-48 max-h-48 overflow-y-auto">
                  <p className="text-[9px] font-black uppercase text-slate-400 px-2 py-1 tracking-wider">Choose Voice/Type Lang</p>
                  <div className="scrollable-container space-y-1">
                    {LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => {
                          setSelectedLang(lang.code);
                          setIsLangDropdownOpen(false);
                        }}
                        className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-semibold transition-colors flex items-center justify-between ${
                          selectedLang === lang.code
                            ? 'bg-blue-50 text-blue-700'
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <span>{lang.name}</span>
                        <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-bold uppercase">{lang.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2">
                {/* Language Pill Selector */}
                <button
                  type="button"
                  onClick={() => setIsLangDropdownOpen(!isLangDropdownOpen)}
                  className="bg-slate-100 hover:bg-slate-200 border border-slate-250 text-slate-700 px-2.5 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shrink-0 active:scale-95 cursor-pointer"
                  title="Select Chat Language"
                >
                  <Globe size={14} className="text-blue-700" />
                  <span>{LANGUAGES.find(l => l.code === selectedLang)?.label}</span>
                </button>

                {/* Main Input Text Field */}
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                  placeholder={isListening ? "Listening natively..." : "Type or speak to Sarthak..."}
                  className="flex-1 bg-slate-50 border border-slate-200 text-slate-800 text-sm py-2.5 px-3 rounded-xl focus:outline-none focus:ring-1 focus:ring-blue-700 font-medium"
                />

                {/* Microphone Button */}
                <button
                  type="button"
                  onClick={toggleListening}
                  className={`p-2.5 rounded-xl transition-all flex items-center justify-center shrink-0 border cursor-pointer active:scale-95 ${
                    isListening
                      ? 'bg-red-500 border-red-500 text-white animate-pulse shadow-md shadow-red-500/20'
                      : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-600 hover:text-slate-800'
                  }`}
                  title="Speak with Sarthak"
                >
                  <Mic size={16} />
                </button>

                {/* Send Button */}
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  className="bg-blue-700 text-white p-2.5 rounded-xl hover:bg-blue-800 transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0 shadow-md shadow-blue-500/10 active:scale-95 cursor-pointer"
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
