import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  issueKey,
  parseIssueKey,
  suggestProjectKey,
  validateProjectKey,
  allowedParentTypes,
  parentCandidates,
  sumPoints,
  childProgress,
  orderBetween,
  orderForDrop,
  orderAtBottom,
  parseLabels,
  describeExternalLink,
  describeIssueLink,
  isOverdue,
  canDeleteTask,
  daysBetween,
  defaultSprintDates,
  nextSprintName,
  filterIssues,
  assigneesOf,
  LINK_CHOICES,
  linkRow,
  activeSprintOf,
  boardIssues,
  groupByStatus,
  swimlanes,
  backlogSections,
  burndownSeries,
  velocitySeries,
  describeActivity,
  LABELS_MAX,
} from './taskBoard.js';

const ids = (list) => list.map((t) => t.id);

// ── keys ──
test('issue keys join the project key and number; unnumbered issues fall back to #id', () => {
  assert.equal(issueKey({ issue_key: 'HTT' }, { id: 9, number: 12 }), 'HTT-12');
  assert.equal(issueKey({ issue_key: null }, { id: 9, number: 12 }), '#9');
  assert.equal(issueKey({ issue_key: 'HTT' }, { id: 9, number: null }), '#9');
});

test('parseIssueKey reads keys case-insensitively and rejects anything else', () => {
  assert.deepEqual(parseIssueKey(' htt-12 '), { key: 'HTT', number: 12 });
  assert.equal(parseIssueKey('HTT12'), null);
  assert.equal(parseIssueKey('1HT-3'), null);
});

test('suggested project keys use initials or the first letters, and dodge clashes', () => {
  assert.equal(suggestProjectKey('Acme Portal'), 'AP');
  assert.equal(suggestProjectKey('Heubert'), 'HEU');
  assert.equal(suggestProjectKey('Acme Portal', ['AP']), 'AP2');
  assert.equal(suggestProjectKey('3D viewer'), 'P3V');
});

test('project keys must match the format and be unique', () => {
  assert.equal(validateProjectKey('HTT', []), null);
  assert.match(validateProjectKey('h', []), /2–10/);
  assert.match(validateProjectKey('HT-T', []), /2–10/);
  assert.match(validateProjectKey('htt', ['HTT']), /already/);
});

// ── hierarchy ──
test('only epics parent standard issues; sub-tasks sit under story, task or bug', () => {
  assert.deepEqual(allowedParentTypes('epic'), []);
  assert.deepEqual(allowedParentTypes('story'), ['epic']);
  assert.deepEqual(allowedParentTypes('subtask'), ['story', 'task', 'bug']);
});

test('parent candidates stay in the project and exclude the issue itself', () => {
  const tasks = [
    { id: 1, type: 'epic', project_id: 1 },
    { id: 2, type: 'epic', project_id: 2 },
    { id: 3, type: 'story', project_id: 1 },
  ];
  assert.deepEqual(ids(parentCandidates(tasks, { id: 3, type: 'story', project_id: 1 })), [1]);
  assert.deepEqual(ids(parentCandidates(tasks, { id: 9, type: 'subtask', project_id: 1 })), [3]);
});

test('points count on standard issues only', () => {
  assert.equal(sumPoints([
    { type: 'story', estimate: 5 },
    { type: 'bug', estimate: '3' },
    { type: 'epic', estimate: 40 },
    { type: 'subtask', estimate: 2 },
    { type: 'task', estimate: null },
  ]), 8);
});

test('child progress counts done children', () => {
  const tasks = [
    { id: 2, parent_id: 1, status: 'done' },
    { id: 3, parent_id: 1, status: 'todo' },
    { id: 4, parent_id: 9, status: 'done' },
  ];
  assert.deepEqual(childProgress(1, tasks), { total: 2, done: 1, percent: 50 });
  assert.deepEqual(childProgress(5, tasks), { total: 0, done: 0, percent: 0 });
});

// ── ranking ──
const column = [
  { id: 1, sort_order: 0 },
  { id: 2, sort_order: 1024 },
  { id: 3, sort_order: 2048 },
];

