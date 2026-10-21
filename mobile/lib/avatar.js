// Avatar initials and colour, and the rules for showing a person's Google profile photo instead.
// Mirrors src/lib/avatar.js (AVATAR_COLORS, initials, avatarColor, isGooglePhotoUrl, photoForName)
// because the app cannot import from src/. src/lib/mobileAvatar.test.mjs runs both on the same
// inputs and fails when they differ: change a rule there and here together. Not mirrored:
// photoUrlOf, photosByName and isActiveEmployeeEmail, which only the server's GET /api/avatars
// needs; the phone receives its finished { employee name: photo URL } map. Pure: no imports.
//
// isGooglePhotoUrl reads the global URL. On the phone that is react-native-url-polyfill's, which
// lib/supabase.js installs at start-up; React Native's own URL is a regex look-alike that reads
// "https://evil.example/@lh3.googleusercontent.com/" as the Google host. Keep that polyfill loaded
// before any avatar is drawn.

// White initials pass 4.5:1 on each of these.
export const AVATAR_COLORS = ['#3D63F0', '#7C5CE0', '#0B7F90', '#B4471A'];

// First letter of the first word, plus the first letter of the last word when
// there are two or more; '?' when there is no name.
export function initials(name) {
  const words = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : '';
  return (first + last).toUpperCase();
}

// The same name always gets the same colour.
export function avatarColor(name) {
  let h = 0;
  for (const c of String(name || '').trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

// Google serves profile photos from googleusercontent.com. Supabase lets every user edit
// their own user_metadata, so a stored photo URL is theirs to write: only an https URL on
// this host (or a subdomain of it) is ever shown. Google's are ~100 characters; the length
// cap keeps a doctored one from bloating every response that carries it.
const GOOGLE_PHOTO_HOST = 'googleusercontent.com';
const MAX_PHOTO_URL_LENGTH = 2048;

export function isGooglePhotoUrl(url) {
  if (typeof url !== 'string' || url === '' || url.length > MAX_PHOTO_URL_LENGTH) return false;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  // `host`, not `hostname`: a URL naming a port is refused too.
  return (
    parsed.protocol === 'https:' &&
    (parsed.host === GOOGLE_PHOTO_HOST || parsed.host.endsWith(`.${GOOGLE_PHOTO_HOST}`))
  );
}

// The photo for a name as the app shows it: the exact employee name, else the same name
// ignoring case and surrounding spaces (poker, retro, memory and word authors are typed).
// The map came over the network, so every URL is checked again before it is used.
export function photoForName(photos, name) {
  if (!photos || typeof photos !== 'object' || typeof name !== 'string' || name.trim() === '') return null;
  const own = (key) => Object.prototype.hasOwnProperty.call(photos, key);
  let key = own(name) ? name : undefined;
  if (key === undefined) {
    const wanted = name.trim().toLowerCase();
    key = Object.keys(photos).find((personName) => personName.trim().toLowerCase() === wanted);
  }
  if (key === undefined) return null;
  return isGooglePhotoUrl(photos[key]) ? photos[key] : null;
}
