import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  X, 
  CheckCheck, 
  Trash2, 
  Briefcase, 
  CreditCard, 
  Star, 
  Sparkles, 
  AlertTriangle,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  updateDoc, 
  writeBatch, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { UserProfile, PartnerProfile, NotificationItem as Notification } from '../../types';
import { formatNotificationTime } from '../../utils/formatTime';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  onSelectJob?: (bookingId: string) => void;
  partner?: PartnerProfile | null;
}

export default function PartnerNotificationDrawer({ 
  isOpen, 
  onClose, 
  profile, 
  onSelectJob,
  partner
}: Props) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'jobs' | 'payments' | 'system'>('all');
  const [isMarkingAll, setIsMarkingAll] = useState(false);

  useEffect(() => {
    if (!profile?.uid) return;

    const candidateIds = Array.from(new Set([
      profile.uid,
      partner?.id,
      partner?.userId,
      (profile as any)?.partnerId
    ].filter((id): id is string => Boolean(id))));

    const q = candidateIds.length > 1
      ? query(collection(db, 'notifications'), where('userId', 'in', candidateIds.slice(0, 10)))
      : query(collection(db, 'notifications'), where('userId', '==', profile.uid));

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Notification[];

        // Sort descending by createdAt
        list.sort((a, b) => {
          const timeA = typeof (a.createdAt as any)?.toMillis === 'function' 
            ? (a.createdAt as any).toMillis() 
            : ((a.createdAt as any)?.seconds ? (a.createdAt as any).seconds * 1000 : (a.createdAt ? new Date(a.createdAt as any).getTime() : 0));
          const timeB = typeof (b.createdAt as any)?.toMillis === 'function' 
            ? (b.createdAt as any).toMillis() 
            : ((b.createdAt as any)?.seconds ? (b.createdAt as any).seconds * 1000 : (b.createdAt ? new Date(b.createdAt as any).getTime() : 0));
          return timeB - timeA;
        });

        setNotifications(list);
        setLoading(false);
      },
      (err) => {
        console.warn('[PartnerNotificationDrawer] Snapshot error:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [profile?.uid]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.warn('Failed to mark notification read:', err);
    }
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter((n) => !n.read);
    if (unread.length === 0) return;

    setIsMarkingAll(true);
    try {
      const batch = writeBatch(db);
      unread.slice(0, 100).forEach((n) => {
        batch.update(doc(db, 'notifications', n.id), { read: true });
      });
      await batch.commit();
    } catch (err) {
      console.warn('Failed to mark all read:', err);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const deleteNotification = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      console.warn('Failed to delete notification:', err);
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'all') return true;
    const t = (n.type || '').toLowerCase();
    if (filter === 'jobs') {
      return !!n.bookingId || t.includes('job') || t.includes('booking') || t.includes('service') || t.includes('assigned');
    }
    if (filter === 'payments') {
      return t.includes('payment') || t.includes('wallet') || t.includes('earnings') || t.includes('payout');
    }
    if (filter === 'system') {
      return !n.bookingId && !t.includes('job') && !t.includes('payment') && !t.includes('wallet');
    }
    return true;
  });

  const getNotificationIcon = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('payment') || t.includes('wallet') || t.includes('earning')) {
      return <CreditCard size={15} className="text-emerald-600" />;
    }
    if (t.includes('review') || t.includes('rating') || t.includes('feedback')) {
      return <Star size={15} className="text-amber-500 fill-amber-500" />;
    }
    if (t.includes('alert') || t.includes('cancel') || t.includes('error')) {
      return <AlertTriangle size={15} className="text-rose-500" />;
    }
    if (t.includes('offer') || t.includes('bonus')) {
      return <Sparkles size={15} className="text-purple-600" />;
    }
    return <Briefcase size={15} className="text-blue-600" />;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
          />

          {/* Slide-over Drawer Panel */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col z-10 border-l border-slate-200"
          >
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/80 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm shadow-blue-500/20">
                  <Bell size={18} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 tracking-tight">Notifications</h3>
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded-full">
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">
                    Live Partner Alerts
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    disabled={isMarkingAll}
                    title="Mark all as read"
                    className="p-1.5 text-xs text-blue-700 hover:bg-blue-50 font-bold rounded-lg transition-colors flex items-center gap-1 shrink-0"
                  >
                    <CheckCheck size={14} />
                    <span className="text-[10px]">Read all</span>
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors"
                  aria-label="Close notifications"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-100 bg-white overflow-x-auto no-scrollbar shrink-0">
              {(['all', 'jobs', 'payments', 'system'] as const).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider whitespace-nowrap transition-all ${
                    filter === cat
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat === 'all' ? `All (${notifications.length})` : cat}
                </button>
              ))}
            </div>

            {/* Notification List Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {loading ? (
                <div className="py-16 text-center text-slate-400 text-xs font-bold animate-pulse">
                  Syncing notifications...
                </div>
              ) : filteredNotifications.length === 0 ? (
                <div className="py-20 text-center space-y-3 px-6">
                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                    <CheckCircle2 size={24} className="text-emerald-500" />
                  </div>
                  <h4 className="text-sm font-black text-slate-800">You're all caught up!</h4>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-xs mx-auto">
                    No active notifications in this category. New job assignments, customer updates, and payouts will appear here in real-time.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const hasBookingLink = !!notif.bookingId && typeof onSelectJob === 'function';

                  return (
                    <motion.div
                      key={notif.id}
                      layout
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      onClick={() => {
                        if (!notif.read) markAsRead(notif.id);
                        if (hasBookingLink) {
                          onClose();
                          onSelectJob(notif.bookingId!);
                        }
                      }}
                      className={`p-3.5 rounded-2xl border transition-all relative group cursor-pointer ${
                        notif.read
                          ? 'bg-white border-slate-200/80 hover:border-slate-300'
                          : 'bg-blue-50/40 border-blue-200 hover:border-blue-300 shadow-xs'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon */}
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                          notif.read ? 'bg-slate-100' : 'bg-white shadow-xs border border-blue-100'
                        }`}>
                          {getNotificationIcon(notif.type || '')}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0 pr-6">
                          <div className="flex items-center gap-1.5">
                            <h4 className={`text-xs leading-snug truncate ${
                              notif.read ? 'font-bold text-slate-800' : 'font-black text-slate-950'
                            }`}>
                              {notif.title}
                            </h4>
                            {!notif.read && (
                              <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                            )}
                          </div>

                          <p className="text-[11px] text-slate-600 font-medium leading-relaxed mt-0.5 line-clamp-2">
                            {notif.message}
                          </p>

                          <div className="flex items-center justify-between mt-2 pt-1 border-t border-slate-100">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                              {formatNotificationTime(notif.createdAt)}
                            </span>

                            {hasBookingLink && (
                              <span className="text-[10px] font-black text-blue-700 flex items-center gap-0.5 group-hover:underline">
                                View Job <ChevronRight size={12} />
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Delete button */}
                        <button
                          onClick={(e) => deleteNotification(notif.id, e)}
                          title="Dismiss"
                          className="absolute top-3 right-3 p-1 text-slate-300 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 text-center shrink-0">
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                Indore Partner Service Network • ZomIndia
              </p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
