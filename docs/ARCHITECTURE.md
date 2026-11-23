# Task Pilot — Architecture

## The hybrid backend, and its one rule

Task Pilot deliberately splits its backend. **The rule that prevents bugs:** a
given kind of data is written to and read from **exactly one** store. Violating
it creates a "split-brain" where writes land in one place and reads come from
another (this actually happened with audit logs and time logs and had to be
fixed — do not reintroduce it).

### Firebase (identity only)

- **Auth** — email/password sessions.
- **Firestore `users`** — the user profile/system of record. There is **no**
  Supabase `users` table. On the web, always read a user via `db/users.ts`
  `getUser`; on mobile via the Firestore user doc.
- **Firestore `roles`** — *(migrated to Supabase; see below — the live roles are
  in Supabase)*.
- **Firestore holdouts** (read+write both on Firestore, intentionally): project
  **milestones** (`projects/{id}/milestones` subcollection), the admin
  **broadcast log** (`broadcast_notifications`), and **invitations**.

### Supabase (everything else)

Postgres tables for: `tasks`, `subtasks`, `comments`, `projects`, `attendance`,
`chat_channels`, `chat_messages`, `chat_attachments`, `chat_typing`, `documents`,
`site_diaries`, `leave_requests`, `salary_slips`, `expenses`, `app_notifications`,
`audit_logs`, `performance_reviews`, `performance_scores`, `contact_inquiries`,
`settings`, `time_logs`, and **`roles`** (migrated here with their real Firebase
doc IDs — both apps read `from('roles')`).

Plus Supabase **Storage** (`documents`, `chat-files` buckets) and **Realtime**.

---

## Data-mapping conventions (where most bugs came from)

Supabase columns are `snake_case`; the app models are `camelCase`. Every
repository/db-module converts between them. **Rules:**

- **Never spread a camelCase model into a Supabase row** (`{ ...task }`). It
  leaks non-column keys (`projectId`, `attachmentUrls`, …) and PostgREST rejects
  the whole write with a 400. Map every column explicitly.
- **Times:** always store true UTC — `.toUtc().toIso8601String()` (mobile) or an
  ISO-Z string (web). A naive local string is read back as UTC and displays
  shifted by the timezone offset. Read back with a tolerant coercer
  (`lib/utils.ts` `toDate`, `AppDateUtils.fromTimestamp`) that accepts a
  Timestamp, a Date, or an ISO string.
- **Reads:** use `.maybeSingle()` for by-id lookups (0 rows → `null`, not a 406
  crash from `.single()`).
- **Enums:** `task_status` = todo, in_progress, review, completed, under_review,
  done · `task_priority` = low, medium, high, critical. App enum `.value`s must
  match exactly.
- **Realtime:** every `supabase.channel(name)` must use a **unique** name per
  subscriber (append a random suffix). A static name is reused by the client and
  the second subscriber throws "cannot add callbacks after subscribe".

---

## Permission model

A role carries a `permissions` JSONB map of 35 boolean keys (snake_case, e.g.
`tasks_view`, `projects_create`, `attendance_view_all`, `roles_manage`). The same
keys drive both apps:

- **Web:** `usePermissions().can('tasks_view')`; the sidebar/routes gate on them.
- **Mobile:** `hasPermissionProvider('tasks_view')` and the `PermissionGate`
  widget; the bottom nav, "More" sheet, and per-screen actions gate on them.

The **UI must reflect permissions everywhere** — a control the user lacks the
permission for is hidden, not merely disabled. The authoritative gate list is the
web sidebar (`src/components/layout/Sidebar.tsx`); mobile mirrors it. Admin
surfaces show for `level ≥ 100` **or** any admin permission (`roles_manage`,
`settings_manage`, `notifications_manage`, `attendance_view_all`, `contact_view`,
`team_manage`).

`*_view_all` keys are **data-scope filters** (which rows a query returns), not UI
toggles.

---

## Audit & activity log

One canonical store: **Supabase `audit_logs`**. Both web (`src/lib/auditLog.ts`)
and mobile (`audit_service.dart`, `admin_repository.dart`) write and read it.
Category is stored as `target_type`; the timestamp is `created_at` (there is no
separate `category`/`timestamp` column). Writes are fire-and-forget — a failed
audit write must never break the primary action.

---

## Where to look

| You're touching… | Web | Mobile |
|---|---|---|
| A table's read/write | `src/lib/db/<table>.ts` | `mobile_app/lib/data/repositories/<table>_repository.dart` |
| Auth / user identity | `src/lib/db/users.ts`, `store/authStore.ts` | `data/repositories/auth_repository.dart` |
| Permissions | `hooks/usePermissions`, `Sidebar.tsx` | `providers/role_provider.dart` |
| Navigation gating | `components/layout/Sidebar.tsx` | `presentation/shared/layouts/app_scaffold.dart` |
| Dates | `lib/utils.ts` | `core/utils/date_utils.dart` |
