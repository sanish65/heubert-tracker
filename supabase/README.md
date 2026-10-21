# Database migrations

Schema changes for the primary Supabase project live in `supabase/migrations/`, one
timestamped SQL file per change, committed with the code that needs it. The Supabase CLI
(a dev dependency, run through `npx supabase` or the npm scripts below) applies the files
the database hasn't seen yet and records them in `supabase_migrations.schema_migrations`,
so nobody has to remember which script was pasted where.

The standup project (`NEXT_PUBLIC_STANDUP_SUPABASE_URL`) is not covered yet.

The SQL files in `scripts/` are the history from before this existed. They are already
applied and are captured by the baseline migration; don't run them again and don't add new
ones there.

## Day to day

```bash
npm run db:new -- add_timesheets   # creates supabase/migrations/<timestamp>_add_timesheets.sql
npm run db:status                  # local files vs what production has applied
npm run db:check                   # dry run: what db:push would apply
npm run db:push                    # apply pending migrations to the linked project
```

Write migrations so they are safe to read top to bottom once: `CREATE TABLE IF NOT EXISTS`,
`DROP POLICY IF EXISTS` before `CREATE POLICY`, and real row level security (see the
`app_current_employee()` / `app_is_admin()` helpers) rather than `USING (true)` writes.
Never edit a migration that has already been applied; add a new one.

Pushing from your machine needs it linked once (below). After a merge to `main`, Bitbucket
Pipelines shows the pending migrations and offers a manual "Apply migrations to production"
step, which is the normal way to ship them.

## One-time setup on your machine

```bash
npx supabase login                                   # opens the browser
npx supabase link --project-ref <project-ref>        # asks for the database password
```

## One-time baseline (done 2026-10-19, kept for reference)

Production was built by pasting `scripts/*.sql` by hand, so its migration history is
empty. The baseline captures today's schema as the first migration and marks it as already
applied, so it never runs against production. `db dump` is used rather than `db pull`
because pull refuses to run while the folder holds migrations production hasn't seen.

```bash
npx supabase db dump --linked -f supabase/migrations/20260101000000_baseline.sql
npx supabase migration repair --status applied 20260101000000
npm run db:status   # baseline shows as applied on both sides; newer files are pending
```

The early timestamp keeps the baseline ahead of every real migration in the folder.

The dump covers the `public` schema only. Storage buckets and their policies (used by
Memories) are managed by Supabase and are not in the baseline.

## Bitbucket repository variables

Set these as secured variables under Repository settings → Pipelines → Repository
variables: `SUPABASE_ACCESS_TOKEN` (from supabase.com/dashboard/account/tokens),
`SUPABASE_DB_PASSWORD` and `SUPABASE_PROJECT_REF`.
