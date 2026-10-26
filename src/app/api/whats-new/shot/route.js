import { readFile } from "node:fs/promises";
import path from "node:path";
import { verifyShot } from "@/lib/whatsNewShots";

// GET /api/whats-new/shot?p=<web|mobile>&id=<feature>&exp=…&sig=…
//
// One What's new screenshot, for a link /api/whats-new signed and that hasn't expired.

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const link = { platform: q.get("p"), id: q.get("id"), exp: q.get("exp"), sig: q.get("sig") };
  if (!verifyShot(process.env.SUPABASE_SERVICE_ROLE_KEY, link)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const file = await readFile(path.join(process.cwd(), "whats-new", "shots", link.platform, `${link.id}.webp`));
    return new Response(file, {
      headers: { "Content-Type": "image/webp", "Cache-Control": "private, max-age=3600" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
