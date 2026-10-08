---
title: Group similar retro cards into themes
author: Sanish (sanish@heubert.com)
requested by: Sanish
---

# Group similar retro cards into themes
_Intent written 2026-10-08 with Sanish. No discovery ticket; brainstormed from a request in chat._

## Problem
A retro board collects many cards, and the facilitator reads and discusses them one at a time. Cards that say the same thing in different words are discussed separately, which makes the retro slow.

- Each column lists its cards one by one, ordered only by reaction count. Nothing on the board groups cards that are about the same thing. (`src/components/RetrospectivePage.js:623-627`, the column listing)
- Top Voted ranks single cards, so five cards about the same problem take five places in the ranking. (`src/components/RetrospectivePage.js:631-643`)
- Nothing in the product today can tell that two cards mean the same thing. A card is free text of up to 280 characters. (`maxLength={280}`, `src/app/retrospective/[sessionId]/page.js`)

Who hits it: the facilitator of every retro with many cards. Every participant waits through the card-by-card discussion.

## Proposed outcome
- In one step, the facilitator turns a crowded column into a handful of named themes. The team then discusses theme by theme instead of card by card.
- Every card can still be read inside its theme, keeping its own author, reactions and action-item state.
- Themes are ordered by their cards' total votes, so the topic the team cares most about comes up first.
- When the suggested groups are wrong, the facilitator corrects them during the meeting. Cards added later join the right theme without undoing those corrections.

