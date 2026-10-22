// MIRROR of src/lib/taskExtras.js, copied verbatim below this header because the app cannot import
// from src/. src/lib/mobileTaskMirrors.test.mjs fails unless everything after this header
// equals the web file: change the web file, then copy it here again (keep this header).

// Pure rules for the second batch of Jira-style features on the Tasks tab: time
// tracking, Kanban boards and WIP limits, releases, cloning and @mentions. No imports,
// so it runs under `npm test`. The database side is supabase/migrations/20261021170648_jira_more.sql.

import { isDone, isInProgress } from "./taskWorkflow.js";

// Board columns a WIP limit can apply to in the default workflow. Done has no limit, as
// in Jira; a custom workflow passes its own not-done keys.
export const STATUSES_FOR_WIP = ["todo", "in_progress", "review"];

// Jira's time units: a day is 8 working hours, a week 5 days.
export const HOURS_PER_DAY = 8;
export const DAYS_PER_WEEK = 5;
const MIN_PER = { w: DAYS_PER_WEEK * HOURS_PER_DAY * 60, d: HOURS_PER_DAY * 60, h: 60, m: 1 };
export const DONE_VISIBLE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

// ── Time ────────────────────────────────────────────────────────────────────

// "1w 2d 3h 30m", "1.5h", "90m" -> minutes. A bare number is hours, as people type "2"
// for two hours. null for anything else, and for zero unless allowZero (a remaining
// estimate can be zero; time spent can't).
export function parseDuration(input, { allowZero = false } = {}) {
  const text = String(input ?? "").trim().toLowerCase();
  if (!text) return null;
  const ok = (minutes) => (minutes > 0 || (allowZero && minutes === 0) ? minutes : null);
  if (/^\d+(\.\d+)?$/.test(text)) return ok(Math.round(Number(text) * 60));
  const parts = text.split(/\s+/);
  let total = 0;
  for (const part of parts) {
    const match = part.match(/^(\d+(?:\.\d+)?)([wdhm])$/);
    if (!match) return null;
    total += Number(match[1]) * MIN_PER[match[2]];
  }
  return ok(Math.round(total));
}

export function formatDuration(minutes) {
  if (minutes == null || !Number.isFinite(Number(minutes))) return "";
  let rest = Math.max(Math.round(Number(minutes)), 0);
  if (rest === 0) return "0m";
  const out = [];
  for (const unit of ["w", "d", "h", "m"]) {
    const size = MIN_PER[unit];
    const n = Math.floor(rest / size);
    if (n) out.push(`${n}${unit}`);
    rest -= n * size;
  }
  return out.join(" ");
}

// The three numbers Jira's time-tracking bar shows, plus the bar's split. When nobody
// set a remaining estimate it is whatever the original estimate has left.
export function timeTracking(task) {
  const spent = Math.max(Number(task?.time_spent_min) || 0, 0);
  const original = task?.original_estimate_min == null ? null : Number(task.original_estimate_min);
  const remaining =
    task?.remaining_estimate_min != null ? Number(task.remaining_estimate_min) : original != null ? Math.max(original - spent, 0) : null;
  const total = spent + (remaining || 0);
  const over = original != null && spent + (remaining || 0) > original ? spent + (remaining || 0) - original : 0;
  return {
    spent,
    remaining,
    original,
    spentPct: total ? Math.round((spent / total) * 100) : 0,
    overMinutes: over,
    hasAny: spent > 0 || original != null || remaining != null,
  };
}

// ── Kanban ──────────────────────────────────────────────────────────────────

// A Kanban board shows every issue but epics, with Done trimmed to the last two weeks
// so the column doesn't grow forever.
export function kanbanIssues(tasks, nowMs = Date.now(), doneDays = DONE_VISIBLE_DAYS) {
  return tasks.filter((t) => {
    if (t.type === "epic") return false;
    if (!isDone(t)) return true;
    const finished = Date.parse(t.completed_at || t.updated_at || "");
    return !Number.isFinite(finished) || nowMs - finished <= doneDays * DAY_MS;
  });
}

// Only positive whole limits on the board's own columns survive.
export function normalizeWipLimits(raw, keys = STATUSES_FOR_WIP) {
  const out = {};
  for (const status of keys) {
    const n = Number(raw?.[status]);
    if (Number.isInteger(n) && n > 0) out[status] = n;
  }
  return out;
}

export function wipStatus(count, limit) {
  if (!limit) return null;
  return { limit, over: count > limit, full: count === limit };
}

