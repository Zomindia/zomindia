import { load } from '@cashfreepayments/cashfree-js';

export interface CashfreeCheckoutOptions {
  paymentSessionId: string;
  redirectTarget?: '_self' | '_modal' | '_blank';
}

export interface DropinCallbacks {
  onSuccess: (data: any) => void;
  onFailure: (data: any) => void;
}

/**
 * Loads the Cashfree SDK instance with the appropriate environment mode.
 */
export async function getCashfreeInstance() {
  if (typeof window === 'undefined') return null;

  try {
    const envMode = (import.meta as any).env?.VITE_CASHFREE_ENV === 'SANDBOX' ? 'sandbox' : 'production';
    
    // First try the official @cashfreepayments/cashfree-js loader
    try {
      const instance = await load({ mode: envMode });
      if (instance) return instance;
    } catch (loadErr) {
      console.warn('[Cashfree] @cashfreepayments/cashfree-js load warning:', loadErr);
    }

    // Fallback: check window.Cashfree directly
    if ((window as any).Cashfree) {
      return (window as any).Cashfree({ mode: envMode });
    }

    return null;
  } catch (err) {
    console.error('[Cashfree] Failed to initialize Cashfree SDK:', err);
    return null;
  }
}

/**
 * Mounts the official Cashfree Drop-in UI into a DOM element.
 * If container mounting is unavailable in the environment, returns false so callers can fallback to checkout().
 */
export async function mountCashfreeDropin(
  container: HTMLElement,
  paymentSessionId: string,
  callbacks: DropinCallbacks
): Promise<{ success: boolean; instance?: any; error?: string }> {
  try {
    const cashfree = await getCashfreeInstance();
    if (!cashfree) {
      return { success: false, error: 'Cashfree SDK is not available or blocked by ad-blocker' };
    }

    const dropinConfig = {
      paymentSessionId,
      components: ['order-details', 'card', 'upi', 'app', 'netbanking', 'paylater'],
      onSuccess: callbacks.onSuccess,
      onFailure: callbacks.onFailure,
      style: {
        theme: 'light' as const,
        backgroundColor: '#ffffff',
        color: '#1e293b',
        fontSize: '14px',
        fontFamily: 'Inter, sans-serif',
        errorColor: '#ef4444'
      }
    };

    // Cashfree JS SDK v3 dropin mounting methods
    if (typeof cashfree.initialiseDropin === 'function') {
      const dropinInstance = cashfree.initialiseDropin(container, dropinConfig);
      return { success: true, instance: dropinInstance };
    } else if (typeof cashfree.dropin === 'function') {
      const dropinInstance = cashfree.dropin(container, dropinConfig);
      return { success: true, instance: dropinInstance };
    }

    // If dropin mounting method is not present on the SDK object, fallback to direct hosted checkout
    if (typeof cashfree.checkout === 'function') {
      cashfree.checkout({ paymentSessionId, redirectTarget: '_self' });
      return { success: true };
    }

    return { success: false, error: 'Cashfree dropin method not supported by this version' };
  } catch (err: any) {
    console.warn('[Cashfree] Dropin mounting exception:', err);
    return { success: false, error: err?.message || 'Failed to mount drop-in' };
  }
}

/**
 * Direct checkout redirect or modal trigger
 */
export async function launchCashfreeCheckout(paymentSessionId: string, redirectTarget: '_self' | '_modal' = '_self') {
  const cashfree = await getCashfreeInstance();
  if (cashfree && typeof cashfree.checkout === 'function') {
    cashfree.checkout({ paymentSessionId, redirectTarget });
    return true;
  }
  return false;
}
