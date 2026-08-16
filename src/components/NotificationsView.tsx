import React, { useState, useEffect } from 'react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  writeBatch, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Bell, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  X, 
  Sparkles, 
  CreditCard, 
  PackagePlus, 
  XCircle,
  CheckCheck,
  ArrowUpRight,
  Trash2,
  AlertTriangle,
  Zap,
  ArrowRight
} from 'lucide-react';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { LoadingScreen } from './LoadingIndicator';
import { formatNotificationTime } from '../utils/formatTime';
import { NotificationItem as Notification } from '../types';

type FilterCategory = 'all' | 'unread' | 'bookings' | 'payments' | 'offers';

interface NotificationTheme {
  category: 'booking' | 'payment' | 'offer' | 'cancelled' | 'general';
  label: string;
  Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  cardBorder: string;
  cardRing: string;
  cardBg: string;
  accentBar: string;
  pillGradient: string;
  iconBg: string;
  linkColor: string;
  refBadgeBg: string;
}

function getNotificationTheme(type: string): NotificationTheme {
  const t = (type || '').toLowerCase();

  // 1. Cancelled or Error
  if (t.includes('cancel') || t.includes('error') || t.includes('failed') || t.includes('reject')) {
    return {
      category: 'cancelled',
      label: 'CANCELLED',
      Icon: XCircle,
      cardBorder: 'border-rose-200/90 hover:border-rose-400',
      cardRing: 'ring-1 ring-rose-400/25 shadow-rose-100/50',
      cardBg: 'bg-gradient-to-r from-rose-50/60 via-white to-white',
      accentBar: 'bg-gradient-to-b from-rose-500 to-pink-600',
      pillGradient: 'bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-xs shadow-rose-200',
      iconBg: 'bg-rose-100 text-rose-600',
      linkColor: 'text-rose-600 group-hover:text-rose-800',
      refBadgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
    };
  }

  // 2. Promotional or Offers
  if (t.includes('promotional') || t.includes('offer') || t.includes('promo') || t.includes('discount') || t.includes('coupon') || t.includes('deal')) {
    return {
      category: 'offer',
      label: 'SPECIAL OFFER',
      Icon: Sparkles,
      cardBorder: 'border-amber-200/90 hover:border-amber-400',
      cardRing: 'ring-1 ring-amber-400/25 shadow-amber-100/50',
      cardBg: 'bg-gradient-to-r from-amber-50/60 via-white to-white',
      accentBar: 'bg-gradient-to-b from-amber-500 to-orange-500',
      pillGradient: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-xs shadow-amber-200',
      iconBg: 'bg-amber-100 text-amber-700',
      linkColor: 'text-amber-600 group-hover:text-orange-700',
      refBadgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  }

  // 3. Payments & Wallet
  if (
    t.includes('payment') || 
    t.includes('wallet') || 
    t.includes('refund') || 
    t.includes('invoice') || 
    t.includes('received') || 
    t.includes('credited') || 
    t.includes('debited') ||
    t === 'payment_success' || 
    t === 'payment_received'
  ) {
    return {
      category: 'payment',
      label: t.includes('refund') ? 'REFUND PROCESSED' : t.includes('wallet') ? 'WALLET UPDATE' : 'PAYMENT SUCCESS',
      Icon: CreditCard,
      cardBorder: 'border-emerald-200/90 hover:border-emerald-400',
      cardRing: 'ring-1 ring-emerald-400/25 shadow-emerald-100/50',
      cardBg: 'bg-gradient-to-r from-emerald-50/60 via-white to-white',
      accentBar: 'bg-gradient-to-b from-emerald-500 to-teal-600',
      pillGradient: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-xs shadow-emerald-200',
      iconBg: 'bg-emerald-100 text-emerald-700',
      linkColor: 'text-emerald-600 group-hover:text-teal-700',
      refBadgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    };
  }

  // 4. Booking updates
  if (
    t.includes('booking') || 
    t.includes('job') || 
    t.includes('assigned') || 
    t.includes('on_the_way') || 
    t.includes('arrived') || 
    t.includes('started') || 
    t.includes('completed') || 
    t.includes('confirmed') || 
    t.includes('pending') ||
    t === 'amc_lead'
  ) {
    return {
      category: 'booking',
      label: t.includes('assigned') 
        ? 'PARTNER ASSIGNED' 
        : t.includes('on_the_way') 
        ? 'ON THE WAY' 
        : t.includes('completed') 
        ? 'SERVICE COMPLETED' 
        : t.includes('confirmed') 
        ? 'BOOKING CONFIRMED' 
        : 'BOOKING UPDATE',
      Icon: ShieldCheck,
      cardBorder: 'border-sky-200/90 hover:border-sky-400',
      cardRing: 'ring-1 ring-sky-400/25 shadow-sky-100/50',
      cardBg: 'bg-gradient-to-r from-sky-50/60 via-white to-white',
      accentBar: 'bg-gradient-to-b from-sky-500 to-blue-600',
      pillGradient: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white shadow-xs shadow-sky-200',
      iconBg: 'bg-sky-100 text-sky-700',
      linkColor: 'text-sky-600 group-hover:text-blue-700',
      refBadgeBg: 'bg-sky-50 text-sky-800 border-sky-200',
    };
  }

  // 5. System or General
  return {
    category: 'general',
    label: 'ZOMINDIA UPDATE',
    Icon: Bell,
    cardBorder: 'border-indigo-200/90 hover:border-indigo-400',
    cardRing: 'ring-1 ring-indigo-400/25 shadow-indigo-100/50',
    cardBg: 'bg-gradient-to-r from-indigo-50/60 via-white to-white',
    accentBar: 'bg-gradient-to-b from-indigo-500 to-violet-600',
    pillGradient: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-xs shadow-indigo-200',
    iconBg: 'bg-indigo-100 text-indigo-700',
    linkColor: 'text-indigo-600 group-hover:text-violet-700',
    refBadgeBg: 'bg-indigo-50 text-indigo-800 border-indigo-200',
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
  const [filter, setFilter] = useState<FilterCategory>('all');
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
      if (typeof (window as any).__showToast === 'function') {
        (window as any).__showToast('All notifications marked as read! ✨');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, 'notifications/bulk');
    }
  };

  const handleDeleteSingle = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setDeletingId(id);
      // Optimistic update
      setNotifications(prev => prev.filter(n => n.id !== id));
      await deleteDoc(doc(db, 'notifications', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `notifications/${id}`);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAllConfirm = async () => {
    if (notifications.length === 0) return;
    setIsClearing(true);
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        batch.delete(doc(db, 'notifications', n.id));
      });
      // Optimistic state clear
      setNotifications([]);
      await batch.commit();
      setShowClearConfirmModal(false);
      if (typeof (window as any).__showToast === 'function') {
        (window as any).__showToast('Notification history cleared.');
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'notifications/clearAll');
    } finally {
      setIsClearing(false);
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
      onNavigate('admin', targetId);
    } else if (role === 'partner') {
      if (n.type === 'wallet' || n.type?.includes('payment')) {
        onNavigate('wallet');
      } else if (n.type === 'amc_lead') {
        onNavigate('amc-leads');
      } else {
        onNavigate('jobs', targetId);
      }
    } else {
      if (n.type === 'promotional' || n.type?.includes('offer') || n.type?.includes('coupon')) {
        onNavigate('offers');
      } else if (n.type === 'payment_received' || n.type?.includes('wallet')) {
        onNavigate('wallet');
      } else {
        onNavigate('bookings', targetId);
      }
    }
  };

  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'bookings') return !!n.bookingId || n.type?.includes('booking') || n.type?.includes('job') || n.type?.includes('service');
    if (filter === 'payments') return n.type?.includes('payment') || n.type?.includes('wallet') || n.type?.includes('refund') || n.type?.includes('invoice');
    if (filter === 'offers') return n.type?.includes('offer') || n.type?.includes('promotional') || n.type?.includes('promo') || n.type?.includes('discount');
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const bookingsCount = notifications.filter(n => !!n.bookingId || n.type?.includes('booking') || n.type?.includes('job') || n.type?.includes('service')).length;
  const paymentsCount = notifications.filter(n => n.type?.includes('payment') || n.type?.includes('wallet') || n.type?.includes('refund') || n.type?.includes('invoice')).length;
  const offersCount = notifications.filter(n => n.type?.includes('offer') || n.type?.includes('promotional') || n.type?.includes('promo') || n.type?.includes('discount')).length;

  const FILTER_TABS: {
    id: FilterCategory;
    label: string;
    count: number;
    activeGradient: string;
    activeShadow: string;
    activeRing: string;
    badgeActive: string;
    badgeInactive: string;
    icon: React.ComponentType<{ size?: number; className?: string }>;
  }[] = [
    {
      id: 'all',
      label: 'All',
      count: notifications.length,
      activeGradient: 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white',
      activeShadow: 'shadow-md shadow-indigo-200',
      activeRing: 'ring-2 ring-indigo-400/30',
      badgeActive: 'bg-white/20 text-white font-black',
      badgeInactive: 'bg-indigo-50 text-indigo-700 font-bold',
      icon: Bell,
    },
    {
      id: 'unread',
      label: 'Unread',
      count: unreadCount,
      activeGradient: 'bg-gradient-to-r from-rose-500 to-pink-500 text-white',
      activeShadow: 'shadow-md shadow-rose-200',
      activeRing: 'ring-2 ring-rose-400/30',
      badgeActive: 'bg-white/25 text-white font-black',
      badgeInactive: 'bg-rose-50 text-rose-700 font-bold',
      icon: AlertTriangle,
    },
    {
      id: 'bookings',
      label: 'Bookings',
      count: bookingsCount,
      activeGradient: 'bg-gradient-to-r from-sky-500 to-blue-600 text-white',
      activeShadow: 'shadow-md shadow-sky-200',
      activeRing: 'ring-2 ring-sky-400/30',
      badgeActive: 'bg-white/25 text-white font-black',
      badgeInactive: 'bg-sky-50 text-sky-700 font-bold',
      icon: PackagePlus,
    },
    {
      id: 'payments',
      label: 'Payments',
      count: paymentsCount,
      activeGradient: 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white',
      activeShadow: 'shadow-md shadow-emerald-200',
      activeRing: 'ring-2 ring-emerald-400/30',
      badgeActive: 'bg-white/25 text-white font-black',
      badgeInactive: 'bg-emerald-50 text-emerald-700 font-bold',
      icon: CreditCard,
    },
    {
      id: 'offers',
      label: 'Offers',
      count: offersCount,
      activeGradient: 'bg-gradient-to-r from-amber-500 to-orange-500 text-white',
      activeShadow: 'shadow-md shadow-amber-200',
      activeRing: 'ring-2 ring-amber-400/30',
      badgeActive: 'bg-white/25 text-white font-black',
      badgeInactive: 'bg-amber-50 text-amber-700 font-bold',
      icon: Sparkles,
    },
  ];

  if (loading) return <LoadingScreen message="Loading your vibrant notifications..." />;

  return (
    <div className="min-h-[calc(100vh-80px)] bg-gradient-to-b from-indigo-50/70 via-sky-50/50 to-white -mx-3 sm:-mx-6 -my-6 sm:-my-10 px-3 sm:px-6 py-6 sm:py-10 transition-colors duration-300">
      <div className="max-w-3xl mx-auto">
        {/* Top Title & Vibrant Header Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-sky-500 flex items-center justify-center text-white shadow-md shadow-indigo-200/80">
                <Bell size={20} className="animate-pulse" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight bg-gradient-to-r from-indigo-900 via-blue-900 to-indigo-800 bg-clip-text text-transparent">
                Notifications
              </h1>
              {unreadCount > 0 && (
                <span className="bg-gradient-to-r from-rose-500 to-pink-500 text-white font-black text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full shadow-sm shadow-rose-200 flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  {unreadCount} NEW
                </span>
              )}
            </div>
            <p className="text-slate-600 text-xs sm:text-sm font-medium mt-1 pl-0.5">
              Live instant updates on your bookings, technician assignments & cashback
            </p>
          </div>

          {/* Action Buttons: Mark as Read & Clear All */}
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-center">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllAsRead}
                className="text-xs font-bold text-white bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-700 hover:from-indigo-700 hover:to-blue-800 px-3.5 py-2 rounded-xl shadow-sm shadow-indigo-200 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 border-0"
                title="Mark all notifications as read"
              >
                <CheckCheck size={14} />
                <span>Mark all as read</span>
              </button>
            )}

            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => setShowClearConfirmModal(true)}
                className="text-xs font-bold text-rose-700 hover:text-rose-800 bg-rose-50 hover:bg-rose-100/80 active:bg-rose-200 px-3.5 py-2 rounded-xl border border-rose-200/80 transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shadow-2xs"
                title="Clear all notification history"
              >
                <Trash2 size={14} className="text-rose-600" />
                <span>Clear All</span>
              </button>
            )}
          </div>
        </div>

        {/* Colorful Category Filter Tabs */}
        <div className="flex items-center gap-2.5 overflow-x-auto pb-3 mb-6 no-scrollbar pt-1">
          {FILTER_TABS.map((tab) => {
            const isSelected = filter === tab.id;
            const Icon = tab.icon;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-4 py-2 rounded-2xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                  isSelected
                    ? `${tab.activeGradient} ${tab.activeShadow} ${tab.activeRing} scale-[1.02]`
                    : 'bg-white/85 backdrop-blur-sm text-slate-700 hover:bg-white hover:text-slate-900 border border-indigo-100/90 shadow-2xs hover:shadow-xs'
                }`}
              >
                <Icon size={14} className={isSelected ? 'text-white' : 'text-slate-500'} />
                <span>{tab.label}</span>
                <span className={`text-[10.5px] px-2 py-0.5 rounded-lg transition-colors ${
                  isSelected ? tab.badgeActive : tab.badgeInactive
                }`}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Notification Cards List or Vibrant Empty State */}
        <div className="space-y-3.5">
          {filteredNotifications.length === 0 ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="bg-white/95 backdrop-blur-md rounded-3xl p-8 sm:p-12 border border-indigo-100/80 shadow-lg shadow-indigo-100/40 text-center space-y-4 max-w-lg mx-auto relative overflow-hidden"
            >
              {/* Background ambient decorative glow */}
              <div className="absolute -right-12 -top-12 w-36 h-36 bg-indigo-200/30 rounded-full blur-2xl pointer-events-none" />
              <div className="absolute -left-12 -bottom-12 w-36 h-36 bg-sky-200/30 rounded-full blur-2xl pointer-events-none" />

              <div className="relative">
                <div className="w-18 h-18 bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-white rounded-3xl flex items-center justify-center mx-auto shadow-lg shadow-indigo-200/70 ring-4 ring-white">
                  {filter === 'all' ? (
                    <Bell size={32} className="animate-bounce" />
                  ) : filter === 'unread' ? (
                    <CheckCircle2 size={32} />
                  ) : filter === 'bookings' ? (
                    <PackagePlus size={32} />
                  ) : filter === 'payments' ? (
                    <CreditCard size={32} />
                  ) : (
                    <Sparkles size={32} />
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900 tracking-tight">
                  {filter === 'unread' 
                    ? 'All Caught Up! 🎉' 
                    : filter === 'bookings'
                    ? 'No Booking Alerts Yet'
                    : filter === 'payments'
                    ? 'No Payment Alerts'
                    : filter === 'offers'
                    ? 'No Active Offers Here'
                    : 'Your Inbox is Sparkling Clean! ✨'}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-xs mx-auto mt-1.5 leading-relaxed">
                  {filter === 'unread' 
                    ? 'You have read all your notifications. Stay tuned for real-time service updates!'
                    : filter === 'bookings'
                    ? 'When you schedule an AC repair, electrician, or cleaning job, updates appear right here.'
                    : filter === 'payments'
                    ? 'Your instant payment receipts, invoices and cashback rewards will appear here.'
                    : filter === 'offers'
                    ? 'Check back soon for exclusive seasonal discounts and coupon drops!'
                    : 'We will notify you immediately when your technician is on the way or your service is updated.'}
                </p>
              </div>

              {filter !== 'all' && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setFilter('all')}
                    className="px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-700 hover:to-blue-700 text-white text-xs font-bold rounded-xl shadow-md shadow-indigo-200 transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <span>View All Notifications ({notifications.length})</span>
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}
            </motion.div>
          ) : (
            <AnimatePresence mode="popLayout">
              {filteredNotifications.map((n) => {
                const theme = getNotificationTheme(n.type);
                const IconComponent = theme.Icon;

                return (
                  <motion.div
                    key={n.id}
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.92, height: 0, marginBottom: 0, transition: { duration: 0.2 } }}
                    onClick={() => handleNotificationClick(n)}
                    className={`rounded-3xl p-5 border shadow-sm hover:shadow-md transition-all cursor-pointer relative group overflow-hidden ${
                      theme.cardBorder
                    } ${theme.cardBg} ${!n.read ? `${theme.cardRing} shadow-md` : 'opacity-95'}`}
                  >
                    {/* Left Accent Bar */}
                    <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${theme.accentBar} ${!n.read ? 'w-2' : ''}`} />

                    {/* Top-Right Dismiss / Delete Button */}
                    <div className="absolute top-4 right-4 flex items-center gap-1.5 z-10">
                      <button
                        type="button"
                        disabled={deletingId === n.id}
                        onClick={(e) => handleDeleteSingle(n.id, e)}
                        className="p-1.5 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 transition-all opacity-60 group-hover:opacity-100 cursor-pointer bg-white/70 shadow-2xs"
                        title="Dismiss notification"
                      >
                        <X size={14} />
                      </button>
                    </div>

                    {/* Card Header Row: Vibrant Badge & Timestamp */}
                    <div className="flex items-center justify-between gap-2 mb-2.5 pr-8 pl-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-wider flex items-center gap-1.5 ${theme.pillGradient}`}>
                          <IconComponent size={12} strokeWidth={2.5} />
                          <span>{theme.label}</span>
                        </span>

                        {!n.read && (
                          <span className="inline-flex items-center gap-1 text-[9.5px] font-black text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md border border-rose-200 animate-pulse">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            UNREAD
                          </span>
                        )}
                      </div>

                      <span className="text-[11px] font-bold text-slate-600 shrink-0 flex items-center gap-1">
                        <Clock size={11} className="text-slate-500" />
                        {formatNotificationTime(n.createdAt)}
                      </span>
                    </div>

                    {/* Card Main Body */}
                    <div className="pr-8 pl-1">
                      <h3 className={`text-sm sm:text-base font-black tracking-tight ${
                        !n.read ? 'text-slate-900' : 'text-slate-800'
                      } group-hover:text-indigo-900 transition-colors`}>
                        {n.title}
                      </h3>
                      
                      <p className="text-xs sm:text-[13px] text-slate-600 font-medium leading-relaxed mt-1 line-clamp-2">
                        {n.message}
                      </p>
                    </div>

                    {/* Booking Ref & Footer Link */}
                    <div className="flex items-center justify-between mt-3.5 pt-2.5 border-t border-slate-100/90 text-xs pl-1">
                      {n.bookingId ? (
                        <span className={`font-mono text-[10.5px] px-2.5 py-0.5 rounded-lg font-black border ${theme.refBadgeBg}`}>
                          REF #{n.bookingId.slice(-6).toUpperCase()}
                        </span>
                      ) : (
                        <span className="text-[10.5px] text-indigo-800/80 font-bold flex items-center gap-1">
                          <Zap size={11} className="text-indigo-600" />
                          <span>Zomindia Verified</span>
                        </span>
                      )}

                      <div className={`flex items-center gap-1 text-[11px] font-black transition-colors ${theme.linkColor}`}>
                        <span>View Details</span>
                        <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {/* Confirmation Modal: Clear All Notifications */}
        <AnimatePresence>
          {showClearConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => !isClearing && setShowClearConfirmModal(false)}
                className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs"
              />

              {/* Dialog Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 16 }}
                className="relative w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl border border-rose-100 overflow-hidden text-center z-10"
              >
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-500 to-pink-500 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-rose-200">
                  <Trash2 size={24} />
                </div>

                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Clear All Notifications?
                </h3>
                
                <p className="text-xs text-slate-600 font-medium leading-relaxed mt-1.5 mb-6">
                  Are you sure you want to clear your notification history? This will permanently remove all notification cards from your view.
                </p>

                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={isClearing}
                    onClick={() => setShowClearConfirmModal(false)}
                    className="flex-1 py-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-all cursor-pointer"
                  >
                    Keep Them
                  </button>
                  <button
                    type="button"
                    disabled={isClearing}
                    onClick={handleClearAllConfirm}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-rose-200 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 border-0"
                  >
                    {isClearing ? (
                      <span>Clearing...</span>
                    ) : (
                      <>
                        <Trash2 size={13} />
                        <span>Yes, Clear All</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

