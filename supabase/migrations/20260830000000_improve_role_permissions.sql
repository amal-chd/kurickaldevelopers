-- ─────────────────────────────────────────────────────────────────────────────
-- Role permission redesign — fill missing keys + fix assignments
-- ─────────────────────────────────────────────────────────────────────────────
-- Normalises every role to carry ALL 42 permission keys explicitly, fills the
-- functionally-missing permissions (finance/HR/performance), and removes the
-- over-grants (destructive + org-wide "view all" now scoped to the roles whose
-- real-world function needs them).
--
-- Director / Owner (100) and Admin (90) already hold all 42 keys = true and are
-- intentionally left untouched.
--
-- A snapshot of the pre-change state is kept in:
--   public.roles_permissions_backup_20260829
-- Revert any role with:
--   update public.roles r
--   set permissions = b.permissions
--   from public.roles_permissions_backup_20260829 b
--   where r.id = b.id and r.name = '<Role Name>';
-- ─────────────────────────────────────────────────────────────────────────────

-- Safety net: (re)create the backup if it does not already exist.
create table if not exists public.roles_permissions_backup_20260829 as
select id, name, level, permissions, now() as backed_up_at
from public.roles;

-- ── Asset Manager (89): equipment / asset function ──
-- − projects_delete, team_delete, leave_manage   + contact_*/performance_* (explicit false)
update public.roles set permissions = '{
  "tasks_view":true,"tasks_view_all":true,"tasks_create":true,"tasks_edit":true,"tasks_delete":true,"tasks_approve":true,
  "projects_view":true,"projects_view_all":true,"projects_create":true,"projects_edit":true,"projects_delete":false,
  "docs_view":true,"docs_view_all":true,"docs_upload":true,"docs_approve":true,
  "team_view":true,"team_manage":true,"team_delete":false,
  "reports_view":true,"reports_export":true,
  "time_log":true,"time_view_all":true,
  "roles_manage":false,"settings_manage":false,"notifications_manage":true,
  "chat_view":true,"chat_send":true,"chat_create_group":true,"chat_announce":true,"chat_moderate":true,
  "attendance_view_all":true,
  "contact_view":false,"contact_manage":false,
  "performance_view":false,"performance_manage":false,
  "assets_view":true,"assets_manage":true,"assets_assign":true,"assets_maintain":true,
  "leave_manage":false,"payroll_manage":false,"expense_manage":true
}'::jsonb where name = 'Asset Manager';

-- ── Human Resource Dept (89): people / HR / payroll ──
-- − projects_create/edit/delete, assets_manage/assign/maintain   + performance_view/manage
update public.roles set permissions = '{
  "tasks_view":true,"tasks_view_all":true,"tasks_create":true,"tasks_edit":true,"tasks_delete":true,"tasks_approve":true,
  "projects_view":true,"projects_view_all":true,"projects_create":false,"projects_edit":false,"projects_delete":false,
  "docs_view":true,"docs_view_all":false,"docs_upload":true,"docs_approve":true,
  "team_view":true,"team_manage":true,"team_delete":false,
  "reports_view":true,"reports_export":true,
  "time_log":true,"time_view_all":true,
  "roles_manage":false,"settings_manage":false,"notifications_manage":true,
  "chat_view":true,"chat_send":true,"chat_create_group":true,"chat_announce":true,"chat_moderate":true,
  "attendance_view_all":true,
  "contact_view":true,"contact_manage":true,
  "performance_view":true,"performance_manage":true,
  "assets_view":true,"assets_manage":false,"assets_assign":false,"assets_maintain":false,
  "leave_manage":true,"payroll_manage":true,"expense_manage":true
}'::jsonb where name = 'Human Resource Dept';

-- ── Project Manager (89): project / ops leadership ──
-- − team_delete   (keeps projects_delete: PM owns the project lifecycle)
update public.roles set permissions = '{
  "tasks_view":true,"tasks_view_all":true,"tasks_create":true,"tasks_edit":true,"tasks_delete":true,"tasks_approve":true,
  "projects_view":true,"projects_view_all":true,"projects_create":true,"projects_edit":true,"projects_delete":true,
  "docs_view":true,"docs_view_all":true,"docs_upload":true,"docs_approve":true,
  "team_view":true,"team_manage":true,"team_delete":false,
  "reports_view":true,"reports_export":true,
  "time_log":true,"time_view_all":true,
  "roles_manage":false,"settings_manage":false,"notifications_manage":true,
  "chat_view":true,"chat_send":true,"chat_create_group":true,"chat_announce":true,"chat_moderate":true,
  "attendance_view_all":true,
  "contact_view":true,"contact_manage":true,
  "performance_view":true,"performance_manage":true,
  "assets_view":true,"assets_manage":true,"assets_assign":true,"assets_maintain":true,
  "leave_manage":true,"payroll_manage":false,"expense_manage":true
}'::jsonb where name = 'Project Manager';

