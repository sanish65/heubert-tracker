-- DAILY SYNC SHOUTOUTS & KUDOS
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
-- Needs scripts/admin-write-permissions-rls.sql applied first (app_current_employee,
-- app_is_admin). Additive only: one new table.
--
-- Any signed-in colleague posts a shoutout on the Start Meeting page, optionally tagging
-- the colleagues it is for. Each shoutout belongs to the meeting day it was posted on.

create table if not exists meeting_shoutouts (
  id                  uuid primary key default gen_random_uuid(),
  shoutout_date       date not null,
  content             text not null check (length(btrim(content)) > 0),
  author              text not null,
  -- Who posted it. Set null rather than delete: a colleague leaving must not erase the
  -- kudos they gave.
  author_employee_id  bigint references employees(id) on delete set null,
  tagged_employee_ids bigint[] not null default '{}',
  created_at          timestamptz not null default now()
);

create index if not exists meeting_shoutouts_date_idx on meeting_shoutouts(shoutout_date);

-- ── Row Level Security ─────────────────────────────────────────────────────────
-- Everyone reads. You post only as yourself, edit only your own, and delete your own —
-- admins can delete any (e.g. something posted by mistake).
alter table meeting_shoutouts enable row level security;

create policy "meeting_shoutouts: public read"
  on meeting_shoutouts for select using (true);

create policy "meeting_shoutouts: post as yourself"
  on meeting_shoutouts for insert
  with check (author_employee_id = (public.app_current_employee()).id);

create policy "meeting_shoutouts: edit your own"
  on meeting_shoutouts for update
  using (author_employee_id = (public.app_current_employee()).id)
  with check (author_employee_id = (public.app_current_employee()).id);

create policy "meeting_shoutouts: delete your own, or admin"
  on meeting_shoutouts for delete
  using (public.app_is_admin() or author_employee_id = (public.app_current_employee()).id);

-- Verify:
--   select count(*) from meeting_shoutouts;   -- 0
