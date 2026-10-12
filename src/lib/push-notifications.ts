import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { requestAndSaveFCMToken } from './fcm';

export async function registerPushNotifications(userId: string): Promise<void> {
  // Only execute on native platforms (iOS / Android)
  if (!Capacitor.isNativePlatform()) {
    try {
      await requestAndSaveFCMToken(userId);
    } catch (err) {
      console.warn('[Push Notification Native Bypass]: Web FCM registration bypassed:', err);
    }
    return;
  }

  try {
    // Check if the PushNotifications native plugin is available and configured
    if (!Capacitor.isPluginAvailable('PushNotifications')) {
      console.warn('[Push Notification Native Bypass]: PushNotifications plugin not available on this platform.');
      return;
    }

    let permStatus = null;
    try {
      permStatus = await PushNotifications.checkPermissions();
    } catch (err) {
      console.warn('[Push Notification Native Bypass]: checkPermissions error:', err);
      return;
    }

    if (permStatus?.receive === 'prompt') {
      try {
        permStatus = await PushNotifications.requestPermissions();
      } catch (err) {
        console.warn('[Push Notification Native Bypass]: requestPermissions error:', err);
        return;
      }
    }

    if (!permStatus || permStatus.receive !== 'granted') {
      console.warn('[Push Notification Native Bypass]: Push notification permissions not granted.');
      return;
    }

    // Register with Apple / Google Push Services
    try {
      await PushNotifications.register();
    } catch (err) {
      console.warn('[Push Notification Native Bypass]: PushNotifications.register() error (likely missing or unconfigured google-services.json):', err);
      return;
    }

    // Listen for register success and save FCM token to user document
    try {
      await PushNotifications.addListener('registration', async (token) => {
        try {
          if (token && token.value) {
            await updateDoc(doc(db, 'users', userId), {
              fcmToken: token.value,
              fcmTokens: arrayUnion(token.value),
              updatedAt: new Date()
            });
          }
        } catch (err) {
          console.warn('[Push Notification Native Bypass]: Error updating user fcmToken in Firestore:', err);
        }
      });
    } catch (err) {
      console.warn('[Push Notification Native Bypass]: addListener(registration) error:', err);
    }

    // Listen for register error
    try {
      await PushNotifications.addListener('registrationError', (err) => {
        console.warn('[Push Notification Native Bypass]: Registration error received from native push service:', err);
      });
    } catch (err) {
      console.warn('[Push Notification Native Bypass]: addListener(registrationError) error:', err);
    }

    // Handle incoming notifications while app is in foreground
    try {
      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[Push Notification Received]:', notification);
      });
    } catch (err) {
      console.warn('[Push Notification Native Bypass]: addListener(pushNotificationReceived) error:', err);
    }

    // Handle action performed on push notifications
    try {
      await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        console.log('[Push Notification Action Performed]:', action);
      });
    } catch (err) {
      console.warn('[Push Notification Native Bypass]: addListener(pushNotificationActionPerformed) error:', err);
    }

  } catch (err) {
    console.warn('[Push Notification Native Bypass]:', err);
  }
}
