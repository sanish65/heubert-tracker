# Web UI Revamp Implementation Plan

**Intent:** docs/web-ui-revamp/intent.md
**Goal:** Every web screen matches the "Heubert Tracker Revamp" canvas (navy ink, glass panels over an aurora, blue / cyan / orange accents, three typefaces, line icons, left sidebar) with today's behaviour and data unchanged.
**Approach:** Lay a new token layer at the top of `globals.css` and point the legacy tokens at it, so every unrevised rule shifts palette at once; add the shared pieces (glass primitives, an `Icon` component, a pure navigation model, the sidebar + top bar shell, glass dialogs); then restyle the screens one group per task against the reference artboards, deleting each screen's old CSS as it is replaced; finish with a light-theme, phone-width, motion and emoji sweep.
**Test layers:** Unit only. The two decisions this change introduces live in pure modules with no `@/` imports, so the repo's Node runner covers them: the navigation model (which sections each role sees, how saved tabs map to sections — criteria 1, 3, 4) and the contrast check over the theme tokens (criterion 15). No criterion crosses a boundary below the screen: no data, route or database changes. Everything else is how a screen looks and is proven by each task's smoke steps in the running app (`npm run dev`), as `CLAUDE.md` says for anything touching a page.
**Constraints:**
- `CLAUDE.md`: "Unit tests use Node's built-in runner: `npm test` (runs `src/**/*.test.mjs`). It needs Node 22+ … (with nvm: `nvm use 22`). Only pure modules with no `@/` imports are unit-tested; anything touching Supabase, a route or a page is verified in the running app."
- `AGENTS.md`: "This is NOT the Next.js you know … Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices."
- Project conventions: JavaScript only; plain CSS in `src/app/globals.css` (no Tailwind, no CSS-in-JS, no new CSS library); shared data through `src/context/AppContext.js`; inline `style` only for dynamic values.
- `<select>` option contrast is fixed once, globally (`select option, select optgroup` rule near the top of `globals.css`); never add per-class option fixes.
- Branch `kanban-tracker`, on top of uncommitted Kanban (Tasks) work in the same files (`globals.css`, `page.js`, `AppContext.js`). **No commits during execution**: changes stay in the working tree; the developer commits at the end. Never stash or revert the Kanban work.
- No changes to data, API routes, Supabase or `mobile/`.

