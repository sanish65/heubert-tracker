import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { supabase, API_BASE_URL } from "./supabase";
import { useApp } from "../context/AppContext";
import { orderAtBottom, parseLabels } from "./taskBoard.js";
import { DEFAULT_WORKFLOW, categoryOf, firstStatusOf, withCategories, workflowFrom } from "./taskWorkflow.js";

// Supabase writes timestamps with six fraction digits, which Hermes may refuse to parse; the
// mirrored lib/task*.js modules read them with Date.parse (sorting, "updated >= -7d", cycle time).
// Cut every such value to milliseconds as the rows arrive, so the mirrors stay exact copies of the
// web's. The same rule as lib/dates.js parseTimestamp.
const LONG_FRACTION = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3})\d+/;
function trimStamps(rows) {
  return (rows || []).map((row) => {
    let out = row;
    for (const [key, value] of Object.entries(row)) {
      if (typeof value === "string" && LONG_FRACTION.test(value)) {
        if (out === row) out = { ...row };
        out[key] = value.replace(LONG_FRACTION, "$1");
      }
    }
    return out;
  });
}

// The Tasks screen's data, as the web's src/lib/useTasks.js: one project's issues, sprints,
// releases, workflow (task_statuses) and saved filters, loaded when the screen opens and
// polled while the app is in front. Same tables, columns, RPCs and policies as the web;
// numbering, completed_at, sub-task sprints and history are set by database triggers, so a
// write is followed by a re-read. Sprints, releases and the workflow are edited on the web.

const POLL_MS = 15000;

// Assignment and @mention emails go out from the web's /api/task-notifications, which drains
// what the database triggers recorded. Fire-and-forget, with the signed-in user's token.
// Where an issue went when it moved project, as the web's movedIssueOf: the old key's number
// in its old project → { project_id, number } of the issue now, or null.
export async function movedIssueOf(projectId, number) {
  const { data, error } = await supabase
    .from("task_key_aliases")
    .select("task:tasks(project_id, number)")
    .eq("project_id", projectId)
    .eq("number", number)
    .maybeSingle();
  return error ? null : data?.task || null;
}

export function sendTaskEmails() {
  (async () => {
    try {
      if (!API_BASE_URL) return;
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;
      await fetch(`${API_BASE_URL}/api/task-notifications`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } catch {}
  })();
}

const minutesOrNull = (value) => (value === "" || value == null ? null : Math.max(Math.round(Number(value)) || 0, 0));

// The web's issuePayload: only the fields given, cleaned the same way.
function issuePayload(fields) {
  const out = {};
  if ("title" in fields) out.title = String(fields.title || "").trim();
  if ("description" in fields) out.description = String(fields.description || "").trim() || null;
  if ("labels" in fields) out.labels = parseLabels(fields.labels);
  if ("external_url" in fields) out.external_url = String(fields.external_url || "").trim() || null;
  if ("estimate" in fields) out.estimate = fields.estimate === "" || fields.estimate == null ? null : Number(fields.estimate);
  if ("due_date" in fields) out.due_date = fields.due_date || null;
  if ("flagged" in fields) out.flagged = Boolean(fields.flagged);
  if ("original_estimate_min" in fields) out.original_estimate_min = minutesOrNull(fields.original_estimate_min);
  if ("remaining_estimate_min" in fields) out.remaining_estimate_min = minutesOrNull(fields.remaining_estimate_min);
  for (const key of ["type", "status", "priority", "assignee_id", "reporter_id", "parent_id", "sprint_id", "project_id", "epic_color", "sort_order", "fix_version_id"]) {
    if (key in fields) out[key] = fields[key] ?? null;
  }
  return out;
}

// Calls `fn` every POLL_MS while the app is in front, and once more when it comes back.
function usePolling(fn) {
  useEffect(() => {
    fn();
    const timer = setInterval(() => {
      if (AppState.currentState === "active") fn();
    }, POLL_MS);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") fn();
    });
    return () => {
      clearInterval(timer);
      sub.remove();
    };
  }, [fn]);
}

