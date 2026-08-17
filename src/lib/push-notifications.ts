import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from './firebase';
import { requestAndSaveFCMToken } from './fcm';

export async function registerPushNotifications(userId: string) {
  // Only execute on native platforms (iOS / Android)
  if (!Capacitor.isNativePlatform()) {
    await requestAndSaveFCMToken(userId);
    return;
  }

  try {
    let permStatus = await PushNotifications.checkPermissions().catch(() => null);
    if (!permStatus) return;
    
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions().catch(() => null);
    }

    if (!permStatus || permStatus.receive !== 'granted') {
      return;
    }

    // Register with Apple / Google Push Services
    await PushNotifications.register().catch(() => {});

    // Listen for register success and save FCM token to user document
    await PushNotifications.addListener('registration', async (token) => {
      try {
        await updateDoc(doc(db, 'users', userId), {
          fcmToken: token.value,
          fcmTokens: arrayUnion(token.value), // keep track of multiple devices if needed
          updatedAt: new Date()
        }).catch(() => {});
      } catch {
        // Silent catch
      }
    });

    // Listen for register error
    await PushNotifications.addListener('registrationError', () => {});

    // Handle incoming notifications while app is in foreground
    await PushNotifications.addListener('pushNotificationReceived', () => {});

    // Handle action performed on push notifications
    await PushNotifications.addListener('pushNotificationActionPerformed', () => {});

  } catch {
    // Silent catch
  }
}

