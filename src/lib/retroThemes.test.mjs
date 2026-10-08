import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEME_NAME_MAX,
  canChangeThemes,
  cleanThemeName,
  checkThemes,
  arrangeColumn,
} from './retroThemes.js';

// ── canChangeThemes ──
test('facilitator or admin may change themes on an open board (AC 4)', () => {
  assert.equal(canChangeThemes({ isEnded: false, isFacilitator: true, isAdmin: false }), true);
  assert.equal(canChangeThemes({ isEnded: false, isFacilitator: false, isAdmin: true }), true);
});

test('anyone else is refused (AC 4)', () => {
  assert.equal(canChangeThemes({ isEnded: false, isFacilitator: false, isAdmin: false }), false);
});

test('nobody changes themes once the board has ended (AC 20)', () => {
  assert.equal(canChangeThemes({ isEnded: true, isFacilitator: true, isAdmin: true }), false);
});

// ── cleanThemeName ──
test('theme names are trimmed, inner spaces collapsed, length-limited', () => {
  assert.equal(cleanThemeName('  Slow   deploys '), 'Slow deploys');
  assert.equal(cleanThemeName(''), null);
  assert.equal(cleanThemeName('   '), null);
  assert.equal(cleanThemeName(42), null);
  assert.equal(cleanThemeName('x'.repeat(THEME_NAME_MAX)), 'x'.repeat(THEME_NAME_MAX));
  assert.equal(cleanThemeName('x'.repeat(THEME_NAME_MAX + 1)), null);
});

// ── checkThemes ──
const boardCards = [
  { id: 'c1', column_type: 'improve' },
  { id: 'c2', column_type: 'improve' },
  { id: 'c3', column_type: 'went_well' },
];

test('a valid theme set comes back cleaned, with its column', () => {
  const { error, themes } = checkThemes({ boardCards, themes: [{ name: ' Deploys ', cardIds: ['c1', 'c2'] }, { name: 'Team', cardIds: ['c3'] }] });
  assert.equal(error, undefined);
  assert.deepEqual(themes, [
    { name: 'Deploys', cardIds: ['c1', 'c2'], column_type: 'improve' },
    { name: 'Team', cardIds: ['c3'], column_type: 'went_well' },
  ]);
});

test('a theme may not mix columns (AC 2, 8)', () => {
  const { error } = checkThemes({ boardCards, themes: [{ name: 'Mixed', cardIds: ['c1', 'c3'] }] });
  assert.match(error, /one column/);
});

test('a card from another board is refused', () => {
  const { error } = checkThemes({ boardCards, themes: [{ name: 'X', cardIds: ['elsewhere'] }] });
  assert.match(error, /not on this board/);
});

test('a card may be in only one theme (AC 2)', () => {
  const { error } = checkThemes({ boardCards, themes: [{ name: 'A', cardIds: ['c1'] }, { name: 'B', cardIds: ['c1'] }] });
  assert.match(error, /only one theme/);
});

test('empty theme lists, empty themes and bad names are refused', () => {
  assert.ok(checkThemes({ boardCards, themes: [] }).error);
  assert.ok(checkThemes({ boardCards, themes: [{ name: 'A', cardIds: [] }] }).error);
  assert.ok(checkThemes({ boardCards, themes: [{ name: ' ', cardIds: ['c1'] }] }).error);
});

// ── arrangeColumn ──
const card = (id) => ({ id, content: id });
const themes = [
  { id: 't-old', name: 'Old', created_at: '2026-10-08T09:00:00Z' },
  { id: 't-new', name: 'New', created_at: '2026-10-08T09:05:00Z' },
  { id: 't-empty', name: 'Empty', created_at: '2026-10-08T09:01:00Z' },
];
const themeCards = [
  { card_id: 'a', theme_id: 't-old' },
  { card_id: 'b', theme_id: 't-new' },
  { card_id: 'c', theme_id: 't-new' },
  { card_id: 'gone', theme_id: 't-empty' },
];
const votes = { a: 1, b: 2, c: 0, d: 5 };

test('cards sit in their themes, in the order given; the rest are loose', () => {
  const out = arrangeColumn({ cards: [card('c'), card('b'), card('a'), card('d')], themes, themeCards, reactionsFor: (id) => votes[id] || 0 });
  assert.deepEqual(out.themes.map((t) => [t.id, t.cards.map((c) => c.id)]), [['t-new', ['c', 'b']], ['t-old', ['a']]]);
  assert.deepEqual(out.loose.map((c) => c.id), ['d']);
});

test('themes are ordered by their cards\' total reactions (AC 17)', () => {
  const out = arrangeColumn({ cards: [card('a'), card('b'), card('c')], themes, themeCards, reactionsFor: (id) => votes[id] || 0 });
  assert.deepEqual(out.themes.map((t) => [t.id, t.reactions]), [['t-new', 2], ['t-old', 1]]);
});

test('equal totals keep the older theme first', () => {
  const out = arrangeColumn({ cards: [card('a'), card('b')], themes, themeCards, reactionsFor: () => 1 });
  assert.deepEqual(out.themes.map((t) => t.id), ['t-old', 't-new']);
});

test('a theme with none of the column\'s cards does not show (AC 11)', () => {
  const out = arrangeColumn({ cards: [card('a')], themes, themeCards });
  assert.deepEqual(out.themes.map((t) => t.id), ['t-old']);
});

test('no themes: every card is loose', () => {
  const out = arrangeColumn({ cards: [card('a'), card('b')] });
  assert.deepEqual(out.themes, []);
  assert.deepEqual(out.loose.map((c) => c.id), ['a', 'b']);
});
