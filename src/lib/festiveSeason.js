// Dashain & Tihar 2026: from the run-up to Dashain through Bhai Tika.
// Dates are local midnight; the season ends when Nov 13 begins.
export const FESTIVE_SEASON_START = new Date(2026, 9, 6); // Oct 6, 2026
export const FESTIVE_SEASON_END = new Date(2026, 10, 13); // Nov 13, 2026 (exclusive)

export function isFestiveSeason(date = new Date()) {
  return date >= FESTIVE_SEASON_START && date < FESTIVE_SEASON_END;
}
