-- EMPLOYEE LIST EXCLUSIONS SCHEMA
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
-- Replaces the hardcoded name/email exclusions scattered across Standup, Leaves, Late
-- Fines and Standup Fines with admin-editable per-employee flags (see EmployeeList.js).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS standup_excluded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leave_excluded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS late_fine_excluded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS standup_fine_excluded BOOLEAN NOT NULL DEFAULT false;

-- Preserve the exclusions that were previously hardcoded by name/email so behavior
-- doesn't change the moment this replaces the old checks.
UPDATE employees SET standup_excluded = true
WHERE lower(work_email) = 'developers@heubert.com'
   OR lower(personal_email) = 'developers@heubert.com'
   OR lower(split_part(name, ' ', 1)) = 'sameer';

UPDATE employees SET leave_excluded = true, late_fine_excluded = true, standup_fine_excluded = true
WHERE name = 'Developers';

UPDATE employees SET late_fine_excluded = true
WHERE name = 'Sameer';
