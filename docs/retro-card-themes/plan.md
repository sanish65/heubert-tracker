# Group Similar Retro Cards into Themes Implementation Plan

**Intent:** docs/retro-card-themes/intent.md
**Branch:** `feat/retro-card-themes`, created from `feat/retro-action-items-kudos` once that branch's pending changes are committed (decided by Sanish, 2026-10-08). Rebase onto `main` when the action-items work merges.
**Goal:** The facilitator turns crowded retro columns into named themes of similar cards in one click, corrects them by hand, and late cards join the right theme on their own, with no paid service.
**Approach:** Card text becomes vectors in the facilitator's browser with a small open-source sentence model (all-MiniLM-L6-v2 via transformers.js, loaded from a CDN at runtime, never bundled). Pure, import-free functions group the vectors, name each theme from shared words, and decide where a late card goes. `/api/retro` stores themes in two new tables and enforces who may change them. Both board pages show themes through one shared `arrangeColumn` function, so the web tab and the share page cannot drift.
**Test layers:** Unit only, plus a manual smoke run. Everything that decides behaviour (permissions, validating a proposed theme set, grouping, naming, placing a late card, how a column is arranged and ordered) lives in `src/lib/retroThemes.js`, an import-free module that `npm test` covers (criteria 1–4, 8, 10–14, 17, 20, 22, and the refusal cases for the new write actions). The criteria that cross a boundary need a browser, Supabase, the API route and the CDN model download together: 5–7, 9, 12a, 15, 16, 18, 19 and 21, plus the end-to-end side of the rest. This repo has no integration or end-to-end runner, and `CLAUDE.md` says anything touching Supabase, a route or a page "is verified in the running app". Those criteria are marked "Manual: no integration setup in this repo" in the coverage table, with a smoke checklist at the end. The new API actions are a new access path. Their refusals (non-facilitator, ended board, a card from another board, mixed columns) are proven in unit tests on `canChangeThemes` and `checkThemes`, which the route calls, and checked once more against the running route with `curl` in the smoke run.
**Constraints (from CLAUDE.md / AGENTS.md, verbatim):**
- "Unit tests use Node's built-in runner: `npm test` (runs `src/**/*.test.mjs`). It needs Node 22+, which loads the repo's ESM `.js` files without a package `type` (with nvm: `nvm use 22`)."
- "Only pure modules with no `@/` imports are unit-tested; anything touching Supabase, a route or a page is verified in the running app."
- "This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."
- Project conventions (memory): JavaScript only, plain CSS in `src/app/globals.css`, Supabase called directly. Select dropdown colours come from the global `option`/`color-scheme` rule in `globals.css`. Never add per-class `option` fixes.
- Schema changes are SQL scripts in `scripts/`, applied by hand in the Supabase SQL editor. There is no migration runner.

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| `src/lib/retroThemes.js` | Create | Import-free rules and maths: constants, `canChangeThemes`, `cleanThemeName`, `checkThemes`, `arrangeColumn`, `similarity`, `clusterByMeaning`, `nameFromTexts`, `buildThemes`, `placeCard`. The single definition every other file imports. |
| `src/lib/retroThemes.test.mjs` | Create | Unit tests for the above. |
| `scripts/retro-card-themes-schema.sql` | Create | `retro_themes` and `retro_theme_cards` tables, indexes, open RLS policies like the other retro tables. |
| `src/lib/retroEmbeddings.js` | Create | Browser-only: loads transformers.js and the model from CDNs on first use; `embedTexts(texts)`. |
| `src/app/api/retro/route.js` | Modify | GET returns `themes` and `themeCards`; POST actions `group_cards`, `create_theme`, `move_card_to_theme`, `rename_theme`, `ungroup_cards`; DELETE also drops the card's theme link. |
| `src/components/RetroThemeTools.js` | Create | Web tab facilitator toolbar: Group similar cards, Ungroup all, selection → New theme, and the auto-placement hook `useThemeAutoPlacement`. |
| `src/components/RetrospectivePage.js` | Modify | Hold `themes`/`themeCards` state; render each column through `arrangeColumn`; theme headers with rename, per-card Move to and selection controls for facilitator/admin; mount `RetroThemeTools`. |
| `src/app/retrospective/[sessionId]/page.js` | Modify | Hold `themes`/`themeCards`; render each column through `arrangeColumn`, read-only. |
| `src/app/globals.css` | Modify | `.retro-theme*` styles for theme blocks, headers, toolbar and selection. |

## Task 1: Theme rules: permissions, validation, column arrangement
**Delivers:** acceptance criteria 2, 4, 8, 11, 17, 20 (rules side).
**Files:** create `src/lib/retroThemes.js`, create `src/lib/retroThemes.test.mjs`.
**Kind:** transcription

