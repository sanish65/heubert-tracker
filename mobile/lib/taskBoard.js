// MIRROR of src/lib/taskBoard.js, copied verbatim below this header because the app cannot import
// from src/. src/lib/mobileTaskMirrors.test.mjs fails unless everything after this header
// equals the web file: change the web file, then copy it here again (keep this header).

// Pure rules for the Tasks tab (Jira-style issues, sprints and boards). Only relative
// imports of other pure modules, so it runs under `npm test`. The database enforces the
// same hierarchy and sprint rules in supabase/migrations/20261019125521_jira_issues.sql;
// these copies exist so the UI can offer only valid choices instead of letting a save fail.

import { DEFAULT_WORKFLOW, statusMeta, isDone } from "./taskWorkflow.js";

export const ISSUE_TYPES = [
  { value: "epic", label: "Epic", icon: "⚡", color: "#8b5cf6" },
  { value: "story", label: "Story", icon: "📗", color: "#22c55e" },
  { value: "task", label: "Task", icon: "☑️", color: "#3b82f6" },
  { value: "bug", label: "Bug", icon: "🐞", color: "#ef4444" },
  { value: "subtask", label: "Sub-task", icon: "↳", color: "#60a5fa" },
];

// The default workflow. Each project can have its own (src/lib/taskWorkflow.js); every
// rule below asks a status's category rather than comparing to these keys.
export const STATUSES = DEFAULT_WORKFLOW;

export const PRIORITIES = [
  { value: "highest", label: "Highest", icon: "⏫" },
  { value: "high", label: "High", icon: "🔼" },
  { value: "medium", label: "Medium", icon: "⏺️" },
  { value: "low", label: "Low", icon: "🔽" },
  { value: "lowest", label: "Lowest", icon: "⏬" },
];

// One stored row per relationship, read from either end.
export const LINK_TYPES = [
  { value: "blocks", outward: "blocks", inward: "is blocked by" },
  { value: "relates", outward: "relates to", inward: "relates to" },
  { value: "duplicates", outward: "duplicates", inward: "is duplicated by" },
];

// Every way a link can read from one issue ("this bug relates to POR-4"). Inward ones are
// stored reversed: "is blocked by B" is the row (B, this, 'blocks').
export const LINK_CHOICES = LINK_TYPES.flatMap((t) =>
  t.outward === t.inward
    ? [{ id: `${t.value}:out`, type: t.value, phrase: t.outward, inward: false }]
    : [
        { id: `${t.value}:out`, type: t.value, phrase: t.outward, inward: false },
        { id: `${t.value}:in`, type: t.value, phrase: t.inward, inward: true },
      ]
);

// The task_links row for "`fromId` <choice> `otherId`", as { source_id, target_id, link_type }.
export function linkRow(choiceId, fromId, otherId) {
  const choice = LINK_CHOICES.find((c) => c.id === choiceId) || LINK_CHOICES.find((c) => c.type === "relates");
  const [source_id, target_id] = choice.inward ? [otherId, fromId] : [fromId, otherId];
  return { source_id, target_id, link_type: choice.type };
}

// The planning poker scale, so an estimate agreed in a poker session can be copied
// straight onto the issue.
export const ESTIMATE_OPTIONS = [1, 2, 3, 5, 8, 13, 21];

export const EPIC_COLORS = ["#8b5cf6", "#ec4899", "#f97316", "#14b8a6", "#3b82f6", "#eab308", "#ef4444", "#22c55e"];

export const LABEL_MAX_LENGTH = 24;
export const LABELS_MAX = 8;
export const PROJECT_KEY_PATTERN = /^[A-Z][A-Z0-9]{1,9}$/;
export const RECENT_DAYS = 7;
export const DEFAULT_SPRINT_DAYS = 14;

const ORDER_GAP = 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

const byValue = (list, value) => list.find((item) => item.value === value);
export const issueType = (value) => byValue(ISSUE_TYPES, value) || ISSUE_TYPES[2];
export const statusInfo = (value, workflow = DEFAULT_WORKFLOW) => statusMeta(value, workflow);
export const priorityInfo = (value) => byValue(PRIORITIES, value) || PRIORITIES[2];

