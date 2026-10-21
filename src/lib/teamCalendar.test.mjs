import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  addDays,
  workWeekOf,
  nepalParts,
  formatHour,
  classifyEvent,
  normalizeEvent,
  leaveOn,
  leaveHours,
  dayBlocks,
  allDayOn,
  statusAt,
  dailySeries,
  weekCell,
  findFreeSlots,
  googleEventLink,
  validRange,
  isWeekend,
} from './teamCalendar.js';

// Nepal is UTC+5:45, so 10:00 local is 04:15Z.
const at = (date, hhmm) => `${date}T${hhmm}:00+05:45`;
const ev = (id, date, from, to, extra = {}) => ({ id, start: at(date, from), end: at(date, to), allDay: false, kind: 'team', title: id, ...extra });

// ── dates ──
test('dates step across months and a work week runs Monday to Friday', () => {
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.deepEqual(workWeekOf('2026-10-28'), ['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30']);
  assert.equal(workWeekOf('2026-10-25')[0], '2026-10-26'); // Sunday -> the week ahead
  assert.equal(workWeekOf('2026-10-31')[0], '2026-11-02'); // Saturday -> the week ahead
  assert.equal(isWeekend('2026-10-31'), true);
});

test('instants convert to Nepal date and hour', () => {
  assert.deepEqual(nepalParts('2026-10-27T04:15:00Z'), { date: '2026-10-27', hour: 10 });
  assert.deepEqual(nepalParts('2026-10-26T20:00:00Z'), { date: '2026-10-27', hour: 1.75 });
  assert.equal(nepalParts('nope'), null);
  assert.equal(formatHour(11 + 20 / 60), '11:20');
});

// ── Google events ──
test('events are classified by type, title and outside guests', () => {
  assert.equal(classifyEvent({ eventType: 'outOfOffice' }, 'heubert.com'), 'ooo');
  assert.equal(classifyEvent({ eventType: 'focusTime' }, 'heubert.com'), 'focus');
  assert.equal(classifyEvent({ summary: 'Interview · Frontend' }, 'heubert.com'), 'hiring');
  assert.equal(classifyEvent({ summary: 'Sync', attendees: [{ email: 'a@heubert.com' }, { email: 'b@acme.com' }] }, 'heubert.com'), 'client');
  assert.equal(classifyEvent({ summary: 'Sync', attendees: [{ email: 'room@resource.calendar.google.com', resource: true }] }, 'heubert.com'), 'team');
});

test('cancelled, free and declined events are dropped', () => {
  const opts = { ownerEmail: 'bob@heubert.com', domain: 'heubert.com' };
  const base = { id: '1', summary: 'X', start: { dateTime: at('2026-10-27', '10:00') }, end: { dateTime: at('2026-10-27', '11:00') } };
  assert.equal(normalizeEvent({ ...base, status: 'cancelled' }, opts), null);
  assert.equal(normalizeEvent({ ...base, transparency: 'transparent' }, opts), null);
  assert.equal(normalizeEvent({ ...base, attendees: [{ email: 'Bob@heubert.com', responseStatus: 'declined' }] }, opts), null);
  assert.ok(normalizeEvent(base, opts));
});

test('private events lose their title, and only the viewer keeps Meet links', () => {
  const item = {
    id: '1', summary: 'Salary talk', visibility: 'private', hangoutLink: 'https://meet.google.com/abc',
    description: 'secret', attendees: [{ email: 'a@heubert.com' }, { email: 'b@heubert.com' }],
    start: { dateTime: at('2026-10-27', '10:00') }, end: { dateTime: at('2026-10-27', '11:00') },
  };
  const other = normalizeEvent(item, { ownerEmail: 'a@heubert.com', domain: 'heubert.com' });
  assert.equal(other.title, null);
  assert.equal(other.meet, null);
  assert.equal(other.attendeeCount, 2);
  assert.equal('description' in other, false);
  const mine = normalizeEvent({ ...item, visibility: 'default' }, { ownerEmail: 'a@heubert.com', domain: 'heubert.com', isViewer: true });
  assert.equal(mine.title, 'Salary talk');
  assert.equal(mine.meet, 'https://meet.google.com/abc');
});

test('all-day events keep their dates', () => {
  const e = normalizeEvent({ id: 'o', summary: 'OOO', eventType: 'outOfOffice', start: { date: '2026-10-27' }, end: { date: '2026-10-29' } }, { ownerEmail: 'a@x.com', domain: 'x.com' });
  assert.deepEqual([e.allDay, e.start, e.end, e.kind], [true, '2026-10-27', '2026-10-29', 'ooo']);
  assert.equal(allDayOn([e], '2026-10-28').length, 1);
  assert.equal(allDayOn([e], '2026-10-29').length, 0); // end date is exclusive
});

