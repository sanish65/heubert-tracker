import { test } from "node:test";
import assert from "node:assert/strict";
import { shotUrl, verifyShot, validShot, SHOT_TTL_MS } from "./whatsNewShots.js";

const params = (url) => {
  const q = new URL(url, "http://x").searchParams;
  return { platform: q.get("p"), id: q.get("id"), exp: q.get("exp"), sig: q.get("sig") };
};

test("a link it made verifies until it expires", () => {
  const now = 1_000_000;
  const p = params(shotUrl("secret", "web", "tasks", now));
  assert.equal(verifyShot("secret", p, now), true);
  assert.equal(verifyShot("secret", p, now + SHOT_TTL_MS - 1), true);
  assert.equal(verifyShot("secret", p, now + SHOT_TTL_MS + 1), false);
});

test("a changed screen, platform, expiry or secret fails", () => {
  const p = params(shotUrl("secret", "web", "tasks", 0));
  assert.equal(verifyShot("secret", { ...p, id: "meeting" }, 0), false);
  assert.equal(verifyShot("secret", { ...p, platform: "mobile" }, 0), false);
  assert.equal(verifyShot("secret", { ...p, exp: String(Number(p.exp) + 1) }, 0), false);
  assert.equal(verifyShot("other", p, 0), false);
  assert.equal(verifyShot("", p, 0), false);
});

test("only known platforms and plain ids are shots", () => {
  assert.equal(validShot("web", "late-fines"), true);
  assert.equal(validShot("desktop", "tasks"), false);
  assert.equal(validShot("web", "../secrets"), false);
  assert.equal(validShot("web", ""), false);
  assert.equal(verifyShot("secret", { platform: "web", id: "../x", exp: "9", sig: "" }, 0), false);
});
