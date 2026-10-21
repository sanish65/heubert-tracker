# Mobile UI revamp — Code Review

**Request changes.** 3 CRITICAL · 1 HIGH · 4 MEDIUM · 7 LOW

| | |
| --- | --- |
| Blocking | CRITICAL `LeaveCalendar.js:241`: light-theme holiday numbers at 2.54:1 (AC10) |
| | CRITICAL `LeaveCalendar.js:239`: holidays drawn orange (AC3) |
| | CRITICAL `EventBanner.js:20`: event, holiday and fiscal-year banners drawn orange (AC3) |
| | HIGH `(tabs)/index.js:24`: token colours hardcoded as hex (also `fines.js:26`) |
| Branch | `kanban-tracker`, uncommitted working tree over HEAD `0bec9f6` (merge-base with main `abfbc45`) · 75 files, +11263 −2726 · 2026-10-21 |
| Reviewed against | security · performance · security-web (applied to the React Native forms: Linking, Image, WebView) · CLAUDE.md + AGENTS.md · plan.md Constraints (the mobile conventions) |
| Scans | secrets N/A (gitleaks not installed) · dependencies 0 new, 38 pre-existing · code N/A (semgrep not installed) |
| Not applicable | security-llm.md (no model code) · project standards skills (none exist) · `.claude/skills/run.md` (not a standards skill) |
| Failed to load | none |
| Read outside the diff | 9, listed below |

## By area
| Area | Level | Worst finding | What lifts it to A |
| --- | --- | --- | --- |
| Security (`security.md`, `security-web.md`) | B | MEDIUM · `mobile/app.config.js:27` · bypass flag | Tie the flag to the build profile |
| Performance | A | LOW · `EmployeeDetailModal.js:376` · unbounded list | optional |
| CLAUDE.md / plan Constraints | C | HIGH · `(tabs)/index.js:24` · hardcoded tokens | Read colours from useThemeColors |
| Quality | B | MEDIUM · `meeting.js:88` · duplicated helpers | Share the date helpers and hooks |
| Criteria | C | CRITICAL · `LeaveCalendar.js:241` · AC10 contrast | Fix the holiday text, settle AC3 |

## Acceptance criteria
| # | Criterion | Covered by | Status |
| --- | --- | --- | --- |
| 1 | Ink, aurora and glass on every screen | manual (smoke 1) | not automatable |
| 2 | Space Grotesk / Plex / JetBrains fonts | `src/lib/mobileTokens.test.mjs:60` | covered (font names only) |
| 3 | Primary blue; orange only for people moments | — | contradicted |
| 4 | Canvas pill set | `src/lib/mobileTokens.test.mjs:33` | covered (tokens) |
| 5 | Glass bottom sheets | manual (smoke 5–15) | not automatable |
| 6 | Each artboard matched | manual | not automatable |
| 7 | Tab bar, line icons, no emoji | manual (smoke 1) | not automatable |
| 8 | No emoji in chrome | emoji grep, re-run in this review | covered (by inspection) |
| 9 | Light theme | `src/lib/mobileTokens.test.mjs:33` | covered (tokens) |
| 10 | 4.5:1 contrast | `src/lib/mobileTokens.test.mjs:51`, `:87`; `src/lib/contrast.test.mjs` | contradicted |
| 11 | Motion off with either setting | `src/lib/mobileMotion.test.mjs:9` | covered (the rule; wiring manual) |
| 12 | Google photos, initials fallback | `src/lib/mobileAvatar.test.mjs:128`, `:132`; `src/lib/avatar.test.mjs` | covered (the rules; fetch manual) |
| 13 | Every action works as before | manual | not automatable |
| 14 | Fingerprint unchanged | manual command | not automatable (not re-run here) |
| 15 | No native module added | lockfile diff | covered (by inspection) |

Every manual row rests on a smoke pass in which the developer did not say which steps he ran. AC3 and AC10 fail in the code itself, whatever a phone shows (findings below).

