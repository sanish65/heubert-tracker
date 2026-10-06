-- ADMIN WRITE PERMISSIONS (ROW LEVEL SECURITY)
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
--
-- Until now every table carried `CREATE POLICY "Public Write" ... FOR ALL USING (true)`,
-- so the database enforced nothing: the browser holds the anon key, and anyone who opened
-- devtools could insert a fine, delete someone's leave or make themselves an admin. The UI
-- gating added alongside this file is for clarity; THIS file is the actual boundary.
--
-- The rule it encodes:
--   * Late fines, standup fines, fine seasons, withdrawals  -> admins and fine admins
--   * Leaves                                                -> admins, or your own leave
--   * Public holidays, leave seasons, leave types           -> admins
--   * Attendance                                            -> admins; you may punch yourself
--   * Employees (which holds is_admin itself)               -> admins
--
-- Reading stays public for everyone, exactly as before — this only changes writes.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Who is asking?
-- ─────────────────────────────────────────────────────────────────────────────
-- Mirrors how AppContext resolves currentEmployee: match the signed-in user's email
-- against work_email or personal_email, case-insensitively.
--
-- SECURITY DEFINER so the lookup reads `employees` under the function owner rather than
-- the caller — without it, the employees policies below would recurse into this function.
-- STABLE lets the planner call it once per statement instead of once per row.
-- The empty search_path stops a caller from shadowing `employees` with their own table.

CREATE OR REPLACE FUNCTION public.app_current_employee()
RETURNS public.employees
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT e.*
  FROM public.employees e
  WHERE lower(e.work_email) = lower(auth.jwt() ->> 'email')
     OR lower(e.personal_email) = lower(auth.jwt() ->> 'email')
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.app_employee_name()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (public.app_current_employee()).name;
$$;

CREATE OR REPLACE FUNCTION public.app_is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((public.app_current_employee()).is_admin, false);
$$;

-- Fine admins are a narrower role that exists so fines can be handed to someone who is
-- not a full admin. Admins keep the power too.
CREATE OR REPLACE FUNCTION public.app_can_manage_fines()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((public.app_current_employee()).is_admin, false)
      OR COALESCE((public.app_current_employee()).is_fine_admin, false);
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Who entered a leave
-- ─────────────────────────────────────────────────────────────────────────────
-- "My own leave" means either the leave is FOR me (employee_name) or I was the one who
-- entered it (created_by). Existing rows have no created_by and fall back to the
-- employee_name match, which is how LeavePage already decided this.

