"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";
import { orderAtBottom, orderBetween, parseLabels, sortByRank } from "@/lib/taskBoard";
import { cloneFields } from "@/lib/taskExtras";
import { DEFAULT_WORKFLOW, canTransition, categoryOf, firstStatusOf, isDone, statusKeyFor, withCategories, workflowFrom } from "@/lib/taskWorkflow";

const ATTACHMENT_BUCKET = "task-attachments";
export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

// Assignment and @mention emails go out from /api/task-notifications, which drains what
// the database triggers just recorded. Fire-and-forget: the write already happened, and
// a slow mail host must not hold up the board.
// Where an issue went when it moved project: the old key's number in its old project →
// { project_id, number } of the issue now, or null when nothing moved from there.
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
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) return;
      await fetch("/api/task-notifications", { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    } catch {}
  })();
}

const minutesOrNull = (value) => (value === "" || value == null ? null : Math.max(Math.round(Number(value)) || 0, 0));

// Issues are only fetched while the Tasks tab is open, one project at a time, not in
// AppContext's startup load: they are the tables here that grow without bound, and
// nothing else needs them. Polling keeps two people's boards in step the same way poker
// and retro do, just slower, since a card moving a few seconds late costs nothing.
const POLL_MS = 15000;

// Numbering, completed_at, sub-task sprints and history are all set by database
// triggers (supabase/migrations/20261019125521_jira_issues.sql), so a write is followed
// by a re-read rather than patched in locally.
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

