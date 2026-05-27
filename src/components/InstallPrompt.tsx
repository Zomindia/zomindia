import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, ShieldCheck, Zap, Star } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    // Check for iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
      return;
    }

    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Initial delay to show prompt
    const initialTimer = setTimeout(() => {
      setShowPrompt(true);
    }, 2000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      clearTimeout(initialTimer);
    };
  }, []);

  // Interval to show prompt every 30 seconds if not installed
  useEffect(() => {
    if (isInstalled) return;

    const interval = setInterval(() => {
      if (!isInstalled) {
        setShowPrompt(true);
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [isInstalled]);

  const handleInstallClick = async () => {
    if (isIOS) {
      alert("To install: Tap the 'Share' icon in your browser's bottom bar and select 'Add to Home Screen'.");
      return;
    }
    
    if (!deferredPrompt) {
      alert("Installation is handled by your browser. Look for 'Install' or 'Add to Home Screen' in your browser menu.");
      return;
    }

    // Show the browser's install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      console.log('User accepted the install prompt');
      setIsInstalled(true);
    } else {
      console.log('User dismissed the install prompt');
    }

    // Clear the deferredPrompt so it can't be used again
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const handleClose = () => {
    setShowPrompt(false);
  };

  if (isInstalled || !showPrompt) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 20 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-sm"
      >
        <div className="relative w-full max-w-sm bg-white rounded-[40px] shadow-2xl shadow-blue-900/20 overflow-hidden border border-white/20">
          {/* Header Image/Pattern */}
          <div className="h-32 bg-gradient-to-br from-blue-700 to-indigo-800 relative flex items-center justify-center overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
              <div className="absolute inset-y-0 left-0 w-px bg-white/20" />
              <div className="grid grid-cols-6 gap-4 p-4 transform -rotate-12 scale-150">
                 {Array.from({ length: 24 }).map((_, i) => (
                   <div key={i} className="w-12 h-12 border border-white/5 rounded-lg" />
                 ))}
              </div>
            </div>
            
            <div className="relative w-20 h-20 bg-white rounded-2xl shadow-xl flex items-center justify-center p-4">
               <div className="w-full h-full bg-[#050CA6] rounded-xl flex items-center justify-center">
                  <span className="text-white font-black text-3xl tracking-tighter">Z</span>
               </div>
            </div>
          </div>

          <button 
            onClick={handleClose}
            className="absolute top-4 right-4 p-2 bg-black/10 hover:bg-black/20 text-white rounded-full transition-colors z-10"
          >
            <X size={18} />
          </button>

          <div className="p-8 pb-10 text-center">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
              <Zap size={12} fill="currentColor" />
              Official App
            </div>
            
            <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight mb-8">
              Install Zomindia for <br /><span className="text-blue-700">Better Security</span>
            </h2>

            <div className="grid grid-cols-3 gap-3 mb-8">
               <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                     <ShieldCheck size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Secure</span>
               </div>
               <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                     <Zap size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Fast</span>
               </div>
               <div className="flex flex-col items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400">
                     <Star size={20} />
                  </div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Trusted</span>
               </div>
            </div>

            <button 
              onClick={handleInstallClick}
              className="w-full py-4 bg-blue-700 text-white rounded-[20px] font-black uppercase tracking-widest text-xs flex items-center justify-center gap-3 hover:bg-blue-800 transition-all shadow-xl shadow-blue-700/20 active:scale-95"
            >
              <Download size={16} />
              Install Application
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
