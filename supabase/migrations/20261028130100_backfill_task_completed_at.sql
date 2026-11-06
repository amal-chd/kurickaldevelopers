-- Backfill tasks.completed_at for finished tasks.
--
-- Web never wrote completed_at (the column wasn't mapped), and the performance
-- engine used updated_at as a completion-time proxy. The 2026-10-27 assignee
-- restore (20261028120100) bumped updated_at on 108 of those tasks, so the
-- proxy is gone for them. The engine now judges on-time/late from
-- completed_at only (missing → no lateness penalty); recover it here from
-- the best evidence available, newest-first:
--   1. audit_logs task.status_changed → Done
--   2. "Task Verified & Completed" notification
--   3. chat system message `… changed "<title>" → Done` in the project channel
--   4. updated_at, but only where the restore did not overwrite it
with d as (
  select id, title, project_id, created_at, updated_at
  from public.tasks
  where status = 'done' and completed_at is null
),
a as (
  select target_id as id, max(created_at) as at
  from public.audit_logs
  where action = 'task.status_changed' and changes::text like '%"to": "Done"%'
  group by 1
),
n as (
  select related_id as id, max(created_at) as at
  from public.app_notifications
  where title = 'Task Verified & Completed'
  group by 1
),
c as (
  select d.id, max(m.created_at) as at
  from d
  join public.chat_messages m
    on m.type = 'system'
   and m.text like '%"' || d.title || '" → Done%'
   and m.channel_id in ('project_' || d.project_id, 'project_$projectId')
   and m.created_at >= d.created_at
  group by d.id
)
update public.tasks t
set completed_at = coalesce(
      a.at, n.at, c.at,
      case when d.updated_at <> timestamptz '2026-10-27 21:06:17.141841+00' then d.updated_at end
    )
from d
left join a on a.id = d.id
left join n on n.id = d.id
left join c on c.id = d.id
where t.id = d.id
  and coalesce(a.at, n.at, c.at,
      case when d.updated_at <> timestamptz '2026-10-27 21:06:17.141841+00' then d.updated_at end) is not null;
