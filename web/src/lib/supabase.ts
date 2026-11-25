import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Supabase is used ONLY as the storage backend (chat file uploads + documents).
// Authentication and the database stay on Firebase. The client therefore runs
// unauthenticated (anon key); bucket policies must allow the required access.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Storage bucket names — create these in the Supabase dashboard.
export const STORAGE_BUCKETS = {
  documents: 'documents',
  chatFiles: 'chat-files',
} as const;

let _client: SupabaseClient | null = null;

/** Returns the shared Supabase client, or null if storage isn't configured. */
export function getSupabase(): SupabaseClient | null {
  if (_client) return _client;
  if (!supabaseUrl || !supabaseAnonKey) {
    console.warn(
      '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set — file uploads are disabled.',
    );
    return null;
  }
  _client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

export const isStorageConfigured = (): boolean =>
  !!supabaseUrl && !!supabaseAnonKey;
