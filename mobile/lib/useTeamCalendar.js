import { useCallback, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import { supabase, API_BASE_URL } from "./supabase";

// Calendars change slowly and every refresh costs one Google call per employee, so this polls far
// less often than the boards do; the refresh button covers "now". As the web's
// src/lib/useTeamCalendar.js.
const POLL_MS = 5 * 60 * 1000;

// Team calendar data for [start, end) from the deployed web app's GET /api/calendar, which holds the
// Google service account: the app sends only the signed-in person's Supabase token, never a Google
// key. The route blanks private titles, never sends descriptions or attendee emails, and keeps the
// Meet link only on the caller's own events. Leaves and holidays are not here: the screen has them
// from AppContext. Polls only while the screen is in front.
export function useTeamCalendar(start, end) {
  const [state, setState] = useState({ isLoading: true, configured: null, setupError: null, people: [], fetchedAt: null, error: null });
  const requestSeq = useRef(0);

  const load = useCallback(() => {
    const seq = ++requestSeq.current;
    // The last answer stays up while the next loads: its events fall on other dates, so a new
    // week never shows the old week's meetings.
    setState((prev) => ({ ...prev, isLoading: true }));
    if (!API_BASE_URL) {
      setState((prev) => ({ ...prev, isLoading: false, error: "The app has no web address set (EXPO_PUBLIC_API_BASE_URL)." }));
      return Promise.resolve();
    }
    return supabase.auth
      .getSession()
      .then(({ data }) => {
        const token = data?.session?.access_token;
        return fetch(`${API_BASE_URL}/api/calendar?start=${start}&end=${end}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
      })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
        return json;
      })
      .then((json) => {
        // A slower answer for a week the person has already moved away from is dropped.
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
        setState((prev) => ({ ...prev, isLoading: false, error: err.message || "Check your connection." }));
      });
  }, [start, end]);

  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, POLL_MS);
      return () => clearInterval(timer);
    }, [load])
  );

  return { ...state, reload: load };
}
