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
