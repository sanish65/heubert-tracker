import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { mailFrom } from "@/lib/mailer";

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

function formatDay(day) {
  const parsed = new Date(String(day).split("T")[0] + "T00:00:00");
  if (Number.isNaN(parsed.getTime())) return String(day);
  return parsed.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// Deliberately flat and factual. This is a note about a penalty going to a colleague,
// not a telling-off.
function buildEmail({ kind, name, day, amount }) {
  const isLate = kind === "late";
  const heading = isLate ? "Late fine recorded" : "Standup fine recorded";
  const detail = isLate
    ? `A late fine of <strong>Rs ${amount}</strong> has been recorded against you for <strong>${day}</strong>.`
    : `A standup fine has been recorded against you for <strong>${day}</strong>.`;
  const plain = detail.replace(/<[^>]*>?/gm, "");

  return {
    subject: `${heading} — ${day}`,
    text: `Hi ${name},\n\n${plain}\n\nYou can see your fines on the Heubert Tracker dashboard. If this looks wrong, reply to this email or raise it with a fine admin.\n\nBest regards,\nThe Heubert Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; letter-spacing: -0.5px;">${heading}</h1>
        </div>
        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; background: #ffffff;">
          <p style="font-size: 16px; line-height: 1.6;">Hi ${name},</p>
          <p style="font-size: 16px; line-height: 1.6;">${detail}</p>
          <p style="font-size: 16px; line-height: 1.6;">You can see your fines on the Heubert Tracker dashboard. If this looks wrong, reply to this email or raise it with a fine admin.</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">Best regards,</p>
            <p style="margin: 4px 0 0; font-weight: 700; color: #4b5563;">The Heubert Team</p>
          </div>
        </div>
      </div>
    `,
  };
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
    if (!process.env.SMTP_HOST) {
      return NextResponse.json({ success: true, skipped: "SMTP is not configured" });
    }

    const { kind, employeeName, date, amount } = await request.json();
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

    const { subject, text, html } = buildEmail({
      kind,
      name: target.name,
      day: formatDay(date),
      amount,
    });

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: mailFrom(),
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
