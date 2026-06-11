import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone, ArrowRight, CornerRightDown, Check, Sparkles, Share, Plus } from 'lucide-react';

export default function AppInstallPopup() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [alreadyInstalled, setAlreadyInstalled] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // 1. Identify Android devices
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAndroidDevice = /android/.test(userAgent);
    setIsAndroid(isAndroidDevice);

    // If not on Android, bypass all installation banner cycles entirely
    if (!isAndroidDevice) {
      return;
    }

    // 2. Check if already running in standalone display-mode / installed
    const checkInstalled = () => {
      const isStandalone = 
        window.matchMedia('(display-mode: standalone)').matches || 
        (window.navigator as any).standalone === true ||
        document.referrer.includes('android-app://');
      setAlreadyInstalled(isStandalone);
      return isStandalone;
    };

    const isStandaloneNow = checkInstalled();

    // 3. Capture PWA prompt on compatible Android browsers
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      
      if (!isStandaloneNow) {
        // Quick subtle delay on initial load
        const timer = setTimeout(() => {
          setIsOpen(true);
        }, 3000);
        return () => clearTimeout(timer);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Initial trigger for Android devices if not installed
    if (!isStandaloneNow) {
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 3000);
    }

    // 5. Setup 60-second recursive interval check to show the popup across the entire platform
    const intervalTimer = setInterval(() => {
      const standalone = checkInstalled();
      if (!standalone) {
        setIsOpen(true);
      }
    }, 60000);

    // 6. Global broadcast receiver to resume the installation popup upon user action
    const handleResumeInstallPopup = () => {
      const standalone = checkInstalled();
      if (standalone) {
        showToast("App is already installed and running as a standalone app shell! 🎉");
      } else {
        setIsOpen(true);
        showToast("Preparing offline launch parameters... Install prompt resumed! ⚡");
      }
    };

    const handleAppInstalled = () => {
      setAlreadyInstalled(true);
      setIsOpen(false);
      showToast("zomindia successfully installed! Launching standalone context... 🚀");
    };

    window.addEventListener('resume-app-install-popup', handleResumeInstallPopup);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('resume-app-install-popup', handleResumeInstallPopup);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearInterval(intervalTimer);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      showToast("Triggering download... Tap 'Install' inside your browser settings or menu (⋮)!");
      return;
    }

    try {
      // Trigger browser's native install sheet
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User responded to PWA installer prompt: ${outcome}`);
      if (outcome === 'accepted') {
        showToast("Setting up offline resources... App successfully queued for install! 🎉");
        setDeferredPrompt(null);
        setIsOpen(false);
      }
    } catch (err) {
      console.error("Installation error:", err);
      showToast("Please use browser's menu (⋮) -> 'Add to Home Screen' to install.");
    }
  };

  const handleDismiss = () => {
    setIsOpen(false);
  };

  if (alreadyInstalled) return null;

  return (
    <>
      <AnimatePresence>
        {isOpen && (
          <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-sm">
            {/* Backdrop click to dismiss */}
            <div className="absolute inset-0 cursor-default" onClick={handleDismiss} />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: "spring", stiffness: 400, damping: 28 }}
              className="relative w-full max-w-[270px] bg-white border border-slate-100 rounded-[32px] p-6 text-neutral-950 shadow-2xl overflow-hidden pointer-events-auto flex flex-col items-center"
            >
              {/* Logo / Icon */}
              <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shadow-lg shadow-slate-100/30 mb-3.5 relative z-10 select-none overflow-hidden">
                <img 
                  src="https://ik.imagekit.io/zomindia/zomindia%20icon.png?updatedAt=1781064947133" 
                  alt="zomindia" 
                  className="w-9 h-9 object-contain"
                  referrerPolicy="no-referrer"
                />
              </div>

              {/* Core App Label */}
              <div className="text-center mb-5 relative z-10">
                <h3 className="text-sm font-black text-slate-900 tracking-tight">Install zomindia App</h3>
                <p className="text-[9px] text-slate-400 font-bold mt-0.5 uppercase tracking-wider">High performance app shell</p>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex flex-col gap-2 relative z-10">
                <button
                  onClick={handleInstallClick}
                  className="w-full bg-[#050CA6] text-white hover:bg-blue-755 py-3 px-5 rounded-2xl uppercase tracking-widest text-[9px] font-black active:scale-[0.98] transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-blue-500/10"
                >
                  <Download size={11} className="animate-bounce" />
                  Install App
                </button>
                
                <button
                  onClick={handleDismiss}
                  className="w-full bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 py-2.5 rounded-2xl text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer text-center border border-slate-100/30 active:scale-[0.98]"
                >
                  Skip
                </button>
              </div>
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
            className="fixed top-6 left-1/2 z-[10000] flex items-center gap-2.5 bg-slate-900 border border-slate-850 text-white px-5 py-3 rounded-2xl shadow-2xl text-[11px] font-bold whitespace-nowrap"
          >
            <div className="w-3.5 h-3.5 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
              <Check size={10} />
            </div>
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
