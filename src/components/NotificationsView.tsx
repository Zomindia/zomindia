import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, CheckCircle2, Clock, Info, ShieldCheck, Trash2, X, MapPin, Smartphone } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { LoadingScreen } from './LoadingIndicator';
import { LogoIcon } from './BrandLogo';
const logoImg = LogoIcon;

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: any;
  bookingId?: string;
}

export default function NotificationsView({ profile, onNavigate }: { profile: UserProfile, onNavigate?: (tab: string, id?: string) => void }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Notification)));
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'notifications'));

    return () => unsubscribe();
  }, [profile]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `notifications/${id}`);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach(n => {
      batch.update(doc(db, 'notifications', n.id), { read: true });
    });

    try {
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications/bulk');
    }
  };

  const deleteNotification = async (id: string) => {
    // We don't usually delete, maybe just archive or hide. 
    // Logic for deletion if requested.
  };

  if (loading) return <LoadingScreen message="Loading your notifications..." />;

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-700/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="flex justify-between items-end mb-16 relative">
        <div>
          <h2 className="text-5xl font-display font-black text-slate-900 italic tracking-tighter leading-none">Notifications</h2>
          <p className="text-slate-400 text-sm font-medium mt-3 italic">Stay connected with your service pulse</p>
        </div>
        {notifications.some(n => !n.read) && (
          <button 
            onClick={markAllAsRead}
            className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-blue-700 transition-all border-b-2 border-transparent hover:border-blue-700 pb-1"
          >
            Acknowledge All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="bg-white p-16 rounded-[48px] border border-slate-100 text-center">
             <Bell size={48} className="mx-auto text-slate-100 mb-6" />
             <p className="text-slate-400 font-medium italic">Your inbox is empty.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notifications.map((n, i) => (
              <motion.div 
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01, x: 4 }}
                onClick={(e) => {
                  e.preventDefault();
                  if (!n.read) markAsRead(n.id);
                  if (onNavigate) {
                    if (n.type === 'promotional') onNavigate('offers');
                    else if (n.type === 'payment_received') onNavigate('wallet');
                    else if (n.bookingId) onNavigate('bookings', n.bookingId);
                  }
                }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`group relative bg-white p-10 rounded-[48px] border transition-all cursor-pointer ${n.read ? 'border-slate-50 opacity-60 grayscale-[0.5]' : 'border-slate-100 shadow-2xl shadow-blue-700/5 hover:border-blue-700'}`}
              >
                {!n.read && (
                  <div className="absolute top-10 right-10 flex items-center gap-2">
                    <span className="text-[10px] font-black text-blue-700 uppercase tracking-widest animate-pulse">New Action</span>
                    <div className="w-2.5 h-2.5 bg-blue-700 rounded-full ring-4 ring-blue-700/10" />
                  </div>
                )}
                <div className="flex gap-8">
                    <div className="w-16 h-16 rounded-[28px] flex items-center justify-center shrink-0 bg-slate-50 ring-4 ring-slate-100 relative overflow-visible">
                      <img src={logoImg} alt="Notification Logo" className="w-10 h-10 object-contain" referrerPolicy="no-referrer" />
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-white border-2 border-white text-[10px] font-bold shadow-md ${
                        (n.type?.includes('success') || n.type === 'job_completed' || n.type === 'payment_received' || n.type === 'job_finalized') ? 'bg-emerald-500' :
                        (n.type?.includes('booking') || n.type === 'job_started' || n.type === 'on_the_way' || n.type === 'arrived' || n.type === 'job_assigned') ? 'bg-blue-700' :
                        (n.type?.includes('warning') || n.type === 'booking_pending' || n.type === 'pending_parts' || n.type === 'amc_lead') ? 'bg-orange-500' :
                        (n.type?.includes('error') || n.type === 'booking_cancelled' || n.type === 'job_cancelled') ? 'bg-rose-600' :
                        (n.type === 'promotional' || n.type === 'offer_active') ? 'bg-violet-600' :
                        'bg-slate-900'
                      }`}>
                        {(n.type?.includes('success') || n.type === 'job_completed' || n.type === 'payment_received' || n.type === 'job_finalized') ? <CheckCircle2 size={12} strokeWidth={3} /> :
                         (n.type?.includes('booking') || n.type === 'job_started' || n.type === 'on_the_way' || n.type === 'arrived' || n.type === 'job_assigned') ? <ShieldCheck size={12} strokeWidth={3} /> :
                         (n.type?.includes('warning') || n.type === 'booking_pending' || n.type === 'pending_parts' || n.type === 'amc_lead') ? <Clock size={12} strokeWidth={3} /> :
                         (n.type?.includes('error') || n.type === 'booking_cancelled' || n.type === 'job_cancelled') ? <X size={12} strokeWidth={3} /> :
                         (n.type === 'promotional' || n.type === 'offer_active') ? <Smartphone size={12} strokeWidth={3} /> :
                         <Info size={12} strokeWidth={3} />}
                      </div>
                    </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                       <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                          n.read ? 'bg-slate-100 text-slate-400' : 'bg-blue-50 text-blue-700'
                       }`}>
                          {n.type || 'system alert'}
                       </span>
                    </div>
                    <h4 className={`text-2xl font-black mb-1.5 tracking-tight ${n.read ? 'text-slate-400' : 'text-slate-900'}`}>{n.title}</h4>
                    <p className={`text-sm leading-relaxed mb-6 italic max-w-2xl ${n.read ? 'text-slate-400' : 'text-slate-600 font-medium'}`}>{n.message}</p>
                    
                    <div className="flex items-center justify-between border-t border-slate-50 pt-6">
                      <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                        {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : 'Just now'}
                      </div>
                      <div className="flex items-center gap-3">
                        {!n.read && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              markAsRead(n.id);
                            }}
                            className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/10"
                          >
                            Acknowledge
                          </button>
                        )}
                        <button 
                          className="w-10 h-10 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-all"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Logic for archiving/deleting if needed
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
