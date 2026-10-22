// Mirrors src/lib/teamCalendar.js, the Team calendar's rules (day blocks, statuses, leave hours,
// free slots, the Google "new event" link), because the app cannot import from src/. Everything
// below this header is the web file as it is; src/lib/mobileTeamCalendar.test.mjs fails when the
// two differ, so change both together. normalizeEvent and validRange run on the server (the
// deployed /api/calendar route); they are kept here only so the copy stays whole. Pure: no imports.
//

export const DAY_START = 9;
export const DAY_END = 18;
export const SLOT_STEP_MIN = 30;
const NEPAL_OFFSET_MIN = 5 * 60 + 45;
const DAY_MS = 24 * 60 * 60 * 1000;

export const EVENT_KINDS = {
  team: { label: "Team meeting", tone: "blue" },
  client: { label: "Client call", tone: "violet" },
  focus: { label: "Focus time", tone: "gray" },
  hiring: { label: "Interview", tone: "amber" },
  ooo: { label: "Out of office", tone: "cyan" },
};

// ── Dates ───────────────────────────────────────────────────────────────────

export function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

export function weekdayOf(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

// Monday–Friday of the week holding dateStr (a weekend date shows the week after).
export function workWeekOf(dateStr) {
  const dow = weekdayOf(dateStr);
  const monday = dow === 0 ? addDays(dateStr, 1) : dow === 6 ? addDays(dateStr, 2) : addDays(dateStr, 1 - dow);
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

// Nepal-local date and decimal hour of an instant given as an ISO string.
export function nepalParts(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const local = new Date(ms + NEPAL_OFFSET_MIN * 60 * 1000);
  return {
    date: local.toISOString().slice(0, 10),
    hour: local.getUTCHours() + local.getUTCMinutes() / 60,
  };
}

export function formatHour(hour) {
  const totalMin = Math.round(hour * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// ── Google events ───────────────────────────────────────────────────────────

const emailDomain = (email) => String(email || "").split("@")[1]?.toLowerCase() || "";

export function classifyEvent(item, domain) {
  if (item.eventType === "outOfOffice") return "ooo";
  if (item.eventType === "focusTime") return "focus";
  const title = String(item.summary || "");
  if (/\binterview/i.test(title)) return "hiring";
  if (/\bfocus\b/i.test(title)) return "focus";
  const outsiders = (item.attendees || []).some(
    (a) => !a.resource && emailDomain(a.email) && emailDomain(a.email) !== String(domain || "").toLowerCase()
  );
  return outsiders ? "client" : "team";
}

// One Google Calendar event as the tracker shows it, or null when it shouldn't show:
// cancelled, marked "free", or declined by the calendar's owner. Descriptions and
// attendee emails never leave the server; a private event keeps its time and loses its
// title. The Meet link is only kept for the viewer's own calendar.
export function normalizeEvent(item, { ownerEmail, domain, isViewer = false }) {
  if (!item || item.status === "cancelled") return null;
  if (item.transparency === "transparent") return null;
  const owner = String(ownerEmail || "").toLowerCase();
  const self = (item.attendees || []).find((a) => a.self || String(a.email || "").toLowerCase() === owner);
  if (self?.responseStatus === "declined") return null;

  const allDay = Boolean(item.start?.date && !item.start?.dateTime);
  const start = allDay ? item.start.date : item.start?.dateTime;
  const end = allDay ? item.end?.date : item.end?.dateTime;
  if (!start || !end) return null;

  const hidden = item.visibility === "private" || item.visibility === "confidential";
  const meet =
    item.hangoutLink ||
    (item.conferenceData?.entryPoints || []).find((p) => p.entryPointType === "video")?.uri ||
    null;
  return {
    id: item.id,
    title: hidden ? null : item.summary || "(No title)",
    start,
    end,
    allDay,
    kind: classifyEvent(item, domain),
    recurringId: item.recurringEventId || null,
    attendeeCount: (item.attendees || []).filter((a) => !a.resource).length,
    meet: isViewer ? meet : null,
  };
}

// ── Leave from the tracker ──────────────────────────────────────────────────

// The tracker's leave on that date: "full", "first" / "second" (half-days, by the
// "[First Half]" reason prefix) or "early", or null.
export function leaveOn(leaves, employeeName, dateStr) {
  const leave = (leaves || []).find(
    (l) =>
      l.employee_name === employeeName &&
      String(l.start_date).slice(0, 10) <= dateStr &&
      String(l.end_date || l.start_date).slice(0, 10) >= dateStr
  );
  if (!leave) return null;
  if (leave.type === "half") {
    const reason = String(leave.reason || "");
    if (reason.startsWith("[First Half]")) return { part: "first", leave };
    if (reason.startsWith("[Second Half]")) return { part: "second", leave };
    return { part: "half", leave };
  }
  if (leave.type === "early") return { part: "early", leave };
  return { part: "full", leave };
}

const MIDDAY = (DAY_START + DAY_END) / 2;

// The hours a half-day leave takes out of the working day.
export function leaveHours(part) {
  if (part === "full") return [DAY_START, DAY_END];
  if (part === "first") return [DAY_START, MIDDAY];
  if (part === "second" || part === "half") return [MIDDAY, DAY_END];
  if (part === "early") return [DAY_END - 2, DAY_END];
  return null;
}

// ── Day view ────────────────────────────────────────────────────────────────

// Timed events that touch dateStr, clipped to the working day, as positioned blocks.
export function dayBlocks(events, dateStr) {
  const span = DAY_END - DAY_START;
  return (events || [])
    .filter((e) => !e.allDay)
    .map((e) => {
      const s = nepalParts(e.start);
      const en = nepalParts(e.end);
      if (!s || !en) return null;
      const startHour = s.date < dateStr ? 0 : s.date > dateStr ? 24 : s.hour;
      const endHour = en.date > dateStr ? 24 : en.date < dateStr ? 0 : en.hour;
      const from = Math.max(startHour, DAY_START);
      const to = Math.min(endHour, DAY_END);
      if (to <= from) return null;
      return {
        ...e,
        from,
        to,
        leftPct: ((from - DAY_START) / span) * 100,
        widthPct: ((to - from) / span) * 100,
        timeLabel: `${formatHour(Math.max(startHour, 0))}–${formatHour(Math.min(endHour, 24))}`,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.from - b.from);
}

// All-day events covering dateStr (end date is exclusive, as Google sends it).
export function allDayOn(events, dateStr) {
  return (events || []).filter((e) => e.allDay && e.start <= dateStr && e.end > dateStr);
}

// What a teammate is doing at `nowHour` on the day shown.
export function statusAt({ blocks, allDay = [], leave, nowHour, isToday }) {
  if (leave?.part === "full") return { tone: "cyan", text: "On leave" };
  if (allDay.some((e) => e.kind === "ooo")) return { tone: "cyan", text: "Out of office" };
  if (!isToday) {
    if (leave) return { tone: "cyan", text: "Part-day leave" };
    return blocks.length ? { tone: "gray", text: `${blocks.length} meeting${blocks.length === 1 ? "" : "s"}` } : { tone: "green", text: "No meetings" };
  }
  const leaveRange = leave ? leaveHours(leave.part) : null;
  if (leaveRange && nowHour >= leaveRange[0] && nowHour < leaveRange[1]) return { tone: "cyan", text: "On leave now" };
  const current = blocks.find((b) => b.from <= nowHour && b.to > nowHour);
  if (current) return { tone: "blue", text: current.kind === "focus" ? "Focus time" : "In a meeting" };
  if (nowHour >= DAY_END) return { tone: "gray", text: "Day over" };
  const next = blocks.find((b) => b.from > nowHour);
  const nextBusy = [next?.from, leaveRange && leaveRange[0] > nowHour ? leaveRange[0] : null].filter((v) => v != null);
  if (nextBusy.length) return { tone: "green", text: `Free until ${formatHour(Math.min(...nextBusy))}` };
  return { tone: "green", text: "Free" };
}

// ── Week view ───────────────────────────────────────────────────────────────

// Recurring series that happen on nearly every day of the week (a daily standup) are
// left out of the week cells, where they would fill every box with the same line.
export function dailySeries(peopleEvents, weekDates) {
  const daysBySeries = new Map();
  for (const events of peopleEvents) {
    for (const e of events) {
      if (!e.recurringId || e.allDay) continue;
      const day = nepalParts(e.start)?.date;
      if (!weekDates.includes(day)) continue;
      if (!daysBySeries.has(e.recurringId)) daysBySeries.set(e.recurringId, new Set());
      daysBySeries.get(e.recurringId).add(day);
    }
  }
  const threshold = Math.max(weekDates.length - 1, 2);
  return new Set([...daysBySeries].filter(([, days]) => days.size >= threshold).map(([id]) => id));
}

export function weekCell(events, dateStr, hiddenSeries = new Set(), maxShown = 2) {
  const items = [
    ...allDayOn(events, dateStr).map((e) => ({ ...e, timeLabel: "All day" })),
    ...dayBlocks(events, dateStr)
      .filter((e) => !(e.recurringId && hiddenSeries.has(e.recurringId)))
      .map((e) => ({ ...e, timeLabel: formatHour(e.from) })),
  ];
  return { shown: items.slice(0, maxShown), more: Math.max(items.length - maxShown, 0), total: items.length };
}

// ── Find a time ─────────────────────────────────────────────────────────────

// Busy hours for one person on one day: their timed events plus any leave.
export function busyHours(events, leave, dateStr) {
  const ranges = dayBlocks(events, dateStr).map((b) => [b.from, b.to]);
  if (allDayOn(events, dateStr).some((e) => e.kind === "ooo")) ranges.push([DAY_START, DAY_END]);
  const lr = leave ? leaveHours(leave.part) : null;
  if (lr) ranges.push(lr);
  return ranges;
}

// The first `limit` slots of `durationMin` when every person given is free, across the
// days given, on the half hour, inside the working day, and not in the past.
// people: [{ events, leaveFor(date) }]
export function findFreeSlots(people, days, { durationMin = 30, today = null, nowHour = 0, limit = 3 } = {}) {
  const dur = durationMin / 60;
  const step = SLOT_STEP_MIN / 60;
  const slots = [];
  for (const date of days) {
    const busy = people.flatMap((p) => busyHours(p.events, p.leaveFor(date), date));
    let start = DAY_START;
    if (today && date < today) continue;
    if (today && date === today) start = Math.max(start, Math.ceil(nowHour / step) * step);
    for (let s = start; s + dur <= DAY_END + 1e-9; s += step) {
      const e = s + dur;
      if (busy.every(([bs, be]) => be <= s + 1e-9 || bs >= e - 1e-9)) {
        slots.push({ date, from: s, to: e });
        if (slots.length === limit) return slots;
        s = e - step; // next suggestion starts after this one, so they don't overlap
      }
    }
  }
  return slots;
}

// A Google Calendar "new event" link, pre-filled; booking happens in Google itself,
// so the tracker never needs permission to write to anyone's calendar.
export function googleEventLink({ title, date, from, to, emails = [] }) {
  const stamp = (hour) => {
    const [y, m, d] = date.split("-").map(Number);
    const utcMs = Date.UTC(y, m - 1, d) + Math.round(hour * 60) * 60 * 1000 - NEPAL_OFFSET_MIN * 60 * 1000;
    return new Date(utcMs).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  };
  const params = new URLSearchParams({ action: "TEMPLATE", text: title || "Meeting", dates: `${stamp(from)}/${stamp(to)}` });
  if (emails.length) params.set("add", emails.join(","));
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function rangeDays(startStr, endStr) {
  const days = [];
  for (let d = startStr; d < endStr && days.length < 62; d = addDays(d, 1)) days.push(d);
  return days;
}

export function isWeekend(dateStr) {
  const dow = weekdayOf(dateStr);
  return dow === 0 || dow === 6;
}

export const MAX_RANGE_DAYS = 14;

export function validRange(start, end) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!re.test(start || "") || !re.test(end || "") || end <= start) return false;
  return (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS <= MAX_RANGE_DAYS;
}
