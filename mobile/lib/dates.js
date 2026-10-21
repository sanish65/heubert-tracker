// The date helpers the screens share: the day of a date column, today's local day, whole days
// between two days, and Supabase's stored times read the way Hermes can. Pure: no imports, so
// src/lib/mobileDates.test.mjs runs it under plain Node.

export const pad = (n) => String(n).padStart(2, "0");

// "YYYY-MM-DD" of a date column (holidays and some others come back as timestamps); "" when it
// holds no date.
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export function dayOf(value) {
  const day = String(value || "").slice(0, 10);
  return DAY.test(day) ? day : "";
}

// Local midnight of a "YYYY-MM-DD": a bare day through Date() is UTC and can show the day before.
export function toDate(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

// Whole days from `from` to `to`, both "YYYY-MM-DD"; counted in UTC so a clock change never
// makes a day 23 hours.
export function daysBetween(from, to) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// A stored time as a Date, or null when it does not parse. Supabase stamps six fraction digits
// (05:00:00.123456+00:00), which Hermes may refuse; only milliseconds count, so the fraction is
// cut to three first.
export function parseTimestamp(value) {
  const parsed = new Date(String(value ?? "").replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

// "Oct 20, 2026" from a stored time; "" when it does not parse.
export function formatStamp(value) {
  const parsed = parseTimestamp(value);
  return parsed ? parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "";
}
