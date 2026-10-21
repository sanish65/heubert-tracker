**Smoke test — web-ui-revamp** · local dev · `http://localhost:3000`

**Before you start**
- `source ~/.nvm/nvm.sh && nvm use 22 && npm run dev`
- Sign in with an admin account; have a non-admin account (or a second browser profile) for steps 2 and 11
- Keep `docs/web-ui-revamp/design/*.dc.html` (or the canvas) open to compare
- Dark theme first; step 19 repeats the key screens in light

**1 · Shell and navigation** — AC 1, 2, 3, 5
```
Go to   /
Do      click every sidebar row · reload on Leaves · open the account menu · click the sun/moon button
See     four groups (Overview / Records / Team / Admin), one row highlighted with a cyan dot, Leaves still open after reload, top bar with search · orange Start Meeting · bell · theme · avatar; no emoji tab row, header or footer
Also    Start Meeting opens /meeting; Memories and What's new open from the sidebar foot
```

**2 · Non-admin view** — AC 4
```
Go to   / as a non-admin
Do      look at the Admin group · set localStorage heubert-active-tab to "settings" and reload
See     Employees is there, Projects and Settings are not; the page opens on Dashboard
```

**3 · Screen widths** — AC 6, 13
```
Go to   any tab at 390px wide (devtools device mode), then 768px, then a full-screen window (1920px or wider)
Do      open the menu button · pick a section · scroll each screen sideways · full screen: walk every tab, fullscreen Poker and Retro, /planning-poker/<id>
See     narrow: sidebar is a drawer over a dim scrim, closes on pick, page never scrolls sideways (only tables/boards in their cards); full screen: content fills the width beside the sidebar, no empty band on the right, Tasks columns stretch
```

**4 · The look** — AC 7, 8, 10, 11
```
Go to   Dashboard
Do      look at panels, headings, buttons and pills
See     navy ink with a soft aurora blurred behind frosted panels; headings Space Grotesk, body IBM Plex Sans, dates/amounts mono; primary buttons solid blue, secondary glass, orange only on Start Meeting / Send Wish / your avatar; pills green paid · amber unpaid/pending · red overdue · cyan leave
```

**5 · Dashboard** — AC 13, 19
```
Go to   Dashboard
Do      change the fines season select · hover a KPI tile · Send Wish if someone has a birthday today
See     matches Main.dc.html: banner card, five KPI tiles, fines chart, On-time champion, pending standups, leaves/holidays/celebrations
```

**6 · Late Fines** — AC 13, 17, 19
```
Go to   Late Fines
Do      switch seasons (incl. Pre Fiscal Year Fines) · search · Unpaid/Paid filter · Record Fine (click Rs. 25 and Rs. 50 chips) · toggle it paid and back · edit · delete · Withdraw a test amount then delete it
See     matches LateFines.dc.html; the amount chips no longer throw (bug fixed in this work); records list BS dates
```

**7 · Standup Fines and the form** — AC 13, 19
```
Go to   Standup Fines, then the standup form (floating button, 9:00–9:30 NPT only)
Do      filter · search · settle and unsettle a record (thanks card appears) · edit · delete
See     matches StandupFines.dc.html; the floating button sits bottom-right, clear of the sidebar
```

**8 · Leaves** — AC 13, 19
```
Go to   Leaves
Do      switch seasons · move months · toggle नेपाली · filter an employee · record, edit and delete a test leave · add and delete a test holiday
See     matches Leaves.dc.html; BS numbers under each day (Oct 17 2026 = 1 Kartik 2083)
```

**9 · Attendance** — AC 13, 17, 19
```
Go to   Attendance
Do      check in/out on a test account · switch employee and month · toggle नेपाली · flip an office/WFH flag and back · save office settings unchanged
See     matches Attendance.dc.html; the location pill appears only after a punch (no location request on page open)
```

**10 · Tasks (Kanban)** — AC 13, 19
```
Go to   Tasks
Do      create an issue · drag it across columns · open it, comment, change priority · search, "Only my issues", type chips · backlog and reports · open a #issue= link · press c and /
See     glass columns, cards with mono key, priority pill, avatar; everything works as before
```

**11 · Planning Poker** — AC 13, 19
```
Go to   Planning Poker, then the session link in a second profile
Do      create · join · vote and change vote · Publish Results · New Round · go fullscreen and End Session · Copy and QR
See     matches Poker.dc.html; the End Session confirm opens ABOVE the fullscreen view; results show average, nearest card and votes-per-card bars
```

**12 · Retrospective** — AC 13, 19
```
Go to   Retrospective
Do      create a Standard board · add cards · vote (thumbs-up) and react · Group similar cards, rename, move and ungroup a theme · timer · kudos · action item · Top Voted · open a Sailboat board · /retrospective/<id> · Exit, then End Session
See     matches Retro.dc.html; a card with reactions but no 👍 is not in Top Voted, and each Top Voted count equals the card's thumbs-up; Exit and End Session go back to the retro home with no error
```

