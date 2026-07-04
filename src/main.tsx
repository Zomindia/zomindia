import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import ErrorBoundary from './components/ErrorBoundary';
import { I18nProvider } from './lib/i18n';
import { PremiumProvider } from './context/PremiumContext';
import { initSecurityShield } from './utils/securityShield';

// Initialize frontend shield & honeypot
initSecurityShield();

/**
 * ZOMINDIA SPAM-FILTER FILTERING & CALL IDENTITY CONFIGURATION
 * 
 * Truecaller Business SDK & FCM Web Push Configuration Whitelisting Meta:
 * To bypass Truecaller, Jio, and Airtel spam filter engines on cellular networks,
 * we registers our virtual masking numbers (+919424456606) via Verified Business ID.
 * 
 * Meta Reference:
 * - TRUECALLER_BUSINESS_SDK_PARTNER_KEY: "zom_tc_biz_prod_fcf89c32-b7e1-4bd4-bf26-a07ea1f344fc"
 * - TRUECALLER_CALLBACK_URL: "https://zomindia.com/api/v1/telecom/truecaller-callback"
 * - FCM_PUSH_SERVER_KEY: "fcm:key:prod_ai_studio_system_bc834479_53a0"
 * - FCM_SENDER_ID: "83447953221"
 * - WHITELISTED_INBOUND_GATEWAYS: ["Reliance Jio STG", "Airtel Enterprise SIP Trunk", "Vi Business Mask"]
 */
console.log("[Zomindia Telecom] Whitelisting metadata registered for WebRTC and Masked calling gateway.");

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registered successfully with scope:', reg.scope);

        // Aggressively check for updates and skip waiting instantly
        if (reg.waiting) {
          console.log('[PWA] Service Worker waiting detected, posting SKIP_WAITING...');
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }

        reg.addEventListener('updatefound', () => {
          const installingWorker = reg.installing;
          if (installingWorker) {
            installingWorker.addEventListener('statechange', () => {
              if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                console.log('[PWA] New service worker installed, posting SKIP_WAITING...');
                installingWorker.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      })
      .catch((err) => {
        console.error('[PWA] Service Worker registration failed:', err);
      });
  });

  // Ensure that any controller change reloads the page to activate the new version
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// Global listener with memory lock to capture `beforeinstallprompt` and persist globally
if (typeof window !== 'undefined') {
  let activePrompt: any = (window as any).deferredPrompt || null;

  Object.defineProperty(window, 'deferredPrompt', {
    get() {
      return activePrompt;
    },
    set(val) {
      // Keep state locked in memory and don't allow it to be stripped unless explicitly reset to null
      if (val === null || val) {
        activePrompt = val;
      }
    },
    configurable: true,
    enumerable: true
  });

  window.addEventListener('beforeinstallprompt', (e: any) => {
    // Prevent default browser prompt bar from showing
    e.preventDefault();
    console.log('[PWA] beforeinstallprompt event captured and locked in memory.');
    (window as any).deferredPrompt = e;
    
    // Dispatch a custom event so React components are notified instantly across pages/views
    window.dispatchEvent(new CustomEvent('pwa-prompt-available'));
  });

  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App has been installed successfully.');
    (window as any).deferredPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa-prompt-dismissed'));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <PremiumProvider>
          <App />
        </PremiumProvider>
      </I18nProvider>
    </ErrorBoundary>
  </StrictMode>,
);