// ── Keys ────────────────────────────────────────────────────────────────────

export function issueKey(project, task) {
  if (!task) return "";
  if (!project?.issue_key || task.number == null) return `#${task.id}`;
  return `${project.issue_key}-${task.number}`;
}

export function parseIssueKey(text) {
  const match = String(text || "").trim().toUpperCase().match(/^([A-Z][A-Z0-9]{1,9})-(\d+)$/);
  return match ? { key: match[1], number: Number(match[2]) } : null;
}

// "Acme Portal" -> "AP", "Heubert" -> "HEU"; a clash gets a digit ("AP2").
export function suggestProjectKey(name, takenKeys = []) {
  const words = String(name || "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  let base = words.length >= 2 ? words.map((w) => w[0]).join("").slice(0, 4) : (words[0] || "").slice(0, 3);
  if (!/^[A-Z]/.test(base)) base = `P${base}`;
  if (base.length < 2) base = `${base}X`.slice(0, 2);
  const taken = new Set(takenKeys.map((k) => String(k).toUpperCase()));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const candidate = `${base.slice(0, 9)}${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}

export function validateProjectKey(key, takenKeys = []) {
  const value = String(key || "").trim().toUpperCase();
  if (!PROJECT_KEY_PATTERN.test(value)) {
    return "Use 2–10 capital letters or digits, starting with a letter (e.g. HTT)";
  }
  if (takenKeys.map((k) => String(k).toUpperCase()).includes(value)) {
    return "Another project already uses this key";
  }
  return null;
}

// ── Hierarchy ───────────────────────────────────────────────────────────────

// Which issue types may be the parent of a `type`. Mirrors tasks_before_write().
export function allowedParentTypes(type) {
  if (type === "epic") return [];
  if (type === "subtask") return ["story", "task", "bug"];
  return ["epic"];
}

export function parentCandidates(tasks, issue) {
  const types = allowedParentTypes(issue.type);
  return tasks.filter(
    (t) =>
      types.includes(t.type) &&
      t.id !== issue.id &&
      t.project_id === issue.project_id
  );
}

// Story points count on standard issues only; Jira leaves them off epics and sub-tasks.
export const countsTowardPoints = (task) => task.type !== "epic" && task.type !== "subtask";

export function sumPoints(tasks) {
  return tasks.filter(countsTowardPoints).reduce((sum, t) => sum + (Number(t.estimate) || 0), 0);
}

export function childProgress(parentId, tasks) {
  const children = tasks.filter((t) => t.parent_id === parentId);
  const done = children.filter(isDone).length;
  return { total: children.length, done, percent: children.length ? Math.round((done / children.length) * 100) : 0 };
}

// ── Ordering (rank) ─────────────────────────────────────────────────────────

export function sortByRank(tasks) {
  return [...tasks].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.id ?? 0) - (b.id ?? 0)
  );
}

export function orderBetween(before, after) {
  const hasBefore = typeof before === "number" && Number.isFinite(before);
  const hasAfter = typeof after === "number" && Number.isFinite(after);
  if (hasBefore && hasAfter) return (before + after) / 2;
  if (hasBefore) return before + ORDER_GAP;
  if (hasAfter) return after - ORDER_GAP;
  return 0;
}

// Where a dragged issue lands in a list: just above `beforeId`, or at the bottom when it
// is null. The moving issue is ignored, so dropping it by its own neighbour is a no-op.
export function orderForDrop(list, beforeId, movingId) {
  const others = sortByRank(list.filter((t) => t.id !== movingId));
  const index = beforeId == null ? -1 : others.findIndex((t) => t.id === beforeId);
  if (index === -1) return orderBetween(others[others.length - 1]?.sort_order, undefined);
  return orderBetween(others[index - 1]?.sort_order, others[index].sort_order);
}

export function orderAtBottom(list) {
  const ranked = sortByRank(list);
  return orderBetween(ranked[ranked.length - 1]?.sort_order, undefined);
}

// ── Labels and links ────────────────────────────────────────────────────────

export function parseLabels(input) {
  const raw = Array.isArray(input) ? input : String(input || "").split(",");
  const seen = new Set();
  const labels = [];
  for (const part of raw) {
    const label = String(part).trim().slice(0, LABEL_MAX_LENGTH);
    if (!label) continue;
    const key = label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    labels.push(label);
    if (labels.length === LABELS_MAX) break;
  }
  return labels;
}

const JIRA_KEY = /\b([A-Z][A-Z0-9]{1,9}-\d+)\b/;

// Turns a pasted GitHub or Jira URL into a short label. Anything else shows its host.
export function describeExternalLink(url) {
  const value = String(url || "").trim();
  if (!value) return null;
  let parsed;
  try {
    parsed = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return { kind: "link", label: value, url: value };
  }
  const href = parsed.toString();
  const host = parsed.hostname.replace(/^www\./, "");
  const parts = parsed.pathname.split("/").filter(Boolean);

  if (host === "github.com" && parts.length >= 2) {
    const repo = `${parts[0]}/${parts[1]}`;
    if (parts[2] === "pull" && parts[3]) return { kind: "github-pr", label: `${repo}#${parts[3]}`, url: href };
    if (parts[2] === "issues" && parts[3]) return { kind: "github-issue", label: `${repo}#${parts[3]}`, url: href };
    return { kind: "github", label: repo, url: href };
  }

  const jiraMatch =
    (host.endsWith("atlassian.net") || parts.includes("browse")) &&
    (parsed.pathname.match(JIRA_KEY) || parsed.search.match(JIRA_KEY));
  if (jiraMatch) return { kind: "jira", label: jiraMatch[1], url: href };

  return { kind: "link", label: host || value, url: href };
}

