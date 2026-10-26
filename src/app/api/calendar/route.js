import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { calendarConfig, freeBusy, listEvents } from "@/lib/googleCalendar";
import { normalizeEvent, validRange } from "@/lib/teamCalendar";

// GET /api/calendar?start=YYYY-MM-DD&end=YYYY-MM-DD  (end exclusive, at most 14 days)
//
// Every active employee's meetings in that range, read from Google Calendar through the
// Workspace service account. With domain-wide delegation it reads everyone; without it
// (Google answers unauthorized_client) it reads the calendars people have shared with the
// service account, as busy blocks when only free/busy is shared, and marks the rest
// "not-shared". Only signed-in active employees may ask. The response
// carries times, titles (blanked for private events), a meeting kind and an attendee
// count — never descriptions or attendee emails — and the Meet link only on the
// caller's own events.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Two people opening the tab in the same minute share one round of Google calls.
const CACHE_MS = 60 * 1000;
const CONCURRENCY = 5;
const cache = new Map();

function fail(message, status) {
  return NextResponse.json({ error: message }, { status });
}

const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

// Whether delegation works, re-checked every ten minutes so granting it takes effect
// without a redeploy. null: not known yet.
const DELEGATION_RECHECK_MS = 10 * 60 * 1000;
let delegation = { ok: null, at: 0 };
const delegationKnownOff = () => delegation.ok === false && Date.now() - delegation.at < DELEGATION_RECHECK_MS;

// A free/busy block in the shape normalizeEvent gives: no title, so every view says Busy.
const busyEvent = (block, i) => ({
  id: `busy-${i}-${block.start}`,
  title: null,
  start: block.start,
  end: block.end,
  allDay: false,
  kind: "team",
  recurringId: null,
  attendeeCount: 0,
  meet: null,
});

// One shared calendar, read as the service account: its events when it's shared with
// details, its busy blocks when only free/busy is shared.
async function readShared(config, email, timeMin, timeMax) {
  try {
    const items = await listEvents(config, email, timeMin, timeMax, { asSelf: true });
    return items
      .map((item) => {
        const e = normalizeEvent(item, { ownerEmail: email, domain: config.domain, isViewer: true });
        // Free/busy-only sharing returns events without their titles: those stay Busy.
        return e && !item.summary ? { ...e, title: null } : e;
      })
      .filter(Boolean);
  } catch (err) {
    if (err.status !== 403) throw err;
    return (await freeBusy(config, email, timeMin, timeMax)).map(busyEvent);
  }
}

async function callerEmployee(request) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  const email = data?.user?.email;
  if (error || !email) return null;
  const pattern = escapeLike(email);
  const [work, personal] = await Promise.all([
    supabase.from("employees").select("id, status").ilike("work_email", pattern),
    supabase.from("employees").select("id, status").ilike("personal_email", pattern),
  ]);
  return [...(work.data || []), ...(personal.data || [])].find((e) => e.status === "active") || null;
}

async function pooled(items, limit, run) {
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      results[i] = await run(items[i]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

async function loadRange(config, start, end) {
  const key = `${start}|${end}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  const { data: employees, error } = await supabase
    .from("employees")
    .select("id, work_email, status")
    .eq("status", "active");
  if (error) throw new Error(error.message);

  const timeMin = `${start}T00:00:00+05:45`;
  const timeMax = `${end}T00:00:00+05:45`;
  const people = await pooled(employees || [], CONCURRENCY, async (emp) => {
    const email = String(emp.work_email || "").trim().toLowerCase();
    // Only Workspace accounts can be read; a personal Gmail on file can't.
    if (!email.endsWith(`@${config.domain}`)) return { employeeId: emp.id, status: "no-workspace-email", events: [] };
    if (!delegationKnownOff()) {
      try {
        const items = await listEvents(config, email, timeMin, timeMax);
        delegation = { ok: true, at: Date.now() };
        // isViewer: true keeps Meet links in the cache; the response strips them from
        // everyone but the caller.
        const events = items
          .map((item) => normalizeEvent(item, { ownerEmail: email, domain: config.domain, isViewer: true }))
          .filter(Boolean);
        return { employeeId: emp.id, status: "ok", events };
      } catch (err) {
        if (err.code !== "unauthorized_client") {
          return { employeeId: emp.id, status: "unavailable", code: err.code || null, message: err.message, events: [] };
        }
        delegation = { ok: false, at: Date.now() };
      }
    }
    try {
      return { employeeId: emp.id, status: "ok", events: await readShared(config, email, timeMin, timeMax) };
    } catch (err) {
      if (err.status === 404) return { employeeId: emp.id, status: "not-shared", events: [] };
      return { employeeId: emp.id, status: "unavailable", code: err.code || null, message: err.message, events: [] };
    }
  });

  const value = { fetchedAt: new Date().toISOString(), people, access: delegationKnownOff() ? "shared" : "delegated" };
  cache.set(key, { at: Date.now(), value });
  // Keep the cache small: ranges are a day or a week, so only a handful are ever live.
  if (cache.size > 20) cache.delete(cache.keys().next().value);
  return value;
}

export async function GET(request) {
  const start = request.nextUrl.searchParams.get("start");
  const end = request.nextUrl.searchParams.get("end");
  if (!validRange(start, end)) return fail("start and end must be dates, end after start, at most 14 days apart.", 400);

  const viewer = await callerEmployee(request);
  if (!viewer) return fail("Sign in as an active employee to see the team calendar.", 401);

  const config = calendarConfig();
  if (!config) return NextResponse.json({ configured: false, people: [] });

  try {
    const { fetchedAt, people, access } = await loadRange(config, start, end);
    const reachable = people.filter((p) => p.status !== "no-workspace-email");
    const failed = reachable.filter((p) => p.status === "unavailable");
    // Everyone failing the same way is a setup problem (delegation not granted, wrong
    // key), not a per-person one, so the page can say what to fix.
    const setupError =
      reachable.length > 0 && failed.length === reachable.length ? failed[0].message || "Google rejected every request" : null;
    return NextResponse.json({
      configured: true,
      fetchedAt,
      setupError,
      // "shared": no delegation yet, so only calendars shared with `shareWith` show.
      access,
      shareWith: access === "shared" ? config.email : null,
      people: people.map((p) => ({
        employeeId: p.employeeId,
        status: p.status,
        events: p.employeeId === viewer.id ? p.events : p.events.map((e) => ({ ...e, meet: null })),
      })),
    });
  } catch (err) {
    return fail(`Couldn't read calendars: ${err.message}`, 502);
  }
}
