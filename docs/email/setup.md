# Sending the tracker's emails through Gmail (no app password)

Birthday and anniversary wishes, fine notices and punch reminders are sent by
`sendEmail()` in `src/lib/mailer.js`. It has two ways to send:

1. **Gmail through a service account** (recommended). A Google Cloud service account
   that a Workspace admin allows to send mail as one mailbox. No password is involved,
   so it keeps working when that person's Google password, 2-step settings or app
   passwords change.
2. **SMTP with an app password** (today's setup: `SMTP_HOST`, `SMTP_USER`,
   `SMTP_PASS`, …). Google revokes every app password whenever the account's password
   changes, which is why it keeps breaking.

The tracker uses Gmail as soon as the three `GMAIL_*` variables below are set, and
falls back to SMTP while they aren't. Nothing else needs changing.

The email designs are in the design canvas ("Emails" row) and in
`src/lib/emailTemplates.js`.

## 1. Create a separate service account (Google Cloud console)

Use a new one, not the calendar's and not `firebase-adminsdk`. "Send mail as" is a
powerful permission, so it should belong to an account that does nothing else and can
be switched off on its own.

1. [console.cloud.google.com](https://console.cloud.google.com), project
   `heubert-tracker` → **APIs & Services → Library** → enable **Gmail API**.
2. **Credentials → Create credentials → Service account**, name
   `heubert-tracker-mailer`, no roles → **Done**.
3. Open it → **Details**: copy the **Unique ID**. **Keys → Add key → JSON**: a key file
   downloads. Keep it private.

## 2. Allow it to send (Google Admin console, Workspace super admin)

**Security → Access and data control → API controls → Manage domain-wide delegation →
Add new**:

- **Client ID**: the mailer's Unique ID
- **OAuth scopes**: `https://www.googleapis.com/auth/gmail.send`

This can be done in the same visit as the calendar's delegation
(`docs/team-calendar/setup.md`): it's a second "Add new" with its own client ID and
scope.

## 3. Give the tracker the key

In `.env.local` and in Vercel (Production and Preview):

| Variable | Value |
| --- | --- |
| `GMAIL_SA_EMAIL` | `client_email` from the mailer's JSON key |
| `GMAIL_SA_KEY` | `private_key` from the JSON key (one line, `\n`'s kept; in `.env.local` wrap it in double quotes) |
| `GMAIL_SENDER` | The mailbox the emails are sent as, e.g. `sanish@heubert.com`. It must be a real Workspace user. |
| `GMAIL_FROM` | Optional. The From header, e.g. `Heubert Tracker <noreply@heubert.com>`. Any address other than `GMAIL_SENDER` must already be one of that mailbox's Gmail "Send mail as" aliases, or Gmail replaces it. Defaults to `"Heubert Tracker" <GMAIL_SENDER>`. |

Replies go to the From address. Restart `npm run dev` or redeploy.

Once email works through Gmail, the `SMTP_*` variables can be deleted, and the app
password can be revoked in the sender's Google Account → Security → App passwords.

## 4. Check it

Send a birthday wish to yourself from the Dashboard. If it fails, the server log names
the reason:

- `unauthorized_client`: the delegation in step 2 is missing, has the wrong client ID,
  or isn't active yet (allow a few minutes).
- `Precondition check failed` / `failedPrecondition`: `GMAIL_SENDER` isn't a
  Workspace user with Gmail turned on.
- `invalid_grant`: the key or service account email is wrong.

## For the super admin: both delegations at once

> admin.google.com → Security → Access and data control → API controls → Manage
> domain-wide delegation → Add new, twice:
>
> 1. Client ID `<calendar account's Unique ID>`, scope
>    `https://www.googleapis.com/auth/calendar.readonly` (read-only team calendar)
> 2. Client ID `<mailer account's Unique ID>`, scope
>    `https://www.googleapis.com/auth/gmail.send` (the tracker's emails)
