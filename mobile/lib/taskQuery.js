// MIRROR of src/lib/taskQuery.js, copied verbatim below this header because the app cannot import
// from src/. src/lib/mobileTaskMirrors.test.mjs fails unless everything after this header
// equals the web file: change the web file, then copy it here again (keep this header).

// A JQL-like query language for the Tasks tab's search, saved filters and Issues view:
//
//   assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC
//   type in (bug, story) AND labels = ui AND sprint in openSprints()
//   updated >= -7d AND (flagged = true OR due < now())
//
// compileQuery(text, ctx) -> { ok: true, predicate(task), order } or { ok: false, error }.
// Pure; its only import is another pure module, so it runs under `npm test`.

import { isDone } from "./taskWorkflow.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const NEPAL_OFFSET = "+05:45";
const PRIORITY_RANK = { lowest: 1, low: 2, medium: 3, high: 4, highest: 5 };
const TYPE_ALIASES = { "sub-task": "subtask", subtask: "subtask", story: "story", task: "task", bug: "bug", epic: "epic" };
const CATEGORY_ALIASES = { todo: "todo", "to do": "todo", progress: "progress", "in progress": "progress", done: "done" };

// field name (lower case) -> canonical field
const FIELDS = {
  assignee: "assignee",
  reporter: "reporter",
  status: "status",
  statuscategory: "category",
  category: "category",
  priority: "priority",
  type: "type",
  issuetype: "type",
  labels: "labels",
  label: "labels",
  sprint: "sprint",
  fixversion: "version",
  version: "version",
  release: "version",
  epic: "epic",
  parent: "epic",
  flagged: "flagged",
  text: "text",
  summary: "summary",
  title: "summary",
  description: "description",
  key: "key",
  issuekey: "key",
  created: "created",
  updated: "updated",
  due: "due",
  duedate: "due",
  resolved: "resolved",
  points: "points",
  storypoints: "points",
  estimate: "points",
};
export const QUERY_FIELDS = [
  "assignee", "reporter", "status", "statusCategory", "priority", "type", "labels", "sprint",
  "fixVersion", "epic", "flagged", "text", "summary", "description", "key", "created", "updated",
  "due", "resolved", "points",
];
const ORDERABLE = { created: "created", updated: "updated", priority: "priority", rank: "rank", due: "due", duedate: "due", key: "key", points: "points", status: "status", assignee: "assignee", resolved: "resolved" };
const KEYWORDS = new Set(["and", "or", "not", "in", "is", "empty", "null", "order", "by", "asc", "desc"]);

class QueryError extends Error {}

// ── Tokens ──────────────────────────────────────────────────────────────────

