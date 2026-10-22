"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";

// Shout-outs for one meeting day, in the main Supabase project (meeting_shoutouts). Both
// the Start Meeting board (MeetingShoutouts.js) and the Daily standup page read and write
// through this hook, so the two never disagree. Row Level Security enforces who may post,
// edit and delete (scripts/meeting-shoutouts-schema.sql); the flags here only decide
// which buttons to show.

export const SHOUTOUT_MAX = 280;

// Colleagues post from their own laptops while the meeting screen is shared, so the list
// polls like the other live features (retro, planning poker) instead of loading once.
const DEFAULT_POLL_MS = 3000;

// A day's board is a handful of posts; the cap only bounds a runaway day.
const DAY_LIMIT = 200;
const COLUMNS = "id, shoutout_date, content, author, author_employee_id, tagged_employee_ids, created_at";

// "09:20 AM" when a shoutout was posted, in office time like the standup submissions.
const POSTED_AT_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kathmandu",
  hour: "2-digit",
  minute: "2-digit",
});

export function postedAt(createdAt) {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  return Number.isNaN(d.getTime()) ? "" : POSTED_AT_FORMAT.format(d);
}

const toIds = (tags) => (Array.isArray(tags) ? tags.map(Number).filter(Number.isInteger) : []);

// → { shoutouts, isLoading, loadError, error, setError, saving, post, saveEdit, remove, isMine,
//     canDelete, taggable, nameById }. post/saveEdit/remove resolve to true on success.
export function useShoutouts(date, { pollMs = DEFAULT_POLL_MS } = {}) {
  const { employees, currentEmployee, isAdmin } = useApp();
  // Rows are kept with the day they were loaded for, so switching days never shows (or
  // lets you edit) the previous day's posts while the new ones load.
  const [loaded, setLoaded] = useState({ date: null, rows: [] });
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const nameById = useMemo(() => new Map((employees || []).map((e) => [e.id, e.name])), [employees]);
  const taggable = useMemo(
    () => (employees || []).filter((e) => e.status !== "resigned").sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  );

  // Resolves to what the list should show; state is set in the .then, so the polling
  // effect below only subscribes and never sets state synchronously.
  const loadShoutouts = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("meeting_shoutouts")
      .select(COLUMNS)
      .eq("shoutout_date", date)
      .order("created_at", { ascending: true })
      .limit(DAY_LIMIT);
    if (!err) return { rows: data || [], message: "" };
    return {
      rows: null,
      message: /meeting_shoutouts/.test(err.message)
        ? "Shoutouts need scripts/meeting-shoutouts-schema.sql applied."
        : "Couldn't load shoutouts.",
    };
  }, [date]);

  const refresh = useCallback(
    () => loadShoutouts().then(({ rows, message }) => {
      setLoadError(message);
      if (rows) setLoaded({ date, rows });
    }),
    [loadShoutouts, date]
  );

  useEffect(() => {
    if (!date) return;
    let live = true;
    const tick = () => loadShoutouts().then(({ rows, message }) => {
      if (!live) return;
      setLoadError(message);
      if (rows) setLoaded({ date, rows });
    });
    tick();
    const id = setInterval(tick, pollMs);
    return () => { live = false; clearInterval(id); };
  }, [date, loadShoutouts, pollMs]);

  const isMine = useCallback(
    (s) => Boolean(currentEmployee && s.author_employee_id === currentEmployee.id),
    [currentEmployee]
  );
  const canDelete = useCallback((s) => isMine(s) || Boolean(isAdmin), [isMine, isAdmin]);

  const post = async ({ content, tags }) => {
    const text = String(content || "").trim().slice(0, SHOUTOUT_MAX);
    if (!text || saving || !currentEmployee || !date) return false;
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("meeting_shoutouts").insert({
      shoutout_date: date,
      content: text,
      author: currentEmployee.name,
      author_employee_id: currentEmployee.id,
      tagged_employee_ids: toIds(tags),
    });
    setSaving(false);
    if (err) { setError("Couldn't post your shoutout. Try again."); return false; }
    refresh();
    return true;
  };

  const saveEdit = async (id, { content, tags }) => {
    const text = String(content || "").trim().slice(0, SHOUTOUT_MAX);
    if (!text || saving) return false;
    setSaving(true);
    setError("");
    // .select() so a write RLS quietly refused (0 rows) shows up as an error, not a no-op.
    const { data, error: err } = await supabase
      .from("meeting_shoutouts")
      .update({ content: text, tagged_employee_ids: toIds(tags) })
      .eq("id", id)
      .select("id");
    setSaving(false);
    if (err || !data?.length) { setError("Couldn't save your changes."); return false; }
    refresh();
    return true;
  };

  const remove = async (id) => {
    setError("");
    const { data, error: err } = await supabase.from("meeting_shoutouts").delete().eq("id", id).select("id");
    if (err || !data?.length) { setError("Couldn't delete that shoutout."); return false; }
    setLoaded((prev) => ({ ...prev, rows: prev.rows.filter((x) => x.id !== id) }));
    return true;
  };

  const isLoading = loaded.date !== date && !loadError;
  const shoutouts = loaded.date === date ? loaded.rows : [];

  return { shoutouts, isLoading, loadError, error, setError, saving, post, saveEdit, remove, isMine, canDelete, taggable, nameById };
}