**13 · Daily Sync** — AC 13, 19
```
Go to   /meeting at 1920px wide, both themes
Do      watch the clock · move days · project pills · Enlarge/Minimize · Add fine from Missing submissions then delete it · quick-add a leave then delete it · Exit Meeting
See     matches Meeting.dc.html; dialogs from the enlarged view open above it; the top bar has Meeting Link and one orange Exit Meeting, which returns to the tracker
```

**14 · Words and Events** — AC 13, 19
```
Go to   Words, then Events
Do      switch word seasons · search/sort/Show more · add, edit, delete a test word · add, edit, delete a test event
See     matches Words.dc.html and Events.dc.html
```

**15 · Employees and Projects** — AC 13, 17, 19
```
Go to   Employees, then Projects
Do      search, status filter, open a detail (click and keyboard), add/edit/delete a test employee · filter projects, pick a card, create/edit/delete a test project with a link, an environment and two members
See     matches the artboards; Projects shows a details panel beside the grid
```

**16 · Settings** — AC 14, 18
```
Go to   Settings (admin)
Do      toggle a person on a list and back · try to remove your own admin flag · add/edit a leave type and revert · switch theme here · turn Animations off
See     one screen: Roles, List visibility, Leave types, Your preferences; own-admin removal still refused; the top bar's theme follows
```

**17 · Memories, Login, What's new** — AC 13, 19
```
Go to   Memories (sidebar foot) · sign out to /login · What's new
Do      open a photo · add, edit, delete a test memory · sign in with Google (and see One Tap) · /login?error=unauthorized
See     matches Memories.dc.html and Login.dc.html; Google's own button says "Continue with Google"; the footnote reads "Use the Google account your team registered"; no frame counter over the Memories animation
```

**18 · Dialogs everywhere** — AC 9, 12
```
Go to   every screen
Do      open each dialog (record/edit fine, seasons, standup fine, leave, holiday, event, word, memory, withdraw, attendance edit, QR, What's new, employee add/edit/detail, project form, task dialogs, a delete confirm)
See     glass panel over a blurred dim backdrop covering the whole window, title + close at top, actions bottom-right, no emoji; at 390px each opens as a bottom sheet
```

**19 · Light theme** — AC 14, 15
```
Go to   the top bar theme button → light; walk Dashboard, Late Fines, Leaves, Tasks, Retrospective, Settings, /meeting
Do      reload
See     pale ink, white glass, deep pill text, everything readable; light persists after reload
```

**20 · Animations off and reduced motion** — AC 16
```
Go to   Settings → Animations off; then OS "reduce motion" on with Animations on
Do      hover KPI tiles · look at the Dashain banner and a Sailboat retro board · move the mouse
See     no card lift, no banner/retro scenes, the aurora stops following the cursor
```

**21 · Top-bar search and the bell** — open questions 1, 4
```
Go to   / on any tab at desktop width, both themes
Do      Ctrl+K (⌘K) · type part of a name · Enter on a person, then on a "Late fines" row · type a task key (HTT-12), then a title word · arrows, Escape twice, outside click · on Tasks: open an issue from search, close it, search it again · open the bell, click a row
See     People / Fines / Tasks groups; a person opens Employees with their details; a fine row opens Late or Standup Fines filtered to them; a task opens its issue, the second time too; bell dot and "Notifications, N new" until opened; your fines from the last 30 days with Paid/Unpaid or Pending/Complete pills; a row opens Late Fines on that fine's season; no fines: the empty message
```

**22 · Loading splash** — AC 7, 16 (built in another session, heubert-tracker-38)
```
Go to   / with a hard reload (devtools network throttling helps), both themes
Do      watch it load and hand over to the app · Settings → Animations off (or OS reduce motion), reload
See     matches Splash.dc.html (canvas "Loading splash"; its toggles show light, slow, offline and animations off): one frosted card over the ink and aurora: logo, "Heubert Tracker / team.heubert", the teammate in a disc with a spinning cyan ring and a speech bubble, a blue→cyan progress strip, mono "LOADING YOUR WORKSPACE" with a cyan dot; it fades into the app; Animations off: no teammate, nothing moves, the bar holds at 40%
Also    slow or offline loading shows amber or red pills; in Dashain/Tihar the festive scene sits behind the same card
```

**23 · Profile photos** — Sanish's request, smoke round 1
```
Go to   Dashboard, Employees, Late and Standup Fines, Leaves, Tasks, Planning Poker, Retrospective, /meeting, Settings → Roles, Memories, Words; both themes
Do      sign in with Google · look at every person avatar · have a teammate who has signed in appear in a list · block lh3.googleusercontent.com in devtools and reload · curl -i http://localhost:3000/api/avatars
See     your photo in the top bar and in lists, ringed in orange; teammates who have signed in show their photo, the rest keep coloured initials; with the host blocked every avatar falls back to initials; the curl (no token) gets 401
```

