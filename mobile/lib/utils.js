/**
 * Returns a Google Drive thumbnail image URL for use as an <Image> source.
 * Returns null if the URL is not a Google Drive link.
 */
export const getGoogleDriveThumbnailUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  const fileDMatch = url.match(/\/file\/d\/([^\/?#]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${fileDMatch[1]}&sz=w600`;
  }
  if (url.includes("drive.google.com")) {
    try {
      const urlObj = new URL(url);
      const id = urlObj.searchParams.get("id");
      if (id) return `https://drive.google.com/thumbnail?id=${id}&sz=w600`;
    } catch (e) {}
  }
  return null;
};

/**
 * Returns a Google Drive /preview embed URL for use inside a WebView (video playback).
 * Returns null if the URL is not a Google Drive link.
 */
export const getGoogleDriveEmbedUrl = (url) => {
  if (!url || typeof url !== "string") return null;
  const fileDMatch = url.match(/\/file\/d\/([^\/?#]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://drive.google.com/file/d/${fileDMatch[1]}/preview`;
  }
  if (url.includes("drive.google.com")) {
    try {
      const urlObj = new URL(url);
      const id = urlObj.searchParams.get("id");
      if (id) return `https://drive.google.com/file/d/${id}/preview`;
    } catch (e) {}
  }
  return null;
};

/**
 * Transforms a Google Drive sharing link into a direct link suitable for <Image> tags.
 */
export const transformGoogleDriveLink = (url) => {
  if (!url || typeof url !== "string") return url;

  const fileDMatch = url.match(/\/file\/d\/([^\/?#]+)/);
  if (fileDMatch && fileDMatch[1]) {
    return `https://lh3.googleusercontent.com/d/${fileDMatch[1]}`;
  }

  if (url.includes("drive.google.com")) {
    try {
      const urlObj = new URL(url);
      const id = urlObj.searchParams.get("id");
      if (id) return `https://lh3.googleusercontent.com/d/${id}`;
    } catch (e) {}
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

export function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function parseLocalDate(str) {
  if (!str) return new Date();
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}
