-- Per-member task progress + completion metadata.
-- Both apps model these (Task.memberProgress / completionStatus / delaySeconds)
-- but the columns were never created during the Firestore→Supabase migration,
-- so web silently dropped them and mobile explicitly stripped them on write.
-- Result: "Member Progress" always showed "In Progress" and completion
-- timing (on time / late) was lost.
alter table public.tasks
  add column if not exists member_progress jsonb not null default '{}'::jsonb,
  add column if not exists completion_status text,
  add column if not exists delay_seconds integer;
