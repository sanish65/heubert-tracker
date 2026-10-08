**Smoke test — retro card themes** · local dev · `http://localhost:3000`

**Before you start**
- Apply `scripts/retro-card-themes-schema.sql` in the Supabase SQL editor. Both verify queries should return `0`.
- `nvm use 22 && npm run dev`
- Window A: signed in, Retrospective tab, as the board's facilitator. Window B: a private window that joins the share link as a guest named "Guest".
- Exiting a board with "← Exit" currently throws (see "Needs a decision" 1). Reload the page instead.

**1 · Group a crowded column** — AC 1, 2, 3
```
Go to   A · Retrospective tab · new Standard board
Do      Add to Needs Improvement: "Deploys are slow" · "Deploy pipeline keeps breaking" · "CI takes 40 minutes" · "Too many meetings" · "Standups run long" · "Meetings eat focus time" · add 2 cards to What Went Well · ✨ Group similar cards
See     "Loading the grouping model…" (first time only) then Needs Improvement shows named themes, every card in exactly one, deploy/CI cards apart from meeting cards · What Went Well stays a plain list
```

**2 · Everyone sees themes, ordered by reactions** — AC 4, 15, 17, 18
```
Go to   B · the share link
Do      React 👍 on two cards of one theme · edit your own card inside a theme · delete your own card inside a theme · rejoin with the facilitator's name
See     Same themes as A, each "n cards · r reactions", the theme with most reactions first · the edited card stays in its theme · reacting/editing/deleting work as before · no Group, Select, Move to or rename controls, whatever the name
API     curl -s -XPOST localhost:3000/api/retro -H 'Content-Type: application/json' -d '{"action":"ungroup_cards","sessionId":"<SESSION_ID>","actorName":"Mallory"}' -w ' %{http_code}\n'  → 403
```

**3 · Correct the themes** — AC 7, 8, 9, 10, 11
```
Go to   A · the grouped board
Do      Click a theme name, rename it, Enter · Move to… on a card · tick Select on two cards (one already in a theme) · New theme from 2 selected · move every card out of one theme
See     B shows each change within a few seconds · Move to… lists only themes of the card's own column · the two cards form a new theme (a split) · the emptied theme disappears
API     group_cards as the facilitator with "themes":[{"name":"Mixed","cardIds":["<CARD_IN_COL1>","<CARD_IN_COL2>"]}]  → 400 "one column"
```

**4 · Late cards find their theme** — AC 12, 13, 14
```
Go to   B · Needs Improvement, A open on the board
Do      Add "Deploys failed again on Friday" · add "Office coffee machine broke" · (rename a theme in A first) add another deploy card · add a card to What Went Well
See     The deploy card joins the deploy theme within a few seconds in both windows · the coffee card becomes its own theme · the rename stays · What Went Well stays a plain list
```

**5 · No facilitator on the board** — AC 12a
```
Go to   Close A
Do      B adds "Release notes were late" to Needs Improvement · reopen A on the board
See     Before A returns: the card sits under "Not in a theme" · within a few seconds of A opening: it is placed
```

**6 · The model can't load** — AC 5, 6, 16
```
Go to   A · Ungroup all · new tab on the board · DevTools → Network → block cdn.jsdelivr.net
Do      ✨ Group similar cards · tick 3 cards of one column → New theme from 3 selected, name it · Group in a normal tab, then reopen the blocked tab and have B add a card
See     One error and an unchanged board · the hand-made theme shows for everyone · B's new card stays under "Not in a theme", and the error appears once, not on every refresh
```

**7 · Top Voted is unchanged** — AC 19
```
Go to   A · 🗳️ Top Voted
Do      Look over the ranking · tick a card as an action item
See     Cards ranked one by one as before grouping · the action item tick works as before
```

**8 · Ungroup and group again** — AC 21, 22
```
Go to   A · the grouped board
Do      Ungroup all · confirm · ✨ Group similar cards
See     Plain columns for everyone · new themes made from the cards as they are now
```

**9 · An ended board keeps its themes** — AC 20
```
Go to   A · 🏁 End Session
Do      Look at the board in A and B
See     Themes still shown on both · no Group, Ungroup, Select, Move to or rename anywhere
API     Any theme action as the facilitator  → 409
```

**Needs a decision** — from Sanish
1. `src/components/RetrospectivePage.js:229` calls `setPromotedCardIds([])`, a setter the action-items work renamed to `setPickingCardIds`, so "← Exit" throws. It is in the action-items commit `ffe7acc`, not this feature. Fix it here (test-first, one line), or on the action-items branch?
2. Grouping thresholds `CLUSTER_SIMILARITY = 0.5` and `PLACE_SIMILARITY = 0.45` in `src/lib/retroThemes.js` are untested starting values. Keep them, or adjust after step 1 if cards group too loosely or too tightly?
3. Intent's open questions: the 4-card grouping minimum (`GROUPING_MIN_CARDS`), and the theme-name language when cards mix languages.

**Not automated** — carried from the build
- An emptied theme is deleted by the server only once it is over 60 s old, so that a theme another request is still filling isn't removed. Until then the boards hide it.
- "Move to…" shows only when the card's column has another theme to move to.
- The vector cache and the tried-cards set each keep at most 1,000 entries.
- If two new cards in one column each start a theme in the same pass, the second waits for the next refresh (≈2.5 s) so it can join the first.
- `src/app/retrospective/[sessionId]/page.js:441` has a lint error (unescaped `'` in "sprint's"). It dates from `931e384` and is untouched here.

**Worth a glance** — the same flow on a Sailboat and a Start/Stop board · Action Items and Kudos panels on a grouped board · drag-to-compose a card into a grouped column · the share page still sorts cards inside a column by 👍 only

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · Theme rules | haiku | 1m 28s | 24,875 | `59fbb7c` |
| 2 · Grouping maths | haiku | 1m 33s | 30,921 | `7bbfaaf` |
| 3 · Schema script | haiku | 0m 35s | 14,307 | `50639dd` |
| 4 · Theme API | opus | 2m 15s | 49,547 | `32b7886` |
| 5 · Model loader | haiku | 0m 48s | 17,926 | `cac58ae` |
| 6 · Web tab theme view | opus | 1m 26s | 37,115 | `991fea6` |
| 7 · Facilitator theme tools | opus | 2m 46s | 54,942 | `347d57e` |
| 8 · Late-card placement | opus | 1m 44s | 35,417 | `ddcc680` |
| 9 · Share page themes | sonnet | 0m 35s | 33,395 | `1efe0c8` |
| Review · branch-reviewer | fable | 10m 56s | 162,059 | `review.md` |
| **Total** | | 24m 5s | 460,504 | 9 |
Tokens are the subagents' own; this session's context is not in them.

**Result** — 2026-10-08 · local dev
- Sanish: "yeah good to go". Which steps were run by hand was not stated, so none is recorded as run. Where a step was not run, its rules are covered by the unit tests in `src/lib/retroThemes.test.mjs` (AC 1–4, 8, 11, 12, 17, 20). Everything else is unverified in a running app.
- "Needs a decision" 1–3 were left unanswered at the gate.