test('orderBetween takes the midpoint, or steps past a single neighbour', () => {
  assert.equal(orderBetween(0, 1024), 512);
  assert.equal(orderBetween(2048, undefined), 3072);
  assert.equal(orderBetween(undefined, 0), -1024);
  assert.equal(orderBetween(undefined, undefined), 0);
});

test('drops land above the target, at the bottom, and ignore the moving issue', () => {
  assert.equal(orderForDrop(column, 2, 99), 512);
  assert.equal(orderForDrop(column, null, 99), 3072);
  assert.equal(orderForDrop(column, 3, 2), 1024);
  assert.equal(orderForDrop(column, 42, 99), 3072);
  assert.equal(orderAtBottom([]), 0);
});

// ── labels and links ──
test('labels are trimmed, de-duplicated case-insensitively and capped', () => {
  assert.deepEqual(parseLabels(' bug, Frontend ,bug, , FRONTEND'), ['bug', 'Frontend']);
  const many = Array.from({ length: 20 }, (_, i) => `l${i}`).join(',');
  assert.equal(parseLabels(many).length, LABELS_MAX);
});

test('GitHub and Jira links get short labels; other links show their host', () => {
  assert.equal(describeExternalLink('https://github.com/heubert/tracker/pull/12').label, 'heubert/tracker#12');
  assert.equal(describeExternalLink('github.com/heubert/tracker/issues/7').kind, 'github-issue');
  assert.equal(describeExternalLink('https://heubert.atlassian.net/browse/HT-42').label, 'HT-42');
  assert.equal(describeExternalLink('https://www.figma.com/file/abc').label, 'figma.com');
  assert.equal(describeExternalLink(''), null);
});

test('issue links read outward from the source and inward from the target', () => {
  const link = { source_id: 1, target_id: 2, link_type: 'blocks' };
  assert.deepEqual(describeIssueLink(link, 1), { phrase: 'blocks', otherId: 2 });
  assert.deepEqual(describeIssueLink(link, 2), { phrase: 'is blocked by', otherId: 1 });
});

// ── dates, permissions, sprints ──
test('overdue only when the due date has passed and the issue is open', () => {
  assert.equal(isOverdue({ due_date: '2026-10-01', status: 'todo' }, '2026-10-19'), true);
  assert.equal(isOverdue({ due_date: '2026-10-19', status: 'todo' }, '2026-10-19'), false);
  assert.equal(isOverdue({ due_date: '2026-10-01', status: 'done' }, '2026-10-19'), false);
});

test('admins or the creator may delete an issue', () => {
  const task = { created_by: 'Sanish@heubert.com' };
  assert.equal(canDeleteTask({ task, isAdmin: true, email: 'x@y.com' }), true);
  assert.equal(canDeleteTask({ task, isAdmin: false, email: 'sanish@heubert.com' }), true);
  assert.equal(canDeleteTask({ task, isAdmin: false, email: 'other@heubert.com' }), false);
});

test('a default sprint is two weeks including today', () => {
  assert.deepEqual(defaultSprintDates('2026-10-19'), { start: '2026-10-19', end: '2026-11-01' });
  assert.equal(daysBetween('2026-10-19', '2026-11-01'), 13);
});

test('sprint names count on from the highest number used', () => {
  assert.equal(nextSprintName('HTT', []), 'HTT Sprint 1');
  assert.equal(nextSprintName('HTT', [{ name: 'HTT Sprint 3' }, { name: 'Hardening' }, { name: 'HTT Sprint 1' }]), 'HTT Sprint 4');
});

// ── views ──
const NOW = Date.parse('2026-10-19T12:00:00Z');
const daysAgo = (n) => new Date(NOW - n * 86400000).toISOString();
const issues = [
  { id: 1, type: 'epic', title: 'Checkout', status: 'todo', sprint_id: null, updated_at: daysAgo(30) },
  { id: 2, type: 'story', title: 'Pay by card', status: 'in_progress', parent_id: 1, sprint_id: 10, assignee_id: 5, sort_order: 2, updated_at: daysAgo(1), labels: ['payments'] },
  { id: 3, type: 'bug', title: 'Total wrong', status: 'todo', sprint_id: 10, assignee_id: null, sort_order: 1, updated_at: daysAgo(10) },
  { id: 4, type: 'subtask', title: 'Card form', status: 'done', parent_id: 2, sprint_id: 10, assignee_id: 6, sort_order: 0, updated_at: daysAgo(2) },
  { id: 5, type: 'task', title: 'Docs', status: 'todo', sprint_id: null, sort_order: 0, updated_at: daysAgo(3) },
  { id: 6, type: 'task', title: 'Shipped', status: 'done', sprint_id: null, sort_order: 1, updated_at: daysAgo(3) },
];

