-- RETRO ACTION ITEMS + KUDOS
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
-- Needs scripts/retro-schema.sql and scripts/retro-projects-schema.sql applied first.
-- Nothing existing is altered: three new tables only.

-- ── Action items ───────────────────────────────────────────────────────────────
-- An item belongs to the board it was first added on (session_id). Later boards of the
-- same project show it while it is open; see selectBoardActionItems in
-- src/lib/retroBoardRules.js. done_at doubles as the carry-forward cut-off: boards
-- created after it leave the item off.
create table if not exists retro_action_items (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references retro_sessions(id) on delete cascade,
  content           text not null check (length(btrim(content)) > 0),
  -- Owner is optional, and an employee leaving must not take the item with them.
  owner_employee_id bigint references employees(id) on delete set null,
  created_by        text not null,
  done_at           timestamptz,
  done_by           text,
  created_at        timestamptz not null default now()
);

create index if not exists retro_action_items_session_id_idx on retro_action_items(session_id);

-- ── Kudos ──────────────────────────────────────────────────────────────────────
-- Stays on its own board; nothing carries forward.
create table if not exists retro_kudos (
  id                  uuid primary key default gen_random_uuid(),
  session_id          uuid not null references retro_sessions(id) on delete cascade,
  content             text not null check (length(btrim(content)) > 0),
  author              text not null,
  tagged_employee_ids bigint[] not null default '{}',
  created_at          timestamptz not null default now()
);

create index if not exists retro_kudos_session_id_idx on retro_kudos(session_id);

-- One row per (kudos, participant, emoji) — the same shape as retro_card_reactions.
create table if not exists retro_kudos_reactions (
  id               uuid primary key default gen_random_uuid(),
  kudos_id         uuid not null references retro_kudos(id) on delete cascade,
  session_id       uuid not null references retro_sessions(id) on delete cascade,
  participant_name text not null,
  emoji            text not null,
  created_at       timestamptz not null default now(),
  unique (kudos_id, participant_name, emoji)
);

create index if not exists retro_kudos_reactions_session_id_idx on retro_kudos_reactions(session_id);

-- ── Row Level Security ─────────────────────────────────────────────────────────
-- Same open policies as the other retro tables: guests on the share link have no auth,
-- so /api/retro is where who-may-do-what is enforced.
alter table retro_action_items    enable row level security;
alter table retro_kudos           enable row level security;
alter table retro_kudos_reactions enable row level security;

create policy "retro_action_items: public read"   on retro_action_items for select using (true);
create policy "retro_action_items: public insert" on retro_action_items for insert with check (true);
create policy "retro_action_items: public update" on retro_action_items for update using (true) with check (true);
create policy "retro_action_items: public delete" on retro_action_items for delete using (true);

create policy "retro_kudos: public read"   on retro_kudos for select using (true);
create policy "retro_kudos: public insert" on retro_kudos for insert with check (true);
create policy "retro_kudos: public update" on retro_kudos for update using (true) with check (true);
create policy "retro_kudos: public delete" on retro_kudos for delete using (true);

create policy "retro_kudos_reactions: public read"   on retro_kudos_reactions for select using (true);
create policy "retro_kudos_reactions: public insert" on retro_kudos_reactions for insert with check (true);
create policy "retro_kudos_reactions: public delete" on retro_kudos_reactions for delete using (true);

-- Verify:
--   select count(*) from retro_action_items;     -- 0
--   select count(*) from retro_kudos;            -- 0
--   select count(*) from retro_kudos_reactions;  -- 0
