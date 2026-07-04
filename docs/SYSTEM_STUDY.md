# Task Pilot — System Study (roles, features & data flow)

> Snapshot of how every subsystem works as of 2026-07, grounded in the current
> code (web `kurickal_tms_web`, mobile `kurickal_tms`, `firestore.rules`,
> Supabase Edge Function `supabase/functions/send-push`).

---

## 1. Role & permission logic

**Single source of truth:** `roles/{roleId}` docs in Firestore. Web seeds them
on first login from `DEFAULT_ROLES` (`src/hooks/useAuth.ts`); mobile only reads.
A role = `{ name, color, level, permissions{...} }`. **35 permission keys**,
identical across web type, mobile `PermissionModel`, and the rules (guarded by
a key-count test on mobile).

**Hierarchy levels:** Director 100 · Admin 90 · Project Manager 80 · Site
Engineer 60 · Accounts 50 · Foreman 40 · Labour 20. Levels gate role
*escalation* (rules `myLevel()`: you cannot grant a role above your own, and
the edge function refuses deleting a user whose role outranks yours).

**Resolution flow (both apps):** login → load `users/{uid}.roleId` → load role
doc → `permissions` map drives every `can()` / `hasPermissionProvider()` gate.
Mobile caches permissions in SharedPreferences for offline/fast startup. Web
falls back to built-in `DEFAULT_ROLES` if the Firestore role doc is missing.
New users get `roleId: null` (no fallback role) — an admin must assign one;
known company emails are auto-mapped via `EMAIL_ROLE_MAP`.

**Enforcement is two-layer:** UI gating (hide/deny screens) + Firestore rules
(authoritative). Key rule helpers: `hasPermission(k)`, `myLevel()`,
`isProjectMember(p)`, `isProjectManager(p)` (checks `projectManagerId`, legacy
`managerId` fallback).

### Role capability matrix (defaults)

| Capability | Director | Admin | PM | Accounts | Engineer | Foreman | Labour |
|---|---|---|---|---|---|---|---|
| See ALL tasks/projects/docs (`*_view_all`) | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create tasks | ✅ | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| Approve tasks (manager view) | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Create/edit projects | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Upload docs | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Approve docs | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reports (view/export) | ✅/✅ | ✅/✅ | ✅/✅ | ✅/✅ | ✅/❌ | ❌ | ❌ |
| Team manage / delete users | ✅/✅ | ✅/✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Roles / settings / broadcasts | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Attendance: view all | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Attendance: log own (`time_log`) | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ | ✅ |
| Chat: create groups / announce / moderate | ✅/✅/✅ | ✅/❌/✅ | ✅/❌/❌ | ❌ | ❌ | ❌ | ❌ |
| Contact inquiries | ✅ | ✅ | view | view | ❌ | ❌ | ❌ |

*(All roles: `chat_view` + `chat_send` + `team_view` + `tasks_view`; Labour has
no project/doc visibility.)*

---

## 2. Tasks

**Model** (`Task`): title/description/project/milestone, `assigneeIds[]`
**and/or `assignedRoleIds[]`** (role-based assignment — e.g. "all Foremen"),
status (`in_progress → approved → done`), priority (low→critical), dueDate,
estimated/actual hours, tags, dependencies, recurrence, SLA fields,
attachments, and **`memberProgress{uid → {status, completionStatus,
delaySeconds, actualHours}}`** so each assignee's completion is tracked
individually; task-level `completionStatus` (`completed_on_time` /
`completed_late`) + `delaySeconds` feed the point system.

**Visibility:** rules allow read if assignee ∨ creator ∨ `tasks_view_all` ∨
project member ∨ **your role is in `assignedRoleIds`**. UI mirrors this: the
manager board (gated on `tasks_approve`) shows all tasks; everyone else sees
"My Tasks" (direct + role-based assignments).

**Assignment governance:** the Director's **Task Assignment Rules** matrix
(`settings/task_assignment`) restricts which roles a creator may assign to;
CreateTaskPage filters the pickers accordingly (mobile also enforces the
role-level fallback: assign only below your level).

