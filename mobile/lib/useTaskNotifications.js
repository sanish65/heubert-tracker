import { useEffect, useSyncExternalStore } from "react";
import { AppState } from "react-native";
import { supabase } from "./supabase";

// The bell's task notifications (assigned, mentioned, comments and status changes on issues you
// watch), as the web's useTaskNotifications in src/lib/useTasks.js: the last 30 days from
// task_notifications, which the database's triggers write and RLS keeps to your own.
//
// Every tab draws its own top bar and stays mounted, so the list is one shared store with one
// poll (while the app is in front), not a copy per bar. markRead sets read_at once the bell has
// been opened.

const POLL_MS = 60 * 1000;
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const EMPTY = [];

let items = EMPTY;
const listeners = new Set();
let stop = null;
let users = 0;

function setItems(next) {
  items = next;
  listeners.forEach((listener) => listener());
}

function load() {
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  return supabase
    .from("task_notifications")
    .select("*, task:tasks(number, title, project_id)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(20)
    .then((res) => {
      // No table yet (migration not applied) or no access: the bell shows fines only.
      if (!res.error) setItems(res.data || EMPTY);
    });
}

function start() {
  load();
  const timer = setInterval(() => {
    if (AppState.currentState === "active") load();
  }, POLL_MS);
  const sub = AppState.addEventListener("change", (state) => {
    if (state === "active") load();
  });
  return () => {
    clearInterval(timer);
    sub.remove();
  };
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

const read = () => items;

export async function markTaskNotificationsRead(ids) {
  const unread = ids.filter((id) => items.some((n) => n.id === id && !n.read_at));
  if (!unread.length) return;
  const at = new Date().toISOString();
  setItems(items.map((n) => (unread.includes(n.id) ? { ...n, read_at: at } : n)));
  await supabase.from("task_notifications").update({ read_at: at }).in("id", unread);
}

// `enabled`: this bar shows a bell and someone is signed in. A bar without one neither counts nor
// clears the shared list. When the last bar goes (signing out), the poll stops and the list empties,
// so the next person never sees the last one's.
export function useTaskNotifications(enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    users += 1;
    if (!stop) stop = start();
    return () => {
      users -= 1;
      // The last bar to go stops the poll.
      if (users === 0 && stop) {
        stop();
        stop = null;
        setItems(EMPTY);
      }
    };
  }, [enabled]);
  return useSyncExternalStore(subscribe, read);
}
