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

// A column with fewer cards than this is left as a plain list when grouping (AC 3).
export const GROUPING_MIN_CARDS = 4;
// Cosine similarity of the model's normalised vectors. Starting values for
// all-MiniLM-L6-v2, to be tuned in the smoke run: cards whose average similarity reaches
// CLUSTER_SIMILARITY share a theme; a late card joins the closest theme reaching
// PLACE_SIMILARITY, otherwise it starts its own (AC 12).
export const CLUSTER_SIMILARITY = 0.5;
export const PLACE_SIMILARITY = 0.45;

// Cosine similarity of two vectors of equal length; 0 when either is all zeros.
export function similarity(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return na && nb ? dot / Math.sqrt(na * nb) : 0;
}

// Average-linkage grouping: keeps joining the two groups whose cards are, on average,
// most alike until no pair reaches minSimilarity. A card like no other stays a group of
// one. Deterministic: groups come back in the order of their first item, items in input
// order. O(n³) on a column's cards, which are a few dozen at most.
//   items [{ id, vector }] → [[id, ...], ...]
export function clusterByMeaning(items, minSimilarity = CLUSTER_SIMILARITY) {
  const sim = items.map((a) => items.map((b) => similarity(a.vector, b.vector)));
  const linkage = (g, h) => {
    let total = 0;
    for (const i of g) for (const j of h) total += sim[i][j];
    return total / (g.length * h.length);
  };
  const groups = items.map((_, i) => [i]);
  for (;;) {
    let best = null;
    for (let x = 0; x < groups.length; x++) {
      for (let y = x + 1; y < groups.length; y++) {
        const s = linkage(groups[x], groups[y]);
        if (s >= minSimilarity && (!best || s > best.s)) best = { x, y, s };
      }
    }
    if (!best) break;
    groups[best.x] = [...groups[best.x], ...groups[best.y]].sort((a, b) => a - b);
    groups.splice(best.y, 1);
  }
  return groups.sort((g, h) => g[0] - h[0]).map((g) => g.map((i) => items[i].id));
}

const STOPWORDS = new Set((
  'the and are was were for from with that this these those have has had not but our ours you your ' +
  'they them their there then than what when which while who whom why how all any can could did does ' +
  'doing done get got its into also just more most much need needs some such too very will would should ' +
  'been being let lets make made many may might must only other own same out over under again about ' +
  'after before because each few here she him her his one two per via yet'
).split(' '));

// A short name from the words a theme's cards share most: up to maxWords, joined by
// " · ". Each word counts once per card so one long card cannot dominate; ties keep the
// word seen first. @mentions are people, not topics, and are skipped. With no usable
// word, the first card's opening words; failing that, "Theme".
export function nameFromTexts(texts, maxWords = 3) {
  const counts = new Map();
  const firstSeen = new Map();
  for (const text of texts) {
    const words = new Set(
      (text || '').replace(/@\S+/g, ' ').toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || []
    );
    for (const w of words) {
      if (w.length < 3 || STOPWORDS.has(w)) continue;
      counts.set(w, (counts.get(w) || 0) + 1);
      if (!firstSeen.has(w)) firstSeen.set(w, firstSeen.size);
    }
  }
  const top = [...counts.keys()]
    .sort((a, b) => counts.get(b) - counts.get(a) || firstSeen.get(a) - firstSeen.get(b))
    .slice(0, maxWords);
  const name = top.length
    ? top.map((w) => w[0].toUpperCase() + w.slice(1)).join(' · ')
    : (texts[0] || '').trim().split(/\s+/).slice(0, 4).join(' ');
  return cleanThemeName(name.slice(0, THEME_NAME_MAX)) || 'Theme';
}

// Suggested themes for one column (AC 1, 3).
//   cards    [{ id, content }] of one column
//   vectors  one vector per card, same order
// [] when the column is below minCards; otherwise [{ name, cardIds }] holding every
// card exactly once.
export function buildThemes({ cards, vectors, minCards = GROUPING_MIN_CARDS, minSimilarity = CLUSTER_SIMILARITY }) {
  if (cards.length < minCards) return [];
  const textOf = new Map(cards.map((c) => [String(c.id), c.content]));
  const groups = clusterByMeaning(cards.map((c, i) => ({ id: String(c.id), vector: vectors[i] })), minSimilarity);
  return groups.map((ids) => ({ name: nameFromTexts(ids.map((id) => textOf.get(id))), cardIds: ids }));
}

// Where a card added after grouping goes (AC 12): the id of the theme whose cards it is
// most alike on average, when that reaches minSimilarity; null means "start a theme of
// its own".
//   vector  the new card's
//   themes  [{ id, vectors }] of the card's column; themes with no vectors are skipped
export function placeCard({ vector, themes, minSimilarity = PLACE_SIMILARITY }) {
  let best = null;
  for (const t of themes) {
    if (!t.vectors.length) continue;
    const s = t.vectors.reduce((sum, v) => sum + similarity(vector, v), 0) / t.vectors.length;
    if (s >= minSimilarity && (!best || s > best.s)) best = { id: t.id, s };
  }
  return best ? best.id : null;
}
