"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";
import { orderAtBottom, orderBetween, parseLabels, sortByRank } from "@/lib/taskBoard";

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
  for (const key of ["type", "status", "priority", "assignee_id", "reporter_id", "parent_id", "sprint_id", "project_id", "epic_color", "sort_order"]) {
    if (key in fields) out[key] = fields[key] ?? null;
  }
  return out;
}

export function useTasks(projectId) {
  const { user, currentEmployee } = useApp();
  const [tasks, setTasks] = useState([]);
  const [unfiled, setUnfiled] = useState([]);
  const [sprints, setSprints] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  // Once one load has succeeded, a failed poll is a passing blip rather than a reason to
  // replace the page (and any dialog open on it) with an error screen.
  const [hasLoaded, setHasLoaded] = useState(false);
  // A read that started before a local write must not overwrite it when it lands.
  const writeSeq = useRef(0);

  const load = useCallback(() => {
    if (projectId == null) return Promise.resolve();
    const seqAtStart = writeSeq.current;
    return Promise.all([
      supabase.from("tasks").select("*").eq("project_id", projectId).order("sort_order", { ascending: true }),
      supabase.from("task_sprints").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
      // Tasks from the first board, made before an issue needed a project.
      supabase.from("tasks").select("*").is("project_id", null).order("created_at", { ascending: true }),
    ]).then(([taskRes, sprintRes, unfiledRes]) => {
      if (seqAtStart !== writeSeq.current) return;
      const error = taskRes.error || sprintRes.error;
      if (error) {
        setLoadError(error);
      } else {
        setLoadError(null);
        setHasLoaded(true);
        setTasks(taskRes.data || []);
        setSprints(sprintRes.data || []);
      }
      if (!unfiledRes.error) setUnfiled(unfiledRes.data || []);
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
      project_id: projectId,
      sort_order: orderAtBottom(sameList),
      reporter_id: fields.reporter_id ?? currentEmployee?.id ?? null,
      created_by: user?.email || null,
    };
    const { data, error } = await supabase.from("tasks").insert([payload]).select();
    if (error) return { error };
    return afterWrite({ data: data[0], error: null });
  };

  // Optimistic for the fields the person can see change at once; the re-read then
  // brings in whatever the triggers set.
  const updateIssue = async (id, fields) => {
    writeSeq.current++;
    const payload = issuePayload(fields);
    const patchLocal = (list) => list.map((t) => (t.id === id ? { ...t, ...payload } : t));
    setTasks(patchLocal);
    setUnfiled(patchLocal);
    const { error } = await supabase.from("tasks").update(payload).eq("id", id);
    return afterWrite({ error });
  };

  // A rank change plus, optionally, a new status or sprint — one drag on the board or
  // in the backlog.
  const moveIssue = (id, fields) => updateIssue(id, fields);

  const deleteIssue = async (id) => {
    writeSeq.current++;
    const { error } = await supabase.from("tasks").delete().eq("id", id);
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
    isLoading,
    loadError,
    hasLoaded,
    reload: load,
    createIssue,
    updateIssue,
    moveIssue,
    deleteIssue,
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

  const load = useCallback(() => {
    if (taskId == null) return Promise.resolve();
    return Promise.all([
      supabase.from("task_comments").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
      supabase.from("task_activity").select("*").eq("task_id", taskId).order("created_at", { ascending: true }),
      supabase.from("task_links").select("*").or(`source_id.eq.${taskId},target_id.eq.${taskId}`),
    ]).then(([commentRes, activityRes, linkRes]) => {
      if (!commentRes.error) setComments(commentRes.data || []);
      if (!activityRes.error) setActivity(activityRes.data || []);
      if (!linkRes.error) setLinks(linkRes.data || []);
    });
  }, [taskId]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  const addComment = async (body) => {
    const payload = {
      task_id: taskId,
      body: body.trim(),
      author_email: user?.email || null,
      author_name: currentEmployee?.name || user?.user_metadata?.full_name || null,
    };
    const { error } = await supabase.from("task_comments").insert([payload]);
    if (!error) await load();
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

  return { comments, activity, links, reload: load, addComment, deleteComment, addLink, deleteLink };
}
