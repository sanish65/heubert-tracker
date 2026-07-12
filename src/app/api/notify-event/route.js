import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { sendPushNotifications } from "@/lib/pushNotifications";

export async function POST(req) {
  try {
    const { title, date, excludeEmployeeName } = await req.json();
    if (!title) {
      return NextResponse.json({ success: false, error: "Missing event title" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: employees } = await supabase.from("employees").select("name").eq("status", "active");
    const activeNames = new Set((employees || []).map((e) => e.name));

    const { data: tokenRows } = await supabase.from("push_tokens").select("employee_name, expo_push_token");
    const tokens = (tokenRows || [])
      .filter((r) => activeNames.has(r.employee_name) && r.employee_name !== excludeEmployeeName)
      .map((r) => r.expo_push_token);

    const { sent } = await sendPushNotifications(tokens, {
      title: "📅 New Event",
      body: date ? `${title} — ${date}` : title,
      data: { type: "event" },
    });

    return NextResponse.json({ success: true, sent });
  } catch (err) {
    console.error("notify-event error:", err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
