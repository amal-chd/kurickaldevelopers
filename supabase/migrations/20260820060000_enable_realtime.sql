-- Enable realtime for tables that need live subscriptions
ALTER PUBLICATION supabase_realtime ADD TABLE chat_channels;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE app_notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE attendance;

-- Disable RLS for now (we'll use Firebase Auth + app-level checks during transition)
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_diaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE salary_slips ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE performance_reviews ENABLE ROW LEVEL SECURITY;

-- Allow anon key full access (matching the current Firebase setup where security is app-level)
CREATE POLICY "Allow all for anon" ON roles FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON tasks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON attendance FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON chat_channels FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON chat_messages FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON chat_attachments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON documents FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON site_diaries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON leave_requests FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON salary_slips FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON expenses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON contact_inquiries FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON app_notifications FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON audit_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON performance_reviews FOR ALL USING (true) WITH CHECK (true);
