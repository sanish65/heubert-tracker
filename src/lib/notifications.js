// The top bar's bell: the fines recorded against you lately, the in-app version of the
// email /api/notify-fine sends (src/lib/fineNotifications.js). Pure, no imports, so it
// runs under `npm test`.

export const NOTIFY_DAYS = 30;
export const NOTIFY_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

// When the fine was recorded: created_at, else its date. null when neither parses.
function recordedAt(row) {
  for (const value of [row.created_at, row.date]) {
    const ms = Date.parse(value ?? "");
    if (Number.isFinite(ms)) return ms;
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
