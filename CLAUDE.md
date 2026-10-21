@AGENTS.md

## Tests

Unit tests use Node's built-in runner: `npm test` (runs `src/**/*.test.mjs`). It needs Node 22+, which loads the repo's ESM `.js` files without a package `type` (with nvm: `nvm use 22`). Only pure modules with no `@/` imports are unit-tested; anything touching Supabase, a route or a page is verified in the running app.

## Database changes

Schema changes go in a new file under `supabase/migrations/` (`npm run db:new -- <name>`), never in `scripts/` and never pasted into the SQL editor. `scripts/*.sql` is pre-migration history, already applied. Don't edit a migration that has been applied; add another. Setup, the baseline and the deploy flow are in `supabase/README.md`. Don't run `db:push` against production yourself; it ships through the manual Bitbucket Pipelines step.
