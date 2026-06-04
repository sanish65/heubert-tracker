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
