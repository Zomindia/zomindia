import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { LoadingSpinner } from './LoadingIndicator';
import { Shield, MapPin, Camera, Mic, Bell, ChevronRight, CheckCircle2 } from 'lucide-react';

export default function PermissionsPrompt() {
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<'intro' | 'requesting' | 'completed'>('intro');
  const [statuses, setStatuses] = useState({
    location: 'pending',
    camera: 'pending',
    microphone: 'pending',
    notifications: 'pending'
  });

  useEffect(() => {
    const hasPrompted = localStorage.getItem('zomindia_permissions_prompted');
    if (!hasPrompted) {
      // Delay slightly to welcome the user first
      const timer = setTimeout(() => {
        setIsOpen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  const requestAllPermissions = async () => {
    setStep('requesting');

    // 1. Request Geolocation
    if (navigator.geolocation) {
      try {
        await new Promise<void>((resolve) => {
          navigator.geolocation.getCurrentPosition(
            () => {
              setStatuses(prev => ({ ...prev, location: 'granted' }));
              resolve();
            },
            () => {
              setStatuses(prev => ({ ...prev, location: 'denied' }));
              resolve();
            },
            { enableHighAccuracy: false, timeout: 5000 }
          );
        });
      } catch (e) {
        setStatuses(prev => ({ ...prev, location: 'disabled' }));
      }
    } else {
      setStatuses(prev => ({ ...prev, location: 'unsupported' }));
    }

    // 2. Request Notifications
    if ('Notification' in window) {
      try {
        const result = await Notification.requestPermission();
        setStatuses(prev => ({ ...prev, notifications: result }));
      } catch (e) {
        setStatuses(prev => ({ ...prev, notifications: 'denied' }));
      }
    } else {
      setStatuses(prev => ({ ...prev, notifications: 'unsupported' }));
    }

    // 3. Request Camera & Mic
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setStatuses(prev => ({ ...prev, camera: 'granted', microphone: 'granted' }));
        // Clean up stream immediately
        stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        setStatuses(prev => ({ ...prev, camera: 'denied', microphone: 'denied' }));
      }
    } else {
      setStatuses(prev => ({ ...prev, camera: 'unsupported', microphone: 'unsupported' }));
    }

    setStep('completed');
  };

  const handleDone = () => {
    localStorage.setItem('zomindia_permissions_prompted', 'true');
    setIsOpen(false);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 350 }}
          className="bg-white rounded-[40px] shadow-2xl border border-slate-100 max-w-md w-full overflow-hidden p-8 relative"
        >
          {/* Decorative gradients */}
          <div className="absolute top-0 left-1/4 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

          {step === 'intro' && (
            <div className="text-center relative z-10">
              <div className="w-20 h-20 bg-blue-50 rounded-[28px] flex items-center justify-center mx-auto mb-6 text-blue-700 shadow-inner">
                <Shield size={38} strokeWidth={2} />
              </div>
              
              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
                Setup Permissions
              </h2>
              
              <p className="text-slate-500 text-sm font-semibold leading-relaxed mb-8 px-2">
                To enable accurate order tracking, verified support video chats, and real-time partner arrivals across devices, please allow the following permissions.
              </p>

              <div className="space-y-4 mb-8 text-left max-w-sm mx-auto">
                <div className="flex items-center gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-blue-100/50 rounded-xl flex items-center justify-center text-blue-700">
                    <MapPin size={20} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Location GPS</h4>
                    <p className="text-[10px] text-slate-400 font-bold leading-normal">Assigns nearest premium partners with high accuracy</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-blue-100/50 rounded-xl flex items-center justify-center text-blue-700">
                    <Camera size={20} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Camera & Mic</h4>
                    <p className="text-[10px] text-slate-400 font-bold leading-normal">Used during pre-inspection and scanning QR verification</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-50/60 p-4 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 bg-blue-100/50 rounded-xl flex items-center justify-center text-blue-700">
                    <Bell size={20} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Alert Notification</h4>
                    <p className="text-[10px] text-slate-400 font-bold leading-normal">Instant mobile push notifications on progress and OTP status</p>
                  </div>
                </div>
              </div>

              <button
                onClick={requestAllPermissions}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-black text-sm uppercase tracking-widest py-5 rounded-[24px] shadow-xl shadow-blue-700/10 transition-all flex items-center justify-center gap-3 active:scale-95 group"
              >
                Enable Device Access
                <ChevronRight size={18} className="transition-transform group-hover:translate-x-1" />
              </button>
            </div>
          )}

          {step === 'requesting' && (
            <div className="text-center py-8 relative z-10 space-y-6">
              <LoadingSpinner size="lg" />
              <div>
                <h3 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Requesting Access...</h3>
                <p className="text-slate-400 font-bold text-xs font-sans">Please tap 'Allow' on your device request alert when prompted.</p>
              </div>
            </div>
          )}

          {step === 'completed' && (
            <div className="text-center relative z-10">
              <div className="w-20 h-20 bg-emerald-50 rounded-[28px] flex items-center justify-center mx-auto mb-6 text-emerald-600 shadow-inner">
                <CheckCircle2 size={38} strokeWidth={2} />
              </div>

              <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-3">
                Permissions Configured!
              </h2>

              <p className="text-slate-500 text-sm font-semibold leading-relaxed mb-8 px-4">
                Thank you! Your system parameters have been successfully integrated with zomindia. Enjoy a fully secure service marketplace experience.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8 max-w-sm mx-auto">
                <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-100">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">GPS Location</span>
                  <span className={`text-xs font-black uppercase ${statuses.location === 'granted' ? 'text-emerald-600' : 'text-amber-500'}`}>
                    {statuses.location === 'granted' ? 'Active' : 'Not Enabled'}
                  </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-100">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Alerts</span>
                  <span className={`text-xs font-black uppercase ${statuses.notifications === 'granted' ? 'text-emerald-600' : 'text-amber-500'}`}>
                    {statuses.notifications === 'granted' ? 'Active' : 'Not Enabled'}
                  </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-100">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Scanner Camera</span>
                  <span className={`text-xs font-black uppercase ${statuses.camera === 'granted' ? 'text-emerald-600' : 'text-amber-500'}`}>
                    {statuses.camera === 'granted' ? 'Active' : 'Not Enabled'}
                  </span>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl text-left border border-slate-100">
                  <span className="text-[9px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1">Support Mic</span>
                  <span className={`text-xs font-black uppercase ${statuses.microphone === 'granted' ? 'text-emerald-600' : 'text-amber-500'}`}>
                    {statuses.microphone === 'granted' ? 'Active' : 'Not Enabled'}
                  </span>
                </div>
              </div>

              <button
                onClick={handleDone}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-black text-sm uppercase tracking-widest py-5 rounded-[24px] shadow-xl transition-all active:scale-95"
              >
                Go to Dashboard
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
