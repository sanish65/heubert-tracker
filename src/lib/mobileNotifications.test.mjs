import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import * as web from './notifications.js';
import * as phone from '../../mobile/lib/notifications.js';

// The phone cannot import from src/, so mobile/lib/notifications.js carries its own copy of the
// bell's list: the fines recorded against you lately, and how many arrived since the bell was last
// opened. Each test below runs the web module and the phone copy on the same inputs and demands the
// same answer, so a rule changed on one side and not the other fails here. What the web module
// answers is pinned by notifications.test.mjs, whose fixtures are reused below; these tables only
// have to reach every branch and edge of the copied code.

const now = new Date('2026-10-20T01:00:00Z');

const fines = [
  { id: 1, employee_name: 'Sanish', date: '2026-10-19', amount: 50, status: 'unpaid', created_at: '2026-10-19T03:00:00+00:00', season_id: 5 },
  { id: 2, employee_name: 'Sanish', date: '2026-08-01', amount: 20, status: 'paid', created_at: '2026-08-01T03:00:00+00:00' },
  { id: 3, employee_name: 'Nikhil', date: '2026-10-19', amount: 50, status: 'unpaid', created_at: '2026-10-19T04:00:00+00:00' },
  { id: 4, employee_name: 'Sanish', date: '2026-10-10', amount: 30, status: 'paid' },
];

const standupFines = [
  { id: 7, employee_name: 'Sanish', date: '2026-10-15', status: 'unpaid', created_at: '2026-10-15T05:00:00.123456+00:00' },
  { id: 8, employee_name: 'sanish', date: '2026-10-16', status: 'unpaid', created_at: '2026-10-16T05:00:00+00:00' },
];

// Exactly 30 days before `now`, and one second earlier.
const edge = [
  { id: 10, employee_name: 'Sanish', date: '2026-09-20', amount: 10, status: 'unpaid', created_at: '2026-09-20T01:00:00Z' },
  { id: 11, employee_name: 'Sanish', date: '2026-09-20', amount: 10, status: 'unpaid', created_at: '2026-09-20T00:59:59Z' },
];

const broken = [{ id: 20, employee_name: 'Sanish', amount: 10, status: 'unpaid', created_at: null, date: null }];

// Branches the expected lists of notifications.test.mjs do not reach: a season id of 0, an amount
// that is text, not a number or missing, a created_at that does not parse (the date stands in), and
// a name that is only nearly the person's.
const odd = [
  { id: 30, employee_name: 'Sanish', date: '2026-10-18', amount: '25', status: 'unpaid', created_at: '2026-10-18T00:00:00Z', season_id: 0 },
  { id: 31, employee_name: 'Sanish', date: '2026-10-17', amount: 'abc', status: 'unpaid', created_at: 'garbage' },
  { id: 32, employee_name: 'Sanish', date: '2026-10-16', status: 'paid', created_at: '2026-10-16T00:00:00Z' },
  { id: 33, employee_name: ' Sanish ', date: '2026-10-16', amount: 5, status: 'paid', created_at: '2026-10-16T00:00:00Z' },
];

// A late and a standup fine recorded at the same moment, and rows with a blank or missing name.
const tied = [{ id: 50, employee_name: 'Sanish', date: '2026-10-19', amount: 1, status: 'unpaid', created_at: '2026-10-19T06:00:00Z' }];
const tiedStandup = [{ id: 51, employee_name: 'Sanish', date: '2026-10-19', status: 'unpaid', created_at: '2026-10-19T06:00:00Z' }];
const nameless = [
  { id: 60, employee_name: '', date: '2026-10-19', amount: 1, status: 'unpaid', created_at: '2026-10-19T06:00:00Z' },
  { id: 61, date: '2026-10-19', amount: 1, status: 'unpaid', created_at: '2026-10-19T06:00:00Z' },
];

const show = (value) => inspect(value, { depth: 1, maxStringLength: 48, breakLength: Infinity });

// What a call gave: its answer, or the kind of error it threw.
function outcome(fn, args) {
  try {
    return { returned: fn(...args) };
  } catch (error) {
    return { threw: error?.name };
  }
}

// Calls `name` from both modules with every argument list and demands equal outcomes.
function sameOnEvery(name, argLists) {
  assert.equal(typeof phone[name], 'function', `mobile/lib/notifications.js does not export ${name}`);
  for (const args of argLists) {
    assert.deepEqual(outcome(phone[name], args), outcome(web[name], args), `${name}(${args.map(show).join(', ')})`);
  }
}

const listOf = (extra) => [{ fines, standupFines, name: 'Sanish', now, ...extra }];

test('the window and the list length are the web ones', () => {
  assert.deepEqual([phone.NOTIFY_DAYS, phone.NOTIFY_LIMIT], [web.NOTIFY_DAYS, web.NOTIFY_LIMIT]);
});