**Side effects on create/status change:** in-app notification docs for
assignees / creator, FCM push via the edge function, a system message in the
project chat, and a **client-side performance recalculation** for affected
users.

## 3. Projects

**Unified schema (web = mobile):** `projectManagerId`, `expectedEndDate`,
`siteAddress`, `clientName`, `healthStatus` (green/amber/red),
`progressPercent`, `memberIds[]`, status (`active | on_hold | completed`),
budget. The **manager + creator are always kept inside `memberIds`** —
membership is the canonical access signal.

**Scoping:** Director/Admin (`team_manage`/`settings_manage` on web provider
logic; `projects_view_all` in rules) see all; everyone else only projects
where they're a member. Progress = done tasks ÷ project tasks.

**Chat coupling:** every project has a deterministic channel
`project_<projectId>`; `syncProjectChannel()` runs on project create/edit so
**chat membership always equals project membership**.

## 4. Notifications

**Two layers, both Spark-safe:**
1. **In-app** (`notifications` collection): `{userId ('' = broadcast), type,
   title, body, relatedId, isRead: {uid: true}}`. Written client-side on task
   assignment (→ each assignee), status change (→ creator), role-based
   assignment (→ users of the roles), and admin broadcasts. Bell lists
   targeted + broadcast merged; per-user read map.
2. **Push (FCM)** via the **Supabase Edge Function** `send-push` (verifies the
   Firebase ID token; service account lives only in Supabase secrets). Events:
   `chat` (member-gated), `task`, `broadcast` (permission-gated),
   `delete_user` (permission + hierarchy gated). Tokens are saved on login
   (`users/{uid}.fcmToken`), re-registered per-uid, and **cleared on logout**.
   **User preferences** (`users/{uid}.preferences.{announcements|chats|tasks}`,
   editable in Profile on both apps) are respected server-side when fanning
   out.

## 5. Documents

Files live in **Supabase Storage** (`documents` bucket, foldered by project;
public-read URLs); metadata in Firestore `documents` with `approvalStatus`
(pending → approved/rejected via `docs_approve`). Read = uploader ∨ project
member ∨ `docs_view_all`; upload = `docs_upload`; delete = own upload ∨
approver ∨ level ≥ 90 (also best-effort deletes the storage object). The
**DocumentViewer** previews PDF (pdf.js canvas), images/video, CSV/JSON/XML/
text, and zip listings, with blob caching + print.

## 6. Reports

Web `ReportsPage` (gate `reports_view`, export `reports_export`): date-range
filtered task analytics — status distribution, completion rate, per-user
productivity, project summaries, CSV export. Mobile has a matching
`reports_screen`. Data is computed client-side from tasks/projects/users.

## 7. Attendance

Mobile-first: check-in/out from the Team screen with **geolocation**; a
`attendance/{id}` doc stores `{userId, projectId, date, checkInTime,
checkOutTime, lat/lng}`. Rules: create/update only your own record; read =
own ∨ same-project member ("Today on site") ∨ `attendance_view_all` /
`team_manage`; **delete disabled**. Admin **Attendance Dashboard** (web +
mobile `staff_attendance_screen`) shows live elapsed timers, durations, and
flags check-ins outside the org geofence (from Org Settings). Attendance rate
also feeds the point system.

## 8. Chat system

Channel types: **announcement** (company-wide; visible to everyone via a
merged query; posting gated by `chat_announce`), **project** (auto-created,
membership-synced), **group** (`chat_create_group`), **direct** (any user,
deterministic id `dm_<uidA>_<uidB>`). Messages support text, image/file
attachments (Supabase `chat-files` bucket), task references, replies,
reactions, mentions, edit/soft-delete, typing indicators, unread counts and
per-user `lastReadAt`. Channel previews always reflect the latest
**non-deleted** message; archived (soft-deleted) channels are hidden.
Moderation (`chat_moderate`): delete any message, delete conversations.
Rules: only members read a channel/messages; sending requires membership (+
`chat_send` or a direct/project channel).

