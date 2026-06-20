import { useState, useEffect, useRef, FormEvent } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, Timestamp, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { ChatMessage, UserProfile, Booking } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { LoadingSpinner } from './LoadingIndicator';
import { motion, AnimatePresence } from 'motion/react';
import { Send, X, User, MessageSquare } from 'lucide-react';
import { sendNotification } from '../lib/notifications';

interface ChatWindowProps {
  booking: Booking;
  otherUser: UserProfile | null;
  onClose?: () => void;
  isEmbedded?: boolean;
}

export default function ChatWindow({ booking, otherUser, onClose, isEmbedded = false }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isCustomerUser = auth.currentUser?.uid === booking.customerId;

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
        senderId: auth.currentUser?.uid,
        text: messageText,
        createdAt: serverTimestamp()
      });

      if (otherUser?.uid) {
        await sendNotification(
          otherUser.uid,
          `New message from ${auth.currentUser.displayName || 'Support'}`,
          messageText,
          'booking_pending',
          booking.id
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `bookings/${booking.id}/messages`);
    }
  };

  const getQuickReplies = () => {
    const isCustomer = auth.currentUser?.uid === booking.customerId;
    
    if (isCustomer) {
      return [
        "Sure, I am at home. Please come in.",
        "Please inform the society security guard that you are from 'Zomindia', they will let you pass."
      ];
    } else {
      switch (booking.status) {
        case 'on_the_way':
          return [
            "I am on my way to your location from Vijay Nagar/Palasia.",
            "Due to traffic/distance, I will arrive in approximately 15 minutes."
          ];
        case 'arrived':
          return [
            "I have arrived outside your provided location/house.",
            "I am at the main gate, please open the door or step outside."
          ];
        case 'in_progress':
          return [
            "I have started the service. It will take some time to complete.",
            "The job is successfully completed. Please review the work carefully."
          ];
        default:
          return [
            "Hello, I am ready to start.",
            "Let me know when you are available.",
            "Thank you!"
          ];
      }
    }
  };

  const sendQuickReply = async (text: string) => {
    if (!auth.currentUser) return;
    try {
      const messagesRef = collection(db, 'bookings', booking.id, 'messages');
      await addDoc(messagesRef, {
        senderId: auth.currentUser?.uid,
        text,
        createdAt: serverTimestamp()
      });

      if (otherUser?.uid) {
        await sendNotification(
          otherUser.uid,
          `New message from ${auth.currentUser.displayName || 'Support'}`,
          text,
          'booking_pending',
          booking.id
        );
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `bookings/${booking.id}/messages`);
    }
  };

  const content = (
    <div className={`flex flex-col h-full ${isEmbedded ? 'bg-transparent' : 'bg-white'}`}>
      {/* Header - Only for modal mode */}
      {!isEmbedded && (
        <div className="px-6 py-5 bg-blue-700 text-white flex items-center justify-between relative overflow-hidden shrink-0">
          <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
            <div className="absolute top-[-50%] left-[-20%] w-[100%] h-[200%] bg-white/20 blur-[120px] rounded-full rotate-45 animate-pulse" />
          </div>
          
          <div className="flex items-center gap-4 relative z-10">
            <div className="w-12 h-12 rounded-[18px] bg-white/10 flex items-center justify-center overflow-hidden border border-white/20 shadow-inner">
              {otherUser?.photoURL ? (
                <img src={otherUser.photoURL} alt={otherUser.displayName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
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
            {onClose && (
              <button 
                onClick={onClose}
                className="p-3 hover:bg-white/10 rounded-2xl transition-all active:scale-90 group"
                title="Close Chat"
              >
                <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Messages */}
      <div 
        ref={scrollRef}
        className={`flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth ${isEmbedded ? 'min-h-[300px] max-h-[500px]' : 'bg-slate-50/30'}`}
      >
        {loading ? (
          <div className="space-y-6">
            <div className="flex justify-start animate-pulse">
              <div className="max-w-[70%] space-y-2">
                <div className="h-10 w-48 bg-slate-200/60 rounded-[24px] rounded-bl-none" />
                <div className="h-2.5 w-12 bg-slate-100 rounded ml-1" />
              </div>
            </div>
            <div className="flex justify-end animate-pulse">
              <div className="flex flex-col items-end max-w-[70%] space-y-2">
                <div className="h-14 w-60 bg-slate-200/40 rounded-[24px] rounded-br-none" />
                <div className="h-2.5 w-12 bg-slate-100 rounded mr-1" />
              </div>
            </div>
            <div className="flex justify-start animate-pulse">
              <div className="max-w-[70%] space-y-2">
                <div className="h-12 w-52 bg-slate-200/60 rounded-[24px] rounded-bl-none" />
                <div className="h-2.5 w-12 bg-slate-100 rounded ml-1" />
              </div>
            </div>
            <div className="flex justify-end animate-pulse">
              <div className="flex flex-col items-end max-w-[70%] space-y-2">
                <div className="h-10 w-36 bg-slate-200/40 rounded-[24px] rounded-br-none" />
                <div className="h-2.5 w-12 bg-slate-100 rounded mr-1" />
              </div>
            </div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-300 text-center px-12">
            <div className="w-20 h-20 bg-white rounded-[32px] mb-6 shadow-xl shadow-slate-200/50 flex items-center justify-center border border-slate-100/50 transform -rotate-6">
              <MessageSquare size={32} className="text-slate-100" />
            </div>
            <h5 className="text-lg font-bold text-slate-900 mb-1 italic">Direct Message</h5>
            <p className="text-[10px] text-slate-400 leading-relaxed font-black uppercase tracking-widest">Connect with your {auth.currentUser?.uid === booking.customerId ? 'pro' : 'client'}</p>
          </div>
        ) : (
          <div className="space-y-6">
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
                  <div className={`max-w-[85%] group ${isMe ? 'items-end' : 'items-start'}`}>
                    <div 
                      className={`relative px-4 py-3 rounded-[24px] text-sm font-medium leading-relaxed transition-all shadow-sm ${
                        isMe 
                          ? `bg-blue-700 text-white shadow-xl shadow-blue-700/10 ${isLastInGroup ? 'rounded-br-none' : ''}` 
                          : `bg-white text-slate-800 border border-slate-100 shadow-xl shadow-slate-100/50 ${isLastInGroup ? 'rounded-bl-none' : ''}`
                      }`}
                    >
                      <p className="whitespace-pre-wrap font-medium">{msg.text}</p>
                    </div>
                    {isLastInGroup && (
                      <p className={`text-[9px] mt-1.5 font-bold uppercase tracking-widest opacity-30 ${isMe ? 'text-right mr-1' : 'text-left ml-1'}`}>
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
      <div className={`p-6 ${isEmbedded ? 'bg-slate-50 rounded-[32px] mt-4' : 'bg-white border-t border-slate-100'} flex flex-col gap-3`}>
        {/* Quick Replies Row */}
        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 select-none max-h-32">
          {getQuickReplies().map((replyText, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => sendQuickReply(replyText)}
              className="px-3 py-1.5 bg-slate-100/80 hover:bg-blue-50 text-blue-700 font-bold border border-slate-200/50 hover:border-blue-200 text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap active:scale-95"
            >
              💬 {replyText}
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
                    await updateDoc(doc(db, 'bookings', booking.id), {
                      secondaryContact: cleanedNum
                    });
                    await sendQuickReply(`📱 Secondary Contact configured at: +91 ${cleanedNum}`);
                    alert(`Successfully updated secondary contact to: +91 ${cleanedNum}`);
                  } catch (err) {
                    console.error(err);
                    alert("Failed to configure secondary contact.");
                  }
                }
              }}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-black border border-emerald-200/50 text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap active:scale-95 flex items-center gap-1 shadow-sm"
            >
              📱 Add Secondary Contact... {booking.secondaryContact ? `(+91 ${booking.secondaryContact})` : ''}
            </button>
          )}
        </div>

        <form 
          onSubmit={handleSendMessage}
          className="flex gap-3 items-center"
        >
          <div className="flex-1 relative group">
            <input 
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Message..."
              className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl pl-5 pr-10 py-4 text-sm font-black focus:ring-4 focus:ring-blue-700/5 focus:border-blue-700 focus:bg-white outline-none transition-all placeholder:text-slate-300 shadow-inner`}
            />
          </div>
          <button 
            type="submit"
            disabled={!newMessage.trim()}
            className="w-12 h-12 bg-blue-700 text-white rounded-xl hover:bg-blue-800 disabled:opacity-20 disabled:grayscale transition-all shadow-xl shadow-blue-700/30 active:scale-90 shrink-0 flex items-center justify-center font-black p-0"
          >
            <Send size={18} className="transform -rotate-12" />
          </button>
        </form>
      </div>
    </div>
  );

  if (isEmbedded) return content;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, y: 100, scale: 0.95, filter: 'blur(10px)' }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
        exit={{ opacity: 0, y: 100, scale: 0.95, filter: 'blur(10px)' }}
        className="fixed bottom-0 right-0 sm:bottom-6 sm:right-6 w-full sm:w-[420px] h-[100dvh] sm:h-[650px] bg-white sm:rounded-[40px] shadow-[0_32px_64px_rgba(0,0,0,0.15)] border-t sm:border border-slate-100 flex flex-col z-[1001] overflow-hidden"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
}
