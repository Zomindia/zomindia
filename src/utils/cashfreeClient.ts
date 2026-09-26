import { load } from '@cashfreepayments/cashfree-js';

export type CashfreeMode = 'sandbox' | 'production';

export interface CashfreeCheckoutOptions {
  paymentSessionId: string;
  redirectTarget?: '_self' | '_modal' | '_blank';
}

export interface DropinCallbacks {
  onSuccess: (data: any) => void;
  onFailure: (data: any) => void;
}

let cachedServerMode: CashfreeMode | null = null;

/**
 * Resolves the Cashfree environment mode strictly aligned with the backend server.
 */
export async function resolveCashfreeMode(overrideMode?: CashfreeMode): Promise<CashfreeMode> {
  if (overrideMode) return overrideMode;
  if (cachedServerMode) return cachedServerMode;

  try {
    const res = await fetch('/api/cashfree/config');
    if (res.ok) {
      const data = await res.json();
      if (data && (data.mode === 'sandbox' || data.mode === 'production')) {
        cachedServerMode = data.mode;
        return data.mode;
      }
    }
  } catch (err) {
    console.warn('[Cashfree] Could not fetch server config, using env fallback:', err);
  }

  const envVar = ((import.meta as any).env?.VITE_CASHFREE_ENV || '').toLowerCase();
  const fallback: CashfreeMode = envVar === 'sandbox' || envVar === 'test' ? 'sandbox' : 'production';
  return fallback;
}

/**
 * Loads the Cashfree SDK instance with the appropriate environment mode.
 * Strictly aligns mode ('sandbox' or 'production') with backend server orders.
 */
export async function getCashfreeInstance(explicitMode?: CashfreeMode) {
  if (typeof window === 'undefined') return null;

  try {
    const mode = explicitMode || await resolveCashfreeMode();

    // 1. First try the official @cashfreepayments/cashfree-js loader
    try {
      const instance = await load({ mode });
      if (instance) return instance;
    } catch (loadErr) {
      console.warn('[Cashfree] @cashfreepayments/cashfree-js load warning:', loadErr);
    }

    // 2. Direct Cashfree SDK factory from window object: const cashfree = Cashfree({ mode })
    if (typeof (window as any).Cashfree === 'function') {
      try {
        const instance = (window as any).Cashfree({ mode });
        if (instance) return instance;
      } catch (winErr) {
        console.warn('[Cashfree] window.Cashfree init warning:', winErr);
      }
    }

    return null;
  } catch (err) {
    console.error('[Cashfree] Failed to initialize Cashfree SDK:', err);
    return null;
  }
}

/**
 * Backward-compatible helper export for any active browser sessions or modules.
 */
export async function getCashfreeSdk(explicitMode?: CashfreeMode): Promise<any> {
  if (typeof window === 'undefined') return null;

  const instance = await getCashfreeInstance(explicitMode);
  if (instance) return instance;

  if (typeof (window as any).Cashfree === 'function') {
    const mode = explicitMode || await resolveCashfreeMode();
    return (window as any).Cashfree({ mode });
  }

  return null;
}

/**
 * Direct checkout redirect or modal trigger with verified payment_session_id.
 */
export async function launchCashfreeCheckout(
  paymentSessionId: string, 
  redirectTarget: '_self' | '_modal' = '_modal',
  explicitMode?: CashfreeMode
) {
  if (!paymentSessionId || typeof paymentSessionId !== 'string' || !paymentSessionId.trim()) {
    throw new Error('payment_session_id is required to launch Cashfree checkout');
  }

  const cashfree = await getCashfreeInstance(explicitMode);
  if (cashfree && typeof cashfree.checkout === 'function') {
    cashfree.checkout({ paymentSessionId: paymentSessionId.trim(), redirectTarget });
    return true;
  }
  return false;
}
