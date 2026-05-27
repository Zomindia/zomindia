import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Initialize Firestore with persistent offline local cache for extreme reliability
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
}, firebaseConfig.firestoreDatabaseId || '(default)');

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