test('filters: mine, recent, type, epic and search by key', () => {
  const keyOf = (t) => `HTT-${t.id}`;
  assert.deepEqual(ids(filterIssues(issues, { onlyMine: true }, { currentEmployeeId: 5 })), [2]);
  assert.deepEqual(ids(filterIssues(issues, { onlyMine: true }, {})), []);
  assert.deepEqual(ids(filterIssues(issues, { recent: true }, { nowMs: NOW })), [2, 4, 5, 6]);
  assert.deepEqual(ids(filterIssues(issues, { types: ['bug'] })), [3]);
  assert.deepEqual(ids(filterIssues(issues, { epicId: 1 })), [1, 2]);
  assert.deepEqual(ids(filterIssues(issues, { search: 'htt-3' }, { keyOf })), [3]);
  assert.deepEqual(ids(filterIssues(issues, { search: 'PAYMENTS' })), [2]);
});

test('a link made on create is stored from the right side', () => {
  // New bug 9 "relates to" story 4; "is blocked by" 4 is stored as 4 blocks 9.
  assert.deepEqual(linkRow('relates:out', 9, 4), { source_id: 9, target_id: 4, link_type: 'relates' });
  assert.deepEqual(linkRow('blocks:in', 9, 4), { source_id: 4, target_id: 9, link_type: 'blocks' });
  assert.deepEqual(linkRow('duplicates:out', 9, 4), { source_id: 9, target_id: 4, link_type: 'duplicates' });
  assert.equal(linkRow('nonsense', 9, 4).link_type, 'relates');
  assert.deepEqual(LINK_CHOICES.map((c) => c.phrase), ['blocks', 'is blocked by', 'relates to', 'duplicates', 'is duplicated by']);
});

test('the assignee avatars filter by any of the people picked, null being unassigned', () => {
  assert.deepEqual(ids(filterIssues(issues, { assignees: [5, 6] })), [2, 4]);
  assert.deepEqual(ids(filterIssues(issues, { assignees: [null] })), [1, 3, 5, 6]);
  assert.deepEqual(ids(filterIssues(issues, { assignees: [6, null] })), [1, 3, 4, 5, 6]);
  assert.deepEqual(ids(filterIssues(issues, { assignees: [] })), ids(issues));
});

test('the avatar row lists who has work, you first, then by name, unassigned flagged', () => {
  const byId = new Map([[5, { id: 5, name: 'Zed' }], [6, { id: 6, name: 'Amy' }], [7, { id: 7, name: 'Bob' }]]);
  const row = assigneesOf(issues, byId, 5);
  assert.deepEqual(row.people.map((e) => e.id), [5, 6]);
  assert.equal(row.unassigned, true);
  assert.deepEqual(assigneesOf(issues, byId).people.map((e) => e.id), [6, 5]);
  // An epic's owner isn't on the board; a deleted employee has no avatar to show.
  const more = [{ id: 9, type: 'epic', assignee_id: 7 }, { id: 10, type: 'task', assignee_id: 42 }];
  assert.deepEqual(assigneesOf(more, byId), { people: [], unassigned: false });
});

test('the board shows the active sprint without epics; no sprint means an empty board', () => {
  assert.equal(activeSprintOf([{ id: 1, state: 'closed' }, { id: 2, state: 'active' }]).id, 2);
  assert.equal(activeSprintOf([{ id: 1, state: 'future' }]), null);
  assert.deepEqual(ids(boardIssues(issues, 10)), [2, 3, 4]);
  assert.deepEqual(boardIssues(issues, null), []);
});

