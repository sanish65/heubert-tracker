// Server-only: signs in to Google as a service account acting for one Workspace user
// (domain-wide delegation). Shared by the calendar reader and the Gmail sender, each
// with its own service account and scope. Never import from a client component.

import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

export class GoogleError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// Env stores usually keep the PEM on one line with literal "\n".
export const readPrivateKey = (value) => String(value || "").replace(/\\n/g, "\n");

const b64url = (value) =>
  Buffer.from(value).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

// One access token per service account, scope and impersonated person, reused until a
// minute before it expires. Module memory only: a cold start simply signs in again.
const tokens = new Map();

export async function serviceAccountToken({ clientEmail, privateKey, subject, scope }) {
  const cacheKey = `${clientEmail}|${scope}|${subject}`;
  const cached = tokens.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 60 * 1000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(JSON.stringify({ iss: clientEmail, scope, aud: TOKEN_URL, sub: subject, iat: now, exp: now + 3600 }));
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = b64url(signer.sign(privateKey));

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new GoogleError(json.error_description || json.error || `Token request failed (${res.status})`, res.status, json.error);
  }
  tokens.set(cacheKey, { token: json.access_token, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 });
  return json.access_token;
}
