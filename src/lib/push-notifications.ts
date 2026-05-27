import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';

export async function registerPushNotifications(userId: string) {
  // Only execute on native platforms (iOS / Android)
  if (!Capacitor.isNativePlatform()) {
    console.log('[Push] Skipping push notification setup - not running on a native device (Web/PWA client).');
    return;
  }

  try {
    let permStatus = await PushNotifications.checkPermissions();
    
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      console.warn('[Push] Push notification permissions were denied.');
      return;
    }

    // Register with Apple / Google Push Services
    await PushNotifications.register();

    // Listen for register success and save FCM token to user document
    await PushNotifications.addListener('registration', async (token) => {
      console.log('[Push] Mobile device token registered successfully:', token.value);
      try {
        await updateDoc(doc(db, 'users', userId), {
          fcmToken: token.value,
          fcmTokens: arrayUnion(token.value), // keep track of multiple devices if needed
          updatedAt: new Date()
        });
        console.log('[Push] Token synced to Firestore for user:', userId);
      } catch (err) {
        console.error('[Push] Failed to save device token to users collection:', err);
      }
    });

    // Listen for register error
    await PushNotifications.addListener('registrationError', (error) => {
      console.error('[Push] Registration error:', JSON.stringify(error));
    });

    // Handle incoming notifications while app is in foreground
    await PushNotifications.addListener('pushNotificationReceived', (notification) => {
      console.log('[Push] Push received in foreground:', notification);
    });

    // Handle action performed on push notifications
    await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
      console.log('[Push] Push action performed:', notification);
    });

  } catch (e) {
    console.error('[Push] Error in registering push notifications:', e);
  }
}
