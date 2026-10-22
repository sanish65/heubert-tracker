import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as web from './employeeDirectory.js';
import * as phone from '../../mobile/lib/employeeDirectory.js';

// The phone cannot import from src/, so mobile/lib/employeeDirectory.js is a copy. Each test runs
// both on the same inputs and demands the same answer; employeeDirectory.test.mjs pins the answers.

const same = (name, argLists) => {
  for (const args of argLists) assert.deepEqual(phone[name](...args), web[name](...args), `${name}(${JSON.stringify(args)})`);
};

test('the sort choices are the web ones', () => {
  assert.deepEqual(phone.SORTS, web.SORTS);
});

test('tenureLabel', () => {
  same('tenureLabel', [
    ['2024-03-02', '2026-10-22'], ['2025-10-22', '2026-10-22'], ['2026-10-10', '2026-10-22'],
    ['2020-01-31', '2020-02-29'], [null, '2026-10-22'], ['2026-10-22', null], ['bad', '2026-10-22'], ['2027-01-01', '2026-10-22'],
  ]);
});

test('recentRecords', () => {
  const leaves = [
    { id: 1, employee_name: 'A', start_date: '2026-10-22', end_date: '2026-10-22', type: 'full', leave_type_id: 1 },
    { id: 2, employee_name: 'A', start_date: '2026-09-01', end_date: '2026-09-03', leave_type_id: 2 },
    { id: 3, employee_name: 'A', start_date: '2026-10-20', type: 'half' },
    { id: 4, employee_name: 'B', start_date: '2026-10-21' },
    { id: 5, employee_name: 'A' },
  ];
  const fines = [
    { id: 9, employee_name: 'A', date: '2026-10-14', amount: 200, status: 'paid' },
    { id: 10, employee_name: 'A', date: '2026-10-06T00:00:00Z', amount: '1200', status: 'unpaid' },
    { id: 11, employee_name: 'A', amount: 5 },
  ];
  const leaveTypes = [{ id: 1, name: 'Sick' }, { id: 2, name: 'Casual Leave' }];
  same('recentRecords', [
    [{ name: 'A', leaves, fines, leaveTypes, today: '2026-10-20' }],
    [{ name: 'A', leaves, fines, leaveTypes, today: '2026-10-20', limit: 2 }],
    [{ name: 'B', leaves, fines, today: '2026-10-20' }],
    [{ name: 'Z', today: '2026-10-20' }],
  ]);
});

test('sortRows', () => {
  const rows = [
    { emp: { name: 'Sita', joined_date: '2023-02-19' }, stats: { unpaid: 0 } },
    { emp: { name: 'Bikash', joined_date: '2022-08-11' }, stats: { unpaid: 600 } },
    { emp: { name: 'Anisha', joined_date: null }, stats: { unpaid: 600 } },
    { emp: { name: 'Kriti' } },
  ];
  same('sortRows', [[rows, 'name'], [rows, 'joined'], [rows, 'unpaid'], [rows, 'other'], [[], 'name']]);
});
