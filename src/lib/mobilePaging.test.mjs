import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordsPage, RECENT_RECORDS, RECORDS_PAGE } from '../../mobile/lib/paging.js';

// The employee screen's records list (components/EmployeeDetailModal.js) draws a bounded page, never
// a person's whole history at once: the recent few, then a page more per tap, then back to recent.

test('the recent few first, and nothing to tap when that is all there is', () => {
  assert.deepEqual(recordsPage(0, RECENT_RECORDS), { visible: 0, more: 0, next: null });
  assert.deepEqual(recordsPage(RECENT_RECORDS, RECENT_RECORDS), { visible: RECENT_RECORDS, more: 0, next: null });
});

test('a long history offers one page more at a time, never more than is left', () => {
  assert.deepEqual(recordsPage(100, RECENT_RECORDS), { visible: RECENT_RECORDS, more: RECORDS_PAGE, next: RECENT_RECORDS + RECORDS_PAGE });
  assert.deepEqual(recordsPage(12, RECENT_RECORDS), { visible: RECENT_RECORDS, more: 12 - RECENT_RECORDS, next: 12 });
});

test('once all are shown the tap goes back to the recent few', () => {
  assert.deepEqual(recordsPage(12, 12), { visible: 12, more: 0, next: RECENT_RECORDS });
  // Records deleted while the list was open: never shows more than exist.
  assert.deepEqual(recordsPage(8, 25), { visible: 8, more: 0, next: RECENT_RECORDS });
});

test('a page is bounded however long the history', () => {
  const { visible } = recordsPage(10000, RECENT_RECORDS + RECORDS_PAGE);
  assert.equal(visible, RECENT_RECORDS + RECORDS_PAGE);
});
