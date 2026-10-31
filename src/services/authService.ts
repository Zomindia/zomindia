import { 
  signOut, 
  UserCredential,
  User
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc,
  deleteDoc,
  onSnapshot, 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile, UserRole } from '../types';
import { buildDualPersonaUserDoc } from '../lib/user-schema';

/**
 * Signs out the current authenticated user and performs a complete session teardown.
 */
export async function signOutUser(): Promise<void> {
  try {
    await signOut(auth);
  } finally {
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.removeItem('zomindia_partner_session');
      localStorage.removeItem('zomindia_current_mode');
      localStorage.removeItem('zomindia_last_active_tab');
      localStorage.removeItem('partner_session');
      localStorage.removeItem('zomindia_user_role');
      localStorage.setItem('zomindia_current_mode', 'customer');
      localStorage.setItem('zomindia_last_active_tab', 'home');
    }
  }
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
    return 'SMS limit reached for now. Please try again later.';
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

  // Strictly guard every access: userData?.role, userData?.customerData?.fullName, userData?.onboardingComplete. Never assume userData exists.
  // Default new user state: { role: 'customer', onboardingComplete: false, fullName: '' }
  const safeRole: 'customer' | 'partner' | 'admin' = isMasterAdmin ? 'admin' : (raw?.role || 'customer');
  const safeFullName = raw?.customerData?.fullName || raw?.fullName || (raw?.displayName && raw?.displayName !== 'Customer' && !raw?.displayName?.startsWith('Customer (') ? raw?.displayName : '') || '';
  const safeDisplayName = raw?.displayName || safeFullName || (phoneNumber ? `Customer (${phoneNumber.slice(-4)})` : 'Customer');
  const safeOnboardingComplete = raw ? (raw?.onboardingComplete === true) : false;

  const rawAddress = raw?.address || raw?.customerData?.address || '';
  const cleanAddress = rawAddress.toLowerCase().includes('lasuriamori') ? '' : rawAddress;
  const rawSavedAddresses = Array.isArray(raw?.savedAddresses)
    ? raw.savedAddresses.filter((a: any) => !String(a?.address || '').toLowerCase().includes('lasuriamori'))
    : [];

  const rawBal = raw?.walletBalance !== undefined ? Number(raw.walletBalance) : 101;
  const cleanWalletBalance = (isNaN(rawBal) || rawBal === 600) ? 101 : rawBal;

  const safeProfile = {
    ...raw,
    uid,
    phoneNumber,
    mobile: phoneNumber,
    email,
    displayName: safeDisplayName,
    fullName: safeFullName,
    role: safeRole,
    adminSubRole: isMasterAdmin ? 'head' : (raw?.adminSubRole || undefined),
    walletBalance: cleanWalletBalance,
    welcomeBonusClaimed: true,
    address: cleanAddress,
    houseNumber: raw?.houseNumber || raw?.customerData?.houseNumber || '',
    customerLocation: raw?.customerLocation || raw?.customerData?.customerLocation || undefined,
    savedAddresses: rawSavedAddresses,
    addresses: Array.isArray(raw?.addresses) ? raw.addresses : [],
    bookings: Array.isArray(raw?.bookings) ? raw.bookings : [],
    onboardingComplete: safeOnboardingComplete,
    photoURL: raw?.photoURL || fallbackUser?.photoURL || '',
    customerData: {
      fullName: raw?.customerData?.fullName || safeFullName,
      email: raw?.customerData?.email || email || '',
      phoneNumber: raw?.customerData?.phoneNumber || phoneNumber || '',
      mobile: raw?.customerData?.mobile || phoneNumber || '',
      walletBalance: cleanWalletBalance,
      welcomeBonusClaimed: true,
      address: cleanAddress,
      houseNumber: raw?.customerData?.houseNumber || raw?.houseNumber || '',
      customerLocation: raw?.customerData?.customerLocation || raw?.customerLocation || undefined,
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
export function isCorruptMockWalletTx(tx: any): boolean {
  const payId = String(tx?.paymentId || '').trim();
  const refId = String(tx?.referenceId || '').trim();
  const ordId = String(tx?.orderId || '').trim();
  const reason = String(tx?.reason || '').toLowerCase();
  const amt = Number(tx?.amount || 0);
  return (
    payId.startsWith('pay_sim_') ||
    payId.startsWith('pay_mock_') ||
    payId.startsWith('sim_pay_') ||
    refId.startsWith('pay_sim_') ||
    refId.startsWith('pay_mock_') ||
    refId.startsWith('sim_pay_') ||
    ordId.startsWith('order_mock_') ||
    reason.includes('mock') ||
    reason.includes('simulated') ||
    tx?.isMock === true ||
    (tx?.type === 'credit' && (amt === 500 || amt === 600) && !reason.includes('referral') && !reason.includes('refund'))
  );
}

export function resolveAndSubscribeProfile(
  user: User,
  onProfileUpdate: (profile: UserProfile) => void,
  onError?: (error: any) => void
): () => void {
  let isUnsubscribed = false;
  let unsubscribeSnapshot: (() => void) | null = null;
  let verifiedLedgerBalance: number | null = null;

  // Immediate in-memory fallback profile with default new user state
  const fallbackProfile = sanitizeUserProfile({
    uid: user.uid,
    phoneNumber: user.phoneNumber || '',
    mobile: user.phoneNumber || '',
    email: user.email || '',
    photoURL: user.photoURL || '',
    displayName: user.displayName || (user.phoneNumber ? `Customer (${user.phoneNumber.slice(-4)})` : 'Customer'),
    fullName: user.displayName || '',
    role: 'customer',
    walletBalance: 101,
    welcomeBonusClaimed: true,
    savedAddresses: [],
    addresses: [],
    bookings: [],
    onboardingComplete: false,
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

      const isMasterAdmin = user.email?.toLowerCase().trim() === 'sarthakwebtech@gmail.com' ||
                            existingData?.email?.toLowerCase().trim() === 'sarthakwebtech@gmail.com';

      let resolvedPayload: any = null;

      // 3. For brand new phone number (no document in Firestore yet):
      // Emit default new user state: { role: 'customer', onboardingComplete: false, fullName: '' }
      // Do NOT write dummy completed onboarding doc to Firestore before user submits Name & Email modal!
      if (!existingData) {
        const freshProfile = sanitizeUserProfile({
          uid: user.uid,
          email: user.email || '',
          phoneNumber: user.phoneNumber || '',
          mobile: user.phoneNumber || '',
          role: isMasterAdmin ? 'admin' : 'customer',
          fullName: '',
          displayName: user.displayName || (user.phoneNumber ? `Customer (${user.phoneNumber.slice(-4)})` : 'Customer'),
          onboardingComplete: false,
          walletBalance: 101,
          welcomeBonusClaimed: true,
          createdAt: Timestamp.now(),
        }, user);
        resolvedPayload = freshProfile;
        onProfileUpdate(freshProfile);
      } else {
        // Automatically sync wallet balance with authentic walletTransactions ledger
        try {
          const txSnap = await getDocs(query(collection(db, 'walletTransactions'), where('userId', '==', user.uid)));
          const allTxs = txSnap.docs.map(d => ({ id: d.id, ...(d.data() as Record<string, any>) }));
          const corruptTxs = allTxs.filter(tx => isCorruptMockWalletTx(tx));
          for (const badTx of corruptTxs) {
            deleteDoc(doc(db, 'walletTransactions', badTx.id)).catch(() => {});
          }

          const genuineTxs = allTxs.filter(
            (tx: any) =>
              !tx.paymentId?.startsWith('pay_sim_') &&
              !tx.paymentId?.startsWith('pay_mock_') &&
              !tx.isMock &&
              !isCorruptMockWalletTx(tx)
          );

          let verifiedBal = 101;
          if (genuineTxs.length > 0) {
            verifiedBal = Math.max(0, genuineTxs.reduce((acc, tx: any) => {
              if (tx.status && tx.status !== 'completed') return acc;
              const amt = Number(tx.amount) || 0;
              return tx.type === 'credit' ? acc + amt : acc - amt;
            }, 0));
          } else {
            // Ensure initial ₹101 welcome transaction exists in ledger
            const welcomeRef = doc(db, 'walletTransactions', `welcome_bonus_${user.uid}`);
            const welcomeSnap = await getDoc(welcomeRef);
            if (!welcomeSnap.exists()) {
              await setDoc(welcomeRef, {
                userId: user.uid,
                amount: 101,
                type: 'credit',
                reason: 'Zomindia ₹101 Welcome Reward',
                status: 'completed',
                createdAt: serverTimestamp()
              });
            }
          }

          verifiedLedgerBalance = verifiedBal;

          // If stored walletBalance in Firestore is out of sync with genuine ledger, correct it immediately
          if (existingData?.walletBalance !== verifiedBal || existingData?.customerData?.walletBalance !== verifiedBal) {
            await updateDoc(userDocRef, {
              walletBalance: verifiedBal,
              'customerData.walletBalance': verifiedBal,
              welcomeBonusClaimed: true
            }).catch(() => {});
            existingData.walletBalance = verifiedBal;
            if (existingData.customerData) {
              existingData.customerData.walletBalance = verifiedBal;
            }
          }
        } catch (syncErr) {
          console.warn('[authService] Ledger sync notice:', syncErr);
          if (existingData?.walletBalance === 600) {
            existingData.walletBalance = 101;
            if (existingData.customerData) {
              existingData.customerData.walletBalance = 101;
            }
            verifiedLedgerBalance = 101;
          }
        }

        // Also trigger backend ledger sanitizer non-blockingly
        if (typeof window !== 'undefined') {
          fetch('/api/wallet/sanitize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: user.uid })
          }).catch(() => {});
        }

        // 4. Existing document exists: sync fields safely
        const hasCompletedOnboarding = existingData?.onboardingComplete !== undefined
          ? Boolean(existingData.onboardingComplete)
          : Boolean(existingData?.fullName?.trim() || existingData?.customerData?.fullName?.trim());

        const resolvedBal = verifiedLedgerBalance !== null
          ? verifiedLedgerBalance
          : (existingData?.walletBalance !== undefined && existingData.walletBalance !== 600 ? existingData.walletBalance : 101);

        const payload: any = buildDualPersonaUserDoc({
          ...existingData,
          uid: user.uid,
          email: user.email || existingData?.email || '',
          phoneNumber: user.phoneNumber || existingData?.phoneNumber || existingData?.mobile || '',
          mobile: user.phoneNumber || existingData?.mobile || existingData?.phoneNumber || '',
          displayName: existingData?.displayName || user.displayName || 'Customer',
          fullName: existingData?.fullName || existingData?.customerData?.fullName || '',
          role: isMasterAdmin ? 'admin' : (existingData?.role || 'customer'),
          photoURL: user.photoURL || existingData?.photoURL || '',
          referralCode: existingData?.referralCode || `ZOM${user.uid.slice(0, 6).toUpperCase()}`,
          walletBalance: resolvedBal,
          welcomeBonusClaimed: true,
          onboardingComplete: hasCompletedOnboarding,
          updatedAt: Timestamp.now(),
        });

        if (isMasterAdmin) {
          payload.adminSubRole = 'head';
        }

        resolvedPayload = payload;
        onProfileUpdate(sanitizeUserProfile({ ...payload, uid: user.uid }, user));

        try {
          await setDoc(userDocRef, payload, { merge: true });
        } catch (writeErr: any) {
          console.warn('[resolveAndSubscribeProfile] Notice writing profile to user.uid:', writeErr?.message || writeErr);
        }
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
              // Guard against stale 600 snapshot before ledger update propagates
              const safeLiveWallet = (liveData.walletBalance === 600 && verifiedLedgerBalance !== null && verifiedLedgerBalance !== 600)
                ? verifiedLedgerBalance
                : (liveData.walletBalance === 600 && verifiedLedgerBalance === null ? 101 : liveData.walletBalance);
              const normalized = buildDualPersonaUserDoc({
                ...liveData,
                walletBalance: safeLiveWallet,
                customerData: liveData.customerData ? {
                  ...liveData.customerData,
                  walletBalance: safeLiveWallet
                } : undefined,
                uid: user.uid,
              });
              if (isMasterAdmin) {
                (normalized as any).role = 'admin';
                (normalized as any).adminSubRole = 'head';
              }
              onProfileUpdate(sanitizeUserProfile(normalized, user));
            } else {
              onProfileUpdate(sanitizeUserProfile(resolvedPayload || fallbackProfile, user));
            }
          },
          (snapshotErr: any) => {
            console.warn('[resolveAndSubscribeProfile] Snapshot listener notice/error:', snapshotErr?.message || snapshotErr);
            // DO NOT log out or reset currentUser! Fallback to authenticated profile:
            onProfileUpdate(sanitizeUserProfile(resolvedPayload || fallbackProfile, user));
            if (onError) onError(snapshotErr);
          }
        );
      } catch (subErr: any) {
        console.warn('[resolveAndSubscribeProfile] Snapshot subscription error:', subErr?.message || subErr);
        onProfileUpdate(sanitizeUserProfile(resolvedPayload || fallbackProfile, user));
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
