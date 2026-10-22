import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { appUrl, mailConfigured, sendEmail } from "@/lib/mailer";
import { fineEmail } from "@/lib/emailTemplates";

// Emails the person a fine was just recorded against. Called from the browser right
// after the row lands, by whichever admin added it.
//
// The caller's identity is taken from their Supabase JWT and their permission is read
// from the employees table — never from the request body — so a logged-in non-admin
// cannot use this to mail the team. The recipient's address is looked up server-side
// from the employee name for the same reason.

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Set FINE_EMAIL_NOTIFICATIONS=false to mute these without a code change.
const NOTIFICATIONS_MUTED = process.env.FINE_EMAIL_NOTIFICATIONS === "false";

async function getCallerEmail(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/, "");
  if (!token) return null;
  const anon = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false } });
  const { data: { user }, error } = await anon.auth.getUser(token);
  if (error || !user) return null;
  return user.email;
}

export async function POST(request) {
  try {
    // Authenticate before anything else, so an anonymous caller learns nothing about
    // how this deployment is configured.
    const callerEmail = await getCallerEmail(request);
    if (!callerEmail) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (NOTIFICATIONS_MUTED) {
      return NextResponse.json({ success: true, skipped: "fine email notifications are muted" });
    }
    if (!mailConfigured()) {
      return NextResponse.json({ success: true, skipped: "email is not configured" });
    }

    const { kind, employeeName, date, amount, status } = await request.json();
    if (kind !== "late" && kind !== "standup") {
      return NextResponse.json({ success: false, error: "Unknown fine kind" }, { status: 400 });
    }
    if (!employeeName || !date) {
      return NextResponse.json({ success: false, error: "employeeName and date are required" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Only someone who can actually record a fine may announce one.
    const { data: caller } = await supabase
      .from("employees")
      .select("name, status, is_admin, is_fine_admin")
      .or(`work_email.ilike.${callerEmail},personal_email.ilike.${callerEmail}`)
      .eq("status", "active")
      .maybeSingle();
    if (!caller || (!caller.is_admin && !caller.is_fine_admin)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const { data: target } = await supabase
      .from("employees")
      .select("name, status, work_email, personal_email")
      .eq("name", employeeName)
      .maybeSingle();
    if (!target || target.status !== "active") {
      return NextResponse.json({ success: true, skipped: "no active employee by that name" });
    }

    const to = target.work_email || target.personal_email;
    if (!to) {
      return NextResponse.json({ success: true, skipped: "employee has no email on file" });
    }

    // The template is deliberately flat and factual: a note about a penalty going to a
    // colleague, not a telling-off (src/lib/emailTemplates.js).
    const { subject, text, html } = fineEmail({
      kind,
      name: target.name,
      date,
      amount,
      status: status === "paid" || status === "unpaid" ? status : null,
      recordedBy: caller.name,
      appUrl: appUrl(),
    });

    await sendEmail({
      to,
      subject,
      text,
      html,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Fine notification error:", error);
    return NextResponse.json({ success: false, error: "Failed to send the fine notification." }, { status: 500 });
  }
}
