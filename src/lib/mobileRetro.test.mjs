import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as web from './retroBoardRules.js';
import { arrangeColumn as webArrangeColumn } from './retroThemes.js';
import {
  VOTE_EMOJI,
  reactionCounts,
  voteCount,
  totalReactions,
  byVotes,
  arrangeColumn,
  boardPeople,
  timerSecondsLeft,
  formatClock,
} from '../../mobile/lib/retro.js';

// mobile/lib/retro.js is the phone's copy of how the web's retro board counts votes and groups a
// column into themes (src/lib/retroBoardRules.js, src/lib/retroThemes.js). Both web modules are
// import-free, so these tests run the same cases through the web code and the phone code and
// require the same answers: a rule changed on one side only fails here.

const reactions = [
  { card_id: 'a', emoji: '👍' },
  { card_id: 'a', emoji: '👍' },
  { card_id: 'a', emoji: '❤️' },
  { card_id: 'b', emoji: '🎉' },
  { card_id: 'b', emoji: '🎉' },
  { card_id: 'b', emoji: '😂' },
  { card_id: 'c', emoji: '👍' },
  { card_id: 1, emoji: '👍' },
];
const cards = [{ id: 'd' }, { id: 'b' }, { id: 'c' }, { id: 'a' }, { id: 'e' }];

test('a vote is the web vote: 👍 only', () => {
  assert.equal(VOTE_EMOJI, web.VOTE_EMOJI);
  for (const id of ['a', 'b', 'c', 'e', '1', 1]) {
    assert.equal(voteCount(reactions, id), web.voteCount(reactions, id), `votes on ${id}`);
    assert.deepEqual(reactionCounts(reactions, id), web.reactionCounts(reactions, id), `reactions on ${id}`);
  }
  assert.equal(voteCount(reactions, 'b'), 0, 'three reactions, none of them 👍');
});

test("a theme's total counts every reaction, as the web", () => {
  for (const id of ['a', 'b', 'c', 'e']) {
    assert.equal(totalReactions(reactions, id), web.totalReactions(reactions, id), `total on ${id}`);
  }
  assert.equal(totalReactions(reactions, 'b'), 3);
});

test('a column reads most voted first, ties in id order, as the web', () => {
  const mine = [...cards].sort(byVotes(reactions)).map((c) => c.id);
  const theirs = [...cards].sort(web.byVotes(reactions)).map((c) => c.id);
  assert.deepEqual(mine, theirs);
  assert.deepEqual(mine, ['a', 'c', 'b', 'd', 'e']);
});

test('themes group a column the way the web does', () => {
  const themes = [
    { id: 't1', name: 'Older', created_at: '2026-10-01T09:00:00Z' },
    { id: 't2', name: 'Newer', created_at: '2026-10-02T09:00:00Z' },
    { id: 't3', name: 'Elsewhere', created_at: '2026-10-03T09:00:00Z' },
  ];
  const themeCards = [
    { card_id: 'a', theme_id: 't1' },
    { card_id: 'b', theme_id: 't2' },
    { card_id: 'c', theme_id: 't2' },
    { card_id: 'z', theme_id: 't3' },
  ];
  const sorted = [...cards].sort(byVotes(reactions));
  const reactionsFor = (id) => totalReactions(reactions, id);
  const input = { cards: sorted, themes, themeCards, reactionsFor };
  const mine = arrangeColumn(input);
  assert.deepEqual(mine, webArrangeColumn(input));
  // t2 holds 4 reactions (c 1, b 3) to t1's 3; t3 has no card in this column and is left out.
  assert.deepEqual(mine.themes.map((t) => [t.name, t.reactions, t.cards.map((c) => c.id)]), [
    ['Newer', 4, ['c', 'b']],
    ['Older', 3, ['a']],
  ]);
  assert.deepEqual(mine.loose.map((c) => c.id), ['d', 'e']);
  assert.deepEqual(arrangeColumn({ cards: sorted }), webArrangeColumn({ cards: sorted }));
});

test('the people on the board: you first, then everyone who wrote, reacted or is writing, once each', () => {
  const people = boardPeople({
    me: 'Sita Gurung',
    cards: [{ author: 'Aarav' }, { author: 'sita gurung ' }, { author: '' }, { author: 'Bikash' }],
    reactions: [{ participant_name: 'Kriti' }, { participant_name: 'AARAV' }],
    activity: [{ participant_name: 'Nabin' }, { participant_name: 'Kriti' }],
  });
  assert.deepEqual(people, ['Sita Gurung', 'Aarav', 'Bikash', 'Kriti', 'Nabin']);
});

test('the people on the board without a name of your own or any data', () => {
  assert.deepEqual(boardPeople({}), []);
  assert.deepEqual(boardPeople({ me: '  ', cards: [{ author: 'Aarav' }] }), ['Aarav']);
});

test('the timer: a running one counts down to its end time and stops at zero', () => {
  const now = Date.parse('2026-10-21T10:00:00.000Z');
  const running = (endTime) => ({ status: 'running', endTime, duration: 300 });
  assert.equal(timerSecondsLeft(running('2026-10-21T10:04:32.000Z'), now), 272);
  assert.equal(timerSecondsLeft(running('2026-10-21T10:00:00.900Z'), now), 0, 'part of a second left reads 0, as the web');
  assert.equal(timerSecondsLeft(running('2026-10-21T09:59:00.000Z'), now), 0);
});

test('the timer: a stopped one holds the duration it stopped at; none, or one that does not parse, is no timer', () => {
  assert.equal(timerSecondsLeft({ status: 'stopped', endTime: null, duration: 180 }, 0), 180);
  assert.equal(timerSecondsLeft({ status: 'stopped', endTime: null }, 0), null);
  assert.equal(timerSecondsLeft(null, 0), null);
  assert.equal(timerSecondsLeft({ status: 'running', endTime: 'soon' }, 0), null);
  assert.equal(timerSecondsLeft({ status: 'paused', duration: 60 }, 0), null);
});

test('the clock reads minutes and seconds, two digits each', () => {
  assert.equal(formatClock(272), '04:32');
  assert.equal(formatClock(0), '00:00');
  assert.equal(formatClock(59), '00:59');
  assert.equal(formatClock(3600), '60:00');
});
