import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileQuery, sortIssues, BUILT_IN_FILTERS } from './taskQuery.js';
import { withCategories } from './taskWorkflow.js';

const NOW = Date.parse('2026-10-22T06:00:00Z'); // 11:45 in Kathmandu
const ago = (d) => new Date(NOW - d * 86400000).toISOString();
const workflow = [
  { value: 'todo', label: 'To Do', category: 'todo' },
  { value: 'qa', label: 'QA', category: 'progress' },
  { value: 'released', label: 'Released', category: 'done' },
];
const employees = [
  { id: 5, name: 'Sanish Maharjan', work_email: 'sanish@heubert.com' },
  { id: 6, name: 'Kriti Joshi' },
];
const sprints = [{ id: 10, name: 'POR Sprint 3', state: 'active' }, { id: 11, name: 'POR Sprint 4', state: 'future' }, { id: 9, name: 'Old', state: 'closed' }];
const versions = [{ id: 1, name: 'v1.4', status: 'unreleased' }, { id: 2, name: 'v1.3', status: 'released' }];
const tasks = withCategories([
  { id: 1, number: 1, type: 'epic', title: 'Checkout', status: 'todo', created_at: ago(40), updated_at: ago(30) },
  { id: 2, number: 2, type: 'story', title: 'Pay by card', description: 'Stripe form', status: 'qa', parent_id: 1, assignee_id: 5, priority: 'high', labels: ['UI', 'payments'], sprint_id: 10, fix_version_id: 1, estimate: 5, created_at: ago(10), updated_at: ago(1), due_date: '2026-10-20', flagged: true },
  { id: 3, number: 3, type: 'bug', title: 'Total wrong', status: 'todo', assignee_id: null, reporter_id: 5, priority: 'highest', labels: [], sprint_id: null, estimate: 2, created_at: ago(5), updated_at: ago(5) },
  { id: 4, number: 4, type: 'subtask', title: 'Card form', status: 'released', parent_id: 2, assignee_id: 6, priority: 'low', sprint_id: 10, created_at: ago(9), updated_at: ago(2), completed_at: ago(2) },
], workflow);
const ctx = {
  me: 5, employees, sprints, versions, workflow, tasks,
  tasksById: new Map(tasks.map((t) => [t.id, t])),
  keyOf: (t) => `POR-${t.number}`,
  nowMs: NOW, todayStr: '2026-10-22',
};
const run = (q) => {
  const c = compileQuery(q, ctx);
  assert.ok(c.ok, c.error);
  return tasks.filter(c.predicate).map((t) => t.id);
};

test('an empty query matches everything', () => {
  assert.deepEqual(run(''), [1, 2, 3, 4]);
});

test('people: currentUser(), names, first names, EMPTY', () => {
  assert.deepEqual(run('assignee = currentUser()'), [2]);
  assert.deepEqual(run('assignee = "Kriti Joshi"'), [4]);
  assert.deepEqual(run('assignee = kriti'), [4]);
  assert.deepEqual(run('assignee IS EMPTY'), [1, 3]);
  assert.deepEqual(run('assignee in (currentUser(), kriti)'), [2, 4]);
  assert.deepEqual(run('reporter = currentUser()'), [3]);
});

test('status by key or name, and status category', () => {
  assert.deepEqual(run('status = QA'), [2]);
  assert.deepEqual(run('status = "to do"'), [1, 3]);
  assert.deepEqual(run('statusCategory = Done'), [4]);
  assert.deepEqual(run('statusCategory != Done'), [1, 2, 3]);
  assert.deepEqual(run('statusCategory = "In Progress"'), [2]);
});

test('type, labels, priority comparisons and points', () => {
  assert.deepEqual(run('type in (bug, story)'), [2, 3]);
  assert.deepEqual(run('type = sub-task'), [4]);
  assert.deepEqual(run('labels = ui'), [2]);
  assert.deepEqual(run('labels IS EMPTY'), [1, 3, 4]);
  assert.deepEqual(run('priority >= high'), [2, 3]);
  assert.deepEqual(run('points > 2'), [2]);
});

test('sprints, releases and epics, including functions', () => {
  assert.deepEqual(run('sprint in openSprints()'), [2, 4]);
  assert.deepEqual(run('sprint = "POR Sprint 3"'), [2, 4]);
  assert.deepEqual(run('sprint IS EMPTY'), [1, 3]);
  assert.deepEqual(run('fixVersion = v1.4'), [2]);
  assert.deepEqual(run('fixVersion in unreleasedVersions()'), [2]);
  // A sub-task belongs to its parent's epic.
  assert.deepEqual(run('epic = POR-1'), [2, 4]);
  assert.deepEqual(run('epic = Checkout'), [2, 4]);
});

