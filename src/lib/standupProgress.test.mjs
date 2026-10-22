import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  answerFor,
  answeredProgress,
  teamProgress,
  waitingLabel,
  recentStandups,
  shortNote,
} from './standupProgress.js';

// 2026-10-21 is a Wednesday; 2026-10-26 the Monday after.
const none = new Set();

test('an answer is read by question_<id>, then by id, then by the question text', () => {
  const q = { id: 7, question: 'Any blockers?' };
  assert.equal(answerFor({ question_7: 'a', 7: 'b', 'Any blockers?': 'c' }, q), 'a');
  assert.equal(answerFor({ 7: 'b', 'Any blockers?': 'c' }, q), 'b');
  assert.equal(answerFor({ 'Any blockers?': 'c' }, q), 'c');
  assert.equal(answerFor(null, q), '');
});

test('answered progress counts non-blank answers out of every question', () => {
  const qs = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }];
  assert.deepEqual(answeredProgress(qs, { 1: 'done', 2: '   ', 3: 'next' }), { answered: 2, total: 4, pct: 50 });
  assert.deepEqual(answeredProgress(qs.slice(0, 3), { 1: 'x' }), { answered: 1, total: 3, pct: 33 });
});

test('with no questions configured the progress is 0 of 0 at 0%, not NaN', () => {
  assert.deepEqual(answeredProgress([], {}), { answered: 0, total: 0, pct: 0 });
});

const employees = [
  { id: 1, name: 'Asha Rai', work_email: 'asha@heubert.com', status: 'active' },
  { id: 2, name: 'Bikash Thapa', work_email: 'bikash@heubert.com', status: 'active' },
  { id: 3, name: 'Pranay', personal_email: 'pranay@gmail.com', status: 'active' },
  { id: 4, name: 'Bhoomi K', work_email: 'bhoomi@heubert.com', status: 'resigned' },
  { id: 5, name: 'HR Desk', work_email: 'hr@heubert.com', status: 'active', standup_excluded: true },
  { id: 6, name: 'Nebula', work_email: 'nebula@heubert.com' },
];

test('the team count follows the meeting page: active, not standup-excluded, matched by email or first name', () => {
  const submissions = [
    { date: '2026-10-21', email: 'ASHA@heubert.com', name: 'Asha' },
    { date: '2026-10-21', email: '', name: 'Pranay Lama Pakhrin' },
    { date: '2026-10-21', email: 'bhoomi@heubert.com', name: 'Bhoomi' },
    { date: '2026-10-21', email: 'hr@heubert.com', name: 'HR' },
    { date: '2026-10-20', email: 'bikash@heubert.com', name: 'Bikash' },
  ];
  const p = teamProgress(employees, submissions, '2026-10-21');
  assert.equal(p.expected, 4);
  assert.equal(p.inCount, 2);
  assert.deepEqual(p.submitted.map((e) => e.id), [1, 3]);
  assert.deepEqual(p.waiting.map((e) => e.id), [2, 6]);
});

test('the team count is 0 of M when nobody has submitted for the day', () => {
  const p = teamProgress(employees, [], '2026-10-26');
  assert.equal(p.inCount, 0);
  assert.equal(p.expected, 4);
  assert.equal(teamProgress([], null, '2026-10-26').expected, 0);
});

