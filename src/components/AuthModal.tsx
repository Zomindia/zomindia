import React, { useState, useEffect, useRef } from 'react';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
  updateProfile,
} from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { doc, setDoc, Timestamp, getDoc, updateDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { BrandedButtonSpinner } from './LoadingIndicator';
import { 
  X, 
  Smartphone, 
  ArrowRight, 
  CheckCircle2, 
  AlertCircle,
  ChevronLeft
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

// Support phone & Google-based sign-in for maximum conversion and security.
type AuthView = 
  | 'login-selection'
  | 'phone-entry'
  | 'otp-entry'
  | 'profile-setup'
  | 'google-phone-setup'
  | 'success-transition';

export default function AuthModal({ isOpen, onClose, onSuccess }: Props) {
  const [view, setView] = useState<AuthView>('login-selection');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // OTP states
  const [otpValues, setOtpValues] = useState<string[]>(Array(6).fill(''));
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Registration data
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');

  // Status & states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [verifiedUid, setVerifiedUid] = useState<string | null>(null);

  const recaptchaRef = useRef<any>(null);

  useEffect(() => {
    let interval: any;
    if (timer > 0) {
      interval = setInterval(() => setTimer(t => t - 1), 1000);
    }
    return () => clearInterval(interval);
  }, [timer]);

  // Clean form state upon open or close
  const resetForm = () => {
    setView('login-selection');
    setPhoneNumber('');
    setOtpValues(Array(6).fill(''));
    setDisplayName('');
    setEmail('');
    setError(null);
    setConfirmationResult(null);
    setVerifiedUid(null);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    }
  }, [isOpen]);

  // Senior dev addition: WebOTP Auto-detection API for mobile browsers
  useEffect(() => {
    if (view !== 'otp-entry') return;

    if (typeof window !== 'undefined' && 'OTPCredential' in window) {
      const ac = new AbortController();
      navigator.credentials.get({
        otp: { transport: ['sms'] },
        signal: ac.signal
      } as any).then((otp: any) => {
        if (otp && otp.code) {
          const codeDigits = otp.code.replace(/\D/g, '').slice(0, 6);
          if (codeDigits.length === 6) {
            const newOtp = codeDigits.split('');
            setOtpValues(newOtp);
            otpInputRefs.current[5]?.focus();
            
            // Allow user a fraction of a second to visually confirm, then auto-submit the form
            setTimeout(() => {
              const submitBtn = document.querySelector('form button[type="submit"]') as HTMLButtonElement;
              if (submitBtn && !submitBtn.disabled) {
                console.log('[WebOTP] Auto-submitting verification form.');
                submitBtn.click();
              }
            }, 600);
          }
        }
      }).catch((err) => {
        if (err.name !== 'AbortError' && err.name !== 'SecurityError' && !err.message?.toLowerCase().includes('otp-credentials')) {
          console.error('[WebOTP API] Error auto-detecting OTP:', err);
        } else {
          console.log('[WebOTP API] Auto-detection bypassed (sandbox/iframe restrictions or aborted).');
        }
      });

      return () => {
        ac.abort();
      };
    }
  }, [view]);

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

    try {
      const formattedPhone = `+91${cleanPhone}`;
      
      // Cleanup existing recaptcha verifier
      if (recaptchaRef.current) {
        recaptchaRef.current.clear();
      }

      // Initialize Recaptcha Verifier
      const verifier = new RecaptchaVerifier(auth, 'recaptcha-anchor', {
        size: 'invisible',
        callback: () => {}
      });
      await verifier.render();
      recaptchaRef.current = verifier;
      (window as any).recaptchaVerifier = verifier;

      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(result);
      setView('otp-entry');
      setTimer(30);
    } catch (err: any) {
      console.error("SMS dispatch failed:", err);
      let friendlyMessage = 'Failed to send verification code. Please check your network and try again.';
      if (err.code === 'auth/unauthorized-domain') {
        friendlyMessage = 'Staging environment/unauthorized domain detected. Please add this domain to the Authorized Domains list in the Firebase Console.';
      } else if (err.code === 'auth/too-many-requests') {
        friendlyMessage = 'Too many requests. Please try again later.';
      } else if (err.code === 'auth/invalid-phone-number') {
        friendlyMessage = 'Invalid phone number format. Please enter a valid 10-digit Indian phone number.';
      } else if (err.message) {
        friendlyMessage = err.message;
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // Re-request OTP 
  const handleResendOTP = async () => {
    if (timer > 0) return;
    setLoading(true);
    setError(null);
    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const formattedPhone = `+91${cleanPhone}`;
      const appVerifier = (window as any).recaptchaVerifier;
      if (appVerifier) {
        const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
        setConfirmationResult(result);
        setTimer(30);
      } else {
        setError('Verification session expired. Please enter your phone number again.');
      }
    } catch (err: any) {
      console.error("Resend OTP failed:", err);
      let friendlyMessage = 'Resend failed. Please try again.';
      if (err.message) {
        friendlyMessage = err.message;
      }
      setError(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  // Handle key input navigation in the 6 split digit boxes (like Urban Company / Zomato)
  const handleOtpInput = (index: number, value: string) => {
    const cleanVal = value.replace(/\D/g, '').slice(-1);
    const newOtp = [...otpValues];
    newOtp[index] = cleanVal;
    setOtpValues(newOtp);

    // Auto focus next box
    if (cleanVal !== '' && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (otpValues[index] === '' && index > 0) {
        const newOtp = [...otpValues];
        newOtp[index - 1] = '';
        setOtpValues(newOtp);
        otpInputRefs.current[index - 1]?.focus();
      } else {
        const newOtp = [...otpValues];
        newOtp[index] = '';
        setOtpValues(newOtp);
      }
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedText.length > 0) {
      const newOtp = [...otpValues];
      for (let i = 0; i < 6; i++) {
        if (pastedText[i]) newOtp[i] = pastedText[i];
      }
      setOtpValues(newOtp);
      const focusIndex = Math.min(pastedText.length, 5);
      otpInputRefs.current[focusIndex]?.focus();
    }
  };

  // Verify OTP submission
  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = otpValues.join('');
    if (code.length !== 6) {
      setError('Please enter the full 6-digit verification code');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let userObj: any = null;

      if (confirmationResult) {
        const credential = await confirmationResult.confirm(code);
        userObj = credential.user;
        setVerifiedUid(userObj.uid);

        // Check Firestore
        const profileSnap = await getDoc(doc(db, 'users', userObj.uid));
        if (profileSnap.exists()) {
          setView('success-transition');
          setTimeout(() => {
            onSuccess();
            onClose();
            resetForm();
          }, 1500);
        } else {
          setView('profile-setup');
        }
      } else {
        throw new Error('No active verification session detected. Please request a new code.');
      }
    } catch (err: any) {
      console.error("OTP verification error:", err);
      let friendlyMessage = 'Invalid verification code. Please check and try again.';
      if (err.code === 'auth/invalid-verification-code') {
        friendlyMessage = 'The verification code entered is invalid. Please try again.';
      } else if (err.code === 'auth/code-expired') {
        friendlyMessage = 'This verification code is expired. Please request a new OTP code.';
      } else if (err.message) {
        friendlyMessage = err.message;
      }
      setError(friendlyMessage);
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
    if (!verifiedUid) return;

    setLoading(true);
    setError(null);

    try {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const formattedPhone = `+91${cleanPhone}`;
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

      const userRef = doc(db, 'users', verifiedUid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        // Safe partial update of only user-controllable fields
        const updatePayload: any = {
          displayName: displayName.trim(),
          email: email.trim(),
          phoneNumber: formattedPhone,
          updatedAt: Timestamp.now()
        };
        // Omit role updates for normal clients to prevent any potential privilege-escalation/rule failures
        if (isSarthakEmail) {
          updatePayload.role = 'admin';
          updatePayload.adminSubRole = 'head';
        }
        await updateDoc(userRef, updatePayload);
      } else {
        // Fallback document creation if auto-creation in App.tsx hasn't completed yet
        const initialProfile: any = {
          uid: verifiedUid,
          displayName: displayName.trim(),
          email: email.trim(),
          phoneNumber: formattedPhone,
          role: isSarthakEmail ? 'admin' : 'customer',
          createdAt: Timestamp.now(),
          referralCode: `ZOM${verifiedUid.slice(-6).toUpperCase()}`,
          walletBalance: 100, // ₹100 Welcome Bonus on onboarding!
          notificationPreferences: {
            bookingUpdates: true,
            promotionalMessages: true
          }
        };

        if (isSarthakEmail) {
          initialProfile.adminSubRole = 'head';
        }

        await setDoc(userRef, initialProfile);
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

  // Google Sign In & Dynamic Firestore Profile Sync
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      const userCredential = await signInWithPopup(auth, provider);
      const user = userCredential.user;
      
      const pDoc = await getDoc(doc(db, 'users', user.uid));
      const hasStoredPhone = pDoc.exists() && pDoc.data()?.phoneNumber && pDoc.data()?.phoneNumber.toString().trim().length >= 10;

      // Keep user references in modal state for registration check
      setVerifiedUid(user.uid);
      setDisplayName(user.displayName || pDoc.data()?.displayName || '');
      setEmail(user.email || pDoc.data()?.email || '');

      if (!hasStoredPhone) {
        // If they don't have a phone, seamlessly transition to setup step
        setView('google-phone-setup');
      } else {
        // Already registered with a phone number, proceed seamlessly
        setView('success-transition');
        setTimeout(() => {
          onSuccess();
          onClose();
          resetForm();
        }, 1500);
      }
    } catch (err: any) {
      console.error("Google authentication error:", err);
      setError(err.message || 'Google authentication unsuccessful');
    } finally {
      setLoading(false);
    }
  };

  // Setup mobile number for Google Signed-In Users (Saving directly to Firestore, bypassing Auth Email update errors entirely)
  const handleGooglePhoneRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }
    if (!verifiedUid) {
      setError('Active user session expired. Please sign in again.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const formattedPhone = `+91${cleanPhone}`;
      const isSarthakEmail = email.toLowerCase().trim() === 'sarthakwebtech@gmail.com';
      const userRef = doc(db, 'users', verifiedUid);
      const userSnap = await getDoc(userRef);

      const profilePayload: any = {
        uid: verifiedUid,
        displayName: displayName.trim() || 'User',
        email: email.trim(),
        phoneNumber: formattedPhone,
        role: isSarthakEmail ? 'admin' : (userSnap.exists() && userSnap.data()?.role ? userSnap.data()?.role : 'customer'),
        createdAt: userSnap.exists() && userSnap.data()?.createdAt ? userSnap.data()?.createdAt : Timestamp.now(),
        updatedAt: Timestamp.now(),
        referralCode: userSnap.exists() && userSnap.data()?.referralCode ? userSnap.data()?.referralCode : `ZOM${verifiedUid.slice(0, 6).toUpperCase()}`,
        walletBalance: userSnap.exists() && userSnap.data()?.walletBalance !== undefined ? userSnap.data()?.walletBalance : 100,
        notificationPreferences: userSnap.exists() && userSnap.data()?.notificationPreferences ? userSnap.data()?.notificationPreferences : {
          bookingUpdates: true,
          promotionalMessages: true
        }
      };

      if (isSarthakEmail) {
        profilePayload.adminSubRole = 'head';
      }

      await setDoc(userRef, profilePayload, { merge: true });

      setView('success-transition');
      setTimeout(() => {
        onSuccess();
        onClose();
        resetForm();
      }, 1500);
    } catch (err: any) {
      console.error("Google phone setup failed:", err);
      setError('Failed to setup mobile details in profile: ' + (err.message || 'Error occurred'));
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
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
        className="relative w-full max-w-[400px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Dynamic Header */}
        {view !== 'success-transition' && (
          <div className="px-6 pt-6 pb-2 flex justify-between items-center bg-white border-b border-neutral-50/50">
            <div className="flex items-center gap-1.5 select-none">
              <span className="w-6 h-6 rounded-lg bg-[#050CA6] flex items-center justify-center text-white font-black text-xs">Z</span>
              <span className="text-sm font-black tracking-tight text-slate-800">zomindia</span>
            </div>
            
            <button 
              onClick={onClose}
              className="p-1 px-1.5 hover:bg-neutral-50 rounded-xl transition-all font-medium text-neutral-400 text-xs hover:text-neutral-700 flex items-center gap-1"
            >
              <X size={12} />
              <span>close</span>
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto no-scrollbar">
          <AnimatePresence mode="wait">
            
            {/* VIEW 0: Login Selection Screen */}
            {view === 'login-selection' && (
              <motion.div
                key="login-selection"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 py-2"
              >
                <div className="text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#050CA6] to-indigo-600 flex items-center justify-center text-white font-black text-2xl mx-auto shadow-lg shadow-blue-700/20">
                    Z
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-neutral-900 mt-2">
                    Welcome to zomindia
                  </h2>
                  <p className="text-xs text-neutral-500 max-w-[270px] mx-auto leading-relaxed">
                    India's premium safe-marketplace for quality home services.
                  </p>
                </div>

                <div className="space-y-3 pt-2">
                  {/* Google Authenticate Button (Bold + Premium Accent) */}
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-white border border-neutral-200 p-4 rounded-2xl font-bold text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300 active:scale-[0.98] transition-all duration-200 outline-none shadow-sm relative overflow-hidden group"
                  >
                    <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="" className="w-5 h-5" />
                    <span className="text-sm">Continue with Google</span>
                  </button>

                  {/* Mobile Sign In Button (Zomato/Urban Company Bold Accent) */}
                  <button
                    type="button"
                    onClick={() => {
                      setView('phone-entry');
                      setError(null);
                    }}
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-3 bg-[#050CA6] text-white p-4 rounded-2xl font-bold hover:bg-[#040980] active:scale-[0.98] transition-all duration-200 outline-none shadow-md shadow-blue-700/10"
                  >
                    <Smartphone size={18} />
                    <span className="text-sm">Continue with Mobile Number</span>
                  </button>
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 rounded-2xl border border-rose-100 text-rose-600 text-xs font-semibold leading-relaxed">
                    <AlertCircle size={15} className="shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                <div className="flex items-center gap-2.5 justify-center text-[10px] text-neutral-400 font-medium px-2 leading-normal">
                  <span>Secure 256-bit SSL encryption</span>
                  <span>•</span>
                  <span>100% verified partners</span>
                </div>
              </motion.div>
            )}

            {/* VIEW 1: Phone Entry (Zomato/Urban Company Inspired) */}
            {view === 'phone-entry' && (
              <motion.div
                key="phone-entry"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <button 
                    type="button"
                    onClick={() => setView('login-selection')}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-[#050CA6] uppercase tracking-wider hover:underline"
                  >
                    <ChevronLeft size={12} />
                    <span>Back</span>
                  </button>
                  <h2 className="text-xl font-bold tracking-tight text-neutral-900 mt-2">
                    Verify Mobile Number
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    An OTP will be sent to this number for quick validation.
                  </p>
                </div>

                <form onSubmit={handleRequestOTP} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                      Enter Mobile Number
                    </label>
                    <div className="relative">
                      {/* Flag Code container in input tag */}
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-3 border-r border-neutral-100">
                        <img src="https://flagcdn.com/w20/in.png" alt="India flag" className="w-4 rounded-sm" />
                        <span className="text-xs font-bold text-neutral-800">+91</span>
                      </div>
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
                        className="w-full bg-neutral-50 border border-neutral-100 focus:border-[#050CA6] focus:bg-white pl-[84px] pr-4 py-3.5 rounded-2xl outline-none transition-all font-semibold text-sm tracking-widest text-neutral-900"
                      />
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
                    disabled={loading || phoneNumber.length < 10}
                    className="w-full bg-[#050CA6] text-white p-3.5 rounded-2xl font-bold hover:bg-[#040980] transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm shadow-[0_12px_24px_-4px_rgba(5,12,166,0.15)]"
                  >
                    {loading ? (
                      <BrandedButtonSpinner className="w-4 h-4" />
                    ) : (
                      <>
                        <span>Proceed with OTP</span>
                        <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-[10px] text-neutral-400 font-medium px-2 leading-normal">
                  By clicking dynamic OTP verification, you agree to zomindia's <span className="text-neutral-700 font-semibold underline cursor-pointer">Terms & Security Rules</span>.
                </p>
              </motion.div>
            )}

            {/* VIEW: Google Phone Setup (For missing mobile number in Google login) */}
            {view === 'google-phone-setup' && (
              <motion.div
                key="google-phone-setup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <button 
                    type="button"
                    onClick={() => setView('login-selection')}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-[#050CA6] uppercase tracking-wider hover:underline"
                  >
                    <ChevronLeft size={12} />
                    <span>Back</span>
                  </button>
                  <h2 className="text-lg font-bold text-neutral-900 mt-2">
                    Almost there! 🎉
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    Complete your details to finish setting up your account.
                  </p>
                </div>

                <form onSubmit={handleGooglePhoneRegister} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                      Full Name
                    </label>
                    <input 
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-neutral-50 border border-neutral-100 focus:border-[#050CA6] focus:bg-white px-4 py-3 rounded-xl outline-none transition-all font-semibold text-xs text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                      Email Address
                    </label>
                    <input 
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane@example.com"
                      className="w-full bg-neutral-50 border border-neutral-100 focus:border-[#050CA6] focus:bg-white px-4 py-3 rounded-xl outline-none transition-all font-semibold text-xs text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                      Mobile Number
                    </label>
                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2 pr-3 border-r border-neutral-100">
                        <img src="https://flagcdn.com/w20/in.png" alt="India flag" className="w-4 rounded-sm" />
                        <span className="text-xs font-bold text-neutral-800">+91</span>
                      </div>
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
                        className="w-full bg-neutral-50 border border-neutral-100 focus:border-[#050CA6] focus:bg-white pl-[84px] pr-4 py-3.5 rounded-2xl outline-none transition-all font-semibold text-sm tracking-widest text-neutral-900"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between text-left">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Welcome Onboard Credit</p>
                      <p className="text-xs text-neutral-500 font-medium">₹100 will be instantly added to your zomindia Wallet!</p>
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
                    disabled={loading || phoneNumber.length < 10 || !displayName.trim()}
                    className="w-full bg-[#050CA6] text-white p-3.5 rounded-2xl font-bold hover:bg-[#040980] transition-all text-sm shadow-md"
                  >
                    {loading ? (
                      <BrandedButtonSpinner className="w-4 h-4 mx-auto" />
                    ) : (
                      "Complete Setup & Enter"
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* VIEW 2: OTP Entry state (Clean verification blocks) */}
            {view === 'otp-entry' && (
              <motion.div
                key="otp-entry"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <button 
                    type="button"
                    onClick={() => setView('phone-entry')}
                    className="inline-flex items-center gap-1 text-[10px] font-bold text-[#050CA6] uppercase tracking-wider hover:underline"
                  >
                    <ChevronLeft size={12} />
                    <span>Change phone</span>
                  </button>
                  <h2 className="text-lg font-bold text-neutral-900 mt-2">
                    Enter Verification Code
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    We sent a 6-digit verification code to <span className="font-bold text-neutral-800">+91 {phoneNumber}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  {/* Digital glowing code squares: aligned specifically for responsive mobile screen widths */}
                  <div className="flex justify-between gap-1.5 sm:gap-2 p-1.5 bg-slate-50/50 rounded-2xl border border-slate-100/80 shadow-inner" onPaste={handleOtpPaste}>
                    {otpValues.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => { otpInputRefs.current[idx] = el; }}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={1}
                        required
                        value={digit}
                        onChange={(e) => handleOtpInput(idx, e.target.value)}
                        onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                        className="flex-1 h-12 sm:h-14 min-w-0 max-w-[42px] sm:max-w-[48px] bg-white border border-slate-300 text-slate-900 text-center text-lg sm:text-xl font-bold rounded-xl shadow-md focus:border-[#050CA6] focus:ring-4 focus:ring-[#050CA6]/10 focus:shadow-lg focus:shadow-blue-700/5 outline-none transition-all duration-200"
                      />
                    ))}
                  </div>



                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <div className="space-y-4">
                    <button
                      type="submit"
                      disabled={loading || otpValues.join('').length < 6}
                      className="w-full bg-[#050CA6] text-white p-3.5 rounded-2xl font-bold hover:bg-[#040980] transition-all text-sm shadow-md"
                    >
                      {loading ? (
                        <BrandedButtonSpinner className="w-4 h-4 mx-auto" />
                      ) : (
                        "Verify & Proceed"
                      )}
                    </button>

                    <div className="text-center">
                      <button
                        type="button"
                        disabled={timer > 0 || loading}
                        onClick={handleResendOTP}
                        className={`text-xs font-extrabold uppercase tracking-wider transition-colors ${
                          timer > 0 ? 'text-neutral-300' : 'text-[#050CA6] hover:text-[#040980]'
                        }`}
                      >
                        {timer > 0 ? `Resend Code in ${timer}s` : 'Resend One-Time Code'}
                      </button>
                    </div>
                  </div>
                </form>
              </motion.div>
            )}

            {/* VIEW 3: Create Profile Step (Shown ONLY if it is a brand-new user) */}
            {view === 'profile-setup' && (
              <motion.div
                key="profile-setup"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div>
                  <h2 className="text-lg font-bold text-neutral-900">
                    Welcome to zomindia! 🎉
                  </h2>
                  <p className="text-xs text-neutral-500 mt-1">
                    Help us customize your dashboard. Enter your details below.
                  </p>
                </div>

                <form onSubmit={handleRegisterProfile} className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                      Full Name
                    </label>
                    <input 
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Jane Doe"
                      className="w-full bg-neutral-50 border border-neutral-100 focus:border-[#050CA6] focus:bg-white px-4 py-3 rounded-xl outline-none transition-all font-semibold text-xs text-neutral-900"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2 ml-1">
                      Email Address
                    </label>
                    <input 
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="jane.doe@example.com"
                      className="w-full bg-neutral-50 border border-neutral-100 focus:border-[#050CA6] focus:bg-white px-4 py-3 rounded-xl outline-none transition-all font-semibold text-xs text-neutral-900"
                    />
                    <p className="mt-1 text-[8px] text-neutral-400">For home booking invoices and dynamic checkouts.</p>
                  </div>

                  <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between text-left">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Welcome Onboard Credit</p>
                      <p className="text-xs text-neutral-500 font-medium">₹100 will be instantly added to your zomindia Wallet!</p>
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>{error}</span>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading || !displayName.trim()}
                    className="w-full bg-[#050CA6] text-white p-3.5 rounded-2xl font-bold hover:bg-[#040980] transition-all text-sm shadow-md"
                  >
                    {loading ? (
                      <BrandedButtonSpinner className="w-4 h-4 mx-auto" />
                    ) : (
                      "Create Profile & Explore"
                    )}
                  </button>
                </form>
              </motion.div>
            )}

            {/* VIEW 5: Success Transition State */}
            {view === 'success-transition' && (
              <motion.div
                key="success-transition"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="text-center py-8 space-y-6"
              >
                <div className="relative flex items-center justify-center mx-auto w-20 h-20">
                  <motion.div 
                    animate={{ scale: [1, 1.25, 1], opacity: [0.1, 0.25, 0.1] }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                    className="absolute inset-0 bg-[#050CA6]/20 rounded-full"
                  />
                  <motion.div 
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="relative bg-[#050CA6] text-white w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg"
                  >
                    <CheckCircle2 size={26} />
                  </motion.div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight">Authorized Seamlessly</h3>
                  <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest">
                    Synchronizing your wallet & bookings...
                  </p>
                </div>

                <div className="w-36 bg-neutral-50 h-1 rounded-full overflow-hidden mx-auto border border-neutral-100">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 1.2, ease: 'easeInOut' }}
                    className="h-full bg-gradient-to-r from-[#050CA6] to-indigo-500 rounded-full"
                  />
                </div>
              </motion.div>
            )}

          </AnimatePresence>
          <div id="recaptcha-anchor"></div>
        </div>
      </motion.div>
    </div>
  );
}
