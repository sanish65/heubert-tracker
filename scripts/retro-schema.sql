-- ── Retrospective Sessions ───────────────────────────────────────────────────
create table if not exists retro_sessions (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  created_by text not null,
  created_at timestamptz not null default now()
);

-- ── Retrospective Cards ───────────────────────────────────────────────────────
-- column_type must be one of: went_well | improve | focus
create table if not exists retro_cards (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references retro_sessions(id) on delete cascade,
  column_type text not null check (column_type in ('went_well', 'improve', 'focus')),
  content     text not null,
  author      text not null,
  created_at  timestamptz not null default now()
);

-- ── Retrospective Card Votes ──────────────────────────────────────────────────
-- One vote per participant per card (for action item prioritisation)
create table if not exists retro_card_votes (
  id               uuid primary key default gen_random_uuid(),
  card_id          uuid not null references retro_cards(id) on delete cascade,
  session_id       uuid not null references retro_sessions(id) on delete cascade,
  participant_name text not null,
  created_at       timestamptz not null default now(),
  unique(card_id, participant_name)
);

-- ── Row Level Security ────────────────────────────────────────────────────────
alter table retro_sessions    enable row level security;
alter table retro_cards       enable row level security;
alter table retro_card_votes  enable row level security;

create policy "retro_sessions: public read"
  on retro_sessions for select using (true);
create policy "retro_sessions: public insert"
  on retro_sessions for insert with check (true);

create policy "retro_cards: public read"
  on retro_cards for select using (true);
create policy "retro_cards: public insert"
  on retro_cards for insert with check (true);
create policy "retro_cards: public delete"
  on retro_cards for delete using (true);

create policy "retro_card_votes: public read"
  on retro_card_votes for select using (true);
create policy "retro_card_votes: public insert"
  on retro_card_votes for insert with check (true);
create policy "retro_card_votes: public delete"
  on retro_card_votes for delete using (true);
