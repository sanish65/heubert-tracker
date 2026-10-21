import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeQuery, matchPeople, matchFineRows, taskQuery } from './globalSearch.js';

const person = (name, extra = {}) => ({ name, work_email: null, personal_email: null, status: 'active', ...extra });
const names = (list) => list.map((p) => p.name);

const abik = person('Abik Rai', { work_email: 'abik@heubert.com' });
const bikesh = person('Bikesh Shrestha', { work_email: 'bikesh@heubert.com' });
const sita = person('Sita Gurung', { work_email: 'sita@heubert.com', personal_email: 'bik.fan@gmail.com' });
const nina = person('Nina Karki', { work_email: 'nina@heubert.com' });
const ashrita = person('Ashrita Joshi');
const bikram = person('Bikram Thapa', { status: 'resigned' });

// ── normalizeQuery ──────────────────────────────────────────────────────────

test('a query is trimmed and lower-cased', () => {
  assert.equal(normalizeQuery('  BiK  '), 'bik');
  assert.equal(normalizeQuery(null), '');
});

// ── matchPeople ─────────────────────────────────────────────────────────────

test('people: a word starting with the query, then the name containing it, then an email', () => {
  assert.deepEqual(names(matchPeople([sita, abik, nina, bikesh], 'bik')), ['Bikesh Shrestha', 'Abik Rai', 'Sita Gurung']);
});

test('people: the start of a later word counts as a word start', () => {
  assert.deepEqual(names(matchPeople([ashrita, bikesh], 'shr')), ['Bikesh Shrestha', 'Ashrita Joshi']);
});

test('people: a resigned match comes after every current one', () => {
  assert.deepEqual(names(matchPeople([bikram, sita], 'bik')), ['Sita Gurung', 'Bikram Thapa']);
});

test('people: ties are alphabetical by name', () => {
  const bikash = person('Bikash Lama');
  assert.deepEqual(names(matchPeople([bikesh, bikash], 'bik')), ['Bikash Lama', 'Bikesh Shrestha']);
});

test('people: matching ignores case and surrounding spaces', () => {
  assert.deepEqual(names(matchPeople([abik, bikesh], '  BIK ')), ['Bikesh Shrestha', 'Abik Rai']);
});

test('people: limit caps the list, five by default', () => {
  const many = ['Bikal', 'Bikas', 'Bikesh', 'Bikram', 'Biksu', 'Bikun'].map((n) => person(n));
  assert.deepEqual(names(matchPeople(many, 'bik', 2)), ['Bikal', 'Bikas']);
  assert.equal(matchPeople(many, 'bik').length, 5);
});

test('people: an empty query finds nobody', () => {
  assert.deepEqual(matchPeople([abik, bikesh], ''), []);
  assert.deepEqual(matchPeople([abik, bikesh], '   '), []);
});

// ── matchFineRows ───────────────────────────────────────────────────────────

const late = (id, employee_name, amount, status) => ({ id, employee_name, amount, status, date: '2026-10-01' });
const standup = (id, employee_name, status) => ({ id, employee_name, status, date: '2026-10-01' });

test('fines: one row per person and kind, ranked like people, late before standup', () => {
  const rows = matchFineRows({
    employees: [abik, bikesh, nina, person('Bikal Thapa')],
    fines: [late(1, 'Abik Rai', 20, 'paid'), late(2, 'Bikesh Shrestha', 50, 'unpaid'), late(3, 'Bikesh Shrestha', 30, 'paid'), late(4, 'Nina Karki', 10, 'unpaid')],
    standupFines: [standup(1, 'Bikesh Shrestha', 'unpaid'), standup(2, 'Bikesh Shrestha', 'paid')],
    query: 'bik',
  });
  assert.deepEqual(rows, [
    { kind: 'late', name: 'Bikesh Shrestha', count: 2, unpaidCount: 1, unpaidAmount: 50 },
    { kind: 'standup', name: 'Bikesh Shrestha', count: 2, unpaidCount: 1, unpaidAmount: 0 },
    { kind: 'late', name: 'Abik Rai', count: 1, unpaidCount: 0, unpaidAmount: 0 },
  ]);
});

