import { supabase } from "@/lib/supabase";

/**
 * Tells /api/notify-fine to email the person a fine was just recorded against.
 *
 * Fire-and-forget on purpose: the fine is already in the database by the time this
 * runs, so a slow or dead SMTP host must not hold up the UI or make the add look like
 * it failed. Nothing here throws.
 */
export function notifyFineAdded({ kind, employeeName, date, amount }) {
  (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/notify-fine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ kind, employeeName, date, amount }),
      });

      if (!res.ok) {
        console.warn(`Fine notification for ${employeeName} was not sent (HTTP ${res.status}).`);
      }
    } catch (err) {
      console.warn("Fine notification could not be sent:", err?.message || err);
    }
  })();
}
