import { useCallback, useMemo, useState } from "react";
import { supabase, supabaseStandup, API_BASE_URL } from "./supabase";
import { useApp } from "../context/AppContext";

// Your Jira tickets from the web's /api/standup-jira, to save with your standup as jira_tickets
// so the meeting shows them, as the web's fetchStandupTickets (src/lib/standupJira.js). null when
// they couldn't be read: the standup then saves without touching the tickets it already has.
export async function fetchStandupTickets() {
  if (!API_BASE_URL) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return null;
    const res = await fetch(`${API_BASE_URL}/api/standup-jira`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body.tickets) ? body.tickets : null;
  } catch {
    return null;
  }
}

// Saving your Daily standup, as the web's submitStandupResponse and updateStandupResponse
// (src/context/AppContext.js): the same standup project, the same standup_responses table, the same
// insert and update. AppContext loads the day's submissions but has no writes for them yet, so the
// rows saved here are laid over its list until it next loads, and the screen shows them at once.
//
// → { submissions, submit(payload), update(id, payload) }; both writes resolve to { data, error }.
export function useStandupLog() {
  const { standupSubmissions } = useApp();
  const [savedRows, setSavedRows] = useState([]); // rows written from this screen

  const submissions = useMemo(() => {
    const byId = new Map(savedRows.map((r) => [r.id, r]));
    const loaded = (standupSubmissions || []).map((s) => byId.get(s.id) || s);
    const loadedIds = new Set(loaded.map((s) => s.id));
    return [...savedRows.filter((r) => !loadedIds.has(r.id)), ...loaded];
  }, [standupSubmissions, savedRows]);

  const keep = (row) => setSavedRows((prev) => [row, ...prev.filter((r) => r.id !== row.id)]);

  const submit = useCallback(async (payload) => {
    const { data, error } = await supabaseStandup.from("standup_responses").insert([payload]).select();
    if (data?.[0]) keep(data[0]);
    return { data, error };
  }, []);

  const update = useCallback(async (id, payload) => {
    const { data, error } = await supabaseStandup.from("standup_responses").update(payload).eq("id", id).select();
    if (data?.[0]) keep(data[0]);
    // An update the server quietly refused changes no row; say so rather than show it as saved.
    if (!error && !data?.length) return { data, error: new Error("Couldn't save your update. Try again.") };
    return { data, error };
  }, []);

  return { submissions, submit, update };
}
