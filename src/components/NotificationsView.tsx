import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, CheckCircle2, Clock, Info, ShieldCheck, Trash2, X, MapPin } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'booking';
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

  if (loading) return (
    <div className="p-12 text-center text-stone-400">
      <div className="w-8 h-8 border-2 border-stone-200 border-t-stone-900 rounded-full animate-spin mx-auto mb-4" />
      Syncing Inbox...
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-16 relative">
      <div className="absolute top-0 right-0 w-96 h-96 bg-stone-900/5 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px] pointer-events-none" />

      <div className="flex justify-between items-end mb-16 relative">
        <div>
          <h2 className="text-5xl font-display font-black text-stone-900 italic tracking-tighter leading-none">Notifications</h2>
          <p className="text-stone-400 text-sm font-medium mt-3 italic">Stay connected with your service pulse</p>
        </div>
        {notifications.some(n => !n.read) && (
          <button 
            onClick={markAllAsRead}
            className="text-[10px] font-black uppercase tracking-[0.2em] text-stone-400 hover:text-stone-900 transition-all border-b-2 border-transparent hover:border-stone-900 pb-1"
          >
            Acknowledge All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {notifications.length === 0 ? (
          <div className="bg-white p-16 rounded-[48px] border border-stone-100 text-center">
             <Bell size={48} className="mx-auto text-stone-100 mb-6" />
             <p className="text-stone-400 font-medium italic">Your inbox is empty.</p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {notifications.map((n, i) => (
              <motion.div 
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.01 }}
                onClick={() => {
                  if (!n.read) markAsRead(n.id);
                  if (n.bookingId && onNavigate) {
                    onNavigate('bookings', n.bookingId);
                  }
                }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`group relative bg-white p-8 rounded-[32px] border transition-all cursor-pointer ${n.read ? 'border-stone-50 opacity-60' : 'border-stone-100 shadow-xl shadow-stone-900/5 hover:border-stone-400'}`}
              >
                {!n.read && (
                  <div className="absolute top-8 right-8 w-2 h-2 bg-stone-900 rounded-full" />
                )}
                <div className="flex gap-6">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    n.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                    n.type === 'booking' ? 'bg-stone-900 text-white' :
                    n.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                    'bg-stone-50 text-stone-400'
                  }`}>
                    {n.type === 'success' ? <CheckCircle2 size={20} /> :
                     n.type === 'booking' ? <ShieldCheck size={20} /> :
                     n.type === 'warning' ? <Clock size={20} /> :
                     <Info size={20} />}
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-lg font-bold mb-1 ${n.read ? 'text-stone-500' : 'text-stone-900'}`}>{n.title}</h4>
                    <p className={`text-sm leading-relaxed mb-4 ${n.read ? 'text-stone-400' : 'text-stone-500 font-medium'}`}>{n.message}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-widest text-stone-400">
                        {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleString() : 'Just now'}
                      </span>
                      {!n.read && (
                        <button 
                          onClick={() => markAsRead(n.id)}
                          className="text-[10px] font-black uppercase tracking-widest text-stone-900 hover:underline"
                        >
                          Acknowledge
                        </button>
                      )}
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
