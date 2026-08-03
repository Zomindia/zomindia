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
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80 font-bold',
        iconBg: 'bg-emerald-100 text-emerald-800',
        Icon: CheckCircle2,
      };
    }
    if (t.includes('booking') || t === 'job_started' || t === 'on_the_way' || t === 'arrived' || t === 'job_assigned') {
      return {
        label: t === 'job_assigned' ? 'ASSIGNED' : t === 'on_the_way' ? 'ON THE WAY' : t === 'job_started' ? 'IN PROGRESS' : 'UPDATED',
        badgeClass: 'bg-blue-50 text-blue-800 border-blue-200/80 font-bold',
        iconBg: 'bg-blue-700 text-amber-300',
        Icon: ShieldCheck,
      };
    }
    if (t.includes('warning') || t === 'booking_pending' || t === 'pending_parts' || t === 'amc_lead') {
      return {
        label: 'PENDING',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80 font-bold',
        iconBg: 'bg-amber-100 text-amber-800',
        Icon: Clock,
      };
    }
    if (t.includes('error') || t === 'booking_cancelled' || t === 'job_cancelled') {
      return {
        label: 'CANCELLED',
        badgeClass: 'bg-rose-50 text-rose-800 border-rose-200/80 font-bold',
        iconBg: 'bg-rose-100 text-rose-800',
        Icon: X,
      };
    }
    if (t === 'promotional' || t === 'offer_active') {
      return {
        label: 'SPECIAL OFFER',
        badgeClass: 'bg-amber-500/15 text-amber-900 border-amber-300/80 font-bold',
        iconBg: 'bg-amber-500 text-slate-950',
        Icon: Sparkles,
      };
    }
    return {
      label: 'INFO',
      badgeClass: 'bg-slate-100 text-slate-800 border-slate-200/80 font-bold',
      iconBg: 'bg-slate-800 text-amber-300',
      Icon: Info,
    };
  };

  if (loading) return <LoadingScreen message="Loading your notifications..." />;

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-white pb-20 pt-6 sm:pt-8 px-3 sm:px-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 pb-4 border-b border-blue-100/80">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-6 bg-blue-700 rounded-full shrink-0" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-blue-950 tracking-tight">Notifications</h1>
              {unreadCount > 0 && (
                <span className="bg-blue-700 text-white font-bold text-[11px] px-2.5 py-0.5 rounded-full shadow-xs border border-blue-600">
                  {unreadCount} New
                </span>
              )}
            </div>
            <p className="text-blue-900/70 text-xs sm:text-sm font-medium mt-1">
              Stay updated with real-time service requests, status alerts, and activity
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={markAllAsRead}
              className="self-start sm:self-auto text-xs font-bold text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100/80 border border-blue-200/80 px-3.5 py-1.75 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
            >
              <Check size={14} className="text-blue-700 stroke-[3]" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="space-y-4">
          {notifications.length === 0 ? (
            <div className="bg-blue-50/40 p-12 sm:p-16 rounded-2xl border border-blue-100 text-center shadow-sm">
              <div className="w-14 h-14 bg-white text-blue-700 rounded-full flex items-center justify-center mx-auto mb-4 border border-blue-100 shadow-sm">
                <Bell size={24} />
              </div>
              <h3 className="text-blue-950 font-bold text-base sm:text-lg mb-1">No notifications yet</h3>
              <p className="text-blue-900/70 text-xs sm:text-sm max-w-sm mx-auto font-medium">
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
                    className={`group relative rounded-2xl transition-all cursor-pointer p-4 sm:p-4.5 ${
                      !n.read
                        ? 'bg-blue-50/70 border-l-4 border-l-blue-700 border-y border-r border-blue-200 shadow-[0_4px_20px_-2px_rgba(29,78,216,0.12)] hover:shadow-[0_8px_25px_-2px_rgba(29,78,216,0.18)]'
                        : 'bg-white border border-slate-200/90 shadow-[0_4px_16px_-2px_rgba(15,23,42,0.06)] hover:shadow-[0_8px_24px_-2px_rgba(15,23,42,0.12)] hover:border-blue-200'
                    }`}
                  >
                    {/* Top Row: Service Icon + Status Badge + Timestamp */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        {/* Service/Notification Icon */}
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 shadow-2xs ${config.iconBg}`}>
                          <BadgeIcon size={14} strokeWidth={2.5} />
                        </div>

                        {/* Status Badge Pill */}
                        <span className={`px-2 py-0.5 text-[10px] rounded-md uppercase tracking-wider border ${config.badgeClass}`}>
                          {config.label}
                        </span>

                        {/* Unread Indicator */}
                        {!n.read && (
                          <span className="w-2 h-2 rounded-full bg-blue-700 ring-2 ring-blue-300 animate-pulse shrink-0" title="Unread notification" />
                        )}
                      </div>

                      {/* Timestamp */}
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-blue-900/60 shrink-0">
                        <Clock size={12} className="text-blue-700/60" />
                        <span>{formattedTime}</span>
                      </div>
                    </div>

                    {/* Middle Row: Title & Message */}
                    <div className="pl-9 pr-2">
                      <h3 className={`text-sm sm:text-base font-bold leading-snug tracking-tight mb-0.5 ${
                        !n.read ? 'text-blue-950' : 'text-slate-900'
                      }`}>
                        {n.title}
                      </h3>
                      <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
                        {n.message}
                      </p>
                    </div>

                    {/* Bottom Row: Concise Details & Actions */}
                    <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2 pl-9">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-slate-600">
                        {n.bookingId && (
                          <span className="bg-blue-100/60 text-blue-950 px-2 py-0.5 rounded font-mono text-[11px] font-bold border border-blue-200/60">
                            ID: #{n.bookingId.slice(0, 8)}
                          </span>
                        )}
                        {n.serviceName && (
                          <span className="text-blue-950 font-bold">{n.serviceName}</span>
                        )}
                        {n.partnerName && (
                          <span className="text-slate-600">Partner: <strong className="text-blue-950 font-bold">{n.partnerName}</strong></span>
                        )}
                        {n.customerName && (
                          <span className="text-slate-600">Customer: <strong className="text-blue-950 font-bold">{n.customerName}</strong></span>
                        )}
                        {n.scheduledSlot && (
                          <span className="text-slate-600">Slot: <strong className="text-blue-950 font-bold">{n.scheduledSlot}</strong></span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0 ml-auto">
                        {n.bookingId && (
                          <span className="text-xs font-bold text-blue-700 group-hover:text-blue-900 flex items-center gap-0.5 mr-2">
                            View <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform stroke-[2.5]" />
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

