-- LEAVE LEFT: WHICH LEAVE TYPES COUNT
-- On top of 20261022140055_task_workflows_filters.sql.
--
-- The employee directory's "Leave left" adds up every active leave type's allowance, so Work
-- From Home, Unpaid and Exam leave pushed it to 77 days. It should be the personal, sick and
-- festival allowance only (20 days). Each leave type now says whether it counts there; admins
-- switch it in Settings → Leave types. Types still have their own balances either way.

alter table public.leave_types
  add column if not exists counts_in_leave_left boolean not null default true;

update public.leave_types
set counts_in_leave_left = false
where is_unpaid
   or name ilike '%work from home%'
   or name ilike '%exam%';
