import React, { useState, useEffect, useRef } from 'react';
import { 
  signInWithPhoneNumber,
  signInWithRedirect,
  signInWithPopup,
  getRedirectResult,
  GoogleAuthProvider,
  ConfirmationResult,
  updateProfile,
} from 'firebase/auth';
import { getFriendlyAuthErrorMessage, loginWithGoogle } from '../services/authService';
import { auth, db } from '../lib/firebase';
import { clearRecaptchaInstance, getOrCreateRecaptchaVerifier } from '../lib/recaptcha';
import { doc, setDoc, Timestamp, getDoc, updateDoc, query, where, collection, getDocs, runTransaction, writeBatch } from 'firebase/firestore';
import { buildDualPersonaUserDoc } from '../lib/user-schema';
import { motion, AnimatePresence } from 'motion/react';
import { BrandedButtonSpinner } from './LoadingIndicator';
import { LogoIcon, LogoHorizontal } from './BrandLogo';
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
  initialView?: AuthView;
  initialData?: {
    uid?: string;
    displayName?: string;
    email?: string;
  };
}

// Support phone & Google-based sign-in for maximum conversion and security.
type AuthView = 
  | 'login-selection'
  | 'phone-entry'
  | 'otp-entry'
  | 'profile-setup'
  | 'google-phone-setup'
  | 'success-transition';

