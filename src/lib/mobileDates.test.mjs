import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dayOf, toDate, localToday, daysBetween, parseTimestamp, formatStamp } from '../../mobile/lib/dates.js';

// mobile/lib/dates.js holds the date helpers the screens used to copy: the day of a date column,
// today's local day, whole days between two days, and Supabase's timestamps read the way Hermes
// can (six fraction digits cut to milliseconds).

test('the day of a date column: a bare day, a timestamp, or "" when it holds none', () => {
  assert.equal(dayOf('2026-10-20'), '2026-10-20');
  assert.equal(dayOf('2026-10-20T05:00:00+00:00'), '2026-10-20');
  assert.equal(dayOf('2026-10-20 05:00:00+00'), '2026-10-20');
  assert.equal(dayOf(null), '');
  assert.equal(dayOf(undefined), '');
  assert.equal(dayOf(''), '');
  assert.equal(dayOf('soon'), '');
});

test('a day becomes local midnight, never the UTC day before', () => {
  const d = toDate('2026-03-01');
  assert.deepEqual([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours()], [2026, 2, 1, 0]);
});

test("today's local day, zero-padded", () => {
  assert.equal(localToday(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  assert.equal(localToday(new Date(2026, 11, 31, 0, 0)), '2026-12-31');
});

test('whole days between two days, across months, years and the clock change', () => {
  assert.equal(daysBetween('2026-10-20', '2026-10-20'), 0);
  assert.equal(daysBetween('2026-10-20', '2026-10-27'), 7);
  assert.equal(daysBetween('2026-10-27', '2026-10-20'), -7);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 1);
  assert.equal(daysBetween('2026-03-28', '2026-03-30'), 2);
});

test("Supabase's six fraction digits read as milliseconds", () => {
  const six = parseTimestamp('2026-10-20T05:00:00.123456+00:00');
  assert.equal(six.toISOString(), '2026-10-20T05:00:00.123Z');
  assert.equal(parseTimestamp('2026-10-20T05:00:00Z').toISOString(), '2026-10-20T05:00:00.000Z');
});

test('a time that does not parse is null', () => {
  assert.equal(parseTimestamp(null), null);
  assert.equal(parseTimestamp(''), null);
  assert.equal(parseTimestamp('not a time'), null);
});

test('a stored time as "Oct 20, 2026", or "" when it does not parse', () => {
  assert.equal(formatStamp('2026-10-20T12:00:00.123456+00:00'), 'Oct 20, 2026');
  assert.equal(formatStamp('nope'), '');
  assert.equal(formatStamp(undefined), '');
});
