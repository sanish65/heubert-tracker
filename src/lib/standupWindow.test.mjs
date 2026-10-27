import { test } from 'node:test';
import assert from 'node:assert/strict';
import { standupDays, standupReminders, findSubmissionFor, findTodaysSubmission } from './standupWindow.js';

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

// ── Reminders ──
const npt = (dateStr, hour, minute = 0) => ({ dateStr, hour, minute, second: 0 });
const kinds = (list) => list.map((r) => `${r.kind} ${r.date}`);

test('reminders: the evening before at 17:00, then a last call at 09:00 on the day', () => {
  assert.deepEqual(standupReminders(npt('2026-10-26', 16, 59)), []);
  assert.deepEqual(standupReminders(npt('2026-10-26', 17, 0)), [
    { kind: 'evening', date: '2026-10-27', at: '2026-10-26T11:15:00.000Z' },
  ]);
  assert.deepEqual(kinds(standupReminders(npt('2026-10-27', 8, 59))), ['evening 2026-10-27']);
  assert.deepEqual(standupReminders(npt('2026-10-27', 9, 0)), [
    { kind: 'evening', date: '2026-10-27', at: '2026-10-26T11:15:00.000Z' },
    { kind: 'final', date: '2026-10-27', at: '2026-10-27T03:15:00.000Z' },
  ]);
});

test('reminders: from 10:00 they are about the next working day, across weekends and holidays', () => {
  // 10:00 Tuesday: the form is on Wednesday now, and its evening reminder is still to come.
  assert.deepEqual(standupReminders(npt('2026-10-27', 10, 0)), []);
  // Friday evening and the weekend: Monday's standup.
  assert.deepEqual(kinds(standupReminders(npt('2026-10-30', 18, 0))), ['evening 2026-11-02']);
  assert.deepEqual(kinds(standupReminders(npt('2026-10-31', 12, 0))), ['evening 2026-11-02']);
  // Monday a holiday: Tuesday's standup is reminded on Friday evening.
  assert.deepEqual(kinds(standupReminders(npt('2026-10-30', 17, 30), new Set(['2026-11-02']))), ['evening 2026-11-03']);
});
