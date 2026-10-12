import { useEffect } from 'react';
import { registerPushNotifications } from '../lib/push-notifications';
import { Telemetry } from '../services/telemetry';

export function usePushNotifications(userId?: string) {
  useEffect(() => {
    if (!userId) return;

    Telemetry.addBreadcrumb('native', 'Push notifications registration triggered', { userId });

    try {
      registerPushNotifications(userId).catch((err) => {
        console.warn('[Push Notification Native Bypass]:', err);
        Telemetry.addBreadcrumb('native', 'Push registration rejected gracefully', {
          error: String(err?.message || err),
        });
      });
    } catch (err: any) {
      console.warn('[Push Notification Native Bypass]:', err);
      Telemetry.addBreadcrumb('native', 'Push registration threw exception', {
        error: String(err?.message || err),
      });
    }
  }, [userId]);
}

export default usePushNotifications;