test('columns group by status in rank order', () => {
  const groups = groupByStatus(boardIssues(issues, 10));
  assert.deepEqual(ids(groups.todo), [3]);
  assert.deepEqual(ids(groups.done), [4]);
});

test('epic swimlanes put sub-tasks in their parent\'s epic and the catch-all last', () => {
  const tasksById = new Map(issues.map((t) => [t.id, t]));
  const lanes = swimlanes(boardIssues(issues, 10), 'epic', { tasksById });
  assert.deepEqual(lanes.map((l) => l.title), ['Checkout', 'No epic']);
  assert.deepEqual(ids(lanes[0].issues), [2, 4]);
});

test('assignee swimlanes are alphabetical with Unassigned last', () => {
  const employeesById = new Map([[5, { id: 5, name: 'Zed' }], [6, { id: 6, name: 'Amy' }]]);
  const lanes = swimlanes(boardIssues(issues, 10), 'assignee', { employeesById });
  assert.deepEqual(lanes.map((l) => l.title), ['Amy', 'Zed', 'Unassigned']);
  assert.equal(swimlanes(issues, 'none').length, 1);
});

test('backlog lists open sprints (active first) then open unsprinted issues', () => {
  const sprints = [
    { id: 11, state: 'future', sort_order: 0 },
    { id: 10, state: 'active', sort_order: 5 },
    { id: 9, state: 'closed' },
  ];
  const { sprints: sections, backlog, hiddenDone } = backlogSections(issues, sprints);
  assert.deepEqual(sections.map((s) => s.sprint.id), [10, 11]);
  assert.deepEqual(ids(sections[0].issues), [3, 2]);
  assert.deepEqual(ids(backlog), [5]);
  assert.equal(hiddenDone, 1);
});

// ── reports ──
test('burndown: remaining falls as points complete, stops at today; ideal hits zero', () => {
  const sprint = { start_date: '2026-10-19', end_date: '2026-10-23' };
  const sprintIssues = [
    { type: 'story', estimate: 5, status: 'done', completed_at: '2026-10-20T09:00:00Z' },
    { type: 'bug', estimate: 3, status: 'todo' },
    { type: 'subtask', estimate: 8, status: 'done', completed_at: '2026-10-19T09:00:00Z' },
  ];
  const series = burndownSeries(sprint, sprintIssues, '2026-10-21');
  assert.equal(series.length, 5);
  assert.deepEqual(series.map((d) => d.remaining), [8, 3, 3, null, null]);
  assert.equal(series[0].ideal, 8);
  assert.equal(series[4].ideal, 0);
  assert.deepEqual(burndownSeries({}, sprintIssues, '2026-10-21'), []);
});

test('velocity uses closed sprints in completion order, capped', () => {
  const sprints = [
    { id: 1, name: 'S1', state: 'closed', completed_at: '2026-09-01', committed_points: 10, completed_points: 8 },
    { id: 3, name: 'S3', state: 'active' },
    { id: 2, name: 'S2', state: 'closed', completed_at: '2026-09-15', committed_points: '12', completed_points: null },
  ];
  assert.deepEqual(velocitySeries(sprints), [
    { id: 1, name: 'S1', committed: 10, completed: 8 },
    { id: 2, name: 'S2', committed: 12, completed: 0 },
  ]);
  assert.equal(velocitySeries(sprints, 1).length, 1);
});

// ── history ──
test('history entries read like Jira and resolve ids to names', () => {
  const resolve = { employee: (id) => (id === 5 ? 'Bob' : null), sprint: () => null };
  assert.deepEqual(describeActivity({ field: 'status', old_value: 'todo', new_value: 'done' }), {
    verb: 'changed the Status', from: 'To Do', to: 'Done',
  });
  assert.deepEqual(describeActivity({ field: 'assignee_id', old_value: null, new_value: '5' }, resolve), {
    verb: 'changed the Assignee', from: 'None', to: 'Bob',
  });
  assert.equal(describeActivity({ field: 'sprint_id', old_value: '3', new_value: null }, resolve).from, 'Removed sprint');
  assert.equal(describeActivity({ field: 'created' }).verb, 'created the issue');
});
