/**
 * ZOMINDIA ENTERPRISE PWA SERVICE WORKER
 * Production-ready offline fallback shell & runtime caching engine.
 * Specifically configured to NOT intercept or block Firebase Firestore, 
 * Auth, or real-time database WebSocket connections.
 */

const CACHE_NAME = 'zomindia-cache-v1';
const OFFLINE_URL = '/index.html';

// Workbox manifest injection placeholder (required by vite-plugin-pwa in injectManifest strategy)
const precacheManifest = self.__WB_MANIFEST || [];

// Assets to precache immediately on service worker installation
const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/screenshot-mobile.png',
  '/screenshot-desktop.png',
  ...precacheManifest.map(entry => typeof entry === 'string' ? entry : entry.url)
];

// Installation: Open cache and add essential app shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[PWA SW] Pre-caching core application shell assets...');
        return cache.addAll(PRECACHE_ASSETS);
      })
      .then(() => {
        console.log('[PWA SW] Core assets cached successfully. Activating...');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[PWA SW] Pre-cache installation failed:', error);
      })
  );
});

// Activation: Clean up any old, stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[PWA SW] Purging stale obsolete cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[PWA SW] Active and claiming all page clients.');
      return self.clients.claim();
    })
  );
});

// Fetch Interception: Robust caching with offline shell fallbacks
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. MUST NOT cache non-GET requests (Firebase Auth, mutations, Firestore updates are POST/PUT/DELETE)
  if (request.method !== 'GET') {
    return;
  }

  // 2. CRITICAL GUARDRAIL: Never intercept or block Firebase services, APIs, Google identity, or WebSockets
  const isFirebaseOrApi = 
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('identitytoolkit') ||
    url.hostname.includes('securetoken') ||
    url.pathname.startsWith('/api/') ||
    request.url.includes('socket.io') ||
    request.url.includes('__vite_ping') ||
    url.hostname.includes('localhost') && url.port === '3000' && !url.pathname.match(/\.(js|css|png|html|json)$/);

  if (isFirebaseOrApi) {
    // Network-Only: Bypass service worker cache completely
    return;
  }

  // 3. Page Navigation (HTML requests) - Network-first with graceful offline fallback
  if (request.mode === 'navigate' || (request.headers.get('accept') || '').includes('text/html')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone and cache the successfully fetched page
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If offline, serve the offline index.html shell from cache
          console.log('[PWA SW] Client is offline. Serving app shell fallback.');
          return caches.match(OFFLINE_URL) || caches.match('/');
        })
    );
    return;
  }

  // 4. Static Assets (JS, CSS, local images, fonts) - Stale-While-Revalidate
  // This delivers near-instant loads while updating the cached resource in the background.
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      const fetchPromise = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch((err) => {
          console.debug('[PWA SW] Asset fetch failed (likely offline):', request.url, err);
        });

      return cachedResponse || fetchPromise;
    })
  );
});

// 5. Native Background Push Notifications and Click Handlers
self.addEventListener('push', (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'Zomindia Notification', message: event.data.text() };
    }
  }

  const title = data.title || 'Zomindia Internet Technologies';
  const options = {
    body: data.message || data.body || 'New update regarding your booking.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if ('focus' in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
  );
});

// Message handling: support SKIP_WAITING to allow instant updates
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

