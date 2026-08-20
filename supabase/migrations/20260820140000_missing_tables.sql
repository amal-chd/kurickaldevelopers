CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL,
  text TEXT NOT NULL,
  mentions JSONB,
  attachment_urls JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
  edited_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE IF NOT EXISTS subtasks (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  is_done BOOLEAN DEFAULT false,
  completed_by TEXT
);

CREATE TABLE IF NOT EXISTS performance_scores (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  total_tasks_completed INTEGER DEFAULT 0,
  total_tasks_assigned INTEGER DEFAULT 0,
  tasks_completed_on_time INTEGER DEFAULT 0,
  tasks_completed_late INTEGER DEFAULT 0,
  tasks_overdue INTEGER DEFAULT 0,
  tasks_rejected INTEGER DEFAULT 0,
  average_completion_time_hrs NUMERIC DEFAULT 0,
  quality_score NUMERIC DEFAULT 0,
  communication_score NUMERIC DEFAULT 0,
  reliability_score NUMERIC DEFAULT 0,
  overall_performance_index NUMERIC DEFAULT 0,
  points_balance INTEGER DEFAULT 0,
  points_lifetime INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY,
  company_name TEXT,
  company_logo TEXT,
  timezone TEXT,
  work_start_time TEXT,
  work_end_time TEXT,
  geofence_radius NUMERIC,
  geofence_lat NUMERIC,
  geofence_lng NUMERIC,
  currency TEXT,
  date_format TEXT,
  time_format TEXT,
  theme_color TEXT,
  language TEXT,
  features_enabled JSONB
);

ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE subtasks;

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all for anon" ON comments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON subtasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON performance_scores FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON settings FOR ALL USING (true) WITH CHECK (true);
