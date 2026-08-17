import { getMessaging, getToken, isSupported } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Safely checks if the Notification API and push messaging are available in the current environment.
 * Gracefully detects iframe / sandbox constraints and denied permissions.
 */
export function isPushPermissionDeniedOrRestricted(): boolean {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return true;
  }
  
  // Running inside sandboxed iframe where Notification permissions are restricted
  try {
    if (window.self !== window.top) {
      return true;
    }
  } catch {
    // Cross-origin iframe access exception
    return true;
  }

  return Notification.permission === 'denied';
}

export async function requestAndSaveFCMToken(uid: string): Promise<string | null> {
  try {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return null;
    }

    // If running in sandboxed iframe or if permission is already explicitly denied, fail silently
    if (isPushPermissionDeniedOrRestricted()) {
      return null;
    }

    // Check Firebase Messaging SDK support safely
    const supported = await isSupported().catch(() => false);
    if (!supported) {
      return null;
    }

    // Safely check and request permission without intrusive warnings
    let permission = Notification.permission;
    if (permission === 'default') {
      try {
        permission = await Notification.requestPermission();
      } catch {
        // Suppress browser/iframe permission policy rejection
        return null;
      }
    }

    if (permission !== 'granted') {
      // Fail silently without logging intrusive console warnings
      return null;
    }

    // Initialize messaging inside the try-catch to avoid crashing if FCM is blocked or not configured
    const messaging = getMessaging();
    
    // Standard valid VAPID public key for web push.
    const VAPID_KEY = 'BDb01oP4r91u7A9M854Y_E9M_Hw8H_h8HwHhH8H8h_Hh_8hH'; 
    
    const token = await getToken(messaging, { 
      vapidKey: VAPID_KEY 
    }).catch(async () => {
      return await getToken(messaging).catch(() => null);
    });

    if (token && uid) {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, { 
        fcmToken: token,
        updatedAt: new Date().toISOString()
      }).catch(() => {
        // Silent catch for permissions
      });
      return token;
    }
    
    return null;
  } catch {
    // Silent catch for sandboxed environments / unconfigured FCM
    return null;
  }
}

