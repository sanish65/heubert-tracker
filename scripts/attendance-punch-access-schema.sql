-- ATTENDANCE WEB PUNCH ACCESS SCHEMA
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
-- Replaces the hardcoded punch-access allowlist with an admin-editable per-employee flag.

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS can_punch_web BOOLEAN NOT NULL DEFAULT false;

-- Seed the original testing group (amogh, ankit, sanish) so access isn't lost when this
-- replaces the previous hardcoded allowlist.
UPDATE employees
SET can_punch_web = true
WHERE lower(work_email) IN ('amogh@heubert.com', 'ankit@heubert.com', 'sanish@heubert.com')
   OR lower(personal_email) IN ('amogh@heubert.com', 'ankit@heubert.com', 'sanish@heubert.com');
