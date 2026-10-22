import nodemailer from "nodemailer";
import MailComposer from "nodemailer/lib/mail-composer/index.js";
import { DEFAULT_APP_URL } from "@/lib/emailTemplates";
import { GoogleError, readPrivateKey, serviceAccountToken } from "@/lib/googleServiceAuth";

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.send";
const GMAIL_SEND_URL = "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

// Builds the From header for outgoing mail.
//
// SMTP_FROM may be configured either as a bare address (noreply@heubert.com) or as a
// full header value (Heubert Tracker <noreply@heubert.com>). Wrapping the second form
// in another display name yields `"Heubert Tracker" <Heubert Tracker <noreply@…>>`,
// which parses to a sender named `Heubert Tracker>` — so only the bare form gets wrapped.
export function mailFrom(displayName = "Heubert Tracker") {
  const configured = (process.env.SMTP_FROM || process.env.SMTP_USER || "").trim();
  if (!configured) return "";
  if (configured.includes("<")) return configured;
  return `"${displayName}" <${configured}>`;
}

// One SMTP transport for every email route (birthday wishes, fines, reminders), built
// from the SMTP_* env vars. Server-only.
export function createMailTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || "587"),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

// Where email buttons and the footer link point.
export function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || DEFAULT_APP_URL).replace(/\/$/, "");
}

// Gmail through a service account with domain-wide delegation (docs/email/setup.md).
// No password is involved, so it keeps working when the sender's Google password or
// app passwords change. null until all three env vars are set.
//
// The service account may in principle send as anyone in the domain; this code only
// ever acts as GMAIL_SENDER.
export function gmailConfig() {
  const email = process.env.GMAIL_SA_EMAIL;
  const key = process.env.GMAIL_SA_KEY;
  const sender = (process.env.GMAIL_SENDER || "").trim().toLowerCase();
  if (!email || !key || !sender) return null;
  return {
    email,
    key: readPrivateKey(key),
    sender,
    // A From other than the sender's own address must be one of its Gmail "Send mail
    // as" aliases, or Gmail rewrites it.
    from: (process.env.GMAIL_FROM || "").trim() || `"Heubert Tracker" <${sender}>`,
  };
}

export function mailConfigured() {
  return Boolean(gmailConfig() || process.env.SMTP_HOST);
}

// Sends one email: through Gmail when gmailConfig() is set, otherwise through SMTP.
// Throws when the send fails; callers decide whether that matters.
export async function sendEmail({ to, subject, text, html }) {
  const gmail = gmailConfig();
  if (!gmail) {
    await createMailTransport().sendMail({ from: mailFrom(), to, subject, text, html });
    return { via: "smtp" };
  }

  const raw = await new MailComposer({ from: gmail.from, to, subject, text, html }).compile().build();
  const token = await serviceAccountToken({
    clientEmail: gmail.email,
    privateKey: gmail.key,
    subject: gmail.sender,
    scope: GMAIL_SCOPE,
  });
  const res = await fetch(GMAIL_SEND_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ raw: Buffer.from(raw).toString("base64url") }),
    cache: "no-store",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new GoogleError(json.error?.message || `Gmail send failed (${res.status})`, res.status, json.error?.status);
  }
  return { via: "gmail" };
}
