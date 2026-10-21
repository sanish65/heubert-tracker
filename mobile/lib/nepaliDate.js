// Bikram Sambat (Nepali calendar) dates for the Leaves calendar: the BS day under each date and the
// BS months a Gregorian month spans. Mirrors src/lib/nepaliDate.js (adToBs, formatBs, bsMonthRange,
// BS_MONTH_NAMES and the lookup table they read) because the app cannot import from src/.
// src/lib/mobileNepaliDate.test.mjs runs both on the same dates and fails when they differ: change
// a row or a rule there and here together. Not mirrored: bsToAd, the month spans, the Devanagari
// and numeric forms, which only the web's attendance sheet and BS calendar view need. Pure: no
// imports.
//
// BS month lengths don't follow a formula; they are published per year, so the only correct
// approach is a lookup table. Each row is the day count of Baisakh…Chaitra for that BS year.
// Range 2000–2090 BS covers 1943–2034 AD. Anchor: BS 2000-01-01 === AD 1943-04-14.

const BS_START_YEAR = 2000;
const AD_ANCHOR_UTC = Date.UTC(1943, 3, 14);
const MS_PER_DAY = 86400000;

// prettier-ignore
const BS_MONTH_DAYS = [
  [30,32,31,32,31,30,30,30,29,30,29,31], // 2000
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,31,32,32,31,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [30,32,31,32,31,30,30,30,29,30,29,31],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,31,32,32,31,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [31,31,31,32,31,31,29,30,30,29,29,31],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,31,32,32,31,30,30,29,30,29,30,30], // 2010
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [31,31,31,32,31,31,29,30,30,29,30,30],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,31,32,32,31,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [31,31,31,32,31,31,29,30,30,29,30,30],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,30,29,31],
  [31,31,31,32,31,31,30,29,30,29,30,30], // 2020
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,30],
  [31,32,31,32,31,30,30,30,29,30,29,31],
  [31,31,31,32,31,31,30,29,30,29,30,30],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [30,32,31,32,31,30,30,30,29,30,29,31],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,31,32,31,32,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31], // 2030
  [30,32,31,32,31,30,30,30,29,30,29,31],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,31,32,32,31,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [30,32,31,32,31,31,29,30,30,29,29,31],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,31,32,32,31,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [31,31,31,32,31,31,29,30,30,29,30,30],
  [31,31,32,31,31,31,30,29,30,29,30,30], // 2040
  [31,31,32,32,31,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [31,31,31,32,31,31,29,30,30,29,30,30],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [31,31,31,32,31,31,30,29,30,29,30,30],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,30],
  [31,32,31,32,31,30,30,30,29,30,29,31], // 2050
  [31,31,31,32,31,31,30,29,30,29,30,30],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,30],
  [31,32,31,32,31,30,30,30,29,30,29,31],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,31,32,31,32,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [30,32,31,32,31,30,30,30,29,30,29,31],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,31,32,32,31,30,30,29,30,29,30,30], // 2060
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [30,32,31,32,31,31,29,30,29,30,29,31],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,31,32,32,31,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [31,31,31,32,31,31,29,30,30,29,29,31],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,31,32,32,31,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [31,31,31,32,31,31,29,30,30,29,30,30], // 2070
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,31],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,31,32,32,31,30,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,30],
  [31,32,31,32,31,30,30,30,29,30,29,31],
  [31,31,31,32,31,31,30,29,30,29,30,30],
  [31,31,32,31,31,31,30,29,30,29,30,30],
  [31,32,31,32,31,30,30,30,29,29,30,30], // 2080
  [31,31,32,32,31,30,30,30,29,30,30,30],
  [30,32,31,32,31,30,30,30,29,30,30,30],
  [31,31,32,31,31,30,30,30,29,30,30,30],
  [31,31,32,31,31,30,30,30,29,30,30,30],
  [31,32,31,32,30,31,30,30,29,30,30,30],
  [30,32,31,32,31,30,30,30,29,30,30,30],
  [31,31,32,31,31,31,30,30,29,30,30,30],
  [30,31,32,32,30,31,30,30,29,30,30,30],
  [30,32,31,32,31,30,30,30,29,30,30,30],
  [30,32,31,32,31,30,30,30,29,30,30,30], // 2090
];

const BS_MONTHS = [
  "Baisakh", "Jestha", "Ashadh", "Shrawan", "Bhadra", "Ashwin",
  "Kartik", "Mangsir", "Poush", "Magh", "Falgun", "Chaitra",
];

/**
 * Converts a "YYYY-MM-DD" Gregorian date string to Bikram Sambat.
 * Returns { year, month, day } (month is 1-indexed), or null if the date falls
 * outside the lookup table.
 */
export function adToBs(dateStr) {
  if (!dateStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  let remaining = Math.round((Date.UTC(y, m - 1, d) - AD_ANCHOR_UTC) / MS_PER_DAY);
  if (remaining < 0) return null;

  let yearIndex = 0;
  while (yearIndex < BS_MONTH_DAYS.length) {
    const yearDays = BS_MONTH_DAYS[yearIndex].reduce((sum, n) => sum + n, 0);
    if (remaining < yearDays) break;
    remaining -= yearDays;
    yearIndex++;
  }
  if (yearIndex >= BS_MONTH_DAYS.length) return null;

  const months = BS_MONTH_DAYS[yearIndex];
  let monthIndex = 0;
  while (remaining >= months[monthIndex]) {
    remaining -= months[monthIndex];
    monthIndex++;
  }

  return { year: BS_START_YEAR + yearIndex, month: monthIndex + 1, day: remaining + 1 };
}

/** Romanized BS month names, Baisakh…Chaitra. */
export const BS_MONTH_NAMES = BS_MONTHS;

/**
 * "16 Bhadra 2083" — romanized, for display alongside the Gregorian date.
 */
export function formatBs(dateStr) {
  const bs = adToBs(dateStr);
  if (!bs) return "";
  return `${bs.day} ${BS_MONTHS[bs.month - 1]} ${bs.year}`;
}

/**
 * The BS month(s) a Gregorian month spans, e.g. "Bhadra–Ashwin 2083" — a Gregorian
 * month always straddles two BS months, except when it happens to align.
 */
export function bsMonthRange(firstDateStr, lastDateStr) {
  const start = adToBs(firstDateStr);
  const end = adToBs(lastDateStr);
  if (!start || !end) return "";

  const startName = BS_MONTHS[start.month - 1];
  const endName = BS_MONTHS[end.month - 1];
  if (start.year === end.year) {
    return start.month === end.month
      ? `${startName} ${start.year}`
      : `${startName}–${endName} ${start.year}`;
  }
  return `${startName} ${start.year}–${endName} ${end.year}`;
}