test('text, flags and keys', () => {
  assert.deepEqual(run('text ~ stripe'), [2]);
  assert.deepEqual(run('summary ~ "card"'), [2, 4]);
  assert.deepEqual(run('summary !~ card'), [1, 3]);
  assert.deepEqual(run('flagged = true'), [2]);
  assert.deepEqual(run('key in (POR-3, por-4)'), [3, 4]);
});

test('dates: relative, absolute, functions and same-day equality', () => {
  assert.deepEqual(run('updated >= -3d'), [2, 4]);
  assert.deepEqual(run('created < -1w'), [1, 2, 4]);
  assert.deepEqual(run('due < startOfDay()'), [2]);
  assert.deepEqual(run('due = 2026-10-20'), [2]);
  assert.deepEqual(run('resolved IS NOT EMPTY'), [4]);
});

test('AND binds tighter than OR; NOT and brackets work', () => {
  assert.deepEqual(run('type = bug OR type = story AND assignee = kriti'), [3]);
  assert.deepEqual(run('(type = bug OR type = story) AND assignee IS EMPTY'), [3]);
  assert.deepEqual(run('NOT type = epic AND NOT statusCategory = Done'), [2, 3]);
  assert.deepEqual(run('type not in (epic, subtask)'), [2, 3]);
});

test('mistakes come back as readable errors', () => {
  const err = (q) => compileQuery(q, ctx).error;
  assert.match(err('asignee = me'), /Unknown field "asignee"/);
  assert.match(err('status ='), /Expected a value/);
  assert.match(err('type in (bug'), /close the IN list/);
  assert.match(err('summary = "x'), /Unclosed quote/);
  assert.match(err('type = bug status = qa'), /Join conditions with AND or OR/);
  assert.match(err('updated > soon'), /isn't a date/);
  assert.match(err('status > qa'), /can't be compared/);
  assert.match(err('assignee ~ san'), /~ works on text/);
  assert.match(err('ORDER BY colour'), /Can't order by/);
});

test('ORDER BY sorts, with newest first by default', () => {
  const sorted = (q) => {
    const c = compileQuery(q, ctx);
    return sortIssues(tasks.filter(c.predicate), c.order, ctx).map((t) => t.id);
  };
  assert.deepEqual(sorted('type != epic ORDER BY priority DESC'), [3, 2, 4]);
  assert.deepEqual(sorted('type != epic ORDER BY points ASC, key DESC'), [4, 3, 2]);
  // Workflow order: To Do (1, 3), QA (2), Released (4); ties by id.
  assert.deepEqual(sorted('ORDER BY status'), [1, 3, 2, 4]);
  assert.deepEqual(sorted(''), [3, 4, 2, 1]);
});

test('EMPTY in lists, dates and text', () => {
  assert.deepEqual(run('labels in (EMPTY, ui)'), [1, 2, 3, 4]);
  assert.deepEqual(run('labels in (EMPTY, payments)'), [1, 2, 3, 4]);
  assert.deepEqual(run('labels = payments'), [2]);
  assert.deepEqual(run('due = EMPTY'), [1, 3, 4]);
  assert.deepEqual(run('due != EMPTY'), [2]);
  assert.deepEqual(run('description ~ EMPTY'), [1, 3, 4]);
});

test('unknown names are errors, and status names win over keys', () => {
  const err = (q) => compileQuery(q, ctx).error;
  assert.match(err('status = Shipped'), /No status called "Shipped"/);
  assert.match(err('assignee = nobody'), /No one called "nobody"/);
  assert.match(err('sprint = "Sprint 99"'), /No sprint/);
  assert.match(err('fixVersion = v9'), /No release/);
  assert.match(err('type = chore'), /isn't an issue type/);
  assert.match(err('priority = urgent'), /isn't a priority/);
  // "Done" renamed to "Closed" (key done), and a new status called "Done" (key done_2).
  const renamed = [
    { value: 'todo', label: 'To Do', category: 'todo' },
    { value: 'done', label: 'Closed', category: 'done' },
    { value: 'done_2', label: 'Done', category: 'done' },
  ];
  const items = [{ id: 1, status: 'done' }, { id: 2, status: 'done_2' }];
  const c = compileQuery('status = Done', { ...ctx, workflow: renamed });
  assert.deepEqual(items.filter(c.predicate).map((t) => t.id), [2]);
});

test('every built-in filter compiles', () => {
  for (const f of BUILT_IN_FILTERS) assert.ok(compileQuery(f.query, ctx).ok, f.name);
  const c = compileQuery(BUILT_IN_FILTERS.find((f) => f.id === 'overdue').query, ctx);
  assert.deepEqual(tasks.filter(c.predicate).map((t) => t.id), [2]);
});