## 9. Point system (performance)

`src/lib/performanceEngine.ts` + `performance_scores/{uid}`:

- **Base points by priority:** critical 50 · high 35 · medium 20 · low 10,
  scaled by a complexity multiplier (estimated hours) and a per-role
  difficulty multiplier (PM 1.2, Engineer 1.1, Labour 0.9 …).
- **Anti-gaming:** diminishing returns on repeated low-priority tasks within
  the same week.
- **Penalties:** late/day 3, deadline extension 5, rejection 15, reopen 10,
  inactivity/day 2. **Bonuses:** on-time +5, collaboration +10, streaks
  (5/10/25 → ×1.10/1.20/1.35).
- **Composite index:** productivity 25% + reliability 25% + efficiency 20%
  (est/actual-hours ratio, capped 2.0) + quality 20% (peer/manager reviews via
  `performance_reviews`) + collaboration 10%. Attendance rate feeds
  reliability.
- **Recalculation is client-triggered** (task create/update, review submit,
  or the "Recalculate" button) — there is no server cron on the free plan.
- **Access:** own score always; all scores with `performance_view`; config
  editable with `performance_manage` (`settings/performance_config`).
  Surfaced on the dashboard (score card) and the **Performance & Points**
  page (leaderboard, breakdowns, reviews).

## 10. Admin access & panel

Entry appears only if the user holds any admin-ish permission. Tiles and their
gates (web; mobile Admin Console mirrors):
User Management (`settings_manage`; delete additionally needs `team_delete` —
runs through the edge function with hierarchy guard) · Role Management
(`roles_manage`, full 35-key editor) · Task Assignment Rules (`roles_manage`) ·
Audit Log (`roles_manage`; admin actions are recorded to `audit_logs`) ·
Notification Center (`notifications_manage`, targeted/role/broadcast) ·
Attendance Dashboard (`attendance_view_all`) · Contact Inquiries
(`contact_view` — website leads pipeline: new → contacted → closed).

## 11. Dashboard (role-adaptive)

Web: greeting + stat cards (active tasks/projects, team, pending approvals),
**personal performance-score card**, on-time/late completion stats, "All
Tasks" for approvers vs "My Tasks" (direct + role-assigned) for staff,
projects with progress bars, team snapshot, quick actions filtered by
`tasks_create` / `projects_create` / `docs_view`. Mobile mirrors with
permission-gated quick-action tiles and manager/employee task views. Labour
effectively sees: own tasks, chat, attendance, profile.

## 12. Team

Team directory (`team_view` — all roles): role-colored member cards, search +
role filter, active/inactive state. Member detail shows profile + task/
attendance context. Management (activate/deactivate, role changes constrained
by level, permanent delete) lives in the admin panel, not here. Mobile's Team
screen doubles as the **attendance check-in** surface and "Today on site".

## 13. Site diary

Daily field log per project: date, **weather**, work done, labour count,
photos. Any authenticated user can read/create (deliberately open for field
staff); edits restricted to the author or `projects_edit`; **no deletes**.
Both platforms have full screens; entries render as a project-filtered
timeline with weather icons.

---

## Cross-cutting integrity notes (observed during this study)

- Task/project/doc/chat/notification schemas are **shared and consistent**
  across platforms (post-unification), incl. per-user `isRead` maps and
  `memberProgress`.
- Everything server-side lives in **rules + one edge function**; there are no
  Cloud Functions (Spark). Client-triggered side effects (notifications,
  channel sync, score recalc) are therefore best-effort — acceptable for an
  internal tool, worth a cron/queue if moved to a paid tier.
- Known follow-ups: `delete_user` does not yet clean `performance_scores/{uid}`
  or the user's `performance_reviews`; site-diary read is org-wide by design;
  attendance updates are owner-trusted (no tamper lock after checkout).
