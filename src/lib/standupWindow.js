export const STANDUP_WINDOW_START_MIN = 9 * 60; // 9:00 AM
export const STANDUP_WINDOW_END_MIN = 9 * 60 + 30; // 9:30 AM (through :59 seconds)

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

export function isStandupWindowOpen(nepalParts) {
  const minutesNow = nepalParts.hour * 60 + nepalParts.minute;
  return minutesNow >= STANDUP_WINDOW_START_MIN && minutesNow <= STANDUP_WINDOW_END_MIN;
}

function firstName(name) {
  return (name || "").trim().split(/\s+/)[0]?.toLowerCase() || "";
}

// Same email-first, first-name-fallback matching MeetingPage.js uses to line up an
// employee with a standup_responses row — kept in one place so the floating button
// (which decides whether to show at all) and the form page (which blocks resubmission)
// can never disagree about whether "today" is already submitted.
export function findTodaysSubmission(standupSubmissions, dateStr, currentEmployee, user) {
  const myEmails = [currentEmployee?.work_email, currentEmployee?.personal_email, user?.email]
    .filter(Boolean)
    .map((e) => e.toLowerCase());
  const myFirstName = firstName(currentEmployee?.name);

  return standupSubmissions.find((s) => {
    if (s.date !== dateStr) return false;
    const email = (s.email || "").toLowerCase();
    return (email && myEmails.includes(email)) || (myFirstName && firstName(s.name) === myFirstName);
  });
}
