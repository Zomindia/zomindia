import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestore-errors';
import { isPushPermissionDeniedOrRestricted } from '../lib/fcm';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, CheckCircle, ShieldCheck, Clock } from 'lucide-react';
import { playSuccessChime } from '../lib/audio';
import { LogoIcon } from './BrandLogo';
const logoImg = LogoIcon;

interface Props {
  onNavigate?: (tab: any, arg?: string) => void;
}

export default function NotificationSystem({ onNavigate }: Props) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());
  const [user, setUser] = useState(auth.currentUser);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Safely request notification permission only if supported, not in restricted iframe, and not denied
    if (!isPushPermissionDeniedOrRestricted() && 'Notification' in window && Notification.permission === 'default') {
      try {
        Notification.requestPermission().catch(() => {});
      } catch {
        // Silently catch permission request rejection in sandboxes
      }
    }
  }, []);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (u) => {
      setUser(u);
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    // Request notification permission safely after successful login handshake
    if (user && !isPushPermissionDeniedOrRestricted()) {
      if ('Notification' in window && Notification.permission === 'default') {
        try {
          Notification.requestPermission().catch(() => {});
        } catch {
          // Silently catch permission request rejection in sandboxes
        }
      }
    }
  }, [user]);

  // Helper to trigger exactly one OS notification without dual-dispatch
  const triggerSingleOSNotification = (title: string, options: { body: string; icon?: string; tag?: string }) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body: options.body,
          icon: options.icon || '/logo-192.png',
          badge: '/logo-192.png',
          tag: options.tag
        });
      }).catch(() => {
        try {
          new Notification(title, {
            body: options.body,
            icon: options.icon || '/logo-192.png',
            tag: options.tag
          });
        } catch (e) {
          console.warn('Native notification fallback warning:', e);
        }
      });
    } else {
      try {
        new Notification(title, {
          body: options.body,
          icon: options.icon || '/logo-192.png',
          tag: options.tag
        });
      } catch (e) {
        console.warn('Native notification warning:', e);
      }
    }
  };

  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    let isMounted = true;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      if (!isMounted) return;
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

        // Trigger single OS notification for entirely new items
        if (entirelyNew.length > 0) {
          entirelyNew.forEach((notif: any) => {
            triggerSingleOSNotification(notif.title || 'New Notification', {
              body: notif.message,
              icon: '/logo-192.png',
              tag: `notif-${notif.id}`
            });
          });
        }
        
        return newNotifications;
      });
    }, (err) => {
      if (!isMounted) return;
      if (err.code === 'permission-denied') return;
      handleFirestoreError(err, OperationType.LIST, 'notifications');
    });

    return () => {
      isMounted = false;
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      if (id.startsWith('test_')) {
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
        return;
      }
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Failed to mark notification as read', err);
    }
  };

  // Instant dismiss handler (removes immediately from view, then syncs Firestore)
  const handleDismiss = useCallback((id: string) => {
    setDismissedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    markAsRead(id);
  }, []);

  // Show at most 1 active unread toast that has not been dismissed yet
  const activeToast = useMemo(() => {
    return notifications.find((n) => !dismissedIds.has(n.id) && !n.read) || null;
  }, [notifications, dismissedIds]);

  // Expose global test trigger so the Customer Dashboard trigger button works anytime
  useEffect(() => {
    (window as any).__triggerTestNotification = (custom?: any) => {
      const testId = 'test_' + Date.now();
      const sampleTypes = [
        {
          type: 'booking_assigned',
          title: 'Technician Assigned! 🚀',
          message: 'Sunil Sharma (4.9★) accepted your booking and is en-route.',
        },
        {
          type: 'job_completed',
          title: 'Service Completed! ✨',
          message: 'Your AC Deep Clean has been finished. Rate your pro and review warranty.',
        },
        {
          type: 'payment_received',
          title: 'Payment Received ₹799! 💳',
          message: 'Digital UPI receipt generated. 30-Day service warranty activated.',
        }
      ];
      const randomSample = sampleTypes[Math.floor(Math.random() * sampleTypes.length)];
      const testItem = {
        id: testId,
        title: custom?.title || randomSample.title,
        message: custom?.message || randomSample.message,
        type: custom?.type || randomSample.type,
        read: false,
        createdAt: new Date().toISOString(),
        ...custom,
      };

      setDismissedIds((prev) => {
        const next = new Set(prev);
        next.delete(testId);
        return next;
      });

      setNotifications((prev) => [testItem, ...prev.filter((n) => n.id !== testId)]);
      playSuccessChime();
    };

    return () => {
      delete (window as any).__triggerTestNotification;
    };
  }, []);

  // Auto-dismiss active toast after exactly 4 seconds
  useEffect(() => {
    if (!activeToast) return;
    const toastId = activeToast.id;
    const timer = setTimeout(() => {
      handleDismiss(toastId);
    }, 4000);

    return () => clearTimeout(timer);
  }, [activeToast?.id, handleDismiss]);

  return (
    <div className="fixed top-20 right-4 sm:right-6 left-4 sm:left-auto z-[9999] pointer-events-none flex flex-col items-center sm:items-end w-auto max-w-sm sm:max-w-md">
      <AnimatePresence mode="wait">
        {activeToast && (
          <motion.div
            key={activeToast.id}
            initial={{ opacity: 0, y: -16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95, filter: 'blur(4px)' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            onClick={() => {
              handleDismiss(activeToast.id);
              if (onNavigate) {
                if (activeToast.type === 'promotional') onNavigate('offers');
                else if (activeToast.type === 'payment_received') onNavigate('wallet');
                else if (activeToast.bookingId) onNavigate('bookings', activeToast.bookingId);
                else onNavigate('notifications');
              }
            }}
            className={`w-full p-4 rounded-2xl shadow-2xl pointer-events-auto flex items-start gap-4 relative overflow-hidden group border cursor-pointer hover:scale-[1.01] active:scale-[0.99] transition-all duration-200 ${
              (activeToast.type?.includes('success') || activeToast.type === 'job_completed' || activeToast.type === 'payment_received' || activeToast.type === 'job_finalized') ? 'bg-emerald-600 text-white border-emerald-500 shadow-emerald-500/20' :
              (activeToast.type?.includes('booking') || activeToast.type === 'job_started' || activeToast.type === 'on_the_way' || activeToast.type === 'arrived') ? 'bg-blue-700 text-white border-blue-600 shadow-blue-700/20' :
              (activeToast.type?.includes('warning') || activeToast.type === 'booking_pending' || activeToast.type === 'pending_parts') ? 'bg-orange-500 text-white border-orange-400 shadow-orange-500/20' :
              (activeToast.type?.includes('error') || activeToast.type === 'booking_cancelled') ? 'bg-rose-600 text-white border-rose-500 shadow-rose-600/20' :
              'bg-[#002e6e] text-white border-[#002e6e] shadow-lg'
            }`}
          >
            <div className="shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-150 ring-4 ring-white/10 relative overflow-visible">
              <img src={logoImg} alt="Notification Logo" className="w-8 h-8 object-contain" referrerPolicy="no-referrer" />
              <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white border border-white text-[8px] font-bold shadow-sm ${
                (activeToast.type?.includes('success') || activeToast.type === 'job_completed' || activeToast.type === 'payment_received' || activeToast.type === 'job_finalized') ? 'bg-emerald-500' :
                (activeToast.type?.includes('booking') || activeToast.type === 'job_started' || activeToast.type === 'on_the_way' || activeToast.type === 'arrived') ? 'bg-blue-600' :
                (activeToast.type?.includes('warning') || activeToast.type === 'booking_pending' || activeToast.type === 'pending_parts') ? 'bg-orange-500' :
                (activeToast.type?.includes('error') || activeToast.type === 'booking_cancelled') ? 'bg-rose-600' :
                'bg-slate-800'
              }`}>
                {(activeToast.type?.includes('success') || activeToast.type === 'job_completed' || activeToast.type === 'payment_received' || activeToast.type === 'job_finalized') ? <CheckCircle size={10} strokeWidth={3} /> :
                 (activeToast.type?.includes('booking') || activeToast.type === 'job_started' || activeToast.type === 'on_the_way' || activeToast.type === 'arrived') ? <ShieldCheck size={10} strokeWidth={3} /> :
                 (activeToast.type?.includes('warning') || activeToast.type === 'booking_pending' || activeToast.type === 'pending_parts') ? <Clock size={10} strokeWidth={3} /> :
                 (activeToast.type?.includes('error') || activeToast.type === 'booking_cancelled') ? <X size={10} strokeWidth={3} /> :
                 <Bell size={10} strokeWidth={3} />}
              </div>
            </div>
            <div className="flex-1 min-w-0 pt-1">
              <h4 className="font-extrabold tracking-tight text-sm text-white mb-0.5">{activeToast.title}</h4>
              <p className="text-white/90 text-[11px] leading-relaxed font-semibold italic opacity-80">{activeToast.message}</p>
            </div>
            <button 
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss(activeToast.id);
              }}
              className="shrink-0 p-1.5 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors place-self-start relative z-10 cursor-pointer"
              title="Dismiss"
              aria-label="Dismiss notification"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
