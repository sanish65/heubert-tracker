// Avatar initials and colour, derived from a person's name, and the rules for showing
// a person's Google profile photo instead. Pure: no imports.

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

// A Supabase auth user's Google photo: avatar_url, else picture (Google sign-in sets
// both), whichever is a Google photo URL first; null when neither is.
export function photoUrlOf(user) {
  const meta = user?.user_metadata;
  if (!meta) return null;
  for (const url of [meta.avatar_url, meta.picture]) {
    if (isGooglePhotoUrl(url)) return url;
  }
  return null;
}

// Emails compare trimmed and case-insensitive, as sign-in matches them. A missing or
// blank one is '' and never matches anything.
function emailKey(email) {
  return typeof email === 'string' ? email.trim().toLowerCase() : '';
}

// { [employee name]: photo URL } for every employee whose sign-in account has a Google
// photo: the account with their work email, else the one with their personal email.
// Keyed by employee name only, so an account that belongs to no employee never appears,
// and no email or other account detail is carried.
export function photosByName(employees, users) {
  const photoByEmail = new Map();
  for (const user of users || []) {
    const email = emailKey(user?.email);
    const photo = photoUrlOf(user);
    if (email && photo && !photoByEmail.has(email)) photoByEmail.set(email, photo);
  }

  const entries = [];
  for (const employee of employees || []) {
    const name = employee?.name;
    if (typeof name !== 'string' || name === '') continue;
    const photo =
      photoByEmail.get(emailKey(employee.work_email)) || photoByEmail.get(emailKey(employee.personal_email));
    if (photo) entries.push([name, photo]);
  }
  // fromEntries defines own properties, so no name can reach the object's prototype.
  return Object.fromEntries(entries);
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

// Who may see everyone's photos (GET /api/avatars): an active employee, found by work or
// personal email. The same rule sign-in applies (AppContext's verifyEmployeeAccess).
export function isActiveEmployeeEmail(employees, email) {
  const wanted = emailKey(email);
  if (!wanted) return false;
  return (employees || []).some(
    (employee) =>
      employee?.status === 'active' &&
      (emailKey(employee.work_email) === wanted || emailKey(employee.personal_email) === wanted)
  );
}