test('myFineNotifications gives what the web gives, for every scenario', () => {
  sameOnEvery('myFineNotifications', [
    listOf(),
    listOf({ name: 'Nikhil' }),
    listOf({ name: 'sanish' }),
    listOf({ name: 'Nobody' }),
    [{ fines: edge, standupFines: [], name: 'Sanish', now }],
    listOf({ days: 5 }),
    listOf({ limit: 2 }),
    listOf({ limit: 0 }),
    listOf({ lateExcluded: true }),
    listOf({ standupExcluded: true }),
    listOf({ lateExcluded: true, standupExcluded: true }),
    [{ fines: broken, standupFines: [], name: 'Sanish', now }],
    [{ fines: odd, standupFines: [], name: 'Sanish', now }],
    [{ fines: tied, standupFines: tiedStandup, name: 'Sanish', now }],
    [{ fines: nameless, standupFines: nameless, name: '', now }],
    [{ fines: nameless, standupFines: nameless, name: undefined, now }],
    [{ fines: nameless, standupFines: nameless, name: null, now }],
    listOf({ now: '2026-10-20T01:00:00Z' }),
    listOf({ now: now.getTime() }),
    [{ fines: null, standupFines: undefined, name: 'Sanish', now }],
    listOf({ name: null }),
    listOf({ name: '' }),
    [undefined],
    [],
  ]);
});

const items = [
  { id: 'late-1', at: '2026-10-19T03:00:00.000Z' },
  { id: 'standup-7', at: '2026-10-15T05:00:00.000Z' },
];

// Supabase writes timestamps with six fraction digits. Hermes, the phone's engine, may refuse more
// than three; Node does not, so Date.parse is made to refuse them here. A fine read that way would
// fall back to its date (midnight) and could be missed as new by the bell.
test('the phone copy gives the exact time of a fine stamped with six fraction digits', () => {
  const realParse = Date.parse;
  Date.parse = (value) => (/\.\d{4,}/.test(String(value)) ? NaN : realParse(value));
  try {
    const [item] = phone.myFineNotifications({
      fines: [{ id: 70, employee_name: 'Sanish', date: '2026-10-15', amount: 50, status: 'unpaid', created_at: '2026-10-15T05:00:00.123456+00:00' }],
      standupFines: [],
      name: 'Sanish',
      now,
    });
    assert.equal(item?.at, '2026-10-15T05:00:00.123Z');
  } finally {
    Date.parse = realParse;
  }
});

test('unseenCount gives what the web gives, for every opening time', () => {
  sameOnEvery('unseenCount', [
    [items, null],
    [items, undefined],
    [items, '2026-10-17T00:00:00.000Z'],
    [items, '2026-10-19T03:00:00.000Z'],
    [items, '2026-10-19T02:59:59.999Z'],
    [items, 'not a date'],
    [items, ''],
    [null, null],
    [undefined, '2026-10-17T00:00:00.000Z'],
    [[], null],
    [[{ id: 'x' }, { id: 'y', at: 'garbage' }], '2026-10-17T00:00:00.000Z'],
  ]);
});

// Task notifications: every kind, a status key and a custom status name, a missing actor and
// issue, a read row, and Supabase's six-digit timestamps (stored back as plain ISO).
const taskRows = [
  { id: 1, kind: 'assigned', actor_name: 'Bob Dev', created_at: '2026-10-21T10:00:00.123456+00:00', task: { title: 'Build login' } },
  { id: 2, kind: 'mentioned', actor_name: 'Ana', detail: '@Sanish look', created_at: '2026-10-21T09:00:00Z', read_at: '2026-10-21T09:30:00Z', task: { title: 'Pay' } },
  { id: 3, kind: 'commented', detail: '', created_at: '2026-10-20T09:00:00Z', task: null },
  { id: 4, kind: 'status', actor_name: 'Ana', detail: 'in_progress', created_at: '2026-10-19T09:00:00Z', task: { title: 'A' } },
  { id: 5, kind: 'status', actor_name: 'Ana', detail: 'In QA', created_at: 'garbage', task: { title: 'B' } },
  { id: 6, kind: 'status', created_at: null },
];

test('taskNotificationItem gives what the web gives', () => {
  sameOnEvery('taskNotificationItem', taskRows.map((row) => [row, 'POR-4']));
  assert.equal(phone.taskNotificationItem(taskRows[0], 'POR-4').at, '2026-10-21T10:00:00.123Z');
});

test('mergeNotifications gives what the web gives', () => {
  const tasks = taskRows.slice(0, 4).map((row) => web.taskNotificationItem(row, 'POR-4'));
  const fineItems = web.myFineNotifications({ fines, standupFines, name: 'Sanish', now });
  sameOnEvery('mergeNotifications', [[fineItems, tasks], [fineItems, tasks, 3], [null, tasks], [fineItems, undefined], [[], []]]);
});
