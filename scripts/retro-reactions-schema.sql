-- ── Retrospective Card Reactions ──────────────────────────────────────────────
-- Multiple emoji reactions per card, one row per (card, participant, emoji)
create table if not exists retro_card_reactions (
  id               uuid primary key default gen_random_uuid(),
  card_id          uuid not null references retro_cards(id) on delete cascade,
  session_id       uuid not null references retro_sessions(id) on delete cascade,
  participant_name text not null,
  emoji            text not null,
  created_at       timestamptz not null default now(),
  unique(card_id, participant_name, emoji)
);

alter table retro_card_reactions enable row level security;

create policy "retro_card_reactions: public read"
  on retro_card_reactions for select using (true);
create policy "retro_card_reactions: public insert"
  on retro_card_reactions for insert with check (true);
create policy "retro_card_reactions: public delete"
  on retro_card_reactions for delete using (true);
