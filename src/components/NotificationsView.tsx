import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  Info, 
  ShieldCheck, 
  X, 
  Sparkles, 
  Tag, 
  CreditCard, 
  PackagePlus, 
  ChevronRight, 
  XCircle,
  CheckCheck,
  ArrowUpRight,
  Filter
} from 'lucide-react';
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
}

function formatNotificationTime(createdAt: any): string {
  if (!createdAt) return 'Just now';
  let date: Date;
  if (createdAt?.toDate) {
    date = createdAt.toDate();
  } else if (createdAt?.seconds) {
    date = new Date(createdAt.seconds * 1000);
  } else if (createdAt instanceof Date) {
    date = createdAt;
  } else if (typeof createdAt === 'string' || typeof createdAt === 'number') {
    date = new Date(createdAt);
  } else {
    return 'Just now';
  }

  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 172800) return 'Yesterday';

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function getNotificationBadge(type: string) {
  const t = (type || '').toLowerCase();

  // 1. NEW_BOOKING: Orange Soft Pill (bg-orange-50 text-orange-600 border border-orange-200)
  if (
    t.includes('new_booking') || 
    t.includes('booking_pending') || 
    t.includes('new_job') || 
    t === 'new_booking' || 
    t === 'amc_lead'
  ) {
    return {
      pillStyle: 'bg-orange-50 text-orange-600 border border-orange-200',
      label: 'NEW BOOKING',
      Icon: PackagePlus
    };
  }

  // 2. BOOKING_CONFIRMED / ASSIGNED: Paytm Blue Pill (bg-sky-50 text-[#002e6e] border border-sky-200)
  if (
    t.includes('confirmed') || 
    t.includes('assigned') || 
    t.includes('job_started') || 
    t.includes('on_the_way') || 
    t.includes('arrived') || 
    t === 'booking_confirmed' || 
    t === 'job_assigned'
  ) {
    return {
      pillStyle: 'bg-sky-50 text-[#002e6e] border border-sky-200',
      label: t.includes('assigned') ? 'PARTNER ASSIGNED' : t.includes('on_the_way') ? 'ON THE WAY' : 'BOOKING CONFIRMED',
      Icon: ShieldCheck
    };
  }

  // 3. PAYMENT_SUCCESS: Green Success Badge (bg-emerald-50 text-emerald-700 border border-emerald-200)
  if (
    t.includes('success') || 
    t.includes('completed') || 
    t.includes('received') || 
    t.includes('finalized') || 
    t === 'payment_success' || 
    t === 'payment_received'
  ) {
    return {
      pillStyle: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      label: t.includes('payment') ? 'PAYMENT SUCCESS' : 'SERVICE COMPLETED',
      Icon: CheckCircle2
    };
  }

  // Cancelled or Error
  if (t.includes('cancelled') || t.includes('error') || t.includes('failed')) {
    return {
      pillStyle: 'bg-rose-50 text-rose-700 border border-rose-200',
      label: 'CANCELLED',
      Icon: XCircle
    };
  }

  // Promotional or Offers
  if (t.includes('promotional') || t.includes('offer')) {
    return {
      pillStyle: 'bg-purple-50 text-purple-700 border border-purple-200',
      label: 'SPECIAL OFFER',
      Icon: Tag
    };
  }

  // System or Default
  return {
    pillStyle: 'bg-slate-100 text-slate-700 border border-slate-200',
    label: 'NOTIFICATION',
    Icon: Bell
  };
}

