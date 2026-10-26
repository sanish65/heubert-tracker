import { createHmac, timingSafeEqual } from "node:crypto";

// Signed links to the What's new screenshots (whats-new/shots/<platform>/<id>.webp). The
// screens show real team data, so /api/whats-new hands signed-in employees links that expire,
// and /api/whats-new/shot serves a file only for a link that is genuine and still fresh. A
// signed link lets a plain <img> or React Native <Image> load it without an auth header.
// Pure apart from node:crypto, so it runs under `npm test`.

export const SHOT_PLATFORMS = ["web", "mobile"];
export const SHOT_TTL_MS = 6 * 60 * 60 * 1000;

const ID = /^[a-z0-9-]{1,64}$/;

export const validShot = (platform, id) => SHOT_PLATFORMS.includes(platform) && ID.test(String(id || ""));

const signature = (secret, platform, id, exp) =>
  createHmac("sha256", `whats-new:${secret}`).update(`${platform}/${id}/${exp}`).digest("hex");

// "/api/whats-new/shot?p=web&id=tasks&exp=…&sig=…", fresh for SHOT_TTL_MS from `now`.
export function shotUrl(secret, platform, id, now = Date.now()) {
  const exp = now + SHOT_TTL_MS;
  const sig = signature(secret, platform, id, exp);
  return `/api/whats-new/shot?p=${platform}&id=${id}&exp=${exp}&sig=${sig}`;
}

// Whether a shot request's link is one shotUrl made and hasn't expired.
export function verifyShot(secret, { platform, id, exp, sig }, now = Date.now()) {
  if (!secret || !validShot(platform, id)) return false;
  const expires = Number(exp);
  if (!Number.isFinite(expires) || expires < now) return false;
  const expected = Buffer.from(signature(secret, platform, id, expires));
  const given = Buffer.from(String(sig || ""));
  return given.length === expected.length && timingSafeEqual(given, expected);
}
