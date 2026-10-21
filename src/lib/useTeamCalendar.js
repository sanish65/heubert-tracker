"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

// Calendars change slowly and every refresh costs one Google call per employee, so
// this polls far less often than the boards do; the Refresh button covers "now".
const POLL_MS = 5 * 60 * 1000;

// Team calendar data for [start, end) from /api/calendar. Leaves and holidays are not
// here: the page already has them from AppContext.
export function useTeamCalendar(start, end) {
  const [state, setState] = useState({ isLoading: true, configured: null, setupError: null, people: [], fetchedAt: null, error: null });
  const requestSeq = useRef(0);

  const load = useCallback(() => {
    const seq = ++requestSeq.current;
    return supabase.auth
      .getSession()
      .then(({ data }) => {
        const token = data?.session?.access_token;
        return fetch(`/api/calendar?start=${start}&end=${end}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          cache: "no-store",
        });
      })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
        return json;
      })
      .then((json) => {
        // A slower answer for a range the person has already moved away from is dropped.
        if (seq !== requestSeq.current) return;
        setState({
          isLoading: false,
          configured: json.configured,
          setupError: json.setupError || null,
          people: json.people || [],
          fetchedAt: json.fetchedAt || null,
          error: null,
        });
      })
      .catch((err) => {
        if (seq !== requestSeq.current) return;
        setState((prev) => ({ ...prev, isLoading: false, error: err.message }));
      });
  }, [start, end]);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [load]);

  return { ...state, reload: load };
}