ALTER TABLE public.leaves
  ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE OR REPLACE FUNCTION public.app_owns_leave(leave_employee_name text, leave_created_by text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (leave_employee_name IS NOT NULL AND leave_employee_name = public.app_employee_name())
      OR (leave_created_by IS NOT NULL AND lower(leave_created_by) = lower(auth.jwt() ->> 'email'));
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Drop the blanket write policies
-- ─────────────────────────────────────────────────────────────────────────────
-- "Public Read" is deliberately left in place on every table: everyone still sees
-- everything, which is what the dashboards, tables and totals rely on.

DROP POLICY IF EXISTS "Public Write" ON public.fines;
DROP POLICY IF EXISTS "Public Write" ON public.standup_records;
DROP POLICY IF EXISTS "Public Write" ON public.leaves;
DROP POLICY IF EXISTS "Public Write" ON public.public_holidays;
DROP POLICY IF EXISTS "Public Write" ON public.attendance;
DROP POLICY IF EXISTS "Public Write" ON public.employees;
DROP POLICY IF EXISTS "Public Write" ON public.fine_seasons;
DROP POLICY IF EXISTS "Public Write" ON public.leave_seasons;
DROP POLICY IF EXISTS "Public Write" ON public.leave_types;
DROP POLICY IF EXISTS "Public Write" ON public.withdrawals;
DROP POLICY IF EXISTS "Public Write" ON public.office_settings;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Late fines
-- ─────────────────────────────────────────────────────────────────────────────
-- Insert also allows a fine against YOURSELF. That is not a courtesy: mobile punch-in
-- auto-creates the late fine for the person punching in (mobile/context/AppContext.js),
-- and that employee is usually not an admin. The worst someone can do with it is fine
-- themselves. The UI never offers it — the Record Fine button is admin-only.

DROP POLICY IF EXISTS "Fine admins write" ON public.fines;
DROP POLICY IF EXISTS "Fine admins update" ON public.fines;
DROP POLICY IF EXISTS "Fine admins delete" ON public.fines;

CREATE POLICY "Fine admins write" ON public.fines
  FOR INSERT WITH CHECK (
    public.app_can_manage_fines()
    OR employee_name = public.app_employee_name()
  );

CREATE POLICY "Fine admins update" ON public.fines
  FOR UPDATE USING (public.app_can_manage_fines())
  WITH CHECK (public.app_can_manage_fines());

CREATE POLICY "Fine admins delete" ON public.fines
  FOR DELETE USING (public.app_can_manage_fines());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Standup fines
-- ─────────────────────────────────────────────────────────────────────────────
-- No self-insert here: nothing creates a standup fine automatically, so every one of
-- them is somebody deciding another person missed standup.

DROP POLICY IF EXISTS "Fine admins write" ON public.standup_records;
DROP POLICY IF EXISTS "Fine admins update" ON public.standup_records;
DROP POLICY IF EXISTS "Fine admins delete" ON public.standup_records;

CREATE POLICY "Fine admins write" ON public.standup_records
  FOR INSERT WITH CHECK (public.app_can_manage_fines());

CREATE POLICY "Fine admins update" ON public.standup_records
  FOR UPDATE USING (public.app_can_manage_fines())
  WITH CHECK (public.app_can_manage_fines());

CREATE POLICY "Fine admins delete" ON public.standup_records
  FOR DELETE USING (public.app_can_manage_fines());

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. Fine seasons and withdrawals
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Fine admins write" ON public.fine_seasons;
CREATE POLICY "Fine admins write" ON public.fine_seasons
  FOR ALL USING (public.app_can_manage_fines())
  WITH CHECK (public.app_can_manage_fines());

DROP POLICY IF EXISTS "Fine admins write" ON public.withdrawals;
CREATE POLICY "Fine admins write" ON public.withdrawals
  FOR ALL USING (public.app_can_manage_fines())
  WITH CHECK (public.app_can_manage_fines());

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. Leaves — admins, or your own
-- ─────────────────────────────────────────────────────────────────────────────
-- UPDATE needs both USING (may I touch the row as it stands?) and WITH CHECK (may the
-- row still be mine afterwards?). Without the WITH CHECK, someone could edit their own
-- leave and reassign it to a colleague on the way out.

DROP POLICY IF EXISTS "Admins or own leave write" ON public.leaves;
DROP POLICY IF EXISTS "Admins or own leave update" ON public.leaves;
DROP POLICY IF EXISTS "Admins or own leave delete" ON public.leaves;

-- Creating is deliberately narrower than editing: you may book leave for YOURSELF, not
-- for a colleague. Going by created_by here instead would let any employee book leave in
-- anyone's name, since they are always the creator of their own insert.
CREATE POLICY "Admins or own leave write" ON public.leaves
  FOR INSERT WITH CHECK (
    public.app_is_admin()
    OR employee_name = public.app_employee_name()
  );

CREATE POLICY "Admins or own leave update" ON public.leaves
  FOR UPDATE
  USING (public.app_is_admin() OR public.app_owns_leave(employee_name, created_by))
  WITH CHECK (public.app_is_admin() OR public.app_owns_leave(employee_name, created_by));

CREATE POLICY "Admins or own leave delete" ON public.leaves
  FOR DELETE USING (
    public.app_is_admin()
    OR public.app_owns_leave(employee_name, created_by)
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. Admin-only tables
-- ─────────────────────────────────────────────────────────────────────────────
-- employees is in here because it holds is_admin itself. Leaving it writable would make
-- every other policy on this page decorative — anyone could promote themselves first.

DROP POLICY IF EXISTS "Admins write" ON public.public_holidays;
CREATE POLICY "Admins write" ON public.public_holidays
  FOR ALL USING (public.app_is_admin()) WITH CHECK (public.app_is_admin());

DROP POLICY IF EXISTS "Admins write" ON public.leave_seasons;
CREATE POLICY "Admins write" ON public.leave_seasons
  FOR ALL USING (public.app_is_admin()) WITH CHECK (public.app_is_admin());

DROP POLICY IF EXISTS "Admins write" ON public.leave_types;
CREATE POLICY "Admins write" ON public.leave_types
  FOR ALL USING (public.app_is_admin()) WITH CHECK (public.app_is_admin());

DROP POLICY IF EXISTS "Admins write" ON public.office_settings;
CREATE POLICY "Admins write" ON public.office_settings
  FOR ALL USING (public.app_is_admin()) WITH CHECK (public.app_is_admin());

DROP POLICY IF EXISTS "Admins write" ON public.employees;
CREATE POLICY "Admins write" ON public.employees
  FOR ALL USING (public.app_is_admin()) WITH CHECK (public.app_is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. Attendance — admins maintain it, everyone punches themselves
-- ─────────────────────────────────────────────────────────────────────────────
-- Punching in/out is an insert then an update of your own row, so both commands allow
-- the self case. Deleting a day is a correction, so that stays admin-only.
-- Who may punch at all is still decided by employees.can_punch_web in the app; this only
-- makes sure nobody punches as somebody else.

DROP POLICY IF EXISTS "Admins or own attendance write" ON public.attendance;
DROP POLICY IF EXISTS "Admins or own attendance update" ON public.attendance;
DROP POLICY IF EXISTS "Admins delete attendance" ON public.attendance;

CREATE POLICY "Admins or own attendance write" ON public.attendance
  FOR INSERT WITH CHECK (
    public.app_is_admin() OR employee_name = public.app_employee_name()
  );

CREATE POLICY "Admins or own attendance update" ON public.attendance
  FOR UPDATE
  USING (public.app_is_admin() OR employee_name = public.app_employee_name())
  WITH CHECK (public.app_is_admin() OR employee_name = public.app_employee_name());

CREATE POLICY "Admins delete attendance" ON public.attendance
  FOR DELETE USING (public.app_is_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 10. Check it took
-- ─────────────────────────────────────────────────────────────────────────────
-- Run this after applying. Every row should show the new policy names, and no table
-- listed here should still have a "Public Write".
--
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('fines','standup_records','leaves','public_holidays','attendance',
--                     'employees','fine_seasons','leave_seasons','leave_types',
--                     'withdrawals','office_settings')
-- ORDER BY tablename, cmd;
