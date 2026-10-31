import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

dotenv.config({ override: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Defensively guard against Firestore ca9 internal assertion failure in WebChannel long-polling
function patchFirestorePlugin(): Plugin {
  return {
    name: 'patch-firestore-ca9',
    transform(code: string, id: string) {
      if (id.includes('@firebase/firestore') || id.includes('firebase/firestore') || id.includes('firebase_firestore')) {
        let changed = false;
        let updated = code;
        if (code.includes('3241') && code.includes('this.ve')) {
          updated = updated.replace(
            /this\.ve\s*-=\s*1\s*,\s*__PRIVATE_hardAssert\(\s*this\.ve\s*>=\s*0\s*,\s*3241\s*,\s*\{\s*ve:\s*this\.ve\s*\}\s*\);?/g,
            'if (this.ve <= 0) { this.ve = 0; return; } this.ve -= 1;'
          );
          changed = true;
        }
        if (code.includes('0x0ca9') && code.includes('this.pendingResponses')) {
          updated = updated.replace(
            /this\.pendingResponses\s*-=\s*1\s*;\s*hardAssert\(\s*this\.pendingResponses\s*>=\s*0\s*,\s*0x0ca9\s*,\s*\{\s*pendingResponses:\s*this\.pendingResponses\s*\}\s*\);?/g,
            'if (this.pendingResponses <= 0) { this.pendingResponses = 0; return; } this.pendingResponses -= 1;'
          );
          changed = true;
        }
        if (changed) {
          return { code: updated, map: null };
        }
      }
      return null;
    }
  };
}

export default defineConfig(({ mode }) => {
  dotenv.config({ override: true });
  const env = loadEnv(mode, '.', '');
  const resolvedRazorpayKeyId = (process.env.RAZORPAY_KEY_ID || process.env.VITE_RAZORPAY_KEY_ID || env.RAZORPAY_KEY_ID || env.VITE_RAZORPAY_KEY_ID || '').trim();

  return {
    plugins: [
      patchFirestorePlugin(),
      react(),
      tailwindcss(),
      VitePWA({
        strategies: 'injectManifest',
        srcDir: 'public',
        filename: 'sw.js',
        injectRegister: null, // manually registered in src/main.tsx
        injectManifest: {
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        },
        devOptions: {
          // Disable PWA in dev to avoid [vite] middleware and service worker errors
          enabled: false
        },
        manifest: {
          id: "com.zomindia.twa",
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
              "src": "/pwa-512x512.png?v=2",
              "sizes": "192x192",
              "type": "image/png",
              "purpose": "any"
            },
            {
              "src": "/pwa-512x512.png?v=2",
              "sizes": "512x512",
              "type": "image/png",
              "purpose": "any"
            },
            {
              "src": "/pwa-512x512.png?v=2",
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
      'import.meta.env.VITE_RAZORPAY_KEY_ID': JSON.stringify(resolvedRazorpayKeyId),
      'process.env.VITE_RAZORPAY_KEY_ID': JSON.stringify(resolvedRazorpayKeyId),
      'process.env.RAZORPAY_KEY_ID': JSON.stringify(resolvedRazorpayKeyId),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
      dedupe: [
        'react',
        'react-dom',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        'react-is',
        'use-sync-external-store'
      ],
    },
    optimizeDeps: {
      include: [
        'react',
        'react-dom',
        'react-dom/client',
        'react/jsx-runtime',
        'react/jsx-dev-runtime',
        '@vis.gl/react-google-maps',
        'lucide-react',
        'motion/react',
        'firebase/app',
        'firebase/auth',
        'firebase/firestore',
        'firebase/storage',
        'recharts',
        'react-redux',
        'use-sync-external-store'
      ],
    },
    assetsInclude: ['**/*.mp3', '**/*.wav', '**/*.woff2', '**/*.ttf'],
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      chunkSizeWarningLimit: 2000,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/firebase')) {
              return 'firebase';
            }
            if (id.includes('node_modules/jspdf') || id.includes('node_modules/pdfkit') || id.includes('node_modules/html2canvas')) {
              return 'pdf-vendor';
            }
            if (id.includes('node_modules/recharts')) {
              return 'charts';
            }
            if (id.includes('node_modules/lucide-react')) {
              return 'lucide-icons';
            }
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
