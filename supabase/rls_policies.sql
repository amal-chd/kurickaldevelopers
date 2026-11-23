-- ─────────────────────────────────────────────────────────────────────────────
--  PREPARED RLS POLICIES — DO NOT APPLY YET.
--
--  Apply ONLY after ALL of these are true (see docs/SUPABASE_RLS_CUTOVER.md):
--    1. Firebase is registered as a Supabase Third-Party Auth provider.
--    2. The client auth bridge is ON and verified:
--         web:    VITE_SUPABASE_FIREBASE_AUTH=true
--         mobile: flutter build ... --dart-define=SUPABASE_FIREBASE_AUTH=true
--       (a signed-in user's Supabase requests must succeed while carrying the
--        Firebase token — confirm before running this file).
--    3. The updated mobile build (with the bridge) is distributed to all users
--       — otherwise old builds (anon only) get locked out the moment STEP 1
--       below runs.
--
--  What this does: every table currently has "Allow all for anon" (USING true
--  for the public role), i.e. anyone holding the public anon key can read/write
--  everything. This replaces that with "authenticated only" — a valid Firebase
--  token is required. Every real app user is authenticated, so no feature
--  breaks; unauthenticated access is closed.
--
--  Contact inquiries keep public INSERT (the website contact form is used by
--  logged-out visitors) but require auth to read/manage.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── STEP 1: baseline "must be authenticated" for all data tables ──────────────
do $$
declare t text;
begin
  foreach t in array array[
    'roles','projects','tasks','attendance','chat_channels','chat_messages',
    'chat_attachments','chat_typing','documents','site_diaries','leave_requests',
    'salary_slips','expenses','app_notifications','audit_logs',
    'performance_reviews','performance_scores','comments','subtasks','settings'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "Allow all for anon" on public.%I;', t);
    execute format('drop policy if exists "Authenticated full access" on public.%I;', t);
    execute format(
      'create policy "Authenticated full access" on public.%I '
      'for all to authenticated using (true) with check (true);', t);
  end loop;
end $$;

-- ── contact_inquiries: public submit, authenticated manage ────────────────────
alter table public.contact_inquiries enable row level security;
drop policy if exists "Allow all for anon" on public.contact_inquiries;
drop policy if exists "Public can submit inquiries" on public.contact_inquiries;
drop policy if exists "Authenticated manage inquiries" on public.contact_inquiries;
create policy "Public can submit inquiries" on public.contact_inquiries
  for insert to anon, authenticated with check (true);
create policy "Authenticated manage inquiries" on public.contact_inquiries
  for select to authenticated using (true);
create policy "Authenticated update inquiries" on public.contact_inquiries
  for update to authenticated using (true) with check (true);
create policy "Authenticated delete inquiries" on public.contact_inquiries
  for delete to authenticated using (true);

-- ─────────────────────────────────────────────────────────────────────────────
--  STEP 2 (OPTIONAL, later): per-row / role-aware tightening.
--
--  Requires role + permission info INSIDE the Firebase token as custom claims
--  (Supabase RLS cannot read the Firestore users/roles mapping). Add a Cloud
--  Function / admin step that sets, per user, custom claims such as:
--      role_level (int)         e.g. 90
--      perms (jsonb/text[])     e.g. {"tasks_view_all":true, ...}
--  Then `auth.jwt()->>'sub'` is the Firebase uid and `auth.jwt()->'perms'` /
--  `auth.jwt()->>'role_level'` gate access. Illustrative examples (NOT active):
--
--  -- attendance: a user sees their own; managers (view-all perm) see everyone
--  -- create policy "attendance read" on public.attendance for select to authenticated
--  --   using (user_id = auth.jwt()->>'sub'
--  --          or coalesce((auth.jwt()->'perms'->>'attendance_view_all')::bool,false));
--
--  -- app_notifications: recipient or broadcast only
--  -- create policy "notif read" on public.app_notifications for select to authenticated
--  --   using (user_id = auth.jwt()->>'sub' or user_id = '');
--
--  -- tasks: assignee / creator / role-assignee / tasks_view_all
--  -- create policy "task read" on public.tasks for select to authenticated
--  --   using (auth.jwt()->>'sub' = any(assignee_ids)
--  --          or created_by = auth.jwt()->>'sub'
--  --          or coalesce((auth.jwt()->'perms'->>'tasks_view_all')::bool,false));
--
--  Roll these in table by table, verifying each against the app before removing
--  the broad "Authenticated full access" policy above.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── ROLLBACK (re-open to anon if something breaks during cutover) ─────────────
-- do $$
-- declare t text;
-- begin
--   foreach t in array array['roles','projects','tasks','attendance','chat_channels',
--     'chat_messages','chat_attachments','chat_typing','documents','site_diaries',
--     'leave_requests','salary_slips','expenses','contact_inquiries','app_notifications',
--     'audit_logs','performance_reviews','performance_scores','comments','subtasks','settings']
--   loop
--     execute format('drop policy if exists "Authenticated full access" on public.%I;', t);
--     execute format('create policy "Allow all for anon" on public.%I for all to public using (true) with check (true);', t);
--   end loop;
-- end $$;
