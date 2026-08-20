ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'under_review';
ALTER TYPE task_status ADD VALUE IF NOT EXISTS 'done';

ALTER TABLE chat_channels DROP CONSTRAINT chat_channels_project_id_fkey;
