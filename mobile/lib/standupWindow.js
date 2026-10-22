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
