# Retro card themes — Code Review

**Request changes.** 0 CRITICAL · 1 HIGH · 2 MEDIUM · 6 LOW

| | |
| --- | --- |
| Blocking | HIGH · `docs/retro-card-themes/smoke.md:105` · 14 criteria rest on a smoke run that is not recorded as executed; run it (and `npm run build`) and record which steps ran |
| Branch | `feat/retro-card-themes` at `9d64ee2` over `ffe7acc` (feat/retro-action-items-kudos) · 12 files, +2296 −193 · 2026-10-08 |
| Reviewed against | security.md · security-web.md · security-llm.md (in-browser model, runtime-loaded code) · performance.md · CLAUDE.md + AGENTS.md conventions (no standards skills in this repo) |
| Scans | secrets N/A (not installed) · dependencies 0 new, 18 pre-existing · code N/A (not installed) |
| Not applicable | project skills (none exist) · mobile app (out of scope) |
| Failed to load | none |
| Read outside the diff | 11 — listed below |

Pre-existing, not this branch: npm audit's 18 advisories (1 critical `next`, 14 high incl. `eslint-config-next`, `nodemailer`, 2 moderate, 1 low) — no package added or bumped here; `setPromotedCardIds([])` in `resetToHome` (ffe7acc); lint error `sprint's` at `page.js:441` (931e384); `loggedInName` exhaustive-deps warning.

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`, `security-llm.md`) | B | MEDIUM · `src/lib/retroEmbeddings.js:7` · runtime third-party code, unpinned model | pin model revision; CSP or vendored lib |
| Performance | A | LOW · `src/lib/retroEmbeddings.js:15` · no timeout on model load | optional |
| CLAUDE.md conventions | A | LOW · `src/components/RetroThemeTools.js:49` · pure logic outside the tested module | move `findLateCards` to `retroThemes.js` |
| Criteria | C | HIGH · 14 manual criteria with no recorded run | run and record the smoke checklist |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Group into named themes, all templates | `retroThemes.test.mjs:136,179` (rules); in-app run | partly covered |
| 2 | One column per theme, each card in one | `retroThemes.test.mjs:58,68,179` + PK on `card_id` | covered |
| 3 | Small column stays plain | `retroThemes.test.mjs:174` | covered |
| 4 | No controls for others | `retroThemes.test.mjs:24`; route 403 unrecorded | partly covered |
| 5 | Model failure leaves board as it was | — | uncovered (manual, not recorded) |
| 6 | Hand-made theme | — | uncovered (manual, not recorded) |
| 7 | Move a card, visible to everyone | — | uncovered (manual, not recorded) |
| 8 | No move across columns | `retroThemes.test.mjs:58`; route check `route.js:433` | partly covered |
| 9 | Rename | — | uncovered (manual, not recorded) |
| 10 | Split | — | uncovered (manual, not recorded) |
| 11 | Empty theme disappears | `retroThemes.test.mjs:110` + prune | covered |
| 12 | Late card joins closest theme or starts one | `retroThemes.test.mjs:192,196` (placement rule) | partly covered |
| 12a | No facilitator open: waits, then placed | — | uncovered (manual, not recorded) |
| 13 | Manual changes survive late cards | — | uncovered (manual, not recorded) |
| 14 | Ungrouped column stays plain later | — (`findLateCards` untested) | uncovered |
| 15 | Edited card stays in theme | design only (`route.js:855–914`, no FK) | uncovered (manual, not recorded) |
| 16 | Model failure on a late card | — | uncovered (manual, not recorded) |
| 17 | Name, count, reaction total; ordered | `retroThemes.test.mjs:100,105` | partly covered |
| 18 | Cards inside themes behave as today | — (renderCard body unchanged by inspection) | uncovered (manual, not recorded) |
| 19 | Top Voted unchanged | — (diff does not touch it) | uncovered (manual, not recorded) |
| 20 | Ended board: themes shown, frozen | `retroThemes.test.mjs:28`; route 409 unrecorded | partly covered |
| 21 | Ungroup all | — | uncovered (manual, not recorded) |
| 22 | Regroup after ungroup | — | uncovered (manual, not recorded) |

