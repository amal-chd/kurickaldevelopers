# Supabase RLS Hardening — Cutover Runbook

**Goal:** close the security hole where every table has `Allow all for anon` (anyone
with the public anon key can read/write all data) — while the app authenticates
with **Firebase**, not Supabase Auth.

**Approach:** make the Supabase client send the **Firebase ID token** so Supabase
treats real users as the `authenticated` role, then require authentication in RLS.

Everything below is **prepared but not activated**. Nothing here changes live
behavior until you run the steps in order.

## What's already prepared (in the repo, not committed/applied)
- `src/lib/supabaseClient.ts` — web client sends the Firebase token when
  `VITE_SUPABASE_FIREBASE_AUTH=true` (default off → current anon behavior).
- `mobile_app/lib/main.dart` — mobile client sends the Firebase token when built
  with `--dart-define=SUPABASE_FIREBASE_AUTH=true` (default off).
- `supabase/rls_policies.sql` — the "authenticated only" policy migration
  (+ optional per-row/role tier, + rollback).

## ⚠️ Order matters — doing this out of order locks users out
1. **Enable Firebase Third-Party Auth in Supabase** (Dashboard → Authentication →
   Third-Party Auth → Add provider → Firebase; use project `kurikal-tms-app`).
   *Until this is done, sending a Firebase token makes Supabase 401 every request.*
2. **Turn on the web bridge** in a preview/staging env: set
   `VITE_SUPABASE_FIREBASE_AUTH=true`, sign in, and confirm data still loads
   (requests now carry the Firebase JWT and succeed). If they 401, step 1 isn't
   right — fix before continuing.
3. **Build + distribute mobile** with `--dart-define=SUPABASE_FIREBASE_AUTH=true`
   and confirm the same. **Wait until users are on this build** — older builds
   only send the anon key and will lose access at step 4.
4. **Apply `supabase/rls_policies.sql`** (STEP 1 block). This drops the `anon`
   policies and requires authentication. Public still can submit the contact form.
5. **Verify** every area (tasks, attendance, chat, notifications, docs, admin) as
   a normal user AND an admin. If anything breaks, run the **ROLLBACK** block at
   the bottom of the SQL to restore `anon` access instantly.

## Optional next tier — true per-row / per-role security
The baseline above requires *a* logged-in user but doesn't yet restrict *which*
rows each user sees (any authenticated user can read all rows). To get real
per-user/per-role rules, Supabase needs the user's role/permissions **inside the
token** (it can't see the Firestore users/roles mapping):
- Add a Firebase **custom-claims** step (Cloud Function or admin script) that
  stamps `role_level` and key `perms` onto each user's token when their role changes.
- Then enable the commented STEP 2 policies in `rls_policies.sql`, table by table,
  verifying each before removing the broad `Authenticated full access` policy.

## Rollback
The `ROLLBACK` block at the end of `supabase/rls_policies.sql` recreates the
`Allow all for anon` policies on every table — run it if the cutover misbehaves.
