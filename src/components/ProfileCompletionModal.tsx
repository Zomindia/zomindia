import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { updateProfile } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { User, Mail, Sparkles, AlertCircle, X } from 'lucide-react';
import { BrandedButtonSpinner } from './LoadingIndicator';
import { LogoIcon } from './BrandLogo';

export interface ProfileCompletionModalProps {
  isOpen: boolean;
  uid?: string;
  phoneNumber?: string;
  initialName?: string;
  initialEmail?: string;
  onClose?: () => void;
  onSuccess?: (profileData?: any) => void;
}

export const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({
  isOpen,
  uid,
  phoneNumber,
  initialName = '',
  initialEmail = '',
  onClose,
  onSuccess,
}) => {
  const [fullName, setFullName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeUid = uid || auth.currentUser?.uid;
  const activePhone = phoneNumber || auth.currentUser?.phoneNumber || '';

  // Prevent background GPS geolocation and Push Notification registrations while onboarding modal is visible
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__ZOMINDIA_ONBOARDING_MODAL_VISIBLE = isOpen;
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__ZOMINDIA_ONBOARDING_MODAL_VISIBLE = false;
      }
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (initialName) setFullName(initialName);
      if (initialEmail) setEmail(initialEmail);
    }
  }, [isOpen, initialName, initialEmail]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }
    if (!activeUid) {
      setError('Authentication session not found. Please sign in again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Update Firebase Auth displayName defensively
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName: fullName.trim() });
        } catch (profileErr) {
          console.warn('[ProfileCompletionModal] Non-fatal auth profile update notice:', profileErr);
        }
      }

      // 2. Fetch existing user document if any
      const userRef = doc(db, 'users', activeUid);
      let userSnap: any = null;
      try {
        userSnap = await getDoc(userRef);
      } catch (getErr) {
        console.warn('[ProfileCompletionModal] Non-fatal user doc lookup notice:', getErr);
      }

      // Strictly guard every access: userData?.role, userData?.customerData?.fullName, userData?.onboardingComplete.
      // Never assume userData exists!
      const userData = userSnap?.exists() ? userSnap.data() : null;
      const isSarthakEmail = email.toLowerCase().trim() === 'sarthakwebtech@gmail.com';
      const role = isSarthakEmail ? 'admin' : (userData?.role || 'customer');

      // Default new user state: { role: 'customer', onboardingComplete: false, fullName: '' }
      const completeProfilePayload = {
        uid: activeUid,
        displayName: fullName.trim(),
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: activePhone || userData?.phoneNumber || userData?.mobile || '',
        mobile: activePhone || userData?.mobile || userData?.phoneNumber || '',
        role,
        adminSubRole: isSarthakEmail ? 'head' : undefined,
        isPartner: Boolean(userData?.isPartner),
        onboardingComplete: true,
        walletBalance: userData?.walletBalance !== undefined ? userData.walletBalance : 100,
        createdAt: userData?.createdAt || Timestamp.now(),
        updatedAt: Timestamp.now(),
        referralCode: userData?.referralCode || `ZOM${activeUid.slice(-6).toUpperCase()}`,
        savedAddresses: Array.isArray(userData?.savedAddresses) ? userData.savedAddresses : [],
        addresses: Array.isArray(userData?.addresses) ? userData.addresses : [],
        bookings: Array.isArray(userData?.bookings) ? userData.bookings : [],
        customerData: {
          fullName: fullName.trim(),
          email: email.trim(),
          phoneNumber: activePhone || userData?.phoneNumber || '',
          mobile: activePhone || userData?.mobile || '',
          walletBalance: userData?.walletBalance !== undefined ? userData.walletBalance : 100,
          ...(userData?.customerData || {}),
        },
        notificationPreferences: {
          bookingUpdates: true,
          promotionalMessages: true,
          ...(userData?.notificationPreferences || {}),
        },
      };

      // Wrap user creation setDoc in a defensive try/catch block with visible UI error message on failure
      try {
        await setDoc(userRef, completeProfilePayload, { merge: true });
      } catch (writeErr: any) {
        console.error('[ProfileCompletionModal] Firestore setDoc error:', writeErr);
        setError(`Failed to save profile: ${writeErr?.message || 'Database connection error'}. Please try again.`);
        setLoading(false);
        return;
      }

      if (onSuccess) {
        onSuccess(completeProfilePayload);
      }
      if (onClose) {
        onClose();
      }
    } catch (err: any) {
      console.error('[ProfileCompletionModal] General error:', err);
      setError(err?.message || 'An unexpected error occurred while completing profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm sm:max-w-md w-full mx-auto flex flex-col max-h-[92vh] z-10"
        >
          {/* Curved Top Hero Banner */}
          <div className="bg-gradient-to-br from-[#071435] via-[#0f2868] to-[#1e1b4b] pt-8 pb-12 px-6 text-center relative shrink-0">
            <div className="absolute -top-10 -left-10 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-cyan-400/25 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-16 bg-blue-500/20 rounded-full blur-xl pointer-events-none" />

            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="absolute top-3.5 right-3.5 z-20 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-all cursor-pointer"
                aria-label="Close modal"
              >
                <X size={16} />
              </button>
            )}

            {/* Glowing 'Z' Brand Badge */}
            <div className="w-16 h-16 rounded-2xl bg-white p-2 shadow-xl ring-4 ring-amber-400/40 mx-auto -mb-8 relative z-10 flex items-center justify-center transform hover:scale-105 transition-all">
              <img src={LogoIcon} alt="Zomindia" className="w-full h-full object-contain rounded-xl select-none" />
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="pt-10 pb-6 px-6 sm:px-8 space-y-4 overflow-y-auto no-scrollbar">
            <div className="text-center mb-2">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Welcome to Zomindia! 🎉</h2>
              <p className="text-slate-500 text-xs sm:text-sm mt-1 leading-relaxed">Please enter your name & email to complete your registration</p>
            </div>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2 text-rose-700 text-xs font-semibold">
                <AlertCircle size={16} className="shrink-0 mt-0.5 text-rose-500" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase text-left mb-1.5 block">
                Full Name
              </label>
              <div className="relative">
                <User size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g. Rahul Sharma"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 rounded-2xl text-sm font-semibold text-slate-900 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase text-left mb-1.5 block">
                Email Address
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-3.5 text-slate-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. rahul@example.com"
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-2 border-slate-200 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 rounded-2xl text-sm font-semibold text-slate-900 outline-none transition-all"
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-1 ml-1">Invoices and booking confirmations will be sent here.</p>
            </div>

            <div className="p-3.5 bg-gradient-to-r from-amber-50 to-emerald-50 rounded-2xl border border-amber-200/60 flex items-center gap-3">
              <Sparkles size={18} className="text-amber-600 shrink-0" />
              <div className="text-xs">
                <p className="font-bold text-amber-900">₹100 Welcome Bonus</p>
                <p className="text-slate-600 text-[11px]">Credited instantly to your Zomindia wallet upon completion!</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !fullName.trim() || !email.trim()}
              className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:from-blue-800 hover:to-indigo-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
            >
              {loading ? <BrandedButtonSpinner className="w-5 h-5" /> : 'Complete Registration'}
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default ProfileCompletionModal;
