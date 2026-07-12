import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPushNotifications } from "@/lib/pushNotifications";

// Meant to be hit once a day by a cron (see vercel.json). Finds any active
// employee whose birthday or work anniversary is today (Asia/Kathmandu) and
// pushes a heads-up to every other active employee's registered device.
function getNepalDateParts(date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kathmandu",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return {
    year: Number(parts.find((p) => p.type === "year").value),
    month: Number(parts.find((p) => p.type === "month").value),
    day: Number(parts.find((p) => p.type === "day").value),
  };
}

export async function GET(req) {
  const auth = req.headers.get("authorization") || "";
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseAdmin();

    const { data: employees } = await supabase
      .from("employees")
      .select("name, dob, joined_date")
      .eq("status", "active");

    const { data: tokenRows } = await supabase.from("push_tokens").select("employee_name, expo_push_token");
    const tokensByName = {};
    (tokenRows || []).forEach((r) => {
      (tokensByName[r.employee_name] ||= []).push(r.expo_push_token);
    });

    const allActiveNames = (employees || []).map((e) => e.name);
    const today = getNepalDateParts(new Date());

    let totalSent = 0;
    for (const emp of employees || []) {
      const celebrations = [];

      if (emp.dob) {
        const dob = new Date(emp.dob);
        if (dob.getMonth() + 1 === today.month && dob.getDate() === today.day) {
          celebrations.push({ title: "🎂 Birthday", body: `It's ${emp.name}'s birthday today!`, type: "birthday" });
        }
      }

      if (emp.joined_date) {
        const joined = new Date(emp.joined_date);
        const years = today.year - joined.getFullYear();
        if (years > 0 && joined.getMonth() + 1 === today.month && joined.getDate() === today.day) {
          celebrations.push({
            title: "🏆 Work Anniversary",
            body: `${emp.name} is celebrating ${years} year${years > 1 ? "s" : ""} at Heubert today!`,
            type: "anniversary",
          });
        }
      }

      if (celebrations.length === 0) continue;

      const recipientTokens = allActiveNames
        .filter((name) => name !== emp.name)
        .flatMap((name) => tokensByName[name] || []);

      for (const c of celebrations) {
        const { sent } = await sendPushNotifications(recipientTokens, {
          title: c.title,
          body: c.body,
          data: { type: c.type, employeeName: emp.name },
        });
        totalSent += sent;
      }
    }

    return NextResponse.json({ success: true, totalSent });
  } catch (err) {
    console.error("notify-celebrations error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