test('waiting names two people, then counts the rest', () => {
  assert.equal(waitingLabel([]), "Everyone's in");
  assert.equal(waitingLabel(['Nikhil']), 'Waiting on Nikhil');
  assert.equal(waitingLabel(['Nikhil', 'Nebula']), 'Waiting on Nikhil and Nebula');
  assert.equal(waitingLabel(['Nikhil', 'Nebula', 'Sita']), 'Waiting on Nikhil, Nebula and 1 more');
  assert.equal(waitingLabel(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K']), 'Waiting on A, B and 9 more');
});

test('a short note is the first line, collapsed and cut with an ellipsis', () => {
  assert.equal(shortNote('  Leave calendar,\n PR reviews '), 'Leave calendar,');
  assert.equal(shortNote('Retro   themes'), 'Retro themes');
  assert.equal(shortNote('x'.repeat(60), 10), 'xxxxxxxxx…');
  assert.equal(shortNote(''), '');
});

const me = { name: 'Asha Rai', work_email: 'asha@heubert.com' };
const firstQuestion = { id: 1, question: 'What did you accomplish?' };
const mine = [
  { date: '2026-10-20', email: 'asha@heubert.com', name: 'Asha', answers: { question_1: 'Leave calendar, PR reviews' } },
  { date: '2026-10-19', email: 'asha@heubert.com', name: 'Asha', answers: { question_1: 'Retro themes' } },
  { date: '2026-10-15', email: 'asha@heubert.com', name: 'Asha', answers: { question_1: 'Poker results' } },
  { date: '2026-10-16', email: 'bikash@heubert.com', name: 'Bikash', answers: { question_1: 'Not mine' } },
];

test('recent updates walk back over working days before the selected day, marking past gaps missed', () => {
  const rows = recentStandups(mine, {
    before: '2026-10-21', today: '2026-10-21', holidayDates: none, employee: me, user: null, firstQuestion, count: 4,
  });
  assert.deepEqual(rows, [
    { date: '2026-10-20', status: 'submitted', note: 'Leave calendar, PR reviews' },
    { date: '2026-10-19', status: 'submitted', note: 'Retro themes' },
    { date: '2026-10-16', status: 'missed', note: '' },
    { date: '2026-10-15', status: 'submitted', note: 'Poker results' },
  ]);
});

test('with the next working day selected, today is listed but never counted as missed', () => {
  const rows = recentStandups(mine, {
    before: '2026-10-26', today: '2026-10-21', holidayDates: none, employee: me, user: null, firstQuestion, count: 3,
  });
  assert.deepEqual(rows.map((r) => [r.date, r.status]), [
    ['2026-10-21', 'pending'],
    ['2026-10-20', 'submitted'],
    ['2026-10-19', 'submitted'],
  ]);
});

test('today counts as submitted once it is in, and future working days are left out', () => {
  const withToday = [...mine, { date: '2026-10-21', email: 'asha@heubert.com', name: 'Asha', answers: { question_1: 'Standup page' } }];
  // Selected day far ahead (Fri 23rd is a future working day before it): only today and earlier are listed.
  const rows = recentStandups(withToday, {
    before: '2026-10-26', today: '2026-10-21', holidayDates: new Set(['2026-10-22']), employee: me, user: null, firstQuestion, count: 2,
  });
  assert.deepEqual(rows, [
    { date: '2026-10-21', status: 'submitted', note: 'Standup page' },
    { date: '2026-10-20', status: 'submitted', note: 'Leave calendar, PR reviews' },
  ]);
});

test('public holidays are skipped, not missed, and the count defaults to five', () => {
  const rows = recentStandups(mine, {
    before: '2026-10-21', today: '2026-10-21', holidayDates: new Set(['2026-10-16']), employee: me, user: null, firstQuestion,
  });
  assert.equal(rows.length, 5);
  assert.deepEqual(rows.slice(0, 3).map((r) => [r.date, r.status]), [
    ['2026-10-20', 'submitted'],
    ['2026-10-19', 'submitted'],
    ['2026-10-15', 'submitted'],
  ]);
});

test('without a first question a submitted day still shows, with an empty note', () => {
  const rows = recentStandups(mine, { before: '2026-10-21', today: '2026-10-21', employee: me, count: 1 });
  assert.deepEqual(rows, [{ date: '2026-10-20', status: 'submitted', note: '' }]);
});

// Leaves as AppContext holds them: matched by employee_name, by the `dates` list when the
// row has one, else by start_date..end_date (the Meeting page's on-leave rule).
const leaves = [
  { employee_name: 'Asha Rai', type: 'full', dates: ['2026-10-16'], start_date: '2026-10-16', end_date: '2026-10-16' },
  { employee_name: 'Asha Rai', type: 'full', start_date: '2026-10-13T00:00:00', end_date: '2026-10-14' },
  { employee_name: 'Asha Rai', type: 'half', reason: '[First Half] dentist', dates: ['2026-10-12'], start_date: '2026-10-12', end_date: '2026-10-12' },
  { employee_name: 'Asha Rai', type: 'early', dates: ['2026-10-09'], start_date: '2026-10-09', end_date: '2026-10-09' },
  { employee_name: 'Bikash Thapa', type: 'full', dates: ['2026-10-15'], start_date: '2026-10-15', end_date: '2026-10-15' },
];
const recentFor = (extra) => recentStandups(mine, {
  before: '2026-10-21', today: '2026-10-21', holidayDates: none, employee: me, user: null, firstQuestion, count: 9, leaves, ...extra,
});

test('a past working day on full-day leave shows "leave", not missed', () => {
  const byDate = Object.fromEntries(recentFor().map((r) => [r.date, r.status]));
  assert.equal(byDate['2026-10-16'], 'leave'); // the dates list
  assert.equal(byDate['2026-10-14'], 'leave'); // the start..end range, legacy rows
  assert.equal(byDate['2026-10-13'], 'leave');
});

test('half-day and early leave still expect a standup, so a gap is missed', () => {
  const byDate = Object.fromEntries(recentFor().map((r) => [r.date, r.status]));
  assert.equal(byDate['2026-10-12'], 'missed');
  assert.equal(byDate['2026-10-09'], 'missed');
});

test('someone else\'s leave does not excuse you, and a submission on a leave day still counts', () => {
  const byDate = Object.fromEntries(recentFor().map((r) => [r.date, r.status]));
  assert.equal(byDate['2026-10-15'], 'submitted');
  const withLeaveDay = [...mine, { date: '2026-10-16', email: 'asha@heubert.com', name: 'Asha', answers: { question_1: 'Came in anyway' } }];
  const rows = recentStandups(withLeaveDay, {
    before: '2026-10-21', today: '2026-10-21', employee: me, firstQuestion, count: 3, leaves,
  });
  assert.deepEqual(rows[2], { date: '2026-10-16', status: 'submitted', note: 'Came in anyway' });
});

test('days before the joined date are left out, not missed', () => {
  const rows = recentStandups(mine, {
    before: '2026-10-21', today: '2026-10-21', employee: { ...me, joined_date: '2026-10-16' }, firstQuestion, count: 5, leaves,
  });
  assert.deepEqual(rows.map((r) => [r.date, r.status]), [
    ['2026-10-20', 'submitted'],
    ['2026-10-19', 'submitted'],
    ['2026-10-16', 'leave'],
  ]);
  const ts = recentStandups(mine, {
    before: '2026-10-21', today: '2026-10-21', employee: { ...me, joined_date: '2026-10-19T00:00:00+05:45' }, firstQuestion, count: 5,
  });
  assert.deepEqual(ts.map((r) => r.date), ['2026-10-20', '2026-10-19']);
});