// Issues finished in the last `days`, and how long they took from creation, in days.
export function flowStats(tasks, nowMs = Date.now(), days = 30) {
  const since = nowMs - days * DAY_MS;
  const done = tasks.filter((t) => t.type !== "epic" && isDone(t) && Date.parse(t.completed_at || "") >= since);
  const cycles = done
    .map((t) => (Date.parse(t.completed_at) - Date.parse(t.created_at || "")) / DAY_MS)
    .filter((d) => Number.isFinite(d) && d >= 0);
  const avg = cycles.length ? cycles.reduce((a, b) => a + b, 0) / cycles.length : null;
  return { throughput: done.length, avgCycleDays: avg == null ? null : Math.round(avg * 10) / 10 };
}

// ── Releases ────────────────────────────────────────────────────────────────

export function versionProgress(versionId, tasks) {
  const issues = tasks.filter((t) => t.fix_version_id === versionId && t.type !== "epic");
  const done = issues.filter(isDone).length;
  const inProgress = issues.filter(isInProgress).length;
  return {
    total: issues.length,
    done,
    inProgress,
    todo: issues.length - done - inProgress,
    percent: issues.length ? Math.round((done / issues.length) * 100) : 0,
  };
}

// Unreleased first, soonest release date first (undated last); then released, newest
// first; archived last.
export function sortVersions(versions) {
  const rank = { unreleased: 0, released: 1, archived: 2 };
  return [...versions].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    if (a.status === "unreleased") {
      if (!a.release_date !== !b.release_date) return a.release_date ? -1 : 1;
      return String(a.release_date || "").localeCompare(String(b.release_date || "")) || a.name.localeCompare(b.name);
    }
    return Date.parse(b.released_at || 0) - Date.parse(a.released_at || 0) || a.name.localeCompare(b.name);
  });
}

export function isVersionOverdue(version, todayStr) {
  return version.status === "unreleased" && Boolean(version.release_date) && String(version.release_date).slice(0, 10) < todayStr;
}

// ── Cloning ─────────────────────────────────────────────────────────────────

// What a clone copies, as in Jira: the issue's content and planning, not its history,
// comments, work logs or attachments. It starts in To Do with no time spent, and never in
// a closed sprint, where no board or backlog would show it.
export function cloneFields(task, sprints = []) {
  const sprint = sprints.find((s) => s.id === task.sprint_id);
  const openSprintId = sprint && sprint.state !== "closed" ? sprint.id : null;
  return {
    type: task.type,
    title: `CLONE - ${task.title}`.slice(0, 500),
    description: task.description || "",
    priority: task.priority,
    assignee_id: task.assignee_id ?? null,
    parent_id: task.parent_id ?? null,
    sprint_id: task.type === "epic" || task.type === "subtask" ? null : openSprintId,
    labels: task.labels || [],
    estimate: task.estimate ?? null,
    due_date: task.due_date || null,
    fix_version_id: task.fix_version_id ?? null,
    original_estimate_min: task.original_estimate_min ?? null,
    remaining_estimate_min: task.original_estimate_min ?? null,
    external_url: task.external_url || null,
    epic_color: task.epic_color || null,
  };
}

// ── @mentions ───────────────────────────────────────────────────────────────

// The "@ali" being typed just before the caret, or null. Stops at a space, so a
// finished mention ("@Alice Admin ") doesn't keep the menu open.
export function mentionQueryAt(text, caret) {
  const before = String(text || "").slice(0, caret);
  const match = before.match(/(^|\s)@([\p{L}.'-]{0,30})$/u);
  if (!match) return null;
  return { query: match[2], start: before.length - match[2].length - 1 };
}

export function mentionCandidates(employees, query, limit = 6) {
  const q = String(query || "").toLowerCase();
  return employees
    .filter((e) => e.status === "active")
    .filter((e) => !q || e.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || e.name.toLowerCase().startsWith(q))
    .slice(0, limit);
}

// Replaces the "@ali" at `start` with "@Alice Admin " and says where the caret goes.
export function insertMention(text, start, caret, name) {
  const value = String(text || "");
  const inserted = `@${name} `;
  return { text: value.slice(0, start) + inserted + value.slice(caret), caret: start + inserted.length };
}

// The ids picked from the menu whose "@Name" is still in the text when it's posted.
export function mentionedIds(body, picked) {
  const text = String(body || "");
  return [...new Set(picked.filter((p) => text.includes(`@${p.name}`)).map((p) => p.id))];
}