function tokenize(text) {
  const tokens = [];
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (/\s/.test(c)) {
      i += 1;
      continue;
    }
    if (c === "(" || c === ")" || c === ",") {
      tokens.push({ t: c, pos: i });
      i += 1;
      continue;
    }
    const op = text.slice(i).match(/^(!=|>=|<=|!~|=|~|>|<)/);
    if (op) {
      tokens.push({ t: "op", v: op[1], pos: i });
      i += op[1].length;
      continue;
    }
    if (c === '"' || c === "'") {
      const end = text.indexOf(c, i + 1);
      if (end === -1) throw new QueryError(`Unclosed quote at character ${i + 1}`);
      tokens.push({ t: "str", v: text.slice(i + 1, end), pos: i });
      i = end + 1;
      continue;
    }
    const word = text.slice(i).match(/^[^\s(),=!~<>"']+/);
    if (word) {
      const w = word[0];
      // currentUser() and friends: a word directly followed by "()".
      if (text.slice(i + w.length, i + w.length + 2) === "()") {
        tokens.push({ t: "fn", v: w.toLowerCase(), pos: i });
        i += w.length + 2;
        continue;
      }
      const lower = w.toLowerCase();
      tokens.push({ t: KEYWORDS.has(lower) ? "kw" : "word", v: KEYWORDS.has(lower) ? lower : w, pos: i });
      i += w.length;
      continue;
    }
    throw new QueryError(`Unexpected "${c}" at character ${i + 1}`);
  }
  return tokens;
}

// ── Parser ──────────────────────────────────────────────────────────────────

function parse(tokens) {
  let p = 0;
  const peek = () => tokens[p];
  const isKw = (v) => peek()?.t === "kw" && peek().v === v;
  const take = () => tokens[p++];
  const expect = (t, what) => {
    const tok = take();
    if (!tok || tok.t !== t) throw new QueryError(`Expected ${what}${tok ? ` near "${tok.v ?? tok.t}"` : " at the end"}`);
    return tok;
  };

  const value = () => {
    const tok = take();
    if (!tok) throw new QueryError("Expected a value at the end");
    if (tok.t === "str" || tok.t === "word") return { kind: "lit", v: tok.v };
    if (tok.t === "fn") return { kind: "fn", v: tok.v };
    if (tok.t === "kw" && (tok.v === "empty" || tok.v === "null")) return { kind: "empty" };
    throw new QueryError(`Expected a value near "${tok.v ?? tok.t}"`);
  };

  const clause = () => {
    const tok = take();
    if (!tok || (tok.t !== "word" && tok.t !== "str")) throw new QueryError(`Expected a field${tok ? ` near "${tok.v ?? tok.t}"` : " at the end"}`);
    const field = FIELDS[tok.v.toLowerCase()];
    if (!field) throw new QueryError(`Unknown field "${tok.v}". Try: ${QUERY_FIELDS.join(", ")}`);
    if (isKw("is")) {
      take();
      const negate = isKw("not") ? (take(), true) : false;
      if (!(isKw("empty") || isKw("null"))) throw new QueryError(`Expected EMPTY after IS${negate ? " NOT" : ""}`);
      take();
      return { kind: "clause", field, op: negate ? "isnotempty" : "isempty" };
    }
    const notIn = isKw("not") && tokens[p + 1]?.t === "kw" && tokens[p + 1].v === "in";
    if (notIn || isKw("in")) {
      if (notIn) take();
      take();
      const list = [];
      const fnList = peek()?.t === "fn";
      if (fnList) list.push(value());
      else {
        expect("(", "( after IN");
        list.push(value());
        while (peek()?.t === ",") {
          take();
          list.push(value());
        }
        expect(")", ") to close the IN list");
      }
      return { kind: "clause", field, op: notIn ? "notin" : "in", values: list };
    }
    const opTok = take();
    if (!opTok || opTok.t !== "op") throw new QueryError(`Expected =, !=, ~, <, >, IN or IS after ${tok.v}`);
    return { kind: "clause", field, op: opTok.v, values: [value()] };
  };

  const factor = () => {
    if (isKw("not")) {
      take();
      return { kind: "not", e: factor() };
    }
    if (peek()?.t === "(") {
      take();
      const e = expr();
      expect(")", ") to close the bracket");
      return e;
    }
    return clause();
  };
  const term = () => {
    let left = factor();
    while (isKw("and")) {
      take();
      left = { kind: "and", a: left, b: factor() };
    }
    return left;
  };
  function expr() {
    let left = term();
    while (isKw("or")) {
      take();
      left = { kind: "or", a: left, b: term() };
    }
    return left;
  }

  const ast = peek() && !isKw("order") ? expr() : null;
  const order = [];
  if (isKw("order")) {
    take();
    if (!isKw("by")) throw new QueryError("Expected BY after ORDER");
    take();
    do {
      if (peek()?.t === ",") take();
      const f = take();
      const field = f && ORDERABLE[String(f.v).toLowerCase()];
      if (!field) throw new QueryError(`Can't order by "${f?.v ?? ""}". Try: ${Object.keys(ORDERABLE).join(", ")}`);
      let dir = "asc";
      if (isKw("asc") || isKw("desc")) dir = take().v;
      order.push({ field, dir });
    } while (peek()?.t === ",");
  }
  if (p < tokens.length) {
    const tok = tokens[p];
    throw new QueryError(`Unexpected "${tok.v ?? tok.t}" at character ${tok.pos + 1}. Join conditions with AND or OR.`);
  }
  return { ast, order };
}

// ── Values ──────────────────────────────────────────────────────────────────

const lower = (v) => String(v ?? "").trim().toLowerCase();

function nepalDayStart(dateStr) {
  return Date.parse(`${dateStr}T00:00:00${NEPAL_OFFSET}`);
}

// -7d, +2w, 2026-10-01, now(), startOfDay() -> milliseconds.
function dateValue(v, ctx) {
  if (v.kind === "fn") {
    if (v.v === "now") return ctx.nowMs;
    if (v.v === "startofday") return nepalDayStart(ctx.todayStr);
    throw new QueryError(`${v.v}() isn't a date. Use now(), startOfDay(), -7d or 2026-10-01`);
  }
  if (v.kind !== "lit") return null;
  const rel = String(v.v).match(/^([+-]?)(\d+)([dwh])$/i);
  if (rel) {
    const n = Number(rel[2]) * (rel[3].toLowerCase() === "w" ? 7 * DAY_MS : rel[3].toLowerCase() === "h" ? 3600000 : DAY_MS);
    return ctx.nowMs + (rel[1] === "+" ? n : -n);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(v.v)) return nepalDayStart(v.v);
  throw new QueryError(`"${v.v}" isn't a date. Use -7d, -2w, 2026-10-01 or now()`);
}

function taskDate(task, field) {
  const raw = { created: task.created_at, updated: task.updated_at, resolved: task.completed_at, due: task.due_date }[field];
  if (!raw) return null;
  return field === "due" ? nepalDayStart(String(raw).slice(0, 10)) : Date.parse(raw);
}

function employeeIds(v, ctx) {
  if (v.kind === "fn") {
    if (v.v === "currentuser") return ctx.me == null ? [] : [ctx.me];
    throw new QueryError(`${v.v}() doesn't name a person. Use currentUser() or a name`);
  }
  const q = lower(v.v);
  if (q === "unassigned") return [null];
  const ids = (ctx.employees || [])
    .filter((e) => lower(e.name) === q || lower(e.name).split(/\s+/)[0] === q || lower(e.work_email) === q)
    .map((e) => e.id);
  if (!ids.length && ctx.employees) throw new QueryError(`No one called "${v.v}"`);
  return ids;
}

function sprintIds(v, ctx) {
  const sprints = ctx.sprints || [];
  if (v.kind === "fn") {
    const by = { opensprints: ["active", "future"], closedsprints: ["closed"], futuresprints: ["future"], activesprints: ["active"] }[v.v];
    if (!by) throw new QueryError(`${v.v}() isn't a sprint function. Try openSprints(), closedSprints() or futureSprints()`);
    return sprints.filter((s) => by.includes(s.state)).map((s) => s.id);
  }
  const ids = sprints.filter((s) => lower(s.name) === lower(v.v) || String(s.id) === String(v.v)).map((s) => s.id);
  if (!ids.length && ctx.sprints) throw new QueryError(`No sprint called "${v.v}"`);
  return ids;
}

function versionIds(v, ctx) {
  const versions = ctx.versions || [];
  if (v.kind === "fn") {
    const by = { unreleasedversions: "unreleased", releasedversions: "released", archivedversions: "archived" }[v.v];
    if (!by) throw new QueryError(`${v.v}() isn't a release function. Try unreleasedVersions() or releasedVersions()`);
    return versions.filter((x) => x.status === by).map((x) => x.id);
  }
  const ids = versions.filter((x) => lower(x.name) === lower(v.v)).map((x) => x.id);
  if (!ids.length && ctx.versions) throw new QueryError(`No release called "${v.v}"`);
  return ids;
}

// ── Evaluation ──────────────────────────────────────────────────────────────

// What a clause compares: one value per issue, or a list (labels).
function fieldValue(task, field, ctx) {
  switch (field) {
    case "assignee": return task.assignee_id ?? null;
    case "reporter": return task.reporter_id ?? null;
    case "status": return task.status;
    case "category": return task.status_category || (isDone(task) ? "done" : "todo");
    case "priority": return task.priority;
    case "type": return task.type;
    case "labels": return (task.labels || []).map(lower);
    case "sprint": return task.sprint_id ?? null;
    case "version": return task.fix_version_id ?? null;
    case "epic": {
      const owner = task.type === "subtask" ? ctx.tasksById?.get(task.parent_id) : task;
      return owner?.parent_id ?? null;
    }
    case "flagged": return Boolean(task.flagged);
    case "key": return lower(ctx.keyOf?.(task));
    case "points": return task.estimate == null ? null : Number(task.estimate);
    default: return null;
  }
}

// The issue-side value(s) a literal stands for, so = and IN compare like with like.
function resolveValues(field, v, ctx) {
  if (v.kind === "empty") return [null];
  switch (field) {
    case "assignee":
    case "reporter":
      return employeeIds(v, ctx);
    case "status": {
      // Names first: after a rename, "Done" means the status called Done now, whatever
      // its key. A name the workflow doesn't have is a mistake, as in Jira.
      const q = lower(v.v);
      const flow = ctx.workflow || [];
      const match = flow.find((s) => lower(s.label) === q) || flow.find((s) => lower(s.value) === q);
      if (!match && ctx.workflow) throw new QueryError(`No status called "${v.v}" in this workflow`);
      return [match ? match.value : q];
    }
    case "category": {
      const c = CATEGORY_ALIASES[lower(v.v)];
      if (!c) throw new QueryError(`statusCategory is "To Do", "In Progress" or "Done"`);
      return [c];
    }
    case "priority": {
      if (!PRIORITY_RANK[lower(v.v)]) throw new QueryError(`"${v.v}" isn't a priority. Use lowest, low, medium, high or highest`);
      return [lower(v.v)];
    }
    case "type": {
      const type = TYPE_ALIASES[lower(v.v)];
      if (!type) throw new QueryError(`"${v.v}" isn't an issue type. Use epic, story, task, bug or sub-task`);
      return [type];
    }
    case "labels": return [lower(v.v)];
    case "sprint": return sprintIds(v, ctx);
    case "version": return versionIds(v, ctx);
    case "epic": {
      const q = lower(v.v);
      const ids = (ctx.tasks || []).filter((t) => t.type === "epic" && (lower(ctx.keyOf?.(t)) === q || lower(t.title) === q)).map((t) => t.id);
      if (!ids.length && ctx.tasks) throw new QueryError(`No epic called "${v.v}"`);
      return ids;
    }
    case "flagged": {
      const q = lower(v.v);
      if (["true", "yes", "1"].includes(q)) return [true];
      if (["false", "no", "0"].includes(q)) return [false];
      throw new QueryError("flagged is true or false");
    }
    case "key": return [lower(v.v)];
    case "points": {
      const n = Number(v.v);
      if (!Number.isFinite(n)) throw new QueryError(`points compares numbers, not "${v.v}"`);
      return [n];
    }
    default:
      return [lower(v.v)];
  }
}

const TEXT_FIELDS = { text: (t) => [t.title, t.description, ...(t.labels || [])], summary: (t) => [t.title], description: (t) => [t.description] };
const DATE_FIELDS = new Set(["created", "updated", "due", "resolved"]);

// Builds the clause's test once (resolving names, sprints, dates), then runs it per issue.
function compileClause(c, ctx) {
  const { field, op } = c;

  if (TEXT_FIELDS[field]) {
    // "summary ~ EMPTY" reads as "summary IS EMPTY".
    const textEmpty = c.values?.[0]?.kind === "empty";
    if (op === "isempty" || op === "isnotempty" || textEmpty) {
      const wantEmpty = op === "isempty" || (textEmpty && (op === "~" || op === "="));
      return (t) => wantEmpty === !TEXT_FIELDS[field](t).filter(Boolean).join("").trim();
    }
    if (op !== "~" && op !== "!~") throw new QueryError(`${field} uses ~ (contains), e.g. ${field} ~ "login"`);
    const needle = lower(c.values[0].v);
    return (t) => {
      const has = TEXT_FIELDS[field](t).filter(Boolean).join(" ").toLowerCase().includes(needle);
      return op === "~" ? has : !has;
    };
  }

  if (DATE_FIELDS.has(field)) {
    if (op === "isempty" || op === "isnotempty") return (t) => (op === "isempty") === (taskDate(t, field) == null);
    if (c.values[0].kind === "empty") {
      if (op !== "=" && op !== "!=") throw new QueryError(`${field} can only be = EMPTY or != EMPTY`);
      return (t) => (op === "=") === (taskDate(t, field) == null);
    }
    if (!["=", "!=", ">", ">=", "<", "<="].includes(op)) throw new QueryError(`${field} compares dates with =, <, >, <= or >=`);
    const ms = dateValue(c.values[0], ctx);
    const dayStart = Math.floor((ms - nepalDayStart("1970-01-01")) / DAY_MS) * DAY_MS + nepalDayStart("1970-01-01");
    return (t) => {
      const d = taskDate(t, field);
      if (d == null) return op === "!=";
      if (op === "=") return d >= dayStart && d < dayStart + DAY_MS;
      if (op === "!=") return !(d >= dayStart && d < dayStart + DAY_MS);
      if (op === ">") return d > ms;
      if (op === ">=") return d >= ms;
      if (op === "<") return d < ms;
      return d <= ms;
    };
  }

  if (op === "isempty" || op === "isnotempty") {
    return (t) => {
      const v = fieldValue(t, field, ctx);
      const empty = v == null || (Array.isArray(v) && v.length === 0);
      return op === "isempty" ? empty : !empty;
    };
  }

  if (op === "~" || op === "!~") throw new QueryError(`~ works on text, summary and description; use = for ${field}`);

  // Ordering comparisons: priority by rank, points by number.
  if ([">", ">=", "<", "<="].includes(op)) {
    if (field !== "priority" && field !== "points") throw new QueryError(`${field} can't be compared with ${op}`);
    const target = field === "priority" ? PRIORITY_RANK[lower(c.values[0].v)] : Number(c.values[0].v);
    if (!Number.isFinite(target)) throw new QueryError(`"${c.values[0].v}" isn't a ${field === "priority" ? "priority" : "number"}`);
    return (t) => {
      const raw = fieldValue(t, field, ctx);
      const v = field === "priority" ? PRIORITY_RANK[raw] : raw;
      if (v == null) return false;
      return op === ">" ? v > target : op === ">=" ? v >= target : op === "<" ? v < target : v <= target;
    };
  }

  const wanted = c.values.flatMap((v) => resolveValues(field, v, ctx));
  const set = new Set(wanted);
  const positive = op === "=" || op === "in";
  return (t) => {
    const v = fieldValue(t, field, ctx);
    const hit = Array.isArray(v) ? (set.has(null) && v.length === 0) || v.some((x) => set.has(x)) : set.has(v ?? null);
    return positive ? hit : !hit;
  };
}

function compileNode(node, ctx) {
  if (!node) return () => true;
  if (node.kind === "and") {
    const a = compileNode(node.a, ctx);
    const b = compileNode(node.b, ctx);
    return (t) => a(t) && b(t);
  }
  if (node.kind === "or") {
    const a = compileNode(node.a, ctx);
    const b = compileNode(node.b, ctx);
    return (t) => a(t) || b(t);
  }
  if (node.kind === "not") {
    const e = compileNode(node.e, ctx);
    return (t) => !e(t);
  }
  return compileClause(node, ctx);
}

// ctx: { me, employees, sprints, versions, workflow, tasks, tasksById, keyOf, nowMs, todayStr }
export function compileQuery(text, ctx = {}) {
  const source = String(text || "").trim();
  if (!source) return { ok: true, empty: true, predicate: () => true, order: [] };
  try {
    const { ast, order } = parse(tokenize(source));
    return { ok: true, empty: false, predicate: compileNode(ast, { nowMs: Date.now(), ...ctx }), order };
  } catch (err) {
    if (err instanceof QueryError) return { ok: false, error: err.message };
    throw err;
  }
}

// ── Sorting ─────────────────────────────────────────────────────────────────

function sortValue(task, field, ctx) {
  switch (field) {
    case "created": return Date.parse(task.created_at || "") || 0;
    case "updated": return Date.parse(task.updated_at || task.created_at || "") || 0;
    case "resolved": return Date.parse(task.completed_at || "") || 0;
    case "due": return task.due_date ? String(task.due_date) : "9999-12-31";
    case "priority": return PRIORITY_RANK[task.priority] || 0;
    case "rank": return task.sort_order ?? 0;
    case "key": return task.number ?? 0;
    case "points": return task.estimate == null ? -1 : Number(task.estimate);
    case "status": return (ctx.workflow || []).findIndex((s) => s.value === task.status);
    case "assignee": return lower(ctx.employeesById?.get(task.assignee_id)?.name || "~");
    default: return 0;
  }
}

// order: [{ field, dir }]; with none, Jira's default for a search: newest first.
export function sortIssues(tasks, order, ctx = {}) {
  const keys = order?.length ? order : [{ field: "created", dir: "desc" }];
  return [...tasks].sort((a, b) => {
    for (const { field, dir } of keys) {
      const x = sortValue(a, field, ctx);
      const y = sortValue(b, field, ctx);
      if (x < y) return dir === "desc" ? 1 : -1;
      if (x > y) return dir === "desc" ? -1 : 1;
    }
    return (a.id ?? 0) - (b.id ?? 0);
  });
}

// Ready-made searches, as Jira offers on the Issues page.
export const BUILT_IN_FILTERS = [
  { id: "mine", name: "My open issues", query: "assignee = currentUser() AND statusCategory != Done ORDER BY priority DESC, updated DESC" },
  { id: "reported", name: "Reported by me", query: "reporter = currentUser() ORDER BY created DESC" },
  { id: "recent", name: "Updated in the last week", query: "updated >= -7d ORDER BY updated DESC" },
  { id: "overdue", name: "Overdue", query: "due < startOfDay() AND statusCategory != Done ORDER BY due ASC" },
  { id: "flagged", name: "Flagged", query: "flagged = true ORDER BY priority DESC" },
  { id: "unassigned", name: "Unassigned and open", query: "assignee IS EMPTY AND statusCategory != Done ORDER BY priority DESC" },
  { id: "done-week", name: "Done this week", query: "statusCategory = Done AND resolved >= -7d ORDER BY resolved DESC" },
];
