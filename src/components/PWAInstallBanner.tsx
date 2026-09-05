import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Zap } from 'lucide-react';
import { LogoIcon } from './BrandLogo';

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.zomindia.twa&pcampaignid=web_share';

export function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');

  useEffect(() => {
    const checkStandalone = (): boolean => {
      try {
        if (localStorage.getItem('zomindia_pwa_installed') === 'true') return true;
      } catch {}

      return (
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://')
      );
    };

    const isDismissedRecently = (): boolean => {
      try {
        const dismissedUntil = localStorage.getItem('zomindia_pwa_dismissed_until');
        if (dismissedUntil && Date.now() < parseInt(dismissedUntil, 10)) {
          return true;
        }
      } catch {}
      return false;
    };

    if (checkStandalone()) {
      setIsStandalone(true);
      return;
    }

    if (isDismissedRecently()) {
      return;
    }

    const timer = setTimeout(() => {
      setShowBanner(true);
    }, 1500);

    return () => clearTimeout(timer);
  }, []);

  const handleInstall = async () => {
    // Android devices directly launch the Google Play Store page
    if (isAndroid) {
      window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
      setShowBanner(false);
      return;
    }

    // Desktop browser fallback for native PWA installation
    const prompt = (window as any).deferredPrompt;
    if (prompt && typeof prompt.prompt === 'function') {
      try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome === 'accepted') {
          localStorage.setItem('zomindia_pwa_installed', 'true');
          (window as any).deferredPrompt = null;
          setShowBanner(false);
          setIsStandalone(true);
        }
      } catch {
        window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
        setShowBanner(false);
      }
    } else {
      window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
      setShowBanner(false);
    }
  };

  const handleDismiss = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowBanner(false);
    try {
      const dismissedUntil = Date.now() + 7 * 24 * 60 * 60 * 1000;
      localStorage.setItem('zomindia_pwa_dismissed_until', dismissedUntil.toString());
    } catch {}
  };

  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          id="pwa-install-banner"
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 280 }}
          className="fixed bottom-24 md:bottom-8 left-3 right-3 sm:left-auto sm:right-6 z-[60] max-w-sm w-full mx-auto sm:mx-0 pointer-events-auto"
        >
          <div className="relative bg-white/95 backdrop-blur-md rounded-3xl p-3.5 border border-slate-200/90 shadow-[0_16px_36px_-6px_rgba(0,46,110,0.18)] flex items-center justify-between gap-3">
            <button
              onClick={handleDismiss}
              className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer border-0"
              aria-label="Dismiss banner"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
              <div className="relative shrink-0 w-11 h-11 rounded-2xl bg-white p-1.5 border border-slate-200/90 shadow-sm flex items-center justify-center overflow-hidden">
                <img
                  src={LogoIcon || '/logo-192.png'}
                  alt="Zomindia"
                  className="w-full h-full object-contain select-none"
                  onError={(e) => {
                    (e.target as HTMLElement).setAttribute('src', '/logo-192.png');
                  }}
                />
                <span className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border border-white">
                  <Zap className="w-2.5 h-2.5 fill-white" />
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <h4 className="font-bold text-xs text-[#002e6e] truncate">Install Zomindia App</h4>
                <p className="text-[10px] text-slate-500 truncate mt-0.5">
                  {isAndroid ? 'Get it on Google Play' : '1-Click Fast Booking & Tracking'}
                </p>
              </div>
            </div>

            <button
              onClick={handleInstall}
              className="bg-[#002e6e] hover:bg-[#00baf2] text-white font-bold text-xs px-3.5 py-2 rounded-full shadow-md transition-colors flex items-center gap-1.5 cursor-pointer border-0 shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Install</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PWAInstallBanner;
