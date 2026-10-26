import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// GET /api/standup-jira
//
// The caller's Jira tickets, for the standup form to save with their update so the meeting
// can show them (standup_responses.jira_tickets, read by the meeting view). Tickets are the
// ones assigned to the caller that are neither done (any status in Jira's Done category)
// nor in Backlog. Each is { key, summary, status, url }.
//
// Tickets are matched to the caller by their work, personal and sign-in emails.
// Needs JIRA_BASE_URL (https://<site>.atlassian.net), JIRA_EMAIL and JIRA_API_TOKEN; without
// them it answers 503 and the form saves without tickets. Only signed-in active employees
// may ask, and only for themselves.

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

const MAX_TICKETS = 30;
const JIRA_TIMEOUT_MS = 8000;

function fail(message, status) {
  return NextResponse.json({ error: message }, { status });
}

const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

function jiraConfig() {
  const base = (process.env.JIRA_BASE_URL || "").trim().replace(/\/+$/, "");
  const email = (process.env.JIRA_EMAIL || "").trim();
  const token = (process.env.JIRA_API_TOKEN || "").trim();
  if (!base || !email || !token) return null;
  return { base, auth: `Basic ${Buffer.from(`${email}:${token}`).toString("base64")}` };
}

// The caller's emails (work, personal, sign-in), when they are an active employee.
async function callerEmails(request) {
  const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const { data, error } = await supabase.auth.getUser(token);
  const email = data?.user?.email;
  if (error || !email) return null;
  const pattern = escapeLike(email);
  const [work, personal] = await Promise.all([
    supabase.from("employees").select("status, work_email, personal_email").ilike("work_email", pattern),
    supabase.from("employees").select("status, work_email, personal_email").ilike("personal_email", pattern),
  ]);
  const emp = [...(work.data || []), ...(personal.data || [])].find((e) => e.status === "active");
  if (!emp) return null;
  const emails = [emp.work_email, emp.personal_email, email].map((e) => e?.trim().toLowerCase()).filter(Boolean);
  return [...new Set(emails)];
}

async function jira(config, path, init = {}) {
  const res = await fetch(`${config.base}${path}`, {
    ...init,
    headers: { Authorization: config.auth, Accept: "application/json", "Content-Type": "application/json" },
    signal: AbortSignal.timeout(JIRA_TIMEOUT_MS),
    cache: "no-store",
  });
  if (!res.ok) {
    const err = new Error(`Jira ${path.split("?")[0]} answered ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res.json();
}

// A JQL string literal; employee emails never hold these, but the query must not break if one does.
const jqlString = (value) => `"${value.replace(/["\\]/g, "")}"`;

export async function GET(request) {
  const emails = await callerEmails(request);
  if (!emails) return fail("Only signed-in employees can do this.", 401);

  const config = jiraConfig();
  if (!config) return fail("Jira isn't set up on the server.", 503);

  try {
    // Jira's user search hides emails from a token without the Browse users permission, but
    // JQL still matches an assignee by email, and skips emails that are nobody's.
    const result = await jira(config, "/rest/api/3/search/jql", {
      method: "POST",
      body: JSON.stringify({
        jql: `assignee in (${emails.map(jqlString).join(", ")}) AND statusCategory != Done ORDER BY updated DESC`,
        fields: ["summary", "status"],
        maxResults: MAX_TICKETS,
      }),
    });
    // Backlog is filtered here, not in the JQL: a status name JQL doesn't know is an error.
    const tickets = (result.issues || [])
      .filter((issue) => (issue.fields?.status?.name || "").trim().toLowerCase() !== "backlog")
      .map((issue) => ({
        key: issue.key,
        summary: issue.fields?.summary || "",
        status: issue.fields?.status?.name || null,
        url: `${config.base}/browse/${issue.key}`,
      }));
    return NextResponse.json({ tickets });
  } catch (err) {
    console.error("standup-jira:", err.message);
    return fail("Couldn't reach Jira.", 502);
  }
}
