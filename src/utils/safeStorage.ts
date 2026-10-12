import { Telemetry } from '../services/telemetry';

/**
 * Defensive Enterprise Storage wrapper.
 * Ensures storage access in Android WebView, private browsing, or quota-exceeded
 * situations will never crash the app or terminate processes, while logging
 * diagnostic breadcrumbs for enterprise telemetry.
 */
class SafeStorageService {
  private memoryFallback = new Map<string, string>();

  public getItem(key: string): string | null {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch (err: any) {
      Telemetry.addBreadcrumb('storage', `Storage read blocked for key "${key}"`, {
        error: String(err?.message || err),
      });
    }
    return this.memoryFallback.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (err: any) {
      Telemetry.addBreadcrumb('storage', `Storage write failed/quota exceeded for key "${key}"`, {
        error: String(err?.message || err),
      });
    }
    this.memoryFallback.set(key, value);
  }

  public removeItem(key: string): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.removeItem(key);
      }
    } catch (err: any) {
      Telemetry.addBreadcrumb('storage', `Storage remove error for key "${key}"`, {
        error: String(err?.message || err),
      });
    }
    this.memoryFallback.delete(key);
  }

  public clear(): void {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.clear();
      }
    } catch (err: any) {
      Telemetry.addBreadcrumb('storage', 'Storage clear error', {
        error: String(err?.message || err),
      });
    }
    this.memoryFallback.clear();
  }
}

export const safeStorage = new SafeStorageService();

// Defensive patch on window.localStorage to protect existing components from quota or security errors
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    const origSetItem = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = function (key: string, value: string) {
      try {
        origSetItem(key, value);
      } catch (err: any) {
        console.warn(`[SafeStorage Bypass]: localStorage.setItem("${key}") failed:`, err);
        Telemetry.addBreadcrumb('storage', `Native localStorage write failure: ${key}`, {
          error: String(err?.message || err),
        });
        safeStorage.setItem(key, value);
      }
    };
  } catch {
    // If window.localStorage is read-only or strictly protected, ignore
  }
}

export default safeStorage;
