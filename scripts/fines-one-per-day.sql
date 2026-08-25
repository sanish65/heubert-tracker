-- LATE FINES: ONE PER PERSON PER DAY
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
--
-- Being late is a single event per day, so a person can have at most one late fine on a
-- given date regardless of amount. The app now enforces this in addFine(), but a unique
-- index makes it impossible to violate from anywhere (SQL editor, scripts, a stale client).
--
-- Standup fines are a separate table (standup_records) and are NOT affected.

-- 1. Find the existing violations. The index cannot be created until each of these
--    person/date groups has exactly one row left — decide which amount is correct.
SELECT employee_name, date, COUNT(*) AS fine_count,
       STRING_AGG(id || ':Rs' || amount, '  ' ORDER BY id) AS rows
FROM fines
GROUP BY employee_name, date
HAVING COUNT(*) > 1
ORDER BY date;

-- 2. Delete the extras by id once you have decided which to keep, e.g.:
--    DELETE FROM fines WHERE id IN (...);

-- 3. Enforce the rule. Fails while any duplicate from step 1 remains.
CREATE UNIQUE INDEX IF NOT EXISTS fines_one_per_person_per_day
  ON fines (employee_name, date);

-- To drop it again:
--   DROP INDEX IF EXISTS fines_one_per_person_per_day;
