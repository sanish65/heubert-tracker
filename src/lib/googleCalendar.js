// Server-only: reads Workspace calendars through a service account with domain-wide
// delegation (read-only scope). Never import this from a client component — it holds the
// service account's private key. Setup: docs/team-calendar/setup.md.

import { GoogleError, readPrivateKey, serviceAccountToken } from "@/lib/googleServiceAuth";

const SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
const API = "https://www.googleapis.com/calendar/v3/calendars";
// Only the fields the tracker shows. Descriptions, locations and attachments are never
// requested, so they can't leak through the API route by accident.
const FIELDS =
  "nextPageToken,items(id,status,summary,start,end,transparency,visibility,eventType,recurringEventId," +
  "attendees(email,self,resource,responseStatus),hangoutLink,conferenceData(entryPoints(entryPointType,uri)))";
const MAX_EVENTS = 1000;

export { GoogleError as CalendarError };

// null when the env vars aren't set, which the route reports as "not connected yet".
export function calendarConfig() {
  const email = process.env.GOOGLE_CALENDAR_SA_EMAIL;
  const key = process.env.GOOGLE_CALENDAR_SA_KEY;
  if (!email || !key) return null;
  return {
    email,
    key: readPrivateKey(key),
    domain: (process.env.GOOGLE_WORKSPACE_DOMAIN || "heubert.com").toLowerCase(),
  };
}

// Raw Google events on `email`'s primary calendar between two instants.
export async function listEvents(config, email, timeMin, timeMax) {
  const token = await serviceAccountToken({ clientEmail: config.email, privateKey: config.key, subject: email, scope: SCOPE });
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
      throw new GoogleError(json.error?.message || `Calendar request failed (${res.status})`, res.status, json.error?.status);
    }
    items.push(...(json.items || []));
    pageToken = json.nextPageToken;
  } while (pageToken && items.length < MAX_EVENTS);
  return items;
}
