import * as Sentry from '@sentry/react';

// Web error/performance monitoring. The mobile app already reports through
// Crashlytics; this closes the same gap on the web. It is a NO-OP until a DSN is
// configured, so the app behaves identically in dev and needs zero code changes
// to activate later:
//
//   1. Create a Sentry project (React) → copy the DSN.
//   2. Add VITE_SENTRY_DSN=<dsn> to the deploy env (and CI build secrets).
//
// The DSN is a client-side publishable value, safe to expose in the bundle.

let enabled = false;

export function initMonitoring(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
    // Only report from real deployments, never local dev.
    enabled: import.meta.env.PROD,
  });
  enabled = import.meta.env.PROD;
}

/** Attach the signed-in user so every error carries who/which-role context. */
export function setMonitoringUser(
  user: { id: string; email?: string; roleId?: string } | null,
): void {
  if (!enabled) return;
  Sentry.setUser(user ? { id: user.id, email: user.email } : null);
  if (user?.roleId) Sentry.setTag('role', user.roleId);
}

/** Manually report a handled error with optional context. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  if (!enabled) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
