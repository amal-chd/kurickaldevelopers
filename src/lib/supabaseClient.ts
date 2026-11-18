import { createClient } from '@supabase/supabase-js';
import { auth } from '../firebase/config';
import { getActiveOrgId } from './tenant';

export const SUPABASE_DEFAULTS = {
  url: 'https://ximaqbhnykyxxgiqbwoh.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhpbWFxYmhueWt5eHhnaXFid29oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3ODAyMzgsImV4cCI6MjA5NzM1NjIzOH0.5ZfmFsCt6VTNIQfESq5EAg9R8CxUl__NnKhwh8GSYKg',
} as const;

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || SUPABASE_DEFAULTS.url;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || SUPABASE_DEFAULTS.anonKey;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase credentials missing!");
}

// ─────────────────────────────────────────────────────────────────────────────
//  Firebase → Supabase auth bridge (OFF by default).
//
//  The app signs in with Firebase, so Supabase can only enforce per-user RLS if
//  every request carries the Firebase ID token. When this flag is enabled, the
//  Supabase client attaches `auth.currentUser.getIdToken()` on every request and
//  RLS policies can read the Firebase uid via `auth.jwt()->>'sub'`.
//
//  ⚠️ Enable this ONLY AFTER Firebase is registered as a Third-Party Auth
//  provider in the Supabase dashboard. Turning it on before that makes Supabase
//  reject the (unrecognised) token → every request 401s. Until then, leave
//  VITE_SUPABASE_FIREBASE_AUTH unset so the client keeps using the anon key.
// ─────────────────────────────────────────────────────────────────────────────
const useFirebaseAuth = import.meta.env.VITE_SUPABASE_FIREBASE_AUTH === 'true';

// Every REST/storage request carries the active organisation. RLS
// (public.current_org_id()) scopes tenant tables to it; without the header the
// database treats the caller as the legacy workspace, so old builds keep
// working unchanged.
const tenantFetch: typeof fetch = (input, init = {}) => {
  const headers = new Headers(init.headers ?? (input instanceof Request ? input.headers : undefined));
  headers.set('x-org-id', getActiveOrgId());
  return fetch(input, { ...init, headers });
};

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  {
    global: { fetch: tenantFetch },
    ...(useFirebaseAuth
      ? {
          // Falls back to the anon key when no user is signed in (returns null).
          accessToken: async () => {
            const user = auth.currentUser;
            return user ? await user.getIdToken() : null;
          },
        }
      : {}),
  },
);
