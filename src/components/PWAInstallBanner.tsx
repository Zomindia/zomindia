import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Zap, Loader2, Share2, MoreVertical } from 'lucide-react';
import { LogoIcon } from './BrandLogo';

export function PWAInstallBanner() {
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);
  const [showManualGuide, setShowManualGuide] = useState<boolean>(false);

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

    if (checkStandalone()) {
      setShowBanner(false);
      return;
    }

    // 2. Check if user dismissed for this browser session
    try {
      if (sessionStorage.getItem('zomindia_pwa_dismissed') === 'true') {
        setShowBanner(false);
        return;
      }
    } catch {}

    // If deferredPrompt is already cached on the window, display banner
    if ((window as any).deferredPrompt) {
      setShowBanner(true);
    }

    // 3. Clean event listeners for beforeinstallprompt and custom notification bridge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      if (!checkStandalone()) {
        try {
          if (sessionStorage.getItem('zomindia_pwa_dismissed') !== 'true') {
            setShowBanner(true);
          }
        } catch {
          setShowBanner(true);
        }
      }
    };

    const handlePromptAvailable = () => {
      if (!checkStandalone()) {
        try {
          if (sessionStorage.getItem('zomindia_pwa_dismissed') !== 'true') {
            setShowBanner(true);
          }
        } catch {
          setShowBanner(true);
        }
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
      setShowManualGuide(false);
    };

    const handleTriggerPrompt = () => {
      setShowBanner(true);
      setShowManualGuide(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('trigger-pwa-install', handleTriggerPrompt);
    window.addEventListener('show-pwa-install-banner', handleTriggerPrompt);

    // Initial check for mobile/desktop after short mount delay
    const initialTimer = setTimeout(() => {
      if (!checkStandalone()) {
        try {
          if (sessionStorage.getItem('zomindia_pwa_dismissed') !== 'true') {
            setShowBanner(true);
          }
        } catch {
          setShowBanner(true);
        }
      }
    }, 2500);

    return () => {
      clearTimeout(initialTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('trigger-pwa-install', handleTriggerPrompt);
      window.removeEventListener('show-pwa-install-banner', handleTriggerPrompt);
    };
  }, []);

  // Direct Native PWA Install Execution using single source of truth window.deferredPrompt
  const handleInstall = async () => {
    const prompt = (window as any).deferredPrompt;

    if (prompt && typeof prompt.prompt === 'function') {
      try {
        setIsInstalling(true);
        await prompt.prompt();
        const choice = await prompt.userChoice;
        console.log(`[PWA] Install choice outcome: ${choice?.outcome}`);
        if (choice?.outcome === 'accepted') {
          try {
            localStorage.setItem('zomindia_pwa_installed', 'true');
          } catch {}
          (window as any).deferredPrompt = null;
          setIsStandalone(true);
          setShowBanner(false);
          setShowManualGuide(false);
          if (typeof (window as any).__showToast === 'function') {
            (window as any).__showToast('Zomindia app installed successfully!', 'success');
          }
        }
      } catch (err) {
        console.error('[PWA] Direct prompt invocation error:', err);
      } finally {
        setIsInstalling(false);
      }
    } else {
      console.log('[PWA] Native prompt not available. Displaying manual 1-step guide.');
      setShowManualGuide(true);
      if (typeof (window as any).__showToast === 'function') {
        (window as any).__showToast(
          "Tap the browser menu (⋮ / Share) and select 'Add to Home Screen' to install.",
          'info'
        );
      }
    }
  };

  const handleDismiss = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setShowBanner(false);
    setShowManualGuide(false);
    try {
      sessionStorage.setItem('zomindia_pwa_dismissed', 'true');
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
          className="fixed bottom-24 md:bottom-6 left-3 right-3 sm:left-auto sm:right-6 z-[110000] max-w-sm w-full mx-auto sm:mx-0 pointer-events-auto"
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

            {/* Session Dismiss Button */}
            <button
              onClick={handleDismiss}
              className="absolute top-2.5 right-2.5 z-10 w-6 h-6 rounded-full bg-slate-100/80 hover:bg-slate-200 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-colors cursor-pointer border-0"
              aria-label="Dismiss install banner"
              title="Dismiss for this session"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

            {showManualGuide ? (
              /* Polite 1-step Guide for browsers where beforeinstallprompt is not directly triggered */
              <div className="pt-0.5 pr-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Share2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="font-bold text-xs text-[#002e6e]">Install Zomindia App</span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  Tap the browser menu <span className="inline-flex items-center font-bold text-slate-800 bg-slate-100 px-1 py-0.5 rounded text-[10px] mx-0.5"><MoreVertical className="w-2.5 h-2.5 inline" /> / Share</span> and select <span className="font-bold text-blue-600">&ldquo;Add to Home Screen&rdquo;</span> to install.
                </p>
                <div className="mt-2.5 flex justify-end">
                  <button
                    onClick={() => setShowManualGuide(false)}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-full cursor-pointer transition-colors border-0"
                  >
                    Got it
                  </button>
                </div>
              </div>
            ) : (
              /* Standard Quick Install Banner */
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
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PWAInstallBanner;
