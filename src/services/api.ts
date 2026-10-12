import { Capacitor } from '@capacitor/core';
import axios from 'axios';

export const PRODUCTION_API_URL = 'https://zomindia.com';

/**
 * Returns the base API URL. On native Capacitor (Android/iOS), it returns the absolute
 * domain https://zomindia.com since native apps run on http://localhost or capacitor://localhost.
 * On web, it returns an empty string to use relative paths.
 */
export function getApiBaseUrl(): string {
  if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
    return PRODUCTION_API_URL;
  }
  return '';
}

/**
 * Ensures an API endpoint URL has the full domain if running on native mobile.
 */
export function getApiUrl(path: string): string {
  if (!path) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (Capacitor.isNativePlatform()) {
    return `${PRODUCTION_API_URL}${cleanPath}`;
  }
  return cleanPath;
}

/**
 * Safe wrapper around fetch that automatically prepends the absolute URL on native platforms.
 */
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let target = input;
  if (Capacitor.isNativePlatform()) {
    if (typeof input === 'string') {
      target = getApiUrl(input);
    } else if (input instanceof URL) {
      if (input.pathname.startsWith('/api/')) {
        target = new URL(`${PRODUCTION_API_URL}${input.pathname}${input.search}`);
      }
    }
  }
  return fetch(target, init);
}

// Global initialization: automatically configure axios and patch window.fetch for Capacitor Native
if (typeof window !== 'undefined') {
  try {
    if (Capacitor.isNativePlatform()) {
      // 1. Configure Axios baseURL if axios is present
      if (axios && axios.defaults) {
        axios.defaults.baseURL = PRODUCTION_API_URL;
      }

      // 2. Patch window.fetch so all existing fetch('/api/...') calls in any component
      // seamlessly target https://zomindia.com/api/... on native Android & iOS WebView
      const originalFetch = window.fetch.bind(window);
      window.fetch = function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
        try {
          if (typeof input === 'string') {
            if (input.startsWith('/api/') || input === '/api') {
              input = `${PRODUCTION_API_URL}${input}`;
            }
          } else if (input instanceof URL) {
            if (input.pathname.startsWith('/api/') && (input.origin === 'http://localhost' || input.origin === 'capacitor://localhost' || input.protocol === 'capacitor:')) {
              input = new URL(`${PRODUCTION_API_URL}${input.pathname}${input.search}`);
            }
          } else if (typeof Request !== 'undefined' && input instanceof Request) {
            const reqUrl = input.url;
            if (reqUrl) {
              const parsed = new URL(reqUrl);
              if (parsed.pathname.startsWith('/api/') && (parsed.origin === 'http://localhost' || parsed.origin === 'capacitor://localhost' || parsed.protocol === 'capacitor:')) {
                const absoluteUrl = `${PRODUCTION_API_URL}${parsed.pathname}${parsed.search}`;
                input = new Request(absoluteUrl, input);
              }
            }
          }
        } catch (patchErr) {
          console.warn('[API Base URL Interceptor Warning]:', patchErr);
        }
        return originalFetch(input, init);
      };
    }
  } catch (err) {
    console.warn('[API Interceptor Setup Failed]:', err);
  }
}

export default {
  getApiBaseUrl,
  getApiUrl,
  apiFetch,
  PRODUCTION_API_URL
};
