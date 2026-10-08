import { supabase } from "@/lib/supabase";

// POST to /api/retro with the signed-in user's token when there is one. The route reads
// admin rights from that token only; guests on the share link simply send none and are
// judged by name like everywhere else on the board.
export async function postRetro(body) {
  let token = null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    token = session?.access_token || null;
  } catch (_) {}

  const res = await fetch("/api/retro", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || `Request failed (${res.status})`);
  return json;
}
