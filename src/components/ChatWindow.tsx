import { useState, useEffect, useRef, FormEvent } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ChatMessage, UserProfile, Booking } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, User, MessageSquare } from 'lucide-react';

interface ChatWindowProps {
  booking: Booking;
  otherUser: UserProfile | null;
  onClose: () => void;
}

export default function ChatWindow({ booking, otherUser, onClose }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const messagesRef = collection(db, 'bookings', booking.id, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as ChatMessage[];
      setMessages(msgs);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `bookings/${booking.id}/messages`);
    });

    return () => unsubscribe();
  }, [booking.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !auth.currentUser) return;

    const messageText = newMessage.trim();
    setNewMessage('');

    try {
      const messagesRef = collection(db, 'bookings', booking.id, 'messages');
      await addDoc(messagesRef, {
        senderId: auth.currentUser.uid,
        text: messageText,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `bookings/${booking.id}/messages`);
    }
  };

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 100, scale: 0.95, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, scale: 0.95, filter: 'blur(10px)' }}
        className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[420px] h-full sm:h-[650px] bg-white sm:rounded-[40px] shadow-[0_32px_64px_rgba(0,0,0,0.15)] border-t sm:border border-stone-100 flex flex-col z-[100] overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-5 bg-stone-900 text-white flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[200%] bg-white/20 blur-[120px] rounded-full rotate-45 animate-pulse" />
          </div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-[18px] bg-white/10 flex items-center justify-center overflow-hidden border border-white/20 shadow-inner">
              {otherUser?.photoURL ? (
                <img src={otherUser.photoURL} alt={otherUser.displayName} className="w-full h-full object-cover" />
              ) : (
                <User size={24} className="text-white/40" />
              )}
            </div>
            <div>
              <h4 className="font-bold text-lg leading-none mb-1.5 tracking-tight">{otherUser?.displayName || 'Chat Support'}</h4>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-emerald-400 rounded-full shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                <p className="text-[10px] text-white/50 uppercase tracking-widest font-black leading-none">Job #{booking.id.slice(0, 8).toUpperCase()}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 relative z-10">
            <button 
              onClick={onClose}
              className="p-3 hover:bg-white/10 rounded-2xl transition-all active:scale-90 group"
              title="Close Chat"
            >
              <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 space-y-8 bg-stone-50/30 scroll-smooth"
        >
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-400">
              <div className="w-10 h-10 border-4 border-stone-100 border-t-stone-900 rounded-full animate-spin mb-6" />
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-900/40">Secure Sync...</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-300 text-center px-12">
              <div className="w-24 h-24 bg-white rounded-[32px] mb-8 shadow-2xl shadow-stone-200/50 flex items-center justify-center border border-stone-100/50 transform -rotate-6">
                <MessageSquare size={40} className="text-stone-100" />
              </div>
              <h5 className="text-xl font-bold text-stone-900 mb-2 italic">Connect Now</h5>
              <p className="text-xs text-stone-400 leading-relaxed font-medium">Say hello to your {auth.currentUser?.uid === booking.customerId ? 'partner' : 'customer'} to coordinate the booking.</p>
            </div>
          ) : (
            <div className="space-y-8">
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === auth.currentUser?.uid;
                const nextMsg = messages[idx + 1];
                const isLastInGroup = !nextMsg || nextMsg.senderId !== msg.senderId;

                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    key={msg.id}
                    className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                  >
                    <div 
                      className={`max-w-[82%] group ${isMe ? 'items-end' : 'items-start'}`}
                    >
                      <div 
                        className={`relative px-5 py-3.5 rounded-[28px] text-sm leading-relaxed transition-all shadow-sm ${
                          isMe 
                            ? `bg-stone-900 text-white shadow-xl shadow-stone-900/10 ${isLastInGroup ? 'rounded-br-none' : ''}` 
                            : `bg-white text-stone-800 border border-stone-200/50 shadow-xl shadow-stone-200/20 ${isLastInGroup ? 'rounded-bl-none' : ''}`
                        }`}
                      >
                        <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
                      </div>
                      {isLastInGroup && (
                        <p className={`text-[10px] mt-2 font-bold uppercase tracking-tighter opacity-30 ${isMe ? 'text-right mr-1' : 'text-left ml-1'}`}>
                          {msg.createdAt instanceof Timestamp ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Pending'}
                        </p>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-8 bg-white border-t border-stone-100">
          <form 
            onSubmit={handleSendMessage}
            className="flex gap-4 items-center"
          >
            <div className="flex-1 relative group">
              <input 
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="w-full bg-stone-50 border-2 border-stone-100 rounded-[28px] pl-6 pr-12 py-5 text-sm font-medium focus:ring-4 focus:ring-stone-900/5 focus:border-stone-900 focus:bg-white outline-none transition-all placeholder:text-stone-300 shadow-inner"
              />
            </div>
            <button 
              type="submit"
              disabled={!newMessage.trim()}
              className="w-14 h-14 bg-stone-900 text-white rounded-[24px] hover:bg-black disabled:opacity-20 disabled:grayscale transition-all shadow-2xl shadow-stone-900/30 active:scale-90 shrink-0 flex items-center justify-center p-0"
            >
              <Send size={22} className="transform -rotate-12 translate-x-0.5" />
            </button>
          </form>
          <div className="flex items-center justify-center gap-3 mt-6">
            <div className="h-[1px] flex-1 bg-stone-100" />
            <p className="text-[9px] text-stone-300 uppercase font-black tracking-[0.3em] leading-none">Security Verified</p>
            <div className="h-[1px] flex-1 bg-stone-100" />
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
