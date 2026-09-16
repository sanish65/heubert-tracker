// Bikram Sambat (Nepali calendar) conversion for the attendance sheet.
//
// BS month lengths don't follow a formula — they're published per year by the Nepali
// calendar authority, so the only correct approach is a lookup table. Each row is the
// day count of Baisakh…Chaitra for that BS year. Range 2000–2090 BS covers 1943–2034 AD.
//
// Anchor: BS 2000-01-01 === AD 1943-04-14.

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

const BS_MONTHS_NP = [
  "बैशाख", "जेठ", "असार", "साउन", "भदौ", "असोज",
  "कात्तिक", "मंसिर", "पुस", "माघ", "फागुन", "चैत",
];

const NP_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"];

function toNepaliDigits(n) {
  return String(n).replace(/\d/g, (d) => NP_DIGITS[Number(d)]);
}

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

/**
 * Inverse of adToBs — converts a BS year/month/day to a "YYYY-MM-DD" Gregorian date
 * string. Returns null if the BS date doesn't exist (out of table range, or a day past
 * the end of that BS month).
 */
export function bsToAd(year, month, day) {
  const yearIndex = year - BS_START_YEAR;
  if (yearIndex < 0 || yearIndex >= BS_MONTH_DAYS.length) return null;
  if (month < 1 || month > 12) return null;

  const months = BS_MONTH_DAYS[yearIndex];
  if (day < 1 || day > months[month - 1]) return null;

  let days = 0;
  for (let i = 0; i < yearIndex; i++) {
    days += BS_MONTH_DAYS[i].reduce((sum, n) => sum + n, 0);
  }
  for (let i = 0; i < month - 1; i++) {
    days += months[i];
  }
  days += day - 1;

  return new Date(AD_ANCHOR_UTC + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * How many days are in the given BS month — 29 to 32, varies by year. 0 if unknown.
 */
export function bsMonthLength(year, month) {
  const months = BS_MONTH_DAYS[year - BS_START_YEAR];
  return months ? months[month - 1] : 0;
}

/**
 * The Gregorian span of a BS month, as ["YYYY-MM-DD", "YYYY-MM-DD"] — a BS month always
 * straddles two Gregorian months. Null if the BS month is outside the table.
 */
export function bsMonthSpan(year, month) {
  const length = bsMonthLength(year, month);
  if (!length) return null;
  const first = bsToAd(year, month, 1);
  const last = bsToAd(year, month, length);
  return first && last ? [first, last] : null;
}

/** Inclusive BS year bounds the lookup table covers. */
export const BS_YEAR_BOUNDS = {
  min: BS_START_YEAR,
  max: BS_START_YEAR + BS_MONTH_DAYS.length - 1,
};

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
 * "१६ भदौ २०८३" — Devanagari, used as the tooltip on the romanized form.
 */
export function formatBsDevanagari(dateStr) {
  const bs = adToBs(dateStr);
  if (!bs) return "";
  return `${toNepaliDigits(bs.day)} ${BS_MONTHS_NP[bs.month - 1]} ${toNepaliDigits(bs.year)}`;
}

/**
 * "2083-05-16" — compact numeric form for CSV export.
 */
export function formatBsNumeric(dateStr) {
  const bs = adToBs(dateStr);
  if (!bs) return "";
  return `${bs.year}-${String(bs.month).padStart(2, "0")}-${String(bs.day).padStart(2, "0")}`;
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
