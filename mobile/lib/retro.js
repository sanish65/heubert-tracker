// How the retro board counts and groups, the phone's copy of the web's rules: a vote is the 👍
// reaction (src/lib/retroBoardRules.js: VOTE_EMOJI, reactionCounts, voteCount, totalReactions,
// byVotes) and a column's cards sit in its themes (src/lib/retroThemes.js: arrangeColumn). The app
// cannot import from src/; src/lib/mobileRetro.test.mjs runs the same cases through both and
// requires the same answers. Change a rule there and here together. Also the board's own reads:
// who is on it and the timer. Pure: no imports.

export const VOTE_EMOJI = "👍";

// { emoji: count } of one card's reactions.
export function reactionCounts(reactions, cardId) {
  const counts = {};
  for (const r of reactions) {
    if (String(r.card_id) === String(cardId)) counts[r.emoji] = (counts[r.emoji] || 0) + 1;
  }
  return counts;
}

export function voteCount(reactions, cardId) {
  return reactionCounts(reactions, cardId)[VOTE_EMOJI] || 0;
}

// Every reaction on a card, any emoji: what a theme's total adds up.
export function totalReactions(reactions, cardId) {
  return Object.values(reactionCounts(reactions, cardId)).reduce((sum, n) => sum + n, 0);
}

// Sort comparator: most votes first; equal votes keep a stable order by id.
export function byVotes(reactions) {
  return (a, b) => voteCount(reactions, b.id) - voteCount(reactions, a.id) || String(a.id).localeCompare(String(b.id));
}

// How one column shows: { themes: [{ ...theme, cards, reactions }], loose: cards in no theme }.
// `cards` already in display order; a theme holding none of them is left out; themes most
// reactions first, ties the older first.
export function arrangeColumn({ cards, themes = [], themeCards = [], reactionsFor = () => 0 }) {
  const themeOf = new Map(themeCards.map((m) => [String(m.card_id), String(m.theme_id)]));
  const byId = new Map(themes.map((t) => [String(t.id), { ...t, cards: [], reactions: 0 }]));
  const loose = [];
  for (const c of cards) {
    const theme = byId.get(themeOf.get(String(c.id)));
    if (!theme) {
      loose.push(c);
      continue;
    }
    theme.cards.push(c);
    theme.reactions += reactionsFor(c.id);
  }
  const time = (iso) => Date.parse(iso) || 0;
  const shown = [...byId.values()]
    .filter((t) => t.cards.length > 0)
    .sort((a, b) => b.reactions - a.reactions || time(a.created_at) - time(b.created_at));
  return { themes: shown, loose };
}

// Everyone the board's data names: you first, then whoever wrote a card, reacted or is writing,
// in that order, each once. Names match as the board matches authors: trimmed, any case.
export function boardPeople({ me = "", cards = [], reactions = [], activity = [] }) {
  const seen = new Set();
  const people = [];
  const add = (name) => {
    const shown = (name || "").trim();
    const key = shown.toLowerCase();
    if (!key || seen.has(key)) return;
    seen.add(key);
    people.push(shown);
  };
  add(me);
  cards.forEach((c) => add(c.author));
  reactions.forEach((r) => add(r.participant_name));
  activity.forEach((a) => add(a.participant_name));
  return people;
}

// The facilitator's timer as the web's participants read it (src/components/RetroTimer.js): a
// running one counts down to its end time, whole seconds, never below zero; a stopped one holds the
// duration it stopped at. null when there is no timer to show.
export function timerSecondsLeft(timerState, now) {
  if (!timerState) return null;
  if (timerState.status === "running") {
    const end = Date.parse(timerState.endTime || "");
    if (Number.isNaN(end)) return null;
    return Math.max(0, Math.floor((end - now) / 1000));
  }
  if (timerState.status === "stopped" && typeof timerState.duration === "number") return timerState.duration;
  return null;
}

// "04:32".
export function formatClock(seconds) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(Math.floor(seconds / 60))}:${pad(seconds % 60)}`;
}