// ── leave ──
const leaves = [
  { employee_name: 'Sita', start_date: '2026-10-27', end_date: '2026-10-28', type: 'full' },
  { employee_name: 'Kriti', start_date: '2026-10-27', end_date: '2026-10-27', type: 'half', reason: '[Second Half] dentist' },
];

test('leave is found by name and date, with half-days read from the reason', () => {
  assert.equal(leaveOn(leaves, 'Sita', '2026-10-28').part, 'full');
  assert.equal(leaveOn(leaves, 'Sita', '2026-10-29'), null);
  assert.equal(leaveOn(leaves, 'Kriti', '2026-10-27').part, 'second');
  assert.deepEqual(leaveHours('second'), [13.5, 18]);
});

// ── day view ──
test('blocks are clipped to the working day and positioned on it', () => {
  const blocks = dayBlocks([ev('a', '2026-10-27', '08:00', '10:00'), ev('b', '2026-10-27', '13:30', '15:00'), ev('c', '2026-10-28', '10:00', '11:00')], '2026-10-27');
  assert.deepEqual(blocks.map((b) => [b.id, b.from, b.to]), [['a', 9, 10], ['b', 13.5, 15]]);
  assert.equal(blocks[1].leftPct, 50);
  assert.equal(blocks[0].timeLabel, '08:00–10:00');
});

test('status says in a meeting, free until, on leave or day over', () => {
  const blocks = dayBlocks([ev('a', '2026-10-27', '11:00', '12:00'), ev('b', '2026-10-27', '14:00', '14:30')], '2026-10-27');
  assert.deepEqual(statusAt({ blocks, nowHour: 11.33, isToday: true }), { tone: 'blue', text: 'In a meeting' });
  assert.deepEqual(statusAt({ blocks, nowHour: 12.5, isToday: true }), { tone: 'green', text: 'Free until 14:00' });
  assert.deepEqual(statusAt({ blocks, nowHour: 15, isToday: true }), { tone: 'green', text: 'Free' });
  assert.deepEqual(statusAt({ blocks, nowHour: 18.5, isToday: true }), { tone: 'gray', text: 'Day over' });
  assert.equal(statusAt({ blocks, leave: { part: 'full' }, nowHour: 11, isToday: true }).text, 'On leave');
  assert.equal(statusAt({ blocks: [], leave: { part: 'second' }, nowHour: 12, isToday: true }).text, 'Free until 13:30');
  assert.equal(statusAt({ blocks, nowHour: 0, isToday: false }).text, '2 meetings');
});

// ── week view ──
test('a series on every day of the week is hidden from week cells', () => {
  const week = workWeekOf('2026-10-26');
  const standups = week.map((d, i) => ev(`s${i}`, d, '10:00', '10:15', { recurringId: 'standup' }));
  const others = [ev('demo', '2026-10-27', '11:00', '12:00', { recurringId: 'weekly' }), ev('x', '2026-10-27', '14:00', '15:00'), ev('y', '2026-10-27', '16:00', '17:00')];
  const hidden = dailySeries([[...standups, ...others]], week);
  assert.deepEqual([...hidden], ['standup']);
  const cell = weekCell([...standups, ...others], '2026-10-27', hidden);
  assert.deepEqual(cell.shown.map((e) => e.id), ['demo', 'x']);
  assert.equal(cell.more, 1);
});

// ── find a time ──
test('free slots avoid everyone\'s meetings and leave, and the past', () => {
  const day = '2026-10-27';
  const people = [
    { events: [ev('a', day, '09:00', '12:00')], leaveFor: () => null },
    { events: [ev('b', day, '12:30', '13:30')], leaveFor: (d) => (d === day ? { part: 'second' } : null) },
  ];
  const slots = findFreeSlots(people, [day, '2026-10-28'], { durationMin: 30, today: day, nowHour: 9, limit: 3 });
  assert.deepEqual(slots.map((s) => [s.date, s.from, s.to]), [[day, 12, 12.5], ['2026-10-28', 9, 9.5], ['2026-10-28', 9.5, 10]]);
  const later = findFreeSlots(people, [day], { durationMin: 60, today: day, nowHour: 12.1 });
  assert.deepEqual(later, []);
});

test('the Google booking link carries UTC times and guests', () => {
  const url = new URL(googleEventLink({ title: 'Sync', date: '2026-10-27', from: 12, to: 12.5, emails: ['a@x.com', 'b@x.com'] }));
  assert.equal(url.searchParams.get('dates'), '20261027T061500Z/20261027T064500Z');
  assert.equal(url.searchParams.get('add'), 'a@x.com,b@x.com');
  assert.equal(url.searchParams.get('text'), 'Sync');
});

test('ranges must be real dates, ordered, and two weeks at most', () => {
  assert.equal(validRange('2026-10-26', '2026-10-31'), true);
  assert.equal(validRange('2026-10-31', '2026-10-26'), false);
  assert.equal(validRange('2026-10-01', '2026-11-01'), false);
  assert.equal(validRange('bad', '2026-10-26'), false);
});
