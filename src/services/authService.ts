import { 
  getRedirectResult, 
  signInWithPopup, 
  signInWithRedirect, 
  signOut, 
  GoogleAuthProvider, 
  UserCredential,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { buildDualPersonaUserDoc } from '../lib/user-schema';

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Checks if the current client environment is Mobile or Standalone TWA / PWA.
 */
export function isMobileOrStandalone(): boolean {
  if (typeof window === 'undefined') return false;

  const isMobileUA = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const isStandalone = 
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as any).standalone === true ||
    document.referrer.includes('android-app://') ||
    window.location.protocol === 'capacitor:' ||
    Boolean((window as any).Capacitor?.isNativePlatform());

  return isMobileUA || isStandalone;
}

/**
 * Executes robust Google Sign-In:
 * - On Mobile or Standalone TWA/PWA: directly triggers signInWithRedirect(auth, googleProvider).
 * - On Desktop: attempts signInWithPopup(auth, googleProvider).
 *   If popup fails with blocked/unsupported/cancelled, automatically falls back to signInWithRedirect.
 * - Never fails silently: logs and rethrows with user-friendly error message.
 */
export async function loginWithGoogle(): Promise<UserCredential | null> {
  const isMobile = isMobileOrStandalone();

  // On Mobile / TWA: Directly trigger signInWithRedirect
  if (isMobile) {
    try {
      console.info('[AuthService] Mobile/TWA environment detected. Initiating signInWithRedirect...');
      await signInWithRedirect(auth, googleProvider);
      return null;
    } catch (error: any) {
      console.error('[AuthService] Mobile redirect sign-in error:', error);
      const friendlyMessage = getFriendlyAuthErrorMessage(error);
      const customErr = new Error(friendlyMessage);
      (customErr as any).code = error.code || 'auth/redirect-error';
      throw customErr;
    }
  }

  // On Desktop: Attempt signInWithPopup with automatic fallback to signInWithRedirect
  try {
    console.info('[AuthService] Desktop environment detected. Initiating signInWithPopup...');
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    const errCode = (error?.code || error?.message || '').toString();
    console.warn('[AuthService] Popup sign-in notice/error:', errCode);

    // Fall back to redirect if popup is blocked, cancelled, or not supported in environment
    if (
      errCode.includes('auth/popup-blocked') ||
      errCode.includes('auth/cancelled-popup-request') ||
      errCode.includes('auth/operation-not-supported-in-this-environment') ||
      errCode.includes('operation-not-supported') ||
      errCode.includes('unauthorized-domain')
    ) {
      console.info('[AuthService] Falling back to signInWithRedirect due to popup environment restrictions...');
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectErr: any) {
        console.error('[AuthService] Fallback redirect sign-in error:', redirectErr);
        const friendlyMessage = getFriendlyAuthErrorMessage(redirectErr);
        const customErr = new Error(friendlyMessage);
        (customErr as any).code = redirectErr.code || 'auth/redirect-error';
        throw customErr;
      }
    }

    // Rethrow with user-friendly message
    const friendlyMessage = getFriendlyAuthErrorMessage(error);
    const customErr = new Error(friendlyMessage);
    (customErr as any).code = error.code || 'auth/popup-error';
    throw customErr;
  }
}

// Aliases for compatibility
export const signInWithGoogle = loginWithGoogle;
export const signInWithGooglePopup = loginWithGoogle;
export const signInWithGoogleRedirect = async (): Promise<void> => {
  await signInWithRedirect(auth, googleProvider);
};

/**
 * Handles and resolves Google redirect auth result upon return to app.
 */
export const handleRedirectAuthResult = async (): Promise<User | null> => {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      return result.user;
    }
    return null;
  } catch (error: any) {
    console.error('Redirect sign-in error:', error);
    throw error;
  }
};

/**
 * Resolves full UserCredential from redirect if present.
 */
export const getRedirectAuthResult = async (): Promise<UserCredential | null> => {
  try {
    return await getRedirectResult(auth);
  } catch (error: any) {
    console.warn('[AuthService] getRedirectResult notice:', error);
    throw error;
  }
};

/**
 * Signs out the current authenticated user.
 */
