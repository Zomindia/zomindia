import React, { useState, useEffect, useRef } from 'react';
import { 
  signInWithPhoneNumber,
  signInWithEmailAndPassword,
  ConfirmationResult,
  updateProfile,
} from 'firebase/auth';
import { getFriendlyAuthErrorMessage } from '../services/authService';
import { auth, db } from '../lib/firebase';
import { clearRecaptchaInstance, getOrCreateRecaptchaVerifier } from '../lib/recaptcha';
import { doc, setDoc, Timestamp, getDoc, query, where, collection, getDocs } from 'firebase/firestore';
import { buildDualPersonaUserDoc } from '../lib/user-schema';
import { motion, AnimatePresence } from 'motion/react';
import { BrandedButtonSpinner } from './LoadingIndicator';
import { 
  X, 
  Smartphone, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft,
  ShieldCheck,
  Zap,
  Lock,
  Mail,
  Eye,
  EyeOff
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  initialView?: AuthView;
  initialData?: {
    uid?: string;
    displayName?: string;
    email?: string;
  };
}

export type AuthView = 
  | 'phone-entry'
  | 'otp-entry'
  | 'profile-setup'
  | 'success-transition'
  | 'admin-email';

export default function AuthModal({ isOpen, onClose, onSuccess, initialView, initialData }: Props) {
  const getInitialView = (): AuthView => {
    return initialView || 'phone-entry';
  };

  const [view, setView] = useState<AuthView>(getInitialView);
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // OTP states: single unified 6-digit string feeding native WebOTP & single input
  const [otpCode, setOtpCode] = useState('');
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  
  // Registration & Admin Login data
  const [displayName, setDisplayName] = useState(initialData?.displayName || '');
  const [email, setEmail] = useState(initialData?.email || '');
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Status & states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [verifiedUid, setVerifiedUid] = useState<string | null>(initialData?.uid || null);
  const [walletJoiningBonus, setWalletJoiningBonus] = useState<number>(100);

  useEffect(() => {
    let isMounted = true;
    const fetchBonus = async () => {
      try {
        const docRef = doc(db, 'system_config', 'global');
        const snap = await getDoc(docRef);
        if (isMounted && snap.exists()) {
          const val = snap.data().walletJoiningBonus;
          if (typeof val === 'number') {
            setWalletJoiningBonus(val);
          }
        }
      } catch (err: any) {
        // Safe default fallback (e.g. ₹100 or default bonus) without intrusive warning logs
        if (isMounted) {
          setWalletJoiningBonus(100);
        }
      }
    };
    if (isOpen) {
      fetchBonus();
    }
    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Keep window.__ZOMINDIA_ONBOARDING_MODAL_VISIBLE in sync to prevent background GPS/Push
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__ZOMINDIA_ONBOARDING_MODAL_VISIBLE = Boolean(isOpen && view === 'profile-setup');
    }
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__ZOMINDIA_ONBOARDING_MODAL_VISIBLE = false;
      }
    };
  }, [isOpen, view]);

  // Native WebOTP API Auto-detection with AbortController, auto-populate, and auto-submit
  useEffect(() => {
    if (!isOpen || view !== 'otp-entry') return;

    if (typeof window === 'undefined' || !navigator.credentials || !('get' in navigator.credentials)) {
      return;
    }

    const ac = new AbortController();
    let autoSubmitTimer: any = null;

    navigator.credentials
      .get({
        otp: { transport: ['sms'] },
        signal: ac.signal,
      } as any)
      .then((content: any) => {
        if (content && content.code) {
          const digits = String(content.code).replace(/\D/g, '').slice(0, 6);
          if (digits.length === 6) {
            console.log('[WebOTP] SMS arrived, auto-filling 6-digit OTP:', digits);
            setOtpCode(digits);
            if (otpInputRef.current) {
              otpInputRef.current.value = digits;
            }
            autoSubmitTimer = setTimeout(() => {
              if (!ac.signal.aborted) {
                handleVerifyOTP(undefined, digits);
              }
            }, 300);
          }
        }
      })
      .catch((err: any) => {
        if (
          err?.name !== 'AbortError' &&
          err?.name !== 'SecurityError' &&
          !err?.message?.toLowerCase().includes('otp-credentials') &&
          !err?.message?.toLowerCase().includes('not supported')
        ) {
          console.warn('[WebOTP] Notice:', err);
        }
      });

    return () => {
      if (autoSubmitTimer) {
        clearTimeout(autoSubmitTimer);
      }
      try {
        ac.abort();
      } catch (_) {}
    };
  }, [isOpen, view]);

  // Auto-Focus on OTP View Entry
  useEffect(() => {
    if (view === 'otp-entry') {
      const t = setTimeout(() => {
        otpInputRef.current?.focus();
      }, 150);
      return () => clearTimeout(t);
    }
  }, [view]);

  // Native Smart Clipboard Auto-Detector (Notification "Copy OTP" Sync)
  const lastPastedRef = useRef<string>('');

  const checkClipboardForOtp = async () => {
    if (view !== 'otp-entry' || loading) return;
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const clipText = await navigator.clipboard.readText();
        const match = clipText.match(/\b\d{6}\b/);
        if (match && match[0] && match[0] !== lastPastedRef.current) {
          lastPastedRef.current = match[0];
          setOtpCode(match[0]);
          handleVerifyOTP(undefined, match[0]);
        }
      }
    } catch (_) {}
  };

  useEffect(() => {
    if (view !== 'otp-entry') return;
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkClipboardForOtp();
      }
    };
    window.addEventListener('focus', checkClipboardForOtp);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      window.removeEventListener('focus', checkClipboardForOtp);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [view]);

  // Clean form state upon open or close without clearing the initialized RecaptchaVerifier
  const resetForm = () => {
    setView(getInitialView());
    setPhoneNumber('');
    setOtpCode('');
    setAdminPassword('');
    lastPastedRef.current = '';
    setDisplayName(initialData?.displayName || '');
    setEmail(initialData?.email || '');
    setError(null);
    setConfirmationResult(null);
    setVerifiedUid(initialData?.uid || null);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    } else {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'unset';
      }
      clearRecaptchaInstance();
    }
    return () => {
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'unset';
      }
    };
  }, [isOpen, initialView, initialData]);

  // Defensive cleanup on unmount
  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined') {
        (window as any).__ZOMINDIA_ONBOARDING_MODAL_VISIBLE = false;
      }
      if (typeof document !== 'undefined') {
        document.body.style.overflow = 'unset';
      }
      clearRecaptchaInstance();
    };
  }, []);

  // Handle Phone Number submission to request OTP
  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setLoading(true);
    setError(null);
    const formattedPhone = `+91${cleanPhone}`;

    // Google Play Review Test Credentials bypass
    if (cleanPhone === '9752170789' || cleanPhone === '1234567890') {
      setView('otp-entry');
      setTimer(30);
      setLoading(false);
      return;
    }

    try {
      const verifier = getOrCreateRecaptchaVerifier(auth);
      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(result);
      setView('otp-entry');
      setTimer(30);
    } catch (err: any) {
      console.error("[AuthModal] Phone Auth SMS dispatch failed:", err);
      clearRecaptchaInstance();
      setError(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Re-request OTP 
  const handleResendOTP = async () => {
    if (timer > 0) return;

    setLoading(true);
    setError(null);
    clearRecaptchaInstance();
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const formattedPhone = `+91${cleanPhone}`;

    try {
      const verifier = getOrCreateRecaptchaVerifier(auth);
      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(result);
      setTimer(30);
    } catch (err: any) {
      console.error("[AuthModal] Resend OTP failed:", err);
      clearRecaptchaInstance();
      setError(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Handle OTP input change with instant 6-digit auto-verify
  const handleOtpChange = (val: string) => {
    const cleanDigits = val.replace(/\D/g, '').slice(0, 6);
    setOtpCode(cleanDigits);
    setError(null);

    // Instant auto-submit if user fills 6 digits
    if (cleanDigits.length === 6) {
      handleVerifyOTP(undefined, cleanDigits);
    }
  };

  // Verify OTP submission
  const handleVerifyOTP = async (e?: React.FormEvent, directOtpCode?: string) => {
    if (e) e.preventDefault();
    const code = directOtpCode || otpCode;
    if (code.length !== 6) {
      setError('Please enter the full 6-digit verification code');
      return;
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if ((cleanPhone === '9752170789' || cleanPhone === '1234567890') && code === '123456') {
      setLoading(true);
      setError(null);
      const testUid = 'partner_vikas_chopra_indore';
      setVerifiedUid(testUid);
      try {
        await setDoc(doc(db, 'users', testUid), {
          uid: testUid,
          phoneNumber: `+91${cleanPhone}`,
          mobile: `+91${cleanPhone}`,
          displayName: 'Vikas Chopra',
          fullName: 'Vikas Chopra',
          role: 'partner',
          kycStatus: 'approved',
          approvalStatus: 'approved',
          city: 'Indore',
          onboardingComplete: true,
          updatedAt: Timestamp.now()
        }, { merge: true });
      } catch (err) {
        console.warn('Test user firestore merge notice:', err);
      }

      localStorage.setItem('zomindia_partner_session', JSON.stringify({
        uid: testUid,
        phoneNumber: `+91${cleanPhone}`,
        displayName: 'Vikas Chopra',
        fullName: 'Vikas Chopra',
        role: 'partner',
        city: 'Indore',
        verified: true
      }));

      setView('success-transition');
      setTimeout(() => {
        onSuccess();
        onClose();
        resetForm();
      }, 1000);
      return;
    }

    if (!confirmationResult) {
      setError('No active verification session detected. Please request a new code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const credential = await confirmationResult.confirm(code);
      const userObj = credential.user;
      setVerifiedUid(userObj.uid);

      // Check Firestore for user profile
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const formattedPhone = cleanPhone ? `+91${cleanPhone}` : (userObj.phoneNumber || '');
      let profileSnap: any = null;
      try {
        profileSnap = await getDoc(doc(db, 'users', userObj.uid));
        if (!profileSnap?.exists() && formattedPhone) {
          const phoneQ = query(collection(db, 'users'), where('phoneNumber', '==', formattedPhone));
          const pSnap = await getDocs(phoneQ);
          if (!pSnap.empty) {
            profileSnap = pSnap.docs[0];
          }
        }
      } catch (fetchErr) {
        console.warn('[AuthModal] Profile fetch notice:', fetchErr);
      }

      // Strictly guard every access: userData?.role, userData?.customerData?.fullName, userData?.onboardingComplete. Never assume userData exists.
      // Default new user state: { role: 'customer', onboardingComplete: false, fullName: '' }
      const userData = profileSnap?.exists() ? profileSnap.data() : null;
      const hasCompletedOnboarding = Boolean(
        userData &&
        userData?.onboardingComplete !== false &&
        (userData?.fullName?.toString().trim() || userData?.displayName?.toString().trim() || userData?.customerData?.fullName?.toString().trim())
      );

      if (hasCompletedOnboarding) {
        setView('success-transition');
        setTimeout(() => {
          onSuccess();
          onClose();
          resetForm();
        }, 1500);
      } else {
        // Fresh phone number or incomplete profile -> Route directly to profile-setup view
        setDisplayName(userData?.customerData?.fullName || userData?.fullName || userData?.displayName || '');
        setEmail(userData?.customerData?.email || userData?.email || '');
        setVerifiedUid(userObj.uid);
        setView('profile-setup');
      }
    } catch (err: any) {
      console.error("[AuthModal] OTP verification error:", err);
      setError(getFriendlyAuthErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  // Create profile for new user of Phone OTP
  const handleRegisterProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Name is required');
      return;
    }
    if (!email.trim()) {
      setError('Email address is required');
      return;
    }
    
    const activeUid = verifiedUid || auth.currentUser?.uid;
    if (!activeUid) {
      setError('Active user session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const formattedPhone = cleanPhone ? `+91${cleanPhone}` : (auth.currentUser?.phoneNumber || '');
      const isSarthakEmail = email.toLowerCase().trim() === 'sarthakwebtech@gmail.com';

      // 1. Explicitly update the authenticated user's Auth profile (setting display name only; avoiding direct email modification or verification to prevent firebase policies from throwing errors)
      const currentUser = auth.currentUser;
      if (currentUser) {
        try {
          // Update Auth Profile Display Name
          await updateProfile(currentUser, { displayName: displayName.trim() });
        } catch (profileErr) {
          console.warn("Failed to update display name on Auth User:", profileErr);
        }

        try {
          // Reload user stats to ensure state sync
          await currentUser.reload();
        } catch (reloadErr) {
          console.log("Non-critical user reload bypass:", reloadErr);
        }
      }

      const userRef = doc(db, 'users', activeUid);
      const userSnap = await getDoc(userRef);

      const targetPhone = formattedPhone.trim();
      const emailLower = email.trim().toLowerCase();

      // Single clean, indexed lookup on phoneNumber and email
      let existingUserDoc: any = null;
      const lookupPromises: Promise<any>[] = [];

      if (targetPhone) {
        lookupPromises.push(
          getDocs(query(collection(db, 'users'), where('phoneNumber', '==', targetPhone)))
        );
      }
      if (emailLower && emailLower.includes('@') && !emailLower.includes('@phone.zomindia.com')) {
        lookupPromises.push(
          getDocs(query(collection(db, 'users'), where('email', '==', emailLower)))
        );
      }

      if (lookupPromises.length > 0) {
        const snapshots = await Promise.all(lookupPromises);
        for (const snap of snapshots) {
          if (!snap.empty) {
            if (!existingUserDoc && snap.docs[0].data()?.phoneNumber === targetPhone) {
              existingUserDoc = snap.docs[0];
            }
          }
        }
      }

      if (existingUserDoc) {
        // Enforce strict merge session cleanly into the authenticated user record
        const existingData = existingUserDoc.data() || {};
        const mergedPayload: any = buildDualPersonaUserDoc({
          ...existingData,
          uid: activeUid, // Strictly activeUid!
          displayName: displayName.trim(),
          fullName: displayName.trim(),
          email: email.trim(),
          phoneNumber: targetPhone,
          mobile: targetPhone,
          onboardingComplete: true,
          updatedAt: Timestamp.now()
        });

        if (isSarthakEmail) {
          mergedPayload.role = 'admin';
          mergedPayload.adminSubRole = 'head';
        } else if (!mergedPayload.role) {
          mergedPayload.role = existingData?.role || 'customer';
        }

        try {
          await setDoc(userRef, mergedPayload, { merge: true });
        } catch (setDocErr: any) {
          console.error('[AuthModal] Merge setDoc error:', setDocErr);
          setError(`Failed to save profile: ${setDocErr?.message || 'Database error'}. Please try again.`);
          setLoading(false);
          return;
        }
      } else if (userSnap && userSnap.exists()) {
        const existingData = userSnap.data() || {};
        // Safe partial update of only user-controllable fields
        const updatePayload: any = {
          displayName: displayName.trim(),
          fullName: displayName.trim(),
          email: email.trim(),
          phoneNumber: formattedPhone || existingData?.phoneNumber || '',
          mobile: formattedPhone || existingData?.mobile || existingData?.phoneNumber || '',
          onboardingComplete: true,
          updatedAt: Timestamp.now(),
          isPartner: Boolean(existingData?.isPartner),
          customerData: {
            fullName: displayName.trim(),
            email: email.trim(),
            phoneNumber: formattedPhone || existingData?.phoneNumber || '',
            ...(existingData?.customerData || {}),
          }
        };
        if (existingData?.walletBalance === undefined) {
          updatePayload.walletBalance = walletJoiningBonus;
        }
        if (isSarthakEmail) {
          updatePayload.role = 'admin';
          updatePayload.adminSubRole = 'head';
        }

        try {
          await setDoc(userRef, updatePayload, { merge: true });
        } catch (setDocErr: any) {
          console.error('[AuthModal] Update setDoc error:', setDocErr);
          setError(`Failed to update profile: ${setDocErr?.message || 'Database error'}. Please try again.`);
          setLoading(false);
          return;
        }
      } else {
        // Default new user state: { role: 'customer', onboardingComplete: false, fullName: '' }
        // Set up fresh document
        const initialProfile: any = {
          uid: activeUid,
          displayName: displayName.trim(),
          fullName: displayName.trim(),
          email: email.trim(),
          phoneNumber: formattedPhone,
          mobile: formattedPhone,
          role: isSarthakEmail ? 'admin' : 'customer',
          isPartner: false,
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now(),
          referralCode: `ZOM${activeUid.slice(-6).toUpperCase()}`,
          walletBalance: walletJoiningBonus, // Dynamic Onboarding welcome credit!
          onboardingComplete: true,
          savedAddresses: [],
          addresses: [],
          bookings: [],
          customerData: {
            fullName: displayName.trim(),
            email: email.trim(),
            phoneNumber: formattedPhone,
            mobile: formattedPhone,
            walletBalance: walletJoiningBonus,
          },
          notificationPreferences: {
            bookingUpdates: true,
            promotionalMessages: true
          }
        };

        if (isSarthakEmail) {
          initialProfile.adminSubRole = 'head';
        }

        try {
          await setDoc(userRef, initialProfile, { merge: true });
        } catch (setDocErr: any) {
          console.error('[AuthModal] Fresh user setDoc error:', setDocErr);
          setError(`Failed to create user account: ${setDocErr?.message || 'Database error'}. Please try again.`);
          setLoading(false);
          return;
        }
      }

      setView('success-transition');
      setTimeout(() => {
        onSuccess();
        onClose();
        resetForm();
      }, 1500);
    } catch (err: any) {
      console.error("Profile registration error: ", err);
      setError('Failed to setup profile: ' + (err.message || 'Error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const handleAdminEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), adminPassword);
      const userDoc = await getDoc(doc(db, 'users', cred.user.uid));
      const data = userDoc.exists() ? userDoc.data() : null;
      const isSarthak = email.trim().toLowerCase() === 'sarthakwebtech@gmail.com';

      if (isSarthak || data?.role === 'admin' || data?.adminSubRole) {
        localStorage.setItem('zomindia_admin_authenticated', 'true');
        setView('success-transition');
        setTimeout(() => {
          onSuccess();
          onClose();
          resetForm();
        }, 800);
      } else {
        setError('Access denied: You do not have administrator permissions.');
      }
    } catch (err: any) {
      if (err?.code?.includes('auth/operation-not-allowed') || err?.message?.includes('auth/operation-not-allowed')) {
        setError('Email/Password sign-in is disabled in Firebase Console. Please enable it under Authentication > Sign-in method.');
      } else {
        setError(err.message || 'Authentication failed. Please verify your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-neutral-900/40 backdrop-blur-sm"
        // Disabled backdrop click dismissal to prevent accidental screen close on keyboard mistouches (e.g. typing login info/search)
        onClick={undefined}
      />

      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative overflow-hidden bg-white rounded-3xl shadow-2xl border border-slate-100 max-w-sm sm:max-w-md w-full mx-auto flex flex-col max-h-[92vh] z-10"
      >
        {/* 1. Top Hero Branding Banner */}
        {view !== 'success-transition' && (
          <div className="bg-gradient-to-br from-[#071435] via-[#0f2868] to-[#1e1b4b] py-6 sm:py-7 px-6 text-center relative shrink-0 overflow-hidden">
            {/* Subtle decorative glowing ambient orbs */}
            <div className="absolute -top-10 -left-10 w-36 h-36 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute -bottom-8 -right-8 w-40 h-40 bg-cyan-400/25 rounded-full blur-2xl pointer-events-none" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-16 bg-blue-500/20 rounded-full blur-xl pointer-events-none" />

            {/* Back button for OTP Entry state */}
            {view === 'otp-entry' && (
              <button
                type="button"
                onClick={() => setView('phone-entry')}
                className="absolute top-3.5 left-3.5 z-20 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold pr-3"
                title="Change phone number"
              >
                <ChevronLeft size={16} />
                <span>Back</span>
              </button>
            )}

            {/* Close Button: Clean translucent pill in top-right */}
            <button 
              type="button"
              onClick={onClose}
              className="absolute top-3.5 right-3.5 z-20 bg-white/10 hover:bg-white/20 text-white rounded-full p-2 transition-all cursor-pointer"
              title="Close"
            >
              <X size={16} />
            </button>

            {/* Top Brand Banner Header */}
            <div className="flex flex-col items-center justify-center relative z-10 select-none">
              <div className="bg-white/95 px-4 py-1.5 rounded-2xl shadow-md border border-white/20 inline-flex items-center justify-center mb-2 backdrop-blur-xs">
                <img 
                  src="/logo-horizontal.png" 
                  alt="Zomindia" 
                  className="h-6 sm:h-7 w-auto object-contain"
                  onError={(e) => {
                    // fallback to /logo-horizontal-white.png if /logo-horizontal.png fails
                    const target = e.target as HTMLImageElement;
                    if (!target.src.includes('logo-horizontal-white.png')) {
                      target.src = '/logo-horizontal-white.png';
                    }
                  }}
                />
              </div>
              <span className="text-[10.5px] font-bold tracking-widest text-blue-200 uppercase">India's Trusted Home Services</span>
            </div>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            
            {/* VIEW 1: Phone Entry (Zomato / Swiggy Clean Single Flow) */}
            {view === 'phone-entry' && (
              <motion.div
                key="phone-entry"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="pt-6 pb-6 px-6 sm:px-8 text-center space-y-4"
              >
                {/* 3. Engaging Typography & Input Section */}
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Login or Sign up
                  </h2>
                  <p className="text-slate-500 text-xs sm:text-sm mt-1 mb-6 leading-relaxed">
                    Enter your mobile number to get an OTP for instant access.
                  </p>
                </div>

                <form onSubmit={handleRequestOTP} className="space-y-4">
                  <div>
                    <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase text-left mb-1.5 block">
                      Enter Mobile Number
                    </label>
                    <div className="flex items-center bg-slate-50 border-2 border-slate-200 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 rounded-2xl px-3.5 py-2.5 transition-all">
                      {/* Country prefix (+91 with Flag) */}
                      <div className="font-bold text-slate-800 pr-3 border-r border-slate-200 flex items-center gap-1.5 shrink-0 select-none">
                        <img src="https://flagcdn.com/w20/in.png" alt="India flag" className="w-4 h-auto rounded-xs shadow-2xs" />
                        <span className="text-sm font-black text-slate-900">+91</span>
                      </div>
                      {/* Phone Input */}
                      <input 
                        type="tel"
                        required
                        autoFocus
                        value={phoneNumber}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                          setPhoneNumber(val);
                        }}
                        placeholder="98765 43210"
                        className="bg-transparent text-slate-900 font-bold tracking-widest text-base sm:text-lg focus:outline-none pl-3 w-full placeholder:text-slate-300 placeholder:font-normal placeholder:tracking-normal"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 rounded-2xl border border-rose-100 text-rose-600 text-xs font-semibold leading-relaxed text-left">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  {/* 4. Vibrant "Continue" Action Button */}
                  <button
                    type="submit"
                    disabled={loading || phoneNumber.length < 10}
                    className="w-full mt-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:from-blue-800 hover:to-indigo-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {loading ? (
                      <BrandedButtonSpinner className="w-5 h-5" />
                    ) : (
                      <>
                        <span>Continue</span>
                        <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-[10px] text-slate-400 font-medium px-2 pt-1 leading-normal">
                  By continuing, you agree to Zomindia's <span className="text-blue-700 hover:underline font-semibold cursor-pointer">Terms & Privacy Policy</span>.
                </p>

                {/* 5. Colorful Micro-Trust Badges */}
                <div className="flex items-center gap-2 justify-center flex-wrap pt-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-full px-2.5 py-1">
                    <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
                    <span>100% Secure SSL</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 rounded-full px-2.5 py-1">
                    <Zap size={12} className="text-amber-500 shrink-0 fill-amber-500" />
                    <span>Instant OTP</span>
                  </span>
                </div>
              </motion.div>
            )}

            {/* VIEW 2: OTP Entry state (Clean verification blocks) */}
            {view === 'otp-entry' && (
              <motion.div
                key="otp-entry"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="pt-6 pb-6 px-6 sm:px-8 text-center space-y-4"
              >
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Enter Verification Code
                  </h2>
                  <p className="text-slate-500 text-xs sm:text-sm mt-1 mb-2 leading-relaxed">
                    We've sent a 6-digit OTP via SMS to <span className="font-bold text-slate-900">+91 {phoneNumber}</span>
                  </p>
                  <button 
                    type="button"
                    onClick={() => setView('phone-entry')}
                    className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                  >
                    <ChevronLeft size={13} />
                    <span>Change phone number</span>
                  </button>
                </div>

                <form onSubmit={handleVerifyOTP} className="space-y-4 pt-1">
                  {/* Single Unified 6-Digit OTP Input with Visual Box Presentation */}
                  <div className="relative w-full">
                    {/* Underlying single native input for Chrome/Android/iOS WebOTP, auto-fill, and SMS paste bar */}
                    <input
                      ref={otpInputRef}
                      name="otp"
                      id="otp"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={6}
                      aria-label="6-digit verification code"
                      autoFocus
                      required
                      value={otpCode}
                      onChange={(e) => handleOtpChange(e.target.value)}
                      onPaste={(e) => {
                        const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
                        if (pasted.length === 6) {
                          setOtpCode(pasted);
                          handleVerifyOTP(undefined, pasted);
                        }
                      }}
                      className="absolute inset-0 w-full h-full text-transparent bg-transparent caret-transparent focus:outline-none z-20 cursor-pointer"
                    />

                    {/* Visual 6-box representation synced directly with single unified state */}
                    <div className="flex justify-between gap-1.5 sm:gap-2 p-1.5 bg-slate-50 rounded-2xl border-2 border-slate-200 select-none pointer-events-none">
                      {Array.from({ length: 6 }).map((_, idx) => {
                        const digit = otpCode[idx] || '';
                        const isCurrentActive = otpCode.length === idx || (idx === 5 && otpCode.length === 6);

                        return (
                          <div
                            key={idx}
                            className={`flex-1 h-12 sm:h-14 min-w-0 max-w-[42px] sm:max-w-[48px] bg-white border text-center text-lg sm:text-xl font-black rounded-xl shadow-xs flex items-center justify-center transition-all duration-150 ${
                              isCurrentActive
                                ? 'border-blue-600 ring-4 ring-blue-500/15 text-blue-700 scale-105'
                                : digit
                                ? 'border-slate-400 text-slate-900'
                                : 'border-slate-200 text-slate-400'
                            }`}
                          >
                            {digit ? (
                              <span>{digit}</span>
                            ) : (
                              <span className="w-2 h-2 rounded-full bg-slate-200" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-center pt-1">
                    <button
                      type="button"
                      onClick={checkClipboardForOtp}
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/80 px-3 py-1 rounded-full transition-all cursor-pointer active:scale-95"
                    >
                      <span>📋 Paste OTP from SMS</span>
                    </button>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 rounded-2xl border border-rose-100 text-rose-600 text-xs font-semibold leading-relaxed text-left">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <button
                      type="submit"
                      disabled={loading || otpCode.length < 6}
                      className="w-full mt-5 py-3.5 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:from-blue-800 hover:to-indigo-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <BrandedButtonSpinner className="w-5 h-5 mx-auto" />
                      ) : (
                        <>
                          <span>Verify & Continue</span>
                          <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
                        </>
                      )}
                    </button>

                    <div className="text-center pt-1">
                      <button
                        type="button"
                        disabled={timer > 0 || loading}
                        onClick={handleResendOTP}
                        className={`text-xs font-bold uppercase tracking-wider transition-colors ${
                          timer > 0 ? 'text-slate-400 cursor-not-allowed' : 'text-blue-700 hover:text-blue-900 hover:underline cursor-pointer'
                        }`}
                      >
                        {timer > 0 ? `Resend code in ${timer}s` : 'Send OTP again'}
                      </button>
                    </div>
                  </div>
                </form>

                {/* Micro-Trust Badges in OTP view */}
                <div className="flex items-center gap-2 justify-center flex-wrap pt-2">
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/60 rounded-full px-2.5 py-1">
                    <ShieldCheck size={12} className="text-emerald-600 shrink-0" />
                    <span>100% Secure SSL</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/60 rounded-full px-2.5 py-1">
                    <Zap size={12} className="text-amber-500 shrink-0 fill-amber-500" />
                    <span>Instant OTP</span>
                  </span>
                </div>
              </motion.div>
            )}

            {/* VIEW 3: Create Profile Step (Shown ONLY if it is a brand-new user) */}
            {view === 'profile-setup' && (
              <motion.div
                key="profile-setup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="pt-6 pb-6 px-6 sm:px-8 text-center space-y-4"
              >
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Welcome to Zomindia! 🎉
                  </h2>
                  <p className="text-slate-500 text-xs sm:text-sm mt-1 mb-4 leading-relaxed">
                    Just a quick step to complete your profile.
                  </p>
                </div>

                <form onSubmit={handleRegisterProfile} className="space-y-4 text-left">
                  <div>
                    <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase text-left mb-1.5 block">
                      Full Name
                    </label>
                    <div className="flex items-center bg-slate-50 border-2 border-slate-200 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 rounded-2xl px-3.5 py-2.5 transition-all">
                      <input 
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Rahul Sharma"
                        className="bg-transparent text-slate-900 font-bold text-sm sm:text-base focus:outline-none w-full placeholder:text-slate-300 placeholder:font-normal"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase text-left mb-1.5 block">
                      Email Address
                    </label>
                    <div className="flex items-center bg-slate-50 border-2 border-slate-200 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 rounded-2xl px-3.5 py-2.5 transition-all">
                      <input 
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="rahul.sharma@example.com"
                        className="bg-transparent text-slate-900 font-bold text-sm sm:text-base focus:outline-none w-full placeholder:text-slate-300 placeholder:font-normal"
                      />
                    </div>
                    <p className="mt-1 text-[10px] text-slate-400 font-medium">We'll send your official service invoices & warranty cards here.</p>
                  </div>

                  <div className="p-3.5 bg-gradient-to-r from-amber-50 to-emerald-50 rounded-2xl border border-amber-200/60 flex items-center justify-between text-left">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-amber-800 uppercase tracking-wider flex items-center gap-1">
                        <span>🎁 Welcome Onboard Credit</span>
                      </p>
                      <p className="text-xs text-slate-600 font-semibold">
                        Get ₹{walletJoiningBonus} welcome bonus instantly in your Zomindia wallet!
                      </p>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 rounded-2xl border border-rose-100 text-rose-600 text-xs font-semibold leading-relaxed">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !displayName.trim()}
                    className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:from-blue-800 hover:to-indigo-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <BrandedButtonSpinner className="w-5 h-5 mx-auto" />
                    ) : (
                      <>
                        <span>Complete Profile & Start</span>
                        <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* VIEW 4: Success Transition State */}
            {view === 'success-transition' && (
              <motion.div
                key="success-transition"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="text-center py-12 px-6 sm:px-8 space-y-6"
              >
                <div className="relative flex items-center justify-center mx-auto w-24 h-24">
                  <motion.div 
                    animate={{ scale: [1, 1.25, 1], opacity: [0.15, 0.35, 0.15] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 bg-blue-600/25 rounded-full"
                  />
                  <motion.div 
                    animate={{ scale: [1, 1.15, 1], opacity: [0.2, 0.4, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut', delay: 0.2 }}
                    className="absolute inset-2 bg-amber-400/20 rounded-full"
                  />
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative bg-gradient-to-br from-blue-700 to-indigo-700 text-white w-16 h-16 rounded-3xl flex items-center justify-center shadow-xl shadow-blue-700/30 ring-4 ring-amber-400/40"
                  >
                    <CheckCircle2 size={32} className="text-amber-300" />
                  </motion.div>
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">You're Logged In!</h3>
                  <p className="text-xs text-slate-500 font-semibold">
                    Loading your profile, bookings, and wallet...
                  </p>
                </div>

                <div className="w-44 bg-slate-100 h-1.5 rounded-full overflow-hidden mx-auto border border-slate-200">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="h-full bg-gradient-to-r from-blue-700 via-indigo-600 to-amber-400 rounded-full"
                  />
                </div>
              </motion.div>
            )}

            {/* VIEW 5: Admin Email & Password Login */}
            {view === 'admin-email' && (
              <motion.div
                key="admin-email"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="pt-6 pb-6 px-6 sm:px-8 text-center space-y-4"
              >
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                    Admin Portal Sign In
                  </h2>
                  <p className="text-slate-500 text-xs sm:text-sm mt-1 mb-4 leading-relaxed">
                    Enter your authorized head office or regional management credentials.
                  </p>
                </div>

                <form onSubmit={handleAdminEmailLogin} className="space-y-4 text-left">
                  <div>
                    <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase text-left mb-1.5 block">
                      Admin Email
                    </label>
                    <div className="flex items-center bg-slate-50 border-2 border-slate-200 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 rounded-2xl px-3.5 py-2.5 transition-all gap-2.5">
                      <Mail size={16} className="text-slate-400 shrink-0" />
                      <input
                        type="email"
                        required
                        autoFocus
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="admin@zomindia.com"
                        className="bg-transparent text-slate-900 font-bold text-sm sm:text-base focus:outline-none w-full placeholder:text-slate-300 placeholder:font-normal"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold tracking-wider text-slate-400 uppercase text-left mb-1.5 block">
                      Password
                    </label>
                    <div className="relative flex items-center bg-slate-50 border-2 border-slate-200 focus-within:border-blue-600 focus-within:bg-white focus-within:ring-4 focus-within:ring-blue-500/10 rounded-2xl px-3.5 py-2.5 transition-all gap-2.5">
                      <Lock size={16} className="text-slate-400 shrink-0" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={adminPassword}
                        onChange={(e) => setAdminPassword(e.target.value)}
                        placeholder="••••••••"
                        className="bg-transparent text-slate-900 font-bold text-sm sm:text-base focus:outline-none w-full pr-11 placeholder:text-slate-300 placeholder:font-normal"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-1 cursor-pointer focus:outline-none"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 rounded-2xl border border-rose-100 text-rose-600 text-xs font-semibold leading-relaxed text-left">
                      <AlertCircle size={15} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !email.trim() || !adminPassword}
                    className="w-full mt-4 py-3.5 rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-800 hover:from-blue-800 hover:to-indigo-700 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-600/30 hover:shadow-xl hover:shadow-blue-600/40 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
                  >
                    {loading ? (
                      <BrandedButtonSpinner className="w-5 h-5 mx-auto" />
                    ) : (
                      <>
                        <span>Sign In to Admin Portal</span>
                        <ArrowRight size={18} className="transform group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </button>
                </form>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setError(null);
                      setView('phone-entry');
                    }}
                    className="text-xs font-bold text-blue-700 hover:text-blue-900 hover:underline cursor-pointer"
                  >
                    Sign in with Mobile OTP instead
                  </button>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
