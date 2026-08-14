import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Zap, Loader2 } from 'lucide-react';
import { LogoIcon } from './BrandLogo';

export function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showBanner, setShowBanner] = useState<boolean>(false);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [isInstalling, setIsInstalling] = useState<boolean>(false);

  // Track if user has interacted with the app
  const hasInteractedRef = useRef<boolean>(false);
  const autoSlideOutTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // 1. Comprehensive check if app is already installed or running in standalone mode
    const checkInstalledStatus = async () => {
      // Local flag from previous completed install
      try {
        if (localStorage.getItem('zomindia_pwa_installed') === 'true') {
          setIsStandalone(true);
          return true;
        }
      } catch {
        // Storage restricted
      }

      // Display-mode check (Standalone, Minimal-UI, Fullscreen)
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

      // Check native getInstalledRelatedApps API if supported
      if ('getInstalledRelatedApps' in navigator) {
        try {
          const relatedApps = await (navigator as any).getInstalledRelatedApps();
          if (relatedApps && relatedApps.length > 0) {
            setIsStandalone(true);
            try {
              localStorage.setItem('zomindia_pwa_installed', 'true');
            } catch {
              // Ignore
            }
            return true;
          }
        } catch (e) {
          console.debug('[PWA] getInstalledRelatedApps check skipped:', e);
        }
      }

      return false;
    };

    checkInstalledStatus().then((installed) => {
      if (installed) return;

      // Track display mode changes dynamically
      const mediaQuery = window.matchMedia('(display-mode: standalone)');
      const handleModeChange = (e: MediaQueryListEvent) => {
        if (e.matches) {
          setIsStandalone(true);
          setShowBanner(false);
        }
      };

      try {
        mediaQuery.addEventListener('change', handleModeChange);
      } catch {
        // Fallback for older browsers
        mediaQuery.addListener?.(handleModeChange);
      }
    });

    // 2. Track user interaction across the page
    const handleUserInteraction = () => {
      hasInteractedRef.current = true;
    };

    window.addEventListener('pointerdown', handleUserInteraction, { passive: true });
    window.addEventListener('keydown', handleUserInteraction, { passive: true });
    window.addEventListener('touchstart', handleUserInteraction, { passive: true });
    window.addEventListener('scroll', handleUserInteraction, { passive: true });

    // 3. Check for existing deferredPrompt in global window object
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt);
    }

    // 4. Listen for beforeinstallprompt event & custom global notification
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      (window as any).deferredPrompt = e;
      setDeferredPrompt(e);
    };

    const handlePromptAvailable = () => {
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
      }
    };

    // 5. Listen for appinstalled event
    const handleAppInstalled = () => {
      console.log('[PWA] App installed successfully');
      try {
        localStorage.setItem('zomindia_pwa_installed', 'true');
      } catch {
        // Storage restricted
      }
      (window as any).deferredPrompt = null;
      setDeferredPrompt(null);
      setIsStandalone(true);
      setShowBanner(false);
      setIsInstalling(false);
    };

    // 6. Custom event trigger (e.g., manually triggered from settings or headers)
    const handleManualTrigger = () => {
      setShowBanner(true);
      if ((window as any).deferredPrompt) {
        setDeferredPrompt((window as any).deferredPrompt);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handlePromptAvailable);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('trigger-pwa-install', handleManualTrigger);

    // 7. Auto-Popup Timer (Initial display)
    const initialTimer = setTimeout(() => {
      try {
        const isInstalled = localStorage.getItem('zomindia_pwa_installed') === 'true';
        const dismissed = sessionStorage.getItem('zomindia_pwa_dismissed') === 'true';
        if (!dismissed && !isInstalled) {
          setShowBanner(true);
        }
      } catch (err) {
        setShowBanner(true);
      }
    }, 15000);

    return () => {
      clearTimeout(initialTimer);
      if (autoSlideOutTimerRef.current) clearTimeout(autoSlideOutTimerRef.current);
      window.removeEventListener('pointerdown', handleUserInteraction);
      window.removeEventListener('keydown', handleUserInteraction);
      window.removeEventListener('touchstart', handleUserInteraction);
      window.removeEventListener('scroll', handleUserInteraction);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('trigger-pwa-install', handleManualTrigger);
    };
  }, []);

  // 8. Auto-slide out after 45 seconds if user has not interacted with the app
  useEffect(() => {
    if (showBanner) {
      if (autoSlideOutTimerRef.current) clearTimeout(autoSlideOutTimerRef.current);

      autoSlideOutTimerRef.current = setTimeout(() => {
        // If the user hasn't interacted with the app yet, slide out automatically
        if (!hasInteractedRef.current) {
          console.log('[PWA] Auto-sliding out install banner after 45s of no user interaction.');
          setShowBanner(false);
        }
      }, 45000);
    }

    return () => {
      if (autoSlideOutTimerRef.current) {
        clearTimeout(autoSlideOutTimerRef.current);
      }
    };
  }, [showBanner]);

  // Direct Native PWA Install Trigger: Immediately invoke prompt() without manual toasts
  const handleInstall = async () => {
    hasInteractedRef.current = true;
    const prompt = (window as any).deferredPrompt || deferredPrompt;

    if (!prompt) {
      // Quiet background attempt without bothering user or showing directions
      console.log('[PWA] Prompt event not cached yet. Ensuring service worker active.');
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(() => {});
      }
      return;
    }

    try {
      setIsInstalling(true);
      await prompt.prompt();
      const choice = await prompt.userChoice;
      console.log(`[PWA] Install choice outcome: ${choice?.outcome}`);
      if (choice?.outcome === 'accepted') {
        try {
          localStorage.setItem('zomindia_pwa_installed', 'true');
        } catch {
          // Storage restricted
        }
        (window as any).deferredPrompt = null;
        setDeferredPrompt(null);
        setIsStandalone(true);
        setShowBanner(false);
      }
    } catch (err) {
      console.error('[PWA] Direct prompt invocation error:', err);
    } finally {
      setIsInstalling(false);
    }
  };

  const handlePermanentDismiss = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    hasInteractedRef.current = true;
    setShowBanner(false);
    try {
      sessionStorage.setItem('zomindia_pwa_dismissed', 'true');
    } catch (err) {
      // Storage restricted
    }
  };

  // Hide the banner completely if app is already installed or in standalone mode
  if (isStandalone) return null;

  return (
    <AnimatePresence>
      {showBanner && (
        <motion.div
          initial={{ opacity: 0, y: 80, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 60, scale: 0.95, transition: { duration: 0.25, ease: 'easeIn' } }}
          transition={{
            type: 'spring',
            damping: 30,
            stiffness: 240,
            mass: 0.9,
          }}
          className="fixed bottom-24 md:bottom-6 left-3 right-3 sm:left-auto sm:right-6 z-[110000] max-w-sm w-full mx-auto sm:mx-0 pointer-events-auto"
        >
          <div className="relative bg-white/95 backdrop-blur-md rounded-3xl pt-3.5 pb-3 pl-3.5 pr-4 border border-slate-200/90 shadow-[0_16px_36px_-6px_rgba(0,46,110,0.18)] flex items-center justify-between gap-3 overflow-hidden">
            {/* Subtle animated progress bar during installation flow */}
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
                  className="w-1/2 h-full bg-gradient-to-r from-blue-600 via-cyan-400 to-emerald-500 rounded-full"
                />
              </div>
            )}

            {/* Subtle permanent session dismiss 'x' button at top-right corner */}
            <button
              onClick={handlePermanentDismiss}
              className="absolute top-2 right-2.5 p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all cursor-pointer border-0 z-10"
              aria-label="Permanently dismiss for this session"
              title="Dismiss for this session"
            >
              <X className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>

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
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default PWAInstallBanner;
