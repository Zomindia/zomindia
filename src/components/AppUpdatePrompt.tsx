import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { RefreshCw, X, Zap, Database, Check } from 'lucide-react';

export default function AppUpdatePrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [updateReason, setUpdateReason] = useState<string>('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateSuccess, setUpdateSuccess] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  useEffect(() => {
    let unsubscribeBookings = () => {};
    let unsubscribeNotifications = () => {};

    // Listen to Auth State
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Track bookings changes
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('customerId', '==', user.uid)
        );

        let initialBookingsLoaded = false;
        unsubscribeBookings = onSnapshot(bookingsQuery, (snapshot) => {
          if (!initialBookingsLoaded) {
            initialBookingsLoaded = true;
            return;
          }
          // On change, show update popup
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'modified' || change.type === 'added') {
              setUpdateReason(`Active service booking #${change.doc.id.slice(-6).toUpperCase()} was ${change.type === 'modified' ? 'updated in real-time' : 'assigned to pro'}`);
              setShowPrompt(true);
            }
          });
        });

        // Track notification updates
        const notificationsQuery = query(
          collection(db, 'notifications'),
          where('userId', '==', user.uid)
        );

        let initialNotifsLoaded = false;
        unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
          if (!initialNotifsLoaded) {
            initialNotifsLoaded = true;
            return;
          }
          snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
              setUpdateReason(`New system alert received: "${change.doc.data().title || 'Ecosystem update'}"`);
              setShowPrompt(true);
            }
          });
        });
      }
    });

    // Also listen to general Service Worker updates or hot reloads if registered
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        setUpdateReason('System files & PWA assets updated in the background');
        setShowPrompt(true);
      });
    }

    // Set a tiny mock listener to simulate background ecosystem push events purely for demo/manual testing
    const handleSimulateUpdate = (e: Event) => {
      const customEvent = e as CustomEvent;
      setUpdateReason(customEvent.detail?.reason || 'External registry schema update');
      setShowPrompt(true);
    };

    window.addEventListener('simulate-ecosystem-update', handleSimulateUpdate);

    return () => {
      unsubAuth();
      unsubscribeBookings();
      unsubscribeNotifications();
      window.removeEventListener('simulate-ecosystem-update', handleSimulateUpdate);
    };
  }, []);

  const handleUpdate = () => {
    setIsUpdating(true);
    setTimeout(() => {
      setIsUpdating(false);
      setUpdateSuccess(true);
      setTimeout(() => {
        window.location.reload();
      }, 800);
    }, 1200);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className="fixed top-24 left-4 right-4 md:left-auto md:right-8 z-[10000] max-w-sm ml-auto"
        >
          <div className="bg-slate-900 border border-slate-800 text-white rounded-[24px] p-5 shadow-2xl relative overflow-hidden flex flex-col gap-4">
            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/2" />
            
            {/* Header Content */}
            <div className="flex items-start gap-3 relative z-10">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center shrink-0">
                <Database size={18} className="animate-pulse" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[9px] font-black uppercase tracking-wider text-blue-400">Ecosystem Sync Alert</span>
                </div>
                <h4 className="text-xs font-black tracking-tight uppercase leading-snug text-white">
                  App Update Available
                </h4>
                <p className="text-[10px] text-slate-400 font-medium leading-relaxed mt-1 line-clamp-2 italic">
                  ℹ️ {updateReason || "Live background sync registry updated."}
                </p>
              </div>
              <button
                onClick={() => setShowPrompt(false)}
                className="p-1 text-slate-400 hover:text-white hover:bg-white/5 rounded-full transition-colors cursor-pointer shrink-0"
              >
                <X size={14} />
              </button>
            </div>

            {/* Action Bar */}
            <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80 relative z-10">
              <button
                onClick={handleUpdate}
                disabled={isUpdating || updateSuccess}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-blue-500/10"
              >
                {isUpdating ? (
                  <>
                    <RefreshCw size={12} className="animate-spin" />
                    Synchronizing...
                  </>
                ) : updateSuccess ? (
                  <>
                    <Check size={12} className="text-emerald-450" />
                    Console Synced
                  </>
                ) : (
                  <>
                    <RefreshCw size={12} />
                    Update App Console
                  </>
                )}
              </button>
              
              <button
                onClick={() => setShowPrompt(false)}
                className="px-4 py-3 hover:bg-white/5 text-slate-300 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-slate-800"
              >
                Later
              </button>
            </div>
            
            {/* Tiny helper context */}
            <div className="text-[8px] font-bold text-slate-500 uppercase tracking-widest text-center mt-1">
              Clicking update instantly refreshes assets & tracking metrics.
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
