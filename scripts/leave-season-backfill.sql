-- LEAVE SEASON BACKFILL
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
--
-- WHY
-- The header "Record Leave" quick-action on the Leaves tab opened AddLeaveModal without a
-- season, so those leaves were written with season_id = NULL. NULL means "recorded before
-- leave seasons existed" (the "Pre Fiscal Year Leaves" bucket), so the affected leaves
-- disappeared from the season-scoped Leave Calendar and from the season's balances, while
-- still showing up in the Dashboard's "Upcoming Leaves" list (which ignores seasons).
--
-- WHAT THIS FIXES
-- Only rows created AFTER a leave season already existed can be artifacts of that bug.
-- Rows created before the first season are genuinely pre-season and are left untouched.
-- Each repaired row is assigned the season that was current when the row was created.

-- 1. Preview — run this first and confirm the rows look right.
SELECT
  l.id,
  l.employee_name,
  l.start_date,
  l.created_at,
  (SELECT ls.id    FROM leave_seasons ls WHERE ls.created_at <= l.created_at ORDER BY ls.created_at DESC LIMIT 1) AS will_become_season_id,
  (SELECT ls.title FROM leave_seasons ls WHERE ls.created_at <= l.created_at ORDER BY ls.created_at DESC LIMIT 1) AS will_become_season
FROM leaves l
WHERE l.season_id IS NULL
  AND EXISTS (SELECT 1 FROM leave_seasons ls WHERE ls.created_at <= l.created_at)
ORDER BY l.created_at;

-- 2. Snapshot for rollback (keep until the backfill is verified).
CREATE TABLE IF NOT EXISTS leaves_season_backfill_backup AS
SELECT l.id, l.season_id, NOW() AS backed_up_at
FROM leaves l
WHERE l.season_id IS NULL
  AND EXISTS (SELECT 1 FROM leave_seasons ls WHERE ls.created_at <= l.created_at);

-- 3. Backfill.
UPDATE leaves l
SET season_id = (
  SELECT ls.id
  FROM leave_seasons ls
  WHERE ls.created_at <= l.created_at
  ORDER BY ls.created_at DESC
  LIMIT 1
)
WHERE l.season_id IS NULL
  AND EXISTS (SELECT 1 FROM leave_seasons ls WHERE ls.created_at <= l.created_at);

-- 4. Verify — this must return 0 rows.
SELECT l.id, l.employee_name, l.start_date, l.created_at
FROM leaves l
WHERE l.season_id IS NULL
  AND EXISTS (SELECT 1 FROM leave_seasons ls WHERE ls.created_at <= l.created_at);

-- Rollback, if ever needed:
--   UPDATE leaves l SET season_id = b.season_id
--   FROM leaves_season_backfill_backup b WHERE b.id = l.id;
