import { Capacitor } from '@capacitor/core';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getApiUrl } from './api';

export interface Breadcrumb {
  category: 'route' | 'auth' | 'ui' | 'native' | 'api' | 'storage' | 'system';
  message: string;
  data?: Record<string, any>;
  timestamp: string;
}

export interface TelemetryUser {
  uid?: string;
  phoneNumber?: string;
  displayName?: string;
  email?: string;
  role?: string;
}

const MAX_BREADCRUMBS = 10;
const DEDUPE_WINDOW_MS = 3000;

class TelemetryService {
  private breadcrumbs: Breadcrumb[] = [];
  private currentUser: TelemetryUser | null = null;
  private lastLoggedCrashes = new Map<string, number>();

  constructor() {
    this.initAutoInstrumentation();
  }

  /**
   * Maintain circular buffer of the last 10 breadcrumbs
   */
  public addBreadcrumb(
    category: Breadcrumb['category'],
    message: string,
    data?: Record<string, any>
  ): void {
    try {
      const sanitizedData = data ? this.sanitizeData(data) : undefined;
      const crumb: Breadcrumb = {
        category,
        message: String(message || '').slice(0, 300),
        data: sanitizedData,
        timestamp: new Date().toISOString(),
      };

      this.breadcrumbs.push(crumb);
      if (this.breadcrumbs.length > MAX_BREADCRUMBS) {
        this.breadcrumbs.splice(0, this.breadcrumbs.length - MAX_BREADCRUMBS);
      }
    } catch {
      // Telemetry must never throw
    }
  }

  /**
   * Get an immutable snapshot of current breadcrumbs
   */
  public getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Set currently logged in user context for diagnostics
   */
  public setUser(user: TelemetryUser | null): void {
    this.currentUser = user
      ? {
          uid: user.uid,
          phoneNumber: user.phoneNumber,
          displayName: user.displayName,
          email: user.email,
          role: user.role,
        }
      : null;

    if (user?.uid) {
      this.addBreadcrumb('auth', `User context updated (${user.role || 'customer'} : ${user.uid.slice(0, 8)}...)`);
    } else {
      this.addBreadcrumb('auth', 'User context cleared (logged out)');
    }
  }

  public getUser(): TelemetryUser | null {
    return this.currentUser ? { ...this.currentUser } : null;
  }

  /**
   * Dispatches fatal crash diagnostics to Firestore collection `system_crashes`
   * and dispatches via navigator.sendBeacon as an unload-resilient fallback.
   */
  public async logCrash(error: any, context?: string): Promise<string | null> {
    try {
      const message = this.extractErrorMessage(error);
      const stack = this.extractStackTrace(error);
      const crashContext = context || 'General Error';

      // Deduplication guard: ignore duplicate identical crashes within 3s
      const dedupeKey = `${crashContext}:${message}`;
      const now = Date.now();
      const lastTime = this.lastLoggedCrashes.get(dedupeKey) || 0;
      if (now - lastTime < DEDUPE_WINDOW_MS) {
        return null;
      }
      this.lastLoggedCrashes.set(dedupeKey, now);

      // Clean up old dedupe keys
      if (this.lastLoggedCrashes.size > 50) {
        for (const [k, t] of this.lastLoggedCrashes.entries()) {
          if (now - t > 30000) this.lastLoggedCrashes.delete(k);
        }
      }

      const platform = Capacitor.getPlatform();
      const isNative = Capacitor.isNativePlatform();
      const url = typeof window !== 'undefined' ? window.location.href : '';
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

      const breadcrumbsSnapshot = this.getBreadcrumbs();

      const payload = {
        message: message.slice(0, 1000),
        stack: stack.slice(0, 15000),
        context: crashContext,
        platform,
        isNative,
        url,
        userAgent,
        userId: this.currentUser?.uid || 'anonymous',
        phoneNumber: this.currentUser?.phoneNumber || null,
        userRole: this.currentUser?.role || null,
        userDisplayName: this.currentUser?.displayName || null,
        breadcrumbs: breadcrumbsSnapshot,
        clientTimestamp: new Date().toISOString(),
      };

      // 1. Persist the last crash in localStorage so that even if the app hard-kills, the log survives on the phone
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('last_crash_report', JSON.stringify({
            ...payload,
            persistedAt: new Date().toISOString(),
          }));
        }
      } catch (storageErr) {
        // Suppress localStorage quota or security errors
      }

