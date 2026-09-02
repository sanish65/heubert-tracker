import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getNepalDateStr, getNepalTimeParts, isWorkingDay } from "@/lib/attendanceTime";

// Polled every 15 minutes by cron (see vercel.json). Compares the current Nepal time
// against the admin-configured checkin_reminder_time/checkout_reminder_time in
// office_settings, and emails anyone with employees.can_punch_web who has missed that
// punch today. checkin_reminder_sent_at/checkout_reminder_sent_at on the day's
// attendance row dedup this across ticks so only one email goes out per event per day.

function toMinutes(hhmm) {
  const [h, m] = (hhmm || "0:0").split(":").map(Number);
  return h * 60 + m;
}

async function sendReminderEmail(transporter, { email, name, kind }) {
  const isCheckin = kind === "checkin";
  const subject = isCheckin ? "Missed Punch-In Reminder" : "Missed Punch-Out Reminder";
  const message = isCheckin
    ? "It looks like you haven't punched in yet today."
    : "It looks like you haven't punched out yet today.";

  await transporter.sendMail({
    from: `"Heubert Tracker" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to: email,
    subject,
    text: `Hi ${name},\n\n${message} Please punch ${isCheckin ? "in" : "out"} on the Heubert Tracker attendance page.\n\nBest regards,\nThe Heubert Team`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1f2937;">
        <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 40px 20px; text-align: center; border-radius: 12px 12px 0 0;">
          <h1 style="color: #ffffff; margin: 0; font-size: 26px; letter-spacing: -0.5px;">⏰ ${subject}</h1>
        </div>
        <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px; background: #ffffff;">
          <p style="font-size: 16px; line-height: 1.6;">Hi ${name},</p>
          <p style="font-size: 16px; line-height: 1.6;">${message} Please punch ${isCheckin ? "in" : "out"} on the Heubert Tracker attendance page.</p>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #f3f4f6;">
            <p style="margin: 0; color: #6b7280; font-size: 14px;">Best regards,</p>
            <p style="margin: 4px 0 0; font-weight: 700; color: #4b5563;">The Heubert Team</p>
          </div>
        </div>
      </div>
    `,
  });
}

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const now = new Date();
    const todayStr = getNepalDateStr(now);

    const { data: holidays } = await supabase.from("public_holidays").select("date");
    if (!isWorkingDay(todayStr, holidays)) {
      return NextResponse.json({ success: true, skipped: "non-working day" });
    }

    const { data: officeSettings } = await supabase
      .from("office_settings")
      .select("checkin_reminder_time, checkout_reminder_time")
      .eq("id", 1)
      .single();
    if (!officeSettings) {
      return NextResponse.json({ success: true, skipped: "office_settings not configured" });
    }

    const { data: targets } = await supabase
      .from("employees")
      .select("name, work_email, personal_email")
      .eq("status", "active")
      .eq("can_punch_web", true);

    if (!targets || targets.length === 0) {
      return NextResponse.json({ success: true, skipped: "no employees have web punch access" });
    }

    const names = targets.map((e) => e.name);
    const { data: attendanceRows } = await supabase
      .from("attendance")
      .select("*")
      .eq("date", todayStr)
      .in("employee_name", names);
    const attendanceByName = new Map((attendanceRows || []).map((a) => [a.employee_name, a]));

    const { hours, minutes } = getNepalTimeParts(now);
    const nowMinutes = hours * 60 + minutes;
    const checkinThreshold = toMinutes(officeSettings.checkin_reminder_time);
    const checkoutThreshold = toMinutes(officeSettings.checkout_reminder_time);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: process.env.SMTP_SECURE === "true",
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    let checkinRemindersSent = 0;
    let checkoutRemindersSent = 0;

    for (const emp of targets) {
      const record = attendanceByName.get(emp.name);
      const email = emp.work_email || emp.personal_email;
      if (!email) continue;

      if (nowMinutes >= checkinThreshold && !record?.check_in_at && !record?.checkin_reminder_sent_at) {
        await sendReminderEmail(transporter, { email, name: emp.name, kind: "checkin" });
        await supabase
          .from("attendance")
          .upsert(
            { employee_name: emp.name, date: todayStr, checkin_reminder_sent_at: now.toISOString() },
            { onConflict: "employee_name,date" }
          );
        checkinRemindersSent++;
      }

      if (
        nowMinutes >= checkoutThreshold &&
        record?.check_in_at &&
        !record?.check_out_at &&
        !record?.checkout_reminder_sent_at
      ) {
        await sendReminderEmail(transporter, { email, name: emp.name, kind: "checkout" });
        await supabase
          .from("attendance")
          .upsert(
            { employee_name: emp.name, date: todayStr, checkout_reminder_sent_at: now.toISOString() },
            { onConflict: "employee_name,date" }
          );
        checkoutRemindersSent++;
      }
    }

    return NextResponse.json({ success: true, checkinRemindersSent, checkoutRemindersSent });
  } catch (err) {
    console.error("notify-attendance-reminders error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
