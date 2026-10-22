import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { getNepalDateStr, getNepalTimeParts, isWorkingDay } from "@/lib/attendanceTime";
import { appUrl, sendEmail } from "@/lib/mailer";
import { attendanceReminderEmail } from "@/lib/emailTemplates";

// Polled every 15 minutes by cron (see vercel.json). Compares the current Nepal time
// against the admin-configured checkin_reminder_time/checkout_reminder_time in
// office_settings, and emails anyone with employees.can_punch_web who has missed that
// punch today. checkin_reminder_sent_at/checkout_reminder_sent_at on the day's
// attendance row dedup this across ticks so only one email goes out per event per day.

function toMinutes(hhmm) {
  const [h, m] = (hhmm || "0:0").split(":").map(Number);
  return h * 60 + m;
}

async function sendReminderEmail({ email, name, kind, date }) {
  const { subject, text, html } = attendanceReminderEmail({ kind, name, date, appUrl: appUrl() });
  await sendEmail({ to: email, subject, text, html });
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

    let checkinRemindersSent = 0;
    let checkoutRemindersSent = 0;

    for (const emp of targets) {
      const record = attendanceByName.get(emp.name);
      const email = emp.work_email || emp.personal_email;
      if (!email) continue;

      if (nowMinutes >= checkinThreshold && !record?.check_in_at && !record?.checkin_reminder_sent_at) {
        await sendReminderEmail({ email, name: emp.name, kind: "checkin", date: todayStr });
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
        await sendReminderEmail({ email, name: emp.name, kind: "checkout", date: todayStr });
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
