/**
 * Distance in meters between two lat/lng points (Haversine formula).
 */
export function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Returns { hours, minutes } for the given Date, in Asia/Kathmandu local time.
 */
export function getNepalTimeParts(date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kathmandu",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const hours = Number(parts.find((p) => p.type === "hour").value);
  const minutes = Number(parts.find((p) => p.type === "minute").value);
  return { hours, minutes };
}

/**
 * Returns the Y-M-D date string for the given Date, in Asia/Kathmandu local time.
 */
export function getNepalDateStr(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const y = parts.find((p) => p.type === "year").value;
  const m = parts.find((p) => p.type === "month").value;
  const d = parts.find((p) => p.type === "day").value;
  return `${y}-${m}-${d}`;
}

/**
 * Compares a check-in Date (any timezone) against a "HH:MM" cutoff in Nepal time.
 * Returns { isLate, lateMinutes }.
 */
export function computeLateness(checkInDate, syncTimeStr) {
  const [cutoffHours, cutoffMinutes] = (syncTimeStr || "09:30").split(":").map(Number);
  const { hours, minutes } = getNepalTimeParts(checkInDate);

  const actualTotal = hours * 60 + minutes;
  const cutoffTotal = cutoffHours * 60 + cutoffMinutes;
  const diff = actualTotal - cutoffTotal;

  return { isLate: diff > 0, lateMinutes: diff > 0 ? diff : 0 };
}

/**
 * Whether the given Y-M-D date string is a working day: not a weekend
 * (Sat/Sun, matching the convention already used by calculateCapacity in
 * AppContext.js) and not a public holiday.
 */
export function isWorkingDay(dateStr, holidays) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  const isWeekend = dow === 0 || dow === 6;
  const isHoliday = (holidays || []).some((h) => h.date === dateStr);
  return !isWeekend && !isHoliday;
}
