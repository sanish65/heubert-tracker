/**
 * Returns a Google Drive thumbnail image URL for use in <img> tags.
 * Returns null if the URL is not a Google Drive link.
 */
export const getGoogleDriveThumbnailUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const fileDMatch = url.match(/\/file\/d\/([^\/?#]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${fileDMatch[1]}&sz=w600`;
  }
  if (url.includes('drive.google.com')) {
    try {
      const urlObj = new URL(url);
      const id = urlObj.searchParams.get('id');
      if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w600`;
    } catch (e) {}
  }
  return null;
};

/**
 * Returns a Google Drive /preview embed URL for use in an <iframe> (video playback).
 * Returns null if the URL is not a Google Drive link.
 */
export const getGoogleDriveEmbedUrl = (url) => {
  if (!url || typeof url !== 'string') return null;
  const fileDMatch = url.match(/\/file\/d\/([^\/?#]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://drive.google.com/file/d/${fileDMatch[1]}/preview`;
  }
  if (url.includes('drive.google.com')) {
    try {
      const urlObj = new URL(url);
      const id = urlObj.searchParams.get('id');
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    } catch (e) {}
  }
  return null;
};

/**
 * Transforms a Google Drive sharing link into a direct link suitable for <img> and <video> tags.
 * Uses the highly reliable lh3.googleusercontent.com/d/[ID] format.
 */
export const transformGoogleDriveLink = (url) => {
  if (!url || typeof url !== 'string') return url;
  
  // Support for /file/d/[ID]/view or /file/d/[ID]/edit etc.
  const fileDMatch = url.match(/\/file\/d\/([^\/?#]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
  }
  
  // Support for ?id=[ID]
  if (url.includes('drive.google.com')) {
    try {
      const urlObj = new URL(url);
      const id = urlObj.searchParams.get('id');
      if (id) {
        return `https://lh3.googleusercontent.com/d/${id}`;
      }
    } catch (e) {
      // Not a valid URL or other parsing error
    }
  }
  
  return url;
};

/**
 * Builds an array of working dates (YYYY-MM-DD) between startStr and endStr,
 * skipping weekends and any dates present in holidaySet.
 */
export function buildWorkingDates(startStr, endStr, holidaySet) {
  const dates = [];
  if (!startStr || !endStr) return dates;
  let current = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  
  while (current <= end) {
    const dow = current.getDay();
    const isWeekend = dow === 0 || dow === 6;
    
    // Format YYYY-MM-DD
    const y = current.getFullYear();
    const m = String(current.getMonth() + 1).padStart(2, "0");
    const d = String(current.getDate()).padStart(2, "0");
    const dtStr = `${y}-${m}-${d}`;
    
    if (!isWeekend && !holidaySet.has(dtStr)) {
      dates.push(dtStr);
    }
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/**
 * Number of days a single leave record counts against a balance:
 * working days in its range (skipping weekends/holidays), halved for half-day leaves.
 */
export function leaveDayCount(leave, holidaySet) {
  const dates = leave.dates || buildWorkingDates(leave.start_date, leave.end_date, holidaySet);
  return leave.type === "half" ? dates.length * 0.5 : dates.length;
}

/**
 * Per-leave-type balances (annual / used / remaining) for one employee within a leave season.
 * Only active leave types are included. Leaves without a matching leave_type_id don't count
 * against any balance ("Uncategorized"). Balances reset when the season changes (pass `seasonId`
 * as `null` to scope to leaves recorded before seasons existed).
 */
export function computeLeaveBalances(employeeName, leaves, leaveTypes, seasonId, holidaySet) {
  return (leaveTypes || [])
    .filter((t) => t.is_active)
    .map((t) => {
      const used = (leaves || [])
        .filter(
          (l) =>
            l.employee_name === employeeName &&
            l.leave_type_id === t.id &&
            (l.season_id ?? null) === (seasonId ?? null)
        )
        .reduce((sum, l) => sum + leaveDayCount(l, holidaySet), 0);
      return { ...t, used, remaining: Math.max(0, t.annual_days - used) };
    });
}