// How a stored link reads from the issue being viewed.
export function describeIssueLink(link, viewingId) {
  const type = byValue(LINK_TYPES, link.link_type) || LINK_TYPES[1];
  const outward = link.source_id === viewingId;
  return { phrase: outward ? type.outward : type.inward, otherId: outward ? link.target_id : link.source_id };
}

// ── Dates and permissions ───────────────────────────────────────────────────

export function isOverdue(task, todayStr) {
  if (!task?.due_date || isDone(task)) return false;
  return String(task.due_date).slice(0, 10) < todayStr;
}

export function canDeleteTask({ task, isAdmin, email }) {
  if (isAdmin) return true;
  if (!task?.created_by || !email) return false;
  return String(task.created_by).toLowerCase() === String(email).toLowerCase();
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

export function daysBetween(fromStr, toStr) {
  return Math.round((Date.parse(`${toStr}T00:00:00Z`) - Date.parse(`${fromStr}T00:00:00Z`)) / DAY_MS);
}

export function defaultSprintDates(todayStr, days = DEFAULT_SPRINT_DAYS) {
  return { start: todayStr, end: addDays(todayStr, days - 1) };
}

// "HTT Sprint 4": one past the highest number already used in this project's sprints.
export function nextSprintName(projectKey, sprints) {
  const prefix = projectKey ? `${projectKey} Sprint` : "Sprint";
  const used = sprints
    .map((s) => String(s.name || "").match(/(\d+)\s*$/))
    .filter(Boolean)
    .map((m) => Number(m[1]));
  return `${prefix} ${used.length ? Math.max(...used) + 1 : 1}`;
}

// ── Views ───────────────────────────────────────────────────────────────────

// filters: { search, onlyMine, recent, types: [], epicId, assigneeId }
export function filterIssues(tasks, filters, { currentEmployeeId = null, nowMs = Date.now(), keyOf = () => "" } = {}) {
  // predicate: a compiled JQL query (src/lib/taskQuery.js), applied on top of the rest.
  // assignees: the avatars picked over the board, any of them; null in it is Unassigned.
  const { search = "", onlyMine = false, recent = false, types = [], epicId = null, assigneeId = null, assignees = [], predicate = null } = filters || {};
  const needle = search.trim().toLowerCase();
  return tasks.filter((task) => {
    if (predicate && !predicate(task)) return false;
    if (onlyMine && (currentEmployeeId == null || task.assignee_id !== currentEmployeeId)) return false;
    if (assigneeId != null && task.assignee_id !== assigneeId) return false;
    if (assignees.length && !assignees.includes(task.assignee_id ?? null)) return false;
    if (types.length && !types.includes(task.type)) return false;
    if (epicId != null && task.parent_id !== epicId && task.id !== epicId) return false;
    if (recent) {
      const updated = Date.parse(task.updated_at || task.created_at || "");
      if (!Number.isFinite(updated) || nowMs - updated > RECENT_DAYS * DAY_MS) return false;
    }
    if (needle) {
      const haystack = [keyOf(task), task.title, task.description, ...(task.labels || []), describeExternalLink(task.external_url)?.label]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

// The avatar row over the board, as in Jira: everyone with an issue in the project (epics
// aside, as the board never shows them), you first, then by name. `unassigned` says whether
// an Unassigned avatar belongs at the end.
export function assigneesOf(tasks, employeesById, meId = null) {
  const ids = new Set();
  let unassigned = false;
  for (const task of tasks) {
    if (task.type === "epic") continue;
    if (task.assignee_id == null) unassigned = true;
    else ids.add(task.assignee_id);
  }
  const people = [...ids]
    .map((id) => employeesById.get(id))
    .filter(Boolean)
    .sort((a, b) => (b.id === meId) - (a.id === meId) || a.name.localeCompare(b.name));
  return { people, unassigned };
}

export function activeSprintOf(sprints) {
  return sprints.find((s) => s.state === "active") || null;
}

// The board shows the active sprint's work. Epics are never on a board.
export function boardIssues(tasks, sprintId) {
  if (sprintId == null) return [];
  return tasks.filter((t) => t.sprint_id === sprintId && t.type !== "epic");
}

// One list per column of the workflow. An issue whose status the workflow no longer has
// shows in the first column of its category, so nothing disappears from the board.
export function groupByStatus(tasks, workflow = DEFAULT_WORKFLOW) {
  const groups = Object.fromEntries(workflow.map((s) => [s.value, []]));
  for (const task of tasks) {
    const home =
      groups[task.status] ||
      groups[workflow.find((s) => s.category === task.status_category)?.value] ||
      groups[workflow[0].value];
    home.push(task);
  }
  for (const key of Object.keys(groups)) groups[key] = sortByRank(groups[key]);
  return groups;
}

// Swimlanes: "none", "assignee" or "epic". Sub-tasks ride in their parent's epic lane.
export function swimlanes(tasks, mode, { employeesById = new Map(), tasksById = new Map() } = {}) {
  if (mode !== "assignee" && mode !== "epic") return [{ id: "all", title: null, issues: tasks }];
  const lanes = new Map();
  const laneFor = (task) => {
    if (mode === "assignee") {
      const emp = employeesById.get(task.assignee_id);
      return emp ? { id: `a-${emp.id}`, title: emp.name } : { id: "a-none", title: "Unassigned" };
    }
    const owner = task.type === "subtask" ? tasksById.get(task.parent_id) : task;
    const epic = owner?.parent_id != null ? tasksById.get(owner.parent_id) : null;
    return epic ? { id: `e-${epic.id}`, title: epic.title, epic } : { id: "e-none", title: "No epic" };
  };
  for (const task of tasks) {
    const lane = laneFor(task);
    if (!lanes.has(lane.id)) lanes.set(lane.id, { ...lane, issues: [] });
    lanes.get(lane.id).issues.push(task);
  }
  // Named lanes alphabetically, the catch-all lane last — Jira's order.
  return [...lanes.values()].sort((a, b) => {
    const aNone = a.id.endsWith("-none");
    const bNone = b.id.endsWith("-none");
    if (aNone !== bNone) return aNone ? 1 : -1;
    return String(a.title).localeCompare(String(b.title));
  });
}

// Backlog: open future/active sprints in order, then the issues in no sprint. Epics live
// in their own panel and sub-tasks under their parent, so neither is listed as a row.
export function backlogSections(tasks, sprints) {
  const rows = tasks.filter((t) => t.type !== "epic" && t.type !== "subtask");
  const open = sprints
    .filter((s) => s.state !== "closed")
    .sort((a, b) => {
      if (a.state !== b.state) return a.state === "active" ? -1 : 1;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.id - b.id;
    });
  const backlogAll = rows.filter((t) => t.sprint_id == null);
  return {
    sprints: open.map((sprint) => ({ sprint, issues: sortByRank(rows.filter((t) => t.sprint_id === sprint.id)) })),
    backlog: sortByRank(backlogAll.filter((t) => !isDone(t))),
    hiddenDone: backlogAll.filter(isDone).length,
  };
}

// ── Reports ─────────────────────────────────────────────────────────────────

// Remaining points per day across the sprint. Actuals stop at today; the ideal line runs
// straight from the total on day one to zero on the last day.
export function burndownSeries(sprint, sprintIssues, todayStr) {
  if (!sprint?.start_date || !sprint?.end_date) return [];
  const counted = sprintIssues.filter(countsTowardPoints);
  const total = sumPoints(counted);
  const length = Math.max(daysBetween(sprint.start_date, sprint.end_date), 0);
  const series = [];
  for (let i = 0; i <= length; i++) {
    const date = addDays(sprint.start_date, i);
    const ideal = length === 0 ? 0 : total - (total * i) / length;
    let remaining = null;
    if (date <= todayStr) {
      const doneBy = counted
        .filter((t) => isDone(t) && t.completed_at && String(t.completed_at).slice(0, 10) <= date)
        .reduce((sum, t) => sum + (Number(t.estimate) || 0), 0);
      remaining = total - doneBy;
    }
    series.push({ date, ideal: Math.round(ideal * 10) / 10, remaining });
  }
  return series;
}

export function velocitySeries(sprints, limit = 7) {
  return sprints
    .filter((s) => s.state === "closed")
    .sort((a, b) => Date.parse(a.completed_at || 0) - Date.parse(b.completed_at || 0))
    .slice(-limit)
    .map((s) => ({ id: s.id, name: s.name, committed: Number(s.committed_points) || 0, completed: Number(s.completed_points) || 0 }));
}

// ── History ─────────────────────────────────────────────────────────────────

const FIELD_LABELS = {
  status: "Status",
  assignee_id: "Assignee",
  reporter_id: "Reporter",
  priority: "Priority",
  type: "Issue type",
  sprint_id: "Sprint",
  parent_id: "Parent",
  project_id: "Project",
  estimate: "Story points",
  due_date: "Due date",
  title: "Summary",
  labels: "Labels",
  external_url: "Development link",
  description: "Description",
};

// resolve: { employee(id), sprint(id), issue(id), project(id) } -> display text
export function describeActivity(entry, resolve = {}) {
  if (entry.field === "created") return { verb: "created the issue" };
  if (entry.field === "description") return { verb: "updated the Description" };
  const show = (value) => {
    if (value == null || value === "") return "None";
    switch (entry.field) {
      case "status": return resolve.status?.(value) || statusInfo(value).label;
      case "priority": return priorityInfo(value).label;
      case "type": return issueType(value).label;
      case "assignee_id":
      case "reporter_id": return resolve.employee?.(Number(value)) || "Unknown";
      case "sprint_id": return resolve.sprint?.(Number(value)) || "Removed sprint";
      case "parent_id": return resolve.issue?.(Number(value)) || "Removed issue";
      case "project_id": return resolve.project?.(Number(value)) || "Unknown";
      default: return String(value);
    }
  };
  return {
    verb: `changed the ${FIELD_LABELS[entry.field] || entry.field}`,
    from: show(entry.old_value),
    to: show(entry.new_value),
  };
}