export default function NotificationsView({ 
  profile, 
  onNavigate 
}: { 
  profile: UserProfile; 
  onNavigate?: (tab: string, id?: string) => void;
}) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread' | 'bookings' | 'payments'>('all');

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

  const handleNotificationClick = async (n: Notification) => {
    if (!n.read) {
      markAsRead(n.id);
    }

    if (!onNavigate) return;

    const role = profile?.role || 'customer';
    const targetId = n.bookingId || undefined;

    if (role === 'admin') {
      // Admin Role: Navigates directly to Admin Bookings Management tab & highlights target bookingId
      onNavigate('admin', targetId);
    } else if (role === 'partner') {
      // Partner Role: Opens corresponding Job Card inside PartnerJobs
      if (n.type === 'wallet') {
        onNavigate('wallet');
      } else if (n.type === 'amc_lead') {
        onNavigate('amc-leads');
      } else {
        onNavigate('jobs', targetId);
      }
    } else {
      // Customer Role: Navigates directly to /bookings or opens specific bookingId
      if (n.type === 'promotional') {
        onNavigate('offers');
      } else if (n.type === 'payment_received') {
        onNavigate('wallet');
      } else {
        onNavigate('bookings', targetId);
      }
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'bookings') return !!n.bookingId || n.type?.includes('booking') || n.type?.includes('job');
    if (filter === 'payments') return n.type?.includes('payment') || n.type?.includes('wallet');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  if (loading) return <LoadingScreen message="Loading your notifications..." />;

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-6 py-6 sm:py-10">
      {/* Top Title & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Notifications
            </h1>
            {unreadCount > 0 && (
              <span className="bg-rose-500 text-white font-black text-[11px] px-2 py-0.5 rounded-full shadow-xs">
                {unreadCount} NEW
              </span>
            )}
          </div>
          <p className="text-slate-500 text-xs sm:text-sm font-medium mt-0.5">
            Real-time updates on bookings, service status & payments
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllAsRead}
            className="self-start sm:self-center text-xs font-bold text-[#002e6e] hover:text-blue-800 bg-sky-50 hover:bg-sky-100 px-3 py-1.5 rounded-xl border border-sky-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <CheckCheck size={14} />
            <span>Mark all as read</span>
          </button>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 mb-6 no-scrollbar">
        {[
          { id: 'all', label: 'All', count: notifications.length },
          { id: 'unread', label: 'Unread', count: unreadCount },
          { id: 'bookings', label: 'Bookings', count: notifications.filter(n => !!n.bookingId || n.type?.includes('booking') || n.type?.includes('job')).length },
          { id: 'payments', label: 'Payments', count: notifications.filter(n => n.type?.includes('payment') || n.type?.includes('wallet')).length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id as any)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all whitespace-nowrap cursor-pointer flex items-center gap-1.5 ${
              filter === tab.id
                ? 'bg-slate-900 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
            }`}
          >
            <span>{tab.label}</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-md ${
              filter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* Zomato-Style Interactive Notification Cards List */}
      <div className="space-y-3">
        {filteredNotifications.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 border border-slate-200/80 shadow-xs text-center space-y-3">
            <div className="w-14 h-14 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto">
              <Bell size={24} />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-800">No notifications found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                {filter === 'unread' 
                  ? 'You are all caught up! No unread notifications.' 
                  : 'Your notification inbox is clean and up-to-date.'}
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredNotifications.map((n) => {
              const badge = getNotificationBadge(n.type);
              const IconComponent = badge.Icon;

              return (
                <motion.div
                  key={n.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  onClick={() => handleNotificationClick(n)}
                  className={`bg-white rounded-2xl p-4 border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer relative group ${
                    !n.read ? 'ring-1 ring-blue-500/30 bg-gradient-to-r from-sky-50/30 via-white to-white' : 'opacity-90'
                  }`}
                >
                  {/* Unread indicator bar on left edge */}
                  {!n.read && (
                    <div className="absolute left-0 top-3 bottom-3 w-1 bg-[#002e6e] rounded-r-full" />
                  )}

                  {/* Card Header Row: Badge & Timestamp */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-wide flex items-center gap-1 ${badge.pillStyle}`}>
                        <IconComponent size={12} strokeWidth={2.5} />
                        <span>{badge.label}</span>
                      </span>

                      {!n.read && (
                        <span className="inline-flex items-center text-[9.5px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                          UNREAD
                        </span>
                      )}
                    </div>

                    <span className="text-[10.5px] font-semibold text-slate-400 shrink-0">
                      {formatNotificationTime(n.createdAt)}
                    </span>
                  </div>

                  {/* Card Main Body */}
                  <div className="pr-6">
                    <h3 className={`text-sm sm:text-base font-extrabold tracking-tight ${
                      !n.read ? 'text-slate-900' : 'text-slate-700'
                    } group-hover:text-blue-700 transition-colors`}>
                      {n.title}
                    </h3>
                    
                    <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1 line-clamp-2">
                      {n.message}
                    </p>
                  </div>

                  {/* Booking Ref & Footer Link */}
                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-slate-100 text-xs">
                    {n.bookingId ? (
                      <span className="font-mono text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-bold">
                        REF #{n.bookingId.slice(-6).toUpperCase()}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400 font-medium italic">
                        Zomindia Pulse
                      </span>
                    )}

                    <div className="flex items-center gap-1 text-[11px] font-black text-blue-600 group-hover:text-blue-800 transition-colors">
                      <span>View Details</span>
                      <ArrowUpRight size={13} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

