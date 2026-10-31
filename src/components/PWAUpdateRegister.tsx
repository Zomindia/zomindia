import { useEffect } from 'react';
import { registerSW } from 'virtual:pwa-register';

export function PWAUpdateRegister() {
  useEffect(() => {
    try {
      registerSW({
        immediate: true,
        onNeedRefresh() {
          // Silent background skipWaiting without showing any popup to user
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.getRegistrations().then((regs) => {
              regs.forEach((reg) => reg.waiting?.postMessage({ type: 'SKIP_WAITING' }));
            });
          }
        }
      });
    } catch {}
  }, []);

  return null;
}

export default PWAUpdateRegister;
