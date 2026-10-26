import { supabase } from "@/lib/supabase";

// Your Jira tickets from /api/standup-jira, to save with your standup as jira_tickets so the
// meeting shows them. null when they couldn't be read (Jira not set up, down, or slow):
// the standup then saves without touching the tickets it already has.
export async function fetchStandupTickets() {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    if (!token) return null;
    const res = await fetch("/api/standup-jira", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const body = await res.json();
    return Array.isArray(body.tickets) ? body.tickets : null;
  } catch {
    return null;
  }
}
