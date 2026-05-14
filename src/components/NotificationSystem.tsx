import { useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Info, CheckCircle, Smartphone, MapPin } from 'lucide-react';

export default function NotificationSystem() {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [user, setUser] = useState(auth.currentUser);

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
      setNotifications(newNotifications);
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
            initial={{ opacity: 0, x: 50, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.95 }}
            className="bg-stone-900 text-white p-5 rounded-3xl shadow-2xl pointer-events-auto border border-white/10 backdrop-blur-xl flex gap-4 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500" />
            <div className="shrink-0 w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
              <Bell size={20} className="text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-bold text-sm mb-0.5">{notif.title}</h4>
              <p className="text-white/60 text-xs leading-relaxed line-clamp-2">{notif.message}</p>
            </div>
            <button 
              onClick={() => markAsRead(notif.id)}
              className="shrink-0 p-1 hover:bg-white/10 rounded-lg transition-colors h-fit"
            >
              <X size={16} className="text-white/40" />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
