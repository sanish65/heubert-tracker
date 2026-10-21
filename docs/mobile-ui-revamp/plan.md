# Mobile UI revamp Implementation Plan

**Intent:** docs/mobile-ui-revamp/intent.md
**Goal:** Every screen of the Expo app (`mobile/`) matches its mobile artboard on the "Heubert Tracker Revamp" canvas, behaves as it does today, and ships to the existing `preview` installs as an OTA update.
**Approach:** Foundations first (tokens shared with the web app, fonts, line icons, photo rules), then the shared building blocks in `mobile/components/ui.js` and the app shell (aurora background, glass tab bar, header with the bell), then one screen family per task against its artboard, then a sweep for emoji, light theme, motion and the delivery checks. No native module is added, so the runtime fingerprint stays at its recorded baseline and `eas update` can deliver the result.
**Test layers:** Unit only. The decisions in this work are pure and testable under the repo's runner: the mobile tokens equal the web tokens in `src/app/globals.css` (so the web contrast proof, `src/lib/contrast.test.mjs`, carries over, and drift between the apps fails a test), the avatar photo rules and the bell's list behave exactly like the web modules they mirror (`src/lib/avatar.js`, `src/lib/notifications.js`). These tests live in `src/lib/` and import the pure mobile modules by relative path, so `npm test` runs them without a new runner. Everything else is how screens look and is proven by the smoke test on a phone through the dev client. The delivery criterion (14) is proven by the fingerprint command's output, run in Task 1 and again in Task 17; criterion 15 by the dependency diff. The only new access path is the app calling the existing `GET /api/avatars`, whose refusals are already covered by `src/lib/avatar.test.mjs` (`isActiveEmployeeEmail`) and web smoke step 23.
**Constraints:**
- `CLAUDE.md`: "Unit tests use Node's built-in runner: `npm test` (runs `src/**/*.test.mjs`). It needs Node 22+ … (with nvm: `nvm use 22`). Only pure modules with no `@/` imports are unit-tested; anything touching Supabase, a route or a page is verified in the running app."
- Expo and EAS CLIs need Node 22: `source ~/.nvm/nvm.sh && nvm use 22.20.0` (project memory: the default node is v16).
- JavaScript only; React Native styles as the app writes them today (inline objects and `StyleSheet.create`); theme values through `useThemeColors()` from `mobile/lib/theme.js`; data through `mobile/context/AppContext.js`.
- **No new native module** (no `expo-blur`, nothing with native code): `mobile/app.config.js` uses runtimeVersion policy "fingerprint", so a native change would stop OTA updates reaching the installed apps. Pure JavaScript packages (font assets) are fine; the fingerprint must stay Android `a00305e9e9c76cc7b869be15bd3175ce71caf44c`, iOS `e7def2ef915dd680d11d79dbd4a2b98ef4a4f1f1` (`npx expo-updates fingerprint:generate --platform <android|ios>`, run in `mobile/`).
- **Never run `eas update`, `eas build` or `eas env:push`**: the `preview` channel has real users; Sanish publishes.
- Branch `kanban-tracker` holds the uncommitted web revamp and Kanban work. **No commits during execution**; never stash, reset, checkout or revert. This work changes `mobile/` and adds tests under `src/lib/` only; it never edits web files.
- No change to data, the database or any API route. The app may call the existing `GET /api/avatars` (`src/app/api/avatars/route.js`).
- Lint: `npm run lint` covers `mobile/` too; no new problems on your lines.
- Never run `npx expo install` or `expo install --fix` (found in Task 1: it moves Expo packages to newer patches and changes the fingerprint); a pure JavaScript package goes in with `npm install`, an Expo package not at all.
- Bundle check: `npx expo export --platform android --output-dir "$(mktemp -d)"` in `mobile/` (a temporary folder: ESLint also reads `mobile/dist/`, so exporting there moves the lint total).

**Design reference:** `docs/mobile-ui-revamp/design/Mobile*.dc.html` — one HTML artboard per mobile screen (390px wide), plus `Foundations.dc.html` (the rules) and `MobileTabBar.dc.html` (the shared tab bar). Each artboard's `<helmet><style>` holds the token set (dark `.ht`, light `.ht.light`), and its markup gives exact sizes, radii, spacing and colours inline; its `renderVals()` shows the states. Copy values from there; never invent new ones. Sample data in the artboards is not copied into the app. CSS that React Native cannot draw maps as follows: `backdrop-filter` is dropped (the Foundations fallback: use the more opaque `surfaceStrong` fill where content scrolls under a bar); `box-shadow: inset 0 1px 0 …` (the glass highlight) becomes a 1px top border in `glassHi`; radial-gradient aurora blobs are drawn with `react-native-svg` radial gradients; `letter-spacing` in em becomes a pixel value at that font size.


