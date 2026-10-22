import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";
import { useApp } from "../context/AppContext";
import { SHOUTOUT_MAX, toIds } from "./standupShoutouts";

// Shout-outs for one meeting day, in the main Supabase project (meeting_shoutouts), as the web's
// src/lib/useShoutouts.js: the same columns, the same writes, the same messages. Both the Daily
// standup screen and Meeting mode read and write through it. Row Level Security enforces who may
// post, edit and delete (scripts/meeting-shoutouts-schema.sql); the flags here only decide which
// buttons to show.

// Colleagues post from their own phones and laptops while the meeting runs, so the list polls.
const DEFAULT_POLL_MS = 3000;

// A day's board is a handful of posts; the cap only bounds a runaway day.
const DAY_LIMIT = 200;
const COLUMNS = "id, shoutout_date, content, author, author_employee_id, tagged_employee_ids, created_at";

// → { shoutouts, isLoading, loadError, error, setError, saving, post, saveEdit, remove, isMine,
//     canDelete, taggable, nameById }. post/saveEdit/remove resolve to true on success.
export function useShoutouts(date, { pollMs = DEFAULT_POLL_MS } = {}) {
  const { employees, currentEmployee, isAdmin } = useApp();
  // Rows are kept with the day they were loaded for, so switching days never shows (or lets you
  // edit) the previous day's posts while the new ones load.
  const [loaded, setLoaded] = useState({ date: null, rows: [] });
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const nameById = useMemo(() => new Map((employees || []).map((e) => [e.id, e.name])), [employees]);
  const taggable = useMemo(
    () => (employees || []).filter((e) => e.status !== "resigned").sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  );

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
      message: /meeting_shoutouts/.test(err.message) ? "Shout-outs aren't set up on the server yet." : "Couldn't load shout-outs.",
    };
  }, [date]);

  const refresh = useCallback(
    () =>
      loadShoutouts().then(({ rows, message }) => {
        setLoadError(message);
        if (rows) setLoaded({ date, rows });
      }),
    [loadShoutouts, date]
  );

  useEffect(() => {
    if (!date) return undefined;
    let live = true;
    const tick = () =>
      loadShoutouts().then(({ rows, message }) => {
        if (!live) return;
        setLoadError(message);
        if (rows) setLoaded({ date, rows });
      });
    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      live = false;
      clearInterval(id);
    };
  }, [date, loadShoutouts, pollMs]);

  const isMine = useCallback((s) => Boolean(currentEmployee && s.author_employee_id === currentEmployee.id), [currentEmployee]);
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
    if (err) {
      setError("Couldn't post your shout-out. Try again.");
      return false;
    }
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
    if (err || !data?.length) {
      setError("Couldn't save your changes.");
      return false;
    }
    refresh();
    return true;
  };

  const remove = async (id) => {
    setError("");
    const { data, error: err } = await supabase.from("meeting_shoutouts").delete().eq("id", id).select("id");
    if (err || !data?.length) {
      setError("Couldn't delete that shout-out.");
      return false;
    }
    setLoaded((prev) => ({ ...prev, rows: prev.rows.filter((x) => x.id !== id) }));
    return true;
  };

  const isLoading = loaded.date !== date && !loadError;
  const shoutouts = loaded.date === date ? loaded.rows : [];

  return { shoutouts, isLoading, loadError, error, setError, saving, post, saveEdit, remove, isMine, canDelete, taggable, nameById };
}
