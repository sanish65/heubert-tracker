-- Team Memories: row-level security.
--
-- Symptom this fixes: a memory's author clicks the bin, the card disappears, and the
-- memory is back after a reload. With RLS on and no DELETE/UPDATE policy, PostgREST
-- does not error — the statement simply matches zero rows and returns 204, so the API
-- read it as success. /api/memories now verifies the row came back, but the write
-- still needs a policy to land (or SUPABASE_SERVICE_ROLE_KEY set on the server, which
-- bypasses RLS entirely).
--
-- Run in the Supabase SQL editor. Safe to re-run.

alter table public.memories enable row level security;

-- Anyone signed in can read the wall.
drop policy if exists "memories_select_authenticated" on public.memories;
create policy "memories_select_authenticated"
  on public.memories for select
  to authenticated
  using (true);

-- You may only pin a memory under your own address.
drop policy if exists "memories_insert_own" on public.memories;
create policy "memories_insert_own"
  on public.memories for insert
  to authenticated
  with check (author_email = auth.jwt() ->> 'email');

-- Authors may edit their own memories, and may not reassign them to someone else.
drop policy if exists "memories_update_own" on public.memories;
create policy "memories_update_own"
  on public.memories for update
  to authenticated
  using (author_email = auth.jwt() ->> 'email')
  with check (author_email = auth.jwt() ->> 'email');

-- Authors may delete their own memories.
drop policy if exists "memories_delete_own" on public.memories;
create policy "memories_delete_own"
  on public.memories for delete
  to authenticated
  using (author_email = auth.jwt() ->> 'email');
