-- EMPLOYEE RENAME CASCADE FIX
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
--
-- WHY
-- employees.name is used as the identity fines/leaves/standup_records/attendance/
-- push_tokens key off of (employee_name TEXT REFERENCES employees(name)), each with
-- ON DELETE CASCADE but no ON UPDATE CASCADE (Postgres default: NO ACTION). Deleting an
-- employee cascades fine, but renaming one via Edit Employee fails with:
--   update or delete on table "employees" violates foreign key constraint
--   "..._employee_name_fkey" on table "..."
-- whenever that employee already has fine/leave/standup/attendance history, because the
-- rename would orphan the old name in those tables.
--
-- WHAT THIS DOES
-- Finds every foreign key that references employees(name), regardless of table or
-- constraint name, and rebuilds it with ON UPDATE CASCADE added (keeping ON DELETE
-- CASCADE). After this, renaming an employee automatically renames them everywhere.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT tc.constraint_name, tc.table_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name AND tc.table_schema = ccu.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = 'public'
      AND ccu.table_name = 'employees'
      AND ccu.column_name = 'name'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I DROP CONSTRAINT %I, ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES employees(name) ON DELETE CASCADE ON UPDATE CASCADE',
      r.table_name, r.constraint_name, r.constraint_name, r.column_name
    );
    RAISE NOTICE 'Fixed %.% (%)', r.table_name, r.column_name, r.constraint_name;
  END LOOP;
END $$;