## Read outside the diff
- `mobile/context/AppContext.js:377`, `:870`, `:1119`: `removeEmployee`, `deleteCompanyEvent` and `deleteProject` return `{ error }` (or nothing, which is guarded), so the new destructuring callers do not crash.
- `src/app/api/avatars/route.js:32-69`: reads the `Bearer` token, answers 401 and 403 and caches with `Vary: Authorization`. The folder is untracked: it is web work in the same tree, not yet deployed.
- `mobile/eas.json`: build profiles set no environment. `HT_DEV_CLIENT_RUNTIME` appears only in `app.config.js` and `smoke.md`.
- `mobile/node_modules/@expo/fingerprint/build/sourcer/Expo.js:80-115`, `:185-195`: hashes the evaluated config, not the file text, so the edit leaves the fingerprint alone while the variable is unset.
- `mobile/package-lock.json` vs HEAD: the only additions are the three `@expo-google-fonts/*` packages. `expo-font` 57.0.0 was already installed through `expo`, and no other versions changed.
- `mobile/node_modules/react-native/index.js:217`: RN 0.86 still exports `Clipboard`, through a deprecation getter.
- `supabase/migrations/20260101000000_baseline.sql:1064-1079`: attendance, fines and leaves cascade on employee delete, so the Employee screen's delete note is true.
- `docs/mobile-ui-revamp/design/MobileDashboard.dc.html`: the `.ht .aurora` values match `tokens.aurora` in both themes.
- `employeePhotos`: grep shows `mobile/components/Avatar.js:26` is its only consumer.

## Findings, by file

### `mobile/components/LeaveCalendar.js`

**CRITICAL · line 241 · contrast (AC10)**
- What: holiday day numbers are drawn in `t.orange` on the orange-soft cell. In the light theme that measures 2.54:1 at 15px (4.70 in dark).
- Why: AC10 requires 4.5:1 for every text, so light-theme holidays are hard to read.
- Rule: intent AC10 · a test would have caught it: yes. `mobileTokens.test.mjs` composites only tab-bar and page text, not the fills components draw.
- Fix: draw the number in `text1` (or `pfAmber`), keep the colour on the cell fill and edge, and add the pair to the tokens test.

**CRITICAL · lines 239, 313 · orange holidays (AC3)**
- What: holiday cells and the month's holiday strips are orange-soft with orange flags. The Leaves holiday list and Events recolour holidays cyan, citing AC3, so the same screen disagrees with itself. Smoke "Needs a decision" item 1 is unanswered.
- Why: AC3 reserves orange for Meeting, celebrations and wishes, and your avatar.
- Rule: intent AC3 · a test would have caught it: no, it is visual.
- Fix: use the cyan or grey the Leaves rows use, or have Sanish amend AC3 in `intent.md` before merge.

### `mobile/components/EventBanner.js`

**CRITICAL · line 20 · orange announcements (AC3)**
- What: `AnnouncementCard` draws every banner orange-soft with an orange tile: company events (line 69), public holidays (line 76) and the fiscal-year banner, not only birthdays and anniversaries.
- Why: AC3 is contradicted on Home, the first screen people open.
- Rule: intent AC3 · a test would have caught it: no, it is visual.
- Fix: add a `tone` prop (orange for celebrations, cyan or blue for events, holidays and the fiscal year), or amend AC3.

### `mobile/app/(tabs)/index.js`

**HIGH · line 24 · hardcoded token values**
- What: `FIGURE_DOTS` hardcodes `#3D63F0` and `#F5A524`, which are the `primary` and `unpaid` tokens. `fines.js:26` `SUMMARY_DOTS` repeats them, plus `#22C55E` and `#2DD4EF`.
- Why: literals escape the parity test, so a token change on the web leaves these dots stale.
- Rule: plan Constraints ("theme values through `useThemeColors()`") · a test would have caught it: no. A lint rule against hex literals in `app/` would.
- Fix: use `t.primary` and `t.unpaid`; add fixed dot tokens to `tokens.js` for the green and cyan.

### `mobile/app.config.js`

**MEDIUM · line 27 · bypass flag on the runtime**
- What: any process with `HT_DEV_CLIENT_RUNTIME=1` gets runtime `"development"` instead of the fingerprint: a shell export, a future `.env`, or a mis-scoped EAS variable.
- Why: an `eas update` run that way publishes to a runtime no preview install has, and nothing says so.
- Rule: `security.md` §8 (a bypass flag is flagged even when deliberate) · a test would have caught it: no.
- Fix: also require `process.env.EAS_BUILD_PROFILE === "development"`, so only an EAS development build can take the fixed runtime.

### `mobile/lib/tokens.js`

**MEDIUM · line 136 · glows outside the tokens**
- What: 17 files hardcode `rgba(61, 99, 240, …)` glows and `rgba(255, 106, 31, …)` edges. Theme `SHADOWS` / `CYAN_GLOW` maps are copied in poker, retro, HumanLoader, login, events, meeting and words.
- Why: these are token colours at an alpha, repeated 17 times; a palette change misses every copy.
- Rule: MEDIUM repetition, an arbitrary value where a semantic one exists · a test would have caught it: no.
- Fix: add glow, edge and shadow sets per theme to `tokens.js` and read them through `useThemeColors()`.

### `mobile/app/meeting.js`

