import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  const disableHmr = process.env.DISABLE_HMR === 'true';

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'public',
        filename: 'sw.js',
        injectRegister: null, // manually registered in src/main.tsx
        devOptions: {
          // Disable PWA in dev to avoid [vite] middleware and service worker errors
          enabled: false
        },
        manifest: {
          id: "com.zomindia.app",
          name: "Zomindia",
          short_name: "Zomindia",
          description: "India's premium home service marketplace. Trusted experts for cleaning, repairs, and beauty at home in Indore.",
          start_url: "/",
          scope: "/",
          display: "standalone",
          display_override: ["standalone", "window-controls-overlay"],
          orientation: "portrait-primary",
          background_color: "#ffffff",
          theme_color: "#0a2540",
          categories: ["business", "utilities", "lifestyle"],
          dir: "ltr",
          lang: "en-US",
          prefer_related_applications: false,
          icons: [
            {
              "src": "/icon-192.png",
              "sizes": "192x192",
              "type": "image/png",
              "purpose": "any"
            },
            {
              "src": "/icon-512.png",
              "sizes": "512x512",
              "type": "image/png",
              "purpose": "any"
            },
            {
              "src": "/icon-maskable-512.png",
              "sizes": "512x512",
              "type": "image/png",
              "purpose": "maskable"
            }
          ],
          screenshots: [
            {
              "src": "/screenshot-mobile.png",
              "sizes": "1080x1920",
              "type": "image/png",
              "form_factor": "narrow",
              "label": "Zomindia Mobile Home Screen"
            },
            {
              "src": "/screenshot-desktop.png",
              "sizes": "1920x1080",
              "type": "image/png",
              "form_factor": "wide",
              "label": "Zomindia Desktop Home Screen"
            }
          ]
        }
      })
    ],
    define: {
      // Avoid exposing server secrets. Only public vars here.
      'process.env.GOOGLE_MAPS_PLATFORM_KEY': JSON.stringify(env.GOOGLE_MAPS_PLATFORM_KEY || ''),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        output: {
          manualChunks: {
            firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          }
        }
      }
    },
    server: {
      // Explicitly disable HMR to avoid websocket connection errors in this environment
      hmr: false,
      // Keep watch enabled but limit its impact
      watch: {
        ignored: ['**/node_modules/**', '**/dist/**']
      }
    },
    // Prevent vite from clearing console
    clearScreen: false,
  };
});
