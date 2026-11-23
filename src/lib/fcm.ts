import { getMessaging, getToken, onMessage, isSupported } from 'firebase/messaging';
import { doc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { app, db } from '../firebase/config';

// Web Push needs a VAPID key (Firebase Console → Project Settings → Cloud
// Messaging → Web Push certificates → "Key pair"). Until it's set, web push
// is disabled gracefully — in-app notifications still work.
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined;

// Track which uid this browser's token is registered to, so signing out and
// back in as a DIFFERENT user re-registers the token on the new user's doc
// (otherwise pushes would keep going to the previous account).
let _registeredUid: string | null = null;

/**
 * Registers this browser for FCM push and stores its token on the user doc so
 * the serverless sender (Supabase Edge Function) can reach it. Safe to call on every
 * login — it no-ops when unsupported, unconfigured, or permission is denied.
 */
export async function registerFcm(uid: string): Promise<void> {
  try {
    if (_registeredUid === uid || !uid || !VAPID_KEY) return;
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (!('serviceWorker' in navigator)) return;
    if (!(await isSupported())) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // Pass the public Firebase config to the service worker via query string.
    const cfg = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? '',
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '',
    };
    const qs = new URLSearchParams(cfg).toString();
    const registration = await navigator.serviceWorker.register(
      `/firebase-messaging-sw.js?${qs}`,
    );

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (token) {
      await setDoc(doc(db, 'users', uid), { fcmToken: token }, { merge: true });
      _registeredUid = uid;
    }

    // Foreground messages don't fire the SW handler — surface them as a toast.
    onMessage(messaging, (payload) => {
      const n = payload.notification;
      if (n?.title) toast(`${n.title}${n.body ? ` — ${n.body}` : ''}`, { icon: '🔔' });
    });
  } catch (err) {
    console.warn('FCM registration failed (push disabled):', err);
  }
}

/**
 * Best-effort: detach this browser's push token from the user doc on logout,
 * so a shared device doesn't keep receiving the previous user's notifications.
 */
export async function clearFcmToken(uid: string): Promise<void> {
  try {
    if (!uid) return;
    await setDoc(doc(db, 'users', uid), { fcmToken: '' }, { merge: true });
    _registeredUid = null;
  } catch {
    // Non-fatal — token cleanup must never block sign-out.
  }
}
