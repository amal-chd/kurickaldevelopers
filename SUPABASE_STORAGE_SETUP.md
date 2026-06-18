# Supabase Storage Setup (file uploads only)

Task Pilot uses **Supabase Storage** for **document storage** and **chat file
uploads**. Authentication and the database stay on **Firebase** — Supabase is
*only* the file store.

You need to create a Supabase project, two storage buckets, access policies,
and then plug the credentials into the web and mobile apps.

---

## 1. Create a Supabase project

1. Go to <https://supabase.com> → **New project**.
2. Note your **Project URL** (e.g. `https://abcd1234.supabase.co`) and the
   **anon public** API key (Project Settings → API).

## 2. Create the two buckets

Storage → **New bucket** (create both):

| Bucket name  | Public | Used for            |
|--------------|--------|---------------------|
| `documents`  | ✅ Yes | Project documents   |
| `chat-files` | ✅ Yes | Chat image/file msgs |

> Marking them **public** makes uploaded files readable by URL (which is how the
> apps display images and download links). See the security note at the bottom.

## 3. Add upload/delete policies

Because auth is on Firebase, the apps talk to Supabase with the **anon** role.
For each bucket, add policies allowing the anon role to upload and delete.

Storage → **Policies** → for the `documents` bucket → **New policy** → *For full
customization*:

```sql
-- Allow anyone (anon) to upload to the documents bucket
create policy "documents upload"
on storage.objects for insert to anon
with check ( bucket_id = 'documents' );

-- Allow anyone (anon) to delete from the documents bucket
create policy "documents delete"
on storage.objects for delete to anon
using ( bucket_id = 'documents' );

-- Public read (only needed if the bucket is NOT marked public)
create policy "documents read"
on storage.objects for select to anon
using ( bucket_id = 'documents' );
```

Repeat the same three policies for `chat-files` (replace `documents` with
`chat-files`).

## 4. Plug in credentials

### Web (`kurickal_tms_web/.env`)

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_public_key
```

Restart `npm run dev` (or rebuild) after editing `.env`.
On Vercel, add the same two variables in **Project → Settings → Environment
Variables**, then redeploy.

### Mobile (`kurickal_tms/lib/core/config/supabase_config.dart`)

Either edit the defaults in that file:

```dart
static const String url = String.fromEnvironment('SUPABASE_URL',
    defaultValue: 'https://YOUR_PROJECT_REF.supabase.co');
static const String anonKey = String.fromEnvironment('SUPABASE_ANON_KEY',
    defaultValue: 'your_anon_public_key');
```

…or pass them at build/run time without editing source:

```bash
flutter run \
  --dart-define=SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co \
  --dart-define=SUPABASE_ANON_KEY=your_anon_public_key
```

## 5. Verify

- **Web Documents** page → upload a file → it appears and opens via its URL.
- **Web Chat** → paperclip → pick an image/file → it sends (images inline,
  files as a download chip).
- **Mobile Documents** → upload FAB → pick a file → it's saved.
- **Mobile Chat** → attach → pick an image/file → it sends.

---

## Security note

The buckets above are **public-read** and allow **anon uploads**, which is the
simplest setup given that the app authenticates with Firebase (not Supabase).
Anyone holding the anon key could upload to these buckets.

For an internal tool this is usually acceptable. If you need it locked down,
the recommended hardening is a **Supabase Edge Function** that verifies the
caller's Firebase ID token and returns a short-lived **signed upload URL**, with
the buckets set to private. That keeps the same UX while removing anonymous
write access. Ask and this can be added later.
