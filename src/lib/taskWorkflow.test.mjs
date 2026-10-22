import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_WORKFLOW,
  workflowFrom,
  statusMeta,
  firstStatusOf,
  withCategories,
  isDone,
  isInProgress,
  statusKeyFor,
  validateWorkflow,
} from './taskWorkflow.js';
import { groupByStatus, backlogSections, childProgress } from './taskBoard.js';
import { versionProgress, normalizeWipLimits } from './taskExtras.js';

const rows = [
  { id: 3, key: 'released', name: 'Released', category: 'done', sort_order: 5 },
  { id: 1, key: 'todo', name: 'To Do', category: 'todo', sort_order: 0 },
  { id: 2, key: 'qa', name: 'QA', category: 'progress', sort_order: 3 },
];
const wf = workflowFrom(rows);

test('rows become a workflow in board order; no rows means the default', () => {
  assert.deepEqual(wf.map((s) => s.value), ['todo', 'qa', 'released']);
  assert.equal(workflowFrom([]), DEFAULT_WORKFLOW);
});

test('custom statuses wear their category colour, built-ins their own', () => {
  assert.deepEqual([statusMeta('qa', wf).label, statusMeta('qa', wf).cls], ['QA', 'in_progress']);
  assert.equal(statusMeta('released', wf).cls, 'done');
  assert.equal(statusMeta('review', wf).cls, 'review');
  assert.deepEqual([statusMeta('gone', wf).label, statusMeta('gone', wf).category], ['gone', 'todo']);
  assert.equal(firstStatusOf(wf, 'done'), 'released');
});

test('done and in-progress follow the category, not the word', () => {
  const [a, b, c] = withCategories([{ status: 'released' }, { status: 'qa' }, { status: 'done' }], wf);
  assert.equal(isDone(a), true);
  assert.equal(isInProgress(b), true);
  // "done" isn't in this workflow but keeps its built-in meaning, as in the database.
  assert.equal(isDone(c), true);
  assert.equal(isDone({ status: 'done' }), true);
});

test('board, backlog, progress and releases all use the categories', () => {
  const tasks = withCategories([
    { id: 1, status: 'released', type: 'task', sprint_id: null, fix_version_id: 7, parent_id: 9 },
    { id: 2, status: 'qa', type: 'task', sprint_id: null, fix_version_id: 7, parent_id: 9 },
    { id: 3, status: 'review', type: 'task', sprint_id: null, fix_version_id: 7 },
  ], wf);
  const cols = groupByStatus(tasks, wf);
  assert.deepEqual(Object.keys(cols), ['todo', 'qa', 'released']);
  // "review" isn't a column here: it lands in the first in-progress one.
  assert.deepEqual(cols.qa.map((t) => t.id), [2, 3]);
  assert.deepEqual(backlogSections(tasks, []).backlog.map((t) => t.id), [2, 3]);
  assert.deepEqual(childProgress(9, tasks), { total: 2, done: 1, percent: 50 });
  assert.deepEqual(versionProgress(7, tasks), { total: 3, done: 1, inProgress: 2, todo: 0, percent: 33 });
  assert.deepEqual(normalizeWipLimits({ qa: 2, todo: 0 }, ['todo', 'qa']), { qa: 2 });
});

test('status keys are slugs, unique within the project', () => {
  assert.equal(statusKeyFor('Ready for QA'), 'ready_for_qa');
  assert.equal(statusKeyFor('QA', ['qa']), 'qa_2');
  assert.equal(statusKeyFor('2nd review'), 's_2nd_review');
  assert.equal(statusKeyFor('!!!'), 'status');
});

test('a workflow keeps names and at least one to-do and one done status', () => {
  assert.equal(validateWorkflow(wf), null);
  assert.match(validateWorkflow(wf.filter((s) => s.category !== 'done')), /Done/);
  assert.match(validateWorkflow(wf.filter((s) => s.category !== 'todo')), /To Do/);
  assert.match(validateWorkflow([...wf, { value: 'x', label: 'qa', category: 'progress' }]), /same name/);
  assert.match(validateWorkflow([{ value: 'a', label: ' ', category: 'todo' }]), /name/);
});

test('transitions: a status may limit where its issues go next', async () => {
  const { canTransition, nextStatuses } = await import('./taskWorkflow.js');
  const flow = [
    { value: 'todo', label: 'To Do', category: 'todo', next: null },
    { value: 'dev', label: 'In Dev', category: 'progress', next: ['qa'] },
    { value: 'qa', label: 'In QA', category: 'progress', next: ['dev', 'done'] },
    { value: 'done', label: 'Done', category: 'done', next: null },
  ];
  assert.equal(canTransition('todo', 'done', flow), true);
  assert.equal(canTransition('dev', 'done', flow), false);
  assert.equal(canTransition('dev', 'dev', flow), true);
  assert.equal(canTransition('gone', 'done', flow), true);
  assert.deepEqual(nextStatuses('qa', flow).map((s) => s.value), ['dev', 'qa', 'done']);
  // Removing a status's only target leaves it stuck: an error, not a silent "any".
  assert.equal(validateWorkflow(flow), null);
  assert.match(validateWorkflow(flow.filter((s) => s.value !== 'qa')), /In Dev/);
});
