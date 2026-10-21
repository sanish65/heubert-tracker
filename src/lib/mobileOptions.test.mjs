import { test } from 'node:test';
import assert from 'node:assert/strict';
import { employeeStatus } from '../../mobile/lib/options.js';

// mobile/lib/options.js holds the domain lists the sheets and screens share (employee statuses,
// fine amounts and statuses, leave kinds), so a screen no longer reads them from a sheet's file.
// employeeStatus is the one rule among them: how a person's stored status shows.

test('no status means active, as everywhere in the app', () => {
  assert.deepEqual(employeeStatus({}), { value: 'active', label: 'Active', tone: 'green' });
  assert.deepEqual(employeeStatus({ status: null }), { value: 'active', label: 'Active', tone: 'green' });
  assert.deepEqual(employeeStatus(undefined), { value: 'active', label: 'Active', tone: 'green' });
});

test('a known status shows in its pill tone', () => {
  assert.equal(employeeStatus({ status: 'resigned' }).tone, 'red');
  assert.equal(employeeStatus({ status: 'on-leave' }).label, 'On Leave');
});

test('a status the app does not know shows as it is, grey', () => {
  assert.deepEqual(employeeStatus({ status: 'sabbatical' }), { value: 'sabbatical', label: 'sabbatical', tone: 'gray' });
});
