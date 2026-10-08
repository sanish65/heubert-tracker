// RETRO BOARD RULES — shared by /api/retro (which enforces them) and both board pages
// (which use them to hide controls). Deliberately import-free so `npm test` can load it
// under plain Node.

export const ACTION_ITEM_MAX = 280;
export const KUDOS_MAX = 280;

const time = (iso) => (iso ? Date.parse(iso) : NaN);
const norm = (name) => (name || '').trim().toLowerCase();

// Which action items a board shows.
//   board          { id, project_id, created_at }
//   projectBoards  every board of board.project_id: [{ id, title, created_at }]
//   items          action items belonging to board.id or any of projectBoards
// own     — items first added on this board, oldest first.
// carried — items first added on an EARLIER board of the same project that are still
//           open, or were ticked after this board was created. The second half is what
//           keeps a ticked item on the board where the team closed it (shown as done)
//           while every board created after the tick leaves it off. Each one gains
//           origin_title and origin_created_at for its "from" label.
// A board with no project has nothing to group by, so nothing carries in.
export function selectBoardActionItems({ board, projectBoards = [], items = [] }) {
  const byCreated = (a, b) => time(a.created_at) - time(b.created_at);
  const own = items.filter((i) => i.session_id === board.id).sort(byCreated);
  if (board.project_id == null) return { carried: [], own };

  const boardStart = time(board.created_at);
  const earlier = new Map(
    projectBoards
      .filter((b) => b.id !== board.id && time(b.created_at) < boardStart)
      .map((b) => [b.id, b])
  );

  const carried = items
    .filter((i) => earlier.has(i.session_id))
    .filter((i) => !i.done_at || time(i.done_at) >= boardStart)
    .map((i) => {
      const origin = earlier.get(i.session_id);
      return { ...i, origin_title: origin.title, origin_created_at: origin.created_at };
    })
    .sort((a, b) => time(a.origin_created_at) - time(b.origin_created_at) || byCreated(a, b));

  return { carried, own };
}

// The facilitator is whoever created the board. On the share page that is only a typed
// name, so this is as strong as the name check the board already uses for the timer.
export function isFacilitator(session, actorName) {
  const actor = norm(actorName);
  return !!actor && actor === norm(session?.created_by);
}

// op: 'add' | 'edit' | 'delete' | 'tick'. Facilitator or admin only; once the board has
// ended the list is frozen except for ticking, so work finished after the retro can
// still be closed.
export function canChangeActionItem({ op, isEnded, isFacilitator: facilitator, isAdmin }) {
  if (!facilitator && !isAdmin) return false;
  if (isEnded) return op === 'tick';
  return true;
}

// op: 'add' | 'edit' | 'delete' | 'react'. Kudos work like cards: anyone with a name
// posts and reacts, the author edits, the author or the facilitator deletes, and an
// ended board freezes all of it.
export function canChangeKudos({ op, isEnded, kudos, actorName, isFacilitator: facilitator }) {
  if (isEnded) return false;
  const actor = norm(actorName);
  if (!actor) return false;
  if (op === 'add' || op === 'react') return true;
  const isAuthor = actor === norm(kudos?.author);
  if (op === 'edit') return isAuthor;
  if (op === 'delete') return isAuthor || !!facilitator;
  return false;
}
