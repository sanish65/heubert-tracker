import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tenureLabel, recentRecords, sortRows, inLeaveLeft } from './employeeDirectory.js';

test('tenure counts whole months', () => {
  assert.equal(tenureLabel('2024-03-02', '2026-10-22'), '2 yrs 7 mos');
  assert.equal(tenureLabel('2025-10-23', '2026-10-22'), '11 mos');
  assert.equal(tenureLabel('2025-10-22', '2026-10-22'), '1 yr');
  assert.equal(tenureLabel('2026-10-10', '2026-10-22'), 'Under a month');
  assert.equal(tenureLabel(null, '2026-10-22'), 'N/A');
  assert.equal(tenureLabel('2027-01-01', '2026-10-22'), 'N/A');
});

test('recent records mix leaves and fines, newest first', () => {
  const items = recentRecords({
    name: 'Aarav',
    today: '2026-10-20',
    leaveTypes: [{ id: 1, name: 'Sick' }, { id: 2, name: 'Casual Leave' }],
    leaves: [
      { id: 1, employee_name: 'Aarav', start_date: '2026-10-22', end_date: '2026-10-22', type: 'full', leave_type_id: 1 },
      { id: 2, employee_name: 'Aarav', start_date: '2026-09-01', end_date: '2026-09-03', type: 'full', leave_type_id: 2 },
      { id: 3, employee_name: 'Sita', start_date: '2026-10-21', end_date: '2026-10-21', type: 'half' },
      { id: 4, employee_name: 'Aarav', start_date: '2026-10-20', end_date: '2026-10-20', type: 'half' },
    ],
    fines: [
      { id: 9, employee_name: 'Aarav', date: '2026-10-14', amount: 200, status: 'paid' },
      { id: 10, employee_name: 'Aarav', date: '2026-10-06', amount: 1200, status: 'unpaid' },
    ],
  });
  assert.deepEqual(items.map((r) => r.id), ['leave-1', 'leave-4', 'fine-9', 'fine-10']);
  assert.equal(items[0].title, 'Sick leave · full day');
  assert.equal(items[0].pillLabel, 'Upcoming');
  assert.equal(items[0].dateLabel, 'Thu, Oct 22, 2026');
  assert.equal(items[1].title, 'Leave · half day');
  assert.equal(items[1].pillLabel, 'On leave');
  assert.equal(items[3].title, 'Late fine · Rs. 1,200');
  assert.equal(items[3].pillLabel, 'Unpaid');
  const casual = recentRecords({ name: 'Aarav', today: '2026-10-20', leaveTypes: [{ id: 2, name: 'Casual Leave' }], leaves: [{ id: 2, employee_name: 'Aarav', start_date: '2026-09-01', end_date: '2026-09-03', leave_type_id: 2 }] });
  assert.equal(casual[0].title, 'Casual Leave · 3 days');
  assert.equal(casual[0].pillLabel, 'Taken');
});

test('sorting by name, joined date and unpaid fines', () => {
  const rows = [
    { emp: { name: 'Sita', joined_date: '2023-02-19' }, stats: { unpaid: 0 } },
    { emp: { name: 'Bikash', joined_date: '2022-08-11' }, stats: { unpaid: 600 } },
    { emp: { name: 'Anisha', joined_date: null }, stats: { unpaid: 600 } },
  ];
  const names = (sort) => sortRows(rows, sort).map((r) => r.emp.name);
  assert.deepEqual(names('name'), ['Anisha', 'Bikash', 'Sita']);
  assert.deepEqual(names('joined'), ['Bikash', 'Sita', 'Anisha']);
  assert.deepEqual(names('unpaid'), ['Anisha', 'Bikash', 'Sita']);
});

test('leave left counts only the types set to count in it', () => {
  const types = [
    { name: 'Personal Leave', annual_days: 15, is_unpaid: false, counts_in_leave_left: true },
    { name: 'Sick Leave', annual_days: 4, is_unpaid: false, counts_in_leave_left: true },
    { name: 'Exam leave', annual_days: 7, is_unpaid: false, counts_in_leave_left: false },
    { name: 'Unpaid Leave', annual_days: 30, is_unpaid: true, counts_in_leave_left: false },
  ];
  assert.deepEqual(inLeaveLeft(types).map((t) => t.name), ['Personal Leave', 'Sick Leave']);
  // An admin can switch any type in or out.
  assert.equal(inLeaveLeft([{ name: 'Exam leave', counts_in_leave_left: true }]).length, 1);
});

test('before the setting exists, work from home, exam and unpaid leave are left out', () => {
  const types = [
    { name: 'Personal Leave', annual_days: 15, is_unpaid: false },
    { name: 'Sick Leave', annual_days: 4, is_unpaid: false },
    { name: 'Festival Leave', annual_days: 1, is_unpaid: false },
    { name: 'Work From Home', annual_days: 20, is_unpaid: false },
    { name: 'Unpaid Leave', annual_days: 30, is_unpaid: true },
    { name: 'Exam leave', annual_days: 7, is_unpaid: false },
  ];
  assert.equal(inLeaveLeft(types).reduce((sum, t) => sum + t.annual_days, 0), 20);
  assert.deepEqual(inLeaveLeft(undefined), []);
});
