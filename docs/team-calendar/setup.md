# Connecting Google Calendar to the Team calendar tab

The Calendar tab reads every employee's Google Calendar through one Google Cloud
**service account** that a Google Workspace admin allows to read calendars across the
heubert.com domain. Nobody has to connect their own calendar. Access is read-only: the
tracker can't create, change or delete events. "Book in Google Calendar" opens Google's
own new-event page in the person's browser.

What the tracker shows: each event's time, title, a kind (team meeting, client call,
focus time, interview, out of office) and how many people are invited. It never fetches
descriptions, locations or attachments, and never sends attendee emails to the browser.
Events marked **Private** in Google show as "Busy" with no title. Meet links are only
sent to the person whose calendar it is.

Until this is done, the tab still works with leaves and holidays from the tracker, and
admins see a notice pointing here.

## 1. Create the service account (Google Cloud console, ~5 min)

1. In [console.cloud.google.com](https://console.cloud.google.com), pick or create a
   project for the tracker.
2. **APIs & Services → Library**: enable **Google Calendar API**.
3. **IAM & Admin → Service accounts → Create service account**. Name it
   `heubert-tracker-calendar`. It needs no project roles; skip the optional steps.
4. Open it → **Keys → Add key → Create new key → JSON**. A file downloads. Keep it
   private: it is the password for reading everyone's calendar.
5. On the service account's **Details** tab, copy the **Unique ID** (a long number,
   the "client ID").

## 2. Allow it to read calendars (Google Admin console, ~2 min, Workspace super admin)

1. In [admin.google.com](https://admin.google.com): **Security → Access and data
   control → API controls → Manage domain-wide delegation → Add new**.
2. **Client ID**: the Unique ID from step 1.5.
3. **OAuth scopes**: exactly
   `https://www.googleapis.com/auth/calendar.readonly`
4. **Authorize**. It can take a few minutes to start working.

## 3. Give the tracker the key

Add these environment variables in Vercel (Project → Settings → Environment Variables,
Production and Preview) and in your local `.env.local`:

| Variable | Value |
| --- | --- |
| `GOOGLE_CALENDAR_SA_EMAIL` | `client_email` from the JSON key, e.g. `heubert-tracker-calendar@<project>.iam.gserviceaccount.com` |
| `GOOGLE_CALENDAR_SA_KEY` | `private_key` from the JSON key, the whole `-----BEGIN PRIVATE KEY----- … -----END PRIVATE KEY-----` text. Pasting it with literal `\n` sequences on one line is fine. |
| `GOOGLE_WORKSPACE_DOMAIN` | Optional. Defaults to `heubert.com`. Only employees whose **work email** is on this domain are read. |

Redeploy (or restart `npm run dev`) so the server picks them up. Never prefix these
with `NEXT_PUBLIC_`: that would ship the key to every browser.

## 4. Check it

Open the Calendar tab. The toolbar should say "Synced from Google Calendar" and
"All N connected".

- **"Google Calendar rejected the connection"** with `unauthorized_client`: the
  delegation in step 2 is missing, has a different client ID, or isn't active yet.
- **`invalid_grant`**: the key or service account email is wrong, or the server clock
  is far off.
- **One person shows "Calendar unavailable"**: their work email isn't a Workspace
  account, or their account is suspended.
- **"No Workspace email on file"**: their employee record has no work email on the
  Workspace domain. Fix it on the Employees tab.

Calendars refresh every 5 minutes while the tab is open; the refresh button next to
"Synced" fetches now. The server shares one fetch per week range for a minute, so many
people opening the tab at once doesn't multiply the Google calls.