export function useTasks(projectId) {
  const { user, currentEmployee } = useApp();
  const [tasks, setTasks] = useState([]);
  const [unfiled, setUnfiled] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [versions, setVersions] = useState([]);
  const [statusRows, setStatusRows] = useState([]);
  const [filters, setFilters] = useState([]);
  // The workflow the issues were last tagged with, for optimistic status changes.
  const workflowRef = useRef(DEFAULT_WORKFLOW);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // Once one load has succeeded, a failed poll is a passing blip rather than a reason to
  // replace the page (and any dialog open on it) with an error screen.
  const [hasLoaded, setHasLoaded] = useState(false);
  // A read that started before a local write must not overwrite it when it lands.
  const [workflowReady, setWorkflowReady] = useState(true);
  const writeSeq = useRef(0);

  const load = useCallback(() => {
    if (projectId == null) return Promise.resolve();
    const seqAtStart = writeSeq.current;
    return Promise.all([
      supabase.from("tasks").select("*").eq("project_id", projectId).order("sort_order", { ascending: true }),
      supabase.from("task_sprints").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
      // Tasks from the first board, made before an issue needed a project.
      supabase.from("tasks").select("*").is("project_id", null).order("created_at", { ascending: true }),
      supabase.from("task_versions").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
      supabase.from("task_statuses").select("*").eq("project_id", projectId).order("sort_order", { ascending: true }),
      supabase.from("task_filters").select("*").eq("project_id", projectId).order("name", { ascending: true }),
    ]).then(([taskRes, sprintRes, unfiledRes, versionRes, statusRes, filterRes]) => {
      if (seqAtStart !== writeSeq.current) return;
      // Workflows arrived with a later migration; without the table the default applies.
      // A status read that fails mid-session keeps the workflow already loaded.
      const workflow = statusRes.error
        ? (/42P01|PGRST205/.test(`${statusRes.error.code || ""}`) ? DEFAULT_WORKFLOW : workflowRef.current)
        : workflowFrom(statusRes.data);
      workflowRef.current = workflow;
      if (!statusRes.error) setStatusRows(statusRes.data || []);
      if (!statusRes.error) setWorkflowReady(true);
      else if (/42P01|PGRST205/.test(`${statusRes.error.code || ""}`)) setWorkflowReady(false);
      if (!filterRes.error) setFilters(filterRes.data || []);
      const error = taskRes.error || sprintRes.error;
      if (error) {
        setLoadError(error);
      } else {
        setLoadError(null);
        setHasLoaded(true);
        setTasks(withCategories(taskRes.data || [], workflow));
        setSprints(sprintRes.data || []);
      }
      if (!unfiledRes.error) setUnfiled(withCategories(unfiledRes.data || [], DEFAULT_WORKFLOW));
      // Releases arrived with the second migration; a database without it still loads.
      if (!versionRes.error) setVersions(versionRes.data || []);
      setIsLoading(false);
    });
  }, [projectId]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

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
      // The project's first to-do status, whatever its workflow calls it.
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

  // Optimistic for the fields the person can see change at once; the re-read then
  // brings in whatever the triggers set.
  const updateIssue = async (id, fields) => {
    writeSeq.current++;
    const payload = issuePayload(fields);
    const category = payload.status ? { status_category: categoryOf(payload.status, workflowRef.current) } : {};
    const patchLocal = (list) => list.map((t) => (t.id === id ? { ...t, ...payload, ...category } : t));
    setTasks(patchLocal);
    setUnfiled(patchLocal);
    const { error } = await supabase.from("tasks").update(payload).eq("id", id);
    if (!error && payload.assignee_id) sendTaskEmails();
    return afterWrite({ error });
  };

  // One change to many issues at once (backlog bulk edit). Triggers still run per row,
  // so numbering rules, history and notifications behave as for single edits.
  const bulkUpdate = async (ids, fields) => {
    if (!ids.length) return { error: null };
    writeSeq.current++;
    const payload = issuePayload(fields);
    // A status change skips the issues whose workflow doesn't allow that move.
    const skipped = payload.status
      ? ids.filter((id) => {
          const t = tasks.find((x) => x.id === id);
          return t && !canTransition(t.status, payload.status, workflowRef.current);
        })
      : [];
    if (skipped.length) ids = ids.filter((id) => !skipped.includes(id));
    if (!ids.length) return { error: null, skipped: skipped.length };
    const chosen = new Set(ids);
    const category = payload.status ? { status_category: categoryOf(payload.status, workflowRef.current) } : {};
    setTasks((list) => list.map((t) => (chosen.has(t.id) ? { ...t, ...payload, ...category } : t)));
    const { error } = await supabase.from("tasks").update(payload).in("id", ids);
    if (!error && payload.assignee_id) sendTaskEmails();
    return { ...(await afterWrite({ error })), skipped: skipped.length };
  };

  const bulkDelete = async (ids) => {
    if (!ids.length) return { error: null };
    writeSeq.current++;
    const paths = await attachmentPathsFor(ids);
    const { error } = await supabase.from("tasks").delete().in("id", ids);
    if (!error) await removeFiles(paths);
    return afterWrite({ error });
  };

  const cloneIssue = (task) => createIssue(cloneFields(task, sprints));

  // A link made from outside the issue view, e.g. the Create dialog's "Linked issue".
  // `row` is taskBoard's linkRow().
  const linkIssues = async (row) => {
    const { error } = await supabase.from("task_links").insert([{ ...row, created_by: user?.email || null }]);
    return { error };
  };

  // Jira's Move: to another project, with its sub-tasks (move_task_to_project in
  // supabase/migrations/20261027104202_move_task_project.sql). Returns the new key.
  const moveToProject = async (id, targetProjectId) => {
    writeSeq.current++;
    const { data, error } = await supabase.rpc("move_task_to_project", { p_task_id: id, p_project_id: targetProjectId });
    return afterWrite({ data, error });
  };

  // ── Releases ──
  const createVersion = async (fields) => {
    writeSeq.current++;
    const last = sortByRank(versions)[versions.length - 1];
    const payload = {
      project_id: projectId,
      name: fields.name.trim(),
      description: (fields.description || "").trim() || null,
      start_date: fields.start_date || null,
      release_date: fields.release_date || null,
      sort_order: orderBetween(last?.sort_order, undefined),
      created_by: user?.email || null,
    };
    const { data, error } = await supabase.from("task_versions").insert([payload]).select();
    if (error) return { error };
    return afterWrite({ data: data[0], error: null });
  };

  const updateVersion = async (id, fields) => {
    writeSeq.current++;
    const payload = {};
    if ("name" in fields) payload.name = fields.name.trim();
    if ("description" in fields) payload.description = (fields.description || "").trim() || null;
    if ("start_date" in fields) payload.start_date = fields.start_date || null;
    if ("release_date" in fields) payload.release_date = fields.release_date || null;
    // released_at records when it shipped: set on release, cleared on unrelease, and
    // kept through archiving so an archived release still says when it went out.
    if ("status" in fields) {
      const current = versions.find((v) => v.id === id);
      payload.status = fields.status;
      if (fields.status === "released") payload.released_at = current?.released_at || new Date().toISOString();
      if (fields.status === "unreleased") payload.released_at = null;
    }
    const { error } = await supabase.from("task_versions").update(payload).eq("id", id);
    return afterWrite({ error });
  };

  // Jira's "Release": open issues move to another release (or none) first, then the
  // release is marked released.
  const releaseVersion = async (id, moveOpenTo) => {
    writeSeq.current++;
    // The same issues the Release dialog counts: open ones, epics aside.
    const open = tasks.filter((t) => t.fix_version_id === id && !isDone(t) && t.type !== "epic").map((t) => t.id);
    if (open.length) {
      const { error } = await supabase.from("tasks").update({ fix_version_id: moveOpenTo ?? null }).in("id", open);
      if (error) return { error };
    }
    return updateVersion(id, { status: "released" });
  };

  const deleteVersion = async (id) => {
    writeSeq.current++;
    const { error } = await supabase.from("task_versions").delete().eq("id", id);
    return afterWrite({ error });
  };

  // ── Workflow ──
  // edited: the statuses in board order, [{ id?, value?, label, category }] (no id = new).
  // moves: { removedKey: keyTheirIssuesGoTo }. Order matters for the database's guards:
  // new statuses exist before issues move to them, and issues leave a status before it
  // is removed.
  // The whole workflow in one database call (save_task_workflow), so a save either
  // lands completely or changes nothing.
  const saveWorkflow = async (edited, moves = {}) => {
    writeSeq.current++;
    const taken = statusRows.map((r) => r.key);
    const statuses = edited.map((s) => {
      let key = s.value;
      if (!s.id && (!key || taken.includes(key))) key = statusKeyFor(s.label, taken);
      if (!s.id) taken.push(key);
      return { id: s.id ?? null, key, name: s.label.trim(), category: s.category, allowed_next: s.next ?? null };
    });
    const { error } = await supabase.rpc("save_task_workflow", { p_project_id: projectId, p_statuses: statuses, p_moves: moves });
    return afterWrite({ error });
  };

  // ── Saved filters ──
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

  const updateFilter = async (id, fields) => {
    writeSeq.current++;
    const payload = { updated_at: new Date().toISOString() };
    if ("name" in fields) payload.name = fields.name.trim();
    if ("query" in fields) payload.query = fields.query;
    if ("shared" in fields) payload.shared = Boolean(fields.shared);
    const { error } = await supabase.from("task_filters").update(payload).eq("id", id);
    if (!error) await load();
    return { error };
  };

  const deleteFilter = async (id) => {
    writeSeq.current++;
    const { error } = await supabase.from("task_filters").delete().eq("id", id);
    if (!error) await load();
    return { error };
  };

  // A rank change plus, optionally, a new status or sprint — one drag on the board or
  // in the backlog.
  const moveIssue = (id, fields) => updateIssue(id, fields);

  // Attachment rows go with their issue (and its sub-tasks) by cascade, but the files
  // live in storage, which a cascade can't reach: look them up first, remove them after.
  const attachmentPathsFor = async (ids) => {
    const withSubtasks = [...new Set([...ids, ...tasks.filter((t) => ids.includes(t.parent_id) && t.type === "subtask").map((t) => t.id)])];
    const { data } = await supabase.from("task_attachments").select("path").in("task_id", withSubtasks);
    return (data || []).map((a) => a.path);
  };

  const removeFiles = async (paths) => {
    if (!paths.length) return;
    const { data, error } = await supabase.storage.from(ATTACHMENT_BUCKET).remove(paths);
    if (error || (data || []).length < paths.length) console.warn("Some attachment files could not be removed from storage.");
  };

  const deleteIssue = async (id) => {
    writeSeq.current++;
    const paths = await attachmentPathsFor([id]);
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (!error) await removeFiles(paths);
    return afterWrite({ error });
  };

  const createSprint = async (fields) => {
    writeSeq.current++;
    const last = sortByRank(sprints)[sprints.length - 1];
    const payload = {
      project_id: projectId,
      name: fields.name.trim(),
      goal: (fields.goal || "").trim() || null,
      start_date: fields.start_date || null,
      end_date: fields.end_date || null,
      sort_order: orderBetween(last?.sort_order, undefined),
      created_by: user?.email || null,
    };
    const { data, error } = await supabase.from("task_sprints").insert([payload]).select();
    if (error) return { error };
    return afterWrite({ data: data[0], error: null });
  };

  const updateSprint = async (id, fields) => {
    writeSeq.current++;
    const payload = {};
    if ("name" in fields) payload.name = fields.name.trim();
    if ("goal" in fields) payload.goal = (fields.goal || "").trim() || null;
    if ("start_date" in fields) payload.start_date = fields.start_date || null;
    if ("end_date" in fields) payload.end_date = fields.end_date || null;
    const { error } = await supabase.from("task_sprints").update(payload).eq("id", id);
    return afterWrite({ error });
  };

  const deleteSprint = async (id) => {
    writeSeq.current++;
    const { error } = await supabase.from("task_sprints").delete().eq("id", id);
    return afterWrite({ error });
  };

  const startSprint = async (id, { start_date, end_date }) => {
    writeSeq.current++;
    const { error } = await supabase.rpc("start_task_sprint", { p_sprint_id: id, p_start: start_date, p_end: end_date });
    return afterWrite({ error });
  };

  const completeSprint = async (id, moveToSprintId) => {
    writeSeq.current++;
    const { error } = await supabase.rpc("complete_task_sprint", { p_sprint_id: id, p_move_to: moveToSprintId ?? null });
    return afterWrite({ error });
  };

  return {
    tasks,
    unfiled,
    sprints,
    versions,
    workflow,
    statusRows,
    savedFilters: filters,
    isLoading,
    loadError,
    hasLoaded,
    reload: load,
    createIssue,
    updateIssue,
    moveIssue,
    deleteIssue,
    bulkUpdate,
    bulkDelete,
    saveWorkflow,
    workflowReady,
    createFilter,
    updateFilter,
    deleteFilter,
    cloneIssue,
    moveToProject,
    linkIssues,
    createVersion,
    updateVersion,
    releaseVersion,
    deleteVersion,
    createSprint,
    updateSprint,
    deleteSprint,
    startSprint,
    completeSprint,
  };
}

// The parts of an issue only its detail view needs: comments, history and links. Loaded
// when the issue is opened and kept fresh while it stays open.
export function useIssueDetail(taskId) {
  const { user, currentEmployee } = useApp();
  const [comments, setComments] = useState([]);
  const [activity, setActivity] = useState([]);
  const [links, setLinks] = useState([]);
  const [worklogs, setWorklogs] = useState([]);
  const [watchers, setWatchers] = useState([]);
  const [attachments, setAttachments] = useState([]);

  const load = useCallback(() => {
    if (taskId == null) return Promise.resolve();
    return Promise.all([
      supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
      supabase.from("task_activity").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
      supabase.from("task_links").select("*").or(`source_id.eq.${taskId},target_id.eq.${taskId}`),
      supabase.from("task_worklogs").select("*").eq("task_id", taskId).order("work_date", { ascending: false }),
      supabase.from("task_watchers").select("*").eq("task_id", taskId),
      supabase.from("task_attachments").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
    ]).then(([commentRes, activityRes, linkRes, worklogRes, watcherRes, attachmentRes]) => {
      if (!commentRes.error) setComments(commentRes.data || []);
      if (!activityRes.error) setActivity(activityRes.data || []);
      if (!linkRes.error) setLinks(linkRes.data || []);
      if (!worklogRes.error) setWorklogs(worklogRes.data || []);
      if (!watcherRes.error) setWatchers(watcherRes.data || []);
      if (!attachmentRes.error) setAttachments(attachmentRes.data || []);
    });
  }, [taskId]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  // mentions: employee ids picked from the @ menu; the database notifies them.
  const addComment = async (body, mentions = []) => {
    const payload = {
      task_id: taskId,
      body: body.trim(),
      author_email: user?.email || null,
      author_name: currentEmployee?.name || user?.user_metadata?.full_name || null,
      ...(mentions.length ? { mentions } : {}),
    };
    const { error } = await supabase.from("task_comments").insert([payload]);
    if (!error) {
      if (mentions.length) sendTaskEmails();
      await load();
    }
    return { error };
  };

  const deleteComment = async (id) => {
    const { error } = await supabase.from("task_comments").delete().eq("id", id);
    if (!error) await load();
    return { error };
  };

  // Inward phrasings ("is blocked by") are stored from the other issue's side, so the
  // caller passes both ends rather than always making this issue the source.
  const addLink = async (sourceId, targetId, linkType) => {
    const { error } = await supabase
      .from("task_links")
      .insert([{ source_id: sourceId, target_id: targetId, link_type: linkType, created_by: user?.email || null }]);
    if (!error) await load();
    return { error };
  };

  const deleteLink = async (id) => {
    const { error } = await supabase.from("task_links").delete().eq("id", id);
    if (!error) await load();
    return { error };
  };

  // ── Work log ──
  // The trigger adds it to the issue's time spent and takes it off the remaining
  // estimate; onChange lets the board re-read the issue.
  const addWorklog = async ({ minutes, work_date, note }) => {
    const { error } = await supabase.from("task_worklogs").insert([
      { task_id: taskId, minutes, work_date: work_date || undefined, note: (note || "").trim() || null, author_email: user?.email || null },
    ]);
    if (!error) await load();
    return { error };
  };

  const deleteWorklog = async (id) => {
    const { error } = await supabase.from("task_worklogs").delete().eq("id", id);
    if (!error) await load();
    return { error };
  };

  // ── Watchers ──
  const watch = async () => {
    if (!currentEmployee) return { error: new Error("Only employees can watch issues") };
    const { error } = await supabase.from("task_watchers").insert([{ task_id: taskId, employee_id: currentEmployee.id }]);
    if (!error || /duplicate/i.test(error.message || "")) await load();
    return { error: error && !/duplicate/i.test(error.message || "") ? error : null };
  };

  const unwatch = async () => {
    if (!currentEmployee) return { error: null };
    const { error } = await supabase.from("task_watchers").delete().eq("task_id", taskId).eq("employee_id", currentEmployee.id);
    if (!error) await load();
    return { error };
  };

  // ── Attachments ──
  // Files go to the private bucket under the issue's id; the row lists them on the issue.
  const uploadAttachment = async (file) => {
    if (file.size > ATTACHMENT_MAX_BYTES) return { error: new Error("Files can be up to 10 MB") };
    const safeName = file.name.replace(/[^\w.\-]+/g, "_").slice(-120) || "file";
    const path = `${taskId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
    const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(path, file, {
      contentType: file.type || undefined,
      upsert: false,
    });
    if (uploadError) return { error: uploadError };
    const { error } = await supabase.from("task_attachments").insert([
      { task_id: taskId, path, name: file.name, size_bytes: file.size, mime_type: file.type || null, uploaded_by: user?.email || null },
    ]);
    if (error) {
      await supabase.storage.from(ATTACHMENT_BUCKET).remove([path]);
      return { error };
    }
    await load();
    return { error: null };
  };

  const deleteAttachment = async (attachment) => {
    const { error } = await supabase.from("task_attachments").delete().eq("id", attachment.id);
    if (error) return { error };
    // A policy that refuses the delete reports no error, just nothing removed.
    const { data, error: storageError } = await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.path]);
    if (storageError || !(data || []).length) console.warn(`The file for ${attachment.name} stayed in storage.`);
    await load();
    return { error: null };
  };

  // A link that works for a few minutes; the bucket itself is private.
  const attachmentUrl = async (attachment, { download = false } = {}) => {
    const { data, error } = await supabase.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(attachment.path, 300, download ? { download: attachment.name } : undefined);
    return { url: data?.signedUrl || null, error };
  };

  return {
    comments,
    activity,
    links,
    worklogs,
    watchers,
    attachments,
    reload: load,
    addComment,
    deleteComment,
    addLink,
    deleteLink,
    addWorklog,
    deleteWorklog,
    watch,
    unwatch,
    uploadAttachment,
    deleteAttachment,
    attachmentUrl,
  };
}

// Your task notifications for the top bar's bell: assignments, mentions, comments and
// status changes on issues you watch (written by database triggers).
const NOTIFY_POLL_MS = 60000;

export function useTaskNotifications(enabled = true) {
  const [items, setItems] = useState([]);

  const load = useCallback(() => {
    if (!enabled) return Promise.resolve();
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    return Promise.all([
      supabase.from("task_notifications").select("*, task:tasks(number, title, project_id)").gte("created_at", since).order("created_at", { ascending: false }).limit(20),
    ]).then(([res]) => {
      // No table yet (migration not applied) or no access: the bell shows fines only.
      if (!res.error) setItems(res.data || []);
    });
  }, [enabled]);

  // Polled in a background tab too (browsers slow it to about once a minute there anyway), so
  // a new notification can chime and raise a desktop notification while you're elsewhere.
  useEffect(() => {
    load();
    const timer = setInterval(load, NOTIFY_POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const markRead = async (ids) => {
    const unread = ids.filter((id) => items.some((n) => n.id === id && !n.read_at));
    if (!unread.length) return;
    const at = new Date().toISOString();
    setItems((prev) => prev.map((n) => (unread.includes(n.id) ? { ...n, read_at: at } : n)));
    await supabase.from("task_notifications").update({ read_at: at }).in("id", unread);
  };

  return { items, reload: load, markRead };
}
