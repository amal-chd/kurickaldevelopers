-- One-off data repair: restore task assignees wiped by the web updateTask bug.
--
-- Web `updateTask` mapped partial updates through a converter that defaulted
-- absent keys (`assignee_ids: []`, `assigned_role_ids: []`, ...), so every web
-- status change cleared the task's assignees. The original assignees are still
-- recorded as the recipients of the "New Task Assigned" notification sent at
-- assignment time, so rebuild assignee_ids from those.
--
-- Only touches tasks that currently have NO assignees and NO roles.
-- Role assignments cannot be recovered (no reliable record of them exists).
update public.tasks t
set assignee_ids = r.uids,
    updated_at = now()
from (
  select n.related_id as task_id, array_agg(distinct n.user_id order by n.user_id) as uids
  from public.app_notifications n
  where n.type = 'task_assigned'
    and n.title = 'New Task Assigned'
    and n.related_id is not null
    and n.user_id is not null
  group by n.related_id
) r
where t.id = r.task_id
  and coalesce(cardinality(t.assignee_ids), 0) = 0
  and coalesce(cardinality(t.assigned_role_ids), 0) = 0
  and coalesce(t.assigned_role_id, '') = '';
