**Smoke test — mobile-ui-revamp** · dev client on a phone · Metro on this machine

**Before you start**
- `cd mobile && source ~/.nvm/nvm.sh && nvm use 22.20.0 && npx expo start --dev-client`, then open it in the development build on your phone (the preview build can't load Metro)
- An admin/fine admin account and a non-admin one; dark theme first, then light (Settings → Preferences)
- Keep `docs/mobile-ui-revamp/design/Mobile*.dc.html` (or the canvas) open to compare
- Nothing is published: no `eas update` or build until you say so

**1 · Shell** — AC 1, 7
```
Go to   any tab
Do      switch the five tabs · open Attendance from Home
See     ink + still aurora, glass cards; tab bar Home/Fines/Leaves/Team/More with line icons, active pill and cyan dot; no tab bar on Attendance
```

**2 · Top bar, bell, photos** — AC 3, 12
```
Go to   Home
Do      open the bell · tap a row · tap your avatar
See     dot + "Notifications, N new" until opened; your last-30-day fines with BS dates; a row opens Fines; avatar opens More; Google photos where people signed in, initials otherwise; yours ringed orange
```

**3 · Home** — AC 6, 13
```
Go to   Home
Do      check in from the attendance card · switch fine seasons · Send wish on a celebration today
See     matches MobileDashboard: eyebrow with BS date, announcement card, key figures, standups, fines bars, leaves, holidays, celebrations
```

**4 · Attendance** — AC 6, 13
```
Go to   Home → attendance card
Do      check in, check out (location + biometric prompts)
See     matches MobileAttendance; clock with BS date; history rows "9:12 AM – 6:05 PM" with BS date and pills
```

**5 · Fines and withdrawals** — AC 4, 5, 6, 13
```
Go to   Fines, then More → Withdrawals
Do      Late/Standup switch · seasons (add, edit) · search · status filter · record, edit, delete, toggle paid · duplicate standup → Add Anyway · withdraw and delete
See     matches MobileFines / MobileRecordFine / MobileWithdrawals; glass sheets with title, round close, actions at the bottom; non-admin sees no record, season or edit controls
```

**6 · Leaves** — AC 5, 6, 13
```
Go to   Leaves, then More → Leave Settings (admin)
Do      months, tap a day · employee filter · record a half-day and a multi-day leave · insufficient balance (blocked, amber note) · add/delete a holiday · add/edit a leave type
See     matches MobileLeaves / MobileRecordLeave / MobileLeaveSettings; BS days under dates; header "Admin · N leave types"
```

**7 · Team and employee** — AC 6, 12, 13
```
Go to   Team
Do      search, status chips · open a person · Edit and Delete in the Admin section (admin) · add an employee
See     matches MobileTeam / MobileEmployee; profile fills the screen; Edit opens over it on iOS; the delete note says records go with the person
```

**8 · More and Settings** — AC 6, 9, 11
```
Go to   More, then Settings
Do      every row · Dark/Light · Animations off · Sign Out (cancel) · office location (admin)
See     matches MobileMore / MobileSettings; theme and Animations stay after a restart; version v1.0.0
```

**9 · Meeting mode** — AC 3, 6, 13
```
Go to   More → Meeting Mode
Do      the four quick actions · ⋮ on a fine, standup, leave and the word · tap a submission
See     matches MobileMeeting; "Daily submissions" card; answers expand on tap; italic word example on iOS
```

**10 · Planning poker** — AC 6, 13
```
Go to   More → Planning Poker, a second phone as participant
Do      create, share, copy ID · vote and change · Publish Results · New Round · End Session
See     matches MobilePoker; results average, nearest card, bars; participant's card clears on a new round
```

**11 · Retrospective** — AC 6, 8, 13
```
Go to   More → Retrospective, a second phone
Do      create/join · add a card from the bottom bar · vote and react · edit/delete your card · share · end
See     matches MobileRetro; thumbs-up count = votes; reactions keep their emoji; timer/themes from the web show read-only
```

**12 · Words and Events** — AC 5, 6, 13
```
Go to   More → Word of the Day, then Events
Do      Manage seasons (edit, delete, new) · add/edit/delete a word · add/edit/delete an event · add/delete a holiday
See     matches MobileWords / MobileEvents; holiday today/tomorrow cyan, not orange
```

**13 · Projects and Memories** — AC 5, 6, 13
```
Go to   More → Projects, then Team Memories
Do      New Project with an environment, a link, two members · expand/collapse · edit, delete · post, open, edit, delete a memory · filters
See     matches MobileProjects / MobileMemories; header count lines; two-column memories
```

**14 · Sign-in, loader, banners** — AC 6, 11
```
Go to   sign out → Login; cold start; a week with an event or birthday
Do      sign in with Google · reload with Animations off and with the phone's reduce motion on
See     matches MobileLogin; loader card (teammate, ring, strip) still with motion off; one glass announcement card, dismissible; date fields with a calendar icon, no emoji
```

**15 · Light theme** — AC 9, 10
```
Go to   Settings → Light, then every tab and stacked screen
Do      read the headers and eyebrows near the top-left
See     pale ink, white glass, deep pill text; on-page eyebrows a deeper cyan, all readable
```

**No need to click** — AC 10 (`src/lib/mobileTokens.test.mjs` with `src/lib/contrast.test.mjs`: tokens equal the web, text on bars and over every aurora blob ≥ 4.5:1), AC 2 (font list in the same test), AC 12 rules (`src/lib/mobileAvatar.test.mjs`), the bell (`src/lib/mobileNotifications.test.mjs`), BS dates (`src/lib/mobileNepaliDate.test.mjs`), poker results (`src/lib/mobilePoker.test.mjs`), retro votes and themes (`src/lib/mobileRetro.test.mjs`), motion rule (`src/lib/mobileMotion.test.mjs`), AC 8 (emoji grep: only retro reactions left), AC 14 (fingerprints android `a00305e9…`, ios `e7def2ef…`, equal to the baseline), AC 15 (`mobile/package.json` adds only `expo-font` ~57.0.0 and three `@expo-google-fonts/*` packages) · `npm test` 217 pass.

**After you're happy** — publish as you always do: `eas update --branch preview --environment preview --message "…"` (no `env:push` needed, `.env` didn't change). It reaches existing installs because the fingerprint is unchanged.

