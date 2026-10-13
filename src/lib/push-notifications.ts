import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { requestAndSaveFCMToken } from './fcm';
import { Telemetry } from '../services/telemetry';

export async function registerPushNotifications(userId: string): Promise<void> {
  try {
    // Only execute FCM on web platforms
    if (!Capacitor.isNativePlatform()) {
      try {
        Telemetry.addBreadcrumb('native', 'Web push registration initiated');
        await requestAndSaveFCMToken(userId);
      } catch (err: any) {
        console.warn('[Push Notification Bypass]: Web FCM registration bypassed:', err);
        Telemetry.addBreadcrumb('native', 'Web FCM registration notice', { error: err?.message || String(err) });
      }
      return;
    }

    // NATIVE PLATFORM (Android / iOS):
    // Neutralize Native Push Notification Registration:
    // Calling PushNotifications.register() crashes in native layer on Android APK when FCM/google-services is not configured natively.
    // Instead: we safely query/request permissions, save the status in localStorage, and strictly DO NOT invoke PushNotifications.register().
    Telemetry.addBreadcrumb('native', 'Capacitor native push handler executing (safe bypass mode)', {
      platform: Capacitor.getPlatform(),
    });

    // Check if the PushNotifications native plugin is available
    if (!Capacitor.isPluginAvailable('PushNotifications')) {
      console.warn('[Push Notification Native Bypass]: PushNotifications plugin not available on this platform.');
      Telemetry.addBreadcrumb('native', 'PushNotifications plugin not available on native platform');
      return;
    }

    let permStatus: { receive: string } | null = null;
    try {
      permStatus = await PushNotifications.checkPermissions();
      Telemetry.addBreadcrumb('native', `Push checkPermissions status: ${permStatus?.receive}`);
    } catch (err: any) {
      console.warn('[Push Notification Native Bypass]: checkPermissions safely caught:', err);
      Telemetry.addBreadcrumb('native', 'Push checkPermissions error', { error: err?.message || String(err) });
    }

    if (permStatus?.receive === 'prompt') {
      try {
        permStatus = await PushNotifications.requestPermissions();
        Telemetry.addBreadcrumb('native', `Push requestPermissions outcome: ${permStatus?.receive}`);
      } catch (err: any) {
        console.warn('[Push Notification Native Bypass]: requestPermissions safely caught:', err);
        Telemetry.addBreadcrumb('native', 'Push requestPermissions error', { error: err?.message || String(err) });
      }
    }

    const currentStatus = permStatus?.receive || 'default';
    try {
      localStorage.setItem('notification_permission_status', currentStatus);
    } catch (storageErr) {
      console.warn('[Push Notification Native Bypass]: Failed saving permission status to localStorage', storageErr);
    }

    Telemetry.addBreadcrumb('native', `Notification permission recorded: ${currentStatus}. Native PushNotifications.register() safely neutralized.`);
    console.info(`[Push Notification Native Bypass]: Notification permission is ${currentStatus}. Native register() bypassed to prevent crashes.`);
  } catch (err: any) {
    // Top-level fail-safe: never throw or bubble up any exception to prevent app crash
    console.warn('[Push Notification Native Bypass]: Top-level safe catch:', err);
    Telemetry.addBreadcrumb('native', 'Push notification unexpected native error safely suppressed', { error: err?.message || String(err) });
  }
}