The plan's "Manual: no integration setup in this repo" is true by repo convention (CLAUDE.md), but `smoke.md` itself records that no step is known to have run ("none is recorded as run … Everything else is unverified in a running app") and that its three "Needs a decision" items were unanswered. Manual coverage that was not performed is no coverage. Nothing built here is outside the criteria.

## Read outside the diff
- `src/app/api/retro/route.js:67–82` — `callerIsAdmin` verifies the bearer token with `supabase.auth.getUser` and maps it to `employees.is_admin`; the admin path on the five new actions is real, not a body flag.
- `src/app/api/retro/route.js:44–53` — `loadBoard` derives `isEnded` from the `__SESSION_ENDED__` signal card; the 409 path is sound.
- `src/lib/retroBoardRules.js:48` — `isFacilitator` is a normalised name match on a body field (see LOW finding, accepted by the intent).
- `src/app/api/retro/route.js:855–914` — `edit_card` re-inserts under `card.id` and never touches `retro_theme_cards`; with no FK the link survives, so AC 15 holds by design.
- `src/app/api/retro/route.js:685–691, 760–772` — cards are stored with the three DB values and mapped to template keys on read; the theme handler compares DB values on both sides, so the `retro_themes.column_type` check constraint holds for Sailboat and Start/Stop too.
- `src/lib/retroApi.js` — `postRetro` attaches the signed-in user's token, so a non-creator admin's theme tools reach `callerIsAdmin`.
- `src/components/RetrospectivePage.js:165–176, 637` — `canManageActions = isHost || !!isAdmin`; `voteCountFor` sums every emoji, matching AC 17's "reactions".
- `src/components/RetrospectivePage.js:165–694` — no early `return` before `useThemeAutoPlacement` at :647; hook order is stable.
- `package.json`, `next.config.mjs` — React 19.2.4 exports `useEffectEvent`; no CSP or security headers are configured.
- `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md:133` — `webpackIgnore: true` is honoured by Turbopack, so the runtime `import()` should survive the build (the build itself is not recorded as run).
- Ran `node --test src/lib/retroThemes.test.mjs` (26 pass) and `eslint` on the six changed source files (only the two known pre-existing items).

## Findings, by file

### `docs/retro-card-themes/smoke.md`

**HIGH · line 105 · unrecorded verification**
- What: Fourteen criteria (5, 6, 7, 9, 10, 12a, 13, 14, 15, 16, 18, 19, 21, 22) have no automated test by design, and the smoke record says no step is known to have run; the gate was "yeah good to go" with no steps named. The CDN `import()` under the real bundler, the `useEffectEvent` placement loop, and the two similarity thresholds against the real model have never been exercised on record.
- Why: The repo's stated coverage for routes and pages is the running app; without a recorded run the feature's main flows (group, place, fail-safe) are unverified, and `webpackIgnore` or a threshold mis-tune would surface for the first time in front of a team.
- Rule: review criteria pass, "uncovered acceptance criterion" · a test would have caught it: no, this is the test
- Fix: Run `npm run build`, then smoke steps 1, 3, 4, 6 and 9 at minimum (all three templates for step 1), and record in `smoke.md` which steps ran and the thresholds settled on. Answer "Needs a decision" 1–3.

### `src/lib/retroEmbeddings.js`