**Needs a decision** — from Sanish
1. Leaves calendar keeps holidays orange (as the artboard and web calendar); cyan there already means today and leave. Keep, or another tone?
2. Meeting: "Daily submissions" title; one ⋮ menu instead of edit/delete icons (one extra tap); answers collapsed by default. Keep?
3. Team: Edit/Delete moved from the list rows into the employee screen's Admin section, as the artboard. Keep?
4. Retrospective on the phone shows the timer, themes and action items read-only; starting the timer, grouping, ticking items and kudos stay on the web. Fine for now?
5. Settings shows no "System" theme or notifications switch (the app has neither). Fine?
6. Existing problems found, not changed: `POST /api/send-wish` has no sign-in check and puts the name into email HTML (open relay, HTML injection; the phone calls it too, so a fix touches both); `mobile/.env` holds a `CRON_SECRET` name the app never uses (not bundled, but `eas env:push` would upload it); retro reactions/edits still work on an ended board on the phone (the web locks them); a renamed employee's records vanish locally until reload.

**Worth a glance** — Copy in Poker uses React Native's deprecated `Clipboard` (a native clipboard module would change the fingerprint; swap at the next native build) · long lists (a season with hundreds of fines) render every row; a FlatList would help on low-end Android · real blur waits for a native build (intent open question 1).

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · tokens, fonts, fingerprint guard | sonnet | 16m 19s | 248,869 | none |
| 2 · icons, avatar rules, bell list | sonnet | 21m 46s | 281,342 | none |
| 3 · shared building blocks | opus | 25m 4s | 306,930 | none |
| 4 · app shell: tab bar, top bar + bell, photos | opus | 18m 51s | 265,033 | none |
| 5 · Home | opus | 17m 53s | 241,835 | none |
| 6 · Attendance | opus | 21m 25s | 226,691 | none |
| 7 · Fines, record fine, withdrawals | opus | 7h 22m 1s | 346,473 | none |
| 8 · Leaves, record leave, leave settings | opus | 32m 58s | 430,905 | none |
| 9 · Team and employee | opus | 25m 51s | 325,020 | none |
| 10 · More and settings | opus | 18m 46s | 245,957 | none |
| 11 · Meeting mode | opus | 17m 35s | 269,618 | none |
| 12 · Planning poker | opus | 6m 26s (resumed run only; the first run before the restart not reported) | 298,324 | none |
| 13 · Retrospective | opus | 9m 50s | 163,383 | none |
| 14 · Words and events | opus | 8m 45s | 145,575 | none |
| 15 · Projects and memories | opus | 8m 52s | 152,452 | none |
| 16 · sign-in, loader, banners, small parts | opus | 10m 1s | 154,499 | none |
| 17 · sweep and delivery checks | opus | 9m 29s | 150,740 | none |
| **Total** | | 11h 51m 52s | 4,253,646 | 0 (plan: no commits during execution) |
Task 7's 7h 22m is the reported duration of a dispatch that sat waiting; task 12's time covers only the resumed run after a session restart. Tokens are the subagents' own; this session's context is not in them.

**Result** — 2026-10-21 · Android, development build (EAS build 2427b147, runtime "development") over Metro on the dev machine
Sanish: "ok tested looks good". Which of steps 1–15 were run by hand was not stated. The rules behind them are covered by `npm test` (217 pass), and delivery by the fingerprints (android `a00305e9…`, ios `e7def2ef…`, unchanged). The "Needs a decision" items were not answered.
Setup changes made to get the development build through EAS: `app.config.js` gives development builds a fixed runtime "development" when `HT_DEV_CLIENT_RUNTIME=1`, and that variable exists only in EAS's "development" environment. Fingerprints for preview builds and updates are unchanged.

**Published** — 2026-10-21, on Sanish's word ("once all review is done, deploy it"): `eas update --branch preview --environment preview`, after the review's 15 fixes (256 tests pass; fingerprints unchanged). Android group 61b0c0d5 (runtime a00305e9…), iOS group e2d3849b (runtime e7def2ef…). Built from the uncommitted working tree on top of 0bec9f6. Profile photos show as initials until the web app with `GET /api/avatars` is deployed.
Blank screens in that update: React Native 0.86 no longer exports `StyleSheet.absoluteFillObject`, so the aurora layer (`mobile/components/Aurora.js`, also Meeting's clock glow) lost its absolute position and pushed every screen's content off the bottom. Rolled back the same day (republished groups c03afbaf android, 07011ead ios), fixed with `StyleSheet.absoluteFill` plus the guard test `src/lib/mobileStyleSheet.test.mjs` (257 pass), republished on Sanish's word ("publish") without a phone check: android dbfd714d, ios 2c3fa31d.