**Design reference:** `docs/web-ui-revamp/design/*.dc.html` — one HTML artboard per canvas screen (live canvas: https://claude.ai/artifact/568KVxYWAVQ5rzXtPRYn5a). Each file's `<helmet><style>` holds the full token set (dark `.ht`, light `.ht.light`), and its markup gives exact sizes, radii, spacing and colours inline. Copy values from there; never invent new ones. `Foundations.dc.html` is the rule sheet; `Main.dc.html` the shell reference (aurora, sidebar wrapper, top bar). Sample data in the artboards is not to be copied into the app.

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| `src/app/globals.css` | modify | New token layer + legacy aliases (T1), glass primitives (T2), shell (T5), dialogs (T6), per-screen sections (T7–T19), sweep (T20) |
| `src/app/layout.js` | modify | Load Space Grotesk, IBM Plex Sans, JetBrains Mono (T1) |
| `src/lib/contrast.js` | create | Pure colour maths: parse hex/rgba, composite alpha over a base, WCAG contrast ratio (T1) |
| `src/lib/contrast.test.mjs` | create | Reads the theme tokens from `globals.css` and asserts text/pill pairs pass (T1) |
| `src/components/AmbientAurora.js` | modify | New blob palette; stays behind glass (T2) |
| `src/lib/avatar.js` | create | Pure: `initials(name)`, `avatarColor(name)`, `AVATAR_COLORS` (T2) |
| `src/lib/avatar.test.mjs` | create | Unit tests for the avatar helpers (T2) |
| `src/lib/pageMeta.js` | create | Pure: page titles/subtitles per tab, `greetingFor(hour)`, `pageMetaFor()` (T5) |
| `src/lib/pageMeta.test.mjs` | create | Unit tests for page meta (T5) |
| `src/components/PageHead.js` | create | Shared page heading: eyebrow, title, subtitle, actions (T5) |
| `src/components/HumanLoader.js` | modify | Splash in the new palette, no emoji (T20) |
| `src/components/Icon.js` | create | Inline stroke-SVG icon set by name (T3) |
| `src/lib/navigation.js` | create | Pure navigation model: groups, items, role filter, saved-tab normalising (T4) |
| `src/lib/navigation.test.mjs` | create | Unit tests for the navigation model (T4) |
| `src/components/Sidebar.js` | create | Glass sidebar built from the navigation model (T5) |
| `src/components/TopBar.js` | create | Search field, Start Meeting, notifications, theme switch, account menu (T5) |
| `src/app/page.js` | modify | New shell; removes header, emoji tab row, footer, admin floating buttons; merges settings tabs (T5, T18) |
| `src/components/AdminFloatingButtons.js` | delete | Replaced by sidebar Admin rows (T5) |
| `src/components/Modal.js`, `src/components/DialogHost.js` | modify | Glass dialog shell (T6) |
| `src/components/Dashboard.js`, `StatsCard.js`, `EventBanner.js`, `NewFiscalYearBanner.js`, `DashainBanner.js`, `ArcheryBanner.js` | modify | Dashboard (T7) |
| `src/components/FineTable.js`, `WithdrawalLog.js` | modify | Late Fines (T8) |
| `src/components/StandupFineTable.js`, `StandupFormPage.js`, `StandupFloatingButton.js` | modify | Standup Fines + form (T9) |
| `src/components/LeavePage.js`, `LeaveCalendar.js` | modify | Leaves (T10) |
| `src/components/AttendancePage.js`, `AttendancePunchWidget.js` | modify | Attendance (T11) |
| `src/components/TasksPage.js`, `TaskBoardView.js`, `TaskBacklogView.js`, `TaskBits.js`, `TaskIssueModal.js`, `TaskCreateModal.js`, `TaskSprintModals.js`, `TaskReportsView.js` | modify | Tasks (T12) |
| `src/components/PlanningPokerPage.js`, `src/app/planning-poker/[sessionId]/page.js` | modify | Planning Poker (T13) |
| `src/components/RetrospectivePage.js`, `RetroTimer.js`, `RetroKudos.js`, `RetroActionItems.js`, `RetroThemeTools.js`, `src/app/retrospective/[sessionId]/page.js` | modify | Retrospective (T14) |
| `src/components/MeetingPage.js`, `MeetingShoutouts.js` | modify | Daily Sync meeting page (T15) |
| `src/components/WordPage.js`, `EventsPage.js` | modify | Words, Events (T16) |
| `src/components/EmployeeList.js`, `EmployeeDetailModal.js`, `ProjectsPage.js` | modify | Employees, Projects (T17) |
| `src/components/SettingsPage.js` | create | One Settings screen: preferences + privileges + leave types (T18) |
| `src/components/PrivilegeSettingsPage.js`, `LeaveSettingsPage.js`, `ThemeToggle.js`, `AnimationToggle.js` | modify | Become sections of Settings (T18) |
| `src/components/MemoriesPage.js`, `src/app/login/page.js`, `ReleaseUpdatesModal.js` | modify | Memories, Login, updates dialog (T19) |

## Task 1: Theme tokens, fonts and the contrast check
**Delivers:** acceptance criteria 8, 15 (and the colour half of 7).
**Files:** create `src/lib/contrast.js`, `src/lib/contrast.test.mjs`; modify `src/app/globals.css` (top `:root` block, the `[data-theme="light"]` block in "LIGHT THEME OVERRIDES", `body`), `src/app/layout.js`.
**Kind:** judgement (several files; the code below is complete — copy it).

- [ ] Step 1: write the failing test — `src/lib/contrast.test.mjs`:
  ```js
  import { test } from 'node:test';
  import assert from 'node:assert/strict';
  import { readFileSync } from 'node:fs';
  import { parseColor, composite, contrastRatio, readTokens } from './contrast.js';

  const css = readFileSync(new URL('../app/globals.css', import.meta.url), 'utf8');
  const dark = readTokens(css, '@tokens dark');
  const light = { ...dark, ...readTokens(css, '@tokens light') };
  const PILLS = ['blue', 'green', 'amber', 'red', 'violet', 'cyan', 'gray'];

  test('contrastRatio matches the WCAG reference values', () => {
    assert.equal(Math.round(contrastRatio(parseColor('#000000'), parseColor('#FFFFFF')) * 100) / 100, 21);
    assert.equal(contrastRatio(parseColor('#777777'), parseColor('#777777')), 1);
  });

  test('composite paints a translucent colour over an opaque base', () => {
    assert.deepEqual(composite(parseColor('rgba(255, 255, 255, 0.5)'), parseColor('#000000')), { r: 127.5, g: 127.5, b: 127.5, a: 1 });
  });

  test('readTokens finds the marked token blocks', () => {
    assert.equal(dark['--primary'], '#3D63F0');
    assert.ok(light['--ink'] && light['--ink'] !== dark['--ink']);
  });

  for (const [name, t] of [['dark', dark], ['light', light]]) {
    const glass = composite(parseColor(t['--surface']), parseColor(t['--ink']));
    const pass = (fg, bg, label) =>
      assert.ok(contrastRatio(fg, bg) >= 4.5, `${name} ${label}: ${contrastRatio(fg, bg).toFixed(2)} < 4.5`);

    test(`${name}: text on glass meets 4.5:1 (AC 15)`, () => {
      for (const k of ['--text-1', '--text-2', '--text-3', '--primary-text', '--cyan-text']) pass(parseColor(t[k]), glass, k);
    });

    test(`${name}: every status pill meets 4.5:1 (AC 11, 15)`, () => {
      for (const p of PILLS) pass(parseColor(t[`--pf-${p}`]), composite(parseColor(t[`--pb-${p}`]), glass), `pill ${p}`);
    });

    test(`${name}: button labels meet 4.5:1 (AC 10, 15)`, () => {
      pass(parseColor('#FFFFFF'), parseColor(t['--primary']), 'white on primary');
      pass(parseColor('#0A0E17'), parseColor(t['--orange']), 'ink on orange');
    });
  }
  ```
- [ ] Step 2: run it — `nvm use 22 && npm test`; expected: FAIL with `Cannot find module` for `./contrast.js`.
- [ ] Step 3: create `src/lib/contrast.js` (complete):
  ```js
  // Pure colour maths for the theme contrast test. No imports, so it runs under `npm test`.

  export function parseColor(value) {
    const v = String(value).trim().toLowerCase();
    let m = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
    if (m) {
      const h = m[1].length === 3 ? m[1].split('').map((c) => c + c).join('') : m[1];
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: 1 };
    }
    m = v.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] };
    throw new Error(`Unsupported colour: ${value}`);
  }

  // Paints `top`, which may be translucent, over an opaque `base`.
  export function composite(top, base) {
    const mix = (t, b) => t * top.a + b * (1 - top.a);
    return { r: mix(top.r, base.r), g: mix(top.g, base.g), b: mix(top.b, base.b), a: 1 };
  }

  const channel = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };

  export const luminance = ({ r, g, b }) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

  export function contrastRatio(fg, bg) {
    const a = luminance(fg);
    const b = luminance(bg);
    return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
  }

  // The `--name: value;` declarations of the rule that follows a `/* <marker> */` comment.
  export function readTokens(css, marker) {
    const at = css.indexOf(`/* ${marker} */`);
    if (at === -1) throw new Error(`No token block marked ${marker}`);
    const open = css.indexOf('{', at);
    const close = css.indexOf('}', open);
    const tokens = {};
    for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) tokens[m[1]] = m[2].trim();
    return tokens;
  }
  ```
- [ ] Step 4: replace the token blocks in `src/app/globals.css`.
  - Replace the whole `:root { … }` block at the top (currently `globals.css:10-50`) with the block below. The marker comment must sit directly above it.
    ```css
    /* @tokens dark */
    :root {
      --ink: #070A12;
      --surface: rgba(22, 29, 47, 0.55);
      --surface-solid: #121828;
      --surface-strong: rgba(22, 29, 47, 0.78);
      --raised: rgba(255, 255, 255, 0.05);
      --line: rgba(255, 255, 255, 0.09);
      --line-strong: rgba(255, 255, 255, 0.17);
      --text-1: #EDF1F8;
      --text-2: #B6BFCF;
      --text-3: #8E98AC;
      --primary: #3D63F0;
      --primary-hover: #5174FF;
      --primary-text: #8EA6FF;
      --primary-soft: rgba(61, 99, 240, 0.18);
      --cyan: #2DD4EF;
      --cyan-text: #67E3F5;
      --orange: #FF6A1F;
      --orange-hover: #FF8340;
      --orange-soft: rgba(255, 106, 31, 0.14);
      --unpaid: #F5A524;
      --glow: 0 0 10px rgba(45, 212, 239, 0.7);
      --blur: blur(22px) saturate(160%);
      --glass-hi: inset 0 1px 0 rgba(255, 255, 255, 0.07);
      --shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
      --shadow-lift: 0 16px 40px rgba(0, 0, 0, 0.45);
      --dots: rgba(255, 255, 255, 0.03);
      --pb-blue: rgba(61, 99, 240, 0.2);    --pf-blue: #A5B8FF;
      --pb-green: rgba(34, 197, 94, 0.16);  --pf-green: #6EE7A0;
      --pb-amber: rgba(245, 165, 36, 0.16); --pf-amber: #FCC560;
      --pb-red: rgba(244, 63, 94, 0.16);    --pf-red: #FDA4B4;
      --pb-violet: rgba(167, 139, 250, 0.18); --pf-violet: #C4B5FD;
      --pb-cyan: rgba(45, 212, 239, 0.14);  --pf-cyan: #67E3F5;
      --pb-gray: rgba(255, 255, 255, 0.07); --pf-gray: #B6BFCF;
      --f-display: var(--font-space-grotesk), "Space Grotesk", system-ui, sans-serif;
      --f-body: var(--font-plex), "IBM Plex Sans", system-ui, sans-serif;
      --f-mono: var(--font-jetbrains), "JetBrains Mono", ui-monospace, monospace;

      /* Legacy names, kept so every rule not yet restyled follows the new palette. */
      --bg-primary: var(--ink);
      --bg-secondary: var(--surface-solid);
      --bg-card: var(--surface);
      --bg-card-hover: var(--surface-strong);
      --bg-glass: var(--raised);
      --bg-input: var(--raised);
      --text-primary: var(--text-1);
      --text-secondary: var(--text-2);
      --text-muted: var(--text-3);
      --border-color: var(--line);
      --border-hover: var(--line-strong);
      --accent-indigo: var(--primary);
      --accent-indigo-soft: var(--primary-soft);
      --accent-green: #22C55E;
      --accent-green-soft: var(--pb-green);
      --accent-red: #F43F5E;
      --accent-red-soft: var(--pb-red);
      --accent-amber: var(--unpaid);
      --accent-amber-soft: var(--pb-amber);
      --accent-orange: var(--orange);
      --accent-orange-soft: var(--orange-soft);
      --radius-sm: 10px;
      --radius-md: 12px;
      --radius-lg: 16px;
      --radius-xl: 20px;
      --shadow-sm: var(--shadow);
      --shadow-md: var(--shadow);
      --shadow-lg: var(--shadow-lift);
      --shadow-glow-indigo: 0 6px 20px rgba(61, 99, 240, 0.35);
      --shadow-glow-green: 0 6px 20px rgba(34, 197, 94, 0.25);
      --shadow-glow-red: 0 6px 20px rgba(244, 63, 94, 0.25);
    }
    ```
  - In "LIGHT THEME OVERRIDES" (currently `globals.css:4839-4860`), replace that `[data-theme="light"] { … }` block (only that block; the component overrides after it stay) with:
    ```css
    /* @tokens light */
    [data-theme="light"] {
      --ink: #EDF1F8;
      --surface: rgba(255, 255, 255, 0.6);
      --surface-solid: #FFFFFF;
      --surface-strong: rgba(255, 255, 255, 0.82);
      --raised: rgba(255, 255, 255, 0.65);
      --line: rgba(14, 21, 37, 0.08);
      --line-strong: rgba(14, 21, 37, 0.16);
      --text-1: #0E1525;
      --text-2: #3B4558;
      --text-3: #5A6478;
      --primary-hover: #3254D6;
      --primary-text: #2F52D8;
      --primary-soft: rgba(61, 99, 240, 0.1);
      --cyan: #06B6D4;
      --cyan-text: #0E7490;
      --orange-soft: rgba(255, 106, 31, 0.1);
      --glow: 0 0 8px rgba(6, 182, 212, 0.55);
      --glass-hi: inset 0 1px 0 rgba(255, 255, 255, 0.9);
      --shadow: 0 8px 24px rgba(30, 41, 82, 0.08);
      --shadow-lift: 0 16px 40px rgba(30, 41, 82, 0.14);
      --dots: rgba(14, 21, 37, 0.04);
      --pb-blue: rgba(61, 99, 240, 0.1);    --pf-blue: #2F52D8;
      --pb-green: rgba(34, 197, 94, 0.12);  --pf-green: #166534;
      --pb-amber: rgba(245, 165, 36, 0.16); --pf-amber: #92400E;
      --pb-red: rgba(244, 63, 94, 0.1);     --pf-red: #BE123C;
      --pb-violet: rgba(124, 92, 224, 0.1); --pf-violet: #6D28D9;
      --pb-cyan: rgba(6, 182, 212, 0.12);   --pf-cyan: #0E7490;
      --pb-gray: rgba(14, 21, 37, 0.06);    --pf-gray: #3B4558;
    }
    ```
    `--pf-green` is `#166534`, not the canvas's `#15803D`: the canvas value measures 4.33:1 on the light green pill and fails criterion 15.
  - The aliases need no light copies: they are declared on the same `<html>` element, so they resolve against whichever base tokens apply there.
- [ ] Step 5: run it — `npm test`; expected: PASS (all `contrast` tests plus the existing suites).
- [ ] Step 6: fonts. Facts verified in `node_modules/next/dist/docs/01-app/03-api-reference/02-components/font.md` (`variable` option, lines 222-232; variables applied on `<html>`, line 739) and `node_modules/next/dist/compiled/@next/font/dist/google/font-data.json` (all three families are variable fonts, so no `weight` is needed). In `src/app/layout.js`:
  - `import { Space_Grotesk, IBM_Plex_Sans, JetBrains_Mono } from "next/font/google";`
  - Module-level: `const display = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk" });`, `const body = IBM_Plex_Sans({ subsets: ["latin"], variable: "--font-plex" });`, `const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });`
  - `<html … className={`${display.variable} ${body.variable} ${mono.variable}`}>`; delete the Inter `<link>` (`layout.js:19-22`); keep the Google sign-in `<script>`.
- [ ] Step 7: base type in `globals.css`. The `body` rule (`globals.css:73-83`): `font-family: var(--f-body);`, `background: var(--ink);`, replace the two radial gradients with `background-image: radial-gradient(var(--dots) 1px, transparent 1px); background-size: 24px 24px;`. Add after it: `h1, h2, h3, h4 { font-family: var(--f-display); letter-spacing: -0.01em; }` and `code, kbd, .mono { font-family: var(--f-mono); }`. Replace the two `font-family: 'Inter', sans-serif` / `monospace` declarations in `.poker-standalone-shell` and `.poker-share-input` (`globals.css:6152`, `6213`) with `var(--f-body)` / `var(--f-mono)`.
- [ ] Step 8: smoke — `npm run dev`, open `/` in dark then light (old settings menu still works at this point): page is navy ink with a faint dot grid (pale in light); headings render in Space Grotesk, body in IBM Plex Sans (check in devtools > Computed > font-family); no screen has unreadable text after the palette shift.

## Task 2: Glass primitives, aurora and shared classes
**Delivers:** acceptance criteria 7, 10, 11 (shared styles every later task builds on); edge case "browsers without backdrop blur".
**Files:** modify `src/app/globals.css` (new section "GLASS PRIMITIVES" directly after the `body` rule; sections BUTTONS `278-386`, STATS CARDS `426-494`, SECTION TITLES `495-504`, CHART `505-638`, TABLE `639-778`, STATUS BADGE `901-930`, MODAL/FORM inputs `1418-1510`), `src/components/AmbientAurora.js`; create `src/lib/avatar.js`, `src/lib/avatar.test.mjs`.
**Kind:** judgement.

This task defines the shared class contract. Later tasks use these names and never restate their rules.

| Class | Rule (values from `docs/web-ui-revamp/design/Main.dc.html` and `Foundations.dc.html`) |
| --- | --- |
| `.glass` | `background: var(--surface); border: 1px solid var(--line); -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); box-shadow: var(--glass-hi), var(--shadow);` |
| `.glass-card` | `.glass` + `border-radius: 16px; padding: 20px 24px;` |
| `.card-lift` | `transition: box-shadow .18s ease, border-color .18s ease, transform .18s ease;` hover: `box-shadow: var(--glass-hi), var(--shadow-lift); border-color: var(--line-strong); transform: translateY(-2px);` |
| `.page-head` / `.page-head-text` / `.page-eyebrow` / `.page-title` / `.page-subtitle` / `.page-actions` | flex-wrap row aligned end, gap 16; eyebrow `font: 500 12px var(--f-mono); letter-spacing: .08em; text-transform: uppercase; color: var(--cyan-text)`; title `var(--f-display) 34px/1.15 700, letter-spacing -0.02em, var(--text-1)`; subtitle 15px `var(--text-3)`; actions flex-wrap gap 8 |
| `.section-title` (existing) | `font: 700 19px var(--f-display); color: var(--text-1);` no emoji |
| `.btn` (existing) | `height: 40px; padding: 0 16px; border-radius: 10px; font: 600 14px var(--f-body); gap: 6px; display: inline-flex; align-items: center; transform: none on hover` |
| `.btn-primary` | `background: var(--primary); color: #fff; box-shadow: 0 6px 20px rgba(61,99,240,.35);` hover `background: var(--primary-hover)` (no gradient, no lift) |
| `.btn-secondary` | `.glass` fill + `border: 1px solid var(--line-strong); color: var(--text-1);` hover `background: var(--raised)` |
| `.btn-ghost` | transparent, `color: var(--text-2)`, hover `background: var(--raised)` |
| `.btn-danger` | `background: var(--pb-red); color: var(--pf-red); border: 1px solid rgba(244,63,94,.4);` |
| `.btn-warning` | `background: var(--pb-amber); color: var(--pf-amber);` |
| `.btn-orange` (new) | `background: var(--orange); color: #0A0E17; border-radius: 9999px; box-shadow: 0 6px 20px rgba(255,106,31,.3);` hover `var(--orange-hover)` — only Start Meeting, wishes, celebrations |
| `.btn-sm` | `height: 32px; padding: 0 12px; font-size: 13px;` |
| `.btn-icon` (new) | `width: 40px; height: 40px; padding: 0; justify-content: center; border-radius: 10px; background: var(--raised); border: 1px solid var(--line); color: var(--text-2);` `.btn-icon.btn-sm` is 32×32 |
| `.pill` + `.pill-blue/-green/-amber/-red/-violet/-cyan/-gray` (new) | `height: 22px; padding: 0 8px; border-radius: 9999px; font: 600 12px var(--f-body); display: inline-flex; align-items: center; gap: 6px;` colour pair `background: var(--pb-X); color: var(--pf-X)` |
| `.status-badge` (existing) | same box as `.pill`; `.paid` → green pair, `.unpaid` → amber pair, `.holiday` → cyan pair; keep `cursor: pointer` and hover where it is a toggle (`globals.css:913-930`) |
| `.avatar` / `.avatar-sm` / `.avatar-lg` / `.avatar-me` (new) | circle, `color: #fff; font: 600 12px var(--f-body);` sizes 32 / 24 / 48 (lg font 17px `var(--f-display)` 700); `.avatar-me { background: var(--orange); color: #0A0E17; }`. Background set inline from `avatarColor()` |
| `.eyebrow` (new) | as `.page-eyebrow` but `color: var(--text-3)` and `letter-spacing: .06em` — the KPI/table label style |
| `.mono` | `font-family: var(--f-mono)` (added in Task 1) |
| `.empty-msg` (existing) | `color: var(--text-3); font-size: 14px;` |
| `.data-table` (existing) | `th`: `font: 500 12px var(--f-mono); letter-spacing: .06em; text-transform: uppercase; color: var(--text-3); padding: 0 12px 10px; border-bottom: 1px solid var(--line)`; `td`: 14px, `padding: 14px 12px; border-top: 1px solid var(--line)`; row hover `background: var(--raised)`; `.amount-cell`, `.date-cell` use `var(--f-mono)` |
| `.chart-container`, `.stats-card` (existing) | take the `.glass-card` rules; drop the old `::before` gradient strips and the spotlight layer's colour (Task 7 finishes StatsCard) |
| `.bar-track` / `.bar-paid` / `.bar-unpaid` (existing) | track `height: 14px; border-radius: 5px; background: var(--raised); gap: 2px`; paid `var(--primary)` with `box-shadow: 0 0 12px rgba(61,99,240,.5)`; unpaid `var(--unpaid)`; `.bar-total` mono 13px |
| form controls | one zero-specificity base: `:where(input:not([type="checkbox"]):not([type="radio"]):not([type="range"]):not([type="color"]):not([type="file"]), select, textarea) { height: 44px; padding: 0 12px; border-radius: 10px; border: 1px solid var(--line-strong); background: var(--raised); color: var(--text-1); font: 14px var(--f-body); }` (`textarea`: `height: auto; padding: 10px 12px`); focus `border-color: var(--cyan); box-shadow: 0 0 0 3px rgba(45,212,239,.15); outline: none;` `input[type=checkbox], input[type=radio] { accent-color: #3D63F0; }`. `:where()` keeps specificity 0, so existing class rules still win until their screen task replaces them. The global `select option` rule stays as it is. |

- [ ] Step 1: write the failing test — `src/lib/avatar.test.mjs`, assertions:
  - `initials('Rohan KC') === 'RK'`; `initials('Sanish') === 'S'`; `initials('  priya   maharjan ') === 'PM'`; `initials('') === '?'`; `initials('Anisha Kumari Rai') === 'AR'` (first and last word).
  - `AVATAR_COLORS` deep-equals `['#3D63F0', '#7C5CE0', '#0B7F90', '#B4471A']`.
  - `avatarColor('Sita Gurung') === avatarColor('Sita Gurung')` and is one of `AVATAR_COLORS`; across the eight sample names (Aarav Shrestha, Sita Gurung, Bikash Thapa, Priya Maharjan, Rohan KC, Kriti Joshi, Nabin Tamang, Anisha Rai) at least three distinct colours occur; `avatarColor('')` returns `AVATAR_COLORS[0]`.
  - Neighbouring style: `src/lib/retroThemes.test.mjs:1-3` (imports `node:test`, `node:assert/strict`, the module by relative `.js` path).
- [ ] Step 2: run it — `npm test`; expected: FAIL with `Cannot find module` for `./avatar.js`.
- [ ] Step 3: create `src/lib/avatar.js` (pure, no imports): `export const AVATAR_COLORS = [...]` (the four above, white initials pass 4.5:1 on each); `export function initials(name)` — trimmed words, first letter of the first word plus first letter of the last word when there are two or more, uppercased, `'?'` for empty; `export function avatarColor(name)` — exactly: `let h = 0; for (const c of String(name || '').trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length];` (empty → index 0; the eight sample names spread over three colours with this hash, checked while planning).
- [ ] Step 4: run it — `npm test`; expected: PASS.
- [ ] Step 5: write the "GLASS PRIMITIVES" section and restyle the existing sections per the table. Delete superseded declarations rather than overriding them (old gradients on `.btn-primary` `globals.css:294-303`, `.stats-card::before` `449-459`, `.chart-container` `backdrop-filter: blur(20px)` duplicates). Add the no-blur fallback: `@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) { .glass, .glass-card, .chart-container, .stats-card, .modal-content { background: var(--surface-strong); } }`.
- [ ] Step 6: `src/components/AmbientAurora.js` — keep the motion logic (`useMotionValue`/springs, the `animationsEnabled` early-return at line 103); change only `BLOBS` (lines 31-63) to the canvas aurora: tracker `rgba(61, 99, 240, 0.18)` 620px; anchored blue `rgba(61, 99, 240, 0.34)` at x 14% y 6%, 760px; violet `rgba(124, 92, 224, 0.26)` at 88% / 14%, 660px; cyan `rgba(45, 212, 239, 0.16)` at 72% / 96%, 680px; orange `rgba(255, 106, 31, 0.11)` at 22% / 88%, 520px. In light theme (`theme` from `useApp()`), multiply each alpha by 0.6. Keep its fixed, behind-content positioning.
- [ ] Step 7: smoke — `npm run dev`, `/`: buttons are solid blue / glass / red-tint with no gradient; Late Fines table headers are small mono caps; paid/unpaid badges are green/amber pills; cards are translucent with the aurora visibly blurred behind them (dark and light); with Animations off the aurora does not follow the cursor.

## Task 3: Icon component
**Delivers:** acceptance criterion 9 (the icon set every later task uses in place of emoji).
**Files:** create `src/components/Icon.js`.
**Kind:** transcription.

No test: the component draws markup and decides nothing (a missing name renders nothing).

- [ ] Step 1: create `src/components/Icon.js` (complete):
  ```js
  // Line icons (Lucide-style: 24px grid, round joins), drawn inline so they take the text
  // colour. Decorative by default; pass `label` when an icon is the only content of a control.
  const PATHS = {
    dashboard: "M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z",
    wallet: "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4",
    clipboard: "M9 2h6a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1zM16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2M12 11h4M12 16h4M8 11h.01M8 16h.01",
    calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z",
    pin: "M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0ZM12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    kanban: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM8 7v7M12 7v4M16 7v9",
    layers: "M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
    refresh: "M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16M8 16H3v5",
    book: "M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z",
    flag: "M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7",
    users: "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75",
    user: "M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
    folder: "M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z",
    sliders: "M20 7h-9M14 17H5M17 14a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM7 4a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    image: "M5 3h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zM9 7a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM21 15l-3.09-3.09a2 2 0 0 0-2.82 0L6 21",
    logout: "M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9",
    search: "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM21 21l-4.3-4.3",
    bell: "M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
    sun: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41",
    moon: "M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z",
    video: "M16 13l5.22 3.48a.5.5 0 0 0 .78-.42V7.87a.5.5 0 0 0-.75-.43L16 10.5M4 6h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z",
    plus: "M12 5v14M5 12h14",
    x: "M18 6 6 18M6 6l12 12",
    check: "M20 6 9 17l-5-5",
    "chevron-down": "m6 9 6 6 6-6",
    "chevron-left": "m15 18-6-6 6-6",
    "chevron-right": "m9 18 6-6-6-6",
    "arrow-left": "M19 12H5M12 19l-7-7 7-7",
    edit: "M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z",
    trash: "M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2",
    more: "M12 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM19 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2zM5 11a1 1 0 1 0 0 2 1 1 0 0 0 0-2z",
    menu: "M4 6h16M4 12h16M4 18h16",
    filter: "M22 3H2l8 9.46V19l4 2v-8.54L22 3z",
    clock: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2",
    share: "M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8M16 6l-4-4-4 4M12 2v13",
    qr: "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4",
    copy: "M8 8h12v12H8zM4 16V6a2 2 0 0 1 2-2h10",
    link: "M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71",
    external: "M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6",
    "thumbs-up": "M7 10v12M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z",
    message: "M7.9 20A9 9 0 1 0 4 16.1L2 22Z",
    smile: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01",
    cake: "M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1M2 21h20M7 8v3M12 8v3M17 8v3",
    award: "M12 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12zM15.48 12.89 17 22l-5-3-5 3 1.52-9.11",
    gift: "M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z",
    alert: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 8v4M12 16h.01",
    sparkles: "M12 3l1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3zM5 3v4M3 5h4M19 17v4M17 19h4",
    send: "M22 2 11 13M22 2l-7 20-4-9-9-4 20-7z",
    play: "M6 3l14 9-14 9V3z",
    pause: "M6 4h4v16H6zM14 4h4v16h-4z",
    mail: "M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zM22 6l-10 7L2 6",
    phone: "M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z",
    lock: "M5 11h14v10H5zM7 11V7a5 5 0 0 1 10 0v4",
    key: "M15.5 7.5 19 4l3 3-3.5 3.5M15.5 7.5l3 3M15.5 7.5 11.4 11.6M11.4 11.6a5.5 5.5 0 1 0-7.78 7.78 5.5 5.5 0 0 0 7.78-7.78z",
    download: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
    eye: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
    home: "M3 10l9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10",
    building: "M4 22V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v18zM9 6h.01M15 6h.01M9 10h.01M15 10h.01M9 14h.01M15 14h.01M10 22v-4h4v4",
    grip: "M9 5h.01M9 12h.01M9 19h.01M15 5h.01M15 12h.01M15 19h.01",
  };

  export const ICON_NAMES = Object.keys(PATHS);

  export default function Icon({ name, size = 18, strokeWidth = 1.8, label, className = "", style }) {
    const d = PATHS[name];
    if (!d) return null;
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`icon ${className}`.trim()}
        style={style}
        focusable="false"
        role={label ? "img" : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : "true"}
      >
        <path d={d} />
      </svg>
    );
  }
  ```
- [ ] Step 2: add to `globals.css` "GLASS PRIMITIVES": `.icon { flex-shrink: 0; display: inline-block; vertical-align: middle; }`.
- [ ] Step 3: run `npm run lint`; expected: no new errors in `src/components/Icon.js`.
- [ ] Step 4: no smoke here: nothing renders `Icon` until Task 5, whose sidebar smoke covers it.

## Task 4: Navigation model
**Delivers:** acceptance criteria 1, 3, 4 (the decisions behind them).
**Files:** create `src/lib/navigation.js`, `src/lib/navigation.test.mjs`.
**Kind:** transcription.

Today's tab ids (`src/app/page.js`, the saved-tab whitelist in the mount effect) are kept, so saved tabs and the Tasks `#issue=` deep link keep working. The two settings tabs (`leave-settings`, `privilege-settings`) become one `settings` section (Task 18). Employees stays visible to everyone (it is today); Projects and Settings were reachable only from the admin floating buttons and stay admin-only.

- [ ] Step 1: write the failing test — `src/lib/navigation.test.mjs` (complete):
  ```js
  import { test } from 'node:test';
  import assert from 'node:assert/strict';
  import { NAV_GROUPS, TAB_IDS, navGroupsFor, normalizeTab, allowedTab } from './navigation.js';

  const ids = (groups) => groups.flatMap((g) => g.items.map((i) => i.id));

  test('sidebar groups read Overview, Records, Team, Admin in that order (AC 1)', () => {
    assert.deepEqual(navGroupsFor({ isAdmin: true }).map((g) => g.label), ['Overview', 'Records', 'Team', 'Admin']);
    assert.deepEqual(ids(navGroupsFor({ isAdmin: true })), [
      'dashboard', 'records', 'standup', 'leaves', 'attendance',
      'tasks', 'poker', 'retro', 'words', 'events',
      'employees', 'projects', 'settings',
    ]);
  });

  test('a non-admin keeps Employees but not Projects or Settings (AC 4)', () => {
    const shown = ids(navGroupsFor({ isAdmin: false }));
    assert.ok(shown.includes('employees'));
    assert.ok(!shown.includes('projects'));
    assert.ok(!shown.includes('settings'));
  });

  test('every row has a label and an icon, and ids are unique', () => {
    const all = NAV_GROUPS.flatMap((g) => g.items);
    for (const item of all) assert.ok(item.label && item.icon, item.id);
    assert.equal(new Set(all.map((i) => i.id)).size, all.length);
  });

  test('saved tabs survive the reload, old settings tabs land on Settings (AC 3)', () => {
    assert.equal(normalizeTab('records'), 'records');
    assert.equal(normalizeTab('memories'), 'memories');
    assert.equal(normalizeTab('standup-form'), 'standup-form');
    assert.equal(normalizeTab('leave-settings'), 'settings');
    assert.equal(normalizeTab('privilege-settings'), 'settings');
    assert.equal(normalizeTab('nonsense'), 'dashboard');
    assert.equal(normalizeTab(null), 'dashboard');
  });

  test('an admin-only tab falls back to the dashboard for everyone else (AC 4)', () => {
    assert.equal(allowedTab('settings', { isAdmin: false }), 'dashboard');
    assert.equal(allowedTab('projects', { isAdmin: false }), 'dashboard');
    assert.equal(allowedTab('settings', { isAdmin: true }), 'settings');
    assert.equal(allowedTab('employees', { isAdmin: false }), 'employees');
  });

  test('TAB_IDS covers every row plus the tabs reached another way', () => {
    for (const id of [...ids(NAV_GROUPS), 'standup-form', 'memories', 'capacity']) assert.ok(TAB_IDS.includes(id), id);
  });
  ```
- [ ] Step 2: run it — `npm test`; expected: FAIL with `Cannot find module` for `./navigation.js`.
- [ ] Step 3: create `src/lib/navigation.js` (complete):
  ```js
  // The sidebar's sections, who sees them, and how a saved tab maps onto them.
  // Pure, no imports, so it runs under `npm test`. Icon names are Icon.js names.

  export const NAV_GROUPS = [
    { id: "overview", label: "Overview", items: [{ id: "dashboard", label: "Dashboard", icon: "dashboard" }] },
    {
      id: "records",
      label: "Records",
      items: [
        { id: "records", label: "Late Fines", icon: "wallet" },
        { id: "standup", label: "Standup Fines", icon: "clipboard" },
        { id: "leaves", label: "Leaves", icon: "calendar" },
        { id: "attendance", label: "Attendance", icon: "pin" },
      ],
    },
    {
      id: "team",
      label: "Team",
      items: [
        { id: "tasks", label: "Tasks", icon: "kanban" },
        { id: "poker", label: "Planning Poker", icon: "layers" },
        { id: "retro", label: "Retrospective", icon: "refresh" },
        { id: "words", label: "Words", icon: "book" },
        { id: "events", label: "Events", icon: "flag" },
      ],
    },
    {
      id: "admin",
      label: "Admin",
      items: [
        { id: "employees", label: "Employees", icon: "users" },
        { id: "projects", label: "Projects", icon: "folder", adminOnly: true },
        { id: "settings", label: "Settings", icon: "sliders", adminOnly: true },
      ],
    },
  ];

  // Tabs opened another way: the standup form (floating button), Memories (sidebar foot),
  // and Capacity (no entry today, kept so an old saved tab still opens).
  const EXTRA_TABS = ["standup-form", "memories", "capacity"];

  // The two admin settings tabs became one Settings section.
  const RENAMED = { "leave-settings": "settings", "privilege-settings": "settings" };

  const ADMIN_ONLY = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.adminOnly).map((i) => i.id);

  export const TAB_IDS = [...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)), ...EXTRA_TABS];

  export function navGroupsFor({ isAdmin = false } = {}) {
    return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.adminOnly) })).filter(
      (g) => g.items.length > 0
    );
  }

  export function normalizeTab(saved) {
    const tab = RENAMED[saved] || saved;
    return TAB_IDS.includes(tab) ? tab : "dashboard";
  }

  export function allowedTab(tab, { isAdmin = false } = {}) {
    return ADMIN_ONLY.includes(tab) && !isAdmin ? "dashboard" : tab;
  }
  ```
- [ ] Step 4: run it — `npm test`; expected: PASS.

## Task 5: App shell — sidebar, top bar, page heading
**Delivers:** acceptance criteria 1, 2, 3, 4, 5, 6, 17; edge case "long names" for the sidebar.
**Files:** create `src/lib/pageMeta.js`, `src/lib/pageMeta.test.mjs`, `src/components/Sidebar.js`, `src/components/TopBar.js`, `src/components/PageHead.js`; modify `src/app/page.js`, `src/app/globals.css` (new section "APP SHELL" replacing the old "APP SHELL" `85-94`, "HEADER" `119-277`, "NAV TABS" `387-419`, "FOOTER" `1511-1522`, "FOOTER MEMORIES LINK" `7149-7198`, "ADMIN FLOATING BUTTONS" `9018-9123`; line numbers are before Tasks 1–2 moved them — find by section comment); delete `src/components/AdminFloatingButtons.js`.
**Kind:** judgement.
**Reference:** `docs/web-ui-revamp/design/Main.dc.html` (shell markup: sidebar wrapper, `<header>`, page head) and `Sidebar.dc.html` (rows, group labels, active row with the cyan dot, foot).

**Interfaces other tasks rely on:**
- `src/lib/pageMeta.js` (pure): `export const PAGE_META = { [tabId]: { title, subtitle } }` and `export function greetingFor(hour)` and `export function pageMetaFor(tabId, { firstName, hour, groupLabel })` → `{ eyebrow, title, subtitle }`.
- `<PageHead eyebrow title subtitle>{actions}</PageHead>` renders `.page-head` (Task 2 classes): eyebrow `<span class="page-eyebrow">`, `<h1 class="page-title">`, `<p class="page-subtitle">`, children in `<div class="page-actions">`. Screens never render their own page title after this; screen tasks delete in-component titles that duplicate it.
- `<Sidebar activeTab onSelect isAdmin onShowUpdates onSignOut open onClose />`.
- `<TopBar onOpenMenu />` (reads `user`, `theme`, `toggleTheme` from `useApp()`).

- [ ] Step 1: write the failing test — `src/lib/pageMeta.test.mjs`, assertions:
  - `greetingFor(5) === 'Good morning'`, `greetingFor(11) === 'Good morning'`, `greetingFor(12) === 'Good afternoon'`, `greetingFor(16) === 'Good afternoon'`, `greetingFor(17) === 'Good evening'`, `greetingFor(2) === 'Good evening'`.
  - `pageMetaFor('dashboard', { firstName: 'Sanish', hour: 9 }).title === 'Good morning, Sanish'`; with `firstName: ''` the title is `'Good morning'`.
  - `pageMetaFor('records', { groupLabel: 'Records' })` deep-equals `{ eyebrow: 'Records', title: 'Late fines', subtitle: 'Late arrivals, fine seasons and the fine jar.' }`.
  - Every id in `TAB_IDS` (import from `./navigation.js`) has a `PAGE_META` entry with a non-empty `title`; an unknown id returns the dashboard meta.
- [ ] Step 2: run it — `npm test`; expected: FAIL with `Cannot find module` for `./pageMeta.js`.
- [ ] Step 3: `src/lib/pageMeta.js` — `greetingFor`: 5–11 morning, 12–16 afternoon, otherwise evening. `PAGE_META` titles and subtitles, sentence case, exactly:
  `dashboard` "Dashboard" / "Here's how the team is doing today." (`pageMetaFor` replaces this title with the greeting) · `records` "Late fines" / "Late arrivals, fine seasons and the fine jar." · `standup` "Standup fines" / "Missed standup forms and their contributions." · `standup-form` "Today's standup" / "What you did, what's next and what's in your way." · `leaves` "Leaves" / "Leave calendar, balances and public holidays." · `attendance` "Attendance" / "Check in, check out and monthly sheets." · `tasks` "Tasks" / "Plan, assign and track the team's work across projects." · `poker` "Planning poker" / "Estimate stories together." · `retro` "Retrospective" / "Look back on the sprint together." · `words` "Word of the day" / "One new word for the team, every day." · `events` "Events" / "Company events and public holidays." · `employees` "Employees" / "Everyone on the team." · `projects` "Projects" / "Clients, environments, links and who is on each." · `settings` "Settings" / "Roles, list visibility, leave types and preferences." · `memories` "Memories" / "Photos, videos and moments from the team." · `capacity` "Capacity" / "Team capacity across projects." `pageMetaFor` eyebrow: `groupLabel` when given, else `''` (page.js passes the dashboard's date eyebrow itself).
- [ ] Step 4: run it — `npm test`; expected: PASS.
- [ ] Step 5: `src/components/Sidebar.js` (`"use client"`). Markup per `Sidebar.dc.html`: logo `<img src="/logo.png" alt="">` 34px radius 9 + "Heubert Tracker" (`var(--f-display)` 16/700) + mono "team.heubert" 12px; groups from `navGroupsFor({ isAdmin })` with mono uppercase group labels; each row a `<button type="button">` (tabs are state, not URLs) 38px tall, radius 9, `<Icon name={item.icon} />` + label; the active row gets `aria-current="page"`, `background: var(--raised)`, inset 1px `var(--line)` ring, icon `var(--primary-text)` and a 6px cyan dot with `box-shadow: var(--glow)` at the right; other rows hover `var(--raised)`. Standup Fines row shows a count pill (`.pill.pill-red`) of pending standup fines from `useApp().standupFines.filter(f => f.status === "unpaid").length` when > 0. Foot, above a `var(--line)` divider: "Memories" (`image`, calls `onSelect("memories")`), "What's new" (`gift`, calls `onShowUpdates` — the old footer "Updates" link), "Log Out" (`logout`, calls `onSignOut`), then a mono 12px status line with a green dot "Cloud database connected" (the old footer `db-status`). Wrapper `<aside class="app-sidebar glass">` — `position: sticky; top: 0; height: 100vh; overflow-y: auto; width: 240px; flex-shrink: 0; border-right: 1px solid var(--line); padding: 0 12px 20px;`. Phone width (`max-width: 900px`): `position: fixed; inset: 0 auto 0 0; z-index: 60; transform: translateX(-100%); transition: transform .2s ease;` `.is-open` → `translateX(0)`, plus a sibling `.app-sidebar-scrim` (`position: fixed; inset: 0; background: rgba(4,6,12,.55); z-index: 55`) rendered only when `open`; selecting a row or clicking the scrim calls `onClose`. Long labels: `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`.
- [ ] Step 6: `src/components/TopBar.js` (`"use client"`). Per `Main.dc.html` `<header>`: `<header class="app-topbar glass">` (min-height 68, padding 12px 32px, border-bottom `var(--line)`, `position: sticky; top: 0; z-index: 40`). Left: a menu `.btn-icon` (`menu`, `aria-label="Open menu"`, calls `onOpenMenu`) shown only at phone width; a search `<label>` with `search` icon, `<input type="search" aria-label="Search" placeholder="Search people, fines, tasks…">` and a mono `<kbd>Ctrl K</kbd>` — visual only (open question 1). Right: `<Link href="/meeting" className="btn btn-orange">` with `video` icon and "Start Meeting" (replaces `.btn-start-meeting`); a `.btn-icon` bell (`aria-label="Notifications"`, visual only, open question 4); a `.btn-icon` theme button (`sun` in dark, `moon` in light; `aria-label` "Switch to light theme"/"Switch to dark theme"; calls `toggleTheme`); the account button — the user's Google avatar image (`user.user_metadata.avatar_url`, as `page.js` does today) or an `.avatar.avatar-me` with `initials()` — first name, `chevron-down`; it toggles the existing preferences dropdown (`.settings-dropdown` with `<ThemeToggle />` and `<AnimationToggle />`), with the click-outside handler moved from `page.js:60-71`. At phone width the search label hides and the Start Meeting text collapses to its icon (keep `aria-label="Start Meeting"`).
- [ ] Step 7: `src/components/PageHead.js` — the markup in the interface above; no state.
- [ ] Step 8: `src/app/page.js`:
  - Remove the `<header className="app-header">…</header>`, the `<nav className="nav-tabs">…</nav>`, the `<footer className="app-footer">…</footer>`, the `AdminFloatingButtons` import and element, the settings-dropdown state/ref/effect (moved to TopBar), and the `Link` import if no longer used.
  - Layout: `<div className="app-shell">` → `<Sidebar … />` + `<div className="app-main"><TopBar onOpenMenu={() => setNavOpen(true)} /><main className="app-content">…</main></div>`; new state `navOpen`.
  - Mount effect: `setActiveTab(normalizeTab(localStorage.getItem("heubert-active-tab")))` replaces the inline whitelist (`page.js` mount effect); keep the `#issue=` branch first. When `currentEmployee` has loaded, `setActiveTab(t => allowedTab(t, { isAdmin }))`.
  - Above the active tab's content (every tab except `memories`, which stays standalone), render `<PageHead {...pageMetaFor(activeTab, { firstName, hour: new Date().getHours(), groupLabel })}>` where `groupLabel` is the label of the `navGroupsFor` group holding the tab, and on `dashboard` the eyebrow is `"<Weekday> · <Mon D> · <formatBs(todayStr)>"` (e.g. "Monday · Oct 19 · 3 Kartik 2083") using `formatBs` from `@/lib/nepaliDate` and the Nepal date from `getNepalParts(new Date()).dateStr` (`@/lib/standupWindow`).
  - Move each tab's header action buttons (today in `.header-actions`: Add Employee, Record Leave, Standup Fine, Record Fine, the dashboard's Add Employee/Record Fine) into that `PageHead` as children, unchanged in behaviour, restyled: primary actions `btn btn-primary` with `<Icon name="plus" />`, others `btn btn-secondary`; "Standup Fine" becomes `btn btn-danger`. Drop the leading `<span>+</span>` text.
  - `onSelect` for the sidebar: same as today's tab buttons (`setActiveTab`, and for `records` also `setSelectedEmployee(null)`), then `setNavOpen(false)`. `onSignOut` is `signOut`; `onShowUpdates` opens `ReleaseUpdatesModal` (`setShowReleaseUpdates(true)`).
  - `settings` renders `<LeaveSettingsPage />` and `<PrivilegeSettingsPage />` stacked until Task 18 replaces them with `SettingsPage`.
- [ ] Step 9: delete `src/components/AdminFloatingButtons.js` and its CSS section; delete the old HEADER, NAV TABS, FOOTER and FOOTER MEMORIES LINK CSS. The `heubert_admin_fab_hidden` localStorage key is simply no longer read.
- [ ] Step 10: run `npm test` and `npm run lint`; expected: PASS, no new lint errors.
- [ ] Step 11: smoke — `npm run dev`, signed in as an admin: sidebar shows four groups, Employees/Projects/Settings under Admin; the open tab's row is highlighted with a cyan dot; clicking each row opens its tab; reload keeps it; a saved `leave-settings` value in localStorage opens Settings. Signed in as a non-admin (or with `is_admin` false): no Projects/Settings rows, Employees present; a saved `settings` tab opens Dashboard. Top bar: Start Meeting goes to `/meeting`; theme button flips theme; account menu opens the two toggles and closes on outside click. Record Fine / Record Leave / Add Employee / Standup Fine buttons sit in the page heading and open their modals. At 390px wide: no sidebar beside content, menu button opens it as a drawer over a scrim, no sideways page scroll. The old emoji tab row, header and footer are gone; Memories and What's new open from the sidebar foot.

## Task 6: Glass dialogs — every modal
**Delivers:** acceptance criteria 9 (dialogs), 12; edge case "browsers without backdrop blur" for dialogs.
**Files:** modify `src/app/globals.css` (sections "MODAL" `1345-1417`, "FORM" `1418-1510`, "LEAVE MODAL EXTRA", "FINE MODAL EXTRAS", "LUXURY MODAL STYLES", "CONFIRM / ALERT / PROMPT DIALOG", "PROJECT FORM", "--- create & sprint dialogs ---"), `src/components/Modal.js`, `src/components/DialogHost.js`, and the markup of every dialog: `AddEmployeeModal.js`, `EditEmployeeModal.js`, `AddFineModal.js`, `EditFineModal.js`, `AddFineSeasonModal.js`, `EditFineSeasonModal.js`, `AddStandupFineModal.js`, `EditStandupModal.js`, `AddLeaveModal.js`, `EditLeaveModal.js`, `AddLeaveSeasonModal.js`, `EditLeaveSeasonModal.js`, `AddPublicHolidayModal.js`, `AddCompanyEventModal.js`, `EditCompanyEventModal.js`, `AddWordModal.js`, `EditWordModal.js`, `AddWordSeasonModal.js`, `EditWordSeasonModal.js`, `AddMemoryModal.js`, `EditAttendanceModal.js`, `WithdrawModal.js`, `ShareQRModal.js`, `ReleaseUpdatesModal.js`, `EmployeeDetailModal.js` (frame only; content in Task 17), `TaskCreateModal.js`, `TaskIssueModal.js` and `TaskSprintModals.js` (frame only; content in Task 12).
**Kind:** judgement.
**Reference:** `docs/web-ui-revamp/design/RecordFine.dc.html` (the dialog: scrim, panel, header with icon tile + mono eyebrow + 22px title + close, form fields, inline alert, footer actions).

Many dialogs render `.modal-overlay` / `.modal-content` themselves instead of through `Modal.js` (e.g. `AddFineModal.js:69-73`); restyling those classes covers both. Keep every dialog's fields, validation, handlers and open/close behaviour exactly as they are.

- [ ] Step 1: CSS.
  - `.modal-overlay`: `position: fixed; inset: 0; background: rgba(4, 6, 12, 0.55); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); display: flex; align-items: center; justify-content: center; padding: 16px;` (light theme: `rgba(14, 21, 37, 0.3)`).
  - `.modal-content`: `background: var(--surface-strong); border: 1px solid var(--line-strong); border-radius: 20px; -webkit-backdrop-filter: var(--blur); backdrop-filter: var(--blur); box-shadow: var(--glass-hi), 0 30px 80px rgba(0, 0, 0, 0.55); width: min(520px, 100%); max-height: calc(100vh - 32px); overflow-y: auto;` — keep the size modifiers (`.modal-large` etc.) as widths only (`min(720px, 100%)`, …).
  - `.modal-header`: `display: flex; align-items: flex-start; gap: 14px; padding: 24px 24px 0;` `h2`: `font: 700 22px var(--f-display); color: var(--text-1);` optional `.modal-eyebrow` (mono 12 caps `var(--cyan-text)`) and `.modal-icon` (44px tile, radius 12, `var(--primary-soft)` / `var(--primary-text)`).
  - `.modal-close` → a `.btn-icon` look without border: 36px, radius 9, transparent, `var(--text-3)`, hover `var(--raised)`.
  - Body padding `22px 24px`; labels 13px/600 `var(--text-2)`; fields use the Task 2 form base (44px, focus cyan ring); `.form-error` → `.pill`-like alert row: `background: var(--pb-red); color: var(--pf-red); border-radius: 10px; padding: 10px 12px;` with an `alert` icon.
  - `.modal-actions`: `display: flex; justify-content: flex-end; gap: 8px; padding: 16px 24px 22px; border-top: 1px solid var(--line);` Cancel `btn btn-secondary`, submit `btn btn-primary`, destructive confirm `btn btn-danger`.
  - Phone width (`max-width: 600px`): overlay aligns to the bottom, panel radius `20px 20px 0 0`, full width — a bottom sheet.
  - Delete the gradient/luxury styling in "LUXURY MODAL STYLES" that these replace; keep any rule that only lays out a specific dialog's own content.
- [ ] Step 2: `Modal.js` — keep `AnimatePresence` and the motion values; no markup change needed beyond the classes. `DialogHost.js` — its confirm/alert/prompt dialog uses the same header/actions classes; tone (`success`/`error`) shows as an icon tile (`check` green pair / `alert` red pair) instead of emoji.
- [ ] Step 3: every listed dialog file — replace the `×` close text with `<Icon name="x" size={18} />` and add `aria-label="Close"`; remove emoji from titles, section titles, labels, options and buttons (e.g. "💸 Fine Details" → "Fine details"; `AddLeaveModal.js` and `EditLeaveModal.js` hold the most). Where a heading had an emoji as its only visual, use the `.modal-icon` tile with a matching `Icon` (fine → `wallet`, leave → `calendar`, employee → `user`, word → `book`, event/holiday → `flag`, memory → `image`, withdraw → `wallet`, QR → `qr`, updates → `gift`). Paid/Unpaid choices become a two-option segmented control styled with the pill pairs (Unpaid amber, Paid green) if they are radios today; keep the same inputs and values.
- [ ] Step 4: run `npm run lint`; expected: no new errors.
- [ ] Step 5: smoke — open each dialog from its screen (Record Fine, edit fine, new fine season, Standup Fine, Record Leave, edit leave, leave season, Add Holiday, Add/Edit Event, Add Word, word season, Add Memory, Withdraw, edit attendance, Share QR, What's new, Add/Edit Employee, task create/issue/sprint, a delete confirm): each is a glass panel over a blurred dim backdrop, title + close at top, actions bottom-right, no emoji; saving still works (record and then delete a test fine); Escape/backdrop close behave as before; at 390px each opens as a bottom sheet.

## Task 7: Dashboard
**Delivers:** acceptance criteria 9, 10, 11, 13 (Dashboard), 16 (banners, champion); edge case "festival banners".
**Files:** modify `src/components/Dashboard.js`, `src/components/StatsCard.js`, `src/components/EventBanner.js`, `src/components/NewFiscalYearBanner.js`, `src/components/DashainBanner.js`, `src/app/globals.css` (sections "STATS CARDS", "CHART", "DASHBOARD EXTRAS", "CELEBRATIONS & BIRTHDAYS", "HOLIDAY NOTICES", "NEW FISCAL YEAR BANNER", "DASHAIN & TIHAR BANNER", the `.least-fined-container` / `.walking-honoree` rules near `globals.css:5287`).
**Kind:** judgement.
**Reference:** `docs/web-ui-revamp/design/Main.dc.html` — below the page heading: announcement card, KPI row (5 tiles), "Fines by employee" + right column (On-time champion, Pending standups), then Upcoming leaves / Upcoming holidays / Celebrations.

Keep every calculation in `Dashboard.js` (totals, `empData`, season selection, `celebrations`, `handleWish`, holiday grouping) untouched; only the returned markup and CSS change.

- [ ] Step 1: order. Return the sections in the canvas order: banners → stats row (move `.stats-grid` from the bottom, `Dashboard.js` stats block, to the top) → a two-column row (`flex-wrap`, chart `flex: 2 1 520px`, right column `flex: 1 1 300px`) holding "Fines by employee" and, on the right, the champion card above "Pending standups" → a three-card grid (`repeat(auto-fit, minmax(300px, 1fr))`) of Upcoming leaves, Upcoming holidays, Celebrations.
- [ ] Step 2: banners. Each of `EventBanner`, `NewFiscalYearBanner`, `DashainBanner` renders inside one shared frame `.announce-card` (`display: flex; flex-wrap: wrap; align-items: center; gap: 16px; padding: 16px 20px; border-radius: 16px; background: var(--orange-soft); border: 1px solid rgba(255,106,31,.35);` + `.glass`), with a 40px orange icon tile (`flag`, ink-coloured stroke) and the banner's own title in `var(--f-display)` 16/700. The festival scenes (Dashain skyline, lights, cheer crowd) stay inside the card but only when `animationsEnabled` (from `useApp()`) is true and `prefers-reduced-motion` is not `reduce`; otherwise the card shows its text only. Remove emoji from banner text. Show-when rules (dates, countdowns) unchanged.
- [ ] Step 3: KPI tiles. `StatsCard` keeps its props (`icon`, `label`, `value`, `sub`, `color`) but renders the canvas tile: `.glass-card.card-lift`, a mono uppercase `.eyebrow` label with an 8px square dot in `color` (with `box-shadow: 0 0 10px <color>`) at the right, the value in `var(--f-display)` 30/700 tabular numbers, `sub` 13px `var(--text-3)`. Drop the emoji `icon` from display (prop can stay unused; Dashboard stops passing emoji). Remove the 3D tilt and spotlight (`StatsCard.js` pointer handlers and `stats-card-glow`); the hover lift comes from `.card-lift`. Colours Dashboard passes: Late fines `#3D63F0`, Unpaid `#F5A524`, Collected & withdrawn `#22C55E`, Standup records `#F43F5E`, Employees `#2DD4EF`. Labels: "Late fines", "Unpaid", "Collected", "Standups", "Team".
- [ ] Step 4: chart card. `section-title` "Fines by employee" plus a 13px subtitle "Paid and unpaid late fines this season"; the season `<select>` gets a visible "Season" label; bars per Task 2 (`.bar-track` etc.), names 14px, totals mono. Legend squares 10px radius 3.
- [ ] Step 5: champion. Replace `LeastFinedHonoree` (the walking SVG figure, `Dashboard.js`) with an "On-time champion" glass card in the right column: 48px avatar (`avatarColor`/`initials` from `@/lib/avatar`) ringed `0 0 0 3px var(--surface-solid), 0 0 0 5px var(--cyan), 0 0 22px rgba(45,212,239,.45)`, mono cyan eyebrow "On-time champion", name in `var(--f-display)` 17/700, line "Always on time, low on fine." Same selection rule as today (`leastFined`, and only when their total is the lowest). Hidden when there are no fines this season.
- [ ] Step 6: lists. Pending standups: header with a red count pill; rows with `.avatar` (32px), name 14/600, "Missed standup · <date>" 13px, amber "Pending" pill. Upcoming leaves: avatar, name, date range, cyan type pill. Upcoming holidays: 46px date block (mono 11px month in `var(--cyan-text)` over `var(--f-display)` 18px day, `var(--raised)` fill), title, range line; "Today"/"Tomorrow" as cyan pills. Celebrations: today's entry in an orange-soft row with an orange icon tile (`cake` or `award`) and `btn btn-orange btn-sm` "Send Wish" (same `handleWish`); other entries plain rows with a `var(--raised)` icon tile and a mono date. Replace every emoji (🕒 🏖️ 🌴 🚩 ✨ 🎂 🏆, emoji in `alertDialog` messages) with icons or plain text.
- [ ] Step 7: CSS — write a "DASHBOARD" section for the new classes; delete the replaced rules in "DASHBOARD EXTRAS", "CELEBRATIONS & BIRTHDAYS", the honoree rules, and the banner rules that only styled the old banner boxes (keep the scene keyframes the cards still use).
- [ ] Step 8: smoke — Dashboard in dark and light against `Main.dc.html`: order and grouping match; KPI tiles lift slightly on hover (not with Animations off); season select changes the chart; Send Wish still sends (on a day with a birthday, or check the button renders and the handler is wired); champion shows the least-fined person; no emoji; at 390px everything stacks in one column with no sideways scroll.

## Task 8: Late Fines
**Delivers:** acceptance criteria 9, 10, 11, 13 (Late Fines), 17, 19 (fines, seasons, withdrawals); edge case "many seasons".
**Files:** modify `src/components/FineTable.js`, `src/components/WithdrawalLog.js`, `src/app/globals.css` (sections "FINE SECTION", "FINE SEASONS", "WITHDRAWAL LOG", the `.word-sidebar` rules FineTable borrows from "WORD OF THE DAY PAGE" — copy them into a fines-owned class rather than editing the shared one, Task 16 restyles Words).
**Kind:** judgement.
**Reference:** `docs/web-ui-revamp/design/LateFines.dc.html` — season rail (left, `flex: 0 1 260px`) + content (`flex: 999 1 560px`): summary tiles (Total, Paid, Unpaid, Withdrawn, Remaining), "Fines by employee" chart, records card (search, All/Unpaid/Paid segmented filter, employee picker, table, pagination), withdrawal log with a "left in the jar" meter. The page heading's actions (Withdraw, Record Fine) come from Task 5.

Keep: season selection and the pinned "Pre Fiscal Year Fines" bucket, admin "+ New Season" / edit season, filtering, search, the paid toggle on the status badge, edit/delete per row, `onWithdraw`, and every `canManageFines` gate. The canvas's arrival-time column is out of scope (intent) — do not add it.

- [ ] Step 1: season rail → a glass card titled "Fine seasons" (no 💰), rows as 44px buttons (active row `var(--primary-soft)` fill, `var(--text-1)`, a "Current" cyan pill on the latest season), pinned bucket labelled "Pre Fiscal Year Fines" with a `folder` icon, mono all-seasons total at the foot; admin "New season" as a `btn btn-secondary btn-sm` with `plus`, edit as a `.btn-icon.btn-sm` with `edit` and an `aria-label`. At phone width the rail becomes a horizontal chip row (`overflow-x: auto`).
- [ ] Step 2: summary tiles use the Task 7 tile style (`.glass-card`, mono eyebrow, display number) in a `repeat(auto-fit, minmax(160px, 1fr))` grid; the per-season chart reuses the Dashboard chart classes.
- [ ] Step 3: records card — toolbar: search `<label>` with `search` icon (placeholder unchanged "Search by name, date, amount..."); `.status-tabs` becomes a segmented control (4px padding `var(--raised)` track, active segment `var(--primary)` white text, 34px). Table per Task 2 `.data-table`: employee cell with `.avatar` + name, mono date (add the BS date under it with `formatBs`, 12px `var(--text-3)`), mono amount, `.status-badge` paid/unpaid (still the toggle), actions as `.btn-icon.btn-sm` `edit` / `trash` with `aria-label`s. Wrap in `overflow-x: auto`.
- [ ] Step 4: withdrawal log — glass card "Withdrawals", a meter (`var(--raised)` track, `var(--primary)` fill) for "left in the jar" with mono figures, rows: mono amount, reason, "by" with avatar, mono date. Remove emoji.
- [ ] Step 5: CSS — replace the listed sections; delete rules no longer referenced.
- [ ] Step 6: smoke — Late Fines vs `LateFines.dc.html` in both themes: switch seasons (including Pre Fiscal Year Fines), search, filter Unpaid/Paid, toggle a fine paid and back, edit and delete a test fine, open Withdraw and record then delete a test withdrawal; as a non-fine-admin the season/edit controls are absent as today; at 390px the rail is a chip row and the table scrolls inside its card.

## Task 9: Standup Fines, the standup form and its floating button
**Delivers:** acceptance criteria 9, 10, 11, 13 (Standup Fines), 19.
**Files:** modify `src/components/StandupFineTable.js`, `src/components/StandupFormPage.js`, `src/components/StandupFloatingButton.js`, `src/app/globals.css` (Standup fine table rules in "FINE SECTION", "DAILY STANDUP FORM", "DAILY STANDUP — FLOATING BUTTON").
**Kind:** judgement.
**Reference:** `docs/web-ui-revamp/design/StandupFines.dc.html` — four summary tiles, "Missing standup records" table card (search "Search by name or date...", All/Pending/Completed segmented filter, employee picker, settled toggle, edit/delete, pagination), a "Submit today's standup" card (Nepal-time clock, window banner, question boxes, submit), and the orange "Thanks for the party" card for the party-popper message.

Keep the app's wording ("Pending contribution", "Contribution complete"), the standup window logic (`src/lib/standupWindow.js`), question loading, submit/edit behaviour, and the floating button's show-when rule.

- [ ] Step 1: table + filters + tiles as in Task 8 Step 2–3 (same classes). Status pills: pending → amber, complete → green.
- [ ] Step 2: `StandupFormPage` — glass card; mono clock; window banner as a cyan-tint row when open, amber when closed; textareas use the Task 2 form base (`textarea` 96px min); review list rows; submit `btn btn-primary`. Its in-page title gives way to the Task 5 page heading (title "Today's standup").
- [ ] Step 3: `StandupFloatingButton` — a fixed bottom-right `btn btn-primary` pill (`border-radius: 9999px; height: 48px; box-shadow: 0 10px 30px rgba(61,99,240,.45)`) with `<Icon name="clipboard" />` and the same label logic; not over the sidebar; at phone width it sits above the bottom edge with 16px margins. Remove 🗣️.
- [ ] Step 4: the party-popper element becomes an orange-soft card with a `sparkles` icon; no emoji.
- [ ] Step 5: smoke — filter, search, settle/unsettle and edit a record; open the form inside the window (or temporarily in dev via the existing window helper) and see the clock, questions and submit; the floating button appears only inside the window and opens the form.

## Task 10: Leaves
**Delivers:** acceptance criteria 9, 10, 11, 13 (Leaves), 19.
**Files:** modify `src/components/LeavePage.js`, `src/components/LeaveCalendar.js`, `src/app/globals.css` (sections "LEAVE PAGE", "CALENDAR", "LEAVE RECORDS", "LEAVE SEASONS", "PUBLIC HOLIDAYS SECTION", "LEAVE JARS").
**Kind:** judgement.
**Reference:** `docs/web-ui-revamp/design/Leaves.dc.html` — season chip bar (active chip `var(--primary-soft)` + `var(--primary)` border; "+ New Season" and edit for admins), the month calendar card (7-column grid, BS day under each AD day, leave bars per person — full day solid, half day dashed, early leave outlined — holidays tinted orange-soft, today ringed cyan, English/नेपाली toggle, employee filter, monthly stats), beside it Upcoming leaves and Public holidays, then the per-employee summary cards with used-of-quota meters. Header actions (Add Holiday, Record Leave) via Task 5.

Keep: season logic (`computeLeaveBalances` with `seasonId`), the Pre Fiscal Year Leaves bucket, the calendar's AD/BS switch and month navigation, leave type data from the DB, edit/delete rules (`canManageLeave`), holiday add/delete.

- [ ] Step 1: chip bar, calendar and lists per the reference; BS numbers from the existing calendar code (`formatBs` / `adToBs`) — never hard-coded. Day cells: 12px mono BS numbers are allowed to be 11px only inside cells narrower than 48px.
- [ ] Step 2: leave type badges → pills: cyan for leave types by default; the category colours the calendar already uses map to the pill set (no ad-hoc colours).
- [ ] Step 3: employee summary → one glass card per person (avatar, name, a meter per leave type: `var(--raised)` track, fill `var(--primary)`, turning `var(--unpaid)` at ≥ 80 % used and `#F43F5E` when over quota, mono "used / quota").
- [ ] Step 4: remove the 11 emoji (🏖️ 🌴 🗂️ …) for icons or nothing.
- [ ] Step 5: smoke — switch seasons, move months, toggle नेपाली, filter by employee, record/edit/delete a test leave, add and delete a test holiday; compare with `Leaves.dc.html`; at 390px the calendar fits with horizontal scroll only inside its card.

## Task 11: Attendance
**Delivers:** acceptance criteria 9, 10, 11, 13 (Attendance), 17, 19.
**Files:** modify `src/components/AttendancePage.js`, `src/components/AttendancePunchWidget.js`, `src/app/globals.css` (section "ATTENDANCE" and the attendance rules elsewhere).
**Kind:** judgement.
**Reference:** `docs/web-ui-revamp/design/Attendance.dc.html` — punch card (mono live clock, BS date, geofence status pill "Inside office radius · N m", check-in/out timeline, Check In / Check Out), monthly sheet (employee picker, English/नेपाली toggle, month input, stat tiles, table Date+BS / Check In / Check Out / Hours / Status), "Office employees (geofenced web punch)" and "Freelance / WFH" checkbox cards, admin office-settings card (latitude, longitude, radius, late fine amount, reminder times, Save).

Keep the geolocation flow, punch rules, admin edit (`EditAttendanceModal`), the office/WFH flags (`setEmployeeFlag` calls), office settings save. The Hours column shows only if the page computes it today; otherwise leave it out (intent: no new data).

- [ ] Step 1: punch card per reference; geofence states map to pills (inside → green, outside → red, checking → gray); Check Out is the primary button once checked in; done state text unchanged.
- [ ] Step 2: sheet, member-picker cards (checkbox chips: selected `var(--primary-soft)` + `var(--primary)` border + `check` icon) and settings card per reference; inputs use the form base.
- [ ] Step 3: replace the 12 emoji (📍 🏢 🏠 …) with `pin`, `building`, `home` icons.
- [ ] Step 4: smoke — check in/out on a test account (or confirm the buttons and geofence pill states render), switch employee and month, toggle नेपाली, toggle an office/WFH flag and back, save office settings unchanged.

## Task 12: Tasks (Kanban work in progress)
**Delivers:** acceptance criteria 9, 10, 11, 13 (Tasks), 19.
**Files:** modify `src/components/TasksPage.js`, `TaskBoardView.js`, `TaskBacklogView.js`, `TaskBits.js`, `TaskIssueModal.js`, `TaskCreateModal.js`, `TaskSprintModals.js`, `TaskReportsView.js`, `src/app/globals.css` (section "TASKS (JIRA-STYLE ISSUES)" and its sub-sections "shared issue bits", "board", "backlog", "issue view", "create & sprint dialogs", "reports").
**Kind:** judgement.
**Reference:** `docs/web-ui-revamp/design/Tasks.dc.html` — toolbar (search "Search title, label or issue key…", project select, assignee avatar stack filter, "Show all done"), five status columns as `.glass` cards 284px wide in an `overflow-x: auto` row, each with an 8px status square, display-font title, mono count and an add `.btn-icon.btn-sm`; issue cards on `var(--raised)` with mono cyan key, priority pill, title 14/600, mono `#label` chips (`.pill-gray` box, radius 6), mono points box, due date (red when overdue), comment count, 24px assignee avatar; hover lift.

This is the uncommitted Kanban work: restyle only. The board has grown since the canvas (backlog, sprints, reports, issue view); give those views the same primitives (glass cards, `.data-table` for backlog/report tables, pills, avatars, `.btn*`) rather than inventing new looks. Do not touch `src/lib/taskBoard.js`, `src/lib/useTasks.js`, their tests, or any data call. Keep drag-and-drop, sort order, filters, the `#issue=` deep link, keyboard handlers.

- [ ] Step 1: status colours: Backlog `var(--text-3)`, To Do `var(--primary)`, In Progress `var(--unpaid)`, In Review `#A78BFA`, Done `#22C55E`; priorities: Urgent red pill, High amber, Medium blue, Low gray. Define these once as classes in the Tasks CSS section (`.task-status-dot--<status>`, `.task-priority--<priority>`), keyed by the values in `src/lib/taskBoard.js` (`TASK_STATUSES`, `TASK_PRIORITIES`).
- [ ] Step 2: remove chrome emoji (the `TASK_STATUSES` icons stay in the lib as data but are not rendered; `🔑` in the empty state → `key` icon).
- [ ] Step 3: issue view and dialogs use the Task 6 dialog shell; comments list uses avatars and mono timestamps.
- [ ] Step 4: run `npm test` (the Kanban unit tests must still pass); smoke — create an issue, drag it across columns, open it, comment, change priority, filter by assignee and project, open backlog and reports views, follow an `#issue=` link.

## Task 13: Planning Poker
**Delivers:** acceptance criteria 9, 10, 11, 13 (Planning Poker), 19.
**Files:** modify `src/components/PlanningPokerPage.js`, `src/app/planning-poker/[sessionId]/page.js`, `src/app/globals.css` (section "PLANNING POKER", including `.poker-standalone-shell`).
**Kind:** judgement.
**Reference:** `docs/web-ui-revamp/design/Poker.dc.html` — share strip (mono session link, Copy, QR), story card, seats around a table with face-down / face-up cards, "x / n voted" progress, primary reveal button, the deck (Fibonacci plus "?"; selected card raised with a cyan ring and glow), results panel (average, votes-per-card bars, each person's vote).

Keep the app's wording ("Publish Results" stays; open question 2), polling, session create/join, voting and reveal rules. The canvas's story key, story queue, consensus and spread figures are out of scope — do not add them.

- [ ] Step 1: the tab (create/join + session lists) — glass cards, inputs per form base, session rows with mono IDs and status pills.
- [ ] Step 2: the session page — standalone shell `.poker-standalone-shell` uses the ink + dot grid + `AmbientAurora` look (it is outside the app shell: render a slim glass top bar with the logo, "Planning poker", session ID in mono and a "Back to Tracker" link to `/`, keeping the current link text); cards: 76×104, radius 12, `var(--f-display)` 28px face, unselected `var(--raised)` + `var(--line-strong)` border, selected `translateY(-8px)`, `border-color: var(--cyan)`, `box-shadow: var(--glow), var(--shadow-lift)`; reveal animation stays, gated by Animations / reduced motion.
- [ ] Step 3: replace the 29 emoji across both files (🃏 and friends) with icons or nothing.
- [ ] Step 4: smoke — create a session, join it from a second browser profile, vote, reveal, reset; copy link and QR work.

## Task 14: Retrospective
**Delivers:** acceptance criteria 9, 10, 11, 13 (Retrospective), 19.
**Files:** modify `src/components/RetrospectivePage.js`, `RetroTimer.js`, `RetroKudos.js`, `RetroActionItems.js`, `RetroThemeTools.js`, `src/app/retrospective/[sessionId]/page.js`, `src/app/globals.css` (section "RETROSPECTIVE" and the board-flavour scenes `SailboatScene`/`SpaceScene` rules only where they set colours).
**Kind:** judgement.
**Reference:** `docs/web-ui-revamp/design/Retro.dc.html` — header/session strip (share link, Copy, QR, mono ID, facilitator timer with start/pause, length select, mute), the AI theme bar, three columns colour-coded through pill tokens (Standard: What Went Well? green, Needs Improvement amber, Focus More On blue; Sailboat and Start-Stop-Continue map their columns onto the same pill colours), cards (text, author, thumbs-up vote with count, reactions, select checkbox), themed clusters with a renamable title, kudos strip with an orange composer, the vote-tier list, action items.

Keep every behaviour: board flavours, polling, voting, reactions, AI grouping (`src/lib/retroThemes.js`, `retroEmbeddings.js`), theme rename/ungroup, timer, kudos, action items, end session, QR/share. Keep the app's wording ("Group similar cards"; open question 2). Reaction emoji and anything users type stay (criterion 9); chrome emoji go (column headers, buttons, section titles, tier labels like "🔴 High Priority" → a red pill "High priority").

- [ ] Step 1: tab screen (create/join/active/completed boards) — glass cards, project chips as pills, session rows.
- [ ] Step 2: board — columns as `.glass` cards in an `overflow-x: auto` row on narrow screens; cards on `var(--raised)`; vote button `.btn-icon.btn-sm` with `thumbs-up` and a mono count (pressed state `var(--primary-soft)`); theme clusters as a `var(--line-strong)`-bordered group with a `sparkles` eyebrow.
- [ ] Step 3: session page `src/app/retrospective/[sessionId]/page.js` uses the same standalone shell as Task 13 Step 2.
- [ ] Step 4: run `npm test` (retro rule/theme tests must still pass); smoke — create a Standard board, add cards in each column, vote, react, group into themes, rename and ungroup a theme, run the timer, add kudos and an action item, end the session; open a Sailboat board to confirm its columns render with the pill colours.

## Task 15: Daily Sync meeting page
**Delivers:** acceptance criteria 9, 10, 11, 13 (Meeting), 19; edge case "the meeting page on a large TV".
**Files:** modify `src/components/MeetingPage.js`, `src/components/MeetingShoutouts.js`, `src/app/globals.css` (section "MEETING MODE" and the "Daily Standup / Submissions" light overrides after "LIGHT THEME OVERRIDES").
**Kind:** judgement.
**Reference:** `docs/web-ui-revamp/design/Meeting.dc.html` — no sidebar; slim glass top bar (logo, "Daily Sync" + live pill, mono clock, date with BS date, elapsed time, back link to `/`, Meeting Link, orange End Meeting); summary figures; standup submissions panel (search, date navigator, project filter pills, Enlarge, submission cards with answers and Jira status chips); right column (Missing submissions with per-person add-fine, On leave today, Word of the day); shoutouts & celebrations with Send Wish; quick add leave.

Keep every behaviour in `MeetingPage.js` (1.5k lines): project filter matching (email then first name), the enlarged view, missing-submission detection, quick-add leave/fine modals, word setting, shoutouts, the archery/festival banners it imports. Keep the app's link text ("Back to Tracker") unless open question 2 says otherwise.

- [ ] Step 1: top bar and layout per reference; type one step larger than the app (body 15px, figures 34px) so it reads on a TV; the enlarged submissions view keeps working and uses `var(--surface-strong)`.
- [ ] Step 2: project filter pills: inactive `var(--raised)` + `var(--line)`, active `var(--primary-soft)` + `var(--primary)` border; submission cards on `var(--raised)`.
- [ ] Step 3: replace the 48 emoji across both files (keep emoji inside user-written answers and shoutouts).
- [ ] Step 4: delete the light-theme `!important` overrides for submissions that the tokens now cover.
- [ ] Step 5: smoke — open `/meeting` in both themes and on a 1920px window: clock ticks, date navigator moves days, project pills filter, Enlarge works, add a fine from Missing submissions and delete it, quick-add a leave and delete it, Back to Tracker returns to `/`.

## Task 16: Words and Events
**Delivers:** acceptance criteria 9, 10, 11, 13 (Words, Events), 19.
**Files:** modify `src/components/WordPage.js`, `src/components/EventsPage.js`, `src/components/EventBanner.js` (only if Task 7 left banner copy to align), `src/app/globals.css` (sections "WORD OF THE DAY PAGE", "HOLIDAY NOTICES", "PUBLIC HOLIDAYS SECTION" rules used by Events).
**Kind:** judgement.
**References:** `docs/web-ui-revamp/design/Words.dc.html` (season list with active row and edit, "Top sharers", hero "Word of the day" card — word in `var(--f-display)` 40px, phonetic mono, definition, example, translation — search + sort, word grid cards with shared-by avatar and mono date); `docs/web-ui-revamp/design/Events.dc.html` (Upcoming/Past/All segmented tabs, event rows with date block + countdown pill, public holidays grouped with a chip per day).

Out of scope (intent): separate phonetic/word-type fields, language-tagged translations, event description/location — render what the data has (the type+phonetic field as one mono line; translation as stored; events with date and title only). Keep seasons, add/edit/delete, and who-can-add rules as they are.

- [ ] Step 1: Words per reference; remove the 7 emoji.
- [ ] Step 2: Events per reference; Upcoming/Past/All only if the page filters that way today — otherwise keep today's grouping and style it; remove the 3 emoji.
- [ ] Step 3: smoke — switch word seasons, add/edit/delete a test word, add/edit/delete a test event and holiday; compare both screens with their artboards.

## Task 17: Employees and Projects
**Delivers:** acceptance criteria 9, 10, 11, 13 (Employees, Projects), 17, 19.
**Files:** modify `src/components/EmployeeList.js`, `src/components/EmployeeDetailModal.js`, `src/components/ProjectsPage.js`, `src/app/globals.css` (sections "EMPLOYEE SECTION", "EMPLOYEE DETAIL MODAL", "LEAVE JARS", "PROJECTS", "PROJECT FORM").
**Kind:** judgement.
**References:** `docs/web-ui-revamp/design/Employees.dc.html` (search + status filter, table with avatar / name / email / joined / status pill / fines / leave left / edit-delete, detail panel), `docs/web-ui-revamp/design/Projects.dc.html` (status filter chips, project card grid, expanded project with environments, links, member checkbox chips).

The employee detail keeps opening as today (`EmployeeDetailModal`, now a glass dialog from Task 6) — do not convert it into a side panel. Out of scope: the Employees sort control. Leave jars become meters (as Task 10 Step 3). Projects keeps its CRUD, links/environments row editors and `syncProjectMembers` member chips.

- [ ] Step 1: Employees table per reference using `.data-table`, `.avatar`, pills (active green, on leave cyan, resigned gray).
- [ ] Step 2: Projects cards and form per reference; status pills for the app's statuses (Planning blue, Active green, On hold amber, Completed violet, Archived gray); tech stack chips mono `.pill-gray`; environment URLs mono; remove the 12 emoji (🚀 …).
- [ ] Step 3: smoke — search/filter employees, open a detail, add/edit/delete a test employee (admin); create/edit/delete a test project with a link, an environment and two members.

## Task 18: Settings — one screen
**Delivers:** acceptance criteria 14, 18; 4 (admin only).
**Files:** create `src/components/SettingsPage.js`; modify `src/components/PrivilegeSettingsPage.js`, `src/components/LeaveSettingsPage.js`, `src/components/ThemeToggle.js`, `src/components/AnimationToggle.js`, `src/app/page.js`, `src/app/globals.css` (sections "SETTINGS PANEL (profile dropdown)", "THEME TOGGLE SWITCH", the privilege/leave settings rules).
**Kind:** judgement.
**Reference:** `docs/web-ui-revamp/design/Settings.dc.html` — in-page section nav (Roles, List visibility, Leave types, Preferences as anchor links), Roles panels (Admins, Fine admins) and List visibility panels (Standup list, Leaves, Late fines, Standup fines) as person chips (selected: `var(--primary-soft)` + `var(--primary)` border + check), the leave type table with "Add Leave Type", and Your preferences (Theme Dark/Light segmented; Animations switch).

Interface: `SettingsPage` renders, in order, `<section id="roles">` and `<section id="lists">` from `PrivilegeSettingsPage` (export its two panel groups or render it whole — keep `setEmployeeFlag`, the self-lock on your own admin flag, and the pending state), `<section id="leave-types">` from `LeaveSettingsPage` (form and table logic unchanged), and `<section id="prefs">`. Theme offers Dark and Light only (the app stores `heubert-theme` as `dark`/`light`; the canvas's "System" option is not built). `ThemeToggle` and `AnimationToggle` keep their `useApp()` calls; restyle them as a two-option segmented control and a `role="switch"` checkbox row so both Settings and the top-bar account menu use them.

- [ ] Step 1: build `SettingsPage`; in `page.js` the `settings` tab renders `<SettingsPage />` (replacing Task 5's stacked interim).
- [ ] Step 2: remove the 5 emoji in `PrivilegeSettingsPage` titles (`ROLE_TOGGLES` / `EXCLUSION_LISTS` titles become plain text; give Roles panels a `lock`/`wallet` icon tile).
- [ ] Step 3: smoke — as admin: toggle a person on a list and back; try to remove your own admin flag (still refused); add/edit a leave type and revert; switch theme here and see the top bar follow; toggle Animations off and see the aurora stop following the cursor. As non-admin: no Settings row, and the account menu still offers theme and animations.

## Task 19: Memories, Login and What's new
**Delivers:** acceptance criteria 9, 10, 13 (Memories, Login), 19.
**Files:** modify `src/components/MemoriesPage.js`, `src/app/login/page.js`, `src/components/ReleaseUpdatesModal.js` (content; its frame is Task 6), `src/app/globals.css` (sections "MEMORIES PAGE", "CLASSIC HANGING GRID (REFINED)", "MEMORY LIGHTBOX", "CHANGELOG RELEASE UPDATES", the login rules).
**Kind:** judgement.
**References:** `docs/web-ui-revamp/design/Memories.dc.html` (slim glass top bar with logo, title, back and add actions; type filter chips; masonry of memory cards with caption, author avatar, mono date); `docs/web-ui-revamp/design/Login.dc.html` (centred glass card over the aurora: 56px logo, "Internal portal" pill, title, purpose line, "Continue with Google" on `var(--surface-solid)` with a `key` icon, mono "Use your @heubert.com account", the feature rows and restricted-access footer the page already has; the unauthorized alert as a red alert row).

Keep: Google sign-in and One Tap flows exactly (`login/page.js`, `GoogleOneTap.js`), the unauthorized handling, memory upload/lightbox/delete, and the app's wording ("Back to Tracker", "Share a Memory"; open question 2). The Memories year/event filter is out of scope; keep the filters it has.

- [ ] Step 1: Memories per reference; the lightbox uses the dialog scrim; remove the 10 emoji (`🔙`, `➕` → `arrow-left`, `plus`).
- [ ] Step 2: Login per reference; remove its 3 emoji.
- [ ] Step 3: What's new — release entries as a list of glass rows with mono version/date and pill tags.
- [ ] Step 4: smoke — sign out and sign in again with Google (and see One Tap still offers itself); try an unauthorized account if one is available, or confirm the alert renders; open Memories, open a photo, add and delete a test memory; open What's new.

## Task 20: Light theme, phone width, motion and emoji sweep
**Delivers:** acceptance criteria 6, 9, 14, 15, 16, 20; edge cases "`<select>` option lists", "long names".
**Files:** modify `src/app/globals.css` (whole file), `src/components/HumanLoader.js` (splash colours only), any screen file the sweep finds.
**Kind:** judgement.

- [ ] Step 1: emoji sweep — run `grep -nP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}]' src/components/*.js src/app/*.js src/app/*/*.js src/app/*/*/*.js`. Every hit in navigation, a heading, a button, a badge, a label, a tooltip or a dialog message is replaced (icon or plain text). Allowed to stay: emoji inside user content, the retro reaction set and anything people pick as data, and data constants that are not rendered (`TASK_STATUSES[].icon`). `CapacityPage.js` has no entry point (its tab button is commented out in `page.js`) and is left as it is.
- [ ] Step 2: light theme — walk every screen with the theme set to light; fix any rule that still hard-codes a dark colour (search `globals.css` for `rgba(255, 255, 255,` backgrounds and `#0b0e14`/`#111827`-era hex values outside the token blocks) by switching it to a token. Delete the remaining "LIGHT THEME OVERRIDES" component rules that only restated old colours. Confirm the global `select option, select optgroup` rule still sets `background-color: var(--bg-secondary); color: var(--text-primary);` (aliases from Task 1) and no per-class option rule was added.
- [ ] Step 3: phone width — at 390px and 768px wide, every screen: no horizontal page scroll (`document.documentElement.scrollWidth === innerWidth` in devtools), tables and the Kanban/retro column rows scroll inside their cards, dialogs are bottom sheets, the sidebar is a drawer.
- [ ] Step 4: motion — the Animations switch already drives `motion/react` through `MotionProvider.js:28` (`reducedMotion` "user"/"always"). CSS-only motion (`.card-lift` hover, banner scene keyframes, the splash) needs its own gate: `page.js` adds the class `motion-off` to `.app-shell` when `animationsEnabled` is false, and `globals.css` gets `.motion-off .card-lift:hover { transform: none; }`, `.motion-off [class*="dashain-"], .motion-off [class*="cheer-"] { animation: none !important; }` (extend the selector list to any keyframed scene class still in use), and the same three rules again inside `@media (prefers-reduced-motion: reduce) { … }` without the `.motion-off` prefix. Verify with the switch off, then with the OS reduced-motion setting on.
- [ ] Step 5: splash — `HumanLoader.js` keeps its sequence but uses the new palette (ink background, blue/cyan accents) and no emoji.
- [ ] Step 6: dead CSS — delete rules whose classes no longer appear in `src/` (check each candidate with `grep -rn "<class>" src --include=*.js`). Do not touch the Tasks section beyond Task 12's changes.
- [ ] Step 7: run `npm test` and `npm run lint` and `npm run build`; expected: all pass (the build proves the `next/font` imports and every changed page compile).
- [ ] Step 8: final smoke — the full screen list from criterion 13 in both themes against the artboards, plus one action per screen from criterion 19.

## Criteria coverage
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| 1 Sidebar lists the sections in four groups | 4, 5 | `navigation.test.mjs` "sidebar groups read Overview, Records, Team, Admin in that order"; Task 5 smoke |
| 2 Current section marked, only one | 5 | Not automatable: visual state of the rendered sidebar (Task 5 smoke) |
| 3 Click opens section; choice survives reload | 4, 5 | `navigation.test.mjs` "saved tabs survive the reload…"; Task 5 smoke |
| 4 Non-admin: no Projects/Settings, Employees shown | 4, 5 | `navigation.test.mjs` "a non-admin keeps Employees…" and "an admin-only tab falls back…" |
| 5 Top bar contents; emoji tab row gone | 5 | Not automatable: rendered page (Task 5 smoke) |
| 6 Phone width: no side-by-side sidebar, no sideways scroll | 5, 20 | Not automatable: layout at a viewport width (Task 5 and Task 20 Step 3 smoke) |
| 7 Ink + aurora + glass panels | 1, 2 | Not automatable: rendered look (Task 2 smoke) |
| 8 Three typefaces where specified | 1 | Not automatable: computed font in the browser (Task 1 smoke) |
| 9 No emoji in chrome; user emoji kept | 3, 6–20 | Task 20 Step 1 grep plus per-screen smoke |
| 10 Primary blue / glass secondary / orange only for people | 1, 2 | `contrast.test.mjs` "button labels meet 4.5:1"; usage checked in each screen smoke |
| 11 Status pills from the canvas set | 1, 2 | `contrast.test.mjs` "every status pill meets 4.5:1"; usage in each screen smoke |
| 12 Every modal is a glass dialog | 6 | Not automatable: rendered dialogs (Task 6 smoke) |
| 13 Each screen matches its artboard | 7–19 | Not automatable: side-by-side visual comparison (each task's smoke) |
| 14 Light theme everywhere, persists | 1, 18, 20 | `contrast.test.mjs` light block parsed and checked; Task 18 and Task 20 Step 2 smoke |
| 15 4.5:1 contrast (3:1 large) | 1 | `contrast.test.mjs` text, pill and button tests in both themes |
| 16 No decorative motion with Animations off / reduced motion | 2, 7, 20 | Not automatable: animation in the browser (Task 20 Step 4 smoke) |
| 17 Admin actions in shared styles | 5, 8, 11, 17 | Not automatable: rendered controls (those tasks' smoke) |
| 18 One Settings screen | 18 | Not automatable: rendered page (Task 18 smoke); routing of old tabs to it by `navigation.test.mjs` "saved tabs survive…" |
| 19 Every action still works | 5–19 | Each task's smoke actions; the Kanban and retro unit suites still pass (`npm test`) |
| 20 `npm test` passes | 20 | `npm test` in Task 20 Step 7 |
