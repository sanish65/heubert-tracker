---
title: Restyle the mobile app to the new Heubert Tracker design
author: Sanish
requested by: Sanish
---

# Restyle the mobile app to the new Heubert Tracker design
_Intent written 2026-10-20 with Sanish. Agreed in conversation against the mobile artboards of the design canvas "Heubert Tracker Revamp" (https://claude.ai/artifact/568KVxYWAVQ5rzXtPRYn5a), after the web revamp (docs/web-ui-revamp/intent.md) left the Expo app for this piece of work._

## Problem
The Expo app (`mobile/`) still wears the old look: its colours mirror the web app's previous tokens (`mobile/lib/theme.js`: `#0b0e14` ink, indigo-to-violet gradient buttons), its tab bar and headings use emoji (`mobile/app/(tabs)/_layout.js`, `mobile/app/(tabs)/index.js` "🕒 Pending Standups"), and it uses the system font. Now that the web app carries the new identity, a teammate who moves from the browser to the phone sees two different products.

## Proposed outcome
Every screen of the mobile app looks like its mobile artboard on the canvas: the same identity as the web app (navy ink with a soft aurora, translucent glass panels with a hairline edge, electric blue for actions, a cyan signal for live state, orange for people moments, Space Grotesk / IBM Plex Sans / JetBrains Mono, line icons), the canvas tab bar, and the same behaviour and data as today. The update reaches the phones that already have the app, without a reinstall.

## Affected users and systems
- Every employee using the mobile app on the `preview` channel (the only channel with installs, per the team's EAS setup); admins and fine admins see their extra controls in the same style.
- Surfaces: the five tabs (Home, Fines, Leaves, Team, More; Attendance opens from Home), the stacked screens (Meeting, Planning Poker, Retrospective, Words, Events, Projects, Memories, Settings, Leave Settings, Withdrawals, Login), every form sheet in `mobile/components/`, the loading screen.
- Variants: dark theme (default) and light theme; Android and iOS.
- Decision owner: Sanish.

## Scope
- `mobile/` only; both themes; Android and iOS.
- The 21 mobile artboards: Login, Home, Attendance, Fines, Record fine sheet, Withdrawals, Tab bar, More, Meeting mode, Planning poker, Retrospective, Words, Projects, Memories, Settings, Leave settings, Leaves, Record leave sheet, Team, Employee, Events; every other form sheet in the same style; the Foundations rules.

## User stories
1. As a teammate on my phone, I want the app to look like the web app so that the tracker feels like one product wherever I open it.
2. As a teammate, I want one clear tab bar and line icons so that I can find each section without decoding emoji.
3. As a teammate, I want dark and light to both look finished so that I can use the app in any light.
4. As a teammate, I want to see my colleagues' faces where their names appear so that I recognise people at a glance.
5. As a teammate, I want the new look to arrive as a normal update so that I do not have to reinstall the app.

## Acceptance criteria

**Story 1 — one look**
1. Given any mobile screen in scope, dark theme, When it renders, Then its background is the navy ink with the aurora gradient behind it, and its cards, sheets, tab bar and headers are translucent glass panels (translucent fill, hairline edge, top highlight) as on the canvas. No background blur is used (criterion 15); the Foundations fallback of a more opaque fill applies.
2. Given any mobile screen in scope, When it renders, Then headings use Space Grotesk, body text IBM Plex Sans, and dates, amounts, IDs and small labels JetBrains Mono.
3. Given any mobile screen in scope, When it shows a primary action, Then that button is electric blue (#3D63F0) with white text; secondary actions are glass buttons; orange is used only for Meeting, celebrations and wishes, and the current user's avatar.
4. Given any mobile screen in scope, When it shows a status, Then it uses the canvas pill set (paid green, unpaid or pending amber, overdue or error red, leave cyan, priority blue, review violet, low grey).
5. Given any form sheet in the app, When it opens, Then it is a glass bottom sheet with a title, a close icon button and its actions at the bottom, as the Record fine and Record leave artboards show.
6. Given each of the 21 mobile artboards, When compared side by side with its screen (same theme), Then layout order, grouping, colours, type and controls match, apart from sample data and the items under Out of scope.

**Story 2 — navigation and icons**
7. Given any tab screen, When it renders, Then the tab bar shows Home, Fines, Leaves, Team and More with line icons, the active tab marked as on the canvas tab bar, and no emoji.
8. Given any screen in scope, When it renders, Then tabs, headings, buttons, empty states and badges carry line icons or no icon, and no emoji; emoji that people type or pick (retro reactions, memories, words) still show.

**Story 3 — themes and motion**
9. Given the theme setting, When the user picks light, Then every screen in scope shows the canvas light theme (pale ink, white glass, deep pill text), and the choice persists as it does today.
10. Given either theme, When any text or pill is shown, Then it meets 4.5:1 contrast against what is behind it (3:1 for text 24px and larger).
11. Given the Animations preference is off, or the phone's reduce-motion setting is on, When any screen renders, Then decorative motion (aurora drift, card lift, loader animation, festival scenes) does not play.

**Story 4 — faces**
12. Given a person avatar on any screen, When that person has signed in with Google, Then it shows their Google profile photo (from the web app's `GET /api/avatars`, the same source the web app uses); otherwise, or when the photo fails to load, it shows the initials avatar; the current user's avatar keeps the orange mark.

**Story 5 — delivery and behaviour**
13. Given any action that works in the app today (sign-in, check-in/out, recording and editing fines, leaves, standups, words, events, memories, projects, settings, poker, retro), When a user performs it after the restyle, Then it works with the same result and data.
14. Given the restyled app, When the runtime fingerprint is generated (`npx expo-updates fingerprint:generate`), Then it equals the fingerprint before the work (Android `a00305e9e9c76cc7b869be15bd3175ce71caf44c`, iOS `e7def2ef915dd680d11d79dbd4a2b98ef4a4f1f1`, recorded 2026-10-20), so the restyle ships as an OTA update to the existing `preview` installs.
15. Given the restyle, When its dependencies are compared with today's, Then no native module is added (in particular no `expo-blur`); fonts arrive as JavaScript-side assets.

## Edge cases
- Phones without the Google fonts loaded yet (criterion 2): the system font shows until they load; nothing waits on them except the first paint behind the existing loader. Source: Expo font loading.
- Long names and amounts (criterion 6): truncate with ellipsis; chip rows scroll sideways. Source: canvas.
- Content scrolling under the tab bar and sticky headers (criterion 1): without blur, those bars use the more opaque glass fill so text behind never clashes. Source: Foundations fallback rule.
- People who never signed in, or a photo that fails (criterion 12): initials avatar. Source: the web photo work (docs/web-ui-revamp/smoke.md step 23).
- An existing install that receives the update (criterion 14): it must not need a native module it lacks. Source: `mobile/app.config.js` runtimeVersion policy "fingerprint".
- Festival banners (EventBanner, NewFiscalYearBanner) (criteria 8, 11): one calm banner card; motion obeys criterion 11. Source: canvas Home.

## Constraints
- Same stack: Expo SDK 57 with Expo Router, React Native 0.86, JavaScript only; data through `mobile/context/AppContext.js`; no new native modules (criterion 15).
- Built on branch `kanban-tracker` with the uncommitted web revamp and Kanban work in the tree; this work touches `mobile/` only (plus its docs), so it can be committed and reviewed on its own.
- Expo and EAS CLIs need Node 22 (`nvm use 22.20.0`).
- No change to data, the database or the web app's API routes; the mobile app may call the existing `GET /api/avatars`.
- Never publish an OTA update (`eas update`) or start an EAS build without Sanish's word: the `preview` channel has real users.

## Out of scope
- Real background blur (`expo-blur`): it is a native module, would change the runtime fingerprint and need a new build for every install; a later native release can add it inside the shared glass component.
- New data or features the artboards show but the app does not have (the same list as the web intent: fine arrival time, event description and location, word phonetic/type split, poker story queue and consensus figures, retro participant avatars beyond the current data, Memories year and event filters), unless the app already has the data.
- Copy renames the artboards show: the app keeps its current wording.
- Publishing the update or building a new binary (Sanish does that after review).

## Dependencies
- The web revamp's tokens (`src/app/globals.css` `@tokens` blocks) and photo route (`src/app/api/avatars/route.js`), both in the same working tree.
- A development build or the existing dev client on a phone, to try the work through Metro (`npx expo start --dev-client`).

## Open questions
1. Should a later native build add real blur through `expo-blur`? Owner: Sanish. Blocks: no (no blur in this work).
