import {
  getAnalytics,
  isSupported,
  logEvent,
  setUserId,
  setUserProperties,
  type Analytics,
} from 'firebase/analytics';
import { app } from '../firebase/config';

// Web product analytics via Firebase Analytics — the counterpart to the mobile
// app's firebase_analytics. Initializes only in production and only when a
// measurementId is configured and the environment supports it (some privacy
// modes / SSR do not). A no-op otherwise, so dev and tests are unaffected.

let analytics: Analytics | null = null;

export async function initAnalytics(): Promise<void> {
  if (!import.meta.env.VITE_FIREBASE_MEASUREMENT_ID) return;
  if (!import.meta.env.PROD) return;
  try {
    if (await isSupported()) analytics = getAnalytics(app);
  } catch {
    /* analytics unavailable in this environment — ignore */
  }
}

/** Log a product event, e.g. track('task_created', { project_id }). */
export function track(event: string, params?: Record<string, unknown>): void {
  if (analytics) logEvent(analytics, event, params as Record<string, unknown>);
}

/** Associate events with the signed-in user (id + role), or clear on logout. */
export function identify(
  user: { id: string; roleId?: string } | null,
): void {
  if (!analytics) return;
  setUserId(analytics, user?.id ?? null);
  if (user?.roleId) setUserProperties(analytics, { role: user.roleId });
}
