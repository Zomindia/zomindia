/**
 * Unified Authentication Service
 * 
 * Provides a clean, consolidated interface for:
 * 1. Google Sign-In via signInWithRedirect & getRedirectResult
 * 2. Phone OTP via signInWithPhoneNumber & RecaptchaVerifier with dedicated persistent container
 * 3. Standardized error resolution and cleanup
 */

import {
  signInWithRedirect,
  getRedirectResult,
  signInWithPhoneNumber,
  GoogleAuthProvider,
  UserCredential,
  ConfirmationResult,
  RecaptchaVerifier,
} from 'firebase/auth';
import { auth } from '../lib/firebase';

const RECAPTCHA_CONTAINER_ID = 'recaptcha-container';

declare global {
  interface Window {
    recaptchaVerifier?: RecaptchaVerifier | null;
  }
}

/**
 * Creates and configures the GoogleAuthProvider with account selection.
 */
export function createGoogleAuthProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
}

/**
 * Initiates Google Sign-In using signInWithRedirect.
 */
export async function signInWithGoogleRedirect(): Promise<void> {
  const provider = createGoogleAuthProvider();
  console.info('[AuthService] Initiating Google Sign-In via signInWithRedirect...');
  await signInWithRedirect(auth, provider);
}

// Backward-compatible alias for existing components
export const initiateGoogleSignIn = signInWithGoogleRedirect;

/**
 * Retrieves the Google Sign-In redirect result cleanly upon return to the app.
 */
export async function getRedirectAuthResult(): Promise<UserCredential | null> {
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      console.info('[AuthService] Google Sign-In redirect resolved user:', result.user.uid);
    }
    return result;
  } catch (error: any) {
    console.warn('[AuthService] getRedirectResult error:', error);
    return null;
  }
}

/**
 * Cleanly destroys any existing reCAPTCHA verifier instance to prevent
 * duplicate widget errors ("reCAPTCHA has already been rendered in this element").
 */
export function cleanupRecaptchaVerifier(): void {
  if (typeof window === 'undefined') return;

  if (window.recaptchaVerifier) {
    try {
      window.recaptchaVerifier.clear();
    } catch (e) {
      console.warn('[AuthService] Error clearing recaptchaVerifier:', e);
    }
    window.recaptchaVerifier = null;
  }

  // Clear any leftover child nodes inside the container
  const container = document.getElementById(RECAPTCHA_CONTAINER_ID);
  if (container) {
    container.innerHTML = '';
  }
}

/**
 * Ensures the persistent reCAPTCHA DOM container exists.
 */
export function ensureRecaptchaContainer(): HTMLElement {
  let container = document.getElementById(RECAPTCHA_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = RECAPTCHA_CONTAINER_ID;
    document.body.appendChild(container);
  }
  return container;
}

/**
 * Standardizes RecaptchaVerifier creation with the dedicated persistent container.
 * Cleans up any existing verifier instance before re-initializing to avoid duplicate widget errors.
 */
export async function getOrCreateRecaptchaVerifier(): Promise<RecaptchaVerifier> {
  if (typeof window === 'undefined') {
    throw new Error('reCAPTCHA cannot be initialized outside the browser environment.');
  }

  ensureRecaptchaContainer();

  // If a valid verifier already exists, return it
  if (window.recaptchaVerifier) {
    return window.recaptchaVerifier;
  }

  try {
    const verifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {
      size: 'invisible',
      callback: () => {
        // Invisible reCAPTCHA verification solved
      },
      'expired-callback': () => {
        console.warn('[AuthService] Invisible reCAPTCHA expired, clearing verifier.');
        cleanupRecaptchaVerifier();
      },
    });

    await verifier.render();
    window.recaptchaVerifier = verifier;
    console.info('[AuthService] Invisible reCAPTCHA initialized cleanly.');
    return verifier;
  } catch (err: any) {
    console.warn('[AuthService] Error creating RecaptchaVerifier, cleaning up and retrying:', err);
    cleanupRecaptchaVerifier();
    ensureRecaptchaContainer();

    const fallbackVerifier = new RecaptchaVerifier(auth, RECAPTCHA_CONTAINER_ID, {
      size: 'invisible',
      callback: () => {},
      'expired-callback': () => cleanupRecaptchaVerifier(),
    });
    await fallbackVerifier.render();
    window.recaptchaVerifier = fallbackVerifier;
    return fallbackVerifier;
  }
}

