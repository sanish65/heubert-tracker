import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { shotUrl } from "@/lib/whatsNewShots";

// GET /api/whats-new
//
// The What's new tab's content, for the web modal and the mobile screen: every feature with
// links to its web and mobile screenshots, and the release notes, newest first. Both come from
// whats-new/content.json and whats-new/shots/ (captured by `npm run whats-new:shots`), shipped
// with the deploy, so updating them is part of shipping, not a database write. Screenshot
// links are signed and expire (lib/whatsNewShots.js); only signed-in active employees get them.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const DIR = path.join(process.cwd(), "whats-new");

const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

async function callerIsActive(request) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return false;
  const { data, error } = await supabase.auth.getUser(token);
  const email = data?.user?.email;
  if (error || !email) return false;
  const pattern = escapeLike(email);
  const [work, personal] = await Promise.all([
    supabase.from("employees").select("status").ilike("work_email", pattern),
    supabase.from("employees").select("status").ilike("personal_email", pattern),
  ]);
  return [...(work.data || []), ...(personal.data || [])].some((e) => e.status === "active");
}

export async function GET(request) {
  if (!(await callerIsActive(request))) {
    return NextResponse.json({ error: "Only signed-in employees can do this." }, { status: 401 });
  }

  const content = JSON.parse(readFileSync(path.join(DIR, "content.json"), "utf8"));
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const now = Date.now();
  // A screen gets a link only when the app has it and its screenshot has been captured.
  const shot = (platform, feature) =>
    feature[platform] && existsSync(path.join(DIR, "shots", platform, `${feature.id}.webp`))
      ? shotUrl(secret, platform, feature.id, now)
      : null;

  const features = (content.features || []).map((f) => ({
    id: f.id,
    title: f.title,
    summary: f.summary,
    onWeb: Boolean(f.web),
    onMobile: Boolean(f.mobile),
    web: shot("web", f),
    mobile: shot("mobile", f),
  }));
  const releases = [...(content.releases || [])].sort((a, b) => String(b.date).localeCompare(String(a.date)));

  return NextResponse.json({ features, releases }, { headers: { "Cache-Control": "private, no-store" } });
}
