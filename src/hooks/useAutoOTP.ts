import { useEffect, useRef } from 'react';

export interface UseAutoOTPOptions {
  /** Length of the OTP expected (e.g. 4 for Partner Job OTP, 6 for Login/Auth OTP) */
  length?: number;
  /** Whether the OTP screen / modal is actively open and listening */
  enabled?: boolean;
  /** Callback triggered when OTP is auto-detected and extracted */
  onOTP: (code: string) => void;
  /** Optional callback triggered automatically to submit verification */
  onAutoSubmit?: (code: string) => void;
  /** Delay before auto-submitting in milliseconds (default 500ms for visual verification) */
  autoSubmitDelay?: number;
}

/**
 * Custom React hook providing native WebOTP API Auto-Detection with AbortController,
 * graceful fallback for unsupported browsers/iFrames, and cleanup on unmount.
 */
export function useAutoOTP({
  length = 6,
  enabled = true,
  onOTP,
  onAutoSubmit,
  autoSubmitDelay = 500,
}: UseAutoOTPOptions) {
  const onOTPRef = useRef(onOTP);
  onOTPRef.current = onOTP;

  const onAutoSubmitRef = useRef(onAutoSubmit);
  onAutoSubmitRef.current = onAutoSubmit;

  useEffect(() => {
    if (!enabled) return;

    // Check if WebOTP (OTPCredential) is supported in current environment
    if (typeof window === 'undefined' || !('OTPCredential' in window) || !navigator.credentials) {
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
          const digits = String(content.code).replace(/\D/g, '').slice(0, length);
          if (digits.length === length) {
            console.log(`[WebOTP API] Auto-detected ${length}-digit OTP code:`, digits);
            onOTPRef.current(digits);

            if (onAutoSubmitRef.current) {
              autoSubmitTimer = setTimeout(() => {
                if (!ac.signal.aborted) {
                  onAutoSubmitRef.current?.(digits);
                }
              }, autoSubmitDelay);
            }
          }
        }
      })
      .catch((err: any) => {
        // Silently catch and handle aborted or unsupported iframe contexts
        if (
          err.name !== 'AbortError' &&
          err.name !== 'SecurityError' &&
          !err.message?.toLowerCase().includes('otp-credentials') &&
          !err.message?.toLowerCase().includes('not supported')
        ) {
          console.warn('[WebOTP API] OTP listener notice:', err);
        }
      });

    return () => {
      if (autoSubmitTimer) {
        clearTimeout(autoSubmitTimer);
      }
      try {
        ac.abort();
      } catch (e) {
        // Safe catch for already completed/aborted controllers
      }
    };
  }, [enabled, length, autoSubmitDelay]);
}
