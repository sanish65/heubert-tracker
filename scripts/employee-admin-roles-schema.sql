-- EMPLOYEE ADMIN ROLES SCHEMA
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
-- Replaces the hardcoded adminEmails/fineAdminEmails allowlists in AppContext.js with
-- admin-editable per-employee flags (see EmployeeList.js "Admins" / "Fine Admins" panels).

ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_fine_admin BOOLEAN NOT NULL DEFAULT false;

-- Preserve today's hardcoded admins so nobody loses access when this replaces the arrays.
UPDATE employees SET is_admin = true
WHERE lower(work_email) IN ('sanish@heubert.com', 'nikhil@heubert.com', 'pranay@heubert.com', 'pratisha@heubert.com', 'developers@heubert.com')
   OR lower(personal_email) IN ('sanish@heubert.com', 'nikhil@heubert.com', 'pranay@heubert.com', 'pratisha@heubert.com', 'developers@heubert.com');

UPDATE employees SET is_fine_admin = true
WHERE lower(work_email) IN ('sanish@heubert.com', 'developers@heubert.com')
   OR lower(personal_email) IN ('sanish@heubert.com', 'developers@heubert.com');
