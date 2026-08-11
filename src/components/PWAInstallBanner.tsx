import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Zap, Info } from 'lucide-react';
import { LogoIcon } from './BrandLogo';

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [showToast, setShowToast] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if running in standalone PWA mode
    const isStandaloneMode =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      document.referrer.includes('android-app://');

    setIsStandalone(isStandaloneMode);
    if (isStandaloneMode) return;

    // 2. Check for existing deferredPrompt in global window object
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    // 3. Listen for beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      setDeferredPrompt(e);
    };

    // 4. Listen for appinstalled event
    const handleAppInstalled = () => {
      console.log('[PWA] App installed successfully');
      (window as any).deferredPrompt = null;
      setDeferredPrompt(null);
      setShowBanner(false);
      setShowToast(false);
    };

    // 5. Custom event trigger (e.g., manually triggered from settings or headers)
    const handleManualTrigger = () => {
      setShowBanner(true);
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('trigger-pwa-install', handleManualTrigger);

    // 6. 30-Second Auto-Popup Timer
    const timer = setTimeout(() => {
      try {
        const dismissed = sessionStorage.getItem('zomindia_pwa_dismissed') === 'true';
        if (!dismissed) {
          setShowBanner(true);
        }
      } catch (err) {
        setShowBanner(true);
      }
    }, 30000); // 30 seconds delay after session load

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('trigger-pwa-install', handleManualTrigger);
    };
  }, []);

  const handleInstall = async () => {
    const prompt = deferredPrompt || (window as any).deferredPrompt;

    if (!prompt) {
      console.warn('[PWA] Install prompt not available yet, displaying guide toast.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 6000);
      return;
    }

    try {
      setIsInstalling(true);
      await prompt.prompt();
      const choice = await prompt.userChoice;
      console.log(`[PWA] Install choice outcome: ${choice.outcome}`);
      if (choice.outcome === 'accepted') {
        (window as any).deferredPrompt = null;
        setDeferredPrompt(null);
        setShowBanner(false);
        setShowToast(false);
      } else {
        // User dismissed the native dialog
        setShowToast(true);
        setTimeout(() => setShowToast(false), 6000);
      }
    } catch (err) {
      console.error('[PWA] Installation prompt failed:', err);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 6000);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    try {
      sessionStorage.setItem('zomindia_pwa_dismissed', 'true');
    } catch (e) {
      // Storage restricted
    }
  };

  if (isStandalone) return null;

  return (
    <>
      {/* Toast message when native prompt is not yet available */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-4 z-[120000] max-w-sm w-full mx-auto sm:mx-0 pointer-events-auto"
          >
            <div className="bg-[#002e6e] text-white p-3.5 rounded-2xl shadow-2xl border border-white/20 flex items-start gap-3">
              <div className="p-1.5 bg-cyan-500/20 rounded-xl text-cyan-300 shrink-0 mt-0.5">
                <Info className="w-4 h-4" />
              </div>
              <div className="flex-1 text-xs">
                <p className="font-bold text-white">App installation ready!</p>
                <p className="text-slate-200 mt-0.5 leading-snug">
                  Tap <span className="font-bold text-cyan-300">⋮ menu</span> in Chrome and select{' '}
                  <span className="font-bold text-cyan-300">'Add to Home screen'</span>.
                </p>
              </div>
              <button
                onClick={() => setShowToast(false)}
                className="text-slate-300 hover:text-white p-1 rounded-lg border-0 bg-transparent cursor-pointer"
                aria-label="Close toast"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating PWA Install Banner */}
      <AnimatePresence>
        {showBanner && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.95 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-4 z-[110000] max-w-sm w-full mx-auto sm:mx-0 pointer-events-auto"
          >
            <div className="bg-white/95 backdrop-blur-md rounded-3xl p-3.5 border border-slate-200/80 shadow-2xl flex items-center justify-between gap-3">
              {/* Left side: Icon & Title */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <div className="relative shrink-0 w-10 h-10 rounded-2xl bg-slate-50 p-1 border border-slate-200/80 shadow-sm flex items-center justify-center overflow-hidden">
                  <img
                    src={LogoIcon}
                    alt="Zomindia"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).setAttribute('src', '/logo-192.png');
                    }}
                  />
                  <span className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border border-white">
                    <Zap className="w-2.5 h-2.5 fill-white" />
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs text-[#002e6e] truncate leading-tight">
                    Install Zomindia App
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                    1-Click Booking & Live Tracking
                  </p>
                </div>
              </div>

              {/* Right side: Action Button & Close */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="bg-[#002e6e] hover:bg-[#00baf2] active:scale-95 text-white font-bold text-xs px-3.5 py-2 rounded-full shadow-md shadow-[#002e6e]/20 transition-all flex items-center gap-1 cursor-pointer border-0"
                >
                  {isInstalling ? (
                    <span>...</span>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Install</span>
                    </>
                  )}
                </button>

                <button
                  onClick={handleDismiss}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors cursor-pointer border-0"
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

export default PWAInstallBanner;
