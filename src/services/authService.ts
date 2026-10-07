import { 
  getRedirectResult, 
  signInWithPopup, 
  signInWithRedirect, 
  signOut, 
  GoogleAuthProvider, 
  UserCredential,
  User
} from 'firebase/auth';
import { auth } from '../lib/firebase';

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
