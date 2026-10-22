// A project's workflow: its own statuses (the board's columns), each in one of Jira's
// three categories. Pure, no imports, so it runs under `npm test`. The database side is
// task_statuses in supabase/migrations/20261022140055_task_workflows_filters.sql.

export const CATEGORIES = [
  { value: "todo", label: "To Do" },
  { value: "progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

// Every project starts with these (and projects from before workflows keep them).
export const DEFAULT_WORKFLOW = [
  { value: "todo", label: "To Do", category: "todo" },
  { value: "in_progress", label: "In Progress", category: "progress" },
  { value: "review", label: "In Review", category: "progress" },
  { value: "done", label: "Done", category: "done" },
];

const BUILT_IN = new Set(DEFAULT_WORKFLOW.map((s) => s.value));
// Badge colours: the four built-in keys keep their own, a custom status wears its
// category's.
const CATEGORY_CLASS = { todo: "todo", progress: "in_progress", done: "done" };

// task_statuses rows -> the shape the app uses everywhere, in board order.
export function workflowFrom(rows) {
  if (!rows?.length) return DEFAULT_WORKFLOW;
  return [...rows]
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || (a.id ?? 0) - (b.id ?? 0))
    .map((r) => ({ value: r.key, label: r.name, category: r.category, id: r.id, next: r.allowed_next ?? null }));
}

// A key the workflow doesn't list (an old "done" after a workflow change) keeps its
// built-in meaning, as the database's task_status_is_done does.
export function statusMeta(key, workflow = DEFAULT_WORKFLOW) {
  const found = workflow.find((s) => s.value === key) || DEFAULT_WORKFLOW.find((s) => s.value === key);
  const meta = found || { value: key, label: key || "—", category: "todo" };
  return { ...meta, cls: BUILT_IN.has(meta.value) ? meta.value : CATEGORY_CLASS[meta.category] || "todo" };
}

export function categoryOf(key, workflow = DEFAULT_WORKFLOW) {
  return statusMeta(key, workflow).category;
}

export function firstStatusOf(workflow, category) {
  return (workflow.find((s) => s.category === category) || workflow[0] || DEFAULT_WORKFLOW[0]).value;
}

// Each issue carries its status's category, so every rule can ask "is it done?" without
// knowing this project's status names.
export function withCategories(tasks, workflow) {
  return tasks.map((t) => ({ ...t, status_category: categoryOf(t.status, workflow) }));
}

export const isDone = (task) => (task?.status_category ? task.status_category === "done" : task?.status === "done");
export const isInProgress = (task) =>
  task?.status_category ? task.status_category === "progress" : task?.status === "in_progress" || task?.status === "review";

// "Ready for QA" -> "ready_for_qa", made unique against the keys already used.
export function statusKeyFor(name, takenKeys = []) {
  let base = String(name || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 36);
  if (!base) base = "status";
  else if (!/^[a-z]/.test(base)) base = `s_${base}`;
  const taken = new Set(takenKeys);
  if (!taken.has(base)) return base;
  for (let n = 2; n < 1000; n++) if (!taken.has(`${base}_${n}`)) return `${base}_${n}`;
  return `${base}_${Date.now()}`;
}

// What a workflow edit must keep true before it goes to the database (which checks the
// same things): names, at least one to-do and one done status, and no limited status
// left with nowhere to go.
export function validateWorkflow(statuses) {
  if (!statuses.length) return "A workflow needs at least one status";
  const names = statuses.map((s) => String(s.label || "").trim());
  if (names.some((n) => !n)) return "Every status needs a name";
  if (names.some((n) => n.length > 40)) return "Status names can be up to 40 characters";
  const lower = names.map((n) => n.toLowerCase());
  if (new Set(lower).size !== lower.length) return "Two statuses have the same name";
  if (!statuses.some((s) => s.category === "todo")) return "Keep at least one status in To Do";
  if (!statuses.some((s) => s.category === "done")) return "Keep at least one status in Done";
  // A limited status must still lead somewhere that exists.
  const keys = new Set(statuses.map((s) => s.value));
  const stuck = statuses.find((s) => s.next && !s.next.some((k) => k !== s.value && keys.has(k)));
  if (stuck) return `Choose where issues in "${stuck.label}" can move to`;
  return null;
}

// Transitions: a status lists where its issues may go next (`next`), or null for
// anywhere. Staying put is always allowed. The database enforces the same rule.
export function canTransition(fromKey, toKey, workflow) {
  if (fromKey === toKey) return true;
  const from = workflow.find((s) => s.value === fromKey);
  if (!from || !from.next) return true;
  return from.next.includes(toKey);
}

export function nextStatuses(fromKey, workflow) {
  return workflow.filter((s) => canTransition(fromKey, s.value, workflow));
}
