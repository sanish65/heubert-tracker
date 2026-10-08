**Smoke test — retro-action-items-kudos** · local dev · `http://localhost:3000`

**Before you start**
- Apply `scripts/retro-action-items-kudos-schema.sql` in the Supabase SQL editor; the three verify counts return `0`.
- Start the app yourself: `npm run dev`.
- One project **P** with at least two members (**A**, **B**), and a second project **Q**.
- Signed in as the facilitator in one browser; a second browser profile (not signed in) for a guest.
- Optional, before applying the SQL: open any board. It loads normally, with only a warning in the server log.

**1 · Add action items** — AC 1, 2, 3
```
Go to   / → Retrospective tab → create board "S1" for project P
Do      Action Items → add "Fix flaky deploy", owner A · add "Write runbook", No owner
See     both under "New this retro"; "👤 A" on the first; the owner list shows only P's members
```

**2 · Guest view and live sync** — AC 4, 5
```
Go to   S1's share link in the guest profile, join as "Gita"
Do      as facilitator, tick "Fix flaky deploy" in the tab
See     guest: both items, checkboxes disabled, no add form / ✏️ / ✕; the tick appears within ~3 s
```

**3 · Ended board: tick only** — AC 15
```
Go to   S1 in the tab (facilitator)
Do      untick "Fix flaky deploy" · 🏁 End Session · tick "Fix flaky deploy" again
See     ticking works after the end; add form, ✏️ and ✕ are gone
```

**4 · Carry forward across templates** — AC 6, 7, 8, 10
```
Go to   / → Retrospective tab → create board "S2" for P with the Sailboat template
Do      look at Action Items
See     "Write runbook" under "From earlier retros" with "from S1 · <date>"; "Fix flaky deploy" absent
```

**5 · Tick, see it on earlier boards, untick** — AC 11, 12, 13, 14
```
Go to   S2 in the tab
Do      tick "Write runbook" · reopen S1 · create S3 for P · back on S2 untick it · create S4 for P
See     S2: struck through with "✓ <you> · <date>" · S1: done too · S3: absent · S4: under "From earlier retros"
```

**6 · Edit and delete everywhere** — AC 16, 17
```
Go to   S4 in the tab
Do      ✏️ "Write runbook" → "Write deploy runbook", owner B · then ✕ it and confirm
See     after the edit, S1 and S2 show the new text and "👤 B"; after delete, gone from S1, S2 and S4
```

**7 · Other project and no project** — AC 9, no-project edge
```
Go to   / → Retrospective tab → create a board for project Q
Do      look at Action Items · then open a board with no project (if one exists)
See     Q: nothing from P · no project: own list only, no owner select, nothing carried
```

**8 · Top Voted and promoting a card** — AC 18, 19
```
Go to   S4 in the tab
Do      add a card and react to it · click "🗳️ Top Voted" · "➕ Make action item" on that card
See     the button reads "🗳️ Top Voted"; the item appears under "New this retro"; the button turns "✓ Added"; the card is unchanged
```

**9 · Kudos** — AC 20, 21, 22, 23, 24
```
Go to   S4 share link as guest "Gita"
Do      post a kudos tagging A and B · from another viewer react 🎉, then click it again
See     "🙌 A, B" and "— Gita"; the reaction count goes up then back down; Gita sees ✏️ and ✕; others see neither; the facilitator sees ✕ only
```

**10 · Ended board kudos, and a fresh board** — AC 25, 26
```
Go to   S4 in the tab
Do      🏁 End Session · then create S5 for P
See     S4: kudos visible, no compose, reactions don't toggle, no ✏️/✕ · S5: Kudos empty
```

**11 · Refusals from the API** — AC 4, 15, 21, 23
```
Do      curl -X POST localhost:3000/api/retro -H 'Content-Type: application/json' -d '{"action":"add_action_item","sessionId":"<S5 id>","content":"x","actorName":"Not The Host"}'
See     403 · same as the facilitator's name on ended S4 → 409 · edit_kudos as a non-author → 403 · add_action_item with an ownerEmployeeId outside P → 400
```

**No need to click** — AC 4, 6–15, 17, 20, 22–26 (the rules behind them) · `src/lib/retroBoardRules.test.mjs`, 15 tests, under `npm test`.

**Needs a decision** — from Sanish
1. Share page, ended board: the existing full-screen "This Retrospective has ended" overlay still hides the board, so AC 15 and 25 hold on the tab only. Keep it as is, or make the overlay dismissible so the board stays readable (and tickable) behind it.
2. Owner leaves the project (open question in the intent): the item keeps showing their name, but editing it is refused ("Owner must be a member of this board's project.") until the owner is changed or cleared. Keep that, or clear such owners automatically.

**Worth a glance** — existing cards, reactions, timer and End Session on both surfaces · the board list on the tab's home · light and dark themes for the two new panels · narrow screens

**Not automated** — the API route and both pages run only by hand: there is no integration test setup in this repo. Implementers could not exercise the route against Supabase.

**Build report** — each dispatch as its usage report gave it
| Task | Model | Time | Tokens | Commits |
| --- | --- | --- | --- | --- |
| 1 · rules module + test runner | haiku | 1m 22s | 28,670 | `248e49c` |
| 2 · schema SQL | haiku | 0m 26s | 14,278 | `fbfb307` |
| 3 · board GET extras | sonnet | 0m 32s | 25,580 | `267c20f` |
| 4 · action item writes | sonnet | 0m 52s | 30,712 | `4e5e76d` |
| 5 · kudos writes | sonnet | 0m 33s | 28,263 | `8173972` |
| 6 · postRetro helper | haiku | 0m 28s | 13,290 | `54f5e5b` |
| 7 · Action Items panel | sonnet | 0m 44s | 22,373 | `38ecae1` |
| 8 · Kudos section | sonnet | 0m 44s | 25,520 | `75df0d0` |
| 9 · wire retro tab | sonnet | 0m 50s | 22,179 | `6a24b58` |
| 9 · fix: promote error + button style | sonnet | 0m 18s | 25,111 | `dce8788` |
| 10 · wire share page | sonnet | 0m 27s | 18,613 | `86771c9` |
| **Total** | | 7m 15s | 254,589 | 11 |
Tokens are the subagents' own; this session's context is not in them.
