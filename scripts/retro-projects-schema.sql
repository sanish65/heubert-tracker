-- RETRO BOARDS → PROJECTS
-- Apply manually via the Supabase SQL editor (this project has no migration runner).
--
-- Every retro board that exists today was run by the ApplyIMS CRM team, back when
-- retrospectives had no project to belong to. This scopes boards to a project and
-- files that history under ApplyIMS CRM.
--
-- Nothing is deleted here: the only write is setting `project_id` on rows that have
-- none. Cards, reactions and timers hang off retro_sessions.id, which is untouched.
-- 1. Scope boards to a project.
--    Nullable + ON DELETE SET NULL (not CASCADE), the same rule leaves and fines
--    follow: deleting a project must never delete a team's retro history.
ALTER TABLE
  retro_sessions
ADD
  COLUMN IF NOT EXISTS project_id BIGINT REFERENCES projects(id) ON DELETE
SET
  NULL;

CREATE INDEX IF NOT EXISTS retro_sessions_project_id_idx ON retro_sessions(project_id);

-- 2. Preflight — run this SELECT on its own (the editor only shows the last statement's
--    result). Expect exactly one row. If it returns nothing, STOP: the project is named
--    differently, and step 3 would quietly file no boards at all.
SELECT
  id,
  name
FROM
  projects
WHERE
  lower(name) = lower('ApplyIMS CRM');

-- 3. Backfill the pre-project boards onto ApplyIMS CRM.
--    Every board created before this migration predates the project picker, so a NULL
--    project_id means "created in the CRM-only world". After this runs, the create form
--    always supplies a project, so a later re-run is a no-op.
--
--    Deliberately plain SQL, no DO $$ ... $$ block: SQL formatters split the dollar
--    quotes into "$ $" and Postgres then rejects the whole script. The EXISTS guard is
--    what the block's RAISE was for — with no such project, this updates zero rows and
--    leaves every board untouched rather than blanking project_id.
UPDATE
  retro_sessions
SET
  project_id = (
    SELECT
      id
    FROM
      projects
    WHERE
      lower(name) = lower('ApplyIMS CRM')
  )
WHERE
  project_id IS NULL
  AND EXISTS (
    SELECT
      1
    FROM
      projects
    WHERE
      lower(name) = lower('ApplyIMS CRM')
  );

-- 4. Verify (expect every board to name a project, and the card counts to be intact):
--
--   SELECT p.name AS project, s.title, s.created_by, s.created_at,
--          (SELECT count(*) FROM retro_cards c WHERE c.session_id = s.id) AS cards
--     FROM retro_sessions s
--     LEFT JOIN projects p ON p.id = s.project_id
--    ORDER BY s.created_at;
--
-- Or run: node scripts/check-retro-projects.mjs
