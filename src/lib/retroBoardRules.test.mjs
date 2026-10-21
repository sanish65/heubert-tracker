import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectBoardActionItems,
  isFacilitator,
  canChangeActionItem,
  canChangeKudos,
  VOTE_EMOJI,
  reactionCounts,
  voteCount,
  totalReactions,
  byVotes,
  topVoted,
} from './retroBoardRules.js';

const b1 = { id: 'b1', title: 'Sprint 1', project_id: 7, created_at: '2026-09-01T09:00:00Z' };
const b2 = { id: 'b2', title: 'Sprint 2', project_id: 7, created_at: '2026-09-15T09:00:00Z' };
const b3 = { id: 'b3', title: 'Sprint 3', project_id: 7, created_at: '2026-09-29T09:00:00Z' };
const b4 = { id: 'b4', title: 'Sprint 4', project_id: 7, created_at: '2026-10-13T09:00:00Z' };
const projectBoards = [b4, b2, b1, b3];

const item = (id, session_id, created_at, extra = {}) => ({ id, session_id, created_at, done_at: null, ...extra });
const ids = (list) => list.map((i) => i.id);

test('own items are this board\'s items, oldest first', () => {
  const items = [item('x2', 'b3', '2026-09-29T10:05:00Z'), item('x1', 'b3', '2026-09-29T10:00:00Z'), item('a', 'b1', '2026-09-01T10:00:00Z')];
  const { own } = selectBoardActionItems({ board: b3, projectBoards, items });
  assert.deepEqual(ids(own), ['x1', 'x2']);
});

test('a board with no project carries nothing in', () => {
  const lonely = { ...b3, project_id: null };
  const items = [item('a', 'b1', '2026-09-01T10:00:00Z'), item('x', 'b3', '2026-09-29T10:00:00Z')];
  const { carried, own } = selectBoardActionItems({ board: lonely, projectBoards, items });
  assert.deepEqual(ids(carried), []);
  assert.deepEqual(ids(own), ['x']);
});

test('unticked items from every earlier board carry, however old (AC 6)', () => {
  const items = [item('a', 'b1', '2026-09-01T10:00:00Z'), item('b', 'b2', '2026-09-15T10:00:00Z')];
  const { carried } = selectBoardActionItems({ board: b4, projectBoards, items });
  assert.deepEqual(ids(carried), ['a', 'b']);
});

test('carried items name the board they came from, oldest board first (AC 7)', () => {
  const items = [item('b', 'b2', '2026-09-15T10:00:00Z'), item('a', 'b1', '2026-09-01T10:00:00Z')];
  const { carried } = selectBoardActionItems({ board: b3, projectBoards, items });
  assert.deepEqual(carried.map((i) => [i.id, i.origin_title, i.origin_created_at]), [
    ['a', 'Sprint 1', '2026-09-01T09:00:00Z'],
    ['b', 'Sprint 2', '2026-09-15T09:00:00Z'],
  ]);
});

test('items from later boards never show on an earlier board', () => {
  const items = [item('late', 'b4', '2026-10-13T10:00:00Z')];
  const { carried } = selectBoardActionItems({ board: b2, projectBoards, items });
  assert.deepEqual(ids(carried), []);
});

test('items whose board is not in this project are not carried (AC 9)', () => {
  const items = [item('elsewhere', 'other-project-board', '2026-09-01T10:00:00Z')];
  const { carried } = selectBoardActionItems({ board: b4, projectBoards, items });
  assert.deepEqual(ids(carried), []);
});

test('an item ticked before a board was created is left off it (AC 10, 12)', () => {
  const items = [item('a', 'b1', '2026-09-01T10:00:00Z', { done_at: '2026-09-15T10:30:00Z' })];
  assert.deepEqual(ids(selectBoardActionItems({ board: b3, projectBoards, items }).carried), []);
});

test('an item ticked after a board was created stays on it, as done (AC 11, 14)', () => {
  const items = [item('a', 'b1', '2026-09-01T10:00:00Z', { done_at: '2026-09-15T10:30:00Z' })];
  const { carried } = selectBoardActionItems({ board: b2, projectBoards, items });
  assert.deepEqual(ids(carried), ['a']);
  assert.equal(carried[0].done_at, '2026-09-15T10:30:00Z');
});

test('an unticked item carries again to later boards (AC 13)', () => {
  const items = [item('a', 'b1', '2026-09-01T10:00:00Z', { done_at: null })];
  assert.deepEqual(ids(selectBoardActionItems({ board: b4, projectBoards, items }).carried), ['a']);
});

test('the facilitator is the board creator, ignoring case and spaces', () => {
  const session = { created_by: 'Sanish Maharjan' };
  assert.equal(isFacilitator(session, '  sanish maharjan '), true);
  assert.equal(isFacilitator(session, 'Someone Else'), false);
  assert.equal(isFacilitator(session, ''), false);
  assert.equal(isFacilitator(null, 'Sanish Maharjan'), false);
});

