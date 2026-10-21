import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as web from './nepaliDate.js';
import * as phone from '../../mobile/lib/nepaliDate.js';

// The phone cannot import from src/, so mobile/lib/nepaliDate.js carries its own copy of the
// Bikram Sambat conversion the Leaves calendar needs (the BS day under each date, the BS months a
// Gregorian month spans). Each test runs the web module and the phone copy on the same dates and
// demands the same answer, so a lookup row or a rule changed on one side only fails here.

const DAY_MS = 86400000;

// Every "YYYY-MM-DD" from `from` to `to`, both included.
function everyDay(from, to) {
  const days = [];
  for (let t = Date.parse(`${from}T00:00:00Z`); t <= Date.parse(`${to}T00:00:00Z`); t += DAY_MS) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return days;
}

// The first and last day of each Gregorian month of the given years.
function monthSpans(firstYear, lastYear) {
  const spans = [];
  for (let y = firstYear; y <= lastYear; y++) {
    for (let m = 1; m <= 12; m++) {
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      const mm = String(m).padStart(2, '0');
      spans.push([`${y}-${mm}-01`, `${y}-${mm}-${String(last).padStart(2, '0')}`]);
    }
  }
  return spans;
}

// The first and the last day the lookup table covers, and the day outside each end.
const TABLE_FIRST = '1943-04-14';
const TABLE_LAST = web.bsToAd(web.BS_YEAR_BOUNDS.max, 12, web.bsMonthLength(web.BS_YEAR_BOUNDS.max, 12));
const nextDay = (day) => new Date(Date.parse(`${day}T00:00:00Z`) + DAY_MS).toISOString().slice(0, 10);

const EDGES = [TABLE_FIRST, '1943-04-13', TABLE_LAST, nextDay(TABLE_LAST), '2000-02-29', '2024-02-29', '', null, undefined];

// Ten years round the app's seasons, every day: each BS month boundary, both kinds of year.
const DAYS = [...everyDay('2022-01-01', '2031-12-31'), ...EDGES];

test('the BS month names are the web names, in order', () => {
  assert.deepEqual(phone.BS_MONTH_NAMES, web.BS_MONTH_NAMES);
});

test('adToBs gives the web BS date for every day, and null outside the table', () => {
  for (const day of DAYS) {
    assert.deepEqual(phone.adToBs(day), web.adToBs(day), `adToBs(${day})`);
  }
  assert.equal(phone.adToBs('1943-04-13'), null);
  assert.equal(phone.adToBs(nextDay(TABLE_LAST)), null);
});

test('formatBs writes every day as the web does ("16 Bhadra 2083"), "" outside the table', () => {
  for (const day of DAYS) {
    assert.equal(phone.formatBs(day), web.formatBs(day), `formatBs(${day})`);
  }
  assert.equal(phone.formatBs(TABLE_FIRST), '1 Baisakh 2000');
});

test('bsMonthRange names the BS months each Gregorian month spans, as the web does', () => {
  const spans = [
    ...monthSpans(2022, 2031),
    ['2026-12-15', '2027-04-20'], // across a BS new year
    ['2026-10-17', '2026-10-17'], // one day
    ['1943-04-13', '1943-05-01'], // starts before the table
    [TABLE_LAST, nextDay(TABLE_LAST)], // ends after it
    ['', ''],
  ];
  for (const [first, last] of spans) {
    assert.equal(phone.bsMonthRange(first, last), web.bsMonthRange(first, last), `bsMonthRange(${first}, ${last})`);
  }
  assert.equal(phone.bsMonthRange('2026-10-01', '2026-10-31'), 'Ashwin–Kartik 2083');
});
