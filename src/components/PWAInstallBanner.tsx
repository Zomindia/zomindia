import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Zap, Loader2 } from 'lucide-react';
import { LogoIcon } from './BrandLogo';

export function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  useEffect(() => {
    // 1. Check if app is running in standalone mode or already installed
    const checkStandalone = (): boolean => {
      try {
        if (localStorage.getItem('zomindia_pwa_installed') === 'true') {
          setIsStandalone(true);
          return true;
        }
      } catch {}

      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches ||
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');

      if (isStandaloneMode) {
        setIsStandalone(true);
        return true;
      }
      return false;
    };

    // 2. Check if user dismissed within the last 7 days
    const isDismissedRecently = (): boolean => {
      try {
        const dismissedUntil = localStorage.getItem('zomindia_pwa_dismissed_until');
        if (dismissedUntil) {
          const expiry = parseInt(dismissedUntil, 10);
          if (Date.now() < expiry) {
            return true;
          } else {
            localStorage.removeItem('zomindia_pwa_dismissed_until');
          }
        }
      } catch {}
      return false;
    };

    if (checkStandalone() || isDismissedRecently()) {
      setShowBanner(false);
      return;
    }

    // If deferredPrompt is already cached on the window and not dismissed, display banner
    if ((window as any).deferredPrompt && !isDismissedRecently()) {
      setShowBanner(true);
    }

    // 3. Consolidated event listeners: rely on central main.tsx beforeinstallprompt event bridge
    const handlePromptAvailable = () => {
      if (!checkStandalone() && !isDismissedRecently()) {
        setShowBanner(true);
      }
    };

    const handleAppInstalled = () => {
      try {
        localStorage.setItem('zomindia_pwa_installed', 'true');
      } catch {}
      (window as any).deferredPrompt = null;
      setIsStandalone(true);
      setShowBanner(false);
      setIsInstalling(false);
    };

    const handleTriggerPrompt = () => {
      if (!checkStandalone()) {
        setShowBanner(true);
      }
    };

    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('trigger-pwa-install', handleTriggerPrompt);
    window.addEventListener('show-pwa-install-banner', handleTriggerPrompt);

    // Initial check for mobile/desktop after short mount delay
    const initialTimer = setTimeout(() => {
      if (!checkStandalone() && !isDismissedRecently()) {
        setShowBanner(true);
      }
    }, 2500);

    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('trigger-pwa-install', handleTriggerPrompt);
      window.removeEventListener('show-pwa-install-banner', handleTriggerPrompt);
    };
  }, []);

  // Direct 1-Tap Native PWA Install Execution using window.deferredPrompt (No instruction modals/guides)
  const handleInstall = async () => {
    const prompt = (window as any).deferredPrompt;

    if (prompt && typeof prompt.prompt === 'function') {
      try {
        setIsInstalling(true);
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice?.outcome === 'accepted') {
          try {
            localStorage.setItem('zomindia_pwa_installed', 'true');
          } catch {}
          (window as any).deferredPrompt = null;
          setIsStandalone(true);
          setShowBanner(false);
          if (typeof (window as any).__showToast === 'function') {
            (window as any).__showToast('Zomindia app installed successfully!', 'success');
          }
        } else {
          setShowBanner(false);
        }
      } catch (err) {
        console.error('[PWA] Direct prompt invocation error:', err);
      } finally {
        setIsInstalling(false);
      }
    } else {
      setShowBanner(false);
    }
  };

  // 7-day dismissal handler
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
          exit={{ opacity: 0, y: 50, scale: 0.95, transition: { duration: 0.2, ease: 'easeIn' } }}
          transition={{
            type: 'spring',
            damping: 30,
            stiffness: 300,
            mass: 0.8,
          }}
          className="fixed bottom-28 md:bottom-8 left-3 right-3 sm:left-auto sm:right-6 z-[60] max-w-sm w-full mx-auto sm:mx-0 pointer-events-auto"
        >
          <div className="relative bg-white/95 backdrop-blur-md rounded-3xl pt-3.5 pb-3 pl-3.5 pr-4 border border-slate-200/90 shadow-[0_16px_36px_-6px_rgba(0,46,110,0.18)] overflow-hidden">
            {/* Animated progress bar during install flow */}
            {isInstalling && (
              <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100 overflow-hidden z-20">
                <motion.div
                  initial={{ x: '-100%' }}
                  animate={{ x: '100%' }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.2,
                    ease: 'easeInOut',
                  }}
                  className="w-1/2 h-full bg-linear-to-r from-[#002e6e] via-[#00baf2] to-emerald-500 rounded-full"
                />
              </div>
            )}

            {/* 7-Day Dismiss Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer border-0"
              aria-label="Dismiss install banner"
              title="Dismiss for 7 days"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {/* Clean Quick Install Card */}
            <div className="flex items-center justify-between gap-3">
              {/* Left side: Icon & Title */}
              <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                <div className="relative shrink-0 w-11 h-11 rounded-2xl bg-white p-1.5 border border-slate-200/90 shadow-sm flex items-center justify-center overflow-hidden">
                  <img
                    src={LogoIcon || '/logo-192.png'}
                    alt="Zomindia Logo"
                    className="w-full h-full object-contain select-none"
                    referrerPolicy="no-referrer"
                    onError={(e) => {
                      (e.target as HTMLElement).setAttribute('src', '/logo-192.png');
                    }}
                  />
                  <span className="absolute -bottom-0.5 -right-0.5 bg-emerald-500 text-white rounded-full p-0.5 shadow-sm border border-white">
                    <Zap className="w-2.5 h-2.5 fill-white" />
                  </span>
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-xs text-[#002e6e] truncate leading-tight">
                    Install Zomindia App
                  </h4>
                  <p className="text-[10px] text-slate-500 truncate leading-tight mt-0.5">
                    {isInstalling ? 'Initiating native install...' : '1-Click Booking & Live Tracking'}
                  </p>
                </div>
              </div>

              {/* Right side: Action Button */}
              <div className="flex items-center gap-1.5 shrink-0 pt-1.5 sm:pt-0">
                <motion.button
                  onClick={handleInstall}
                  disabled={isInstalling}
                  whileHover={!isInstalling ? { scale: 1.03 } : {}}
                  whileTap={!isInstalling ? { scale: 0.92 } : {}}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  className={`bg-[#002e6e] hover:bg-[#00baf2] text-white font-bold text-xs px-3.5 py-2 rounded-full shadow-md shadow-[#002e6e]/20 transition-colors flex items-center gap-1.5 cursor-pointer border-0 select-none active:ring-2 active:ring-[#00baf2]/40 ${
                    isInstalling ? 'opacity-90 cursor-wait' : ''
                  }`}
                >
                  {isInstalling ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Installing...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Install</span>
                    </>
                  )}
                </motion.button>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PWAInstallBanner;