**MEDIUM · lines 7–16 · runtime third-party code, unpinned model**
- What: transformers.js is executed from `cdn.jsdelivr.net` at runtime via a dynamic `import()` (no SRI is possible on that form), it in turn fetches ONNX WASM from the CDN and the model from huggingface.co at revision `main` (unpinned), and the app sets no CSP. That code runs with the page's privileges, including the signed-in admin's Supabase session that supabase-js keeps in localStorage by default.
- Why: A compromised or altered artefact on either host becomes code running in the facilitator's or admin's authenticated page; version pinning guards against upstream drift, not against the host.
- Rule: `security.md` §5 (new dependency, exact versions), `security-web.md` §2 (new third-party origins, no policy), `security-llm.md` §4 (runtime-loaded artefacts pinned by version or hash) · a test would have caught it: no, a design choice
- Fix: Pass `revision` pinned to a commit hash in `pipeline(...)`; add a CSP in `next.config.mjs` allowlisting `cdn.jsdelivr.net` (script/worker) and `huggingface.co` + `cdn-lfs.huggingface.co` (connect) — or install `@huggingface/transformers` as a locked dependency and `import()` it from node_modules so the lockfile's integrity hash covers it while it still loads only on click. Record the origins in the intent either way.

**LOW · line 15 · no timeout on the model load**
- What: `loadGroupingModel()` has no time bound; a stalled 23 MB download leaves "Loading the grouping model…" and `busy` set until the tab is reloaded.
- Why: The first-use path is the slowest and the one most likely to stall on a corporate network.
- Rule: `performance.md` §3, `security.md` §8 · a test would have caught it: no
- Fix: Race the load against a timeout (about 90 s) in `handleGroup`, surfacing `MODEL_ERROR` on expiry; `loadGroupingModel` already forgets a failed promise so a retry works.

### `src/components/RetroThemeTools.js`

**MEDIUM · lines 96–134 · placement snapshot can undo a manual move**
- What: `columns` and `targets` are computed before `await vectorsFor(all)`, which on first use is the model download. A card the facilitator moves by hand (or deletes) during that wait is still in `col.late`, so the hook moves it again afterwards (or posts a move for a deleted card and surfaces a 404). The same stale snapshot lets a second facilitator browser post `create_theme` for a card that a concurrent `group_cards` just themed, pulling it into a one-card theme.
- Why: AC 13 says manual changes stay as they were and only the new card is placed; in the first-use window this is contradicted, and the result looks like the feature fighting the facilitator.
- Rule: review quality pass (stale closure across an await); AC 13 · a test would have caught it: no, needs two actors or a slow model
- Fix: Keep the latest `cards`/`themeCards` in refs updated each render and, immediately before each `send`, skip a card that is no longer present or no longer loose in the latest state.

**LOW · lines 106–110 · model failure swallowed and permanent**
- What: `catch (_)` discards the error with no `console.warn`, and `modelFailed` stays true for the page even if a later manual "Group similar cards" loads the model successfully.
- Why: A CDN or WASM failure cannot be diagnosed from the browser console, and late cards stay unplaced after the model has in fact recovered.
- Rule: review quality pass, errors surfaced · a test would have caught it: no
- Fix: `console.warn('Grouping model failed:', err)` before `onError`; clear `modelFailed` when `loadGroupingModel()` resolves (expose a `resetModelFailed` or check `extractorPromise` state).

**LOW · line 49 · pure decision logic outside the tested module**
- What: `findLateCards` decides which cards are placed (AC 12, 13, 14) and is pure, but lives in a component file that `npm test` cannot load, so AC 14's "later cards stay plain" has no test.
- Why: The plan's whole test strategy is that decisions live in `retroThemes.js`; this one slipped out of it.
- Rule: CLAUDE.md (only pure modules are unit-tested) · a test would have caught it: it is the missing test
- Fix: Move `findLateCards` (and the `vectorKey`/`isTemporary` helpers it needs) to `src/lib/retroThemes.js` and add two tests: a column with no shown themes yields nothing; a tried card is skipped.