export function useTasks(projectId) {
  const { user, currentEmployee } = useApp();
  const [tasks, setTasks] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [versions, setVersions] = useState([]);
  const [statusRows, setStatusRows] = useState([]);
  const [filters, setFilters] = useState([]);
  const workflowRef = useRef(DEFAULT_WORKFLOW);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  // A read that started before a local write must not overwrite it when it lands.
  const writeSeq = useRef(0);

  const load = useCallback(() => {
    if (projectId == null) return Promise.resolve();
    const seqAtStart = writeSeq.current;
    return Promise.all([
      supabase.from("tasks").select("*").eq("project_id", projectId).order("sort_order", { ascending: true }),
      supabase.from("task_sprints").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
      supabase.from("task_versions").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
      supabase.from("task_statuses").select("*").eq("project_id", projectId).order("sort_order", { ascending: true }),
      supabase.from("task_filters").select("*").eq("project_id", projectId).order("name", { ascending: true }),
    ]).then(([taskRes, sprintRes, versionRes, statusRes, filterRes]) => {
      if (seqAtStart !== writeSeq.current) return;
      // No table yet: the default workflow. A failed read mid-session keeps the one loaded.
      const workflow = statusRes.error
        ? /42P01|PGRST205/.test(`${statusRes.error.code || ""}`)
          ? DEFAULT_WORKFLOW
          : workflowRef.current
        : workflowFrom(statusRes.data);
      workflowRef.current = workflow;
      if (!statusRes.error) setStatusRows(trimStamps(statusRes.data));
      if (!filterRes.error) setFilters(trimStamps(filterRes.data));
      const error = taskRes.error || sprintRes.error;
      if (error) {
        setLoadError(error);
      } else {
        setLoadError(null);
        setHasLoaded(true);
        setTasks(withCategories(trimStamps(taskRes.data), workflow));
        setSprints(trimStamps(sprintRes.data));
      }
      if (!versionRes.error) setVersions(trimStamps(versionRes.data));
      setIsLoading(false);
    });
  }, [projectId]);

  usePolling(load);

  const workflow = useMemo(() => workflowFrom(statusRows), [statusRows]);

  const afterWrite = async (result) => {
    writeSeq.current++;
    await load();
    return result;
  };

  // New issues go to the bottom of wherever they land (backlog or a sprint), as in Jira.
  const createIssue = async (fields) => {
    writeSeq.current++;
    const sameList = tasks.filter((t) => (t.sprint_id ?? null) === (fields.sprint_id ?? null));
    const payload = {
      ...issuePayload(fields),
      status: fields.status || firstStatusOf(workflowRef.current, "todo"),
      project_id: projectId,
      sort_order: orderAtBottom(sameList),
      reporter_id: fields.reporter_id ?? currentEmployee?.id ?? null,
      created_by: user?.email || null,
    };
    const { data, error } = await supabase.from("tasks").insert([payload]).select();
    if (error) return { error };
    if (payload.assignee_id) sendTaskEmails();
    return afterWrite({ data: data[0], error: null });
  };

  const updateIssue = async (id, fields) => {
    writeSeq.current++;
    const payload = issuePayload(fields);
    const category = payload.status ? { status_category: categoryOf(payload.status, workflowRef.current) } : {};
    setTasks((list) => list.map((t) => (t.id === id ? { ...t, ...payload, ...category } : t)));
    const { error } = await supabase.from("tasks").update(payload).eq("id", id);
    if (!error && payload.assignee_id) sendTaskEmails();
    return afterWrite({ error });
  };

  // A link made from outside the issue sheet, e.g. Create issue's "Linked issue" (taskBoard's linkRow()).
  const linkIssues = async (row) => {
    const { error } = await supabase.from("task_links").insert([{ ...row, created_by: user?.email || null }]);
    return { error };
  };

  // Jira's Move: to another project, with its sub-tasks (move_task_to_project). Returns the new key.
  const moveToProject = async (id, targetProjectId) => {
    writeSeq.current++;
    const { data, error } = await supabase.rpc("move_task_to_project", { p_task_id: id, p_project_id: targetProjectId });
    return afterWrite({ data, error });
  };

  // Attachments live in storage, which the row's cascade can't reach: remove them after.
  const deleteIssue = async (id) => {
    writeSeq.current++;
    const ids = [id, ...tasks.filter((t) => t.parent_id === id && t.type === "subtask").map((t) => t.id)];
    const { data: files } = await supabase.from("task_attachments").select("path").in("task_id", ids);
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    const paths = (files || []).map((a) => a.path);
    if (!error && paths.length) await supabase.storage.from("task-attachments").remove(paths);
    return afterWrite({ error });
  };

  const createFilter = async ({ name, query, shared }) => {
    if (!currentEmployee) return { error: new Error("Only employees can save filters") };
    writeSeq.current++;
    const { data, error } = await supabase
      .from("task_filters")
      .insert([{ project_id: projectId, owner_id: currentEmployee.id, name: name.trim(), query, shared: Boolean(shared) }])
      .select();
    if (error) return { error };
    await load();
    return { data: data[0], error: null };
  };

  const deleteFilter = async (id) => {
    writeSeq.current++;
    const { error } = await supabase.from("task_filters").delete().eq("id", id);
    if (!error) await load();
    return { error };
  };

  return {
    tasks,
    sprints,
    versions,
    workflow,
    savedFilters: filters,
    isLoading,
    loadError,
    hasLoaded,
    reload: load,
    createIssue,
    updateIssue,
    deleteIssue,
    moveToProject,
    linkIssues,
    createFilter,
    deleteFilter,
  };
}

// What only an open issue needs: its comments and work log, as the web's useIssueDetail.
export function useIssueDetail(taskId) {
  const { user, currentEmployee } = useApp();
  const [comments, setComments] = useState([]);
  const [worklogs, setWorklogs] = useState([]);

  const load = useCallback(() => {
    if (taskId == null) return Promise.resolve();
    return Promise.all([
      supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
      supabase.from("task_worklogs").select("*").eq("task_id", taskId).order("work_date", { ascending: false }),
    ]).then(([commentRes, worklogRes]) => {
      if (!commentRes.error) setComments(trimStamps(commentRes.data));
      if (!worklogRes.error) setWorklogs(trimStamps(worklogRes.data));
    });
  }, [taskId]);

  usePolling(load);

  const addComment = async (body) => {
    const { error } = await supabase.from("task_comments").insert([
      {
        task_id: taskId,
        body: body.trim(),
        author_email: user?.email || null,
        author_name: currentEmployee?.name || user?.user_metadata?.full_name || null,
      },
    ]);
    if (!error) await load();
    return { error };
  };

  const deleteComment = async (id) => {
    const { error } = await supabase.from("task_comments").delete().eq("id", id);
    if (!error) await load();
    return { error };
  };

  // The trigger adds it to the issue's time spent and takes it off the remaining estimate.
  const addWorklog = async ({ minutes, work_date, note }) => {
    const { error } = await supabase.from("task_worklogs").insert([
      { task_id: taskId, minutes, work_date: work_date || undefined, note: (note || "").trim() || null, author_email: user?.email || null },
    ]);
    if (!error) await load();
    return { error };
  };

  return { comments, worklogs, reload: load, addComment, deleteComment, addWorklog };
}
