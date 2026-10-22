// The tracker's outgoing emails, in the revamp look (Foundations.dc.html): navy ink,
// one surface card, electric blue for the action, orange for people moments, the
// canvas pill colours for status. Pure, no imports, so it runs under `npm test`, and the
// design canvas's Email artboards are rendered from these same functions.
//
// Email clients are not browsers: everything is inline styles on tables, colours are
// solid (the app's translucent pill fills are pre-blended onto the card colour), web
// fonts are a bonus (Apple Mail, iOS) over Arial/Courier fallbacks, and there are no
// SVG icons or emoji, which Gmail and Outlook drop or render unevenly.

export const DEFAULT_APP_URL = "https://tracker.heubert.com";

const C = {
  ink: "#070A12",
  card: "#121828",
  raised: "#182033",
  line: "#222B3D",
  text1: "#EDF1F8",
  text2: "#B6BFCF",
  text3: "#8E98AC",
  primary: "#3D63F0",
  cyan: "#2DD4EF",
  orange: "#FF6A1F",
};

// Pill fill = the app's rgba tint over the card colour, text = the app's pill text.
const TONES = {
  orange: { bg: "#332327", fg: "#FF8340" },
  amber: { bg: "#362F27", fg: "#FCC560" },
  red: { bg: "#361E31", fg: "#FDA4B4" },
  cyan: { bg: "#163244", fg: "#67E3F5" },
  green: { bg: "#153431", fg: "#6EE7A0" },
  blue: { bg: "#1B2550", fg: "#A5B8FF" },
  violet: { bg: "#2A2640", fg: "#C4B5FD" },
};

const F = {
  display: "'Space Grotesk', Arial, Helvetica, sans-serif",
  body: "'IBM Plex Sans', Arial, Helvetica, sans-serif",
  mono: "'JetBrains Mono', 'Courier New', Courier, monospace",
};

export function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function initialsOf(name) {
  const words = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "?";
  return ((words[0][0] || "") + (words.length > 1 ? words[words.length - 1][0] : "")).toUpperCase();
}

export function firstNameOf(name) {
  return String(name || "").trim().split(/\s+/)[0] || "there";
}

// "Wednesday, October 21, 2026" for a YYYY-MM-DD (or ISO) date, read as a calendar day.
export function formatLongDate(day) {
  const str = String(day || "").slice(0, 10);
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return String(day || "");
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatShortDate(day) {
  const str = String(day || "").slice(0, 10);
  const [y, m, d] = str.split("-").map(Number);
  if (!y || !m || !d) return "";
  return new Date(Date.UTC(y, m - 1, d))
    .toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" })
    .replace(",", " ·");
}

function pill(label, tone) {
  const t = TONES[tone] || TONES.blue;
  return `<span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${t.bg};color:${t.fg};font-family:${F.body};font-size:12px;font-weight:600;line-height:16px;">${escapeHtml(label)}</span>`;
}

function avatarDisc(name, size = 72) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td width="${size}" height="${size}" align="center" valign="middle" bgcolor="${C.orange}" style="width:${size}px;height:${size}px;border-radius:50%;background:${C.orange};color:#0A0E17;font-family:${F.display};font-size:${Math.round(size * 0.36)}px;font-weight:700;box-shadow:0 0 0 4px ${C.card},0 0 0 6px ${C.orange};">${escapeHtml(initialsOf(name))}</td></tr></table>`;
}

function statTile(value, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center"><tr><td align="center" bgcolor="${C.raised}" style="padding:18px 32px;border:1px solid ${C.line};border-radius:14px;background:${C.raised};"><div style="font-family:${F.display};font-size:44px;line-height:48px;font-weight:700;letter-spacing:-1px;color:${C.text1};">${escapeHtml(value)}</div><div style="margin-top:4px;font-family:${F.mono};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.text3};">${escapeHtml(label)}</div></td></tr></table>`;
}

// A summary box of label/value rows; a value may be pre-built HTML (a pill) via `html`.
function detailRows(rows) {
  const cells = rows
    .map(
      (r, i) =>
        `<tr><td style="padding:12px 18px;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${F.mono};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.text3};white-space:nowrap;">${escapeHtml(r.label)}</td><td align="right" style="padding:12px 18px;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${r.big ? F.display : F.body};font-size:${r.big ? "24px" : "14px"};font-weight:${r.big ? 700 : 600};color:${C.text1};">${r.html || escapeHtml(r.value)}</td></tr>`
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.raised}" style="border:1px solid ${C.line};border-radius:14px;background:${C.raised};">${cells}</table>`;
}

function button(label, url) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="${C.primary}" style="border-radius:10px;background:${C.primary};"><a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 22px;font-family:${F.body};font-size:14px;font-weight:600;color:#FFFFFF;text-decoration:none;border-radius:10px;">${escapeHtml(label)}</a></td></tr></table>`;
}

