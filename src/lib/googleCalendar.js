// Server-only: reads Workspace calendars through a service account with domain-wide
// delegation (read-only scope). Never import this from a client component — it holds the
// service account's private key. Setup: docs/team-calendar/setup.md.

import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const API = "https://www.googleapis.com/calendar/v3/calendars";
// Only the fields the tracker shows. Descriptions, locations and attachments are never
// requested, so they can't leak through the API route by accident.
const FIELDS =
  "nextPageToken,items(id,status,summary,start,end,transparency,visibility,eventType,recurringEventId," +
  "attendees(email,self,resource,responseStatus),hangoutLink,conferenceData(entryPoints(entryPointType,uri)))";
const MAX_EVENTS = 1000;

export class CalendarError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

// null when the env vars aren't set, which the route reports as "not connected yet".
export function calendarConfig() {
  const email = process.env.GOOGLE_CALENDAR_SA_EMAIL;
  const key = process.env.GOOGLE_CALENDAR_SA_KEY;
  if (!email || !key) return null;
  return {
    email,
    // Env stores usually keep the PEM on one line with literal "\n".
    key: key.replace(/\\n/g, "\n"),
    domain: (process.env.GOOGLE_WORKSPACE_DOMAIN || "heubert.com").toLowerCase(),
  };
}

const b64url = (value) =>
  Buffer.from(value).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

// One access token per impersonated person, reused until a minute before it expires.
// Module memory only: a cold start simply signs in again.
const tokens = new Map();

async function accessTokenFor(config, subject) {
  const cached = tokens.get(subject);
  if (cached && cached.expiresAt > Date.now() + 60 * 1000) return cached.token;

  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({ iss: config.email, scope: SCOPE, aud: TOKEN_URL, sub: subject, iat: now, exp: now + 3600 })
  );
  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${claims}`);
  const signature = b64url(signer.sign(config.key));

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
    throw new CalendarError(json.error_description || json.error || `Token request failed (${res.status})`, res.status, json.error);
  }
  tokens.set(subject, { token: json.access_token, expiresAt: Date.now() + (json.expires_in || 3600) * 1000 });
  return json.access_token;
}

// Raw Google events on `email`'s primary calendar between two instants.
export async function listEvents(config, email, timeMin, timeMax) {
  const token = await accessTokenFor(config, email);
  const items = [];
  let pageToken;
  do {
    const params = new URLSearchParams({
      singleEvents: "true",
      orderBy: "startTime",
      timeMin,
      timeMax,
      maxResults: "250",
      timeZone: "Asia/Kathmandu",
      fields: FIELDS,
    });
    if (pageToken) params.set("pageToken", pageToken);
    const res = await fetch(`${API}/${encodeURIComponent(email)}/events?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new CalendarError(json.error?.message || `Calendar request failed (${res.status})`, res.status, json.error?.status);
    }
    items.push(...(json.items || []));
    pageToken = json.nextPageToken;
  } while (pageToken && items.length < MAX_EVENTS);
  return items;
}
