import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Info, CheckCircle, Smartphone, MapPin, ShieldCheck, Clock } from 'lucide-react';

export default function NotificationSystem() {
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
      }));
      
      // Filter out notifications we've already seen in this session to avoid double-notifying
      setNotifications(prev => {
        const prevIds = new Set(prev.map(n => n.id));
        const entirelyNew = newNotifications.filter(n => !prevIds.has(n.id));
        
        // Trigger native notification for entirely new ones
        if (entirelyNew.length > 0 && 'Notification' in window && Notification.permission === 'granted') {
          entirelyNew.forEach((notif: any) => {
            try {
              new Notification(notif.title || 'New Notification', {
                body: notif.message,
                icon: '/icon.svg'
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
            className={`p-4 rounded-2xl shadow-2xl pointer-events-auto flex items-start gap-4 relative overflow-hidden group border transition-all ${
              (notif.type?.includes('success') || notif.type === 'job_completed' || notif.type === 'payment_received' || notif.type === 'job_finalized') ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20' :
              (notif.type?.includes('booking') || notif.type === 'job_started' || notif.type === 'on_the_way' || notif.type === 'arrived') ? 'bg-blue-700 text-white border-blue-600 shadow-blue-700/20' :
              (notif.type?.includes('warning') || notif.type === 'booking_pending' || notif.type === 'pending_parts') ? 'bg-orange-500 text-white border-orange-400 shadow-orange-500/20' :
              (notif.type?.includes('error') || notif.type === 'booking_cancelled') ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/20' :
              'bg-slate-900 text-white border-slate-800 shadow-slate-900/20'
            }`}
          >
            <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center ring-4 ring-white/10 ${
              (notif.type?.includes('success') || notif.type === 'job_completed' || notif.type === 'payment_received' || notif.type === 'job_finalized') ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' :
              (notif.type?.includes('booking') || notif.type === 'job_started' || notif.type === 'on_the_way' || notif.type === 'arrived') ? 'bg-blue-600 shadow-lg shadow-blue-600/20' :
              (notif.type?.includes('warning') || notif.type === 'booking_pending' || notif.type === 'pending_parts') ? 'bg-orange-500 shadow-lg shadow-orange-500/20' :
              (notif.type?.includes('error') || notif.type === 'booking_cancelled') ? 'bg-rose-600 shadow-lg shadow-rose-600/20' :
              'bg-slate-800 shadow-lg shadow-slate-800/20'
            }`}>
              {(notif.type?.includes('success') || notif.type === 'job_completed' || notif.type === 'payment_received' || notif.type === 'job_finalized') ? <CheckCircle size={22} className="text-white" strokeWidth={2.5} /> :
               (notif.type?.includes('booking') || notif.type === 'job_started' || notif.type === 'on_the_way' || notif.type === 'arrived') ? <ShieldCheck size={22} className="text-white" strokeWidth={2.5} /> :
               (notif.type?.includes('warning') || notif.type === 'booking_pending' || notif.type === 'pending_parts') ? <Clock size={22} className="text-white" strokeWidth={2.5} /> :
               (notif.type?.includes('error') || notif.type === 'booking_cancelled') ? <X size={22} className="text-white" strokeWidth={2.5} /> :
               <Bell size={22} className="text-white group-hover:animate-bounce" strokeWidth={2.5} />}
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h4 className="font-extrabold tracking-tight text-sm text-white mb-0.5">{notif.title}</h4>
              <p className="text-white/90 text-[11px] leading-relaxed font-semibold italic opacity-80">{notif.message}</p>
            </div>
            <button 
              onClick={() => markAsRead(notif.id)}
              className="shrink-0 p-1.5 text-white/50 hover:bg-white/10 hover:text-white rounded-lg transition-colors place-self-start"
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
