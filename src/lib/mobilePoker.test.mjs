import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FIBONACCI, hasVoted, summariseVotes, pointsLabel, estimateTitle } from '../../mobile/lib/poker.js';

// mobile/lib/poker.js is the phone's copy of how the web's planning poker reads a revealed round
// (src/components/PlanningPokerPage.js: FIBONACCI, hasVoted, summariseVotes). That file is a client
// component Node cannot import, so its deck, hasVoted and summariseVotes are cut out of the source
// and run here as written; every case below compares the phone's answer with the web's, so a rule
// changed on one side only fails here.

const webSource = readFileSync(new URL('../components/PlanningPokerPage.js', import.meta.url), 'utf8');

// The web's own code for one top-level declaration: from its first line to the first line that
// closes it at column 0 (a function) or ends in ";" (an arrow or a constant).
function cut(start) {
  const at = webSource.indexOf(start);
  assert.ok(at !== -1, `no "${start}" in src/components/PlanningPokerPage.js`);
  const rest = webSource.slice(at);
  const close = start.includes('function') ? rest.indexOf('\n}\n') + 2 : rest.indexOf(';\n') + 1;
  assert.ok(close > 1, `"${start}" does not close`);
  return rest.slice(0, close).replace(/^export /, '');
}

const web = new Function(
  [cut('export const FIBONACCI ='), cut('const hasVoted ='), cut('export function summariseVotes('), 'return { FIBONACCI, hasVoted, summariseVotes };'].join('\n')
)();

// The API's rows: everyone who joined, `vote` "waiting" until they pick a card.
const rows = (...votes) => votes.map((vote, i) => ({ id: i + 1, participant_name: `P${i + 1}`, vote }));

test('the deck is the web deck', () => {
  assert.deepEqual(FIBONACCI, web.FIBONACCI);
});

test('a seat has voted exactly when the web says so', () => {
  for (const vote of ['5', '?', 'waiting', '', null, undefined, '0', 'abc']) {
    assert.equal(hasVoted({ vote }), web.hasVoted({ vote }), `vote ${JSON.stringify(vote)}`);
  }
});

// Rounds that exercise each rule: nobody in, only "?", ties, the rounding of the average, votes that
// are not cards, zero, every card at once, hostile values from the API.
const ROUNDS = {
  'no votes in': [],
  'only empty seats': ['waiting', 'waiting'],
  '"?" and empty seats left out': ['5', '3', '?', '5', 'waiting'],
  'only "?"': ['?', '?'],
  'average between two cards': ['2', '3'],
  'shown average ties two cards': [...Array(7).fill('2'), ...Array(6).fill('1')],
  'shared top cards': ['8', '13', '8', '13', '21'],
  'empty seats never shorten the bars': ['5', 'waiting', 'waiting'],
  'a vote that is not a card': ['4', '8'],
  'a zero is not an estimate': ['0', '8'],
  'every card': ['1', '2', '3', '5', '8', '13', '21', '34', '55', '89', '?'],
  'large and fractional': ['89', '0.5', '55'],
  'hostile values': ['constructor', '__proto__', '-3', ' 5 ', '1e2', 'NaN'],
};

for (const [name, votes] of Object.entries(ROUNDS)) {
  test(`summariseVotes gives the web's answer: ${name}`, () => {
    assert.deepEqual(summariseVotes(rows(...votes)), web.summariseVotes(rows(...votes)));
  });
}

test('a card reads as points, "?" as not sure', () => {
  assert.equal(pointsLabel(1), '1 point');
  assert.equal(pointsLabel('1'), '1 point');
  assert.equal(pointsLabel(13), '13 points');
  assert.equal(pointsLabel('?'), 'Not sure');
});

test('your estimate: the card you hold, or none yet', () => {
  assert.equal(estimateTitle(null), 'No card yet');
  assert.equal(estimateTitle(undefined), 'No card yet');
  assert.equal(estimateTitle('?'), 'Not sure yet');
  assert.equal(estimateTitle(5), '5 points');
  assert.equal(estimateTitle('1'), '1 point');
});