**24 · Team Calendar** — not part of this intent; built in another session (heubert-tracker-38), same working tree
```
Go to   Calendar in the sidebar (Team group, after Tasks)
Do      Day / Week switch · arrows · Busy-only switch · People filter
See     without the Google env vars: a "not connected yet" notice plus the leaves and holidays rows; setup in docs/team-calendar/setup.md
```

**No need to click** — AC 4 (`src/lib/navigation.test.mjs`), AC 10, 11, 15 (`src/lib/contrast.test.mjs`, both themes), AC 3 routing of old settings tabs (`navigation.test.mjs`), dialog stacking order (`src/lib/stacking.test.mjs`), retro votes (`src/lib/retroBoardRules.test.mjs`), search matching (`src/lib/globalSearch.test.mjs`), the bell's list and new count (`src/lib/notifications.test.mjs`), which photos count and whose they are (`src/lib/avatar.test.mjs`), AC 20 (`npm test`: 134 pass) · under test.

**Decided in smoke round 1** — Sanish: "fix them too"
1. Retrospective Exit / End Session: the leftover `setPromotedCardIds` call is gone (step 12).
2. Memories animation: the TEMP DEBUG frame counter is removed (step 17).
3. Retro votes: a vote is a 👍 everywhere; Top Voted and the card order rank by votes, theme totals still count every reaction (`src/lib/retroBoardRules.test.mjs`, step 12).
4. Daily Sync: one exit, "Exit Meeting" as before (no duplicate Back to Tracker); the per-person Add fine stays, since it only pre-fills the existing standup fine dialog for fine admins (step 13).
5. Login footnote: "Use the Google account your team registered" (step 17).
6. Top-bar search and the bell now work (Task 21, step 21); wording stays the app's own; the phone sidebar stays a drawer.
7. Profile photos (Sanish: "can't it be shown instead of the avatar?"): every person avatar shows the Google photo once that person has signed in (Task 22, step 23). This adds the one read-only route the intent did not foresee, `GET /api/avatars`: signed-in active employees only, the sign-in rule; it returns names and Google-hosted photo URLs, never emails.

**Worth a glance** — photos load from `*.googleusercontent.com` with no referrer; a user-edited photo URL on any other host is ignored · `CapacityPage` (no entry point) keeps its own letter avatars · Tasks: a link to the issue already opened now re-opens it (`TasksPage.js`, your Kanban file) · task search matches titles with `ilike '%…%'`, no index: fine at office size, pg_trgm if it grows · search stays hidden below 900px, the bell does not; Ctrl+K does nothing while a dialog is open · the shared selection chips restyled for Projects also changed Tasks, Attendance and Settings · StatsCard (now glass tiles) also renders on Attendance · the "trip" vacation scene now shows only with Animations on · emoji left on purpose: the seeding success message in `AppContext.js` and the drawn vacation scene · `CapacityPage` (no entry point) untouched

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · tokens, fonts, contrast test | sonnet | 0m 49s | 27,461 | none |
| 2 · glass primitives, aurora, avatar | opus | 7m 27s | 86,182 | none |
| 3 · Icon component | haiku | 0m 52s | 30,228 | none |
| 4 · navigation model | haiku | 0m 32s | 19,059 | none |
| 5 · app shell | opus | 7m 26s | 115,581 | none |
| 6 · glass dialogs | opus | 10m 11s | 176,631 | none |
| 7 · Dashboard | opus | 6m 43s | 130,776 | none |
| 8 · Late Fines | opus | 7m 26s | 132,596 | none |
| 9 · Standup Fines + form | opus | 4m 42s | 101,908 | none |
| 10 · Leaves | opus | 10m 56s | 160,351 | none |
| 11 · Attendance | opus | 8m 44s | 136,760 | none |
| 11 · fix: no location read on open, leave cyan | opus | 0m 51s | 7,230 (143,990 agent total less the first pass) | none |
| 12 · Tasks restyle | opus | 9m 22s | 181,759 | none |
| 13 · Planning Poker | opus | 10m 15s | 183,046 | none |
| 14 · Retrospective | opus | 33m 7s | 465,554 | none |
| 15 · Daily Sync | opus | 36m 31s | 451,024 | none |
| 16 · Words + Events | opus | 21m 50s | 299,917 | none |
| 17 · Employees + Projects | opus | 37m 20s | 399,115 | none |
| 18 · Settings | opus | 28m 2s | 242,126 | none |
| 19 · Memories, Login, What's new | opus | 29m 5s | 269,809 | none |
| 20 · final sweep (dialog portal, stacking, motion) | opus | 52m 47s | 447,460 | none |
| 21 · top-bar search and the bell | opus | 30m 43s | 274,453 | none |
| 22 · Google profile photos as avatars | opus | 19m 36s | 232,104 | none |
| **Total** | | 6h 15m 17s | 4,571,130 | 0 (plan: no commits during execution) |
Tokens are the subagents' own; this session's context is not in them.
