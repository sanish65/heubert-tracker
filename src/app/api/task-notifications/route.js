import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabaseAdmin";
import { appUrl, mailConfigured, sendEmail } from "@/lib/mailer";
import { taskNotificationEmail } from "@/lib/emailTemplates";
import { issueKey } from "@/lib/taskBoard";
import { sendPushNotifications } from "@/lib/pushNotifications";

// POST /api/task-notifications
//
// Emails the assignment and @mention notifications the database has just written
// (task_notifications, from the triggers in 20261021170648_jira_more.sql), and pushes them
// to the person's phone when the mobile app has registered one (push_tokens). The web and
// mobile apps call it, fire-and-forget, after they assign an issue or post a comment.
//
// It sends nothing the caller chose: it only drains rows that triggers recorded and no
// email has gone out for yet, so any signed-in employee may call it. Rows are claimed
// (emailed_at set) before sending, so two calls at once can't send the same email twice;
// emailed_at means "sent out", by email, push or both.

// Set TASK_EMAIL_NOTIFICATIONS=false to mute the emails without a code change; pushes
// still go to phones.
const MUTED = process.env.TASK_EMAIL_NOTIFICATIONS === "false";
const FRESH_MINUTES = 15;
const BATCH = 25;
// A bulk reassignment can write many rows at once; drain several batches per call.
const MAX_BATCHES = 8;

const escapeLike = (value) => value.replace(/[\\%_]/g, (c) => `\\${c}`);

async function callerIsActive(request) {
  const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.getUser(token);
  const email = data?.user?.email;
  if (error || !email) return false;
  const admin = getSupabaseAdmin();
  const pattern = escapeLike(email);
  const [work, personal] = await Promise.all([
    admin.from("employees").select("status").ilike("work_email", pattern),
    admin.from("employees").select("status").ilike("personal_email", pattern),
  ]);
  return [...(work.data || []), ...(personal.data || [])].some((e) => e.status === "active");
}

const pushTitle = (kind, actor, key) =>
  kind === "mentioned" ? `${actor || "Someone"} mentioned you on ${key}` : `${actor || "Someone"} assigned ${key} to you`;

// Claims up to BATCH unsent assignment/mention rows, emails them (when `email`) and pushes
// them to the recipient's phones. `claimed` is how many it took, so the caller knows
// whether to go again.
async function drainBatch(supabase, base, email) {
  const since = new Date(Date.now() - FRESH_MINUTES * 60 * 1000).toISOString();
  const { data: pending } = await supabase
    .from("task_notifications")
    .select("id")
    .is("emailed_at", null)
    .in("kind", ["assigned", "mentioned"])
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(BATCH);
  if (!pending?.length) return { claimed: 0, sent: 0 };

  const { data: claimed } = await supabase
    .from("task_notifications")
    .update({ emailed_at: new Date().toISOString() })
    .in("id", pending.map((p) => p.id))
    .is("emailed_at", null)
    .select("id, kind, recipient_id, task_id, actor_name, detail, created_at");
  if (!claimed?.length) return { claimed: 0, sent: 0 };

  const taskIds = [...new Set(claimed.map((n) => n.task_id))];
  const recipientIds = [...new Set(claimed.map((n) => n.recipient_id))];
  const [{ data: tasks }, { data: people }] = await Promise.all([
    supabase.from("tasks").select("id, number, title, project_id").in("id", taskIds),
    supabase.from("employees").select("id, name, status, work_email, personal_email").in("id", recipientIds),
  ]);
  const names = [...new Set((people || []).map((p) => p.name).filter(Boolean))];
  const { data: tokenRows } = names.length
    ? await supabase.from("push_tokens").select("employee_name, expo_push_token").in("employee_name", names)
    : { data: [] };
  const tokensByName = new Map();
  for (const row of tokenRows || []) {
    if (!tokensByName.has(row.employee_name)) tokensByName.set(row.employee_name, []);
    tokensByName.get(row.employee_name).push(row.expo_push_token);
  }
  const projectIds = [...new Set((tasks || []).map((t) => t.project_id))];
  const { data: projects } = await supabase.from("projects").select("id, issue_key").in("id", projectIds);

  const taskById = new Map((tasks || []).map((t) => [t.id, t]));
  const personById = new Map((people || []).map((p) => [p.id, p]));
  const projectById = new Map((projects || []).map((p) => [p.id, p]));

  let sent = 0;
  for (const n of claimed) {
    const task = taskById.get(n.task_id);
    const person = personById.get(n.recipient_id);
    if (!task || !person || person.status !== "active") continue;
    const key = issueKey(projectById.get(task.project_id), task);
    const tokens = tokensByName.get(person.name) || [];
    if (tokens.length) {
      await sendPushNotifications(tokens, {
        title: pushTitle(n.kind, n.actor_name, key),
        body: n.kind === "mentioned" && n.detail ? n.detail : task.title,
        data: { type: "task", issue: key },
      });
    }
    const to = person.work_email || person.personal_email;
    if (!email || !to) continue;
    const mail = taskNotificationEmail({
      kind: n.kind,
      name: person.name,
      actorName: n.actor_name,
      issueKey: key,
      issueTitle: task.title,
      excerpt: n.kind === "mentioned" ? n.detail : null,
      issueUrl: `${base}/#issue=${encodeURIComponent(key)}`,
      date: n.created_at,
      appUrl: base,
    });
    try {
      await sendEmail({ to, subject: mail.subject, text: mail.text, html: mail.html });
      sent += 1;
    } catch (err) {
      // Claimed rows aren't retried: a bell notification exists either way, and a
      // flaky mail host must not turn into duplicate emails.
      console.warn(`Task notification ${n.id} email failed:`, err?.message || err);
    }
  }
  return { claimed: claimed.length, sent };
}

export async function POST(request) {
  if (!(await callerIsActive(request))) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }
  const email = !MUTED && mailConfigured();

  try {
    const supabase = getSupabaseAdmin();
    const base = appUrl();
    let sent = 0;
    for (let batch = 0; batch < MAX_BATCHES; batch += 1) {
      const result = await drainBatch(supabase, base, email);
      sent += result.sent;
      if (!result.claimed) break;
    }
    return NextResponse.json({ success: true, sent });
  } catch (err) {
    console.error("Task notification emails failed:", err);
    return NextResponse.json({ success: false, error: "Couldn't send task notification emails." }, { status: 500 });
  }
}