test('only the facilitator or an admin may change action items (AC 4)', () => {
  for (const op of ['add', 'edit', 'delete', 'tick']) {
    assert.equal(canChangeActionItem({ op, isEnded: false, isFacilitator: false, isAdmin: false }), false, op);
    assert.equal(canChangeActionItem({ op, isEnded: false, isFacilitator: true, isAdmin: false }), true, op);
    assert.equal(canChangeActionItem({ op, isEnded: false, isFacilitator: false, isAdmin: true }), true, op);
  }
});

test('an ended board allows ticking only (AC 15)', () => {
  assert.equal(canChangeActionItem({ op: 'tick', isEnded: true, isFacilitator: true, isAdmin: false }), true);
  for (const op of ['add', 'edit', 'delete']) {
    assert.equal(canChangeActionItem({ op, isEnded: true, isFacilitator: true, isAdmin: true }), false, op);
  }
  assert.equal(canChangeActionItem({ op: 'tick', isEnded: true, isFacilitator: false, isAdmin: false }), false);
});

test('anyone with a name may post and react to kudos on an open board (AC 20, 22)', () => {
  assert.equal(canChangeKudos({ op: 'add', isEnded: false, actorName: 'Guest Gita' }), true);
  assert.equal(canChangeKudos({ op: 'react', isEnded: false, actorName: 'Guest Gita' }), true);
  assert.equal(canChangeKudos({ op: 'add', isEnded: false, actorName: '  ' }), false);
});

test('only the author edits a kudos; the author or facilitator deletes it (AC 23, 24)', () => {
  const kudos = { author: 'Asha' };
  assert.equal(canChangeKudos({ op: 'edit', isEnded: false, kudos, actorName: 'asha' }), true);
  assert.equal(canChangeKudos({ op: 'edit', isEnded: false, kudos, actorName: 'Bikash', isFacilitator: true }), false);
  assert.equal(canChangeKudos({ op: 'delete', isEnded: false, kudos, actorName: 'Asha' }), true);
  assert.equal(canChangeKudos({ op: 'delete', isEnded: false, kudos, actorName: 'Bikash', isFacilitator: true }), true);
  assert.equal(canChangeKudos({ op: 'delete', isEnded: false, kudos, actorName: 'Bikash', isFacilitator: false }), false);
});

test('nothing about kudos changes once the board has ended (AC 25)', () => {
  const kudos = { author: 'Asha' };
  for (const op of ['add', 'edit', 'delete', 'react']) {
    assert.equal(canChangeKudos({ op, isEnded: true, kudos, actorName: 'Asha', isFacilitator: true }), false, op);
  }
});

// ── votes ──
// Card 1: two votes and a 🎉. Card 2: four reactions, none of them a vote. Card 3: three votes.
const reactions = [
  { card_id: 1, emoji: '👍' }, { card_id: 1, emoji: '👍' }, { card_id: 1, emoji: '🎉' },
  { card_id: '2', emoji: '🎉' }, { card_id: 2, emoji: '❤️' }, { card_id: 2, emoji: '😂' }, { card_id: 2, emoji: '💡' },
  { card_id: 3, emoji: '👍' }, { card_id: 3, emoji: '👍' }, { card_id: 3, emoji: '👍' },
];

test('a vote is a 👍 reaction', () => {
  assert.equal(VOTE_EMOJI, '👍');
});

test("a card's votes are its 👍 reactions; other emoji do not count", () => {
  assert.equal(voteCount(reactions, 1), 2);
  assert.equal(voteCount(reactions, 2), 0);
  assert.equal(voteCount(reactions, '3'), 3);
  assert.equal(voteCount(reactions, 4), 0);
});

test('theme totals still count every reaction, any emoji', () => {
  assert.equal(totalReactions(reactions, 1), 3);
  assert.equal(totalReactions(reactions, 2), 4);
  assert.equal(totalReactions(reactions, 4), 0);
});

test("reactionCounts groups one card's reactions by emoji", () => {
  assert.deepEqual(reactionCounts(reactions, 1), { '👍': 2, '🎉': 1 });
  assert.deepEqual(reactionCounts(reactions, 4), {});
});

test('Top Voted ranks by votes and leaves out a card with reactions but no votes', () => {
  const cards = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  assert.deepEqual(topVoted(cards, reactions).map((c) => c.id), [3, 1]);
});

test('equal votes keep a stable order by id', () => {
  const tied = [{ card_id: 'b', emoji: '👍' }, { card_id: 'a', emoji: '👍' }, { card_id: 'c', emoji: '🎉' }];
  assert.deepEqual([{ id: 'c' }, { id: 'b' }, { id: 'a' }].sort(byVotes(tied)).map((c) => c.id), ['a', 'b', 'c']);
});
