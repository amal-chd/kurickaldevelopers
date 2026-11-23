# Task Pilot — Operations Runbook

Deploy, secure, back up, and respond to incidents. Keep this current; it is the
single source of truth for running Task Pilot in production.

---

## 1. Deploying the web app

The web app deploys from the `main` branch (Vercel builds on push).

```bash
# from the repo root, on the web branch (master)
git push origin master:main
```

Then confirm the Vercel build succeeded and smoke-test: log in, open the
dashboard, notifications, and a task detail. CI (`.github/workflows/ci.yml`)
type-checks and builds on every push — a red CI run should block the deploy.

**Required Vercel env vars:** the `VITE_*` values from the README. Without
`VITE_SUPABASE_*` and `VITE_FIREBASE_*` the build produces a blank app.

## 2. Releasing the mobile app

```bash
cd mobile_app
# bump version in pubspec.yaml first (e.g. 1.0.25+32 -> 1.0.26+33)
flutter build appbundle --release      # Android -> Play Console
flutter build ipa --release            # iOS -> Transporter -> TestFlight
```

- **Android:** upload `build/app/outputs/bundle/release/app-release.aab` to the
  Play Console (internal testing → production).
- **iOS:** open Apple **Transporter**, drag in `build/ios/ipa/Task Pilot.ipa`,
  Deliver → appears in TestFlight. The build number must always increase.

---

## 3. 🔐 Enabling real database security (RLS) — top priority

**Current state:** every Supabase table has an `Allow all for anon` policy and
the apps use the public anon key. Anyone who extracts that key can read/write all
data. The fix is prepared in `supabase/rls_policies.sql` but **must not be applied
until the token bridge is live**, or every user is locked out instantly.

Cutover, in order:

1. **Register Firebase as a Supabase third-party auth provider**
   (Supabase Dashboard → Authentication → Third-party Auth → add Firebase, with
   the Firebase project ID). This makes Supabase accept Firebase ID tokens.
2. **Turn on the client bridge and redistribute builds** so every request carries
   the Firebase token:
   - Web: set `VITE_SUPABASE_FIREBASE_AUTH=true`, deploy.
   - Mobile: `flutter build ... --dart-define=SUPABASE_FIREBASE_AUTH=true`, ship
     the new build to **all** users. Old anon-only builds break at step 4.
3. **Verify** a signed-in user's Supabase reads/writes still succeed with the
   bridge on (they carry the token instead of the raw anon key).
4. **Apply STEP 1** of `supabase/rls_policies.sql` (authenticated-only). Watch the
   Supabase logs; if anything 401s, run the rollback block at the bottom of that
   file to reopen access, then investigate.
5. **Later — STEP 2 (role-aware rows):** requires role/permission info as custom
   claims inside the Firebase token (a Cloud Function that sets `role_level` and
   `perms` on each user). Then tighten table by table using the examples in the
   SQL file, verifying each against the app before removing the broad
   authenticated policy.

## 4. Backups

- **Supabase:** confirm Point-in-Time Recovery / daily backups are enabled
  (Dashboard → Database → Backups). Verify a restore at least once.
- **Firestore:** schedule a periodic export of the `users` and `roles`
  collections (they are the identity system of record) to a GCS bucket.
- **Schema changes:** only ever through Supabase migrations (`apply_migration`)
  so environments stay reproducible — never hand-edit the schema in the dashboard.

---

## 5. Incident response

1. **Is it web, mobile, or backend?** Web errors → Sentry (once
   `VITE_SENTRY_DSN` is set). Mobile → Firebase Crashlytics. Backend →
   Supabase logs (edge/postgres) and the audit log in-app.
2. **Data-write failures (4xx from PostgREST):** almost always a column/enum/type
   mismatch between the app payload and the schema. Compare the failing table's
   columns (`information_schema.columns`) with the mapper in `src/lib/db/<table>.ts`
   or `mobile_app/lib/data/repositories/<table>_repository.dart`.
3. **"Everything is denied" after an RLS change:** run the rollback block in
   `supabase/rls_policies.sql` to reopen access, then debug the token bridge.
4. **Times look shifted:** a write used naive local time instead of UTC. All
   writes must be `.toUtc().toIso8601String()` (mobile) / ISO-Z (web).
5. **A page crashes to the error boundary:** check for a static Supabase realtime
   channel name (must be unique per subscriber) or a `.toDate()` on a value that
   isn't a Firestore Timestamp.

---

## 6. Known data-hygiene items

- ~68 migrated `audit_logs` rows have a null `created_at` (original Firestore
  timestamp not carried over) — they show as "Unknown Date". Backfill or archive.
- At least one `users` document has a leading space in `name` — trim stray
  whitespace across the collection.
