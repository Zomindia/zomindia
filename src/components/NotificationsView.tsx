import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, CheckCircle2, Clock, Info, ShieldCheck, Trash2, X, Sparkles, Check, ArrowRight } from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { LoadingScreen } from './LoadingIndicator';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: any;
  bookingId?: string;
  customerName?: string;
  partnerName?: string;
  serviceName?: string;
  scheduledSlot?: string;
  [key: string]: any;
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

  const markAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
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

  const deleteNotification = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `notifications/${id}`);
    }
  };

  const formatTimestamp = (createdAt: any) => {
    if (!createdAt) return 'Just now';
    try {
      const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return 'Just now';
    }
  };

  const getStatusBadgeConfig = (type: string) => {
    const t = (type || '').toLowerCase();
    if (t.includes('success') || t === 'job_completed' || t === 'payment_received' || t === 'job_finalized' || t === 'booking_confirmed') {
      return {
        label: t === 'booking_confirmed' ? 'CONFIRMED' : t === 'payment_received' ? 'PAID' : 'COMPLETED',
        badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/60',
        iconBg: 'bg-emerald-100 text-emerald-700',
        Icon: CheckCircle2,
      };
    }
    if (t.includes('booking') || t === 'job_started' || t === 'on_the_way' || t === 'arrived' || t === 'job_assigned') {
      return {
        label: t === 'job_assigned' ? 'ASSIGNED' : t === 'on_the_way' ? 'ON THE WAY' : t === 'job_started' ? 'IN PROGRESS' : 'UPDATED',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/60',
        iconBg: 'bg-blue-100 text-blue-700',
        Icon: ShieldCheck,
      };
    }
    if (t.includes('warning') || t === 'booking_pending' || t === 'pending_parts' || t === 'amc_lead') {
      return {
        label: 'PENDING',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/60',
        iconBg: 'bg-amber-100 text-amber-700',
        Icon: Clock,
      };
    }
    if (t.includes('error') || t === 'booking_cancelled' || t === 'job_cancelled') {
      return {
        label: 'CANCELLED',
        badgeClass: 'bg-rose-50 text-rose-700 border-rose-200/60',
        iconBg: 'bg-rose-100 text-rose-700',
        Icon: X,
      };
    }
    if (t === 'promotional' || t === 'offer_active') {
      return {
        label: 'OFFER',
        badgeClass: 'bg-purple-50 text-purple-700 border-purple-200/60',
        iconBg: 'bg-purple-100 text-purple-700',
        Icon: Sparkles,
      };
    }
    return {
      label: 'INFO',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200/60',
      iconBg: 'bg-slate-100 text-slate-700',
      Icon: Info,
    };
  };

  if (loading) return <LoadingScreen message="Loading your notifications..." />;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50/70 pb-20 pt-6 sm:pt-10 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-slate-200/60">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Notifications</h1>
              {unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-[11px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                  {unreadCount} new
                </span>
              )}
            </div>
            <p className="text-slate-500 text-xs sm:text-sm font-medium mt-1">
              Stay updated with your service requests, booking status, and activity
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="self-start sm:self-auto text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check size={14} />
              Mark all as read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-3">
          {notifications.length === 0 ? (
            <div className="bg-white p-12 sm:p-16 rounded-2xl border border-slate-200/80 shadow-sm text-center">
              <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-400">
                <Bell size={24} />
              </div>
              <h3 className="text-slate-800 font-bold text-base sm:text-lg mb-1">No notifications yet</h3>
              <p className="text-slate-500 text-xs sm:text-sm max-w-sm mx-auto">
                When you book a service or receive updates from your partner, notifications will appear here.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {notifications.map((n) => {
                const config = getStatusBadgeConfig(n.type);
                const BadgeIcon = config.Icon;
                const formattedTime = formatTimestamp(n.createdAt);

                return (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.98 }}
                    transition={{ duration: 0.2 }}
                    onClick={(e) => {
                      e.preventDefault();
                      if (!n.read) markAsRead(n.id);
                      if (onNavigate) {
                        if (n.type === 'promotional') onNavigate('offers');
                        else if (n.type === 'payment_received') onNavigate('wallet');
                        else if (n.bookingId) onNavigate('bookings', n.bookingId);
                      }
                    }}
                    className={`group relative bg-white rounded-xl shadow-sm border transition-all cursor-pointer p-3.5 sm:p-4 hover:shadow-md ${
                      !n.read
                        ? 'border-blue-200/90 bg-blue-50/20 ring-1 ring-blue-500/10'
                        : 'border-slate-200/80 hover:border-slate-300'
                    }`}
                  >
                    {/* Top Row: Service Icon + Status Badge + Timestamp */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {/* Service/Notification Icon */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${config.iconBg}`}>
                          <BadgeIcon size={14} strokeWidth={2.5} />
                        </div>

                        {/* Status Badge Pill */}
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase tracking-wider border ${config.badgeClass}`}>
                          {config.label}
                        </span>

                        {/* Unread Dot */}
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse shrink-0" title="Unread" />
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400 shrink-0">
                        <Clock size={12} className="text-slate-400" />
                        <span>{formattedTime}</span>
                      </div>
                    </div>

                    {/* Middle Row: Title & Message */}
                    <div className="pl-9 pr-2">
                      <h3 className={`text-sm sm:text-base font-semibold leading-snug tracking-tight mb-0.5 ${
                        !n.read ? 'text-slate-900' : 'text-slate-800'
                      }`}>
                        {n.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-600 font-normal leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    {/* Bottom Row: Concise Details & Actions */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 pl-9">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                        {n.bookingId && (
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px]">
                            ID: #{n.bookingId.slice(0, 8)}
                          </span>
                        )}
                        {n.serviceName && (
                          <span className="text-slate-700 font-semibold">{n.serviceName}</span>
                        )}
                        {n.partnerName && (
                          <span className="text-slate-500">Partner: <strong className="text-slate-700">{n.partnerName}</strong></span>
                        )}
                        {n.customerName && (
                          <span className="text-slate-500">Customer: <strong className="text-slate-700">{n.customerName}</strong></span>
                        )}
                        {n.scheduledSlot && (
                          <span className="text-slate-500">Slot: <strong className="text-slate-700">{n.scheduledSlot}</strong></span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-auto">
                        {n.bookingId && (
                          <span className="text-xs font-semibold text-blue-600 group-hover:text-blue-700 flex items-center gap-0.5 mr-2">
                            View <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                          </span>
                        )}

                        {/* Delete Button */}
                        <button
                          onClick={(e) => deleteNotification(n.id, e)}
                          title="Delete notification"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

