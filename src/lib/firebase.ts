import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  doc,
  getDocFromServer,
  setLogLevel,
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { offlineSyncEngine } from './offlineQueue';
import firebaseConfig from '../../firebase-applet-config.json';

const resolvedConfig = {
  ...firebaseConfig,
  authDomain: (firebaseConfig as any).authDomain || "zomindia-807ce.firebaseapp.com",
};

const app = getApps().length === 0 ? initializeApp(resolvedConfig) : getApp();

export const FIRESTORE_DB_ID = 'ai-studio-bc834479-53a0-46d8-936d-a07da1f344fc';
export const FIRESTORE_DATABASE_ID = FIRESTORE_DB_ID;

// Set log level to silent to prevent benign connection warning spam in sandboxed iframe environments
try {
  setLogLevel('silent');
} catch {
  // Ignore if unsupported
}

// Initialize Firestore with experimentalForceLongPolling to avoid failed WebSocket handshakes in iframe environments
let firestoreDb;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    },
    FIRESTORE_DB_ID
  );
} catch (e1) {
  try {
    // If persistentLocalCache fails (e.g. IndexedDB restricted in cross-origin iframe), try memory cache with force long polling
    firestoreDb = initializeFirestore(
      app,
      {
        experimentalForceLongPolling: true,
        localCache: memoryLocalCache(),
      },
      FIRESTORE_DB_ID
    );
  } catch {
    firestoreDb = getFirestore(app, FIRESTORE_DB_ID);
  }
}

export { app };
export const db = firestoreDb;
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});
export const storage = getStorage(app);

offlineSyncEngine.setDb(db);

// Connection Test with graceful handling
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message.includes('offline') ||
        error.message.includes('unavailable') ||
        error.message.includes('Could not reach') ||
        error.message.includes('Failed to get document because the client is offline') ||
        error.message.includes('INTERNAL ASSERTION FAILED')
      ) {
        // Expected behavior when offline or waiting for initial handshake in sandbox
      } else {
        console.warn("Firestore connection notice:", error.message);
      }
    }
  }
}

// Perform connection verification
setTimeout(() => {
  testConnection().catch(() => {});
}, 3000);

