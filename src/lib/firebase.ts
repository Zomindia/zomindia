import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { offlineSyncEngine } from './offlineQueue';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

offlineSyncEngine.setDb(db);

// Connection Test with graceful error reporting after connection stabilizes
async function testConnection() {
  try {
    // Attempting to reach the Cloud Firestore backend to verify state
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test: SUCCESS");
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('offline') || error.message.includes('unavailable') || error.message.includes('Could not reach')) {
        console.warn("Firestore connection: Offline mode activated (using local persistent cache).");
      } else {
        console.error("Firestore connection tested, please check Firebase configuration:", error.message);
      }
    } else {
      console.error("Firestore connection test: FAILED", error);
    }
  }
}

// Delay the initial connection check so that background network/WS setup completes first,
// preventing false alarms during initial bundle execution.
setTimeout(() => {
  testConnection().catch(console.error);
}, 3000);
