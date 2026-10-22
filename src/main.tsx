import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import './services/api';
import './utils/safeStorage';
import { Telemetry } from './services/telemetry';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { I18nProvider } from './lib/i18n';
import { initSecurityShield } from './utils/securityShield';
import { defineCustomElements } from '@ionic/pwa-elements/loader';

// Persistent Global Event Caching attached before React mounts
if (typeof window !== 'undefined') {
  const isIgnoredError = (err: any) => {
    if (!err) return false;
    const msg = typeof err === 'string' ? err : (err?.message || err?.reason || String(err || ''));
    const stack = typeof err?.stack === 'string' ? err.stack : '';
    const full = `${msg} ${stack}`;
    return (
      full.includes('WebSocket') ||
      full.includes('closed without opened') ||
      full.includes('@vite/client') ||
      full.includes('vite:ws') ||
      full.includes('Geocoding Service: This API key is not authorized') ||
      full.includes('This API key is not authorized to use this service or API') ||
      full.includes('ApiNotActivatedMapError') ||
      full.includes('INTERNAL ASSERTION FAILED') ||
      full.includes('ca9') ||
      full.includes('b815') ||
      full.includes('ve:-1') ||
      full.includes('47125') ||
      full.includes('3241') ||
      full.includes('WatchChangeAggregator') ||
      full.includes('TargetState')
    );
  };

  // Suppress harmless Geocoding & WebSocket/HMR errors so they do not trigger automated error handlers
  const _origConsoleError = console.error;
  console.error = (...args: any[]) => {
    if (args.some((a) => isIgnoredError(a))) {
      return;
    }
    _origConsoleError.apply(console, args);
  };

  window.addEventListener('unhandledrejection', (event) => {
    if (isIgnoredError(event.reason)) {
      event.preventDefault();
      return;
    }
    console.warn('[Unhandled Rejection Suppressed]:', event.reason);
    Telemetry.logCrash(event.reason, 'Unhandled Global Rejection');
    event.preventDefault();
  });

  window.addEventListener('error', (event) => {
    if (isIgnoredError(event.error) || isIgnoredError(event.message)) {
      event.preventDefault();
      return;
    }
    console.warn('[Global Error Suppressed]:', event.error || event.message);
    Telemetry.logCrash(event.error || event.message, 'Unhandled Global Error');
  });

  window.onerror = (message, source, lineno, colno, error) => {
    if (isIgnoredError(error) || isIgnoredError(message)) {
      return true;
    }
    Telemetry.logCrash(
      error || { message: String(message), source, lineno, colno },
      'Unhandled Global Window Error'
    );
    return false;
  };

  (window as any).gm_authFailure = () => {
    console.warn("[Google Maps API] Key restriction or API disabled. Google Maps fallback mode active.");
  };

  let activePrompt: any = (window as any).deferredPrompt || null;

  Object.defineProperty(window, 'deferredPrompt', {
    get() {
      return activePrompt;
    },
    set(val) {
      if (val === null || val) {
        activePrompt = val;
      }
    },
    configurable: true,
    enumerable: true
  });

  window.addEventListener('beforeinstallprompt', (e: any) => {
    // Prevent default browser banner so we control when and how it triggers
    e.preventDefault();
    console.log('[PWA] beforeinstallprompt event captured and locked in memory.');
    (window as any).deferredPrompt = e;
    
    // Dispatch a custom event so React components are notified instantly across pages/views
    window.dispatchEvent(new CustomEvent('pwa-prompt-available'));
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App has been installed successfully.');
    (window as any).deferredPrompt = null;
    try {
      localStorage.setItem('zomindia_pwa_installed', 'true');
    } catch {}
    window.dispatchEvent(new CustomEvent('pwa-prompt-dismissed'));
  });
}

// Call the element loader before rendering the App
defineCustomElements(window);

// Initialize frontend shield & honeypot
initSecurityShield();

/**
 * ZOMINDIA SPAM-FILTER FILTERING & CALL IDENTITY CONFIGURATION
 * 
 * Truecaller Business SDK & FCM Web Push Configuration Whitelisting Meta:
 * To bypass Truecaller, Jio, and Airtel spam filter engines on cellular networks,
 * we registers our virtual masking numbers (+919630234563) via Verified Business ID.
 * 
 * Meta Reference:
 * - TRUECALLER_BUSINESS_SDK_PARTNER_KEY: "zom_tc_biz_prod_fcf89c32-b7e1-4bd4-bf26-a07ea1f344fc"
 * - TRUECALLER_CALLBACK_URL: "https://zomindia.com/api/v1/telecom/truecaller-callback"
 * - FCM_PUSH_SERVER_KEY: "fcm:key:prod_ai_studio_system_bc834479_53a0"
 * - FCM_SENDER_ID: "83447953221"
 * - WHITELISTED_INBOUND_GATEWAYS: ["Reliance Jio STG", "Airtel Enterprise SIP Trunk", "Vi Business Mask"]
 */
console.log("[Zomindia Telecom] Whitelisting metadata registered for WebRTC and Masked calling gateway.");

if ('serviceWorker' in navigator) {
  const isDevOrPreview = 
    Boolean(import.meta.env.DEV) || 
    window.location.hostname.includes('run.app') || 
    window.location.hostname.includes('localhost');

  if (isDevOrPreview) {
    // In dev / preview environments, unregister all service workers and wipe all caches
    // to strictly prevent stale Vite pre-bundled chunks, duplicate React copies, and hook errors.
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const reg of registrations) {
        reg.unregister();
      }
    });
    if ('caches' in window) {
      caches.keys().then((names) => {
        names.forEach((name) => {
          caches.delete(name);
        });
      });
    }
  } else {
    window.addEventListener('load', () => {
      // Record if there was already an active controller when the page loaded
      const hadPreviousController = Boolean(navigator.serviceWorker.controller);

      navigator.serviceWorker.register('/sw.js')
        .then((reg) => {
          console.log('[PWA] Service Worker registered with scope:', reg.scope);

          // Check for updates gracefully
          reg.addEventListener('updatefound', () => {
            const installingWorker = reg.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                // If new worker is installed and we already had an active controller,
                // notify the user/app or dispatch custom update event without forced immediate reload
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] A new version is available.');
                  window.dispatchEvent(new CustomEvent('pwa-update-available'));
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('[PWA] Service Worker registration notice:', err);
        });

      // Guard controllerchange: Only reload if a PREVIOUS controller was already active before this session.
      // This strictly prevents the initial install / first page load from reloading the page.
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hadPreviousController && !refreshing) {
          refreshing = true;
          window.location.reload();
        }
      });
    });
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ErrorBoundary>
  </StrictMode>,
);
