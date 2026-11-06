-- Repair data written by mobile builds whose Dart strings escaped interpolation
-- ('\$x' is a literal "$x" in Dart), fixed in the app on 2026-10-28.
--
-- 1. projectChannelId() returned the literal 'project_$projectId', so every
--    mobile user's project messages landed in ONE shared bogus channel.
-- 2. Channel previews / descriptions / notification texts stored placeholders
--    such as "${msg.text.substring(0, 80)}…" and "$userName".

-- 1a. Move stray messages whose task title maps to exactly one project.
with m as (
  select id, task_id, created_at, substring(text from '"([^"]+)"') as quoted
  from public.chat_messages
  where channel_id = 'project_$projectId'
), cand as (
  select m.id, array_agg(distinct t.project_id) filter (where t.project_id is not null) as projs
  from m
  left join public.tasks t
    on t.id = m.task_id
    or (m.quoted is not null and t.title = m.quoted and t.created_at <= m.created_at)
  group by m.id
)
update public.chat_messages cm
set channel_id = 'project_' || c.projs[1]
from cand c
where cm.id = c.id
  and cardinality(c.projs) = 1
  and exists (select 1 from public.chat_channels ch where ch.id = 'project_' || c.projs[1]);

-- 1b. Whatever cannot be attributed stays, but the bogus channel must stop
--     impersonating a real project (it carried a real project's name/id).
update public.chat_channels
set name = 'Unsorted project messages',
    description = 'Messages from an old mobile bug that could not be matched to a project',
    project_id = null
where id = 'project_$projectId';

-- 2a. Fix channel descriptions.
update public.chat_channels
set description = 'Project channel for ' || name
where description like '%$projectName%';

-- 2b. Recompute every channel preview from its latest visible message
--     (same rules as the apps' _previewText).
update public.chat_channels ch
set last_message_text = case lm.type::text
      when 'image' then '📷 Photo'
      when 'file' then '📎 ' || coalesce(lm.attachment_name, 'File')
      when 'task_ref' then '📌 ' || coalesce(lm.task_title, 'Task')
      when 'system' then lm.text
      else case when length(lm.text) > 80 then left(lm.text, 80) || '…' else lm.text end
    end,
    last_message_by = lm.sender_id,
    last_message_at = lm.created_at
from (
  select distinct on (channel_id) channel_id, type, text, attachment_name, task_title, sender_id, created_at
  from public.chat_messages
  where coalesce(is_deleted, false) = false
  order by channel_id, created_at desc
) lm
where lm.channel_id = ch.id
  and (ch.last_message_text like '%$%' or ch.id like 'project_%');

-- 2c. Notification texts.
update public.app_notifications n
set body = replace(replace(replace(n.body,
             '${task.title}', coalesce(t.title, 'a task')),
             '$taskTitle', coalesce(t.title, 'a task')),
             '"$title"', '"' || coalesce(t.title, 'a task') || '"')
from public.tasks t
where t.id = n.related_id
  and (n.body like '%${task.title}%' or n.body like '%$taskTitle%' or n.body like '%"$title"%');

update public.app_notifications
set body = replace(replace(replace(replace(body,
             '${task.title}', 'a task'),
             '$taskTitle', 'a task'),
             '"$title"', 'a task'),
             ': $title', ': a task')
where body like '%${task.title}%' or body like '%$taskTitle%' or body like '%$title%';

update public.app_notifications
set body = replace(replace(replace(body,
             '$userName', 'A team member'),
             ' is now ${actualStatus.label}', ' status was updated'),
             'A subtask "${subtask.title}" was added', 'A subtask was added')
where body like '%$userName%' or body like '%${actualStatus.label}%' or body like '%${subtask.title}%';

update public.app_notifications n
set title = 'Announcement in ' || coalesce(nullif(ch.name, ''), 'Announcements')
from public.chat_channels ch
where ch.id = n.related_id and n.title like '%$channelName%';

update public.app_notifications
set title = replace(title, '$channelName', 'Announcements'),
    body = case when body like '%$senderName%' then 'New announcement posted' else body end
where title like '%$channelName%' or body like '%$senderName%';
