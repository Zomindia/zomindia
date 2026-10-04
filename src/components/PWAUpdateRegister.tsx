import React, { useState, useEffect, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

export function PWAUpdateRegister() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [_offlineReady, setOfflineReady] = useState(false);
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    // 1. Listen for custom pwa-update-available event dispatched from main.tsx or sw listener
    const handleUpdateAvailable = () => {
      console.log('[PWAUpdateRegister] Custom pwa-update-available event received.');
      setNeedRefresh(true);
    };

    window.addEventListener('pwa-update-available', handleUpdateAvailable);

    // 2. Initialize vanilla virtual:pwa-register without React dispatcher conflicts
    try {
      updateSWRef.current = registerSW({
        onNeedRefresh() {
          console.log('[PWAUpdateRegister] onNeedRefresh triggered from service worker.');
          setNeedRefresh(true);
        },
        onOfflineReady() {
          console.log('[PWAUpdateRegister] onOfflineReady triggered.');
          setOfflineReady(true);
        },
        onRegistered(r) {
          console.log('[PWAUpdateRegister] Service Worker registered:', r?.scope);
        },
        onRegisterError(error) {
          console.error('[PWAUpdateRegister] Service Worker registration error:', error);
        }
      });
    } catch (e) {
      console.warn('[PWAUpdateRegister] Failed to register SW via virtual:pwa-register:', e);
    }

    return () => {
      window.removeEventListener('pwa-update-available', handleUpdateAvailable);
    };
  }, []);

  const closeRefreshBanner = () => {
    setNeedRefresh(false);
  };

  const handleUpdateClick = async () => {
    try {
      if (updateSWRef.current) {
        await updateSWRef.current(true);
        return;
      }
    } catch (err) {
      console.warn('[PWA] updateSW call error, attempting manual worker update:', err);
    }

    // Direct fallback logic: search registrations and post message to skip waiting
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        let skipped = false;
        for (const reg of registrations) {
          if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
            skipped = true;
          }
        }
        if (skipped) {
          // Allow a brief moment for sw to skip waiting and controllerchange to trigger
          setTimeout(() => {
            window.location.reload();
          }, 500);
        } else {
          // Force reload if no waiting worker detected but user clicked update
          window.location.reload();
        }
      } catch (e) {
        console.error('[PWA] Manual fallback update process failed:', e);
        window.location.reload();
      }
    } else {
      window.location.reload();
    }
  };

  return (
    <AnimatePresence>
      {/* Standalone, top-floating notification pill for updates */}
      {needRefresh && (
        <motion.div
          id="pwa-update-banner"
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="fixed top-24 left-4 right-4 md:left-1/2 md:right-auto md:-translate-x-1/2 md:w-full md:max-w-md z-[110000] overflow-hidden"
        >
          <div className="bg-gradient-to-r from-red-600 via-purple-700 to-indigo-800 text-white rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-4 border border-white/10 backdrop-blur-md relative">
            <div className="flex items-start gap-3 relative z-10">
              <div className="bg-white/10 p-2 rounded-xl mt-0.5 shrink-0">
                <Sparkles className="w-5 h-5 text-yellow-300 animate-pulse" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-black tracking-tight text-white flex items-center gap-1.5 font-sans">
                  System Update Available
                </h4>
                <p className="text-xs text-white/90 mt-1 font-semibold leading-relaxed font-sans">
                  A newer version of Zomindia is ready. Please refresh to apply the latest security and performance improvements.
                </p>
                <div className="flex items-center gap-3 mt-3.5">
                  <button
                    id="pwa-update-btn"
                    onClick={handleUpdateClick}
                    className="flex-1 bg-white hover:bg-slate-50 text-purple-900 text-xs font-black py-2.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-sm hover:shadow active:scale-[0.98] border-0 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Update Now
                  </button>
                  <button
                    id="pwa-update-close-btn"
                    onClick={closeRefreshBanner}
                    className="bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition duration-150 border-0 cursor-pointer"
                  >
                    Later
                  </button>
                </div>
              </div>

              <button
                onClick={closeRefreshBanner}
                className="text-white/60 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition duration-150 ml-1 cursor-pointer border-0"
                aria-label="Close update alert"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PWAUpdateRegister;
