// RETRO CARD THEMES — grouping a board's cards with similar meaning into named themes.
// Shared by /api/retro (which enforces the rules) and both board pages (which show
// themes and hide controls). Deliberately import-free so `npm test` can load it under
// plain Node; the model that turns card text into vectors is src/lib/retroEmbeddings.js
// and only ever runs in the browser.

export const THEME_NAME_MAX = 60;

// Facilitator or admin, and only while the board is open (AC 4, 20).
export function canChangeThemes({ isEnded, isFacilitator, isAdmin }) {
  if (isEnded) return false;
  return !!isFacilitator || !!isAdmin;
}

// A theme name as stored: trimmed, inner whitespace collapsed, 1..THEME_NAME_MAX
// characters. null when unusable.
export function cleanThemeName(name) {
  if (typeof name !== 'string') return null;
  const clean = name.trim().replace(/\s+/g, ' ');
  return clean && clean.length <= THEME_NAME_MAX ? clean : null;
}

// Checks themes proposed for a board before they are written.
//   boardCards  [{ id, column_type }] — the board's real cards, DB column values
//   themes      [{ name, cardIds }]
// Returns { error } or { themes: [{ name, cardIds, column_type }] }. Every theme holds
// cards of one column only, and no card is in two themes (AC 2, 8).
export function checkThemes({ boardCards, themes }) {
  if (!Array.isArray(themes) || themes.length === 0) return { error: 'themes required' };
  const columnOf = new Map(boardCards.map((c) => [String(c.id), c.column_type]));
  const seen = new Set();
  const out = [];
  for (const theme of themes) {
    const name = cleanThemeName(theme?.name);
    if (!name) return { error: `Each theme needs a name of up to ${THEME_NAME_MAX} characters.` };
    const cardIds = Array.isArray(theme.cardIds) ? theme.cardIds.map(String) : [];
    if (cardIds.length === 0) return { error: 'Each theme needs at least one card.' };
    let column = null;
    for (const id of cardIds) {
      if (!columnOf.has(id)) return { error: 'That card is not on this board.' };
      if (seen.has(id)) return { error: 'A card can be in only one theme.' };
      seen.add(id);
      const cardColumn = columnOf.get(id);
      if (column !== null && cardColumn !== column) return { error: 'A theme can only hold cards from one column.' };
      column = cardColumn;
    }
    out.push({ name, cardIds, column_type: column });
  }
  return { themes: out };
}

// How one column shows (AC 2, 11, 17).
//   cards        the column's cards, already in display order
//   themes       [{ id, name, created_at }] of the board
//   themeCards   [{ card_id, theme_id }] of the board
//   reactionsFor (cardId) => number of reactions on that card
// Returns { themes: [{ ...theme, cards, reactions }], loose: cards in no theme }.
// A theme holding none of the column's cards is left out: that is how a theme whose
// cards were all moved or deleted disappears, and how themes stay in their own column.
// Themes are ordered by total reactions, most first; ties keep the older theme first.
export function arrangeColumn({ cards, themes = [], themeCards = [], reactionsFor = () => 0 }) {
  const themeOf = new Map(themeCards.map((m) => [String(m.card_id), String(m.theme_id)]));
  const byId = new Map(themes.map((t) => [String(t.id), { ...t, cards: [], reactions: 0 }]));
  const loose = [];
  for (const c of cards) {
    const theme = byId.get(themeOf.get(String(c.id)));
    if (!theme) { loose.push(c); continue; }
    theme.cards.push(c);
    theme.reactions += reactionsFor(c.id);
  }
  const time = (iso) => Date.parse(iso) || 0;
  const shown = [...byId.values()]
    .filter((t) => t.cards.length > 0)
    .sort((a, b) => b.reactions - a.reactions || time(a.created_at) - time(b.created_at));
  return { themes: shown, loose };
}
