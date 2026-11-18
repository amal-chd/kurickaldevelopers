import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

export const FIREBASE_DEFAULTS = {
  apiKey: 'AIzaSyBV7Ju3tnee5BrG_64V6YravVjb-OCI68A',
  authDomain: 'kurikal-tms-app.firebaseapp.com',
  databaseURL: 'https://kurikal-tms-app-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'kurikal-tms-app',
  storageBucket: 'kurikal-tms-app.firebasestorage.app',
  messagingSenderId: '1081889029959',
  appId: '1:1081889029959:web:66bcdcc86ffeaf07301662',
  measurementId: '',
} as const;

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || FIREBASE_DEFAULTS.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || FIREBASE_DEFAULTS.authDomain,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || FIREBASE_DEFAULTS.databaseURL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || FIREBASE_DEFAULTS.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || FIREBASE_DEFAULTS.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || FIREBASE_DEFAULTS.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || FIREBASE_DEFAULTS.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || FIREBASE_DEFAULTS.measurementId,
};

// Reuse an existing app instance if one already exists (guards against
// duplicate initialization from HMR / re-imports, which can otherwise lead to
// "Firebase App ... already deleted/exists" errors).
export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);

// Configure local persistence to survive browser close/refresh
setPersistence(auth, browserLocalPersistence).catch((err) => {
  console.error('Failed to set auth persistence:', err);
});

// ignoreUndefinedProperties lets writes omit `undefined` fields instead of
// throwing "Unsupported field value: undefined" — e.g. a chat message with no
// reply, or a task with no due date. initializeFirestore must run once before
// any other Firestore use; fall back to getFirestore on HMR re-import.
export const db = (() => {
  try {
    return initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch {
    return getFirestore(app);
  }
})();

export const storage = getStorage(app);
