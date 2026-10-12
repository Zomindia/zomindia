import { useEffect } from 'react';
import { registerPushNotifications } from '../lib/push-notifications';

export function usePushNotifications(userId?: string) {
  useEffect(() => {
    if (!userId) return;
    try {
      registerPushNotifications(userId).catch((err) => {
        console.warn('[Push Notification Native Bypass]:', err);
      });
    } catch (err) {
      console.warn('[Push Notification Native Bypass]:', err);
    }
  }, [userId]);
}

export default usePushNotifications;
