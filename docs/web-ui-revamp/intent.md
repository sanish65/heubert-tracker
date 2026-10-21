---
title: Restyle the web app to the new Heubert Tracker design
author: Sanish
requested by: Sanish
---

# Restyle the web app to the new Heubert Tracker design
_Intent written 2026-10-19 with Sanish. Agreed in conversation against the design canvas "Heubert Tracker Revamp" (https://claude.ai/artifact/568KVxYWAVQ5rzXtPRYn5a)._

## Problem
The web app's look has grown screen by screen: an emoji tab row that no longer fits eleven tabs, gradient title text, emoji in headings, buttons and badges, and per-screen colours that drift between tabs (see `src/app/globals.css`, ~9.7k lines, and the tab row in `src/app/page.js`). It reads as a collection of pages rather than one product, and the navigation does not scale as tabs are added (Tasks is the latest). A first attempt on the organisation's default design system made it look like the office's Apply IMS CRM; Sanish wants Heubert Tracker to keep its own identity.

## Proposed outcome
Every screen of the web app looks like the design canvas: one recognisable Heubert Tracker identity (navy ink, frosted-glass panels over a soft aurora, electric blue for actions, a cyan signal for live state, orange for people moments, Space Grotesk / IBM Plex Sans / JetBrains Mono, line icons), a left sidebar that holds every section without crowding, and the same behaviour and data as today. A teammate moving between any two screens sees the same header, cards, buttons, pills, tables and dialogs.

## Affected users and systems
- All signed-in employees; admins and fine admins see their extra controls in the same style.
- Surfaces: the main app at `/` (every tab), `/meeting`, `/login`, `/planning-poker/[sessionId]`, `/retrospective/[sessionId]`, the standalone Memories view, and every modal.
- Variants: dark theme (default) and light theme; desktop widths and phone-width browsers.
- Decision owner: Sanish.

## Scope
- Web app only (Next.js app in `src/`), both themes, desktop and phone-width browser.
- All 19 canvas screens: Dashboard, Tasks, Record Fine dialog (and every other modal in the same style), Late Fines, Standup Fines, Leaves, Attendance, Retrospective, Planning Poker, Daily Sync meeting, Words, Events, Employees, Projects, Settings, Memories, Login, plus the shared sidebar and top bar, and the Foundations rules.

## User stories
1. As a teammate, I want one consistent navigation so that I can reach any section from any screen without hunting through a crowded tab row.
2. As a teammate, I want every screen to share the same look so that the tracker feels like one product.
3. As a teammate, I want to choose dark or light and have both look finished so that I can use it in any room, including on the meeting TV.
4. As an admin, I want my admin-only actions to appear in the same places and style as everyone else's controls so that nothing feels bolted on.
5. As a teammate on my phone's browser, I want the web app to stay usable at phone width so that I can check it away from my desk.

## Acceptance criteria

**Story 1 — navigation**
1. Given a signed-in user on any tab of `/`, When the page loads at desktop width, Then a left sidebar lists Dashboard; Late Fines, Standup Fines, Leaves, Attendance; Tasks, Planning Poker, Retrospective, Words, Events; and Employees plus (for admins) Projects and Settings, grouped under Overview / Records / Team / Admin, with Memories and Log Out at its foot.
2. Given a user on any tab of `/`, When they look at the sidebar, Then the current section is marked (highlighted row plus cyan indicator) and no other row is.
3. Given a user on any tab of `/`, When they click a sidebar row, Then that section opens, as the tab row does today, and the choice is still remembered across reloads.
4. Given a non-admin user on `/`, When the sidebar renders, Then Projects and Settings are not shown, and Employees still is, as the Employees tab is today. _(Corrected 2026-10-19 during planning: the first wording hid Employees, which today every user can open.)_
5. Given any tab of `/`, When the page loads, Then a top bar shows search, an orange "Start Meeting" link to `/meeting`, notifications, a theme switch and the user's avatar and first name, and the old emoji tab row is gone.
6. Given a phone-width browser on `/`, When the page loads, Then the sidebar no longer sits beside the content (it collapses or stacks), the content uses the full width, and no screen scrolls sideways except inside wide tables.

**Story 2 — one look**
7. Given any screen in scope, dark theme, When it renders, Then its page background is the navy ink with the aurora behind it, and its panels, cards, sidebar, top bar and dialogs are frosted glass (translucent fill, background blur, hairline edge) as on the canvas.
8. Given any screen in scope, When it renders, Then headings use Space Grotesk, body text IBM Plex Sans, and dates, amounts, IDs and small labels JetBrains Mono.
9. Given any screen in scope, When it renders, Then navigation, headings, buttons and badges carry line icons or no icon, and no emoji. Emoji that people type themselves (retro cards, comments, words) still show.
10. Given any screen in scope, When it shows a primary action, Then that button is electric blue (#3D63F0) with white text; secondary actions are glass buttons; orange is used only for Start Meeting, celebrations/wishes and the current user's avatar.
11. Given any screen in scope, When it shows a status, Then it uses the canvas pill set (paid/green, unpaid-pending/amber, overdue-error/red, leave/cyan, priority/blue, review/violet, low/grey), never ad-hoc colours.
12. Given any modal in the app, When it opens, Then it appears as a glass dialog over a blurred, dimmed backdrop, with a title, a close button and its actions at the bottom right, as in the canvas Record Fine dialog.
13. Given each of the 19 canvas screens, When compared side by side with its canvas artboard (same theme), Then layout order, grouping, colours, type and controls match, apart from sample data and the items listed under Out of scope.

**Story 3 — themes**
14. Given the theme switch in the top bar or Settings, When the user picks light, Then every screen in scope shows the canvas light theme (pale ink, white glass, deep pill text) and the choice persists across reloads.
15. Given either theme, When any text or pill is shown, Then it meets 4.5:1 contrast against what is behind it (3:1 for text 24px and larger).
16. Given the Animations preference is off, or the OS asks for reduced motion, When any screen renders, Then card lift, festival scenes and other decorative motion do not play.

**Story 4 — admin controls**
17. Given an admin or fine admin on any screen, When their extra actions show (Record Fine, New Season, Add Employee, edit/delete), Then they use the same button, icon-button and placement styles as the rest of the screen.
18. Given an admin, When they open Settings, Then roles, list visibility, leave types and preferences appear as one Settings screen grouped as on the canvas, reachable from the sidebar.

**Story 5 — behaviour unchanged**
19. Given any screen in scope, When a user performs any action that works today (recording, editing, deleting, voting, filtering, seasons, check-in, sending wishes), Then it still works with the same result and data.
20. Given the existing unit tests, When `npm test` runs, Then they pass.

## Edge cases
- Browsers without backdrop blur (criterion 7): panels fall back to a more opaque fill so text stays readable. Source: Foundations sheet.
- Long names, long amounts and many seasons (criteria 1, 13): truncate with ellipsis or wrap; chips scroll sideways. Source: canvas.
- The meeting page on a large TV (criteria 7, 13): no sidebar, larger type, readable from a distance. Source: canvas Daily Sync.
- `<select>` option lists in both themes (criterion 15): readable in each theme via the single global option rule, never per-class fixes. Source: project memory / `globals.css`.
- Users who are both fine admin and excluded from lists (criterion 4): sidebar shows what their role allows. Source: code (`PrivilegeSettingsPage`).
- Festival banners (Dashain, Tihar, new fiscal year) (criterion 9, 16): one calm banner card; their animations obey criterion 16. Source: canvas Dashboard.

## Constraints
- Same stack and conventions: JavaScript only, plain CSS in `globals.css` (no Tailwind or CSS-in-JS), data through `AppContext`, Next.js 16 as installed (read `node_modules/next/dist/docs/` before Next-specific code).
- Built on branch `kanban-tracker` on top of the uncommitted Kanban (Tasks) work, which must keep working and stay visible in the working tree.
- Fonts from Google Fonts; icons as inline SVG (no new icon package unless agreed).
- No change to data, API routes or the database.

## Out of scope
- The Expo mobile app (`mobile/`); its canvas screens are a separate piece of work after this, needing `expo-blur`.
- New data or features the canvas shows but the app does not have: an arrival-time column on fines, description and location on company events, separate phonetic/word-type and language-tagged translations on words, the Planning Poker story queue and consensus/spread figures, retro participant avatars, the Employees sort control and Memories year/event filters. Each would be its own feature if wanted.
- Copy renames shown on the canvas ("Reveal votes", "Group into themes", "Back to Dashboard", "Add Memory"): the app keeps its current wording unless Sanish says otherwise (see open questions).
- Search in the top bar beyond a visual field, unless already backed by existing behaviour (see open questions).

## Dependencies
- The Kanban (Tasks) work in progress on `kanban-tracker`.
- The design canvas as the visual source of truth.

## Open questions
1. Should the top-bar search actually search (people, fines, tasks), or ship as a visual placeholder for now? Owner: Sanish. Blocks: no (treated as visual-only until answered).
   _2026-10-20, smoke round 1 (Sanish: "fix them too"): it searches. A person opens their details, a fine row opens that person's Late or Standup Fines, a task opens its issue; Ctrl+K focuses it._
2. Keep the app's current wording or take the canvas wording ("Publish Results" vs "Reveal votes", "Group similar cards" vs "Group into themes", "Back to Tracker"/"Share a Memory" vs "Back to Dashboard"/"Add Memory")? Owner: Sanish. Blocks: no (current wording kept until answered).
   _2026-10-20, smoke round 1 (Sanish: "fix them too"): the app's wording stays; the meeting page's "End Meeting" went back to "Exit Meeting"._
3. On phone-width browsers, should the sidebar collapse into a menu button or stack above the content? Owner: Sanish. Blocks: no (menu button assumed).
   _2026-10-20, smoke round 1 (Sanish: "fix them too"): kept as built, a menu button opening a drawer._
4. Should the notifications bell open anything today, or stay a visual element? Owner: Sanish. Blocks: no.
   _2026-10-20, smoke round 1 (Sanish: "fix them too"): it lists the fines recorded against you in the last 30 days, with a cyan dot for new ones; a row opens that list on the fine's season._