test('fines: a person excluded from a list has no row for it', () => {
  const rows = matchFineRows({
    employees: [person('Bikesh Shrestha', { late_fine_excluded: true }), person('Bikal Rai', { standup_fine_excluded: true })],
    fines: [late(1, 'Bikesh Shrestha', 50, 'unpaid'), late(2, 'Bikal Rai', 50, 'unpaid')],
    standupFines: [standup(1, 'Bikesh Shrestha', 'unpaid'), standup(2, 'Bikal Rai', 'unpaid')],
    query: 'bik',
  });
  assert.deepEqual(rows.map((r) => [r.kind, r.name]), [['late', 'Bikal Rai'], ['standup', 'Bikesh Shrestha']]);
});

test('fines: matched by name only, never by email', () => {
  const rows = matchFineRows({ employees: [sita], fines: [late(1, 'Sita Gurung', 20, 'unpaid')], standupFines: [], query: 'bik' });
  assert.deepEqual(rows, []);
});

test('fines: a resigned person comes after current ones', () => {
  const rows = matchFineRows({
    employees: [bikram, abik],
    fines: [late(1, 'Bikram Thapa', 20, 'unpaid'), late(2, 'Abik Rai', 20, 'unpaid')],
    standupFines: [],
    query: 'bik',
  });
  assert.deepEqual(rows.map((r) => r.name), ['Abik Rai', 'Bikram Thapa']);
});

test('fines: a name with no employee row still shows, as in the fine tables', () => {
  const rows = matchFineRows({ employees: [], fines: [late(1, 'Bikash Old', 25, 'unpaid')], standupFines: [], query: 'bik' });
  assert.deepEqual(rows, [{ kind: 'late', name: 'Bikash Old', count: 1, unpaidCount: 1, unpaidAmount: 25 }]);
});

test('fines: limit caps the rows, four by default', () => {
  const fines = ['Bikal', 'Bikas', 'Bikesh'].map((n, i) => late(i, n, 10, 'unpaid'));
  const standupFines = ['Bikal', 'Bikas', 'Bikesh'].map((n, i) => standup(i, n, 'unpaid'));
  const rows = matchFineRows({ employees: [], fines, standupFines, query: 'bik' });
  assert.deepEqual(rows.map((r) => [r.kind, r.name]), [['late', 'Bikal'], ['standup', 'Bikal'], ['late', 'Bikas'], ['standup', 'Bikas']]);
  assert.equal(matchFineRows({ employees: [], fines, standupFines, query: 'bik', limit: 1 }).length, 1);
});

test('fines: an empty query finds nothing', () => {
  assert.deepEqual(matchFineRows({ employees: [], fines: [late(1, 'Abik Rai', 20, 'unpaid')], standupFines: [], query: ' ' }), []);
});

// ── taskQuery ───────────────────────────────────────────────────────────────

test('an issue key is looked up by key and number', () => {
  assert.deepEqual(taskQuery('htt-12'), { key: 'HTT', number: 12 });
  assert.deepEqual(taskQuery(' HTT-7 '), { key: 'HTT', number: 7 });
});

test('anything else searches titles, trimmed', () => {
  assert.deepEqual(taskQuery('login bug'), { title: 'login bug' });
  assert.deepEqual(taskQuery('  ab '), { title: 'ab' });
});

test('pattern characters are dropped from a title search', () => {
  assert.deepEqual(taskQuery('50%'), { title: '50' });
  assert.deepEqual(taskQuery('a_b\\c'), { title: 'abc' });
  // PostgREST also reads * as % in a like pattern.
  assert.deepEqual(taskQuery('50*'), { title: '50' });
});

test('fewer than two characters left is no task search', () => {
  assert.equal(taskQuery('a'), null);
  assert.equal(taskQuery('a%'), null);
  assert.equal(taskQuery('%_\\'), null);
  assert.equal(taskQuery(''), null);
  assert.equal(taskQuery(undefined), null);
});