- [ ] Step 1: write the failing test, `src/lib/retroThemes.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEME_NAME_MAX,
  canChangeThemes,
  cleanThemeName,
  checkThemes,
  arrangeColumn,
} from './retroThemes.js';

// ── canChangeThemes ──
test('facilitator or admin may change themes on an open board (AC 4)', () => {
  assert.equal(canChangeThemes({ isEnded: false, isFacilitator: true, isAdmin: false }), true);
  assert.equal(canChangeThemes({ isEnded: false, isFacilitator: false, isAdmin: true }), true);
});

test('anyone else is refused (AC 4)', () => {
  assert.equal(canChangeThemes({ isEnded: false, isFacilitator: false, isAdmin: false }), false);
});

test('nobody changes themes once the board has ended (AC 20)', () => {
  assert.equal(canChangeThemes({ isEnded: true, isFacilitator: true, isAdmin: true }), false);
});

// ── cleanThemeName ──
test('theme names are trimmed, inner spaces collapsed, length-limited', () => {
  assert.equal(cleanThemeName('  Slow   deploys '), 'Slow deploys');
  assert.equal(cleanThemeName(''), null);
  assert.equal(cleanThemeName('   '), null);
  assert.equal(cleanThemeName(42), null);
  assert.equal(cleanThemeName('x'.repeat(THEME_NAME_MAX)), 'x'.repeat(THEME_NAME_MAX));
  assert.equal(cleanThemeName('x'.repeat(THEME_NAME_MAX + 1)), null);
});

// ── checkThemes ──
const boardCards = [
  { id: 'c1', column_type: 'improve' },
  { id: 'c2', column_type: 'improve' },
  { id: 'c3', column_type: 'went_well' },
];

test('a valid theme set comes back cleaned, with its column', () => {
  const { error, themes } = checkThemes({ boardCards, themes: [{ name: ' Deploys ', cardIds: ['c1', 'c2'] }, { name: 'Team', cardIds: ['c3'] }] });
  assert.equal(error, undefined);
  assert.deepEqual(themes, [
    { name: 'Deploys', cardIds: ['c1', 'c2'], column_type: 'improve' },
    { name: 'Team', cardIds: ['c3'], column_type: 'went_well' },
  ]);
});

test('a theme may not mix columns (AC 2, 8)', () => {
  const { error } = checkThemes({ boardCards, themes: [{ name: 'Mixed', cardIds: ['c1', 'c3'] }] });
  assert.match(error, /one column/);
});

test('a card from another board is refused', () => {
  const { error } = checkThemes({ boardCards, themes: [{ name: 'X', cardIds: ['elsewhere'] }] });
  assert.match(error, /not on this board/);
});

test('a card may be in only one theme (AC 2)', () => {
  const { error } = checkThemes({ boardCards, themes: [{ name: 'A', cardIds: ['c1'] }, { name: 'B', cardIds: ['c1'] }] });
  assert.match(error, /only one theme/);
});

test('empty theme lists, empty themes and bad names are refused', () => {
  assert.ok(checkThemes({ boardCards, themes: [] }).error);
  assert.ok(checkThemes({ boardCards, themes: [{ name: 'A', cardIds: [] }] }).error);
  assert.ok(checkThemes({ boardCards, themes: [{ name: ' ', cardIds: ['c1'] }] }).error);
});

// ── arrangeColumn ──
const card = (id) => ({ id, content: id });
const themes = [
  { id: 't-old', name: 'Old', created_at: '2026-10-08T09:00:00Z' },
  { id: 't-new', name: 'New', created_at: '2026-10-08T09:05:00Z' },
  { id: 't-empty', name: 'Empty', created_at: '2026-10-08T09:01:00Z' },
];
const themeCards = [
  { card_id: 'a', theme_id: 't-old' },
  { card_id: 'b', theme_id: 't-new' },
  { card_id: 'c', theme_id: 't-new' },
  { card_id: 'gone', theme_id: 't-empty' },
];
const votes = { a: 1, b: 2, c: 0, d: 5 };

test('cards sit in their themes, in the order given; the rest are loose', () => {
  const out = arrangeColumn({ cards: [card('c'), card('b'), card('a'), card('d')], themes, themeCards, reactionsFor: (id) => votes[id] || 0 });
  assert.deepEqual(out.themes.map((t) => [t.id, t.cards.map((c) => c.id)]), [['t-new', ['c', 'b']], ['t-old', ['a']]]);
  assert.deepEqual(out.loose.map((c) => c.id), ['d']);
});

test('themes are ordered by their cards\' total reactions (AC 17)', () => {
  const out = arrangeColumn({ cards: [card('a'), card('b'), card('c')], themes, themeCards, reactionsFor: (id) => votes[id] || 0 });
  assert.deepEqual(out.themes.map((t) => [t.id, t.reactions]), [['t-new', 2], ['t-old', 1]]);
});

test('equal totals keep the older theme first', () => {
  const out = arrangeColumn({ cards: [card('a'), card('b')], themes, themeCards, reactionsFor: () => 1 });
  assert.deepEqual(out.themes.map((t) => t.id), ['t-old', 't-new']);
});

test('a theme with none of the column\'s cards does not show (AC 11)', () => {
  const out = arrangeColumn({ cards: [card('a')], themes, themeCards });
  assert.deepEqual(out.themes.map((t) => t.id), ['t-old']);
});

test('no themes: every card is loose', () => {
  const out = arrangeColumn({ cards: [card('a'), card('b')] });
  assert.deepEqual(out.themes, []);
  assert.deepEqual(out.loose.map((c) => c.id), ['a', 'b']);
});
```

- [ ] Step 2: run it, `node --test src/lib/retroThemes.test.mjs`. Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./retroThemes.js`.
- [ ] Step 3: minimal implementation, `src/lib/retroThemes.js`:

```js
// RETRO CARD THEMES — grouping a board's cards with similar meaning into named themes.
// Shared by /api/retro (which enforces the rules) and both board pages (which show
// themes and hide controls). Deliberately import-free so `npm test` can load it under
// plain Node; the model that turns card text into vectors is src/lib/retroEmbeddings.js
// and only ever runs in the browser.

export const THEME_NAME_MAX = 60;

// Facilitator or admin, and only while the board is open (AC 4, 20).
export function canChangeThemes({ isEnded, isFacilitator, isAdmin }) {
  if (isEnded) return false;
  return !!isFacilitator || !!isAdmin;
}

// A theme name as stored: trimmed, inner whitespace collapsed, 1..THEME_NAME_MAX
// characters. null when unusable.
export function cleanThemeName(name) {
  if (typeof name !== 'string') return null;
  const clean = name.trim().replace(/\s+/g, ' ');
  return clean && clean.length <= THEME_NAME_MAX ? clean : null;
}

// Checks themes proposed for a board before they are written.
//   boardCards  [{ id, column_type }] — the board's real cards, DB column values
//   themes      [{ name, cardIds }]
// Returns { error } or { themes: [{ name, cardIds, column_type }] }. Every theme holds
// cards of one column only, and no card is in two themes (AC 2, 8).
export function checkThemes({ boardCards, themes }) {
  if (!Array.isArray(themes) || themes.length === 0) return { error: 'themes required' };
  const columnOf = new Map(boardCards.map((c) => [String(c.id), c.column_type]));
  const seen = new Set();
  const out = [];
  for (const theme of themes) {
    const name = cleanThemeName(theme?.name);
    if (!name) return { error: `Each theme needs a name of up to ${THEME_NAME_MAX} characters.` };
    const cardIds = Array.isArray(theme.cardIds) ? theme.cardIds.map(String) : [];
    if (cardIds.length === 0) return { error: 'Each theme needs at least one card.' };
    let column = null;
    for (const id of cardIds) {
      if (!columnOf.has(id)) return { error: 'That card is not on this board.' };
      if (seen.has(id)) return { error: 'A card can be in only one theme.' };
      seen.add(id);
      const cardColumn = columnOf.get(id);
      if (column !== null && cardColumn !== column) return { error: 'A theme can only hold cards from one column.' };
      column = cardColumn;
    }
    out.push({ name, cardIds, column_type: column });
  }
  return { themes: out };
}