**MEDIUM · lines 88, 647 · duplicated helpers**
- What: `goBack` is copied in 10 screens, and the Hermes fraction-trim date parse in 5 files. `useNow` exists here and in `attendance.js`; `localToday`, `daysBetween` and `dayOf` exist in `leaves.js:48` and `events.js:37`, and again in `EmployeeDetailModal` and `LeaveCalendar`.
- Why: a fix such as the Hermes trim has to be repeated in every copy; `lib/notifications.js` already owns it.
- Rule: Quality, no duplicated logic · a test would have caught it: no.
- Fix: one pure `lib/dates.js` (unit-testable under the repo's runner) plus `useGoBack` and `useNow` hooks.

### `mobile/components/EditCompanyEventModal.js`

**MEDIUM · line 46 · errors swallowed**
- What: a failed delete leaves the sheet open with no message (`if (!error) onClose()`). `EditWordSeasonModal.js:41` does the same, and deleting a season now happens only there.
- Why: an RLS refusal or an offline delete looks like a dead button.
- Rule: Quality, errors surfaced, not swallowed · a test would have caught it: no.
- Fix: show `error.message` in a `SheetNote`, as `AddCompanyEventModal` does.

### `mobile/app/retrospective.js`

**LOW · line 628 · state left on exit**
- What: `exitToHub` clears `view` and `session` only. `composeText`, `activeCol`, `editingCardId` and `reactionPickerFor` survive, so a draft typed on one board appears in the next board's composer.
- Why: someone can send a card to the wrong board.
- Rule: Quality · a test would have caught it: no.
- Fix: reset them in `exitToHub`, as poker's version does.

### `mobile/app/planning-poker.js`

**LOW · lines 491, 504 · silent failures**
- What: reveal and reset catch network errors and drop them. End Session goes back to the hub whenever `fetch` resolves, even on a 4xx; retro's end does the same.
- Why: the host believes a refused end worked.
- Rule: Quality, errors surfaced · a test would have caught it: no.
- Fix: check `res.ok` and show an Alert when it fails.

### `mobile/components/TopBar.js`

**LOW · line 120 · stale window**
- What: `now: new Date()` sits inside a `useMemo` keyed only on the data, so a fine leaves the 30-day window only when fines change.
- Why: the bell can count an old fine as recent for a long session.
- Rule: `performance.md` §2 (memoised on the wrong inputs) · a test would have caught it: no.
- Fix: key the memo on today's date, or compute the list when the bell opens.

### `mobile/context/AppContext.js`

**LOW · line 47 · ship order**
- What: the app calls `/api/avatars`, which exists only in the uncommitted web tree. An OTA published before that deploy gets a 404 and shows only initials.
- Why: AC12 fails quietly in production until the web ships.
- Rule: intent Dependencies · a test would have caught it: no.
- Fix: publish the update after the web revamp is live, and say so in the PR.

### `mobile/components/EmployeeDetailModal.js`

**LOW · line 376 · unbounded list**
- What: "View all records" renders every leave, fine and standup the person ever had in a ScrollView.
- Why: the cost grows with tenure; one person accumulates years of rows.
- Rule: `performance.md` §1 · a test would have caught it: no.
- Fix: page the list, or use a FlatList.

### `mobile/components/EditEmployeeModal.js`

**LOW · line 11 · mixed responsibility**
- What: domain lists live in sheet components: `EMPLOYEE_STATUSES` and `employeeStatus` here, the amounts and statuses in `AddFineModal`, `TYPE_OPTIONS` and `LeaveDates` in `AddLeaveModal`. Team, Employee and Meeting import them from there.
- Why: a screen depends on a modal's file for its data rules.
- Rule: Quality, one responsibility per file · a test would have caught it: no.
- Fix: move the constants into `lib/`.

### `src/lib/mobilePoker.test.mjs`

**LOW · line 11 · parity restated, not pinned**
- What: only the deck is read from the web. `summariseVotes` is checked against hand-written answers, so a rule change in `PlanningPokerPage.js` does not fail here. The avatar, notifications, nepaliDate, retro and tokens tests import the web module; they do pin parity.
- Why: poker results can drift from the web unnoticed.
- Rule: Quality, tests assert behaviour · a test would have caught it: this is the test.
- Fix: when the web next changes, extract `summariseVotes` to `src/lib/` and compare outcomes as the others do.

## Top 3 priority fixes
1. `mobile/components/LeaveCalendar.js:241`: draw holiday numbers in `text1`, and settle orange for holidays (AC3) with Sanish.
2. `mobile/components/EventBanner.js:20`: take events, holidays and the fiscal-year banner off orange, or amend AC3.
3. `mobile/app/(tabs)/index.js:24`: use `t.primary` and `t.unpaid` instead of hex literals (and in `fines.js:26`).

## Done well
- The parity tests import the web module and compare outcomes over hostile tables: host tricks, ports, `constructor` and `__proto__` keys, Hermes six-digit timestamps. Drift between the apps fails.
- The photo fetch is keyed per user, aborts on sign-out, times out after 12s and checks every URL again at draw. Projects opens only http(s) links, and the Employee screen validates the address before `mailto`.
- Criterion 15 holds: the lockfile adds only three JavaScript font packages, and `expo-font` was already linked at 57.0.0.

## Built but not asked for
- Add Holiday and holiday delete on the Events screen. The data path exists; it was on Leaves before.
- Tap-a-day detail in the Leaves calendar, and collapsible standup answers in Meeting.
- The retro timer, themes, action items and "is writing" activity, shown read-only.

## Blind spots
- Contrast tests composite only tab-bar and page text. The holiday-cell failure is the kind a table of the on-glass and tinted text/fill pairs components draw would catch.
- Criteria 1, 5, 6 and 7 rest on a smoke pass without listed steps. A screenshot per artboard per theme would make them checkable.
- `fetchEmployeePhotos` (timeout, abort, account switch) is untested. Extract it as a pure function that takes `fetch` and `getSession`, and test it.
- Fingerprints were not regenerated here. Run `npx expo-updates fingerprint:generate` for both platforms, in a shell without `HT_DEV_CLIENT_RUNTIME`, before publishing.

## Pre-existing, not this branch
- npm audit of `mobile/`: 38 findings in the Expo and Metro toolchain (`shell-quote` critical; `@expo/cli`, `metro`, `node-forge`, `@xmldom/xmldom` and others high). The branch adds none of these packages.
- Flagged by the developer and unchanged here: `POST /api/send-wish` has no sign-in check; retro reactions still work on ended boards; the memories WebView opens any stored URL.

---
Stack: JavaScript, React Native 0.86, Expo SDK 57 with Expo Router, react-native-svg, Node's test runner. Passes applied shallowly: visual criteria 1, 5, 6 and 7 were not compared with the artboards beyond the aurora spot-check; native rendering (Hermes, `boxShadow`, fonts) was not run on a device; the fingerprint was checked by reading the sourcer, not regenerated.

## Fixes applied
_2026-10-21, after Sanish's "fix all valid". All 15 findings fixed; two with a fix other than the one suggested above (the app.config.js flag and the holiday colour), as decided in the fixes brief._

| # | Finding | Status | What changed |
| --- | --- | --- | --- |
| 1 | CRITICAL `LeaveCalendar.js:241` holiday numbers 2.54:1 | fixed | `mobile/lib/leaveCalendar.js` picks every cell's colours; `src/lib/mobileLeaveCalendar.test.mjs` holds each day number and BS day to 4.5:1 on its cell, inside the card, over every aurora blob, both themes. The test also caught two failures the review missed, both now fixed: the BS day on today's cell (3.87 dark) and the first-of-month BS day on light tints (4.16). Lowest now: 4.54 dark, 5.08 light. |
| 2 | CRITICAL `LeaveCalendar.js:239, 313` orange holidays | fixed | Holiday cells, strips, the detail flag and the legend swatch use the grey pill tone (pbGray fill, pfGray number, lineStrong edge); today stays cyan. AC3 is unchanged. |
| 3 | CRITICAL `EventBanner.js:20` orange announcements | fixed | `AnnouncementCard` takes a `kind`; `mobile/lib/announcement.js` keeps orange for celebrations (birthdays, anniversaries) and draws events, holidays and the fiscal-year banner cyan (pbCyan, cyanEdge, cyan tile). `src/lib/mobileAnnouncement.test.mjs` pins the mapping and 4.5:1 for the text over every blob (lowest 5.29). |
| 4 | HIGH `(tabs)/index.js:24`, `fines.js:26` hex token values | fixed | The dots read `primary`, `unpaid` and new fixed tokens `green`, `red` (the web's `--accent-green`, `--accent-red`, pinned by the tokens test) and `cyanDot`; `projects.js` production dot, `leaves.js` over-quota red and the Words corner light too. Left as literals: `#FFFFFF` / `#0A0E17` ink on primary and orange fills and the scrims, which have no web token. |
| 5 | MEDIUM `app.config.js:27` bypass flag | fixed differently: config unchanged, risk documented | The suggested `EAS_BUILD_PROFILE` guard would break development builds: eas-cli 20.5.1 never sets it while it resolves a runtime on this machine (`EAS_BUILD_PROFILE` appears nowhere in `eas-cli/build`). A local `eas build` evaluates the config with `{...EAS environment variables, ...profile env}` (`build/build/evaluateConfigWithEnvVarsAsync.js:14-22, 53`) and resolves the runtime with that env (`build/build/build.js:475-481`). `eas update --environment X` resolves it with the same env, from the same server variables plus `EXPO_NO_DOTENV` (`build/commands/update/index.js:181-186, 318-327`). Both run `expo config` through `project/expoConfig.js:24-37`. A stray flag in an update therefore looks the same as a development build to the config, so no guard meets all three conditions. The risk is now written where publishing is described (`mobile/README.md`, "Building for real devices / stores"). Fingerprints unchanged. |
| 6 | MEDIUM `tokens.js:136` glows outside the tokens | fixed | `tokens.js` now holds the edges (`primaryEdge`, `orangeEdge`, `cyanEdge`, `amberEdge`, `redEdge`) and the glows and shadows (`glow`, `glowCyanSoft`, `shadowCard`, `shadowLift`, `glowPrimarySm`, `glowPrimary`, `glowPrimaryLg`, `glowOrangeSm`, `glowOrange`, `glowOrangeDot`). The tokens test holds `glow`, `shadowCard`, `shadowLift` and `glowPrimary` equal to the web's `--glow`, `--shadow`, `--shadow-lift` and `--shadow-glow-indigo`, and every other edge and glow to its token colour. Every copy in `mobile/app` and `mobile/components` reads them through `useThemeColors()`. Near-identical sizes now share one glow (see the re-smoke notes). |
| 7 | MEDIUM `meeting.js:88, 647` duplicated helpers | fixed | One pure `mobile/lib/dates.js` (`dayOf`, `toDate`, `localToday`, `daysBetween`, `parseTimestamp` with the Hermes trim, `formatStamp`), tested by `src/lib/mobileDates.test.mjs`. `useGoBack(fallback)` (10 screens) and `useNow(ms)` (Meeting, Attendance) live in `mobile/lib/`. Leaves, Events, Employee, LeaveCalendar, Withdrawals, Retro, Poker and Meeting use them; `lib/notifications.js` takes its trim from `parseTimestamp`. |
| 8 | MEDIUM `EditCompanyEventModal.js:46` errors swallowed (and `EditWordSeasonModal.js:41`) | fixed | A failed save or delete keeps the sheet open and shows the reason in a `SheetNote`. |
| 9 | LOW `retrospective.js:628` state left on exit | fixed | `exitToHub` clears the board's data, the draft, the open column, the edit and the reaction picker. |
| 10 | LOW `planning-poker.js:491, 504` silent failures | fixed | Reveal, reset and End Session check `res.ok` and show an Alert when they fail; End Session (poker and retro) returns to the hub only once the server has ended the session. |
| 11 | LOW `TopBar.js:120` stale window | fixed | The bell's memo is keyed on today's date as well as the data. |
| 12 | LOW `AppContext.js:47` ship order | fixed | A comment at `fetchEmployeePhotos` and a line in `mobile/README.md`: publish only after the web app serving `/api/avatars` is deployed. Say so in the PR too. |
| 13 | LOW `EmployeeDetailModal.js:376` unbounded list | fixed | The list draws a bounded page (`mobile/lib/paging.js`, tested by `src/lib/mobilePaging.test.mjs`): five, then 20 more per tap ("View 20 more of N"), then "Show recent only". |
| 14 | LOW `EditEmployeeModal.js:11` mixed responsibility | fixed | Statuses, fine amounts and statuses, and leave kinds live in `mobile/lib/options.js` (`employeeStatus` tested by `src/lib/mobileOptions.test.mjs`); Team, Employee and every sheet import them from there. The shared sheet pieces (`LeaveDates`, `HalfDaySegment`, `SeasonLine`) stay in `AddLeaveModal.js`: they are components, not data. |
| 15 | LOW `mobilePoker.test.mjs:11` parity restated | fixed | The test cuts `FIBONACCI`, `hasVoted` and `summariseVotes` out of `src/components/PlanningPokerPage.js`, runs them as written, and compares every round's answer with the phone's. No web file changed. Changing the phone's zero rule makes the test fail, which shows it catches drift. |

Checks after the fixes: `npm test` 256/256; `npm run lint` 49 problems (49 before, none on the changed lines); `expo export` android and ios both bundle; fingerprints android `a00305e9e9c76cc7b869be15bd3175ce71caf44c`, ios `e7def2ef915dd680d11d79dbd4a2b98ef4a4f1f1` (unchanged).
