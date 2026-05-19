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
        registerType: 'autoUpdate',
        devOptions: {
          // Disable PWA in dev to avoid [vite] middleware and service worker errors
          enabled: false
        },
        manifest: {
          name: 'Zomindia',
          short_name: 'Zomindia',
          description: 'India\'s premium service marketplace',
          theme_color: '#050ca6',
          background_color: '#ffffff',
          display: 'standalone',
          icons: [
            {
              src: '/icon.svg',
              sizes: 'any',
              type: 'image/svg+xml'
            },
            {
              src: '/icon.svg',
              sizes: '192x192',
              type: 'image/svg+xml'
            },
            {
              src: '/icon.svg',
              sizes: '512x512',
              type: 'image/svg+xml'
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
    logLevel: 'silent',
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
