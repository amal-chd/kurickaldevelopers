# Task Pilot

Construction Task Management System for **Kurickal Developers LLP** — a web
dashboard and a Flutter mobile app (iOS + Android) sharing one backend.

- **Web** — React + Vite + TypeScript (`/src`)
- **Mobile** — Flutter (`/mobile_app`, its own git repo)
- **Backend** — Firebase (Auth + identity) **+** Supabase (all other data)

---

## Architecture at a glance

Task Pilot uses a **hybrid backend**. Auth and identity stay on Firebase; every
other domain object lives in Supabase Postgres.

| Concern | Store | Notes |
|---|---|---|
| Login / sessions | **Firebase Auth** | Email/password |
| `users`, `roles` (identity) | **Firestore** | There is **no** Supabase `users` table — read users via `getUser` |
| Milestones, admin broadcast log, invitations | **Firestore** | Legacy subcollections, read+write both on Firestore |
| Everything else | **Supabase** | tasks, projects, attendance, chat, documents, site diaries, leave, salary, expenses, comments, subtasks, performance, audit logs, notifications, settings |
| File storage | **Supabase Storage** | `documents` + `chat-files` buckets (public) |
| Realtime | **Supabase Realtime** | Live tables use per-subscriber channel names |

The web data layer lives in `src/lib/db/*.ts` and is re-exported through
`src/lib/firestore.ts` (a compatibility barrel — pages import from there and
transparently hit Supabase). The mobile data layer is `mobile_app/lib/data/repositories/*.dart`.

See **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** for the full map, the
permission model, and the data-mapping conventions.

---

## Getting started (web)

```bash
npm install
cp .env.example .env.local      # fill in the values below
npm run dev                     # http://localhost:5173
```

Required env vars (all client-side publishable values):

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
# optional
VITE_SENTRY_DSN=                # enables web error monitoring
VITE_SUPABASE_FIREBASE_AUTH=    # "true" bridges the Firebase token to Supabase (see RLS cutover)
```

Scripts: `npm run dev` · `npm run build` · `npm run lint` · `npm test`

## Getting started (mobile)

```bash
cd mobile_app
flutter pub get
flutter run                     # debug
```

Release builds:

```bash
flutter build appbundle --release      # Android AAB
flutter build ipa --release            # iOS IPA (App Store)
```

Config lives in `mobile_app/lib/core/config/supabase_config.dart` (compile-time
`--dart-define` overrides supported). Firebase is configured via the platform
`google-services.json` / `GoogleService-Info.plist` (not committed).

---

## Quality gates

- **Web**: `npm run build` (type-checks + builds), `npm test` (vitest)
- **Mobile**: `flutter analyze`, `flutter test`
- **CI**: `.github/workflows/ci.yml` (web) and `mobile_app/.github/workflows/ci.yml` (mobile) run these on every push.

Both apps must analyze/type-check at **0 errors** before release.

---

## Operations

Deploy steps, the RLS security cutover, backups, and incident response are in
**[docs/RUNBOOK.md](docs/RUNBOOK.md)**.

> **Security note:** the Supabase tables currently use permissive policies and
> the apps use the public anon key. Real row-level security is **prepared but
> not yet enabled** (`supabase/rls_policies.sql`). Enabling it is the top
> production task — see the runbook.
