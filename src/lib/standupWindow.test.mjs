import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standupDays, findSubmissionFor, findTodaysSubmission } from './standupWindow.js';

// 2026-10-19 is a Monday.
const at = (dateStr, hour, minute = 0, second = 0) => ({ dateStr, hour, minute, second });
const none = new Set();

test('before 10:00 on a working day the default is today, and next is the following working day', () => {
  assert.deepEqual(standupDays(at('2026-10-19', 9, 15), none), { today: '2026-10-19', next: '2026-10-20', defaultDate: '2026-10-19' });
  assert.equal(standupDays(at('2026-10-19', 0, 30), none).defaultDate, '2026-10-19');
});

test('there is no closed state: 9:31 to 9:59 still defaults to today', () => {
  assert.deepEqual(standupDays(at('2026-10-19', 9, 45), none), { today: '2026-10-19', next: '2026-10-20', defaultDate: '2026-10-19' });
  assert.equal(standupDays(at('2026-10-19', 9, 59, 59), none).defaultDate, '2026-10-19');
});

test('from 10:00 on a working day the default is the next working day, today stays available', () => {
  assert.deepEqual(standupDays(at('2026-10-19', 10, 0), none), { today: '2026-10-19', next: '2026-10-20', defaultDate: '2026-10-20' });
});

test('Friday afternoon: next and default are Monday', () => {
  assert.deepEqual(standupDays(at('2026-10-23', 14, 0), none), { today: '2026-10-23', next: '2026-10-26', defaultDate: '2026-10-26' });
});

test('on a weekend there is no today; the default is Monday at any hour', () => {
  for (const hour of [0, 9, 10, 23]) {
    assert.deepEqual(standupDays(at('2026-10-24', hour, 45), none), { today: null, next: '2026-10-26', defaultDate: '2026-10-26' }, `Sat ${hour}`);
  }
  assert.deepEqual(standupDays(at('2026-10-25', 23, 0), none), { today: null, next: '2026-10-26', defaultDate: '2026-10-26' });
});

test('public holidays are skipped and are not working days', () => {
  const holidays = new Set(['2026-10-20']);
  assert.equal(standupDays(at('2026-10-19', 11, 0), holidays).next, '2026-10-21');
  assert.deepEqual(standupDays(at('2026-10-20', 9, 15), holidays), { today: null, next: '2026-10-21', defaultDate: '2026-10-21' });
});

test('a run of holidays across a weekend lands on the first working day after it', () => {
  const holidays = new Set(['2026-10-23', '2026-10-26']);
  assert.equal(standupDays(at('2026-10-22', 10, 0), holidays).next, '2026-10-27');
});

test('a missing holiday set is treated as none', () => {
  assert.equal(standupDays(at('2026-10-19', 10, 0)).next, '2026-10-20');
});

test('the next month and year roll over', () => {
  assert.equal(standupDays(at('2026-12-31', 10, 0), none).next, '2027-01-01');
});

const rows = [
  { id: 1, date: '2026-10-19', email: 'Asha@heubert.com', name: 'Asha Rai' },
  { id: 2, date: '2026-10-20', email: '', name: 'Asha' },
  { id: 3, date: '2026-10-20', email: 'bikash@heubert.com', name: 'Bikash' },
];
const asha = { name: 'Asha Rai', work_email: 'asha@heubert.com' };

test('findSubmissionFor matches the given date by email, falling back to first name', () => {
  assert.equal(findSubmissionFor(rows, '2026-10-19', asha, null)?.id, 1);
  assert.equal(findSubmissionFor(rows, '2026-10-20', asha, null)?.id, 2);
  assert.equal(findSubmissionFor(rows, '2026-10-21', asha, null), undefined);
  assert.equal(findSubmissionFor(rows, '2026-10-20', null, { email: 'BIKASH@heubert.com' })?.id, 3);
  assert.equal(findSubmissionFor(rows, '2026-10-19', null, null), undefined);
});

test('findTodaysSubmission still answers the same way', () => {
  assert.equal(findTodaysSubmission(rows, '2026-10-19', asha, null)?.id, 1);
});
