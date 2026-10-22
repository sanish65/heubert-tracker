// The pure parts of the shout-out board, for the mobile app: the length cap, when a post went up
// (in office time), the tag list cleaned to employee ids, and the days the Meeting board steps
// through. Mirrors the pure helpers of src/lib/useShoutouts.js (SHOUTOUT_MAX, postedAt, toIds) and
// src/components/MeetingShoutouts.js (shiftDay, nextMeetingDay); src/lib/mobileStandup.test.mjs
// holds them to the web's results. Pure: only the sibling attendance.js.
import { isWorkingDay } from "./attendance.js";

export const SHOUTOUT_MAX = 280;

// "09:20 AM" when a shoutout was posted, in office time like the standup submissions.
const POSTED_AT_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kathmandu",
  hour: "2-digit",
  minute: "2-digit",
});

// Supabase stamps six fraction digits, which Hermes may refuse; milliseconds are enough.
export function postedAt(createdAt) {
  if (!createdAt) return "";
  const d = new Date(String(createdAt).replace(/(\.\d{3})\d+/, "$1"));
  return Number.isNaN(d.getTime()) ? "" : POSTED_AT_FORMAT.format(d);
}

export const toIds = (tags) => (Array.isArray(tags) ? tags.map(Number).filter(Number.isInteger) : []);

// "YYYY-MM-DD" `delta` days away, counted in UTC so no clock change moves it.
export function shiftDay(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + delta)).toISOString().slice(0, 10);
}

// The first working day after `ymd` (skipping weekends and public holidays): the day of the next
// meeting. Bounded so a holiday list gone wrong can't spin forever.
export function nextMeetingDay(ymd, holidays) {
  let day = shiftDay(ymd, 1);
  for (let i = 0; i < 14 && !isWorkingDay(day, holidays); i++) day = shiftDay(day, 1);
  return day;
}
