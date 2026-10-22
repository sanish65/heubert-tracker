import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// mobile/lib/task*.js are verbatim copies of the web's pure Tasks modules (the app cannot
// import from src/): a comment header, a blank line, then the web file exactly. Any drift
// between the two fails here, and the behaviour checks below run both copies side by side.

const MIRRORS = ['taskWorkflow', 'taskBoard', 'taskQuery', 'taskExtras'];
const read = (rel) => readFileSync(new URL(rel, import.meta.url), 'utf8');

for (const name of MIRRORS) {
  test(`mobile/lib/${name}.js mirrors src/lib/${name}.js`, () => {
    const web = read(`./${name}.js`);
    const mobile = read(`../../mobile/lib/${name}.js`);
    const cut = mobile.indexOf('\n\n');
    assert.ok(cut > 0, 'the mobile copy starts with its header and a blank line');
    const header = mobile.slice(0, cut).split('\n');
    assert.ok(header.every((line) => line.startsWith('//')), 'the header is comments only');
    assert.equal(mobile.slice(cut + 2), web, `copy src/lib/${name}.js into mobile/lib/${name}.js again`);
  });
}

test('both copies answer the same', async () => {
  const webQ = await import('./taskQuery.js');
  const mobQ = await import('../../mobile/lib/taskQuery.js');
  const webW = await import('./taskWorkflow.js');
  const mobW = await import('../../mobile/lib/taskWorkflow.js');
  const workflow = [
    { value: 'todo', label: 'To Do', category: 'todo', next: null },
    { value: 'dev', label: 'In Dev', category: 'progress', next: ['qa'] },
    { value: 'qa', label: 'In QA', category: 'progress', next: ['dev', 'done'] },
    { value: 'done', label: 'Done', category: 'done', next: null },
  ];
  const tasks = webW.withCategories([
    { id: 1, number: 1, type: 'story', title: 'A', status: 'dev', assignee_id: 5, priority: 'high', created_at: '2026-10-01T00:00:00Z' },
    { id: 2, number: 2, type: 'bug', title: 'B', status: 'done', assignee_id: null, priority: 'low', created_at: '2026-10-02T00:00:00Z' },
  ], workflow);
  const ctx = { me: 5, employees: [{ id: 5, name: 'Sanish Maharjan' }], sprints: [], versions: [], workflow, tasks, tasksById: new Map(tasks.map((t) => [t.id, t])), keyOf: (t) => `POR-${t.number}`, nowMs: Date.parse('2026-10-22T06:00:00Z'), todayStr: '2026-10-22' };
  for (const q of ['assignee = currentUser()', 'statusCategory != Done ORDER BY priority DESC', 'status = "In QA"', 'asignee = x']) {
    const a = webQ.compileQuery(q, ctx);
    const b = mobQ.compileQuery(q, ctx);
    assert.equal(a.ok, b.ok, q);
    if (a.ok) assert.deepEqual(tasks.filter(b.predicate).map((t) => t.id), tasks.filter(a.predicate).map((t) => t.id), q);
    else assert.equal(b.error, a.error, q);
  }
  assert.deepEqual(mobW.nextStatuses('dev', workflow).map((s) => s.value), webW.nextStatuses('dev', workflow).map((s) => s.value));
});
