import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, Check, Sparkles, Share, Plus, Loader } from 'lucide-react';

export default function AppInstallPopup() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isReadyToInstall, setIsReadyToInstall] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isLaunchingStandalone, setIsLaunchingStandalone] = useState(false);

  useEffect(() => {
    // 1. Identify platforms
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAndroidDevice = /android/.test(userAgent);
    const isIOSDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsAndroid(isAndroidDevice);
    setIsIOS(isIOSDevice);

    // 2. Check if already running in standalone display-mode / installed
    const checkInstalled = () => {
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://') ||
        window.location.search.includes('utm_source=pwa');
      setAlreadyInstalled(isStandalone);
      return isStandalone;
    };

    const isStandaloneNow = checkInstalled();

    if (isStandaloneNow) {
      // If we are currently running inside standalone, completely disable install prompts/modals!
      setIsReadyToInstall(false);
      return;
    }

    // 3. Capturing PWA prompt dynamically
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      // Store the native prompt event
      setDeferredPrompt(e);
      
      const sessionDismissed = sessionStorage.getItem('zomindia_install_prompt_dismissed');
      if (!sessionDismissed) {
        setIsReadyToInstall(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Capture application successful install and initiate automatic standalone redirection transition
    const handleAppInstalled = () => {
      setAlreadyInstalled(true);
      setIsReadyToInstall(false);
      setDeferredPrompt(null);
      
      // Auto-trigger the immersive standalone redirection overlay
      setIsLaunchingStandalone(true);
      showToast("ZomIndia successfully installed! Initializing standalone window... 🚀");
      
      // Attempt redirection to start_url with utm parameters so OS or browser opens standalone window or handles launch smoothly
      setTimeout(() => {
        setIsLaunchingStandalone(false);
        window.location.href = '/?utm_source=pwa';
      }, 4000);
    };

    window.addEventListener('appinstalled', handleAppInstalled);

    // Broadcast receiver to register manual/resume attempts
    const handleResumeInstallPopup = () => {
      const standalone = checkInstalled();
      if (standalone) {
        showToast("App is already installed and running as a standalone app shell! 🎉");
      } else {
        setIsReadyToInstall(true);
        showToast("Preparing offline launch parameters... Install prompt resumed! ⚡");
      }
    };

    window.addEventListener('resume-app-install-popup', handleResumeInstallPopup);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('resume-app-install-popup', handleResumeInstallPopup);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleInstallClick = async () => {
    if (isIOS) {
      showToast("Tap Share -> Add to Home Screen in Safari!");
      return;
    }

    if (!deferredPrompt) {
      showToast("Tap your browser's menu (⋮) -> 'Add to Home Screen'!");
      return;
    }

    try {
      // Trigger the browser's native install prompt sheet
      await deferredPrompt.prompt();
      
      // Await prompt choice from user
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User responded to PWA installer prompt: ${outcome}`);
      
      // Clean up states regardless of choice
      setDeferredPrompt(null);
      setIsReadyToInstall(false);

      if (outcome === 'accepted') {
        showToast("Setting up offline resources... App successfully queued for install! 🎉");
      }
    } catch (err) {
      console.error("Installation error:", err);
      showToast("Please use browser's menu to install.");
    }
  };

  const handleDismiss = () => {
    setIsReadyToInstall(false);
    sessionStorage.setItem('zomindia_install_prompt_dismissed', 'true');
  };

  if (alreadyInstalled && !isLaunchingStandalone) return null;

  return (
    <>
      <AnimatePresence>
        {isReadyToInstall && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/45 backdrop-blur-[2px]">
            {/* Backdrop click to dismiss */}
            <div className="absolute inset-0 cursor-default" onClick={handleDismiss} />

            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 10 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="relative w-full max-w-[280px] bg-white border border-slate-100 rounded-[24px] p-5 text-neutral-950 shadow-xl overflow-hidden pointer-events-auto flex flex-col items-center"
            >
              {/* Close Button */}
              <button 
                onClick={handleDismiss}
                className="absolute top-3.5 right-3.5 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-55 transition-all cursor-pointer"
                id="close-install-modal"
              >
                <X size={13} />
              </button>

              {/* Logo & Info Block */}
              <div className="flex flex-col items-center text-center mt-1.5 mb-3.5 w-full">
                {/* Logo Icon */}
                <div className="w-11 h-11 bg-white border border-slate-50 rounded-xl flex items-center justify-center shadow-md shadow-slate-100/30 mb-2.5 select-none overflow-hidden">
                  <img 
                    src="https://ik.imagekit.io/zomindia/zomindia%20icon.png?updatedAt=1781064947133" 
                    alt="zomindia" 
                    className="w-7 h-7 object-contain"
                    referrerPolicy="no-referrer"
                  />
                </div>

                {/* Text Context */}
                <h3 className="text-xs font-bold text-slate-900 tracking-tight">Install ZomIndia</h3>
                <p className="text-[10px] text-slate-500 mt-1 max-w-[210px] leading-normal font-medium">
                  {isIOS ? (
                    <span className="flex items-center justify-center gap-1 flex-wrap">
                      Tap <Share size={10} className="inline text-blue-600" /> then <Plus size={10} className="inline font-bold" /> Add to Home Screen
                    </span>
                  ) : (
                    "Fast, lightweight, and works offline"
                  )}
                </p>
              </div>

              {/* Compact Action Buttons */}
              <div className="w-full flex gap-1.5">
                <button
                  onClick={handleDismiss}
                  className="flex-1 bg-slate-50 hover:bg-slate-100 text-slate-505 py-2 rounded-xl text-[10.5px] font-bold transition-all cursor-pointer text-center border border-slate-100/50 active:scale-[0.98]"
                  id="dismiss-app-install-button"
                >
                  Not Now
                </button>
                
                {!isIOS && (
                  <button
                    onClick={handleInstallClick}
                    className="flex-1 bg-[#050CA6] text-white hover:bg-blue-800 py-2 rounded-xl text-[10.5px] font-bold active:scale-[0.98] transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md shadow-blue-500/5"
                    id="confirm-app-install-button"
                  >
                    Install
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Immersive Standalone redirection overlay when app is installed */}
      <AnimatePresence>
        {isLaunchingStandalone && (
          <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-md p-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-white shadow-2xl flex flex-col items-center gap-5"
            >
              <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/10 overflow-hidden relative">
                <motion.div
                  className="absolute inset-0 border-2 border-dashed border-blue-500 rounded-2xl"
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
                />
                <img 
                  src="https://ik.imagekit.io/zomindia/zomindia%20icon.png?updatedAt=1781064947133" 
                  alt="ZomIndia" 
                  className="w-10 h-10 object-contain relative z-10"
                />
              </div>

              <div className="space-y-2">
                <h2 className="text-lg font-extrabold tracking-tight text-white flex items-center justify-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                  PWA Installation Complete!
                </h2>
                <p className="text-slate-400 text-xs max-w-xs mx-auto leading-relaxed font-medium">
                  We are launching the premium standalone app wrapper window. Standalone mode provides 10x faster performance, push notifications, and offline capabilities.
                </p>
              </div>

              <div className="flex items-center gap-3 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2.5 w-full justify-center">
                <Loader className="w-4 h-4 text-blue-400 animate-spin" />
                <span className="text-[11px] font-bold text-slate-300 tracking-wider uppercase">
                  Launching App Wrapper...
                </span>
              </div>

              <p className="text-[10px] text-slate-500 max-w-[280px]">
                If the window does not launch automatically, check your home screen, app drawer, or desktop shortcut to launch ZomIndia!
              </p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global alert toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: "-50%", scale: 0.95 }}
            animate={{ opacity: 1, y: 0, x: "-50%", scale: 1 }}
            exit={{ opacity: 0, y: -20, x: "-50%", scale: 0.95 }}
            className="fixed top-6 left-1/2 z-[10000] flex items-center gap-2 bg-slate-900 border border-slate-800 text-white px-4 py-2 rounded-xl shadow-xl text-[10.5px] font-bold whitespace-nowrap"
          >
            <div className="w-3.5 h-3.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Check size={8} />
            </div>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
