import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// Using standard getFirestore with databaseId from config
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || '(default)');
export const auth = getAuth(app);

// Connection Test with better error reporting
async function testConnection() {
  try {
    // Attempting to reach the server to verify config
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore connection test: SUCCESS");
  } catch (error) {
    console.error("Firestore connection test: FAILED", error);
    // We don't throw here to avoid crashing the whole module load, 
    // but the app might still fail later if it relies on DB.
  }
}

// Initializing connection test to help debug in console
testConnection().catch(console.error);
