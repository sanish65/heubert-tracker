import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NOTIFY_DAYS, NOTIFY_LIMIT, myFineNotifications, unseenCount } from './notifications.js';

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

const ids = (list) => list.map((item) => item.id);

test('the window is 30 days and the list holds 10', () => {
  assert.equal(NOTIFY_DAYS, 30);
  assert.equal(NOTIFY_LIMIT, 10);
});

test('my recent fines, late and standup merged, newest first', () => {
  assert.deepEqual(myFineNotifications({ fines, standupFines, name: 'Sanish', now }), [
    { id: 'late-1', kind: 'late', date: '2026-10-19', at: '2026-10-19T03:00:00.000Z', amount: 50, seasonId: 5, status: 'unpaid' },
    { id: 'standup-7', kind: 'standup', date: '2026-10-15', at: '2026-10-15T05:00:00.123Z', status: 'unpaid' },
    { id: 'late-4', kind: 'late', date: '2026-10-10', at: '2026-10-10T00:00:00.000Z', amount: 30, seasonId: null, status: 'paid' },
  ]);
});

test("a late item names its fine's season, so the bell can open Late Fines on it; no season is null", () => {
  const [late1, , late4] = myFineNotifications({ fines, standupFines, name: 'Sanish', now });
  assert.equal(late1.seasonId, 5);
  assert.equal(late4.seasonId, null);
});

test('only the exact name, as the fine tables filter', () => {
  const items = myFineNotifications({ fines, standupFines, name: 'Nikhil', now });
  assert.deepEqual(ids(items), ['late-3']);
});

test('a fine recorded more than 30 days ago is left out; exactly 30 days is kept', () => {
  const edge = [
    { id: 10, employee_name: 'Sanish', date: '2026-09-20', amount: 10, status: 'unpaid', created_at: '2026-09-20T01:00:00Z' },
    { id: 11, employee_name: 'Sanish', date: '2026-09-20', amount: 10, status: 'unpaid', created_at: '2026-09-20T00:59:59Z' },
  ];
  assert.deepEqual(ids(myFineNotifications({ fines: edge, standupFines: [], name: 'Sanish', now })), ['late-10']);
});

test('limit caps the list', () => {
  assert.deepEqual(ids(myFineNotifications({ fines, standupFines, name: 'Sanish', now, limit: 2 })), ['late-1', 'standup-7']);
});

test('a list the person is excluded from is left out entirely', () => {
  assert.deepEqual(ids(myFineNotifications({ fines, standupFines, name: 'Sanish', now, standupExcluded: true })), ['late-1', 'late-4']);
  assert.deepEqual(ids(myFineNotifications({ fines, standupFines, name: 'Sanish', now, lateExcluded: true })), ['standup-7']);
});

test('a row with no usable time is skipped', () => {
  const broken = [{ id: 20, employee_name: 'Sanish', amount: 10, status: 'unpaid', created_at: null, date: null }];
  assert.deepEqual(myFineNotifications({ fines: broken, standupFines: [], name: 'Sanish', now }), []);
});

test('no name, no notifications', () => {
  assert.deepEqual(myFineNotifications({ fines, standupFines, name: null, now }), []);
  assert.deepEqual(myFineNotifications({ fines, standupFines, name: '', now }), []);
});

// ── unseenCount ─────────────────────────────────────────────────────────────

const items = [
  { id: 'late-1', at: '2026-10-19T03:00:00.000Z' },
  { id: 'standup-7', at: '2026-10-15T05:00:00.000Z' },
];

test('never opened: everything is unseen', () => {
  assert.equal(unseenCount(items, null), 2);
  assert.equal(unseenCount(items, undefined), 2);
});

test('only what came after the last opening is unseen', () => {
  assert.equal(unseenCount(items, '2026-10-17T00:00:00.000Z'), 1);
  assert.equal(unseenCount(items, '2026-10-19T03:00:00.000Z'), 0);
});

test('a stored time that does not parse counts as never opened', () => {
  assert.equal(unseenCount(items, 'not a date'), 2);
});

test('task notifications read like Jira and merge with fines by time', async () => {
  const { taskNotificationItem, mergeNotifications } = await import('./notifications.js');
  const base = { id: 7, actor_name: 'Bob Dev', created_at: '2026-10-21T10:00:00Z', task: { title: 'Build login' } };
  assert.equal(taskNotificationItem({ ...base, kind: 'assigned' }, 'POR-4').text, 'Bob Dev assigned POR-4 to you');
  assert.equal(taskNotificationItem({ ...base, kind: 'status', detail: 'in_progress' }, 'POR-4').text, 'Bob Dev moved POR-4 to In Progress');
  const mention = taskNotificationItem({ ...base, kind: 'mentioned', detail: '@Alice look', read_at: '2026-10-21T11:00:00Z' }, 'POR-4');
  assert.deepEqual([mention.sub, mention.read, mention.id], ['@Alice look', true, 'task-7']);
  const merged = mergeNotifications([{ id: 'late-1', at: '2026-10-20T00:00:00Z' }], [mention], 15);
  assert.deepEqual(merged.map((i) => i.id), ['task-7', 'late-1']);
});
