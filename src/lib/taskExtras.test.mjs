import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseDuration,
  formatDuration,
  timeTracking,
  kanbanIssues,
  normalizeWipLimits,
  wipStatus,
  flowStats,
  versionProgress,
  sortVersions,
  isVersionOverdue,
  cloneFields,
  mentionQueryAt,
  mentionCandidates,
  insertMention,
  mentionedIds,
} from './taskExtras.js';

// ── time ──
test('durations parse Jira units, with a bare number as hours', () => {
  assert.equal(parseDuration('1w 2d 3h 30m'), 2400 + 960 + 180 + 30);
  assert.equal(parseDuration('1.5h'), 90);
  assert.equal(parseDuration('90m'), 90);
  assert.equal(parseDuration('2'), 120);
  assert.equal(parseDuration(' 1H  15M '), 75);
  assert.equal(parseDuration('0'), null);
  assert.equal(parseDuration('soon'), null);
  assert.equal(parseDuration('3x'), null);
  assert.equal(parseDuration(''), null);
});

test('durations format back with 8-hour days and 5-day weeks', () => {
  assert.equal(formatDuration(90), '1h 30m');
  assert.equal(formatDuration(600), '1d 2h');
  assert.equal(formatDuration(2400), '1w');
  assert.equal(formatDuration(0), '0m');
  assert.equal(formatDuration(null), '');
});

test('time tracking falls back to what the original estimate has left', () => {
  assert.deepEqual(timeTracking({ time_spent_min: 120, original_estimate_min: 480, remaining_estimate_min: null }), {
    spent: 120, remaining: 360, original: 480, spentPct: 25, overMinutes: 0, hasAny: true,
  });
  const over = timeTracking({ time_spent_min: 600, original_estimate_min: 480, remaining_estimate_min: 60 });
  assert.equal(over.overMinutes, 180);
  assert.equal(timeTracking({}).hasAny, false);
});

// ── kanban ──
const NOW = Date.parse('2026-10-21T12:00:00Z');
const ago = (d) => new Date(NOW - d * 86400000).toISOString();

test('the Kanban board drops epics and old done issues', () => {
  const tasks = [
    { id: 1, type: 'epic', status: 'todo' },
    { id: 2, type: 'story', status: 'todo' },
    { id: 3, type: 'task', status: 'done', completed_at: ago(3) },
    { id: 4, type: 'bug', status: 'done', completed_at: ago(20) },
  ];
  assert.deepEqual(kanbanIssues(tasks, NOW).map((t) => t.id), [2, 3]);
});

test('WIP limits keep positive whole numbers on limitable columns', () => {
  assert.deepEqual(normalizeWipLimits({ in_progress: '3', review: 0, done: 5, todo: -1, junk: 2 }), { in_progress: 3 });
  assert.deepEqual(wipStatus(4, 3), { limit: 3, over: true, full: false });
  assert.deepEqual(wipStatus(3, 3), { limit: 3, over: false, full: true });
  assert.equal(wipStatus(5, undefined), null);
});

test('flow stats count recent finishes and their cycle time', () => {
  const tasks = [
    { type: 'story', status: 'done', created_at: ago(10), completed_at: ago(4) },
    { type: 'task', status: 'done', created_at: ago(5), completed_at: ago(1) },
    { type: 'task', status: 'done', created_at: ago(90), completed_at: ago(60) },
    { type: 'epic', status: 'done', created_at: ago(9), completed_at: ago(2) },
  ];
  assert.deepEqual(flowStats(tasks, NOW, 30), { throughput: 2, avgCycleDays: 5 });
  assert.deepEqual(flowStats([], NOW), { throughput: 0, avgCycleDays: null });
});