-- ── Planning & Quality Head (87): planning / QA ──
-- − projects_delete, team_delete   + performance_view, leave/payroll/expense (explicit false)
update public.roles set permissions = '{
  "tasks_view":true,"tasks_view_all":true,"tasks_create":true,"tasks_edit":true,"tasks_delete":true,"tasks_approve":true,
  "projects_view":true,"projects_view_all":true,"projects_create":true,"projects_edit":true,"projects_delete":false,
  "docs_view":true,"docs_view_all":true,"docs_upload":true,"docs_approve":true,
  "team_view":true,"team_manage":true,"team_delete":false,
  "reports_view":true,"reports_export":true,
  "time_log":true,"time_view_all":true,
  "roles_manage":false,"settings_manage":false,"notifications_manage":true,
  "chat_view":true,"chat_send":true,"chat_create_group":true,"chat_announce":true,"chat_moderate":true,
  "attendance_view_all":true,
  "contact_view":false,"contact_manage":false,
  "performance_view":true,"performance_manage":false,
  "assets_view":true,"assets_manage":true,"assets_assign":true,"assets_maintain":true,
  "leave_manage":false,"payroll_manage":false,"expense_manage":false
}'::jsonb where name = 'Planning & Quality Head';

-- ── Purchase Manager (85): procurement ──
-- − projects_delete, team_delete   + expense_manage
update public.roles set permissions = '{
  "tasks_view":true,"tasks_view_all":true,"tasks_create":true,"tasks_edit":true,"tasks_delete":true,"tasks_approve":true,
  "projects_view":true,"projects_view_all":true,"projects_create":true,"projects_edit":true,"projects_delete":false,
  "docs_view":true,"docs_view_all":true,"docs_upload":true,"docs_approve":true,
  "team_view":true,"team_manage":true,"team_delete":false,
  "reports_view":true,"reports_export":true,
  "time_log":true,"time_view_all":true,
  "roles_manage":false,"settings_manage":false,"notifications_manage":true,
  "chat_view":true,"chat_send":true,"chat_create_group":true,"chat_announce":true,"chat_moderate":true,
  "attendance_view_all":true,
  "contact_view":true,"contact_manage":true,
  "performance_view":false,"performance_manage":false,
  "assets_view":true,"assets_manage":true,"assets_assign":true,"assets_maintain":true,
  "leave_manage":false,"payroll_manage":false,"expense_manage":true
}'::jsonb where name = 'Purchase Manager';

-- ── Office Administrator (72): admin support / front-desk ──
-- + docs_view_all, contact_view/manage, expense_manage
update public.roles set permissions = '{
  "tasks_view":true,"tasks_view_all":true,"tasks_create":true,"tasks_edit":true,"tasks_delete":false,"tasks_approve":true,
  "projects_view":true,"projects_view_all":true,"projects_create":false,"projects_edit":false,"projects_delete":false,
  "docs_view":true,"docs_view_all":true,"docs_upload":true,"docs_approve":true,
  "team_view":true,"team_manage":false,"team_delete":false,
  "reports_view":true,"reports_export":true,
  "time_log":true,"time_view_all":true,
  "roles_manage":false,"settings_manage":false,"notifications_manage":true,
  "chat_view":true,"chat_send":true,"chat_create_group":true,"chat_announce":true,"chat_moderate":false,
  "attendance_view_all":true,
  "contact_view":true,"contact_manage":true,
  "performance_view":false,"performance_manage":false,
  "assets_view":true,"assets_manage":true,"assets_assign":true,"assets_maintain":true,
  "leave_manage":false,"payroll_manage":false,"expense_manage":true
}'::jsonb where name = 'Office Administrator';

-- ── Quantity surveyor (68): costing / BOQ specialist ──
-- + tasks_edit, docs_view_all, reports_view/export, expense_manage
-- − projects_create/edit/delete, team_manage, notifications_manage,
--   attendance_view_all, contact_*, performance_*
update public.roles set permissions = '{
  "tasks_view":true,"tasks_view_all":false,"tasks_create":true,"tasks_edit":true,"tasks_delete":false,"tasks_approve":false,
  "projects_view":true,"projects_view_all":true,"projects_create":false,"projects_edit":false,"projects_delete":false,
  "docs_view":true,"docs_view_all":true,"docs_upload":true,"docs_approve":true,
  "team_view":true,"team_manage":false,"team_delete":false,
  "reports_view":true,"reports_export":true,
  "time_log":true,"time_view_all":true,
  "roles_manage":false,"settings_manage":false,"notifications_manage":false,
  "chat_view":true,"chat_send":true,"chat_create_group":false,"chat_announce":false,"chat_moderate":false,
  "attendance_view_all":false,
  "contact_view":false,"contact_manage":false,
  "performance_view":false,"performance_manage":false,
  "assets_view":true,"assets_manage":false,"assets_assign":false,"assets_maintain":false,
  "leave_manage":false,"payroll_manage":false,"expense_manage":true
}'::jsonb where name = 'Quantity surveyor';