      // 2. Direct sendBeacon dispatch (survives window unloads and hard crashes)
      try {
        if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
          const beaconEndpoint = getApiUrl('/api/telemetry/crash');
          const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
          navigator.sendBeacon(beaconEndpoint, blob);
        }
      } catch (beaconErr) {
        // Suppress beacon transmission failures
      }

      // 3. Direct Firestore Write (immutable record in active database collection `system_crashes`)
      let docId: string | null = null;
      if (db) {
        try {
          const crashesCol = collection(db, 'system_crashes');
          const docRef = await addDoc(crashesCol, {
            ...payload,
            timestamp: serverTimestamp(),
          });
          docId = docRef.id;
        } catch (firestoreErr) {
          console.warn('[Telemetry Firestore Write Bypass]:', firestoreErr);
        }
      }

      // Record crash breadcrumb locally for any subsequent errors
      this.addBreadcrumb('system', `Crash logged [${crashContext}]: ${message.slice(0, 100)}`);

      return docId;
    } catch (fatalTelemetryErr) {
      // Must NEVER throw under any circumstance
      console.warn('[Telemetry Safe Guard]: Failed to record telemetry:', fatalTelemetryErr);
      return null;
    }
  }

  private extractErrorMessage(error: any): string {
    if (!error) return 'Unknown error (null or undefined)';
    if (typeof error === 'string') return error;
    if (error?.message) return String(error.message);
    if (error?.reason) {
      if (typeof error.reason === 'string') return error.reason;
      if (error.reason?.message) return String(error.reason.message);
      return String(error.reason);
    }
    return String(error);
  }

  private extractStackTrace(error: any): string {
    if (!error) return 'No stack trace available';
    if (error?.stack) return String(error.stack);
    if (error?.reason?.stack) return String(error.reason.stack);
    try {
      return new Error().stack || 'Generated stack trace unavailable';
    } catch {
      return 'No stack trace available';
    }
  }

  private sanitizeData(data: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    const sensitiveKeys = ['password', 'token', 'auth', 'secret', 'apikey', 'otp', 'creditcard'];

    try {
      for (const [key, value] of Object.entries(data)) {
        const lowerKey = key.toLowerCase();
        if (sensitiveKeys.some((s) => lowerKey.includes(s))) {
          sanitized[key] = '[REDACTED]';
        } else if (value && typeof value === 'object') {
          sanitized[key] = '[Object]';
        } else {
          sanitized[key] = value;
        }
      }
    } catch {
      return { raw: '[Unserializable data]' };
    }
    return sanitized;
  }

  private initAutoInstrumentation(): void {
    if (typeof window === 'undefined') return;

    try {
      // Route change tracking (popstate & hashchange)
      window.addEventListener('popstate', () => {
        this.addBreadcrumb('route', `Navigation: popstate to ${window.location.pathname}${window.location.hash}`);
      });

      window.addEventListener('hashchange', () => {
        this.addBreadcrumb('route', `Navigation: hashchange to ${window.location.hash}`);
      });

      // UI Click tracking (buttons, links, action elements)
      document.addEventListener(
        'click',
        (e: MouseEvent) => {
          try {
            const target = e.target as HTMLElement | null;
            if (!target) return;

            const clickable = target.closest('button, a, [role="button"], [data-action]');
            if (clickable) {
              const label =
                clickable.getAttribute('data-action') ||
                clickable.getAttribute('aria-label') ||
                clickable.textContent?.trim().slice(0, 30) ||
                clickable.tagName.toLowerCase();

              this.addBreadcrumb('ui', `User clicked ${clickable.tagName.toLowerCase()}: "${label}"`);
            }
          } catch {
            // ignore
          }
        },
        { capture: true, passive: true }
      );
    } catch {
      // ignore
    }
  }
}

export const Telemetry = new TelemetryService();
export default Telemetry;