**Every screen task (5–16) works the same way:**
1. Read the artboard (every state its `renderVals()` and data-props offer, both themes) and the screen file(s); before changing anything, list each control, action, permission check and empty/loading/error state the screen has today. All of them stay, with the same data calls (`useApp()` functions) and the same results (criterion 13).
2. Rebuild the layout from the shared blocks (`Screen`, `TopBar` or `ScreenHeader`, `Card`, `SectionTitle`, `Eyebrow`, `Button`, `IconButton`, `Pill`, `Chip`/`Select`, `TextField`, `FormModal`, `EmptyState`, `Avatar`, `Icon`) to match the artboard's order, grouping, sizes and colours; dates, amounts, counts and IDs in the mono font; no emoji in tabs, headings, buttons, badges or empty states (people's own text and retro reactions keep theirs).
3. What the artboard shows but the app has no data or feature for is left out (intent, Out of scope) and listed in your report. What the app has but the artboard lacks stays, styled with the same blocks, and is listed too. The app's wording stays where the artboard renames something.
4. Every form sheet the screen opens gets the `FormModal` sheet look of `MobileRecordFine.dc.html` / `MobileRecordLeave.dc.html`: fields, chips and the action row at the bottom (primary blue on the right, secondary glass beside it).
5. Never edit `mobile/app.config.js`, `mobile/eas.json` or anything native: the app config is part of the runtime fingerprint.
7. Text drawn straight on the page (outside a card or sheet: headers, eyebrows, labels between cards) uses only `text1`, `text2` or `<Eyebrow onPage>` (`pageEyebrow`): `text3`, `primaryText` and `cyanText` fall under 4.5:1 over the light aurora (`src/lib/mobileTokens.test.mjs`). On glass every text token passes.
8. An icon the artboard uses but `mobile/components/Icon.js` lacks is added there with the artboard's path data under a new kebab-case name; the data of an existing name never changes (it mirrors `src/components/Icon.js`).
9. The shared blocks after Task 3 (`mobile/components/ui.js`): `IconButton` takes `size` (40 rows, 44 headers and sheets) and `tone` (`glass`, `raised`, `plain`, `danger`); `ScreenHeader` shows Back (44, `chevron-left`) only when `onBack` is passed; `Eyebrow` takes `onPage`; `Button` variants `primary`, `secondary`, `orange` (pill), `danger`, `ghost`; a `Pill` in a column needs `style={{ alignSelf: 'flex-start' }}`.
6. Verify: `npm run lint` (no new problems on your lines); the bundle check in Constraints builds; report what to check on a phone (both themes, an admin and a non-admin where the screen differs).

