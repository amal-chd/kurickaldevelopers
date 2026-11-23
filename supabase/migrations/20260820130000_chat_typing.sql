CREATE TABLE IF NOT EXISTS chat_typing (
  channel_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  PRIMARY KEY (channel_id, user_id)
);

ALTER PUBLICATION supabase_realtime ADD TABLE chat_typing;
ALTER TABLE chat_typing ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for anon" ON chat_typing FOR ALL USING (true) WITH CHECK (true);
