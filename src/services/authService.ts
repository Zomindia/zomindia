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

/**
 * Resolves the Google redirect auth result when user returns from OAuth redirect.
 */
export async function getRedirectAuthResult(): Promise<UserCredential | null> {
  try {
    return await getRedirectResult(auth);
  } catch (error) {
    console.warn('[AuthService] getRedirectResult notice:', error);
    throw error;
  }
}

/**
 * Triggers Google Sign-In using popup window (standard desktop/web).
 * Automatically falls back to redirection in Android WebView / TWA / localhost wrappers.
 */
export async function signInWithGooglePopup(): Promise<UserCredential> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  const isAndroidWrapper =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
     window.location.protocol === 'capacitor:' ||
     Boolean((window as any).Capacitor?.isNativePlatform()) ||
     /Android/i.test(navigator.userAgent));

  if (isAndroidWrapper) {
    console.info('[AuthService] Running in Android WebView/TWA wrapper on localhost - using signInWithRedirect for Google Auth');
    await signInWithRedirect(auth, provider);
    return null as any;
  }

  try {
    return await signInWithPopup(auth, provider);
  } catch (err: any) {
    const errCode = (err?.code || err?.message || '').toString();
    if (
      errCode.includes('unauthorized-domain') ||
      errCode.includes('popup-blocked') ||
      errCode.includes('operation-not-supported')
    ) {
      console.warn('[AuthService] Popup failed, falling back to redirect:', err);
      await signInWithRedirect(auth, provider);
      return null as any;
    }
    throw err;
  }
}

/**
 * Triggers Google Sign-In using full-page redirect (mobile browsers / TWA).
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  await signInWithRedirect(auth, provider);
}

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
