import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as webWindow from './standupWindow.js';
import * as webProgress from './standupProgress.js';
import * as appWindow from '../../mobile/lib/standupWindow.js';
import * as appProgress from '../../mobile/lib/standupProgress.js';
import { SHOUTOUT_MAX, postedAt, toIds, shiftDay, nextMeetingDay } from '../../mobile/lib/standupShoutouts.js';

// The mobile Daily standup (mobile/app/standup.js) runs mirrors of the web's standup rules
// (mobile/lib/standupWindow.js, mobile/lib/standupProgress.js). Each case runs both copies and
// expects the same answer, so a change to one side fails here until the other matches.

const both = (name, fn) => {
  const web = fn(webWindow, webProgress);
  const app = fn(appWindow, appProgress);
  assert.deepEqual(app, web, `${name}: the mobile copy disagrees with the web`);
  return web;
};

const holidays = new Set(['2026-10-23']);
const employee = { id: 1, name: 'Sanish Maharjan', work_email: 'sanish@heubert.com', joined_date: '2026-09-01' };
const user = { email: 'sanish@heubert.com' };
const submissions = [
  { id: 10, date: '2026-10-22', email: 'SANISH@heubert.com', name: 'Sanish', answers: { question_1: 'Shipped the board\nmore', question_2: 'QA' } },
  { id: 11, date: '2026-10-20', email: '', name: 'Sanish M', answers: { 1: 'Old style key' } },
  { id: 12, date: '2026-10-22', email: 'kriti@heubert.com', name: 'Kriti Joshi', answers: {} },
];
const employees = [
  employee,
  { id: 2, name: 'Kriti Joshi', work_email: 'kriti@heubert.com' },
  { id: 3, name: 'Bikash Thapa', status: 'active' },
  { id: 4, name: 'Nabin Tamang', standup_excluded: true },
  { id: 5, name: 'Old Hand', status: 'resigned' },
  { id: 6, name: 'Rohan KC', status: 'active' },
];
const questions = [{ id: 1, question: 'What did you do?' }, { id: 2, question: 'What next?' }];
const leaves = [{ employee_name: 'Sanish Maharjan', start_date: '2026-10-19', end_date: '2026-10-19', type: 'full' }];

test('the open days and the 10:00 switch, around weekends and holidays', () => {
  const at = (dateStr, hour, minute = 0) => ({ dateStr, hour, minute, second: 0 });
  // Thursday before 10, at 10, Friday (holiday) and Saturday.
  for (const parts of [at('2026-10-22', 9, 59), at('2026-10-22', 10), at('2026-10-23', 8), at('2026-10-24', 12)]) {
    both(`standupDays ${parts.dateStr} ${parts.hour}`, (w) => w.standupDays(parts, holidays));
  }
  assert.deepEqual(webWindow.standupDays(at('2026-10-22', 9, 59), holidays), { today: '2026-10-22', next: '2026-10-26', defaultDate: '2026-10-22' });
  assert.deepEqual(webWindow.standupDays(at('2026-10-24', 12), holidays), { today: null, next: '2026-10-26', defaultDate: '2026-10-26' });
});

test('Nepal wall-clock parts', () => {
  const instant = new Date('2026-10-22T04:14:30Z'); // 09:59:30 in Kathmandu
  const parts = both('getNepalParts', (w) => w.getNepalParts(instant));
  assert.deepEqual(parts, { dateStr: '2026-10-22', hour: 9, minute: 59, second: 30 });
});

test('finding your own submission: by email, then by first name', () => {
  both('findSubmissionFor by email', (w) => w.findSubmissionFor(submissions, '2026-10-22', employee, user)?.id ?? null);
  both('findSubmissionFor by first name', (w) => w.findSubmissionFor(submissions, '2026-10-20', employee, null)?.id ?? null);
  both('findSubmissionFor none', (w) => w.findSubmissionFor(submissions, '2026-10-21', employee, user)?.id ?? null);
  assert.equal(webWindow.findSubmissionFor(submissions, '2026-10-20', employee, null)?.id, 11);
});

test('answers, form progress, the team and the waiting line', () => {
  both('answerFor', (_, p) => [p.answerFor(submissions[0].answers, questions[0]), p.answerFor(submissions[1].answers, questions[0]), p.answerFor(null, questions[1])]);
  both('answeredProgress', (_, p) => [p.answeredProgress(questions, { 1: 'x', 2: '  ' }), p.answeredProgress([], {})]);
  const team = both('teamProgress', (_, p) => {
    const r = p.teamProgress(employees, submissions, '2026-10-22');
    return { expected: r.expected, inCount: r.inCount, submitted: r.submitted.map((e) => e.id), waiting: r.waiting.map((e) => e.id) };
  });
  assert.deepEqual(team, { expected: 4, inCount: 2, submitted: [1, 2], waiting: [3, 6] });
  for (const names of [[], ['Nikhil'], ['Nikhil', 'Nebula'], ['A', 'B', 'C', 'D']]) both(`waitingLabel ${names.length}`, (_, p) => p.waitingLabel(names));
  both('shortNote', (_, p) => [p.shortNote('  Line one  \nline two'), p.shortNote('x'.repeat(60)), p.shortNote('')]);
});

test('leave days and your recent updates', () => {
  both('onFullDayLeave', (_, p) => [
    p.onFullDayLeave(leaves, 'Sanish Maharjan', '2026-10-19'),
    p.onFullDayLeave([{ ...leaves[0], type: 'half' }], 'Sanish Maharjan', '2026-10-19'),
    p.onFullDayLeave([{ employee_name: 'Sanish Maharjan', dates: ['2026-10-21T00:00:00'] }], 'Sanish Maharjan', '2026-10-21'),
  ]);
  const recent = both('recentStandups', (_, p) =>
    p.recentStandups(submissions, {
      before: '2026-10-23', today: '2026-10-22', holidayDates: holidays, employee, user, firstQuestion: questions[0], leaves, count: 5,
    })
  );
  assert.deepEqual(recent.map((r) => r.status), ['submitted', 'missed', 'submitted', 'leave', 'missed']);
});

test('shout-out helpers match the web board', () => {
  assert.equal(SHOUTOUT_MAX, 280);
  assert.equal(postedAt('2026-10-22T03:35:00.123456+00:00'), '09:20 AM');
  assert.equal(postedAt(''), '');
  assert.equal(postedAt('soon'), '');
  assert.deepEqual(toIds(['3', 4, 'x', 2.5]), [3, 4]);
  assert.deepEqual(toIds(null), []);
  assert.equal(shiftDay('2026-10-31', 1), '2026-11-01');
  assert.equal(shiftDay('2026-03-01', -1), '2026-02-28');
  // Friday the 23rd is a holiday, then the weekend.
  assert.equal(nextMeetingDay('2026-10-22', [{ date: '2026-10-23' }]), '2026-10-26');
  assert.equal(nextMeetingDay('2026-10-20', []), '2026-10-21');
});
