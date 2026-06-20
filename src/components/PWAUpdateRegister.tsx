import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, RefreshCw, X } from 'lucide-react';

export function PWAUpdateRegister() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered:', r);
    },
    onRegisterError(error) {
      console.error('SW registration error:', error);
    }
  });

  const closeRefreshBanner = () => {
    setNeedRefresh(false);
  };

  return (
    <AnimatePresence>
      {/* 1. Update / Refresh PWA service worker banner */}
      {needRefresh && (
        <motion.div
          id="pwa-update-banner"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] w-full max-w-md px-4"
        >
          <div className="bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 text-white rounded-2xl shadow-2xl shadow-red-900/40 p-4 border border-rose-500/20 backdrop-blur-md">
            <div className="flex items-start gap-3">
              <div className="bg-white/10 p-2 rounded-xl mt-0.5 animate-pulse">
                <Sparkles className="w-5 h-5 text-yellow-300" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold tracking-tight text-white flex items-center gap-1.5">
                  Update Available
                </h4>
                <p className="text-xs text-rose-50/90 mt-1 font-medium leading-relaxed">
                  🚀 Zomindia का नया कड़क अपडेट आ गया है!
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <button
                    id="pwa-update-btn"
                    onClick={() => updateServiceWorker(true)}
                    className="flex-1 bg-white hover:bg-rose-50 text-red-700 text-xs font-black py-2.5 px-4 rounded-xl transition duration-150 flex items-center justify-center gap-2 shadow-sm hover:shadow active:scale-[0.98]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Update Now
                  </button>
                  <button
                    id="pwa-update-close-btn"
                    onClick={closeRefreshBanner}
                    className="bg-white/10 hover:bg-white/20 text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition duration-150 hover:text-white"
                  >
                    Later
                  </button>
                </div>
              </div>

              <button
                onClick={closeRefreshBanner}
                className="text-white/60 hover:text-white hover:bg-white/10 p-1.5 rounded-lg transition duration-150 ml-1"
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