## Affected users and systems
- **Facilitator** (the board's creator) and **admins**: group cards into themes, move cards between themes, rename and split themes, ungroup everything.
- **Participants**, signed-in or guests joining through the share link: see the themes and the cards inside them.
- **Surfaces:** the Retrospective tab in the web app (`src/components/RetrospectivePage.js`) and the public share page `/retrospective/<sessionId>` (`src/app/retrospective/[sessionId]/page.js`). Both are served by `/api/retro` (`src/app/api/retro/route.js`).
- **Data touched:** retro cards (`retro_cards`) and their reactions (`retro_card_reactions`). Themes are new data.
- **Grouping model:** a free, open-source language model that runs in the facilitator's or admin's browser and suggests themes from card text. Card text is not sent to any outside service. The product uses nothing like it today.
- **Variants:** board templates Standard, Sailboat and Start/Stop, and their three columns each.
- **Decision owner:** Sanish.

## Scope
- Surfaces: the web Retrospective tab (create and change themes) and the public share page (view only).
- Templates: Standard, Sailboat and Start/Stop, all treated the same.
- Roles: facilitator and admin (manage), signed-in and guest participants (view).
- Boards that haven't ended. Ended boards show the themes they had and nothing more.

## User stories
1. As a facilitator, I want to group a board's cards by meaning in one step, so that I can lead the discussion by theme instead of reading every card.
2. As a facilitator, I want to move cards between themes, rename a theme and split a theme, so that wrong suggestions can be corrected during the meeting.
3. As a facilitator, I want cards written after grouping to join the right theme on their own, so that late cards don't undo my corrections or need sorting by hand.
4. As a participant, I want to see the themes ordered by their total votes, with each card still readable inside, so that I can follow which topic is being discussed and why it comes first.
5. As a facilitator, I want to ungroup the whole board, so that I can return to plain columns if the themes aren't helping.

## Acceptance criteria

### Story 1: Group cards by meaning
1. Given a board that hasn't ended and a viewer who is the facilitator or an admin, when they choose to group the cards, then the cards of each column are arranged into themes, each named from words its cards share. Applies to the web Retrospective tab, all templates.
2. Given the cards have been grouped, then every theme holds cards from one column only, and every card of that column is in exactly one theme. Applies to the web Retrospective tab and the share page, all templates.
3. Given a column with fewer cards than the grouping threshold (see open questions), when the facilitator groups the cards, then that column stays a plain list and no themes are made in it. Applies to the web Retrospective tab, all templates.
4. Given a viewer who is neither the facilitator nor an admin, when they view the board, then they have no control to group, move, rename, split or ungroup. Applies to the web Retrospective tab and the share page.
5. Given the grouping model can't be loaded or fails in the facilitator's browser, when the facilitator groups the cards, then an error message says grouping failed, and the board stays as it was before (plain columns, or the themes it already had). Applies to the web Retrospective tab.
6. Given grouping has failed, or the board has no themes yet, when the facilitator creates a theme and places cards in it by hand, then the theme shows to everyone like a suggested one. Applies to the web Retrospective tab.

### Story 2: Correct themes
7. Given a grouped board that hasn't ended and the facilitator or an admin viewing it, when they move a card to another theme in the same column, then the card shows in that theme for everyone. Applies to the web Retrospective tab.
8. Given a grouped board that hasn't ended, when the facilitator tries to move a card into a theme of a different column, then the card stays where it was. Applies to the web Retrospective tab, all templates.
9. Given a grouped board that hasn't ended, when the facilitator renames a theme, then the new name shows for everyone. Applies to the web Retrospective tab.
10. Given a grouped board that hasn't ended, when the facilitator splits a theme by choosing some of its cards, then those cards form a new theme in the same column, and the rest stay in the original. Applies to the web Retrospective tab.
11. Given a theme whose cards have all been moved out or deleted, then the theme no longer shows. Applies to the web Retrospective tab and the share page.

### Story 3: Late and changed cards
12. Given a grouped board that hasn't ended and the facilitator or an admin has it open in the web Retrospective tab, when any participant adds a card to a column that has themes, then within a few seconds the card appears in the theme of that column whose cards it is most similar to. If no theme fits, it appears in a new theme. Applies to the web Retrospective tab and the share page, all templates.
12a. Given a grouped board that hasn't ended and no facilitator or admin has it open in the web Retrospective tab, when a participant adds a card, then it appears in its column outside any theme, and it is placed as in 12 once a facilitator or admin opens the board. Applies to the web Retrospective tab and the share page.
13. Given the facilitator has moved, renamed or split themes, when a new card is added, then those changes stay as they were, and only the new card is placed. Applies to the web Retrospective tab and the share page.
14. Given a column that was below the grouping threshold when the facilitator grouped, when cards are added to it later, then it stays a plain list until the facilitator groups again. Applies to the web Retrospective tab.
15. Given a card in a theme, when its author edits it, then it stays in the same theme. Applies to the web Retrospective tab and the share page.
16. Given the grouping model fails while a new card is placed, then the card still appears on the board, in its column, outside any theme, and the facilitator can place it by hand. Applies to the web Retrospective tab and the share page.

### Story 4: See themes by votes
17. Given a grouped board, when anyone views it, then each theme shows its name, the number of cards it holds, and the sum of its cards' reactions. Within a column, themes are ordered by that sum, highest first. Applies to the web Retrospective tab and the share page, all templates.
18. Given a card inside a theme, then it shows its text, author and reactions as it does today, and on a board that hasn't ended participants can react to it, edit it and delete it as they can today. Applies to the web Retrospective tab and the share page.
19. Given a grouped board, when anyone opens Top Voted, then it lists and ranks single cards exactly as before grouping, and action items are still picked card by card. Applies to the web Retrospective tab.
20. Given a board that has ended, when anyone views it, then the themes it had at the end are shown, and nobody can group, move, rename, split or ungroup. Applies to the web Retrospective tab and the share page.

### Story 5: Ungroup
21. Given a grouped board that hasn't ended and the facilitator or an admin viewing it, when they ungroup the board, then every column returns to its plain list and the themes are discarded for everyone. Applies to the web Retrospective tab.
22. Given a board that has been ungrouped, when the facilitator groups again, then new themes are suggested from the cards as they are now. Applies to the web Retrospective tab.

## Edge cases
- **Similar topics in opposite columns** ("deploys were fast" under What Went Well, "deploys broke" under Needs Improvement). Each goes into a theme in its own column, and themes never mix columns. Ties to 2, 8. Source: PM.
- **Columns with very few cards.** Left as plain lists. Ties to 3, 14. Source: PM. The exact number is an open question.
- **Cards arriving while people are writing.** The board refreshes every few seconds (`src/components/RetrospectivePage.js:213`), and the facilitator may group before everyone has finished. Each new card is placed on its own. Ties to 12, 13. Source: code, decided by PM.
- **Card edited after grouping.** It stays in its theme, even if its meaning changed. Ties to 15. Source: PM.
- **Card deleted, or every card moved out of a theme.** The empty theme disappears. Ties to 11. Source: PM.
- **Grouping model can't run** (an old browser, a slow network, or a blocked first download). The facilitator sees an error and can still group by hand. New cards still appear, outside any theme. Ties to 5, 6, 16. Source: PM.
- **No facilitator or admin on the board.** Cards added while nobody who can group has the web tab open stay outside themes until one of them opens it. Ties to 12a. Source: follows from the free in-browser choice, PM.
- **Board ended.** Themes are kept and shown, and can't be changed. Ties to 20. Source: code (end of session locks the board, `end_session` in `src/app/api/retro/route.js`), decided by PM.
- **Facilitator on the share page.** The share page treats a viewer as the facilitator when their typed name matches the board creator's name. Theme controls are not offered on the share page at all, so this limit does not apply here. Ties to 4. Source: code (`src/app/retrospective/[sessionId]/page.js`), decided by PM.
- **Templates.** Standard, Sailboat and Start/Stop each have three columns, and all are grouped the same way. Ties to 1, 2, 12, 17. Source: code (`RETRO_TEMPLATES`, `src/components/RetrospectivePage.js:15-36`).
- **Cards in more than one language.** Not discussed. See open questions.
- **Mobile app retro screen.** Decided out of scope by Sanish.

## Constraints
- No paid service and no subscription: grouping runs on a free, open-source model in the browser. Decided by Sanish, 2026-10-08.
- Card text never leaves the browser for grouping.
- Theme names are made from words the cards share, not written summaries. The facilitator renames them where needed. Accepted by Sanish.
- The first time a facilitator or admin groups cards, their browser downloads the model (about 25 MB) from a public model host, then reuses it. A network that blocks that host makes grouping fail as in 5.
- Uses the existing retro permissions: facilitator = board creator; admin as in the web app today.
- No deadline, budget, brand or other compliance constraints named.

## Out of scope
- Voting on a theme, or ticking a whole theme as an action item. Votes and action items stay per card.
- Any change to the Top Voted view.
- Grouping or changing themes from the public share page.
- The mobile app's retro screen (`mobile/app/retrospective.js`). A later ticket.
- Themes that mix cards from different columns.
- Grouping or changing themes on ended boards.
- A per-viewer switch between the themed and plain board.

## Dependencies
- The retro action items and kudos work on branch `feat/retro-action-items-kudos` (`docs/retro-action-items-kudos/intent.md`) merged first. It brings the Top Voted view and per-card action items that this intent leaves unchanged.

## Open questions
- How many cards must a column hold before it gets grouped? 4 was suggested. Owner: Sanish. Does not block the start of work; can be settled during build.
- ~~Which AI provider is approved, and who pays?~~ Resolved 2026-10-08 by Sanish: no paid provider; a free model runs in the browser.
- When cards are written in more than one language, which language are theme names in? Owner: Sanish. Does not block the start of work.
