import { useEffect, useMemo, useState } from "react";
import { supabaseStandup } from "./supabase";
import { getNepalParts, standupReminders, findSubmissionFor } from "./standupWindow";
import { standupReminderItems } from "./notifications";
import { leaveOn } from "./teamCalendar";

// The web's src/lib/useStandupReminders.js for the app's bell: 17:00 the working day before and
// 09:00 on the day, until your standup for that day is in. That day's submissions are read again
// every few minutes while a reminder is due, so one sent through HeuBot clears it too.
const RECHECK_MS = 5 * 60 * 1000;
const TICK_MS = 60 * 1000;

export function useStandupReminders({ me, user, leaves, publicHolidays, standupSubmissions }) {
  const [now, setNow] = useState(() => Date.now());
  const [fetched, setFetched] = useState({ date: null, rows: [] });

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(timer);
  }, []);

  const holidays = useMemo(
    () => new Set((publicHolidays || []).map((h) => String(h.date).slice(0, 10))),
    [publicHolidays]
  );
  const due = useMemo(() => standupReminders(getNepalParts(new Date(now)), holidays), [now, holidays]);
  const date = due[0]?.date ?? null;

  const skip =
    !me ||
    (me.status && me.status !== "active") ||
    Boolean(me.standup_excluded) ||
    (date != null && leaveOn(leaves, me.name, date)?.part === "full");

  useEffect(() => {
    if (!date || skip) return;
    let cancelled = false;
    const load = () =>
      supabaseStandup
        .from("standup_responses")
        .select("id, date, email, name")
        .eq("date", date)
        .then(({ data, error }) => {
          if (!cancelled && !error) setFetched({ date, rows: data || [] });
        });
    load();
    const timer = setInterval(load, RECHECK_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [date, skip]);

  return useMemo(() => {
    if (!date) return [];
    const rows = [...(standupSubmissions || []), ...(fetched.date === date ? fetched.rows : [])];
    const submitted = Boolean(findSubmissionFor(rows, date, me, user));
    return standupReminderItems(due, { submitted, skip });
  }, [due, date, standupSubmissions, fetched, me, user, skip]);
}
