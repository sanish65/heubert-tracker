---
title: Track retro action items across boards and add Kudos
author: Sanish (sanish@heubert.com)
requested by: Sanish
---

# Track retro action items across boards and add Kudos
_Intent written 2026-10-08 with Sanish. No discovery ticket; brainstormed from a request in chat._

## Problem
A team's retro produces action items, but nothing follows them into the next retro, so they are forgotten.

- A board has no real list of action items. The "📋 Action Items" view ranks every card with at least one reaction of any emoji, from any column. A "What Went Well" card with a single 😂 counts as an action item. Nothing records what the team decided to do. (`src/components/RetrospectivePage.js:577-599`)
- Boards are grouped by project (`scripts/retro-projects-schema.sql`), but a new board starts empty. Nothing from the project's earlier boards appears on it.
- There is no place to thank a colleague or celebrate a team win. The three columns are about the sprint's process, not about people. (`src/app/retrospective/[sessionId]/page.js`, `RETRO_TEMPLATES`)

Who hits it: every team running retros in Heubert Tracker, every sprint.

## Proposed outcome
- When a team opens a new retro board for its project, every action item it hasn't closed is already there, showing which retro it came from and when. Nothing slips just because a sprint ended.
- Once an item is ticked done, it never shows up in that project's later retros. Each retro shows what was closed during it.
- Every retro has a place for shoutouts to colleagues and team achievements, which the whole board can read and react to.

