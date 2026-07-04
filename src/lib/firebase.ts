import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, memoryLocalCache, doc, getDocFromServer } from 'firebase/firestore';
import { offlineSyncEngine } from './offlineQueue';
import fallbackConfig from '../../firebase-applet-config.json';

// Construct firebase configuration with dynamic Vite environment variables, falling back to JSON configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || fallbackConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || fallbackConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || fallbackConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || fallbackConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || fallbackConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || fallbackConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || fallbackConfig.measurementId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || (fallbackConfig as any).firestoreDatabaseId || 'ai-studio-bc834479-53a0-46d8-936d-a07da1f344fc'
};

const app = initializeApp(firebaseConfig);

// Initialize Firestore with memory local cache to guarantee fresh live data from the single Firestore instance
export const db = initializeFirestore(app, {
  databaseId: firebaseConfig.firestoreDatabaseId,
  localCache: memoryLocalCache(),
  experimentalForceLongPolling: true,
} as any);

offlineSyncEngine.setDb(db);

export const auth = getAuth(app);

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
