import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence, type Auth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

export const isFirebaseConfigured = Boolean(firebaseConfig.apiKey);

// Reuse an existing app instance if one already exists (guards against
// duplicate initialization from HMR / re-imports, which can otherwise lead to
// "Firebase App ... already deleted/exists" errors).
// Skip initialization when VITE_FIREBASE_API_KEY is unset so public pages
// (/login, /policy, /terms) still render instead of crashing at module load.
export const app: FirebaseApp = isFirebaseConfigured
  ? (getApps().length ? getApp() : initializeApp(firebaseConfig))
  : (null as unknown as FirebaseApp);

export const auth: Auth = isFirebaseConfigured
  ? getAuth(app)
  : (null as unknown as Auth);

if (isFirebaseConfigured) {
  // Configure local persistence to survive browser close/refresh
  setPersistence(auth, browserLocalPersistence).catch((err) => {
    console.error('Failed to set auth persistence:', err);
  });
} else {
  console.warn('Firebase configuration missing (VITE_FIREBASE_API_KEY). Authentication is disabled.');
}

// ignoreUndefinedProperties lets writes omit `undefined` fields instead of
// throwing "Unsupported field value: undefined" — e.g. a chat message with no
// reply, or a task with no due date. initializeFirestore must run once before
// any other Firestore use; fall back to getFirestore on HMR re-import.
export const db: Firestore = isFirebaseConfigured
  ? (() => {
      try {
        return initializeFirestore(app, {
          ignoreUndefinedProperties: true,
          localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        });
      } catch {
        return getFirestore(app);
      }
    })()
  : (null as unknown as Firestore);

export const storage: FirebaseStorage = isFirebaseConfigured
  ? getStorage(app)
  : (null as unknown as FirebaseStorage);