// The frame every email shares. `hero` and `details` are pre-built HTML; `paragraphs`
// are plain text, escaped here.
export function renderLayout({ preheader = "", tone = "blue", tag, dateLabel = "", hero = "", title, paragraphs = [], details = "", cta = null, signoff = "", logoUrl, appUrl = DEFAULT_APP_URL }) {
  const logo = logoUrl || `${appUrl.replace(/\/$/, "")}/logo.png`;
  const host = appUrl.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 14px;font-family:${F.body};font-size:15px;line-height:24px;color:${C.text2};">${escapeHtml(p)}</p>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${escapeHtml(title)}</title>
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;600&amp;family=JetBrains+Mono:wght@500&amp;family=Space+Grotesk:wght@700&amp;display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${C.ink};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${C.ink};">${escapeHtml(preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${C.ink}" style="background:${C.ink};background-image:radial-gradient(520px 320px at 10% 0%, rgba(61,99,240,0.30), transparent 70%),radial-gradient(420px 300px at 95% 10%, rgba(124,92,224,0.22), transparent 70%);">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;">
<tr><td style="padding:0 4px 18px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td valign="middle" width="40"><img src="${escapeHtml(logo)}" width="32" height="32" alt="" style="display:block;width:32px;height:32px;border-radius:8px;border:0;"></td>
<td valign="middle" style="font-family:${F.display};font-size:16px;font-weight:700;color:${C.text1};">Heubert Tracker</td>
<td valign="middle" align="right" style="font-family:${F.mono};font-size:12px;letter-spacing:1px;text-transform:uppercase;color:${C.text3};">${escapeHtml(dateLabel)}</td>
</tr></table>
</td></tr>
<tr><td bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:20px;padding:36px 36px 30px;">
<div style="margin:0 0 18px;">${pill(tag, tone)}</div>
${hero ? `<div style="margin:6px 0 24px;">${hero}</div>` : ""}
<h1 style="margin:0 0 16px;font-family:${F.display};font-size:28px;line-height:34px;font-weight:700;letter-spacing:-0.5px;color:${C.text1};">${escapeHtml(title)}</h1>
${body}
${details ? `<div style="margin:22px 0 8px;">${details}</div>` : ""}
${cta ? `<div style="margin:24px 0 4px;">${button(cta.label, cta.url)}</div>` : ""}
<div style="margin-top:28px;padding-top:20px;border-top:1px solid ${C.line};">
${signoff ? `<p style="margin:0 0 4px;font-family:${F.body};font-size:14px;color:${C.text2};">${escapeHtml(signoff)}</p>` : ""}
<p style="margin:0;font-family:${F.display};font-size:15px;font-weight:700;color:${C.text1};">The Heubert Team</p>
</div>
</td></tr>
<tr><td align="center" style="padding:18px 8px 0;font-family:${F.body};font-size:12px;line-height:18px;color:${C.text3};">
Sent by Heubert Tracker · <a href="${escapeHtml(appUrl)}" style="color:#8EA6FF;text-decoration:none;">${escapeHtml(host)}</a><br>Questions? Reply to this email.
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function plainText({ name, lines, signoff, appUrl }) {
  return [`Hi ${firstNameOf(name)},`, "", ...lines, "", signoff, "The Heubert Team", "", appUrl].filter((l) => l !== undefined).join("\n");
}

// ── Celebrations ────────────────────────────────────────────────────────────

export function birthdayEmail({ name, date, appUrl = DEFAULT_APP_URL, logoUrl }) {
  const first = firstNameOf(name);
  const title = `Happy birthday, ${first}!`;
  const paragraphs = [
    `Wishing you a very happy birthday from the whole team. We hope your day is full of joy, laughter and plenty of celebration.`,
  ];
  const signoff = "Keep shining, and have a fantastic year ahead.";
  return {
    subject: title,
    text: plainText({ name, lines: paragraphs, signoff, appUrl }),
    html: renderLayout({
      preheader: `The whole team is wishing you a happy birthday, ${first}.`,
      tone: "orange",
      tag: "Birthday",
      dateLabel: formatShortDate(date),
      hero: avatarDisc(name),
      title,
      paragraphs,
      signoff,
      appUrl,
      logoUrl,
    }),
  };
}

export function anniversaryEmail({ name, years, date, appUrl = DEFAULT_APP_URL, logoUrl }) {
  const first = firstNameOf(name);
  const n = Math.max(Number(years) || 1, 1);
  const yearsLabel = `${n} year${n === 1 ? "" : "s"}`;
  const title = `Happy ${n}-year work anniversary, ${first}!`;
  const paragraphs = [
    `Congratulations on ${yearsLabel} with Heubert. Thank you for your dedication and hard work. It makes a real difference to all of us.`,
  ];
  const signoff = "Here's to many more great years together.";
  return {
    subject: title,
    text: plainText({ name, lines: paragraphs, signoff, appUrl }),
    html: renderLayout({
      preheader: `${yearsLabel} at Heubert. Congratulations, ${first}.`,
      tone: "orange",
      tag: "Work anniversary",
      dateLabel: formatShortDate(date),
      hero: statTile(yearsLabel, "at Heubert"),
      title,
      paragraphs,
      signoff,
      appUrl,
      logoUrl,
    }),
  };
}

// ── Fines ───────────────────────────────────────────────────────────────────

// Deliberately flat and factual: a note about a penalty going to a colleague, not a
// telling-off.
export function fineEmail({ kind, name, date, amount, status, recordedBy, appUrl = DEFAULT_APP_URL, logoUrl }) {
  const isLate = kind === "late";
  const day = formatLongDate(date);
  const heading = isLate ? "Late fine recorded" : "Standup fine recorded";
  const title = isLate ? "A late fine was recorded" : "A standup fine was recorded";
  const intro = isLate
    ? `A late fine of Rs ${amount} has been recorded against you for ${day}.`
    : `A standup fine has been recorded against you for ${day}, for a missed standup form.`;
  const paragraphs = [intro, "You can see all your fines on the tracker. If this looks wrong, reply to this email or raise it with a fine admin."];
  const rows = [
    ...(isLate && amount != null ? [{ label: "Amount", value: `Rs ${amount}`, big: true }] : []),
    { label: "Date", value: day },
    // Shown only when the caller knows it: a fine can be recorded as already paid.
    ...(status === "paid" ? [{ label: "Status", html: pill("Paid", "green") }] : status === "unpaid" ? [{ label: "Status", html: pill("Unpaid", "amber") }] : []),
    ...(recordedBy ? [{ label: "Recorded by", value: recordedBy }] : []),
  ];
  return {
    subject: `${heading} — ${day}`,
    text: plainText({ name, lines: [intro, "", paragraphs[1]], signoff: "Best regards,", appUrl }),
    html: renderLayout({
      preheader: intro,
      tone: isLate ? "amber" : "red",
      tag: isLate ? "Late fine" : "Standup fine",
      dateLabel: formatShortDate(date),
      title,
      paragraphs,
      details: detailRows(rows),
      cta: { label: "View my fines", url: appUrl },
      signoff: "Best regards,",
      appUrl,
      logoUrl,
    }),
  };
}

// ── Attendance ──────────────────────────────────────────────────────────────

export function attendanceReminderEmail({ kind, name, date, appUrl = DEFAULT_APP_URL, logoUrl }) {
  const isCheckin = kind === "checkin";
  const title = isCheckin ? "You haven't punched in yet" : "You haven't punched out yet";
  const message = isCheckin
    ? "It looks like you haven't punched in yet today. Please punch in on the tracker's Attendance page."
    : "It looks like you haven't punched out yet today. Please punch out on the tracker's Attendance page before you leave.";
  return {
    subject: isCheckin ? "Missed punch-in reminder" : "Missed punch-out reminder",
    text: plainText({ name, lines: [message], signoff: "Best regards,", appUrl }),
    html: renderLayout({
      preheader: message,
      tone: "cyan",
      tag: isCheckin ? "Punch-in reminder" : "Punch-out reminder",
      dateLabel: formatShortDate(date),
      title,
      paragraphs: [message],
      cta: { label: isCheckin ? "Punch in" : "Punch out", url: appUrl },
      signoff: "Best regards,",
      appUrl,
      logoUrl,
    }),
  };
}

// ── Tasks ───────────────────────────────────────────────────────────────────

// An issue was assigned to you, or someone @mentioned you in a comment. `issueUrl`
// opens the issue (…/#issue=HTT-12).
export function taskNotificationEmail({ kind, name, actorName, issueKey, issueTitle, excerpt, issueUrl, date, appUrl = DEFAULT_APP_URL, logoUrl }) {
  const who = actorName || "Someone";
  const mentioned = kind === "mentioned";
  const title = mentioned ? `${who} mentioned you on ${issueKey}` : `${who} assigned ${issueKey} to you`;
  const lead = mentioned
    ? `${who} mentioned you in a comment on ${issueKey} · ${issueTitle}.`
    : `${who} assigned ${issueKey} · ${issueTitle} to you.`;
  const rows = [
    { label: "Issue", value: issueKey },
    { label: "Summary", value: issueTitle },
  ];
  const quote = mentioned && excerpt
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:12px 16px;border-left:3px solid ${C.primary};background:${C.raised};border-radius:0 10px 10px 0;font-family:${F.body};font-size:14px;line-height:22px;color:${C.text1};">${escapeHtml(excerpt)}</td></tr></table>`
    : "";
  return {
    subject: title,
    text: plainText({ name, lines: [lead, ...(mentioned && excerpt ? ["", `"${excerpt}"`] : []), "", issueUrl], signoff: "Best regards,", appUrl }),
    html: renderLayout({
      preheader: lead,
      tone: mentioned ? "violet" : "blue",
      tag: mentioned ? "Mention" : "Assigned to you",
      dateLabel: formatShortDate(date),
      title,
      paragraphs: [lead],
      details: quote ? `${quote}<div style="height:12px;line-height:12px;">&nbsp;</div>${detailRows(rows)}` : detailRows(rows),
      cta: { label: "Open issue", url: issueUrl },
      signoff: "Best regards,",
      appUrl,
      logoUrl,
    }),
  };
}