export default function AuthModal({ isOpen, onClose, onSuccess, initialView, initialData }: Props) {
  const [view, setView] = useState<AuthView>(initialView || 'login-selection');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // OTP states: single unified 6-digit string feeding native WebOTP & single input
  const [otpCode, setOtpCode] = useState('');
  const otpInputRef = useRef<HTMLInputElement | null>(null);
  
  // Registration data
  const [displayName, setDisplayName] = useState(initialData?.displayName || '');
  const [email, setEmail] = useState(initialData?.email || '');

  // Status & states
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [verifiedUid, setVerifiedUid] = useState<string | null>(initialData?.uid || null);
  const [walletJoiningBonus, setWalletJoiningBonus] = useState<number>(100);

  // Zomato-Style Onboarding verification and interactive conflict resolution state
  const [isOnboardingVerification, setIsOnboardingVerification] = useState(false);
  const [shouldMergeConflictOnSuccess, setShouldMergeConflictOnSuccess] = useState(false);
  const [conflictUid, setConflictUid] = useState<string | null>(null);
  const [showConflictOptions, setShowConflictOptions] = useState(false);

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

  // Clean form state upon open or close without clearing the initialized RecaptchaVerifier
  const resetForm = () => {
    setView(initialView || 'login-selection');
    setPhoneNumber('');
    setOtpCode('');
    setDisplayName(initialData?.displayName || '');
    setEmail(initialData?.email || '');
    setError(null);
    setConfirmationResult(null);
    setVerifiedUid(initialData?.uid || null);
    setIsOnboardingVerification(false);
    setShouldMergeConflictOnSuccess(false);
    setConflictUid(null);
    setShowConflictOptions(false);
  };

  useEffect(() => {
    if (isOpen) {
      resetForm();
    } else {
      clearRecaptchaInstance();
    }
  }, [isOpen, initialView, initialData]);

  // Defensive cleanup on unmount
  useEffect(() => {
    return () => {
      clearRecaptchaInstance();
    };
  }, []);

  // Check for any pending Google redirect results upon returning to the app
  useEffect(() => {
    let isSubscribed = true;
    const inspectRedirect = async () => {
      try {
        const userCredential = await getRedirectResult(auth);
        if (!isSubscribed || !userCredential || !userCredential.user) return;
        const u = userCredential.user;
        setVerifiedUid(u.uid);
        setDisplayName(u.displayName || '');
        setEmail(u.email || '');

        const pDoc = await getDoc(doc(db, 'users', u.uid));
        const hasStoredPhone = pDoc.exists() && pDoc.data()?.phoneNumber && pDoc.data()?.phoneNumber.toString().trim().length >= 10;

        if (!hasStoredPhone) {
          setView('google-phone-setup');
        } else {
          setView('success-transition');
          setTimeout(() => {
            if (isSubscribed) {
              onSuccess();
              onClose();
              resetForm();
            }
          }, 1200);
        }
      } catch (err: any) {
        console.warn('[AuthModal] Google redirect result notice:', err);
      }
    };

    inspectRedirect();

    return () => {
      isSubscribed = false;
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

    try {
      let verifier = getOrCreateRecaptchaVerifier(auth, 'recaptcha-container');
      let result;
      try {
        result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      } catch (phoneErr: any) {
        const errMsg = phoneErr?.message || '';
        if (errMsg.includes('already been rendered') || errMsg.includes('already-rendered')) {
          console.warn('[AuthModal] reCAPTCHA already rendered, clearing and retrying once...');
          clearRecaptchaInstance('recaptcha-container');
          verifier = getOrCreateRecaptchaVerifier(auth, 'recaptcha-container');
          result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
        } else {
          throw phoneErr;
        }
      }
      setConfirmationResult(result);
      setView('otp-entry');
      setTimer(30);
    } catch (err: any) {
      console.error("[AuthModal] Phone Auth SMS dispatch failed:", err);
      clearRecaptchaInstance('recaptcha-container');
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
    clearRecaptchaInstance('recaptcha-container');
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const formattedPhone = `+91${cleanPhone}`;

    try {
      let verifier = getOrCreateRecaptchaVerifier(auth, 'recaptcha-container');
      let result;
      try {
        result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      } catch (phoneErr: any) {
        const errMsg = phoneErr?.message || '';
        if (errMsg.includes('already been rendered') || errMsg.includes('already-rendered')) {
          console.warn('[AuthModal] reCAPTCHA already rendered on resend, clearing and retrying...');
          clearRecaptchaInstance('recaptcha-container');
          verifier = getOrCreateRecaptchaVerifier(auth, 'recaptcha-container');
          result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
        } else {
          throw phoneErr;
        }
      }
      setConfirmationResult(result);
      setTimer(30);
    } catch (err: any) {
      console.error("[AuthModal] Resend OTP failed:", err);
      clearRecaptchaInstance('recaptcha-container');
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

      if (isOnboardingVerification) {
        const activeUid = userObj.uid;
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const formattedPhone = `+91${cleanPhone}`;
        const isSarthakEmail = email.toLowerCase().trim() === 'sarthakwebtech@gmail.com';

        // Safe transactional pre-write merge/link
        await runTransaction(db, async (transaction) => {
          const activeUserRef = doc(db, 'users', activeUid);
          const activeUserSnap = await transaction.get(activeUserRef);

          let walletVal = walletJoiningBonus;
          let existingData: any = {};

          if (activeUserSnap.exists()) {
            existingData = activeUserSnap.data();
            if (existingData.walletBalance !== undefined) {
              walletVal = existingData.walletBalance;
            }
          }

          if (shouldMergeConflictOnSuccess && conflictUid) {
            try {
              const conflictRef = doc(db, 'users', conflictUid);
              const conflictSnap = await transaction.get(conflictRef);
              if (conflictSnap.exists()) {
                const conflictData = conflictSnap.data();
                if (conflictData.walletBalance !== undefined) {
                  walletVal += conflictData.walletBalance;
                }
                existingData = {
                  ...conflictData,
                  ...existingData,
                };
              }
            } catch (err) {
              console.warn("Notice reading conflict doc:", err);
            }
          }

          const profilePayload = buildDualPersonaUserDoc({
            ...existingData,
            uid: activeUid, // ALWAYS strictly authenticated activeUid!
            displayName: displayName.trim(),
            fullName: displayName.trim(),
            email: email.trim(),
            phoneNumber: formattedPhone,
            mobile: formattedPhone,
            onboardingComplete: true,
            walletBalance: walletVal,
            updatedAt: Timestamp.now()
          });

          if (isSarthakEmail) {
            profilePayload.role = 'admin';
            profilePayload.adminSubRole = 'head';
          } else if (!profilePayload.role) {
            profilePayload.role = 'customer';
          }

          transaction.set(activeUserRef, profilePayload, { merge: true });
        });

        // Move any bookings/history in Firestore if needed (though resolvedUid ensures they access their bookings seamlessly)
        if (shouldMergeConflictOnSuccess && conflictUid) {
          try {
            const bookingsQ1 = query(collection(db, 'bookings'), where('userId', '==', activeUid));
            const bookingsQ2 = query(collection(db, 'bookings'), where('customerId', '==', activeUid));
            const [bSnap1, bSnap2] = await Promise.all([getDocs(bookingsQ1), getDocs(bookingsQ2)]);

            const batch = writeBatch(db);
            bSnap1.docs.forEach((d) => {
              batch.update(doc(db, 'bookings', d.id), { userId: conflictUid });
            });
            bSnap2.docs.forEach((d) => {
              batch.update(doc(db, 'bookings', d.id), { customerId: conflictUid });
            });
            await batch.commit();
          } catch (migrateErr) {
            console.error("Non-blocking bookings migration error:", migrateErr);
          }
        }

        setView('success-transition');
        setTimeout(() => {
          onSuccess();
          onClose();
          resetForm();
        }, 1500);
      } else {
        // Check Firestore for user profile
        const cleanPhone = phoneNumber.replace(/\D/g, '');
        const formattedPhone = `+91${cleanPhone}`;
        let profileSnap = await getDoc(doc(db, 'users', userObj.uid));
        if (!profileSnap.exists()) {
          const phoneQ = query(collection(db, 'users'), where('phoneNumber', '==', formattedPhone));
          const pSnap = await getDocs(phoneQ);
          if (!pSnap.empty) {
            profileSnap = pSnap.docs[0];
          }
        }

        if (profileSnap && profileSnap.exists()) {
          setView('success-transition');
          setTimeout(() => {
            onSuccess();
            onClose();
            resetForm();
          }, 1500);
        } else {
          setView('profile-setup');
        }
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
      
      // Enforce unique dual-field tracking (Email + Mobile) and prevent cross-account data conflicts
      const emailLower = email.trim().toLowerCase();
      const phoneDigits = targetPhone.replace(/\D/g, '');

      if (phoneDigits) {
        const checkPhoneQ1 = query(collection(db, 'users'), where('phoneNumber', '==', `+91${phoneDigits}`));
        const checkPhoneQ2 = query(collection(db, 'users'), where('mobile', '==', `+91${phoneDigits}`));
        const checkPhoneQ3 = query(collection(db, 'users'), where('phoneNumber', '==', phoneDigits));
        const checkPhoneQ4 = query(collection(db, 'users'), where('mobile', '==', phoneDigits));

        const [pSnap1, pSnap2, pSnap3, pSnap4] = await Promise.all([
          getDocs(checkPhoneQ1),
          getDocs(checkPhoneQ2),
          getDocs(checkPhoneQ3),
          getDocs(checkPhoneQ4)
        ]);

        const mergedPhoneDocs = [...pSnap1.docs, ...pSnap2.docs, ...pSnap3.docs, ...pSnap4.docs];
        for (const docSnap of mergedPhoneDocs) {
          if (docSnap.id !== activeUid) {
            const docEmail = (docSnap.data().email || '').trim().toLowerCase();
            if (docEmail && docEmail !== emailLower) {
              throw new Error("This mobile number is already linked to another email.");
            }
          }
        }
      }

      if (emailLower) {
        const checkEmailQ1 = query(collection(db, 'users'), where('email', '==', email.trim()));
        const checkEmailQ2 = query(collection(db, 'users'), where('email', '==', emailLower));

        const [eSnap1, eSnap2] = await Promise.all([
          getDocs(checkEmailQ1),
          getDocs(checkEmailQ2)
        ]);

        const mergedEmailDocs = [...eSnap1.docs, ...eSnap2.docs];
        for (const docSnap of mergedEmailDocs) {
          if (docSnap.id !== activeUid) {
            const data = docSnap.data();
            const docPhone = (data.phoneNumber || data.mobile || '').replace(/\D/g, '');
            if (docPhone && docPhone !== phoneDigits) {
              throw new Error("This email is already associated with another mobile number.");
            }
          }
        }
      }

      let existingUserDoc: any = null;

      if (targetPhone) {
        const q1 = query(collection(db, 'users'), where('phoneNumber', '==', targetPhone));
        const q2 = query(collection(db, 'users'), where('mobile', '==', targetPhone));
        const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
        if (!snap1.empty) existingUserDoc = snap1.docs[0];
        else if (!snap2.empty) existingUserDoc = snap2.docs[0];
      }

      if (existingUserDoc) {
        // Enforce strict merge session cleanly into the authenticated user record
        const existingData = existingUserDoc.data();
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
        }

        await setDoc(userRef, mergedPayload, { merge: true });
      } else if (userSnap.exists()) {
        const existingData = userSnap.data();
        // Safe partial update of only user-controllable fields
        const updatePayload: any = {
          displayName: displayName.trim(),
          fullName: displayName.trim(),
          email: email.trim(),
          phoneNumber: formattedPhone || existingData?.phoneNumber || '',
          mobile: formattedPhone || existingData?.mobile || existingData?.phoneNumber || '',
          onboardingComplete: true,
          updatedAt: Timestamp.now(),
          isPartner: false
        };
        if (existingData?.walletBalance === undefined) {
          updatePayload.walletBalance = walletJoiningBonus;
        }
        // Omit role updates for normal clients to prevent any potential privilege-escalation/rule failures
        if (isSarthakEmail) {
          updatePayload.role = 'admin';
          updatePayload.adminSubRole = 'head';
        }
        await updateDoc(userRef, updatePayload);
      } else {
        // Fallback document creation if auto-creation in App.tsx hasn't completed yet
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
          referralCode: `ZOM${activeUid.slice(-6).toUpperCase()}`,
          walletBalance: walletJoiningBonus, // Dynamic Onboarding welcome credit!
          onboardingComplete: true,
          savedAddresses: [],
          addresses: [],
          bookings: [],
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

  // Robust Google Sign In using centralized loginWithGoogle helper
  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const userCredential = await loginWithGoogle();
      if (userCredential && userCredential.user) {
        const u = userCredential.user;
        setVerifiedUid(u.uid);
        setDisplayName(u.displayName || '');
        setEmail(u.email || '');

        const pDoc = await getDoc(doc(db, 'users', u.uid));
        const hasStoredPhone = pDoc.exists() && pDoc.data()?.phoneNumber && pDoc.data()?.phoneNumber.toString().trim().length >= 10;

        if (!hasStoredPhone) {
          setView('google-phone-setup');
        } else {
          setView('success-transition');
          setTimeout(() => {
            onSuccess();
            onClose();
            resetForm();
          }, 1200);
        }
      }
      // If userCredential is null, signInWithRedirect was initiated on mobile / standalone TWA
    } catch (err: any) {
      console.error("Google authentication error:", err);
      setError(getFriendlyAuthErrorMessage(err));
      setLoading(false);
    }
  };

  // Helper to send onboarding OTP safely using Firebase Phone Auth ReCAPTCHA
  const sendOnboardingOTP = async (formattedPhone: string) => {
    try {
      let verifier = getOrCreateRecaptchaVerifier(auth, 'recaptcha-container');
      let result;
      try {
        result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      } catch (phoneErr: any) {
        const errMsg = phoneErr?.message || '';
        if (errMsg.includes('already been rendered') || errMsg.includes('already-rendered')) {
          console.warn('[AuthModal] reCAPTCHA already rendered on onboarding OTP, resetting...');
          clearRecaptchaInstance('recaptcha-container');
          verifier = getOrCreateRecaptchaVerifier(auth, 'recaptcha-container');
          result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
        } else {
          throw phoneErr;
        }
      }
      setConfirmationResult(result);
      setIsOnboardingVerification(true);
      setView('otp-entry');
      setTimer(30);
    } catch (err: any) {
      console.error("[AuthModal] Onboarding OTP failed:", err);
      clearRecaptchaInstance('recaptcha-container');
      setError(getFriendlyAuthErrorMessage(err));
    }
  };

  // Setup mobile number for Google Signed-In Users: directly save profile in Firestore without requiring a second phone OTP
  const handleGooglePhoneRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Full Name is required');
      return;
    }
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    if (cleanPhone.length !== 10) {
      setError('Please enter a valid 10-digit mobile number');
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
      const formattedPhone = `+91${cleanPhone}`;
      const userEmail = (email || auth.currentUser?.email || '').trim();
      const isSarthakEmail = userEmail.toLowerCase() === 'sarthakwebtech@gmail.com';
      const userRef = doc(db, 'users', activeUid);
      const userSnap = await getDoc(userRef);

      const existingData = userSnap.exists() ? userSnap.data() : null;

      // Ensure user gets the welcome credit (₹100) or retains existing balance
      const walletBalance = existingData?.walletBalance !== undefined 
        ? existingData.walletBalance 
        : walletJoiningBonus;

      const profilePayload: any = {
        uid: activeUid,
        displayName: displayName.trim(),
        fullName: displayName.trim(),
        email: userEmail,
        phoneNumber: formattedPhone,
        mobile: formattedPhone,
        walletBalance: walletBalance,
        onboardingComplete: true,
        savedAddresses: Array.isArray(existingData?.savedAddresses) ? existingData.savedAddresses : [],
        addresses: Array.isArray(existingData?.addresses) ? existingData.addresses : [],
        bookings: Array.isArray(existingData?.bookings) ? existingData.bookings : [],
        isPartner: existingData?.isPartner ?? false,
        updatedAt: Timestamp.now()
      };

      if (!existingData) {
        profilePayload.role = isSarthakEmail ? 'admin' : 'customer';
        profilePayload.createdAt = Timestamp.now();
        profilePayload.referralCode = `ZOM${activeUid.slice(-6).toUpperCase()}`;
        profilePayload.notificationPreferences = {
          bookingUpdates: true,
          promotionalMessages: true
        };
      }

      if (isSarthakEmail) {
        profilePayload.role = 'admin';
        profilePayload.adminSubRole = 'head';
      }

      // Directly save/merge user profile in Firestore
      await setDoc(userRef, profilePayload, { merge: true });

      // Update Firebase Auth profile display name if available
      if (auth.currentUser) {
        try {
          await updateProfile(auth.currentUser, { displayName: displayName.trim() });
        } catch (profileErr) {
          console.warn('[AuthModal] Could not update auth display name:', profileErr);
        }
      }

      // Immediately call onSuccess and close modal so user seamlessly lands on dashboard with ₹100 credit
      onSuccess();
      onClose();
      resetForm();
    } catch (err: any) {
      console.error("[AuthModal] Failed to save Google user profile:", err);
      setError(err?.message || 'Failed to save profile. Please check your connection and try again.');
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
        className="relative w-full max-w-[400px] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* Dynamic Header */}
        {view !== 'success-transition' && (
          <div className="px-6 pt-6 pb-2 flex justify-between items-center bg-white border-b border-neutral-50/50">
            <div className="flex items-center select-none">
              <img 
                src={LogoHorizontal} 
                alt="Zomindia brand" 
                className="h-5 w-auto object-contain object-left"
                referrerPolicy="no-referrer"
              />
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
                  <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center mx-auto shadow-md border border-amber-100/50 p-0.5">
                    <img 
                      src={LogoIcon} 
                      alt="zomindia" 
                      className="w-full h-full object-contain rounded-full"
                      referrerPolicy="no-referrer"
                    />
                  </div>
                  <h2 className="text-xl font-black tracking-tight text-neutral-900 mt-2">
                    Welcome to zomindia
                  </h2>
                  <p className="text-xs text-neutral-500 max-w-[270px] mx-auto leading-relaxed">
                    Indore's trusted app for clean, hassle-free home services.
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
                  <span>Secure SSL connection</span>
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
                    We'll send you an OTP to verify your number safely.
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
                    className="w-full bg-[#050CA6] text-white p-3.5 rounded-2xl font-bold hover:bg-[#040980] transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2 text-sm shadow-[0_12px_24px_-4px_rgba(5,12,166,0.15)] cursor-pointer"
                  >
                    {loading ? (
                      <BrandedButtonSpinner className="w-4 h-4" />
                    ) : (
                      <>
                        <span>Send OTP</span>
                        <ArrowRight size={16} />
                      </>
                    )}
                  </button>
                </form>

                <p className="text-center text-[10px] text-neutral-400 font-medium px-2 leading-normal">
                  By continuing, you agree to zomindia's <span className="text-neutral-700 font-semibold underline cursor-pointer">Terms & Privacy Policy</span>.
                </p>
              </motion.div>
            )}            {/* VIEW: Google Phone Setup (For missing mobile number in Google login) */}
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
                      Just a quick step to set up your profile.
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
                        <p className="text-xs text-neutral-500 font-medium">Get ₹{walletJoiningBonus} welcome bonus in your Zomindia wallet!</p>
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
                        "Get Started"
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
                  <h2 className="text-lg font-bold text-neutral-900 mt-2 flex items-center gap-2">
                    <span>Enter Verification Code</span>
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    We've sent a 6-digit OTP via SMS to <span className="font-bold text-neutral-800">+91 {phoneNumber}</span>
                  </p>
                </div>

                <form onSubmit={handleVerifyOTP} className="space-y-6">
                  {/* Single Unified 6-Digit OTP Input with Visual Box Presentation */}
                  <div className="relative w-full">
                    {/* Underlying single native input for Chrome/Android/iOS WebOTP, auto-fill, and SMS paste bar */}
                    <input
                      ref={otpInputRef}
                      type="tel"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]*"
                      maxLength={6}
                      autoFocus
                      required
                      value={otpCode}
                      onChange={(e) => handleOtpChange(e.target.value)}
                      className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-pointer caret-transparent"
                    />

                    {/* Visual 6-box representation synced directly with single unified state */}
                    <div className="flex justify-between gap-1.5 sm:gap-2 p-1.5 bg-slate-50/50 rounded-2xl border border-slate-100/80 shadow-inner select-none pointer-events-none">
                      {Array.from({ length: 6 }).map((_, idx) => {
                        const digit = otpCode[idx] || '';
                        const isCurrentActive = otpCode.length === idx || (idx === 5 && otpCode.length === 6);

                        return (
                          <div
                            key={idx}
                            className={`flex-1 h-12 sm:h-14 min-w-0 max-w-[42px] sm:max-w-[48px] bg-white border text-center text-lg sm:text-xl font-bold rounded-xl shadow-md flex items-center justify-center transition-all duration-150 ${
                              isCurrentActive
                                ? 'border-[#050CA6] ring-4 ring-[#050CA6]/10 shadow-blue-700/5 text-[#050CA6]'
                                : digit
                                ? 'border-slate-400 text-slate-900'
                                : 'border-slate-200 text-slate-400'
                            }`}
                          >
                            {digit ? (
                              <span>{digit}</span>
                            ) : (
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-200" />
                            )}
                          </div>
                        );
                      })}
                    </div>
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
                      disabled={loading || otpCode.length < 6}
                      className="w-full bg-[#050CA6] text-white p-3.5 rounded-2xl font-bold hover:bg-[#040980] transition-all text-sm shadow-md cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <BrandedButtonSpinner className="w-4 h-4 mx-auto" />
                      ) : (
                        "Verify OTP"
                      )}
                    </button>

                    <div className="text-center">
                      <button
                        type="button"
                        disabled={timer > 0 || loading}
                        onClick={handleResendOTP}
                        className={`text-xs font-extrabold uppercase tracking-wider transition-colors ${
                          timer > 0 ? 'text-neutral-300' : 'text-[#050CA6] hover:text-[#040980] cursor-pointer'
                        }`}
                      >
                        {timer > 0 ? `Resend code in ${timer}s` : 'Send OTP again'}
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
                    Just a quick step to set up your profile.
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
                    <p className="mt-1 text-[8px] text-neutral-400">We will send your booking invoices here.</p>
                  </div>

                  <div className="p-3.5 bg-emerald-50/50 rounded-2xl border border-emerald-100 flex items-center justify-between text-left">
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider">Welcome Onboard Credit</p>
                      <p className="text-xs text-neutral-500 font-medium">Get ₹{walletJoiningBonus} welcome bonus in your Zomindia wallet!</p>
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
                      "Create Profile"
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
                  <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight">You're Logged In!</h3>
                  <p className="text-[10px] text-neutral-400 font-extrabold uppercase tracking-widest">
                    Loading your profile and wallet...
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
        </div>
      </motion.div>
    </div>
  );
}