// How one column shows (AC 2, 11, 17).
//   cards        the column's cards, already in display order
//   themes       [{ id, name, created_at }] of the board
//   themeCards   [{ card_id, theme_id }] of the board
//   reactionsFor (cardId) => number of reactions on that card
// Returns { themes: [{ ...theme, cards, reactions }], loose: cards in no theme }.
// A theme holding none of the column's cards is left out: that is how a theme whose
// cards were all moved or deleted disappears, and how themes stay in their own column.
// Themes are ordered by total reactions, most first; ties keep the older theme first.
export function arrangeColumn({ cards, themes = [], themeCards = [], reactionsFor = () => 0 }) {
  const themeOf = new Map(themeCards.map((m) => [String(m.card_id), String(m.theme_id)]));
  const byId = new Map(themes.map((t) => [String(t.id), { ...t, cards: [], reactions: 0 }]));
  const loose = [];
  for (const c of cards) {
    const theme = byId.get(themeOf.get(String(c.id)));
    if (!theme) { loose.push(c); continue; }
    theme.cards.push(c);
    theme.reactions += reactionsFor(c.id);
  }
  const time = (iso) => Date.parse(iso) || 0;
  const shown = [...byId.values()]
    .filter((t) => t.cards.length > 0)
    .sort((a, b) => b.reactions - a.reactions || time(a.created_at) - time(b.created_at));
  return { themes: shown, loose };
}
```

- [ ] Step 4: run it, `node --test src/lib/retroThemes.test.mjs`. Expected: PASS, 14 tests.
- [ ] Step 5: commit, `Add retro theme rules: permissions, validation and column arrangement`.

## Task 2: Grouping maths: similarity, clusters, names, late-card placement
**Delivers:** acceptance criteria 1, 3, 12, 13, 14, 22 (decision side).
**Files:** modify `src/lib/retroThemes.js`, modify `src/lib/retroThemes.test.mjs`.
**Kind:** transcription

- [ ] Step 1: write the failing tests. Add these imports to the existing import list in `src/lib/retroThemes.test.mjs`: `GROUPING_MIN_CARDS, similarity, clusterByMeaning, nameFromTexts, buildThemes, placeCard`. Then append:

```js
// ── similarity / clusterByMeaning ──
const items = [
  { id: 'a', vector: [1, 0, 0] },
  { id: 'b', vector: [0.9, 0.1, 0] },
  { id: 'c', vector: [0, 1, 0] },
  { id: 'd', vector: [0, 0.95, 0.05] },
  { id: 'e', vector: [0, 0, 1] },
];

test('similarity is cosine: 1 for the same direction, 0 for unrelated or empty', () => {
  assert.equal(similarity([1, 0], [2, 0]), 1);
  assert.equal(similarity([1, 0], [0, 1]), 0);
  assert.equal(similarity([0, 0], [1, 0]), 0);
});

test('similar cards share a group; a card like no other stays alone (AC 1)', () => {
  assert.deepEqual(clusterByMeaning(items, 0.5), [['a', 'b'], ['c', 'd'], ['e']]);
});

test('a threshold nothing reaches leaves every card alone', () => {
  assert.deepEqual(clusterByMeaning(items, 1.01), [['a'], ['b'], ['c'], ['d'], ['e']]);
});

test('a threshold everything reaches makes one group', () => {
  assert.deepEqual(clusterByMeaning(items, 0), [['a', 'b', 'c', 'd', 'e']]);
});

// ── nameFromTexts ──
test('a theme is named from the words its cards share most', () => {
  assert.equal(
    nameFromTexts(['Deploys were slow on Friday', 'Slow deploy pipeline', 'The deploy pipeline broke twice']),
    'Slow · Deploy · Pipeline'
  );
});

test('@mentions are names, not topics, and are skipped', () => {
  assert.equal(nameFromTexts(['@Sanish fixed the build', '@Sanish build green']), 'Build · Fixed · Green');
});

test('with no usable words the name falls back to the first card, then to "Theme"', () => {
  assert.equal(nameFromTexts(['it is ok']), 'it is ok');
  assert.equal(nameFromTexts(['']), 'Theme');
});

test('names never exceed the theme name limit', () => {
  const long = ['Supercalifragilisticexpialidocious antidisestablishmentarianism pneumonoultramicroscopic'];
  assert.ok(nameFromTexts(long).length <= THEME_NAME_MAX);
});

// ── buildThemes ──
const colCards = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, content: `card ${id} topic` }));
const colVectors = items.map((i) => i.vector);

test('a column below the grouping minimum is left alone (AC 3)', () => {
  const few = colCards.slice(0, GROUPING_MIN_CARDS - 1);
  assert.deepEqual(buildThemes({ cards: few, vectors: colVectors.slice(0, few.length) }), []);
});

test('every card of a grouped column lands in exactly one named theme (AC 1, 2)', () => {
  const themes = buildThemes({ cards: colCards, vectors: colVectors });
  assert.deepEqual(themes.map((t) => t.cardIds), [['a', 'b'], ['c', 'd'], ['e']]);
  themes.forEach((t) => assert.ok(t.name.length > 0));
});

// ── placeCard ──
const columnThemes = [
  { id: 't1', vectors: [[1, 0, 0], [0.9, 0.1, 0]] },
  { id: 't2', vectors: [[0, 1, 0]] },
  { id: 't-empty', vectors: [] },
];

test('a late card joins the theme it is most like (AC 12)', () => {
  assert.equal(placeCard({ vector: [0.95, 0.05, 0], themes: columnThemes }), 't1');
});

test('a late card like no theme starts its own (AC 12)', () => {
  assert.equal(placeCard({ vector: [0, 0, 1], themes: columnThemes }), null);
});
```

- [ ] Step 2: run it, `node --test src/lib/retroThemes.test.mjs`. Expected: FAIL with `SyntaxError: The requested module './retroThemes.js' does not provide an export named 'GROUPING_MIN_CARDS'`.
- [ ] Step 3: minimal implementation. Append to `src/lib/retroThemes.js`:

```js
// A column with fewer cards than this is left as a plain list when grouping (AC 3).
export const GROUPING_MIN_CARDS = 4;
// Cosine similarity of the model's normalised vectors. Starting values for
// all-MiniLM-L6-v2, to be tuned in the smoke run: cards whose average similarity reaches
// CLUSTER_SIMILARITY share a theme; a late card joins the closest theme reaching
// PLACE_SIMILARITY, otherwise it starts its own (AC 12).
export const CLUSTER_SIMILARITY = 0.5;
export const PLACE_SIMILARITY = 0.45;

// Cosine similarity of two vectors of equal length; 0 when either is all zeros.
export function similarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// Average-linkage grouping: keeps joining the two groups whose cards are, on average,
// most alike until no pair reaches minSimilarity. A card like no other stays a group of
// one. Deterministic: groups come back in the order of their first item, items in input
// order. O(n³) on a column's cards, which is a few dozen at most.
//   items [{ id, vector }] → [[id, ...], ...]
export function clusterByMeaning(items, minSimilarity = CLUSTER_SIMILARITY) {
  const sim = items.map((a) => items.map((b) => similarity(a.vector, b.vector)));
  const linkage = (g, h) => {
    let total = 0;
    for (const i of g) for (const j of h) total += sim[i][j];
    return total / (g.length * h.length);
  };
  const groups = items.map((_, i) => [i]);
  for (;;) {
    let best = null;
    for (let x = 0; x < groups.length; x++) {
      for (let y = x + 1; y < groups.length; y++) {
        const s = linkage(groups[x], groups[y]);
        if (s >= minSimilarity && (!best || s > best.s)) best = { x, y, s };
      }
    }
    if (!best) break;
    groups[best.x] = [...groups[best.x], ...groups[best.y]].sort((a, b) => a - b);
    groups.splice(best.y, 1);
  }
  return groups.sort((g, h) => g[0] - h[0]).map((g) => g.map((i) => items[i].id));
}

