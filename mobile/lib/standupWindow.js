// The Daily standup's days, for the mobile app: Nepal wall-clock time, which standup a person has
// already sent, and which days are open (today on a working day, and the next working day).
// Mirrors src/lib/standupWindow.js line for line because the app cannot import from src/;
// src/lib/mobileStandup.test.mjs runs both on the same cases and fails when they differ, so change
// one and the other together. Pure: no imports.

// Nepal is UTC+5:45 with no DST, so there's no clean arithmetic shortcut — reading its
// wall-clock time reliably means going through Intl and parsing the formatted parts back out.
export function getNepalParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const map = {};
  parts.forEach((p) => { map[p.type] = p.value; });
  return {
    dateStr: `${map.year}-${map.month}-${map.day}`,
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function firstName(name) {
  return (name || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
}

// Same email-first, first-name-fallback matching MeetingPage.js uses to line up an
// employee with a standup_responses row — kept in one place so the floating button
// (which decides whether to show at all) and the form page (which blocks resubmission)
// can never disagree about whether a date's standup is already submitted.
export function findSubmissionFor(standupSubmissions, dateStr, currentEmployee, user) {
  const myEmails = [currentEmployee?.work_email, currentEmployee?.personal_email, user?.email]
    .filter(Boolean)
    .map((e) => e.toLowerCase());
  const myFirstName = firstName(currentEmployee?.name);

  return (standupSubmissions || []).find((s) => {
    if (s.date !== dateStr) return false;
    const email = (s.email || "").toLowerCase();
    return (email && myEmails.includes(email)) || (myFirstName && firstName(s.name) === myFirstName);
  });
}

export const findTodaysSubmission = findSubmissionFor;

// From 10:00 on a working day the form opens on the next working day instead of today.
const DEFAULT_SWITCHES_MIN = 10 * 60;

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// Weekends (Sat/Sun, as in attendanceTime.js) and public holidays are not working days.
export function isStandupWorkingDay(dateStr, holidayDates) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return dow !== 0 && dow !== 6 && !holidayDates?.has(dateStr);
}

function nextWorkingDay(dateStr, holidayDates) {
  let next = addDays(dateStr, 1);
  // Bounded so a misconfigured holiday list can never spin forever.
  for (let i = 0; i < 366 && !isStandupWorkingDay(next, holidayDates); i += 1) next = addDays(next, 1);
  return next;
}

// The standups that can be filled or edited at any time, from the Nepal wall clock.
// → { today, next, defaultDate }: `today` is today's date on a working day (else null),
//   `next` the next working day after today, `defaultDate` the one the form opens on:
//   today before 10:00 on a working day, otherwise `next`.
export function standupDays(nepalParts, holidayDates = new Set()) {
  const todayStr = nepalParts.dateStr;
  const today = isStandupWorkingDay(todayStr, holidayDates) ? todayStr : null;
  const next = nextWorkingDay(todayStr, holidayDates);
  const minutesNow = nepalParts.hour * 60 + nepalParts.minute;
  const defaultDate = today && minutesNow < DEFAULT_SWITCHES_MIN ? today : next;
  return { today, next, defaultDate };
}

function previousWorkingDay(dateStr, holidayDates) {
  let prev = addDays(dateStr, -1);
  for (let i = 0; i < 366 && !isStandupWorkingDay(prev, holidayDates); i += 1) prev = addDays(prev, -1);
  return prev;
}

// When someone who hasn't filled in a standup is nudged, in Nepal minutes: the evening of the
// working day before (17:00), then a last call at 09:00 on the day, an hour before the form
// switches to the next day at 10:00.
export const STANDUP_REMINDER_MINUTES = { evening: 17 * 60, final: 9 * 60 };

function nepalInstant(dateStr, minutes) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return new Date(`${dateStr}T${hh}:${mm}:00+05:45`).toISOString();
}

// The reminders that have come due by now for the standup the form opens on (standupDays'
// defaultDate): [{ kind: "evening" | "final", date, at }], oldest first, `at` an ISO instant.
// Whether the person has already submitted, is on leave or skips standups is the caller's to
// check.
export function standupReminders(nepalParts, holidayDates = new Set()) {
  const { defaultDate } = standupDays(nepalParts, holidayDates);
  const now = nepalInstant(nepalParts.dateStr, nepalParts.hour * 60 + nepalParts.minute);
  const due = [
    { kind: "evening", date: defaultDate, at: nepalInstant(previousWorkingDay(defaultDate, holidayDates), STANDUP_REMINDER_MINUTES.evening) },
    { kind: "final", date: defaultDate, at: nepalInstant(defaultDate, STANDUP_REMINDER_MINUTES.final) },
  ];
  return due.filter((r) => r.at <= now);
}