## Affected users and systems
- **Facilitator** (the board's creator) and **admins**: add, edit, delete, tick and untick action items.
- **Participants**, signed-in or guests who joined through the share link with a name: see action items; post, react to, edit and delete their own kudos.
- **Surfaces:** the Retrospective tab in the web app (`src/components/RetrospectivePage.js`) and the public share page `/retrospective/<sessionId>` (`src/app/retrospective/[sessionId]/page.js`). Both are served by `/api/retro` (`src/app/api/retro/route.js`).
- **Data touched:** retro boards and their project link (`retro_sessions.project_id`), the project's members (`project_members`), and card reactions (`retro_card_reactions`). Action items and kudos are new data.
- **Variants:** board templates Standard, Sailboat and Start/Stop. Boards with a project and boards with none.
- **Decision owner:** Sanish.

## Scope
- Surfaces: the web Retrospective tab and the public share page.
- Templates: Standard, Sailboat and Start/Stop, all treated the same.
- Boards: with a project (action items carry over) and without one (the board keeps its own list only).
- Roles: facilitator, admin, signed-in participant, guest participant.

## User stories
1. As a facilitator, I want to record the action items my team agrees on, with an owner, so that the decision is written down and someone is accountable.
2. As a team, I want a new retro board to show every action item from our project's earlier retros that is still open, so that we can follow up on them.
3. As a facilitator, I want to tick an action item done, and untick it if that was a mistake, so that closed items stop coming back while this retro still shows what was closed.
4. As a facilitator, I want to edit or delete an action item, so that wording mistakes and items added by mistake can be corrected.
5. As a facilitator, I want to turn a highly voted card into an action item, so that the vote ranking feeds straight into what we commit to.
6. As anyone on the board, I want to post a kudos to colleagues or about a team achievement, and react to others' kudos, so that good work gets recognised during the retro.

## Acceptance criteria

### Story 1: Record action items
1. Given a board that hasn't ended and a viewer who is the facilitator or an admin, when they add an action item with text, then it appears in this board's Action Items list under "New this retro". Applies to both web surfaces.
2. Given the facilitator adds an action item on a board that belongs to a project, when they choose an owner, then the choices are exactly that project's members, and the owner's name shows on the item. Applies to both web surfaces.
3. Given the facilitator adds an action item and chooses no owner, then the item is saved and shows no owner. Applies to both web surfaces.
4. Given a viewer who is neither the facilitator nor an admin, when they view the Action Items list, then it is visible and has no add, edit, delete or tick controls. Applies to both web surfaces.
5. Given action items were added on a board, when another participant's view of the same board refreshes, then they see the same items with the same owners and done states. Applies to both web surfaces.

### Story 2: Carry open items forward
6. Given a project with earlier boards that hold unticked action items, when a new board is created for that project, then the new board's Action Items list shows all of those items, however many boards ago they were added, in a group titled "From earlier retros", above "New this retro". Applies to both web surfaces, all templates.
7. Given an item in "From earlier retros", then it shows the title and creation date of the board it was first added on. Applies to both web surfaces.
8. Given an earlier board used a different template from the new board (e.g. Sailboat, then Standard), when the new board is created, then that earlier board's unticked items still show up on it. Applies to both web surfaces.
9. Given unticked action items on another project's boards, when a new board is created for this project, then none of them show up on it. Applies to both web surfaces.
10. Given an earlier board of the project with action items that were all ticked, when a new board is created, then none of them show up on it. Applies to both web surfaces.

### Story 3: Tick and untick
11. Given an unticked item on a board and a facilitator or admin viewing it, when they tick it, then on this board it stays in its group, shown as done (struck through), with the name of who ticked it and when. Applies to both web surfaces.
12. Given an item was ticked on a board, when any later board is created for the same project, then that item is not on it. Applies to both web surfaces.
13. Given an item ticked on the current board, when a facilitator or admin unticks it, then it shows as open again and appears on boards created after that. Applies to both web surfaces.
14. Given an item is ticked or unticked on one board, when an earlier board where it appears is opened, then it shows the same done or open state. Applies to both web surfaces.
15. Given a board has ended, when a facilitator or admin views its Action Items list, then they can still tick and untick items, and cannot add, edit or delete items. Applies to both web surfaces.

### Story 4: Edit and delete
16. Given a board that hasn't ended and a facilitator or admin viewing it, when they edit an action item's text or owner, then the change appears on every board where that item shows. This includes items in "From earlier retros". Applies to both web surfaces.
17. Given a board that hasn't ended and a facilitator or admin viewing it, when they delete an action item, then it disappears from every board, earlier and later, and is never carried forward again. Applies to both web surfaces.

### Story 5: From Top Voted to action item
18. Given a board, when anyone views the top bar, then the button that used to read "📋 Action Items" reads "Top Voted" and opens the same list of cards ranked by reaction count. Applies to the web Retrospective tab, and to the share page wherever it shows that view.
19. Given the Top Voted view on a board that hasn't ended and a facilitator or admin viewing it, when they choose to make a card an action item, then a new item with that card's text appears under "New this retro", and the card stays where it was. Applies to every surface that shows Top Voted.

### Story 6: Kudos
20. Given a board that hasn't ended, when any participant, signed-in or guest, posts a kudos with a message, then it appears in the board's Kudos section with the sender's name. Applies to both web surfaces, all templates.
21. Given a board that belongs to a project, when a participant posts a kudos, then they can tag zero or more of that project's members, and the tagged names show on the kudos. Applies to both web surfaces.
22. Given a kudos on a board that hasn't ended, when a participant reacts with one of the board's reaction emojis, then the reaction count shows on the kudos, and reacting again with the same emoji removes their reaction. Applies to both web surfaces.
23. Given a kudos on a board that hasn't ended, when its author edits or deletes it, then the change shows for everyone on the board. Other participants have no edit or delete controls on it. Applies to both web surfaces.
24. Given a kudos on a board that hasn't ended, when the facilitator deletes it, then it is removed for everyone. Applies to both web surfaces.
25. Given a board has ended, when anyone views its Kudos section, then all kudos are visible and nobody can post, edit, delete or react. Applies to both web surfaces.
26. Given kudos were posted on an earlier board of a project, when a new board is created for that project, then its Kudos section starts empty. Applies to both web surfaces.

## Edge cases
- **Board with no project** (created before projects existed, or its project was deleted, which clears the link but keeps the board). The board has its own Action Items list. Nothing carries in from other boards, and its items never carry out. The owner choice and kudos tagging have no members to offer, so owner stays blank and nobody can be tagged. Ties to 2, 6, 21. Source: code (`scripts/retro-projects-schema.sql`, ON DELETE SET NULL), confirmed by PM.
- **Template changes between retros.** Items carry across templates. Ties to 8. Source: code (columns are template-specific, `src/app/api/retro/route.js`), decided by PM.
- **Item added long ago and never ticked.** It keeps carrying forward with no expiry. Ties to 6. Source: PM.
- **Item edited or deleted from a later board.** The change shows on the earlier board it came from as well. Ties to 16, 17. Source: PM.
- **Board ended before work finished.** Items can still be ticked on the ended board. Ties to 15. Source: code (end of session locks the board, `src/app/api/retro/route.js` `end_session`), decided by PM.
- **Facilitator on the share page.** The share page treats a viewer as the facilitator when their typed name matches the board creator's name, so anyone who types that name gets facilitator rights over action items. Accepted as a known limit, not fixed by this work. Ties to 1, 4, 11. Source: code (`src/app/retrospective/[sessionId]/page.js:90`).
- **Owner leaves the project.** Not discussed. See open questions. Ties to 2.
- **Many open items piling up.** No expiry was chosen. See constraints.
- **Mobile app retro screen.** Decided out of scope by Sanish.

## Constraints
- Uses the existing retro permissions: facilitator = board creator; admin as in the web app today.
- With no expiry, a project that never ticks items will see its "From earlier retros" group keep growing. Accepted.
- No other deadline, budget, brand or compliance constraints named.

## Out of scope
- The mobile app's retro screen (`mobile/app/retrospective.js`). A later ticket.
- Emails or notifications to action item owners or tagged colleagues. A possible follow-up idea.
- Due dates on action items.
- Anonymous kudos.
- Kudos carrying forward to later boards, or a project-wide kudos history.
- Making facilitator identity on the share page stronger than today's name match.

## Dependencies
- Project members must be set for a project for the owner and tagging choices to list anyone (`project_members`, managed on the Projects page).
- `scripts/retro-projects-schema.sql` applied, so boards have a project.

## Open questions
- If an action item's owner is later removed from the project, what should the item show, and should the owner be changed? Owner: Sanish. Does not block the start of work.

## Change — 2026-10-08, decided by Sanish during the smoke test
After a retro the team votes on cards with any reaction emoji. Before ending the retro, the facilitator picks the action items from the voted cards with a checkbox.
- In the Top Voted view each voted card has a checkbox for the facilitator (and admins). Ticking it makes the card an action item of this board; unticking removes it. It is the same action item as one added by hand: it shows under "New this retro", carries into the project's later boards while open, and there can be ticked done, edited or deleted (criteria 6–17).
- Picking is only possible before the board ends. A card can be picked once.
- The "➕ Make action item" button is replaced by the checkbox. The hand-written Action Items form stays.
- The share page has no Top Voted view, so picking happens in the web Retrospective tab.

27. Given a board that hasn't ended and the facilitator or an admin in the Top Voted view, when they tick a voted card, then it shows as an action item ("🗳️ From votes") under "New this retro", and the card stays ticked for everyone. Applies to the web Retrospective tab.
28. Given a ticked card on a board that hasn't ended, when the facilitator unticks it, then that action item is removed from the board. Applies to the web Retrospective tab.
29. Given a board has ended, when anyone views Top Voted, then ticked cards show as action items and the checkboxes can't be changed. Applies to the web Retrospective tab.
30. Given a card was ticked on an earlier board of the project, when a later board is opened, then it appears under "From earlier retros" and can be ticked done, edited or deleted as criteria 11–17 describe. Applies to both web surfaces.