/**
 * Normalizes phone numbers to standard E.164 (+91 format for India).
 */
export function formatPhoneNumber(rawPhone: string): string {
  const digitsOnly = rawPhone.replace(/\D/g, '');
  if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
    return `+${digitsOnly}`;
  }
  const cleanTenDigits = digitsOnly.slice(-10);
  return `+91${cleanTenDigits}`;
}

/**
 * Requests an SMS OTP via Firebase Phone Auth using the standardized RecaptchaVerifier.
 * Cleans up verifier state automatically on critical failures to ensure subsequent attempts succeed.
 */
export async function requestPhoneOtp(phoneNumber: string): Promise<ConfirmationResult> {
  const formattedPhone = formatPhoneNumber(phoneNumber);
  const verifier = await getOrCreateRecaptchaVerifier();

  try {
    console.info(`[AuthService] Requesting SMS OTP for ${formattedPhone}...`);
    const confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, verifier);
    console.info(`[AuthService] SMS OTP dispatched successfully for ${formattedPhone}.`);
    return confirmationResult;
  } catch (error: any) {
    console.error('[AuthService] signInWithPhoneNumber failed:', error);
    // Clean up verifier so the next attempt can re-render fresh
    cleanupRecaptchaVerifier();
    throw error;
  }
}

/**
 * Confirms an SMS OTP using the active ConfirmationResult session.
 */
export async function confirmPhoneOtp(
  confirmationResult: ConfirmationResult,
  otpCode: string
): Promise<UserCredential> {
  const cleanCode = otpCode.replace(/\D/g, '').trim();
  if (cleanCode.length !== 6) {
    throw new Error('Please enter a valid 6-digit verification code.');
  }

  try {
    const userCredential = await confirmationResult.confirm(cleanCode);
    console.info('[AuthService] Phone OTP confirmed successfully for UID:', userCredential.user.uid);
    return userCredential;
  } catch (error: any) {
    console.error('[AuthService] OTP confirmation failed:', error);
    throw error;
  }
}

/**
 * Human-friendly error translation for Firebase Authentication codes.
 */
export function getFriendlyAuthErrorMessage(error: any): string {
  if (!error) return 'An unexpected error occurred. Please try again.';

  const code = error.code || '';
  const message = error.message || '';

  if (code.includes('invalid-verification-code') || message.includes('invalid-verification-code')) {
    return 'Invalid 6-digit OTP code entered. Please check the SMS and re-enter.';
  }
  if (code.includes('code-expired') || message.includes('code-expired')) {
    return 'The verification code has expired. Please tap "Resend OTP" to get a new code.';
  }
  if (code.includes('too-many-requests') || message.includes('too-many-requests')) {
    return 'Too many requests sent from this device. Please wait 1-2 minutes before trying again.';
  }
  if (code.includes('captcha-check-failed') || code.includes('invalid-app-credential')) {
    return 'reCAPTCHA verification could not be completed. Please refresh and try again.';
  }
  if (code.includes('invalid-phone-number')) {
    return 'Invalid mobile number format. Please provide a valid 10-digit number.';
  }
  if (code.includes('network-request-failed')) {
    return 'Network connection issue detected. Please check your internet connection.';
  }
  if (code.includes('session-expired')) {
    return 'Verification session expired. Please request a new OTP.';
  }

  return message || 'Authentication failed. Please try again.';
}