## Files
| Path | Create or modify | Responsibility |
| --- | --- | --- |
| `mobile/lib/tokens.js` | create | The design tokens, dark and light, plus font names and radii. Pure, no imports. The one definition the app reads. |
| `src/lib/mobileTokens.test.mjs` | create | Mobile tokens equal the web tokens; mobile-only pairs pass contrast. |
| `mobile/lib/theme.js` | modify | `themes` built from `tokens.js`, with the old names (`bg`, `card`, `textPrimary`, `accentIndigo`, …) kept as aliases until Task 17; `useThemeColors()` unchanged. |
| `mobile/app/_layout.js` | modify | Loads the three font families; status bar per theme. |
| `mobile/package.json`, `mobile/package-lock.json` | modify | `expo-font` and the three `@expo-google-fonts/*` packages (JavaScript and font assets only). |
| `mobile/components/Icon.js` | create | Line icons with `react-native-svg`, the same names and path data as `src/components/Icon.js`. |
| `mobile/lib/avatar.js` | create | Pure: `initials`, `avatarColor`, `isGooglePhotoUrl`, `photoForName`, as `src/lib/avatar.js`. |
| `src/lib/mobileAvatar.test.mjs` | create | The mobile avatar rules give the web module's results. |
| `mobile/lib/notifications.js` | create | Pure: `myFineNotifications`, `unseenCount`, as `src/lib/notifications.js`. |
| `src/lib/mobileNotifications.test.mjs` | create | The mobile notifications rules give the web module's results. |
| `mobile/components/ui.js` | modify | Shared building blocks restyled: `Screen` (ink + aurora), `Card` (glass), `SectionTitle`, `Eyebrow`, `EmptyState` (icon), `Button` (primary / secondary / orange / danger / ghost), `IconButton`, `TextField`, `Chip`, `Select`, `Pill`, `FormModal` (glass sheet), `ScreenHeader`. |
| `mobile/components/Aurora.js` | create | The aurora blobs behind every screen (SVG radial gradients), still when motion is off. |
| `mobile/components/Avatar.js` | create | Person avatar: Google photo, else initials; orange mark for the current user. |
| `mobile/context/AppContext.js` | modify | `employeePhotos` from `GET /api/avatars`, loaded once per signed-in user. |
| `mobile/components/TabBar.js` | create | The canvas tab bar (`MobileTabBar.dc.html`). |
| `mobile/components/TopBar.js` | create | The tab screens' header: title, the bell (your fines sheet) and the account button. |
| `mobile/app/(tabs)/_layout.js` | modify | Uses `TabBar`; drops the emoji icons; header handled by each screen. |
| `mobile/app/(tabs)/index.js` | modify | Home (`MobileDashboard.dc.html`). |
| `mobile/app/(tabs)/attendance.js` | modify | Attendance (`MobileAttendance.dc.html`). |
| `mobile/app/(tabs)/fines.js`, `mobile/app/withdrawals.js` | modify | Fines, Withdrawals (`MobileFines`, `MobileWithdrawals`). |
| `mobile/app/(tabs)/leaves.js`, `mobile/app/leave-settings.js`, `mobile/components/LeaveCalendar.js` | modify | Leaves, Leave settings (`MobileLeaves`, `MobileLeaveSettings`). |
| `mobile/app/(tabs)/team.js`, `mobile/components/EmployeeDetailModal.js` | modify | Team, Employee (`MobileTeam`, `MobileEmployee`). |
| `mobile/app/(tabs)/more.js`, `mobile/app/settings.js` | modify | More, Settings (`MobileMore`, `MobileSettings`). |
| `mobile/app/meeting.js` | modify | Meeting mode (`MobileMeeting`). |
| `mobile/app/planning-poker.js` | modify | Planning poker (`MobilePoker`). |
| `mobile/app/retrospective.js` | modify | Retrospective (`MobileRetro`). |
| `mobile/app/words.js`, `mobile/app/events.js` | modify | Words, Events (`MobileWords`, `MobileEvents`). |
| `mobile/app/projects.js`, `mobile/app/memories.js` | modify | Projects, Memories (`MobileProjects`, `MobileMemories`). |
| `mobile/app/login.js`, `mobile/components/HumanLoader.js`, `mobile/components/EventBanner.js`, `mobile/components/NewFiscalYearBanner.js`, `mobile/components/UpdateBanner.js`, `mobile/components/Skeleton.js`, `mobile/components/DateField.js` | modify | Sign-in, loader, banners and small parts (`MobileLogin`, `Splash.dc.html` on the canvas for the loader's look). |
| `mobile/components/Add*Modal.js`, `mobile/components/Edit*Modal.js`, `mobile/components/ProjectFormModal.js`, `mobile/components/LeaveTypeFormModal.js` | modify | Every form sheet, in the task of its screen (`MobileRecordFine`, `MobileRecordLeave` set the sheet style). |

## Task 1: Tokens, fonts and the fingerprint guard
**Delivers:** acceptance criteria 2, 9, 10, 14, 15.
**Files:** create `mobile/lib/tokens.js`, `src/lib/mobileTokens.test.mjs`; modify `mobile/lib/theme.js`, `mobile/app/_layout.js`, `mobile/package.json`, `mobile/package-lock.json`.
**Kind:** judgement.

- [ ] Step 1: write `src/lib/mobileTokens.test.mjs` (style of `src/lib/contrast.test.mjs`: `node:test`, `node:assert/strict`; read the web tokens with `readTokens(css, '@tokens dark')` and the light block merged over dark, from `src/lib/contrast.js`; import `{ tokens }` from `'../../mobile/lib/tokens.js'`). Assertions:
  - for both themes, every web colour token below has a mobile token of the camelCase name with the same colour (compare with `parseColor` from `src/lib/contrast.js`, so `#3d63f0` and `rgba(61, 99, 240, 1)` spellings agree): `--ink`→`ink`, `--surface`→`surface`, `--surface-solid`→`surfaceSolid`, `--surface-strong`→`surfaceStrong`, `--raised`→`raised`, `--line`→`line`, `--line-strong`→`lineStrong`, `--text-1`→`text1`, `--text-2`→`text2`, `--text-3`→`text3`, `--primary`→`primary`, `--primary-hover`→`primaryHover`, `--primary-text`→`primaryText`, `--primary-soft`→`primarySoft`, `--cyan`→`cyan`, `--cyan-text`→`cyanText`, `--orange`→`orange`, `--orange-hover`→`orangeHover`, `--orange-soft`→`orangeSoft`, `--unpaid`→`unpaid`, `--dots`→`dots`, and every pill pair `--pb-<tone>`→`pb<Tone>`, `--pf-<tone>`→`pf<Tone>` for blue, green, amber, red, violet, cyan, gray;
  - `glassHi` equals the colour inside the web `--glass-hi` value (the `rgba(…)` of `inset 0 1px 0 rgba(…)`) in each theme;
  - text on the tab bar's fill passes: `text1`, `text2`, `text3`, `primaryText` and `cyanText` against `surfaceStrong` composited over `ink` are ≥ 4.5:1 in both themes (`composite`, `contrastRatio`);
  - `tokens.fonts` names exactly the loaded families listed in Step 4, and `tokens.radius` is `{ sm: 10, md: 12, lg: 16, xl: 20, sheet: 24, pill: 9999 }` (Foundations "Shape": cards 16, inner tiles 10–12, inputs and buttons 10, dialogs 20, pills and avatars round; the sheets on `MobileRecordFine.dc.html` use 24 at the top).
- [ ] Step 2: run `source ~/.nvm/nvm.sh && nvm use 22 && node --test src/lib/mobileTokens.test.mjs`; expected: FAIL, `mobile/lib/tokens.js` does not exist.
- [ ] Step 3: create `mobile/lib/tokens.js` (pure, no imports): `export const tokens = { dark: {…}, light: {…}, fonts: {…}, radius: {…} }` with the values from `src/app/globals.css` (the `/* @tokens dark */` and `/* @tokens light */` blocks; light overrides every colour except `primary`, `orange`, `orangeHover`, `unpaid`, which stay as dark) and `glassHi` colours `rgba(255, 255, 255, 0.07)` dark, `rgba(255, 255, 255, 0.9)` light; add the shadow numbers React Native needs (`shadowOpacity` 0.28 dark, 0.08 light; `shadowRadius` 12; `shadowOffsetY` 8; elevation 4). Run the test; expected: PASS.
- [ ] Step 4: fonts. In `mobile/`, with Node 22: `npx expo install expo-font @expo-google-fonts/space-grotesk @expo-google-fonts/ibm-plex-sans @expo-google-fonts/jetbrains-mono`. Load in `mobile/app/_layout.js` with `useFonts` from `expo-font`: `SpaceGrotesk_500Medium`, `SpaceGrotesk_600SemiBold`, `SpaceGrotesk_700Bold`, `IBMPlexSans_400Regular`, `IBMPlexSans_500Medium`, `IBMPlexSans_600SemiBold`, `JetBrainsMono_400Regular`, `JetBrainsMono_500Medium`; `tokens.fonts` = `{ display: 'SpaceGrotesk_700Bold', displaySemibold: 'SpaceGrotesk_600SemiBold', displayMedium: 'SpaceGrotesk_500Medium', body: 'IBMPlexSans_400Regular', bodyMedium: 'IBMPlexSans_500Medium', bodySemibold: 'IBMPlexSans_600SemiBold', mono: 'JetBrainsMono_400Regular', monoMedium: 'JetBrainsMono_500Medium' }`. Keep showing the existing loader (`HumanLoader`) until fonts are loaded or have failed; a font error never blocks the app (system font). Custom font families in React Native carry their weight in the family name, so `fontWeight` is not combined with them.
- [ ] Step 5: `mobile/lib/theme.js`: `themes.dark` / `themes.light` = the token set plus the old names as aliases so every screen keeps working until it is migrated: `bg`→`ink`, `bgElevated`→`surfaceSolid`, `bgInput`→`raised`, `card`→`surface`, `border`→`line`, `textPrimary`→`text1`, `textSecondary`→`text2`, `textMuted`→`text3`, `accentIndigo`→`primary`, `accentIndigoSoft`→`primarySoft`, `accentSky`→`cyan`, `accentOrange`→`orange`, `accentOrangeSoft`→`orangeSoft`; the other old accents (`accentViolet`, `accentGreen`, `accentRed`, `accentAmber` and their `Soft`) keep today's values until Task 17 removes them. Export `fonts` and `radius` from `tokens.js` through `theme.js` (`radius` changes to the token scale). The status bar in `app/_layout.js` follows the theme (light text on dark ink, dark text on light ink).
- [ ] Step 6: the fingerprint guard. In `mobile/`: `npx expo-updates fingerprint:generate --platform android` and `--platform ios`; expected hashes: Android `a00305e9e9c76cc7b869be15bd3175ce71caf44c`, iOS `e7def2ef915dd680d11d79dbd4a2b98ef4a4f1f1` (the tool hashes the autolinked native modules and `package.json` scripts, not plain JavaScript dependencies: `node_modules/@expo/fingerprint/build/sourcer/Bare.js`). A different hash means a native change crept in: stop and report it.
- [ ] Step 7: `npm test` (all pass); `npm run lint` (no new problems on your lines); in `mobile/`, `npx expo export --platform android --output-dir dist` (the bundle builds; `dist/` is gitignored).

## Task 2: Icons, avatar rules and the bell's list
**Delivers:** acceptance criteria 8, 12 (the rules part); prepares the bell for Task 4.
**Files:** create `mobile/components/Icon.js`, `mobile/lib/avatar.js`, `mobile/lib/notifications.js`, `src/lib/mobileAvatar.test.mjs`, `src/lib/mobileNotifications.test.mjs`.
**Kind:** judgement (mostly porting; the web modules are the specification).

- [ ] Step 1: `src/lib/mobileAvatar.test.mjs`: for a table of inputs, `mobile/lib/avatar.js` returns exactly what `src/lib/avatar.js` returns for `initials`, `avatarColor` (and `AVATAR_COLORS` is equal), `isGooglePhotoUrl` (include `https://lh3.googleusercontent.com/a/x=s96-c`, `http://lh3.googleusercontent.com/a/x`, `https://evil.example.com/a.png`, `https://googleusercontent.com.evil.com/a`, `https://lh3.googleusercontent.com:8443/a`, `javascript:alert(1)`, `''`, `null`, a 3000-character Google URL) and `photoForName` (exact name, `' bikesh '` case and spaces, unknown name, `null` map, a name like `'constructor'`). `src/lib/mobileNotifications.test.mjs`: the same for `myFineNotifications` and `unseenCount` against `src/lib/notifications.js`, reusing the fixtures of `src/lib/notifications.test.mjs` (both kinds, the 30-day edge, limit, exclusions, `seasonId`, a row with no time).
- [ ] Step 2: `source ~/.nvm/nvm.sh && nvm use 22 && node --test src/lib/mobileAvatar.test.mjs src/lib/mobileNotifications.test.mjs`; expected: FAIL, modules missing.
- [ ] Step 3: create `mobile/lib/avatar.js` and `mobile/lib/notifications.js` as pure copies of the web modules' behaviour (no imports; a header comment naming the web file they mirror and the parity test that keeps them equal). Run; expected: PASS.
- [ ] Step 4: `mobile/components/Icon.js`: `export default function Icon({ name, size = 18, strokeWidth = 1.8, color, style, accessibilityLabel })` drawing with `react-native-svg` (`Svg`, `Path`, `Circle`, `Rect`, …, already a dependency) every icon `src/components/Icon.js` defines, with the same names and path data; `viewBox="0 0 24 24"`, `fill="none"`, round caps and joins, `stroke={color}` (default: the theme's `text2` via `useThemeColors()`); decorative unless `accessibilityLabel` is given (then `accessible` with `accessibilityRole="image"`). An unknown name renders nothing and warns once in development. Export `ICON_NAMES`.
- [ ] Step 5: `npm test`; `npm run lint`; `npx expo export --platform android --output-dir dist` in `mobile/`.

## Task 3: Shared building blocks
**Delivers:** acceptance criteria 1, 3, 4, 5 (the shared parts), 8 (empty states), 11 (aurora still when motion is off).
**Files:** modify `mobile/components/ui.js`; create `mobile/components/Aurora.js`.
**Kind:** judgement.
**Design:** `Foundations.dc.html` (controls, pills, shape, motion), `MobileDashboard.dc.html` (cards, eyebrow, section titles), `MobileRecordFine.dc.html` and `MobileRecordLeave.dc.html` (sheet, fields, chips, actions), `MobileFines.dc.html` (pills, chips, icon buttons).

- [ ] Step 1: `Aurora`: an absolutely positioned layer behind screen content drawing the canvas aurora as four `react-native-svg` radial-gradient ellipses (positions and colours from the artboards' `.ht .aurora` rule: 640×440 at 14% 6% `rgba(61,99,240,.34)`, 560×420 at 88% 14% `rgba(124,92,224,.26)`, 620×460 at 72% 96% `rgba(45,212,239,.16)`, 420×320 at 22% 88% `rgba(255,106,31,.11)`, each fading to transparent at 70%; light theme uses the `.ht.light .aurora` alphas), over `ink` with the 24px dot grid only if it costs nothing measurable (otherwise leave the dots out). Static: no animation in this work (criterion 11 is met by never moving it).
- [ ] Step 2: `Screen` = `ink` background + `Aurora` + content (keep its scroll and keyboard props exactly as they are today: `mobile/components/ui.js:5-26`). `Card` = glass: `surface` fill, 1px `line` border, top border `glassHi`, radius `lg` (16), padding 16–18 as the artboards, the token shadow. `SectionTitle` = Space Grotesk 600/700, `text1`, 17–19px as the artboards; new `Eyebrow` = mono 12px uppercase, letter-spacing ~1px, `cyanText`.
- [ ] Step 3: `EmptyState({ icon, text })`: `icon` is now an `Icon` name (default `"sparkles"` or the closest the artboards use), drawn at 28px in `text3`; an emoji string passed by a screen not yet migrated is ignored in favour of the default (so no screen breaks before its task).
- [ ] Step 4: `Button({ title, onPress, variant = 'primary', icon, disabled, small })`: `primary` solid `primary` with white text (no gradient), `secondary` glass (`surface`, `lineStrong` border, `text1`), `orange` (`orange`, text `#0A0E17`; people moments only), `danger` (`pbRed` fill, `pfRed` text), `ghost` (transparent, `text2`); radius `sm` (10); height 44 (40 small); optional leading `Icon`. Keep the old variant names working: `accent`→`secondary`, `warning`→`secondary`, `success`→`primary` (screens migrate later). New `IconButton({ icon, onPress, accessibilityLabel, tone })`: 40×40 (hit area ≥ 44 with `hitSlop`), glass, `accessibilityLabel` required.
- [ ] Step 5: `TextField` (raised fill, `lineStrong` border, radius 10, focus border `cyan`, label 13px `text2` body-semibold), `Chip`/`Select` (canvas chips: radius pill, `surface` fill and `lineStrong` border; active `primarySoft` fill, `primary` border, `text1`), new `Pill({ tone, children })` (the seven tones, `pb*` fill, `pf*` text, 12px body-semibold, radius pill, height 22), `FormModal` (the canvas sheet: dimmed backdrop `rgba(4,6,12,0.6)`, sheet `surfaceStrong` with `lineStrong` hairline and `glassHi` top, radius 24 at the top, a 36×4 grab handle, title in Space Grotesk 600 18px, the close control an `IconButton` with icon `x` and `accessibilityLabel="Close"`; keep its keyboard and scroll behaviour as it is today: `mobile/components/ui.js:164-198`). New `ScreenHeader({ title, onBack, right })` for stacked screens (back `IconButton` `arrow-left` labelled "Back", title, optional right actions), as the stacked artboards' headers (`MobileWithdrawals.dc.html`, `MobileSettings.dc.html`).
- [ ] Step 6: `npm run lint`; `npx expo export --platform android --output-dir dist` in `mobile/`; open two not-yet-migrated screens in the dev client if available and confirm they still render.

## Task 4: App shell — tab bar, top bar with the bell, photos
**Delivers:** acceptance criteria 7, 12, 1 (bars), 3 (orange "you").
**Files:** create `mobile/components/TabBar.js`, `mobile/components/TopBar.js`, `mobile/components/Avatar.js`; modify `mobile/app/(tabs)/_layout.js`, `mobile/context/AppContext.js`.
**Kind:** judgement.
**Design:** `MobileTabBar.dc.html` (bar, icons, active state, the five tabs and their icon paths in its `renderVals()`), the header of `MobileDashboard.dc.html` and `MobileFines.dc.html` (title, Notifications, Account).

- [ ] Step 1: `TabBar` as the canvas tab bar, passed to `<Tabs tabBar={…}>`: `surfaceStrong` fill, `line` top hairline, safe-area bottom inset, five items Home (`index`), Fines, Leaves, Team, More with the artboard's icons (by `Icon` name; add any missing path to `Icon.js` from the artboard), labels 11–12px; active item `primaryText` (icon and label) with the artboard's active marker; inactive `text3`; `accessibilityRole="tab"` and `accessibilityState={{ selected }}`. `attendance` stays a hidden route (`href: null`), as today (`mobile/app/(tabs)/_layout.js:32-38`). Tab screens get `headerShown: false`; each draws `TopBar`.
- [ ] Step 2: `AppContext`: `employeePhotos` (`{}` until loaded, on any failure, and when signed out), fetched once per signed-in user from `${API_BASE_URL}/api/avatars` with `Authorization: Bearer <access_token>` (as the app already calls the web API with the session token for memories: `mobile/context/AppContext.js:850-870`), with a 12s timeout and abort on sign-out; set state only in the async callback. `Avatar({ name, size = 36, isMe = false })`: `photoForName(employeePhotos, name)` (and for `isMe` the session's own `user_metadata.avatar_url` when `isGooglePhotoUrl`) as an `Image` with a circular crop; on `onError`, or with no photo, the initials disc (`initials`, `avatarColor`, white Space Grotesk 600; the current user's disc is `orange` with `#0A0E17` text); `isMe` with a photo adds a 2px `orange` ring.
- [ ] Step 3: `TopBar({ title, eyebrow })` for the tab screens, as the artboard headers: title (and eyebrow when the artboard shows one), the bell `IconButton` (`bell`, label "Notifications, N new" or "Notifications") with a 7px `cyan` dot when there are unseen items, and the account button (your `Avatar` with `isMe`, label "Account") that opens the More tab. The bell opens a `FormModal` sheet titled "Notifications" listing `myFineNotifications` for `currentEmployee.name` over `fines` and `standupFines` from `useApp()`, honouring the person's `late_fine_excluded` / `standup_fine_excluded` flags, rows as the web bell (icon, "Late fine · Rs. N" + Paid/Unpaid pill, or "Standup contribution" + Complete/Pending pill, date in mono); opening it stores the seen time in AsyncStorage key `heubert-notifications-seen` (errors ignored); a row goes to the Fines tab; empty text "Nothing new. Fines recorded against you in the last 30 days show here."
- [ ] Step 4: Hermes (the phone's engine) may not parse Supabase timestamps with six fraction digits (`2026-10-15T05:00:00.123456+00:00`), which would date a fine at midnight and miss it as new in the bell. Test-first in `src/lib/mobileNotifications.test.mjs`: with `Date.parse` stubbed to return `NaN` for more than three fraction digits (restore it after), `myFineNotifications` from `mobile/lib/notifications.js` still gives the exact `at`; then trim the fraction to three digits before parsing in the mobile copy only (the web runs in browsers that parse it; parity with the web module stays green).
- [ ] Step 5: `isGooglePhotoUrl` needs the standards `URL` from `react-native-url-polyfill`, installed by `mobile/lib/supabase.js` at start-up; make sure every `Avatar` path imports through `AppContext` (which loads it) and say so in a comment.
- [ ] Step 6: `npm test`; `npm run lint`; the bundle check; fingerprint unchanged (Task 1 Step 6 command).

## Task 5: Home
**Delivers:** acceptance criteria 6, 13 (Home), 3 (Send wish orange), 4, 8.
**Files:** modify `mobile/app/(tabs)/index.js`.
**Kind:** judgement. **Design:** `MobileDashboard.dc.html`.

- [ ] Step 1: follow "Every screen task". Today the screen has: the attendance card linking to `/attendance` (`index.js:21-85`), the KPI `StatCard`s (`:87-97`, `:393-397`), Pending Standups, Upcoming Leaves, Upcoming Holidays, Celebrations with Send wish (`fetch …/api/send-wish`, `:236`), Fines by Employee with its own season choice (`selectedFineSeasonId`, `:131`, `:209-216`), `EventBanner` and `NewFiscalYearBanner`. All stay.
- [ ] Step 2: rebuild in the artboard's order: `TopBar` with the greeting ("Hi, <first name>") and its eyebrow; the announcement banner card (`EventBanner` / `NewFiscalYearBanner` restyled here as one calm glass card with an icon tile, no emoji, as the artboard's "Announcement"); "Key figures" tiles (2-column, glass, label eyebrow, mono value, a coloured dot instead of the old 3px top border and emoji); the attendance card as the artboard draws it; Pending standups (rows with `Avatar`, name, date in mono, amber "Pending" pill); Fines by employee (the artboard's bars: paid `primary`, unpaid `unpaid`, legend, season chip row); Upcoming leaves (cyan pills), Upcoming holidays (date tiles), Celebrations (icon tile `cake`/`award`, orange "Send wish" button only for today's).
- [ ] Step 3: verify as "Every screen task" 6.

## Task 6: Attendance
**Delivers:** acceptance criteria 6, 13 (check-in/out), 4.
**Files:** modify `mobile/app/(tabs)/attendance.js` (and only styling in components it renders; `mobile/lib/attendance.js` logic unchanged).
**Kind:** judgement. **Design:** `MobileAttendance.dc.html`.

- [ ] Step 1: follow "Every screen task". Check-in/out keeps its location and biometric checks (`expo-location`, `expo-local-authentication`) and their messages exactly.
- [ ] Step 2: `ScreenHeader` "Attendance" with Back to Home; "Today's Attendance" card with the live clock (mono), the check-in / check-out state the artboard draws (done states with time), the location result only after a punch; "My History" list (date mono, in/out times, status pills).
- [ ] Step 3: verify.

## Task 7: Fines, record fine, withdrawals
**Delivers:** acceptance criteria 5, 6, 13 (fines, standup fines, seasons, withdrawals), 4.
**Files:** modify `mobile/app/(tabs)/fines.js`, `mobile/app/withdrawals.js`, `mobile/components/AddFineModal.js`, `EditFineModal.js`, `AddFineSeasonModal.js`, `EditFineSeasonModal.js`, `AddStandupFineModal.js`, `EditStandupModal.js`.
**Kind:** judgement. **Design:** `MobileFines.dc.html`, `MobileRecordFine.dc.html`, `MobileWithdrawals.dc.html`.

- [ ] Step 1: follow "Every screen task". Today: the Late / Standup switch (`tab`, `fines.js:83`), search, status filter, season choice with add/edit season, add/edit/delete fines and standup records, toggling paid; withdrawals list and add/delete.
- [ ] Step 2: Fines: `TopBar` "Fines"; "Fine type" segmented control; "Fine seasons" chip row; "Season summary" tiles (mono amounts); search field; status filter chips; "Fine Records" rows (`Avatar`, name, date mono, amount mono, Paid green / Unpaid amber pill, edit and delete `IconButton`s labelled "Edit <name> fine on <date>" / "Delete …" as the artboard); the primary "Record fine" action where the artboard puts it (admins only, as today).
- [ ] Step 3: the record and edit sheets as `MobileRecordFine.dc.html` (employee picker, date field, amount with the quick-amount chips, actions); season and standup sheets in the same style.
- [ ] Step 4: Withdrawals: `ScreenHeader` "Withdrawals"; "Fine jar" card with the collected-versus-withdrawn bar and its label; "History" rows; add/delete as today.
- [ ] Step 5: verify.

## Task 8: Leaves, record leave, leave settings
**Delivers:** acceptance criteria 5, 6, 13 (leaves, seasons, holidays, leave types), 4.
**Files:** modify `mobile/app/(tabs)/leaves.js`, `mobile/components/LeaveCalendar.js`, `mobile/app/leave-settings.js`, `mobile/components/AddLeaveModal.js`, `EditLeaveModal.js`, `AddLeaveSeasonModal.js`, `EditLeaveSeasonModal.js`, `AddPublicHolidayModal.js`, `LeaveTypeFormModal.js`.
**Kind:** judgement. **Design:** `MobileLeaves.dc.html`, `MobileRecordLeave.dc.html`, `MobileLeaveSettings.dc.html`.

- [ ] Step 1: follow "Every screen task". Today: employee filter, leave seasons with add/edit, the month calendar with previous/next, my balance, upcoming leaves, the per-employee summary, public holidays with add/delete, record/edit/delete leave (including half days), leave types in Leave Settings.
- [ ] Step 2: Leaves in the artboard's order ("October 2026" calendar card with BS dates as today, "My balance", "Upcoming leaves", "Leave summary by employee", "Public holidays"); leave days `cyan`, holidays grey, as the web Leaves; the employee filter and the season chips.
- [ ] Step 3: the record/edit leave sheet as `MobileRecordLeave.dc.html` (type chips, date range, the "Half day segment" control, reason); the season, holiday and leave-type sheets in the same style; Leave Settings as `MobileLeaveSettings.dc.html` ("New leave type" form card, "Leave types" list).
- [ ] Step 4: verify.

## Task 9: Team and employee
**Delivers:** acceptance criteria 6, 12 (avatars on these screens), 13 (search, filter, add/edit/delete employee).
**Files:** modify `mobile/app/(tabs)/team.js`, `mobile/components/EmployeeDetailModal.js`, `mobile/components/AddEmployeeModal.js`, `mobile/components/EditEmployeeModal.js`.
**Kind:** judgement. **Design:** `MobileTeam.dc.html`, `MobileEmployee.dc.html`.

- [ ] Step 1: follow "Every screen task".
- [ ] Step 2: Team: `TopBar` "Team" with "Add employee" (admins, as today); search; status filter chips; "Employee directory" rows (`Avatar`, name, email, status pill).
- [ ] Step 3: the employee detail keeps opening the way it does today but fills the screen like `MobileEmployee.dc.html`: Back, the profile header (large `Avatar`, name, email action), "Details", "Leave balances", "Fines" (paid/unpaid summary), "Recent records", "Admin actions" (edit/delete as today, admins only).
- [ ] Step 4: the add/edit employee sheets in the sheet style; verify.

## Task 10: More and settings
**Delivers:** acceptance criteria 6, 9 (theme switch), 11 (Animations switch), 13 (settings actions).
**Files:** modify `mobile/app/(tabs)/more.js`, `mobile/app/settings.js`.
**Kind:** judgement. **Design:** `MobileMore.dc.html`, `MobileSettings.dc.html`.

- [ ] Step 1: follow "Every screen task". More today lists Word of the Day, Events, Planning Poker, Retrospective, Projects, Team Memories, Meeting Mode, Withdrawals, Settings and (admins) Leave Settings with emoji (`more.js:8-20`): same destinations, line icons from the artboard instead of emoji.
- [ ] Step 2: More as the artboard ("Your profile" card with your `Avatar`, then the grouped link rows with icon tiles and chevrons; Meeting Mode's tile orange as a people moment if the artboard does so). Settings as the artboard: "Account" (who you are, sign out), "Preferences" (theme Dark/Light segmented, Animations switch), "Admin · Office location" (as today, admins only), "About" (version as today).
- [ ] Step 3: verify.

## Task 11: Meeting mode
**Delivers:** acceptance criteria 6, 13 (meeting actions), 3.
**Files:** modify `mobile/app/meeting.js`.
**Kind:** judgement. **Design:** `MobileMeeting.dc.html`.

- [ ] Step 1: follow "Every screen task".
- [ ] Step 2: `ScreenHeader` "Meeting mode" with the clock; "Quick actions"; "Standup status" with the submitted count; "On leave today"; "Today's late fines"; "Word of the meeting" with its edit/delete control — every action as today.
- [ ] Step 3: verify.

## Task 12: Planning poker
**Delivers:** acceptance criteria 6, 13 (create/join, vote, reveal, new round, share).
**Files:** modify `mobile/app/planning-poker.js`.
**Kind:** judgement. **Design:** `MobilePoker.dc.html`.

- [ ] Step 1: follow "Every screen task".
- [ ] Step 2: `ScreenHeader` "Planning poker" with share; the story card; "Participants" (`Avatar`s with voted state); "Pick a card" deck (selected card `primary`); "Results" (average, nearest card, votes per card bars as on the web Poker); copy session ID; the poker-to-task copy row the artboard shows only if the app already has it.
- [ ] Step 3: verify.

## Task 13: Retrospective
**Delivers:** acceptance criteria 6, 8 (reactions keep their emoji), 13 (cards, votes, reactions, timer, action items, share).
**Files:** modify `mobile/app/retrospective.js`.
**Kind:** judgement. **Design:** `MobileRetro.dc.html`.

- [ ] Step 1: follow "Every screen task". Votes are the 👍 reaction, counted the way the web app now counts them (`src/lib/retroBoardRules.js` `voteCount`): if this screen ranks or totals votes, it counts 👍 only; theme totals, if shown, count every reaction.
- [ ] Step 2: `ScreenHeader` "Retrospective" with share; the board card (title, time left, people on the board); "Columns" as the artboard (column tone strips, cards with thumbs-up vote and reactions, "Add a reaction", edit/delete your card, "Add card"); "Action items".
- [ ] Step 3: verify.

## Task 14: Words and events
**Delivers:** acceptance criteria 5, 6, 13 (words, seasons, events, holidays).
**Files:** modify `mobile/app/words.js`, `mobile/app/events.js`, `mobile/components/AddWordModal.js`, `EditWordModal.js`, `AddWordSeasonModal.js`, `EditWordSeasonModal.js`, `AddCompanyEventModal.js`, `EditCompanyEventModal.js`.
**Kind:** judgement. **Design:** `MobileWords.dc.html`, `MobileEvents.dc.html`.

- [ ] Step 1: follow "Every screen task".
- [ ] Step 2: Words: `ScreenHeader` "Word of the Day" with "Manage seasons"; season chips; today's word card (word in Space Grotesk, meaning, author `Avatar`, edit/delete); "Earlier this season" list; "Add Word". Events: `ScreenHeader` "Events"; "Company events" (date tile, title, edit as today); "Public holidays".
- [ ] Step 3: the word, season and event sheets in the sheet style; verify.

## Task 15: Projects and memories
**Delivers:** acceptance criteria 5, 6, 13 (projects CRUD with links, environments, members; memories add/view/delete).
**Files:** modify `mobile/app/projects.js`, `mobile/app/memories.js`, `mobile/components/ProjectFormModal.js`, `mobile/components/AddMemoryModal.js`.
**Kind:** judgement. **Design:** `MobileProjects.dc.html`, `MobileMemories.dc.html`.

- [ ] Step 1: follow "Every screen task".
- [ ] Step 2: Projects: `ScreenHeader` "Projects"; status filter chips; project cards that expand ("Collapse <name>"), team `Avatar` stack with "+N", "Environments", "Links", delete for admins as today. Memories: `ScreenHeader` "Team Memories"; the filter control only for what the app can filter today; the masonry-like two-column grid of memory cards; "Add Memory" (the app's own wording stays if it differs).
- [ ] Step 3: the project and memory sheets in the sheet style; verify.

## Task 16: Sign-in, loader, banners and small parts
**Delivers:** acceptance criteria 6 (Login), 8, 11 (loader and banners still when motion is off).
**Files:** modify `mobile/app/login.js`, `mobile/components/HumanLoader.js`, `mobile/components/EventBanner.js`, `mobile/components/NewFiscalYearBanner.js`, `mobile/components/UpdateBanner.js`, `mobile/components/Skeleton.js`, `mobile/components/DateField.js`.
**Kind:** judgement. **Design:** `MobileLogin.dc.html`; `Splash.dc.html` (the web loader card: logo, "Heubert Tracker / team.heubert", the teammate in a raised disc with a cyan ring, a blue-to-cyan progress strip, the mono "LOADING YOUR WORKSPACE" caption; with motion off no teammate and a still bar at 40%).

- [ ] Step 1: follow "Every screen task". Google sign-in (`mobile/lib/googleSignIn.js`) and its error messages unchanged.
- [ ] Step 2: Login as the artboard (logo, title, the Google button, footnote "Use the Google account your team registered", as the web footnote now says). The loader as the Splash card, sized for a phone. `EventBanner`/`NewFiscalYearBanner`: the calm glass banner of Task 5 (festival art only with motion allowed). `UpdateBanner`: a glass strip with a primary "Restart" action. `Skeleton`: `raised` blocks, shimmer only with motion allowed. `DateField`: the `TextField` look.
- [ ] Step 3: motion: these components read `animationsEnabled` from `useApp()` and `AccessibilityInfo.isReduceMotionEnabled()` (with its change listener); either one off means no animation. The native splash (`expo-splash-screen` in `app.config.js`) is not touched (fingerprint).
- [ ] Step 4: verify.

## Task 17: Sweep and delivery checks
**Delivers:** acceptance criteria 8, 9, 10, 11, 14, 15; edge cases "long names", "content under the bars".
**Files:** any `mobile/` file the sweep finds; `mobile/lib/theme.js` (aliases).
**Kind:** judgement.

- [ ] Step 1: emoji sweep: `grep -rnP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B50}]' mobile/app mobile/components mobile/lib` — every hit in a tab, heading, button, badge, label, empty state or alert title becomes an icon or plain text; allowed to stay: people's own text, the retro reaction set, data constants not rendered.
- [ ] Step 2: replace every remaining use of the old theme names (`bg`, `bgElevated`, `bgInput`, `card`, `border`, `textPrimary`, `textSecondary`, `textMuted`, `accent*`) with the token names, then delete the aliases from `mobile/lib/theme.js`.
- [ ] Step 3: light theme walk of every screen; long names truncate; chip rows scroll sideways; nothing scrolls under the tab bar unreadably.
- [ ] Step 4: `npm test` (all pass), `npm run lint` (report the total), export bundle (`npx expo export --platform android --output-dir dist` and `--platform ios`), fingerprints for both platforms equal the baseline, and `git diff mobile/package.json` shows only `expo-font` and the three `@expo-google-fonts/*` packages added.

## Criteria coverage
| Criterion | Task | Test that proves it |
| --- | --- | --- |
| 1 Glass on ink and aurora | 3, 4 | Not automatable: how a screen looks; smoke test |
| 2 Fonts | 1 | `src/lib/mobileTokens.test.mjs` (font names) · smoke test for rendering |
| 3 Button colours, orange only for people | 3 | Not automatable: how it looks; smoke test |
| 4 Pill set | 3 | `src/lib/mobileTokens.test.mjs` (pill tokens equal the web set) · smoke test |
| 5 Glass sheets | 3, 7–15 | Not automatable: how it looks; smoke test |
| 6 Each screen matches its artboard | 5–16 | Not automatable: side-by-side comparison; smoke test |
| 7 Tab bar | 4 | Not automatable: how it looks; smoke test |
| 8 No emoji in chrome | 17 | The Task 17 grep, output in the report · smoke test |
| 9 Light theme | 1, 17 | `src/lib/mobileTokens.test.mjs` (light tokens) · smoke test |
| 10 Contrast | 1 | `src/lib/mobileTokens.test.mjs` with `src/lib/contrast.test.mjs` |
| 11 Motion off | 3, 16 | Not automatable: device setting; smoke test |
| 12 Photos | 2, 4 | `src/lib/mobileAvatar.test.mjs` (rules) · smoke test (fetch and fallback) |
| 13 Behaviour unchanged | 5–16 | Not automatable: Supabase and device actions; smoke test |
| 14 Fingerprint unchanged | 1, 17 | `npx expo-updates fingerprint:generate` output equals the recorded hashes |
| 15 No native module | 1, 17 | `git diff mobile/package.json` · the fingerprint |
