import { createClient } from '@supabase/supabase-js';
import { auth } from '../firebase/config';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

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

export const supabase = createClient(
  supabaseUrl || '',
  supabaseAnonKey || '',
  useFirebaseAuth
    ? {
        // Falls back to the anon key when no user is signed in (returns null).
        accessToken: async () => {
          const user = auth.currentUser;
          return user ? await user.getIdToken() : null;
        },
      }
    : undefined,
);