export async function signOutUser(): Promise<void> {
  await signOut(auth);
}

/**
 * Converts Firebase Auth error codes into human-friendly, scannable user messages.
 */
export function getFriendlyAuthErrorMessage(err: any): string {
  if (!err) return 'An unexpected error occurred. Please try again.';
  const code = (err.code || err.message || '').toString();

  if (code.includes('auth/invalid-phone-number')) {
    return 'Please enter a valid 10-digit mobile number.';
  }
  if (code.includes('auth/missing-phone-number')) {
    return 'Phone number is required.';
  }
  if (code.includes('auth/quota-exceeded')) {
    return 'SMS limit reached for now. Please try again later or sign in with Google.';
  }
  if (code.includes('auth/too-many-requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  if (code.includes('auth/invalid-verification-code')) {
    return 'Incorrect 6-digit OTP. Please double-check and try again.';
  }
  if (code.includes('auth/code-expired')) {
    return 'The OTP has expired. Please request a new verification code.';
  }
  if (code.includes('auth/captcha-check-failed')) {
    return 'Security verification (reCAPTCHA) failed. Please try again.';
  }
  if (code.includes('auth/popup-closed-by-user')) {
    return 'Sign-in cancelled. The popup was closed before completion.';
  }
  if (code.includes('auth/popup-blocked')) {
    return 'Sign-in popup was blocked by your browser. Please allow popups or try again.';
  }
  if (code.includes('auth/cancelled-popup-request')) {
    return 'Another sign-in attempt is already in progress.';
  }
  if (code.includes('auth/network-request-failed')) {
    return 'Network connection error. Please verify your internet connection.';
  }
  if (code.includes('auth/user-disabled')) {
    return 'This account has been disabled. Please contact customer support.';
  }
  if (code.includes('auth/operation-not-allowed')) {
    return 'This sign-in method is currently not configured.';
  }
  if (code.includes('auth/invalid-credential')) {
    return 'Invalid credentials provided. Please try again.';
  }

  return err.message || 'Authentication failed. Please try again.';
}

/**
 * Bulletproof User Profile Sanitizer & Safe Defaults:
 * Guarantees that all array, number, and string fields have safe fallbacks to prevent
 * any runtime exceptions (e.g. .map(), .split(), .slice()) on mobile or web login.
 */
export function sanitizeUserProfile(raw: any, fallbackUser?: User | null): UserProfile {
  const uid = raw?.uid || fallbackUser?.uid || '';
  const email = (raw?.email || fallbackUser?.email || '').trim();
  const phoneNumber = (raw?.phoneNumber || raw?.mobile || fallbackUser?.phoneNumber || '').trim();
  const isMasterAdmin = email.toLowerCase() === 'sarthakwebtech@gmail.com';

  const safeProfile = {
    ...raw,
    uid,
    phoneNumber,
    mobile: phoneNumber,
    email,
    displayName: raw?.displayName || fallbackUser?.displayName || (phoneNumber ? `Customer (${phoneNumber.slice(-4)})` : 'Customer'),
    fullName: raw?.fullName || raw?.displayName || fallbackUser?.displayName || 'Customer',
    role: isMasterAdmin ? 'admin' : (raw?.role || 'customer'),
    adminSubRole: isMasterAdmin ? 'head' : (raw?.adminSubRole || undefined),
    walletBalance: Number(raw?.walletBalance) || 0,
    savedAddresses: Array.isArray(raw?.savedAddresses) ? raw.savedAddresses : [],
    addresses: Array.isArray(raw?.addresses) ? raw.addresses : [],
    bookings: Array.isArray(raw?.bookings) ? raw.bookings : [],
    onboardingComplete: raw?.onboardingComplete !== undefined ? raw.onboardingComplete : true,
    photoURL: raw?.photoURL || fallbackUser?.photoURL || '',
    customerData: {
      fullName: raw?.customerData?.fullName || raw?.displayName || fallbackUser?.displayName || 'Customer',
      email: raw?.customerData?.email || email || '',
      phoneNumber: raw?.customerData?.phoneNumber || phoneNumber || '',
      mobile: raw?.customerData?.mobile || phoneNumber || '',
      walletBalance: Number(raw?.customerData?.walletBalance) || Number(raw?.walletBalance) || 0,
      address: raw?.customerData?.address || '',
      gender: raw?.customerData?.gender || '',
      languagePreference: raw?.customerData?.languagePreference || 'English',
      houseType: raw?.customerData?.houseType || 'Apartment',
      bhkSize: raw?.customerData?.bhkSize || '2 BHK',
      preferredTimeSlot: raw?.customerData?.preferredTimeSlot || 'Anytime',
      secondaryPhone: raw?.customerData?.secondaryPhone || '',
      referralCode: raw?.customerData?.referralCode || (uid ? `ZOM${uid.slice(0, 6).toUpperCase()}` : '')
    }
  };

  return safeProfile as UserProfile;
}

/**
 * Resolves the authenticated user's Firestore profile and establishes a real-time listener.
 * 
 * CRITICAL PERMISSIONS & PERSISTENCE SAFETY:
 * - A user MUST ALWAYS strictly use their own authenticated UID document: doc(db, 'users', user.uid).
 * - If resolving by phone matches an older document under a different ID, DO NOT attempt to write or
 *   listen directly to that mismatched document (which triggers "Missing or insufficient permissions").
 *   Instead, safely copy/merge essential fields into `users/${user.uid}` with `uid = user.uid`.
 * - The snapshot listener and initial resolution are wrapped in robust defensive try/catch blocks.
 * - If Firestore throws a `permission-denied` or `insufficient permissions` error, we DO NOT log out or reset
 *   the user. Instead, we gracefully emit an in-memory authenticated profile so the user stays logged in and active.
 */
export function resolveAndSubscribeProfile(
  user: User,
  onProfileUpdate: (profile: UserProfile) => void,
  onError?: (error: any) => void
): () => void {
  let isUnsubscribed = false;
  let unsubscribeSnapshot: (() => void) | null = null;

  // Immediate in-memory fallback profile so UI is instantly authenticated
  const fallbackProfile = sanitizeUserProfile({
    uid: user.uid,
    phoneNumber: user.phoneNumber || '',
    mobile: user.phoneNumber || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
    displayName: user.displayName || (user.phoneNumber ? `Customer (${user.phoneNumber.slice(-4)})` : 'Customer'),
    fullName: user.displayName || 'Customer',
    walletBalance: 0,
    savedAddresses: [],
    addresses: [],
    bookings: [],
    onboardingComplete: true,
    createdAt: new Date().toISOString()
  }, user);

  // Initial call with fallback profile so UI doesn't flicker or show login button
  onProfileUpdate(fallbackProfile);

  const executeResolution = async () => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      let existingData: any = null;

      // 1. Try reading the user's primary document doc(db, 'users', user.uid)
      try {
        const primarySnap = await getDoc(userDocRef);
        if (primarySnap.exists()) {
          existingData = primarySnap.data();
        }
      } catch (err: any) {
        console.warn('[resolveAndSubscribeProfile] Notice reading primary user doc:', err?.message || err);
      }

      // 2. If primary doc does not exist yet, search if there is an older document by phone number or email to migrate from
      if (!existingData) {
        try {
          const targetPhone = user.phoneNumber || '';
          if (targetPhone) {
            const clean = targetPhone.replace(/\D/g, '');
            const last10 = clean.slice(-10);
            if (last10.length === 10) {
              const formats = [`+91${last10}`, last10];
              for (const fmt of formats) {
                const q1 = query(collection(db, 'users'), where('phoneNumber', '==', fmt));
                const snap1 = await getDocs(q1);
                if (!snap1.empty) {
                  existingData = snap1.docs[0].data();
                  console.info('[resolveAndSubscribeProfile] Found legacy document by phone, copying data into primary UID:', user.uid);
                  break;
                }
              }
            }
          }

          // If still not found and email exists, search by email
          if (!existingData && user.email) {
            const qEmail = query(collection(db, 'users'), where('email', '==', user.email.toLowerCase().trim()));
            const snapEmail = await getDocs(qEmail);
            if (!snapEmail.empty) {
              existingData = snapEmail.docs[0].data();
              console.info('[resolveAndSubscribeProfile] Found legacy document by email, copying data into primary UID:', user.uid);
            }
          }
        } catch (searchErr: any) {
          console.warn('[resolveAndSubscribeProfile] Notice during legacy profile lookup:', searchErr?.message || searchErr);
        }
      }

      // 3. Prepare merged payload strictly under doc(db, 'users', user.uid)
      const isMasterAdmin = user.email?.toLowerCase().trim() === 'sarthakwebtech@gmail.com' ||
                            existingData?.email?.toLowerCase().trim() === 'sarthakwebtech@gmail.com';

      const payload: any = buildDualPersonaUserDoc({
        ...(existingData || {}),
        uid: user.uid, // ALWAYS strictly authenticated user.uid!
        email: user.email || existingData?.email || '',
        phoneNumber: user.phoneNumber || existingData?.phoneNumber || existingData?.mobile || '',
        mobile: user.phoneNumber || existingData?.mobile || existingData?.phoneNumber || '',
        displayName: user.displayName && user.displayName !== 'User' 
          ? user.displayName 
          : (existingData?.displayName || 'Customer'),
        fullName: user.displayName && user.displayName !== 'User' 
          ? user.displayName 
          : (existingData?.fullName || 'Customer'),
        role: isMasterAdmin ? 'admin' : (existingData?.role || 'customer'),
        photoURL: user.photoURL || existingData?.photoURL || '',
        referralCode: existingData?.referralCode || `ZOM${user.uid.slice(0, 6).toUpperCase()}`,
        walletBalance: existingData?.walletBalance !== undefined ? existingData.walletBalance : 100,
        onboardingComplete: true,
        updatedAt: Timestamp.now(),
      });

      if (isMasterAdmin) {
        payload.adminSubRole = 'head';
      }

      // 4. Upsert strictly into doc(db, 'users', user.uid)
      try {
        await setDoc(userDocRef, payload, { merge: true });
      } catch (writeErr: any) {
        console.warn('[resolveAndSubscribeProfile] Notice writing profile to user.uid:', writeErr?.message || writeErr);
        // Even if write fails (e.g. offline or strict rule), use in-memory payload!
        onProfileUpdate(sanitizeUserProfile({ ...payload, uid: user.uid }, user));
      }

      if (isUnsubscribed) return;

      // 5. Establish real-time listener strictly on user's own document doc(db, 'users', user.uid)
      try {
        unsubscribeSnapshot = onSnapshot(
          userDocRef,
          (snap) => {
            if (isUnsubscribed) return;
            if (snap.exists()) {
              const liveData = snap.data() as UserProfile;
              const normalized = buildDualPersonaUserDoc({
                ...liveData,
                uid: user.uid,
              });
              if (isMasterAdmin) {
                (normalized as any).role = 'admin';
                (normalized as any).adminSubRole = 'head';
              }
              onProfileUpdate(sanitizeUserProfile(normalized, user));
            } else {
              onProfileUpdate(sanitizeUserProfile(payload, user));
            }
          },
          (snapshotErr: any) => {
            console.warn('[resolveAndSubscribeProfile] Snapshot listener notice/error:', snapshotErr?.message || snapshotErr);
            // DO NOT log out or reset currentUser! Fallback to authenticated profile:
            onProfileUpdate(sanitizeUserProfile(payload, user));
            if (onError) onError(snapshotErr);
          }
        );
      } catch (subErr: any) {
        console.warn('[resolveAndSubscribeProfile] Snapshot subscription error:', subErr?.message || subErr);
        onProfileUpdate(sanitizeUserProfile(payload, user));
        if (onError) onError(subErr);
      }
    } catch (fatalErr: any) {
      console.warn('[resolveAndSubscribeProfile] General resolution notice/error:', fatalErr?.message || fatalErr);
      // ALWAYS keep the user logged in with fallback profile!
      onProfileUpdate(sanitizeUserProfile(fallbackProfile, user));
      if (onError) onError(fatalErr);
    }
  };

  executeResolution();

  return () => {
    isUnsubscribed = true;
    if (unsubscribeSnapshot) {
      try {
        unsubscribeSnapshot();
      } catch (e) {}
    }
  };
}