-- ── Accounts (67): finance / payroll / expenses ──
-- + docs_view_all, leave_manage, payroll_manage, expense_manage
-- − tasks_delete, tasks_approve, team_manage, notifications_manage, contact_*
update public.roles set permissions = '{
  "tasks_view":true,"tasks_view_all":true,"tasks_create":true,"tasks_edit":true,"tasks_delete":false,"tasks_approve":false,
  "projects_view":true,"projects_view_all":true,"projects_create":false,"projects_edit":false,"projects_delete":false,
  "docs_view":true,"docs_view_all":true,"docs_upload":true,"docs_approve":true,
  "team_view":true,"team_manage":false,"team_delete":false,
  "reports_view":true,"reports_export":true,
  "time_log":true,"time_view_all":true,
  "roles_manage":false,"settings_manage":false,"notifications_manage":false,
  "chat_view":true,"chat_send":true,"chat_create_group":true,"chat_announce":true,"chat_moderate":false,
  "attendance_view_all":true,
  "contact_view":false,"contact_manage":false,
  "performance_view":false,"performance_manage":false,
  "assets_view":true,"assets_manage":false,"assets_assign":false,"assets_maintain":false,
  "leave_manage":true,"payroll_manage":true,"expense_manage":true
}'::jsonb where name = 'Accounts';

-- ── purchase department (49): junior procurement staff ──
-- − tasks_view_all   + leave/payroll/expense (explicit false)
update public.roles set permissions = '{
  "tasks_view":true,"tasks_view_all":false,"tasks_create":true,"tasks_edit":true,"tasks_delete":false,"tasks_approve":false,
  "projects_view":true,"projects_view_all":true,"projects_create":false,"projects_edit":false,"projects_delete":false,
  "docs_view":true,"docs_view_all":false,"docs_upload":true,"docs_approve":false,
  "team_view":true,"team_manage":false,"team_delete":false,
  "reports_view":true,"reports_export":false,
  "time_log":true,"time_view_all":false,
  "roles_manage":false,"settings_manage":false,"notifications_manage":false,
  "chat_view":true,"chat_send":true,"chat_create_group":false,"chat_announce":false,"chat_moderate":false,
  "attendance_view_all":false,
  "contact_view":false,"contact_manage":false,
  "performance_view":false,"performance_manage":false,
  "assets_view":true,"assets_manage":false,"assets_assign":false,"assets_maintain":false,
  "leave_manage":false,"payroll_manage":false,"expense_manage":false
}'::jsonb where name = 'purchase department';

-- ── Site Engineer (49): field engineer (no logical change; structural fill only) ──
update public.roles set permissions = '{
  "tasks_view":true,"tasks_view_all":false,"tasks_create":true,"tasks_edit":true,"tasks_delete":false,"tasks_approve":false,
  "projects_view":true,"projects_view_all":false,"projects_create":false,"projects_edit":false,"projects_delete":false,
  "docs_view":true,"docs_view_all":false,"docs_upload":true,"docs_approve":false,
  "team_view":true,"team_manage":false,"team_delete":false,
  "reports_view":false,"reports_export":false,
  "time_log":true,"time_view_all":false,
  "roles_manage":false,"settings_manage":false,"notifications_manage":false,
  "chat_view":true,"chat_send":true,"chat_create_group":true,"chat_announce":false,"chat_moderate":false,
  "attendance_view_all":false,
  "contact_view":false,"contact_manage":false,
  "performance_view":false,"performance_manage":false,
  "assets_view":true,"assets_manage":false,"assets_assign":false,"assets_maintain":false,
  "leave_manage":false,"payroll_manage":false,"expense_manage":false
}'::jsonb where name = 'Site Engineer';

-- ── OPERATORS (10): lowest tier, equipment operators ──
-- − tasks_delete, tasks_view_all, projects_view_all, docs_view_all
update public.roles set permissions = '{
  "tasks_view":true,"tasks_view_all":false,"tasks_create":true,"tasks_edit":true,"tasks_delete":false,"tasks_approve":false,
  "projects_view":true,"projects_view_all":false,"projects_create":false,"projects_edit":false,"projects_delete":false,
  "docs_view":true,"docs_view_all":false,"docs_upload":false,"docs_approve":false,
  "team_view":true,"team_manage":false,"team_delete":false,
  "reports_view":false,"reports_export":false,
  "time_log":true,"time_view_all":false,
  "roles_manage":false,"settings_manage":false,"notifications_manage":false,
  "chat_view":true,"chat_send":true,"chat_create_group":false,"chat_announce":false,"chat_moderate":false,
  "attendance_view_all":false,
  "contact_view":false,"contact_manage":false,
  "performance_view":false,"performance_manage":false,
  "assets_view":true,"assets_manage":false,"assets_assign":false,"assets_maintain":false,
  "leave_manage":false,"payroll_manage":false,"expense_manage":false
}'::jsonb where name = 'OPERATORS';

-- Sanity check — every role should now report 42 permission keys.
-- select name, level, (select count(*) from jsonb_object_keys(permissions)) as keys
-- from public.roles order by level desc nulls last;
