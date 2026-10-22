import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as web from './teamCalendar.js';
import * as mobile from '../../mobile/lib/teamCalendar.js';

// mobile/lib/teamCalendar.js is the web's src/lib/teamCalendar.js copied under its own header (the
// app cannot import from src/). These tests keep the two the same: the code below each file's
// leading comment matches line for line, and both answer the same cases the same way.

const body = (url) =>
  readFileSync(new URL(url, import.meta.url), 'utf8')
    .split('\n')
    .reduce((acc, line) => (acc.started || !/^\s*(\/\/.*)?$/.test(line) ? { started: true, lines: [...acc.lines, line] } : acc), { started: false, lines: [] })
    .lines.join('\n');

test('the mobile copy is the web module, line for line', () => {
  assert.equal(body('../../mobile/lib/teamCalendar.js'), body('./teamCalendar.js'));
  assert.deepEqual(Object.keys(mobile).sort(), Object.keys(web).sort());
});

test('both copies answer the same', () => {
  const events = [
    { id: 'a', title: 'Standup', start: '2026-10-22T04:15:00Z', end: '2026-10-22T04:30:00Z', allDay: false, kind: 'team', recurringId: 's', attendeeCount: 6, meet: null },
    { id: 'b', title: null, start: '2026-10-22T08:15:00Z', end: '2026-10-22T09:15:00Z', allDay: false, kind: 'client', recurringId: null, attendeeCount: 3, meet: null },
    { id: 'c', title: 'Trip', start: '2026-10-23', end: '2026-10-24', allDay: true, kind: 'ooo', recurringId: null, attendeeCount: 0, meet: null },
  ];
  const leaves = [{ employee_name: 'Sita', start_date: '2026-10-22', end_date: '2026-10-22', type: 'half', reason: '[First Half] dentist' }];
  const answers = [];
  for (const lib of [web, mobile]) {
    const blocks = lib.dayBlocks(events, '2026-10-22');
    const leave = lib.leaveOn(leaves, 'Sita', '2026-10-22');
    const cases = {
      week: lib.workWeekOf('2026-10-24'),
      blocks,
      allDay: lib.allDayOn(events, '2026-10-23'),
      status: lib.statusAt({ blocks, allDay: [], leave, nowHour: 12, isToday: true }),
      slots: lib.findFreeSlots([{ events, leaveFor: (d) => lib.leaveOn(leaves, 'Sita', d) }], ['2026-10-22', '2026-10-23'], { durationMin: 60, today: '2026-10-22', nowHour: 10 }),
      link: lib.googleEventLink({ title: 'Sync', date: '2026-10-22', from: 14, to: 14.5, emails: ['a@x.com'] }),
    };
    answers.push(cases);
  }
  assert.deepEqual(answers[1], answers[0]);
  assert.ok(answers[0].blocks.length === 2 && answers[0].slots.length > 0);
});
