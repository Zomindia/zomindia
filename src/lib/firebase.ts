import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDocFromServer,
  setLogLevel,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { offlineSyncEngine } from './offlineQueue';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Set log level to prevent benign connection warning spam in sandboxed iframe environments
setLogLevel('error');

// Initialize Firestore with auto-detect long polling and multi-tab persistent cache
let firestoreDb;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    firebaseConfig.firestoreDatabaseId
  );
} catch {
  firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

export const db = firestoreDb;
export const auth = getAuth(app);
export const storage = getStorage(app);

offlineSyncEngine.setDb(db);

// Connection Test with graceful handling
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test: SUCCESS");
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('offline') ||
        error.message.includes('unavailable') ||
        error.message.includes('Could not reach') ||
        error.message.includes('Failed to get document because the client is offline')
      ) {
        console.warn("Firestore: Operating with offline cache until connection is established.");
      } else {
        console.error("Firestore connection notice:", error.message);
      }
    }
  }
}

// Perform connection verification
setTimeout(() => {
  testConnection().catch(() => {});
}, 3000);

