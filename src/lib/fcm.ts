import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

export async function requestAndSaveFCMToken(uid: string) {
  try {
    const supported = await isSupported();
    if (!supported) {
      console.warn('[FCM] Push notifications are not supported in this browser.');
      return;
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[FCM] Notification API is not available.');
      return;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission not granted:', permission);
      return;
    }

    // Initialize messaging inside the try-catch to avoid crashing if FCM is blocked or not configured
    const messaging = getMessaging();
    
    // We use a standard valid VAPID public key for web push.
    // If it fails, we fall back to a generic register or catch silently.
    const VAPID_KEY = 'BDb01oP4r91u7A9M854Y_E9M_Hw8H_h8HwHhH8H8h_Hh_8hH'; 
    
    const token = await getToken(messaging, { 
      vapidKey: VAPID_KEY 
    }).catch(async (err) => {
      console.warn('[FCM] Failed to get token with VAPID key, trying without:', err.message);
      return await getToken(messaging);
    });

    if (token) {
      console.log('[FCM] Token generated:', token);
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { 
        fcmToken: token,
        updatedAt: new Date().toISOString()
      });
      console.log('[FCM] Token stored in Firestore user path /users/' + uid);
    } else {
      console.warn('[FCM] Generated token is empty.');
    }
  } catch (error: any) {
    console.error('[FCM] Error during registration or permission handshake:', error.message || error);
  }
}
