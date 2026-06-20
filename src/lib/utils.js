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
