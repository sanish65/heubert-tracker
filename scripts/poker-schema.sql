-- Planning Poker Sessions
create table if not exists poker_sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  created_by text not null,
  revealed boolean not null default false,
  created_at timestamptz not null default now()
);

-- Planning Poker Votes
-- one row per (session, participant) — unique constraint allows upsert
create table if not exists poker_votes (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references poker_sessions(id) on delete cascade,
  participant_name text not null,
  vote text not null,
  voted_at timestamptz not null default now(),
  unique (session_id, participant_name)
);

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Supabase enables RLS by default; without policies every anon request is
-- blocked. The poker feature is public/collaborative so we grant full access
-- to the anon role (same key used in the browser via NEXT_PUBLIC_SUPABASE_*).

alter table poker_sessions enable row level security;
alter table poker_votes     enable row level security;

-- Allow anyone (anon + authenticated) to read sessions
create policy "poker_sessions: public read"
  on poker_sessions for select
  using (true);

-- Allow anyone to create a session
create policy "poker_sessions: public insert"
  on poker_sessions for insert
  with check (true);

-- Allow anyone to update a session (reveal / reset)
create policy "poker_sessions: public update"
  on poker_sessions for update
  using (true);

-- Allow anyone to read votes
create policy "poker_votes: public read"
  on poker_votes for select
  using (true);

-- Allow anyone to cast / update their vote
create policy "poker_votes: public insert"
  on poker_votes for insert
  with check (true);

create policy "poker_votes: public update"
  on poker_votes for update
  using (true);

-- Allow cascade-delete to work when a session is deleted
create policy "poker_votes: public delete"
  on poker_votes for delete
  using (true);
