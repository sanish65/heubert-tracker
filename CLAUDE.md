@AGENTS.md

## Tests

Unit tests use Node's built-in runner: `npm test` (runs `src/**/*.test.mjs`). It needs Node 22+, which loads the repo's ESM `.js` files without a package `type` (with nvm: `nvm use 22`). Only pure modules with no `@/` imports are unit-tested; anything touching Supabase, a route or a page is verified in the running app.
