-- RETRO CARD THEMES
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
-- Needs scripts/retro-schema.sql applied first. Additive only: two new tables.
--
-- The facilitator groups a column's similar cards into named themes. A theme belongs to
-- one board and one column; each card is in at most one theme.

create table if not exists retro_themes (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references retro_sessions(id) on delete cascade,
  -- DB column value of the cards it holds, like retro_cards.column_type.
  column_type text not null check (column_type in ('went_well', 'improve', 'focus')),
  name        text not null check (length(btrim(name)) between 1 and 60),
  created_by  text not null,
  created_at  timestamptz not null default now()
);

create index if not exists retro_themes_session_id_idx on retro_themes(session_id);

-- Which theme a card is in. card_id is the key, so a card is in one theme at most.
-- Deliberately NOT a foreign key to retro_cards: edit_card in /api/retro deletes and
-- re-inserts a card under the same id, and a cascade would drop the card out of its
-- theme on every edit (AC 15). DELETE /api/retro removes the row with the card.
create table if not exists retro_theme_cards (
  card_id    uuid primary key,
  theme_id   uuid not null references retro_themes(id) on delete cascade,
  session_id uuid not null references retro_sessions(id) on delete cascade
);

create index if not exists retro_theme_cards_session_id_idx on retro_theme_cards(session_id);
create index if not exists retro_theme_cards_theme_id_idx on retro_theme_cards(theme_id);

-- ── Row Level Security ─────────────────────────────────────────────────────────
-- Same open policies as the other retro tables: guests on the share link have no auth,
-- so /api/retro is where who-may-do-what is enforced.
alter table retro_themes      enable row level security;
alter table retro_theme_cards enable row level security;

create policy "retro_themes: public read"   on retro_themes for select using (true);
create policy "retro_themes: public insert" on retro_themes for insert with check (true);
create policy "retro_themes: public update" on retro_themes for update using (true) with check (true);
create policy "retro_themes: public delete" on retro_themes for delete using (true);

create policy "retro_theme_cards: public read"   on retro_theme_cards for select using (true);
create policy "retro_theme_cards: public insert" on retro_theme_cards for insert with check (true);
create policy "retro_theme_cards: public update" on retro_theme_cards for update using (true) with check (true);
create policy "retro_theme_cards: public delete" on retro_theme_cards for delete using (true);

-- Verify:
--   select count(*) from retro_themes;       -- 0
--   select count(*) from retro_theme_cards;  -- 0
