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

// ── Task notifications ──────────────────────────────────────────────────────

const STATUS_LABELS = { todo: "To Do", in_progress: "In Progress", review: "In Review", done: "Done" };

// A database timestamp as a plain ISO string (milliseconds, Z), so every engine reads it
// back: the phone's may refuse Supabase's six fraction digits. One that doesn't parse stays
// as it was.
function isoAt(value) {
  const ms = Date.parse(value ?? "");
  return Number.isFinite(ms) ? new Date(ms).toISOString() : value;
}

// A row of task_notifications (with its issue embedded as `task`) as the bell shows it.
// `key` is the issue key, e.g. "POR-4", worked out by the caller from the project.
export function taskNotificationItem(row, key) {
  const who = row.actor_name || "Someone";
  const title = row.task?.title || "an issue";
  let text;
  if (row.kind === "assigned") text = `${who} assigned ${key} to you`;
  else if (row.kind === "mentioned") text = `${who} mentioned you on ${key}`;
  else if (row.kind === "commented") text = `${who} commented on ${key}`;
  else text = `${who} moved ${key} to ${STATUS_LABELS[row.detail] || row.detail || "a new status"}`;
  return {
    id: `task-${row.id}`,
    notificationId: row.id,
    kind: "task",
    taskKind: row.kind,
    at: isoAt(row.created_at),
    read: Boolean(row.read_at),
    issueKey: key,
    text,
    sub: row.kind === "mentioned" || row.kind === "commented" ? row.detail || title : title,
  };
}

// ── Standup reminders ───────────────────────────────────────────────────────

// The bell's "you haven't filled in your standup" rows, from standupWindow's
// standupReminders(). None once it's submitted, or for someone who skips standups or is on
// a full-day leave that day.
export function standupReminderItems(reminders, { submitted = false, skip = false } = {}) {
  if (submitted || skip) return [];
  return (reminders || []).map((r) => ({
    id: `standup-reminder-${r.date}-${r.kind}`,
    kind: "standup-reminder",
    reminder: r.kind,
    date: r.date,
    at: r.at,
  }));
}

// Fines and task notifications in one list, newest first.
export function mergeNotifications(fineItems, taskItems, limit = 15) {
  return [...(fineItems || []), ...(taskItems || [])]
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
    .slice(0, limit);
}