const STOPWORDS = new Set((
  'the and are was were for from with that this these those have has had not but our ours you your ' +
  'they them their there then than what when which while who whom why how all any can could did does ' +
  'doing done get got its into also just more most much need needs some such too very will would should ' +
  'been being let lets make made many may might must only other own same out over under again about ' +
  'after before because each few here she him her his one two per via yet'
).split(' '));

// A short name from the words a theme's cards share most: up to maxWords, joined by
// " · ". Each word counts once per card so one long card cannot dominate; ties keep the
// word seen first. @mentions are people, not topics, and are skipped. With no usable
// word, the first card's opening words; failing that, "Theme".
export function nameFromTexts(texts, maxWords = 3) {
  const counts = new Map();
  const firstSeen = new Map();
  for (const text of texts) {
    const words = new Set(
      (text || '').replace(/@\S+/g, ' ').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || []
    );
    for (const w of words) {
      if (w.length < 3 || STOPWORDS.has(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
      if (!firstSeen.has(w)) firstSeen.set(w, firstSeen.size);
    }
  }
  const top = [...counts.keys()]
    .sort((a, b) => counts.get(b) - counts.get(a) || firstSeen.get(a) - firstSeen.get(b))
    .slice(0, maxWords);
  const name = top.length
    ? top.map((w) => w[0].toUpperCase() + w.slice(1)).join(' · ')
    : (texts[0] || '').trim().split(/\s+/).slice(0, 4).join(' ');
  return cleanThemeName(name.slice(0, THEME_NAME_MAX)) || 'Theme';
}

// Suggested themes for one column (AC 1, 3).
//   cards    [{ id, content }] of one column
//   vectors  one vector per card, same order
// [] when the column is below minCards; otherwise [{ name, cardIds }] holding every
// card exactly once.
export function buildThemes({ cards, vectors, minCards = GROUPING_MIN_CARDS, minSimilarity = CLUSTER_SIMILARITY }) {
  if (cards.length < minCards) return [];
  const textOf = new Map(cards.map((c) => [String(c.id), c.content]));
  const groups = clusterByMeaning(cards.map((c, i) => ({ id: String(c.id), vector: vectors[i] })), minSimilarity);
  return groups.map((ids) => ({ name: nameFromTexts(ids.map((id) => textOf.get(id))), cardIds: ids }));
}

// Where a card added after grouping goes (AC 12): the id of the theme whose cards it is
// most alike on average, when that reaches minSimilarity; null means "start a theme of
// its own".
//   vector  the new card's
//   themes  [{ id, vectors }] of the card's column; themes with no vectors are skipped
export function placeCard({ vector, themes, minSimilarity = PLACE_SIMILARITY }) {
  let best = null;
  for (const t of themes) {
    if (!t.vectors.length) continue;
    const s = t.vectors.reduce((sum, v) => sum + similarity(vector, v), 0) / t.vectors.length;
    if (s >= minSimilarity && (!best || s > best.s)) best = { id: t.id, s };
  }
  return best ? best.id : null;
}
```

- [ ] Step 4: run it, `node --test src/lib/retroThemes.test.mjs`. Expected: PASS, 26 tests. Then `npm test`. Expected: every suite passes, `retroBoardRules.test.mjs` included.
- [ ] Step 5: commit, `Add retro card grouping, theme naming and late-card placement`.

## Task 3: Schema: theme tables
**Delivers:** storage for every criterion; 15 by design (a theme link survives a card edit).
**Files:** create `scripts/retro-card-themes-schema.sql`.
**Kind:** transcription

There is no SQL test runner. The test is the verify query at the bottom of the script, run in the Supabase SQL editor.

- [ ] Step 1: write the script, `scripts/retro-card-themes-schema.sql`:

```sql
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
```

- [ ] Step 2: the developer applies it in the Supabase SQL editor. This is a manual step, so ask the developer to run it and report the result. Expected: both verify queries return `0`.
- [ ] Step 3: commit, `Add retro card themes schema`.

## Task 4: API: read themes with the board, five theme actions, cleanup on card delete
**Delivers:** acceptance criteria 1, 4, 6, 7, 8, 9, 10, 11, 13, 15, 20, 21, 22 (server side).
**Files:** modify `src/app/api/retro/route.js`.
**Kind:** judgement

This repo has no route tests (CLAUDE.md). The rules this route enforces were unit-tested in Tasks 1–2, and the route is checked with `curl` against the dev server in Step 3.

**Interface (other tasks rely on these exact names and shapes):**

GET `/api/retro?sessionId=…` adds two fields to the existing board response:
```
themes:     [{ id, name, created_at }]        // this board's themes, any column
themeCards: [{ card_id, theme_id }]           // this board's card→theme links
```
Both are `[]` when the tables are missing or a read fails. Read them inside `loadBoardExtras` (route.js:334) with its existing `safe()` helper, in the same `Promise.all`:
`supabase.from('retro_themes').select('id,name,created_at').eq('session_id', session.id)` and
`supabase.from('retro_theme_cards').select('card_id,theme_id').eq('session_id', session.id)`.
`safe()`'s one-time missing-table warning names only the action-items script. Change it so it names both `scripts/retro-action-items-kudos-schema.sql` and `scripts/retro-card-themes-schema.sql`.

POST `/api/retro` takes five new actions. Every body carries `sessionId` (string) and `actorName` (non-empty string), and every success returns `{ ok: true }`:
| action | extra body fields | effect |
| --- | --- | --- |
| `group_cards` | `themes: [{ name, cardIds: [cardId] }]` | Replaces all of the board's themes with these (AC 1, 22). |
| `create_theme` | `name`, `cardIds: [cardId]` | New theme in the cards' column. Each card leaves whatever theme it was in (AC 6, 10). |
| `move_card_to_theme` | `cardId`, `themeId` | Card joins that theme (AC 7). |
| `rename_theme` | `themeId`, `name` | (AC 9) |
| `ungroup_cards` | (none) | Deletes every theme of the board (AC 21). |

**Pattern to follow:** `handleActionItem` (route.js:109-231). Add a `THEME_OPS` map and `async function handleTheme(request, body)`, and dispatch beside the existing lines at route.js:790-791: `if (Object.hasOwn(THEME_OPS, body.action)) return handleTheme(request, body);`. Keep the check order and status codes:
1. Shape: bad `sessionId`/`actorName`/ids → 400. Names go through `cleanThemeName` (invalid → 400 with `Theme names are 1 to ${THEME_NAME_MAX} characters.`).
2. Board via `loadBoard(sessionId)`. Not found → 404.
3. `isFacilitator(session, actorName)`, else `await callerIsAdmin(request)`. Neither → 403 `Only the facilitator or an admin can change themes.`
4. Ended (`canChangeThemes` false while step 3 passed) → 409 `This retro has ended — themes can no longer change.`
5. Board cards: `retro_cards` `id,column_type` for the session, excluding system rows: `.neq('content', '__SESSION_ENDED__').neq('content', '__THINKING__').neq('author', 'SYSTEM:TIMER')`. `group_cards` and `create_theme` run `checkThemes({ boardCards, themes })` (for `create_theme`, `themes: [{ name, cardIds }]`), and an error → 400 with its message. `move_card_to_theme` loads the theme with `.eq('id', themeId).eq('session_id', sessionId)` (missing → 404 `Theme not found`). The card must be in `boardCards` (else 404 `That card is not on this board.`), and `card.column_type !== theme.column_type` → 400 `A card can only move to a theme in its own column.` `rename_theme` also loads the theme scoped to the session.
6. Writes:
   - Theme ids are made in the route with `randomUUID()` from `node:crypto`, so links can be written without relying on the order of bulk-insert results. Theme rows: `{ id, session_id, column_type, name, created_by: actorName.trim() }`. Link rows: `{ card_id, theme_id, session_id }`.
   - `group_cards`: delete `retro_themes` for the session (links cascade), insert the theme rows, then insert the link rows. This is not a transaction. On a failed second insert, return 500, and the next poll shows whatever landed (comment this).
   - `create_theme`: insert the theme, then `upsert(linkRows, { onConflict: 'card_id' })`, then prune.
   - `move_card_to_theme`: `upsert({ card_id, theme_id, session_id }, { onConflict: 'card_id' })`, then prune.
   - `rename_theme`: update `name` where `id` and `session_id` match.
   - `ungroup_cards`: delete `retro_themes` where `session_id`.
   - Prune (a local helper): delete the session's themes that have no row in `retro_theme_cards`, so a theme emptied by a move or split disappears (AC 11). The display also hides themes with no present cards (Task 1), so this is housekeeping, not correctness.
7. Any error whose message passes `missingTable()` → 503 `Themes need scripts/retro-card-themes-schema.sql applied.` Other errors → `console.warn` and 500 `Could not save the themes.`

DELETE `/api/retro?cardId=…` (route.js:796): after the card delete succeeds, also `await supabase.from('retro_theme_cards').delete().eq('card_id', cardId)` and ignore its error (the table may not exist yet). Do not touch `edit_card`: the link has no foreign key, so it survives the delete-and-reinsert (AC 15).

Imports to add from `@/lib/retroThemes`: `THEME_NAME_MAX, canChangeThemes, checkThemes, cleanThemeName`.

- [ ] Step 1: implement the above in `src/app/api/retro/route.js`.
- [ ] Step 2: lint, `npx eslint src/app/api/retro/route.js`. Expected: no errors.
- [ ] Step 3: check against the running route. Start `npm run dev`, create a board in the web Retrospective tab as `Alice`, add two cards to one column and one to another, and note the session id and card ids from `curl -s "localhost:3000/api/retro?sessionId=<SESSION_ID>"`. Then:
  - `curl -s -XPOST localhost:3000/api/retro -H 'Content-Type: application/json' -d '{"action":"ungroup_cards","sessionId":"<SESSION_ID>","actorName":"Mallory"}' -w ' %{http_code}\n'`. Expected: `403`.
  - The same `group_cards` body as `Alice` with `"themes":[{"name":"Mixed","cardIds":["<CARD_COL1>","<CARD_COL2>"]}]`. Expected: `400` with `one column`.
  - As `Alice`, `"themes":[{"name":"Deploys","cardIds":["<CARD_A>","<CARD_B>"]}]`. Expected: `200`, and the GET now shows one theme and two `themeCards`.
  - End the board, then repeat any `Alice` action. Expected: `409`.
- [ ] Step 4: commit, `Store retro card themes and let the facilitator change them through /api/retro`.

## Task 5: Browser model loader
**Delivers:** the vectors behind criteria 1, 5, 12, 16.
**Files:** create `src/lib/retroEmbeddings.js`.
**Kind:** transcription

Verified facts this rests on:
- Next.js 16 leaves a dynamic `import()` marked `/* webpackIgnore: true */` unbundled, under both webpack and Turbopack (`node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`, "Magic Comments"; `node_modules/next/dist/docs/01-app/03-api-reference/08-turbopack.md`, magic comment table). `next.config.mjs` sets no Content-Security-Policy, so the browser may load it from jsDelivr.
- transformers.js 4.3.1 is the latest release (`npm view @huggingface/transformers version`). Its README imports it from `https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1`. `FeatureExtractionPipeline` takes `string | string[]` with options `{ pooling: 'mean', normalize: true }` and returns a `Tensor` with `.tolist()` (`types/pipelines/feature-extraction.d.ts`).
- `dtype: 'q8'` loads `onnx/model_quantized.onnx` (`src/utils/dtypes.js`, `DEFAULT_DTYPE_SUFFIX_MAPPING`). `Xenova/all-MiniLM-L6-v2` ships that file at 22,972,370 bytes. Its sibling `onnx-community/all-MiniLM-L6-v2-ONNX` does not ship a q8 file, so do not use it.

The module is network- and browser-bound, so it has no unit test (CLAUDE.md: only pure modules are unit-tested). It is exercised in Task 7's and Task 8's checks.

- [ ] Step 1: write `src/lib/retroEmbeddings.js`:

```js
// Turns retro card text into vectors in the browser, for grouping cards by meaning.
// Card text never leaves the browser: the only network traffic is the one-time download
// of transformers.js (jsDelivr) and the all-MiniLM-L6-v2 model (~23 MB, Hugging Face),
// both cached by the browser afterwards. The import is deliberately not bundled: the
// webpackIgnore comment leaves it to the browser at runtime (Next.js lazy-loading guide,
// "Magic Comments" — honoured by Turbopack too). Client components only.
const LIBRARY_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.1';
const MODEL = 'Xenova/all-MiniLM-L6-v2';

let extractorPromise = null;

// Loads once per page; a failed load is forgotten so the next call can retry.
export function loadGroupingModel() {
  if (!extractorPromise) {
    extractorPromise = import(/* webpackIgnore: true */ LIBRARY_URL)
      .then(({ pipeline }) => pipeline('feature-extraction', MODEL, { dtype: 'q8' }))
      .catch((err) => {
        extractorPromise = null;
        throw err;
      });
  }
  return extractorPromise;
}

// texts → one normalised vector (plain number array) per text, same order.
export async function embedTexts(texts) {
  if (!texts.length) return [];
  const extractor = await loadGroupingModel();
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  return output.tolist();
}
```

- [ ] Step 2: lint, `npx eslint src/lib/retroEmbeddings.js`. Expected: no errors.
- [ ] Step 3: commit, `Load a sentence model in the browser for grouping retro cards`.

## Task 6: Web tab: show columns as themes
**Delivers:** acceptance criteria 2, 11, 17, 18, 19, 20 on the web Retrospective tab.
**Files:** modify `src/components/RetrospectivePage.js`, modify `src/app/globals.css`.
**Kind:** judgement

**State:** add `const [themes, setThemes] = useState([]);` and `const [themeCards, setThemeCards] = useState([]);` next to `kudos` (RetrospectivePage.js:129). Set them from `data.themes || []` and `data.themeCards || []` at every place the board response is applied. Each of these lines already calls `setKudos(data.kudos …)`: :203 (`fetchBoard`), :275 (auto-restore), :447 (join) and :783 (opening a recent board). Clear them where `setKudos([])` runs in `resetToHome` (:227).

**Rendering:** in the column loop (`currentColumns.map`, :984), `colCards = cardsFor(col.key)` stays as is, so card order inside a theme is unchanged. Then:
```js
const arranged = arrangeColumn({ cards: colCards, themes, themeCards, reactionsFor: voteCountFor });
```
`voteCountFor` (:620) already sums every emoji, which is what AC 17 means by reactions. Move the body of the existing `colCards.map((card, idx) => …)` sticky JSX (:1041 to the end of that map) into a local `renderCard(card, idx)` declared inside the column callback, without changing it. Then render:
1. `arranged.themes.map(theme => …)`: a `<section className="retro-theme">` holding a header row (`.retro-theme-header`: the name in `.retro-theme-name`, then `.retro-theme-meta` reading `{n} card(s) · {reactions} reaction(s)`), then `theme.cards.map(renderCard)`.
2. Then `arranged.loose.map(renderCard)`. When the column has at least one theme and loose cards exist, put a small `.retro-theme-loose-label` "Not in a theme" above them.

A column with no themes renders exactly as today (only loose cards, no label). Keep the empty-state, activity and drop-compose blocks above the cards as they are. The Top Voted view (:1151-1215) is untouched (AC 19).

**CSS:** add to `src/app/globals.css` beside the `.retro-sticky` rules (:6463):
- `.retro-theme`: a block with a subtle border/background that groups its stickies, 8–10px padding, a gap like `.retro-column-cards`.
- `.retro-theme-header`: a flex row with space-between.
- `.retro-theme-name` (bold) and `.retro-theme-meta` (muted, small).
- `.retro-theme-loose-label`: muted, small, uppercase-ish.

Base colours on the existing retro column variables or neutral rgba values that read in both themes. Check `.retro-column-*` for the variables already used.

Import `arrangeColumn` from `@/lib/retroThemes`.

- [ ] Step 1: implement.
- [ ] Step 2: lint, `npx eslint src/components/RetrospectivePage.js`. Expected: no errors.
- [ ] Step 3: check in the running app (`npm run dev`). On the board from Task 4 Step 3, which already has the "Deploys" theme, the column shows a "Deploys" block with its two cards and `2 cards · 0 reactions`. React 👍 on one card: the meta becomes `1 reaction`, and reacting, editing and deleting own cards inside the theme work as before. Delete both cards in the theme: the block disappears. Open Top Voted: the list is unchanged.
- [ ] Step 4: commit, `Show retro columns grouped by theme on the web tab`.

## Task 7: Web tab: facilitator theme tools
**Delivers:** acceptance criteria 1, 3, 4, 5, 6, 7, 8, 9, 10, 20, 21, 22 on the web Retrospective tab.
**Files:** create `src/components/RetroThemeTools.js`, modify `src/components/RetrospectivePage.js`, modify `src/app/globals.css`.
**Kind:** judgement

**`src/components/RetroThemeTools.js`** (`"use client"`), default export:
```js
export default function RetroThemeTools({
  session,          // board; uses id, is_ended
  columns,          // currentColumns: [{ key, label, emoji, color }]
  cards,            // board cards, column_type = UI column key
  themes,           // GET themes
  participantName,  // actorName for postRetro
  selectedCardIds,  // string[] chosen with the per-card Select tick
  onClearSelection, // () => void
  onChanged,        // () => void — refetch the board
  onError,          // (message: string) => void
})
```
It renders nothing for anyone the parent does not pass in (the parent mounts it only when `canManageActions && !session.is_ended`; AC 4, 20). It is a toolbar `.retro-theme-tools` with:
- **"✨ Group similar cards"**, shown when `themes.length === 0`. Steps:
  - Set the status to "Loading the grouping model… (first time only, about 25 MB)" until `loadGroupingModel()` resolves, then "Grouping…".
  - For each column, take its non-temporary cards (`!String(id).startsWith("temp_")`), get vectors via the shared vector cache (below), and call `buildThemes({ cards, vectors })`.
  - Concatenate the results. If empty, call `onError(\`Each column needs at least ${GROUPING_MIN_CARDS} cards to group.\`)`. Otherwise `postRetro({ action: "group_cards", sessionId: session.id, actorName: participantName, themes })`, then `onChanged()`.
  - If the model fails to load or run, call `onError("Couldn't load the grouping model. You can still make themes by hand: tick cards, then New theme.")` and leave the board unchanged (AC 5).
- **"Ungroup all"**, shown when `themes.length > 0`. It asks `confirmDialog("Ungroup every column? Themes will be discarded for everyone.")` (from `useDialog`, `src/context/DialogContext.js:17`), then posts `ungroup_cards` (AC 21).
- **"New theme from {n} selected"**, shown when `selectedCardIds.length > 0`. It is disabled with the title "Selected cards must all be in one column" when they span columns, because cards carry their column in `column_type`. Clicking it asks `promptDialog("Name the new theme", { defaultValue: nameFromTexts(selectedTexts) })` (promptDialog resolves `string|null`; `defaultValue` is read at `src/components/DialogHost.js:18`). On a non-empty name it posts `create_theme` with `{ name, cardIds: selectedCardIds }`, then calls `onClearSelection()` and `onChanged()`. This covers both a hand-made theme (AC 6) and splitting a theme (AC 10).
- A status line `.retro-theme-tools-status` for the loading text.

API errors go through `onError(err.message)`. `postRetro` (`src/lib/retroApi.js`) already throws with the route's message.

**Shared vector cache** (module level in this file, also used by Task 8): `const vectorCache = new Map()` keyed by `` `${card.id}\u0000${card.content}` ``, so an edited card is re-embedded. Export `async function vectorsFor(cards)`: it embeds only the misses, in one `embedTexts` call, and returns vectors in `cards` order.

**In `RetrospectivePage.js`:**
- State `const [selectedCardIds, setSelectedCardIds] = useState([]);`, cleared in `resetToHome` and whenever the board ends.
- `const canManageThemes = canManageActions && !session?.is_ended;` (the same people as action items, AC 4; frozen when ended, AC 20).
- Mount `<RetroThemeTools … onChanged={() => fetchBoard(session.id)} onError={setError} />` right after `<RetroActionItems … />` (:916-923), only when `canManageThemes`.
- In `renderCard` (Task 6), only when `canManageThemes` and the card is not temporary:
  - a `<label className="retro-theme-select"><input type="checkbox" …/> Select</label>` toggling the card id in `selectedCardIds`;
  - when the card's column has at least one theme, a `<select className="retro-theme-move">` titled "Move to theme". Its options are the other themes of the same column from `arranged.themes`, plus a disabled placeholder "Move to…". `onChange` posts `move_card_to_theme` `{ cardId, themeId }`, then refetches (AC 7). Only same-column themes are offered (AC 8). The server refuses others anyway (Task 4).
- In the theme header (Task 6), when `canManageThemes`, the name is a button. Clicking it swaps in an input (`.retro-theme-rename`, `maxLength={THEME_NAME_MAX}`). Enter saves with `rename_theme`, then refetches (AC 9). Escape or blur cancels.
- Errors from the per-card and header controls go to `setError`, as the rest of the page does.

**CSS:** `.retro-theme-tools`, `.retro-theme-tools-status`, `.retro-theme-select`, `.retro-theme-move`, `.retro-theme-rename`, matching the buttons near `.retro-end-session-btn`. Do not add any `option` colour rules for `.retro-theme-move`: the global `select option` rule (`src/app/globals.css:67`) already handles dropdown contrast.

**Imports:** `RetroThemeTools.js` uses `GROUPING_MIN_CARDS, buildThemes, nameFromTexts` from `@/lib/retroThemes`, `loadGroupingModel, embedTexts` from `@/lib/retroEmbeddings`, `postRetro` from `@/lib/retroApi`, and `useDialog` from `@/context/DialogContext`. `RetrospectivePage.js` adds `THEME_NAME_MAX` to its `@/lib/retroThemes` import.

- [ ] Step 1: implement.
- [ ] Step 2: lint, `npx eslint src/components/RetroThemeTools.js src/components/RetrospectivePage.js`. Expected: no errors.
- [ ] Step 3: check in the running app. Create a board as facilitator. Add 6 cards to "Needs Improvement", for example "Deploys are slow", "Deploy pipeline keeps breaking", "CI takes 40 minutes", "Too many meetings", "Standups run long", "Meetings eat focus time". Add 2 cards to "What Went Well", then click "✨ Group similar cards".
  - Expected: "Loading the grouping model…" on first use, then the Needs Improvement column shows themes and What Went Well stays a plain list (AC 3). Every Needs Improvement card is in exactly one theme.
  - Note how many themes formed. If deploy and meeting cards land together or every card is alone, adjust `CLUSTER_SIMILARITY` in `src/lib/retroThemes.js` and record the value in the commit message.
  - Rename a theme, move a card with "Move to…", tick two cards and make "New theme from 2 selected" (one of them already in a theme, which is a split), then "Ungroup all" and group again (AC 22).
  - A second browser joined as a participant sees every change within a few seconds and has none of these controls (AC 4).
  - Block `cdn.jsdelivr.net` in DevTools (Network → Block request domain) in a fresh tab and click Group: the error appears and the board is unchanged (AC 5). Hand-made themes still work (AC 6).
- [ ] Step 4: commit, `Let the facilitator group, rename, move, split and ungroup retro themes`.

## Task 8: Web tab: place late cards automatically
**Delivers:** acceptance criteria 12, 12a, 13, 14, 16.
**Files:** modify `src/components/RetroThemeTools.js`, modify `src/components/RetrospectivePage.js`.
**Kind:** judgement

**Interface:** export from `RetroThemeTools.js`:
```js
export function useThemeAutoPlacement({
  enabled,          // canManageThemes — only a facilitator/admin browser places cards (AC 12, 12a)
  session, cards, themes, themeCards, participantName,
  onChanged,        // () => void
  onError,          // (message: string) => void
})
```
Call it in `RetrospectivePage.js` with `enabled: canManageThemes` and `onError: setError`.

**Behaviour** (a `useEffect` on `[enabled, cards, themes, themeCards]`):
- The candidates are loose, non-temporary cards whose column already has at least one theme with a present card, using the same test `arrangeColumn` applies. A column with no themes is never touched (AC 14), and existing theme links are never changed (AC 13).
- If there are no candidates, or a run is in flight (`useRef` flag), or the model has failed in this page (a `useRef` flag set on the first load/embed failure), do nothing.
- Otherwise:
  - Embed each candidate and each themed card of those columns with `vectorsFor` (Task 7's cache), and call `placeCard({ vector, themes: [{ id, vectors }] })` per candidate against its column's themes.
  - A theme id means post `move_card_to_theme`. `null` means post `create_theme` with `{ name: nameFromTexts([card.content]), cardIds: [card.id] }`.
  - Place candidates one after another, so two late cards that belong together both see the theme the first one created on the next run.
  - Call `onChanged()` once at the end.
- On a model failure, set the failed flag and call `onError` once: "Couldn't load the grouping model, so new cards stay outside themes. Move them with Move to…". Cards stay where the server put them, outside any theme (AC 16).
- On an API failure for one card, report it with `onError` and skip that card until it changes. Keep a `useRef(Set)` of `` `${id}\u0000${content}` `` keys already tried, so a poll every 2.5 s does not hammer the route.

**Imports:** add `arrangeColumn, placeCard, nameFromTexts` from `@/lib/retroThemes` to `RetroThemeTools.js`.

Two facilitator/admin browsers may both place the same card. The second `move_card_to_theme`/`create_theme` simply re-links it, and Task 4's prune removes any theme left empty. The result is still one card in one theme. Leave a comment saying so.

- [ ] Step 1: implement.
- [ ] Step 2: lint, `npx eslint src/components/RetroThemeTools.js src/components/RetrospectivePage.js`. Expected: no errors.
- [ ] Step 3: check in the running app, with the grouped board from Task 7 open as facilitator in window A.
  - In window B, join through the share link as a guest and add "Deploys failed again on Friday" to Needs Improvement. Within a few seconds it shows in the deploy theme in both windows (AC 12).
  - Add "Office coffee machine broke": it appears as its own new theme.
  - Rename a theme first, then add a card: the rename stays (AC 13).
  - Add a card to the ungrouped What Went Well column: it stays a plain list (AC 14).
  - Close window A, add a card in B: it shows outside any theme under "Not in a theme". Reopen A as facilitator: it is placed within a few seconds (AC 12a).
  - With `cdn.jsdelivr.net` blocked in a fresh facilitator tab, a new card stays outside themes, and one error appears, not one per poll (AC 16).
- [ ] Step 4: commit, `Place retro cards added after grouping into the closest theme`.

## Task 9: Share page: show themes read-only
**Delivers:** acceptance criteria 2, 4, 11, 12 (display), 15, 17, 18, 20 on the share page.
**Files:** modify `src/app/retrospective/[sessionId]/page.js`.
**Kind:** judgement

- Add `themes`/`themeCards` state and set them in `fetchBoard` (page.js:85-104) from `data.themes || []` and `data.themeCards || []`.
- In the column loop, the cards come from `cardsFor(col.key)` (page.js:363-370) as today. Then `arrangeColumn({ cards: colCards, themes, themeCards, reactionsFor })`, where `reactionsFor` sums every emoji: `(id) => Object.values(reactionCountsFor(id)).reduce((s, n) => s + n, 0)`. That is because this page's own `voteCountFor` (page.js:360) counts only 👍, and AC 17 means all reactions. Do not change `voteCountFor` or this page's card sort; that is out of scope.
- Move the sticky JSX body of the `colCards.map(...)` (after the `{/* Sticky cards sorted by votes */}` comment, page.js:636) into a local `renderCard(card, idx)` unchanged, and render themes, then loose cards, using the same markup and class names as Task 6 (`.retro-theme`, `.retro-theme-header`, `.retro-theme-name`, `.retro-theme-meta`, `.retro-theme-loose-label`). The CSS from Task 6 then applies here too.
- No theme controls on this page for anyone, the name-matched facilitator included (AC 4).

Import `arrangeColumn` from `@/lib/retroThemes`.

- [ ] Step 1: implement.
- [ ] Step 2: lint, ``npx eslint "src/app/retrospective/[sessionId]/page.js"``. Expected: no errors.
- [ ] Step 3: check in the running app. Open the grouped board's share link as a guest: the same themes, names, counts and reaction totals show as on the web tab. Reacting, editing and deleting your own card inside a theme work. Edit a card: it stays in its theme (AC 15). There are no Group, Move, Select or rename controls, even when joined with the facilitator's name. End the board in the web tab: the share page still shows the themes (AC 20).
- [ ] Step 4: commit, `Show retro themes on the share page`.

## Integration
This repo has no integration or end-to-end runner, and `CLAUDE.md` sends anything touching Supabase, a route or a page to the running app. Boundary-crossing criteria are proven by the "check in the running app" step of Tasks 4, 6, 7, 8 and 9, run with `npm run dev` after `scripts/retro-card-themes-schema.sql` is applied. Every task's Step 3 together is the smoke run. Before the pull request, run them once more end to end on one fresh board, across all three templates (Standard, Sailboat, Start/Stop): group, rename, move, split, late card, ungroup, end. Also run `npm test` and `npm run build`. Expected: all suites pass, and the build succeeds with the `webpackIgnore` import left unbundled.

## Criteria coverage
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| 1 Group by meaning, named themes | 2, 7 | `retroThemes.test.mjs` "every card of a grouped column lands in exactly one named theme"; Manual: no integration setup in this repo (Task 7 Step 3) |
| 2 One column per theme, each card in one theme | 1, 2 | "a theme may not mix columns", "a card may be in only one theme", "every card of a grouped column lands in exactly one named theme" |
| 3 Small columns stay plain | 2 | "a column below the grouping minimum is left alone" |
| 4 No controls for others | 1, 4, 7, 9 | "anyone else is refused"; Task 4 Step 3 `curl` expects 403; Manual: no integration setup in this repo (Tasks 7, 9 Step 3) |
| 5 Model failure leaves board as it was | 7 | Manual: no integration setup in this repo (Task 7 Step 3, CDN blocked) |
| 6 Hand-made theme | 7 | Manual: no integration setup in this repo (Task 7 Step 3) |
| 7 Move a card | 4, 7 | Manual: no integration setup in this repo (Task 7 Step 3) |
| 8 No move across columns | 1, 4 | "a theme may not mix columns"; Manual: no integration setup in this repo (Task 4's column check, only same-column themes offered in Task 7) |
| 9 Rename | 4, 7 | Manual: no integration setup in this repo (Task 7 Step 3) |
| 10 Split | 4, 7 | Manual: no integration setup in this repo (Task 7 Step 3) |
| 11 Empty theme disappears | 1, 4 | "a theme with none of the column's cards does not show" |
| 12 Late card joins closest theme or starts one | 2, 8 | "a late card joins the theme it is most like", "a late card like no theme starts its own"; Manual: no integration setup in this repo (Task 8 Step 3) |
| 12a No facilitator present: card waits, then is placed | 8 | Manual: no integration setup in this repo (Task 8 Step 3) |
| 13 Manual changes survive late cards | 8 | Manual: no integration setup in this repo (Task 8 Step 3) |
| 14 Ungrouped column stays plain | 8 | Manual: no integration setup in this repo (Task 8 Step 3) |
| 15 Edited card stays in its theme | 3, 9 | Manual: no integration setup in this repo (Task 9 Step 3; link has no foreign key, Task 3) |
| 16 Model failure on a late card | 8 | Manual: no integration setup in this repo (Task 8 Step 3) |
| 17 Theme name, count, reaction total; ordered by total | 1, 6, 9 | "themes are ordered by their cards' total reactions", "equal totals keep the older theme first"; Manual: no integration setup in this repo (Tasks 6, 9 Step 3) |
| 18 Cards inside themes behave as today | 6, 9 | Manual: no integration setup in this repo (Tasks 6, 9 Step 3) |
| 19 Top Voted unchanged | 6 | Manual: no integration setup in this repo (Task 6 Step 3) |
| 20 Ended board: themes shown, frozen | 1, 4, 9 | "nobody changes themes once the board has ended"; Task 4 Step 3 `curl` expects 409; Manual: no integration setup in this repo (Task 9 Step 3) |
| 21 Ungroup all | 4, 7 | Manual: no integration setup in this repo (Task 7 Step 3) |
| 22 Regroup after ungroup | 7 | Manual: no integration setup in this repo (Task 7 Step 3) |