// ── releases ──
test('release progress counts its issues by status, epics aside', () => {
  const tasks = [
    { fix_version_id: 1, type: 'story', status: 'done' },
    { fix_version_id: 1, type: 'bug', status: 'review' },
    { fix_version_id: 1, type: 'task', status: 'todo' },
    { fix_version_id: 1, type: 'epic', status: 'done' },
    { fix_version_id: 2, type: 'task', status: 'done' },
  ];
  assert.deepEqual(versionProgress(1, tasks), { total: 3, done: 1, inProgress: 1, todo: 1, percent: 33 });
});

test('releases sort unreleased by date, then released newest first, archived last', () => {
  const v = [
    { id: 1, name: 'A', status: 'released', released_at: '2026-09-01' },
    { id: 2, name: 'B', status: 'unreleased' },
    { id: 3, name: 'C', status: 'unreleased', release_date: '2026-11-01' },
    { id: 4, name: 'D', status: 'archived' },
    { id: 5, name: 'E', status: 'released', released_at: '2026-10-01' },
    { id: 6, name: 'F', status: 'unreleased', release_date: '2026-10-25' },
  ];
  assert.deepEqual(sortVersions(v).map((x) => x.id), [6, 3, 2, 5, 1, 4]);
  assert.equal(isVersionOverdue({ status: 'unreleased', release_date: '2026-10-01' }, '2026-10-21'), true);
  assert.equal(isVersionOverdue({ status: 'released', release_date: '2026-10-01' }, '2026-10-21'), false);
});

// ── cloning ──
test('a clone copies content and plan, starts fresh', () => {
  const c = cloneFields({ type: 'subtask', title: 'Card form', priority: 'high', parent_id: 9, sprint_id: 4, labels: ['ui'], original_estimate_min: 120, time_spent_min: 60, status: 'done' });
  assert.equal(c.title, 'CLONE - Card form');
  assert.equal(c.parent_id, 9);
  assert.equal(c.sprint_id, null);
  assert.equal(c.remaining_estimate_min, 120);
  assert.equal('status' in c, false);
  assert.equal('time_spent_min' in c, false);
});

// ── mentions ──
const people = [
  { id: 1, name: 'Alice Admin', status: 'active' },
  { id: 2, name: 'Bob Dev', status: 'active' },
  { id: 3, name: 'Alina Old', status: 'inactive' },
];

test('the mention being typed is found before the caret, not after a space', () => {
  assert.deepEqual(mentionQueryAt('hi @al', 6), { query: 'al', start: 3 });
  assert.deepEqual(mentionQueryAt('@', 1), { query: '', start: 0 });
  assert.equal(mentionQueryAt('mail me@x', 9), null);
  assert.equal(mentionQueryAt('@Alice Admin thanks', 19), null);
});

test('candidates match any word of active names; picking inserts the full name', () => {
  assert.deepEqual(mentionCandidates(people, 'a').map((p) => p.id), [1]);
  assert.deepEqual(mentionCandidates(people, 'dev').map((p) => p.id), [2]);
  assert.deepEqual(insertMention('hi @al!', 3, 6, 'Alice Admin'), { text: 'hi @Alice Admin !', caret: 16 });
});

test('only mentions still in the text are sent', () => {
  assert.deepEqual(mentionedIds('thanks @Bob Dev', [people[0], people[1], people[1]]), [2]);
});

test('zero is a valid remaining estimate only when asked for', () => {
  assert.equal(parseDuration('0', { allowZero: true }), 0);
  assert.equal(parseDuration('0m', { allowZero: true }), 0);
  assert.equal(parseDuration('0'), null);
});

test('a clone of an issue in a closed sprint lands in the backlog', () => {
  const sprints = [{ id: 4, state: 'closed' }, { id: 5, state: 'active' }];
  assert.equal(cloneFields({ type: 'task', title: 'x', sprint_id: 4 }, sprints).sprint_id, null);
  assert.equal(cloneFields({ type: 'task', title: 'x', sprint_id: 5 }, sprints).sprint_id, 5);
  assert.equal(cloneFields({ type: 'task', title: 'x', sprint_id: 5 }).sprint_id, null);
});