**LOW · line 204 · dead branch**
- What: `if (!found.length)` cannot be true: `perColumn` already filters columns below `GROUPING_MIN_CARDS`, and `buildThemes` returns `[]` only below that minimum.
- Why: It implies a case that does not exist and duplicates the `tooFew` message path.
- Rule: review quality pass · a test would have caught it: no
- Fix: Remove the branch.

### `src/app/api/retro/route.js`

**LOW · line 439 · unbounded `created_by`**
- What: `actorName.trim()` is stored in `retro_themes.created_by` with no length bound; only `cleanThemeName` is bounded.
- Why: A free-length text column fed from a request body grows without limit; the name is personal data and should be bounded at the edge like the theme name is.
- Rule: `security.md` §2 (validated at the edge), `performance.md` §4 (column that grows without limit) · a test would have caught it: no, no route tests
- Fix: Reject `actorName` longer than a sane bound (the other name fields' limit, or 80) in step 1 of `handleTheme`.

**LOW · lines 379–408 · facilitator is a name claim**
- What: `isFacilitator(session, actorName)` trusts the body's `actorName`; anyone who knows the creator's name can group, ungroup, rename and move from `curl`. The intent explicitly keeps "the existing retro permissions" and names the share-page case, so this is recorded, not counted.
- Why: `security.md` §3 says identifiers in a request are claims; the new actions are destructive for everyone on the board (ungroup discards all themes).
- Rule: `security.md` §3, §9 · a test would have caught it: no, a model decision
- Fix: None in this PR; consider a creator token for retro boards as a follow-up ticket, since the theme actions raise the stakes of the name model.

## Top 3 priority fixes
1. `docs/retro-card-themes/smoke.md:105` — run `npm run build` and smoke steps 1, 3, 4, 6, 9; record what ran and the thresholds chosen.
2. `src/lib/retroEmbeddings.js:8,16` — pin the model revision and add a CSP (or vendor the library behind the lockfile).
3. `src/components/RetroThemeTools.js:120` — re-check each late card is still present and loose in the latest state before posting.

## Done well
- One import-free rules module (`retroThemes.js`) carries every decision and both pages render through the same `arrangeColumn`; its 26 tests assert behaviour (ordering, ties, refusals, naming), not mocks, and pass.
- The route mirrors `handleActionItem` faithfully: shape → board → facilitator/admin → ended → ownership, UUID shape checks before any query, ids minted server-side, theme lookups scoped to the session, the column rule enforced on the server, generic 500s with the detail logged.
- The concurrency notes are honest and mostly sound: the 60 s prune grace closes the create/prune race, caches and the tried-set are bounded, the in-flight ref and `useEffectEvent` keep the 2.5 s poll from double-posting, and a model failure is reported once per page.

## Built but not asked for
- Nothing outside the criteria. Small engineering extras, all in scope: the 60 s prune grace (plan said prune every empty theme), bounded vector cache and tried-set (1000 each), "Move to…" hidden when the column has no other theme, rename cancelled on blur.

## Blind spots
- Grouping quality with the real model (`CLUSTER_SIMILARITY` 0.5, `PLACE_SIMILARITY` 0.45) — only a run against all-MiniLM shows it; a fixture test with recorded vectors for a dozen known cards would pin the thresholds.
- The CDN `import()` under the production bundler and the ONNX WASM load — only `npm run build` plus one click shows it.
- Two-browser races (regroup vs. placement, ungroup vs. in-flight move) — need two sessions; no harness exists.
- Refusals on the five new actions (403 for a wrong name, 409 after end, 404 for a foreign theme) — proven only in unit tests on the rule functions; a route-level test would assert the status codes directly, but the repo has no route tests.

---
Stack: JavaScript (ESM) · Next.js 16 App Router route handler + React 19.2 client components · Supabase JS (PostgREST) · Postgres SQL script · plain CSS · Node test runner · transformers.js / ONNX Runtime Web in the browser. Passes applied shallowly: transformers.js runtime behaviour (what it fetches, from where) judged from its documented defaults, not from reading the library.
