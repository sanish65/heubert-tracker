// The employee screen's records list draws a bounded page, never a person's whole history at once
// (the cost would grow with tenure): the recent few, then a page more per tap, then back to the
// recent few. Pure: no imports, tested by src/lib/mobilePaging.test.mjs.

export const RECENT_RECORDS = 5;
export const RECORDS_PAGE = 20;

// `total` records, `shown` the count asked for so far. `visible` is how many to draw, `more` how
// many the next tap adds (0 when all are drawn), `next` the count to ask for on that tap (null when
// there is nothing to tap).
export function recordsPage(total, shown) {
  const visible = Math.min(total, shown);
  if (total <= RECENT_RECORDS) return { visible, more: 0, next: null };
  if (visible < total) {
    const more = Math.min(RECORDS_PAGE, total - visible);
    return { visible, more, next: visible + more };
  }
  return { visible, more: 0, next: RECENT_RECORDS };
}
