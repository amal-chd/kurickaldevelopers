-- ═══════════════════════════════════════════════════════════════════════════
--  Task Pilot — Pause Attendance Feature
--  - Blocks all check-ins, check-outs, and updates with a clear exception
--  - Denies SELECT access so mobile/web apps show empty state without error
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create trigger function to block new attendance posts / updates
CREATE OR REPLACE FUNCTION pause_attendance_submissions()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Attendance feature is temporarily paused by the administration.';
END;
$$ LANGUAGE plpgsql;

-- 2. Attach trigger to attendance table (fires before insert or update)
DROP TRIGGER IF EXISTS tr_pause_attendance ON public.attendance;
CREATE TRIGGER tr_pause_attendance
  BEFORE INSERT OR UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION pause_attendance_submissions();

-- 3. Ensure Row Level Security is enabled on attendance
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- 4. Drop permissive read policies if present
DROP POLICY IF EXISTS "Allow all for anon" ON public.attendance;
DROP POLICY IF EXISTS "attendance_read" ON public.attendance;
DROP POLICY IF EXISTS "pause_attendance_read" ON public.attendance;

-- 5. Create deny-all read policy (returns empty list [] with HTTP 200 OK to apps)
CREATE POLICY "pause_attendance_read"
  ON public.attendance
  FOR SELECT
  USING (false);
