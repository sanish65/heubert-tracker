// The bell's list: the fines recorded against you lately (late and standup), newest first, and how
// many of them arrived since the bell was last opened. Mirrors src/lib/notifications.js because the
// app cannot import from src/. src/lib/mobileNotifications.test.mjs runs both on the same inputs
// and fails when they differ: change a rule there and here together. Pure: its one import is
// lib/dates.js, itself pure.

import { parseTimestamp } from "./dates.js";

export const NOTIFY_DAYS = 30;
export const NOTIFY_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

// When the fine was recorded: created_at, else its date. null when neither parses.
// lib/dates.js cuts Supabase's six fraction digits to milliseconds, which Hermes may otherwise
// refuse. Phone only: the web's browsers read all six, and the result is the same either way, so
// the parity test stays green.
function recordedAt(row) {
  for (const value of [row.created_at, row.date]) {
    const parsed = parseTimestamp(value);
    if (parsed) return parsed.getTime();
  }
  return null;
}

export function myFineNotifications({
  fines,
  standupFines,
  name,
  now = new Date(),
  days = NOTIFY_DAYS,
  limit = NOTIFY_LIMIT,
  lateExcluded = false,
  standupExcluded = false,
} = {}) {
  if (!name) return [];
  const since = new Date(now).getTime() - days * DAY_MS;
  const found = [];

  const collect = (kind, rows) => {
    for (const row of rows || []) {
      // Exact, as the fine tables filter by name.
      if (row.employee_name !== name) continue;
      const ms = recordedAt(row);
      if (ms === null || ms < since) continue;
      const item = { id: `${kind}-${row.id}`, kind, date: row.date, at: new Date(ms).toISOString(), status: row.status };
      if (kind === "late") {
        item.amount = Number(row.amount) || 0;
        // Late Fines shows one season at a time; the bell opens the fine's own (null: none).
        item.seasonId = row.season_id ?? null;
      }
      found.push({ ms, item });
    }
  };

  if (!lateExcluded) collect("late", fines);
  if (!standupExcluded) collect("standup", standupFines);

  return found
    .sort((a, b) => b.ms - a.ms)
    .slice(0, limit)
    .map((entry) => entry.item);
}

// How many items arrived after the bell was last opened. Never opened, or a stored time
// that does not parse, means all of them.
export function unseenCount(items, seenAt) {
  const list = items || [];
  const seen = Date.parse(seenAt ?? "");
  if (!Number.isFinite(seen)) return list.length;
  return list.filter((item) => Date.parse(item.at) > seen).length;
}
