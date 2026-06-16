import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Info, CheckCircle, Smartphone, MapPin, ShieldCheck, Clock } from 'lucide-react';
import { playSuccessChime } from '../lib/audio';
import LogoIcon from '../assets/logo-icon.png';
const logoImg = LogoIcon;

interface Props {
  onNavigate?: (tab: any, arg?: string) => void;
}

export default function NotificationSystem({ onNavigate }: Props) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [user, setUser] = useState(auth.currentUser);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const newNotifications = snap.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as any));
      
      // Filter out notifications we've already seen in this session to avoid double-notifying
      setNotifications(prev => {
        const prevIds = new Set(prev.map(n => n.id));
        const entirelyNew = newNotifications.filter(n => !prevIds.has(n.id));
        
        // Play success chime sound for confirmed or finalized bookings
        const hasBookingSuccess = entirelyNew.some(notif => 
          notif.type === 'booking_confirmed' || notif.type === 'payment_received'
        );
        if (hasBookingSuccess) {
          playSuccessChime();
        }

        // Trigger native notification for entirely new ones
        if (entirelyNew.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
          entirelyNew.forEach((notif: any) => {
            try {
              new Notification(notif.title || 'New Notification', {
                body: notif.message,
                icon: '/logo-icon.png'
              });
            } catch (e) {
              console.error('Error showing native notification', e);
            }
          });
        }
        
        return newNotifications;
      });
    }, (err) => {
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  return (
    <div className="fixed top-20 right-4 z-[9999] pointer-events-none flex flex-col gap-3 w-full max-w-sm">
      <AnimatePresence>
        {notifications.map((notif) => (
          <motion.div
            key={notif.id}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95, filter: 'blur(4px)' }}
            onClick={(e) => {
              markAsRead(notif.id);
              if (onNavigate) {
                if (notif.type === 'promotional') onNavigate('offers');
                else if (notif.type === 'payment_received') onNavigate('wallet');
                else if (notif.bookingId) onNavigate('bookings', notif.bookingId);
              }
            }}
            className={`p-4 rounded-2xl shadow-2xl pointer-events-auto flex items-start gap-4 relative overflow-hidden group border cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all duration-300 ${
              (notif.type?.includes('success') || notif.type === 'job_completed' || notif.type === 'payment_received' || notif.type === 'job_finalized') ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20' :
              (notif.type?.includes('booking') || notif.type === 'job_started' || notif.type === 'on_the_way' || notif.type === 'arrived') ? 'bg-blue-700 text-white border-blue-600 shadow-blue-700/20' :
              (notif.type?.includes('warning') || notif.type === 'booking_pending' || notif.type === 'pending_parts') ? 'bg-orange-500 text-white border-orange-400 shadow-orange-500/20' :
              (notif.type?.includes('error') || notif.type === 'booking_cancelled') ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/20' :
              'bg-slate-900 text-white border-slate-800 shadow-slate-900/20'
            }`}
          >
            <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-150 ring-4 ring-white/10 relative overflow-visible">
              <img src={logoImg} alt="Notification Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white border border-white text-[8px] font-bold shadow-sm ${
                (notif.type?.includes('success') || notif.type === 'job_completed' || notif.type === 'payment_received' || notif.type === 'job_finalized') ? 'bg-emerald-500' :
                (notif.type?.includes('booking') || notif.type === 'job_started' || notif.type === 'on_the_way' || notif.type === 'arrived') ? 'bg-blue-600' :
                (notif.type?.includes('warning') || notif.type === 'booking_pending' || notif.type === 'pending_parts') ? 'bg-orange-500' :
                (notif.type?.includes('error') || notif.type === 'booking_cancelled') ? 'bg-rose-600' :
                'bg-slate-800'
              }`}>
                {(notif.type?.includes('success') || notif.type === 'job_completed' || notif.type === 'payment_received' || notif.type === 'job_finalized') ? <CheckCircle size={10} strokeWidth={3} /> :
                 (notif.type?.includes('booking') || notif.type === 'job_started' || notif.type === 'on_the_way' || notif.type === 'arrived') ? <ShieldCheck size={10} strokeWidth={3} /> :
                 (notif.type?.includes('warning') || notif.type === 'booking_pending' || notif.type === 'pending_parts') ? <Clock size={10} strokeWidth={3} /> :
                 (notif.type?.includes('error') || notif.type === 'booking_cancelled') ? <X size={10} strokeWidth={3} /> :
                 <Bell size={10} strokeWidth={3} />}
              </div>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h4 className="font-extrabold tracking-tight text-sm text-white mb-0.5">{notif.title}</h4>
              <p className="text-white/90 text-[11px] leading-relaxed font-semibold italic opacity-80">{notif.message}</p>
            </div>
            <button 
              onClick={(e) => {
                e.stopPropagation();
                markAsRead(notif.id);
              }}
              className="shrink-0 p-1.5 text-white/50 hover:bg-white/10 hover:text-white rounded-lg transition-colors place-self-start relative z-10"
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
