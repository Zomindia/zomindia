import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { requestAndSaveFCMToken } from './fcm';
import { Telemetry } from '../services/telemetry';

export async function registerPushNotifications(userId: string): Promise<void> {
  // Only execute on native platforms (iOS / Android)
  if (!Capacitor.isNativePlatform()) {
    try {
      Telemetry.addBreadcrumb('native', 'Web push registration initiated');
      await requestAndSaveFCMToken(userId);
    } catch (err: any) {
      console.warn('[Push Notification Native Bypass]: Web FCM registration bypassed:', err);
      Telemetry.addBreadcrumb('native', 'Web FCM registration notice', { error: err?.message || String(err) });
    }
    return;
  }

  try {
    Telemetry.addBreadcrumb('native', 'Capacitor native push registration starting', {
      platform: Capacitor.getPlatform(),
    });

    // Check if the PushNotifications native plugin is available and configured
    if (!Capacitor.isPluginAvailable('PushNotifications')) {
      console.warn('[Push Notification Native Bypass]: PushNotifications plugin not available on this platform.');
      Telemetry.addBreadcrumb('native', 'PushNotifications plugin not available on native platform');
      return;
    }

    let permStatus = null;
    try {
      permStatus = await PushNotifications.checkPermissions();
      Telemetry.addBreadcrumb('native', `Push checkPermissions status: ${permStatus?.receive}`);
    } catch (err: any) {
      console.warn('[Push Notification Native Bypass]: checkPermissions error:', err);
      Telemetry.addBreadcrumb('native', 'Push checkPermissions error', { error: err?.message || String(err) });
      return;
    }

    if (permStatus?.receive === 'prompt') {
      try {
        permStatus = await PushNotifications.requestPermissions();
        Telemetry.addBreadcrumb('native', `Push requestPermissions outcome: ${permStatus?.receive}`);
      } catch (err: any) {
        console.warn('[Push Notification Native Bypass]: requestPermissions error:', err);
        Telemetry.addBreadcrumb('native', 'Push requestPermissions error', { error: err?.message || String(err) });
        return;
      }
    }

    if (!permStatus || permStatus.receive !== 'granted') {
      console.warn('[Push Notification Native Bypass]: Push notification permissions not granted.');
      Telemetry.addBreadcrumb('native', 'Push permissions denied or dismissed');
      return;
    }

    // Register with Apple / Google Push Services
    try {
      await PushNotifications.register();
      Telemetry.addBreadcrumb('native', 'PushNotifications.register() invoked successfully');
    } catch (err: any) {
      console.warn('[Push Notification Native Bypass]: PushNotifications.register() error (likely missing or unconfigured google-services.json):', err);
      Telemetry.addBreadcrumb('native', 'PushNotifications.register() native bridge bypass', { error: err?.message || String(err) });
      return;
    }

    // Listen for register success and save FCM token to user document
    try {
      await PushNotifications.addListener('registration', async (token) => {
        try {
          if (token && token.value) {
            Telemetry.addBreadcrumb('native', 'Native FCM token obtained');
            await updateDoc(doc(db, 'users', userId), {
              fcmToken: token.value,
              fcmTokens: arrayUnion(token.value),
              updatedAt: new Date()
            });
          }
        } catch (err: any) {
          console.warn('[Push Notification Native Bypass]: Error updating user fcmToken in Firestore:', err);
          Telemetry.addBreadcrumb('native', 'Failed updating fcmToken in Firestore', { error: err?.message || String(err) });
        }
      });
    } catch (err: any) {
      console.warn('[Push Notification Native Bypass]: addListener(registration) error:', err);
    }

    // Listen for register error
    try {
      await PushNotifications.addListener('registrationError', (err) => {
        console.warn('[Push Notification Native Bypass]: Registration error received from native push service:', err);
        Telemetry.addBreadcrumb('native', 'Push registrationError received', { error: String(err?.error || err) });
      });
    } catch (err: any) {
      console.warn('[Push Notification Native Bypass]: addListener(registrationError) error:', err);
    }

    // Handle incoming notifications while app is in foreground
    try {
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        Telemetry.addBreadcrumb('native', `Push received in foreground: ${notification?.title || 'Notification'}`);
      });
    } catch (err: any) {
      console.warn('[Push Notification Native Bypass]: addListener(pushNotificationReceived) error:', err);
    }

    // Handle action performed on push notifications
    try {
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        Telemetry.addBreadcrumb('native', `Push action clicked: ${action?.actionId || 'default'}`);
      });
    } catch (err: any) {
      console.warn('[Push Notification Native Bypass]: addListener(pushNotificationActionPerformed) error:', err);
    }

  } catch (err: any) {
    console.warn('[Push Notification Native Bypass]:', err);
    Telemetry.addBreadcrumb('native', 'Push notification unexpected native error', { error: err?.message || String(err) });
  }
}
