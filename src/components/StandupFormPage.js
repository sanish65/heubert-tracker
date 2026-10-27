"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useApp } from "@/context/AppContext";
import Icon from "./Icon";
import Avatar from "./Avatar";
import PageHead from "./PageHead";
import StandupShoutouts from "./StandupShoutouts";
import { formatBs } from "@/lib/nepaliDate";
import { getNepalParts, findSubmissionFor, standupDays } from "@/lib/standupWindow";
import { answerFor, answeredProgress, teamProgress, waitingLabel, recentStandups } from "@/lib/standupProgress";
import { continueList } from "@/lib/standupText";
import { fetchStandupTickets } from "@/lib/standupJira";

// The page itself only needs the date and whether it is past 10:00, so it re-reads the
// clock twice a minute; the seconds tick in NepalClock alone.
const PAGE_TICK_MS = 30000;
// Avatars shown in "Team so far" before the rest fold into "+N".
const STACK_MAX = 8;

const utcDay = (dateStr) => new Date(`${dateStr}T00:00:00Z`);
const fmt = (dateStr, opts) => utcDay(dateStr).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });

// "Wed · Oct 21"
const tabDate = (dateStr) => `${fmt(dateStr, { weekday: "short" })} · ${fmt(dateStr, { month: "short", day: "numeric" })}`;
// "Wednesday, Oct 21"
const longDate = (dateStr) => `${fmt(dateStr, { weekday: "long" })}, ${fmt(dateStr, { month: "short", day: "numeric" })}`;
// "Oct 20"
const shortDate = (dateStr) => fmt(dateStr, { month: "short", day: "numeric" });

const pad = (n) => String(n).padStart(2, "0");

// "6:12 PM", or "Oct 20, 6:12 PM" when it was sent on another day than the standup's own.
function sentAt(respondedAt, standupDate) {
  if (!respondedAt) return "";
  const sent = new Date(respondedAt);
  if (Number.isNaN(sent.getTime())) return "";
  const time = sent.toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit" });
  const sentDate = getNepalParts(sent).dateStr;
  return sentDate === standupDate ? time : `${shortDate(sentDate)}, ${time}`;
}

const firstName = (name) => (name || "").trim().split(/\s+/)[0] || "";

// The live Nepal clock in the heading, ticking on its own.
function NepalClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const p = getNepalParts(now);
  return (
    <div className="standup-clock">
      <span className="standup-clock-time mono">{`${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`}</span>
      <span className="standup-clock-zone mono">Nepal time</span>
    </div>
  );
}

const RECENT_PILL = {
  submitted: { label: "Submitted", cls: "pill-green" },
  missed: { label: "Missed", cls: "pill-red" },
  leave: { label: "On leave", cls: "pill-gray" },
  pending: { label: "Not yet", cls: "pill-gray" },
};

// Daily standup (Standup.dc.html): your update for today or the next working day, the
// shout-outs for that day's meeting, who on the team is in, and your recent days. Your
// update saves to the standup project (AppContext), shout-outs to the main one
// (useShoutouts); the two cards save independently.
export default function StandupFormPage({ head }) {
  const {
    standupQuestions,
    standupSubmissions,
    publicHolidays,
    leaves,
    employees,
    currentEmployee,
    user,
    submitStandupResponse,
    updateStandupResponse,
  } = useApp();
  const [now, setNow] = useState(() => new Date());
  const [picked, setPicked] = useState(null); // a date the user chose, else the default
  const [draft, setDraft] = useState({ key: null, values: {} }); // unsaved answers, per form
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [savedAction, setSavedAction] = useState(null); // "submitted" | "updated" | null
  const savedTimeoutRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), PAGE_TICK_MS);
    return () => clearInterval(t);
  }, []);

  useEffect(() => () => clearTimeout(savedTimeoutRef.current), []);

  const holidayDates = useMemo(
    () => new Set((publicHolidays || []).map((h) => String(h.date).split("T")[0])),
    [publicHolidays]
  );

  // Today (on a working day) and the next working day are both open at any time; the form
  // starts on the default one and the user can switch.
  const { todayStr, days } = useMemo(() => {
    const nepal = getNepalParts(now);
    return { todayStr: nepal.dateStr, days: standupDays(nepal, holidayDates) };
  }, [now, holidayDates]);
  const options = [
    ...(days.today ? [{ date: days.today, label: "Today" }] : []),
    { date: days.next, label: "Next working day" },
  ];
  // A pick that is no longer offered (the day rolled over) falls back to the default.
  const targetDate = picked && (picked === days.today || picked === days.next) ? picked : days.defaultDate;

  const targetSubmission = useMemo(
    () => findSubmissionFor(standupSubmissions, targetDate, currentEmployee, user),
    [standupSubmissions, targetDate, currentEmployee, user]
  );

  const sortedQuestions = useMemo(
    () => [...(standupQuestions || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [standupQuestions]
  );

  // The saved answers for this day (empty when nothing is submitted yet).
  const saved = useMemo(() => {
    const seeded = {};
    sortedQuestions.forEach((q) => { seeded[q.id] = targetSubmission ? answerFor(targetSubmission.answers, q) : ""; });
    return seeded;
  }, [sortedQuestions, targetSubmission]);

  // The draft is keyed on the day and the submission's id (not the row), so saving our
  // own edit, which replaces the row but keeps its id, never stomps on what has been
  // typed since; another day, or a first submission, shows that form's saved answers.
  const formKey = `${targetDate}|${targetSubmission?.id ?? "new"}`;
  const answers = draft.key === formKey ? draft.values : saved;
  const hasText = sortedQuestions.some((q) => (answers[q.id] || "").trim());

  const setAnswer = (id, value) => {
    // Typing pins the day, so the 10:00 switch can't move the form from under you.
    if (picked !== targetDate) setPicked(targetDate);
    setDraft({ key: formKey, values: { ...answers, [id]: value } });
  };

  // Enter on a "* " or "1. " line starts the next bullet; on an empty one it ends the list
  // (src/lib/standupText.js). Shift+Enter is always a plain new line.
  const onAnswerKeyDown = (e, id) => {
    if (e.key !== "Enter" || e.shiftKey || e.altKey || e.ctrlKey || e.metaKey || e.nativeEvent.isComposing) return;
    const el = e.currentTarget;
    if (el.selectionStart !== el.selectionEnd) return;
    const next = continueList(el.value, el.selectionStart);
    if (!next) return;
    e.preventDefault();
    setAnswer(id, next.value);
    requestAnimationFrame(() => el.setSelectionRange(next.caret, next.caret));
  };

  // Empties every box, saved answers included; nothing is saved until you submit again.
  const clearAnswers = () => {
    if (picked !== targetDate) setPicked(targetDate);
    setDraft({ key: formKey, values: {} });
  };

  const progress = answeredProgress(sortedQuestions, answers);
  const allAnswered = progress.total > 0 && progress.answered === progress.total;
  const isEditing = Boolean(targetSubmission);

  const team = useMemo(() => teamProgress(employees, standupSubmissions, targetDate), [employees, standupSubmissions, targetDate]);
  const waitingNames = useMemo(
    () => team.waiting.map((e) => firstName(e.name)).filter(Boolean).sort((a, b) => a.localeCompare(b)),
    [team]
  );
  const firstQuestion = sortedQuestions[0];
  const recent = useMemo(
    () => recentStandups(standupSubmissions, {
      before: targetDate, today: todayStr, holidayDates, employee: currentEmployee, user, firstQuestion, leaves, count: 5,
    }),
    [standupSubmissions, targetDate, todayStr, holidayDates, currentEmployee, user, firstQuestion, leaves]
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError("");
    const wasEditing = isEditing;
    const payload = {
      date: targetDate,
      email: currentEmployee?.work_email || currentEmployee?.personal_email || user?.email || "",
      name: currentEmployee?.name || user?.user_metadata?.full_name || user?.email || "",
      responded_at: new Date().toISOString(),
      answers: Object.fromEntries(sortedQuestions.map((q) => [`question_${q.id}`, (answers[q.id] || "").trim()])),
      source: "tracker", // the HeuBot Google Chat bot leaves it empty; the meeting labels each
    };
    const tickets = await fetchStandupTickets();
    if (tickets) payload.jira_tickets = tickets;
    const { error: dbError } = wasEditing
      ? await updateStandupResponse(targetSubmission.id, payload)
      : await submitStandupResponse(payload);
    setSubmitting(false);
    if (dbError) {
      setError(dbError.message || "Failed to save. Please try again.");
      return;
    }
    setSavedAction(wasEditing ? "updated" : "submitted");
    clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => setSavedAction(null), 3000);
  };

  const pickDay = (date) => {
    setPicked(date);
    setError("");
  };

  // Arrow keys move between the two day tabs, as a tablist does.
  const onTabKey = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const i = options.findIndex((o) => o.date === targetDate);
    const next = options[(i + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length];
    pickDay(next.date);
    e.currentTarget.querySelector(`[data-date="${next.date}"]`)?.focus();
  };

  const eyebrow = [head?.eyebrow, tabDate(todayStr), formatBs(todayStr)].filter(Boolean).join(" · ");
  const dayShort = fmt(targetDate, { weekday: "long" });
  const stack = team.submitted.slice(0, STACK_MAX);
  const teamPct = team.expected ? Math.round((team.inCount / team.expected) * 100) : 0;

  return (
    <div className="standup-page">
      <PageHead eyebrow={eyebrow} title={head?.title} subtitle={head?.subtitle}>
        <div className="standup-head-tools">
          <div className="standup-days" role="tablist" aria-label="Which standup" onKeyDown={onTabKey}>
            {options.map((o) => {
              const selected = o.date === targetDate;
              return (
                <button
                  key={o.date}
                  type="button"
                  role="tab"
                  data-date={o.date}
                  aria-selected={selected}
                  aria-controls="standup-panels"
                  tabIndex={selected ? 0 : -1}
                  className={`standup-day${selected ? " standup-day-active" : ""}`}
                  onClick={() => pickDay(o.date)}
                >
                  <span className="standup-day-label">{o.label}</span>
                  <span className="standup-day-date mono">{tabDate(o.date)}</span>
                </button>
              );
            })}
          </div>
          <NepalClock />
        </div>
      </PageHead>

      <div className="standup-columns" id="standup-panels" role="tabpanel" aria-label={`Standup for ${longDate(targetDate)}`}>
        <section className="glass standup-card standup-update" aria-labelledby="standup-upd-title">
          <form onSubmit={handleSubmit} className="standup-update-form">
            <div className="standup-card-head">
              <span className="standup-card-tile" aria-hidden="true">
                <Icon name="message" size={20} />
              </span>
              <div className="standup-card-heading">
                <h2 id="standup-upd-title" className="standup-card-title standup-card-title-lg">Your update</h2>
                <span className="standup-card-sub">For {longDate(targetDate)} · read out at that morning&apos;s meeting</span>
              </div>
              <span className={`pill standup-status ${isEditing ? "pill-green" : "pill-amber"}`}>
                <span className="standup-status-dot" aria-hidden="true" />
                {isEditing ? `Submitted · ${sentAt(targetSubmission.responded_at, targetDate)}` : "Not submitted yet"}
              </span>
            </div>

            {savedAction && (
              <div className="standup-saved" role="status">
                <Icon name="check" size={16} strokeWidth={2.2} />
                <span>Standup {savedAction}. You can edit it any time.</span>
              </div>
            )}

            {sortedQuestions.length === 0 ? (
              <p className="standup-card-empty">No standup questions are configured yet.</p>
            ) : (
              <>
                <div className="standup-progress">
                  <div className="standup-progress-text">
                    <span>{progress.answered} of {progress.total} answered</span>
                    <span className="mono">{progress.pct}%</span>
                  </div>
                  <div className="standup-bar" aria-hidden="true">
                    <div className="standup-bar-fill" style={{ width: `${progress.pct}%` }} />
                  </div>
                </div>

                {sortedQuestions.map((q, i) => (
                  <div key={q.id} className="standup-question">
                    <label className="standup-question-label" htmlFor={`standup-q-${q.id}`}>
                      <span className="standup-question-n mono" aria-hidden="true">{pad(i + 1)}</span>
                      <span>{q.question}</span>
                    </label>
                    <textarea
                      id={`standup-q-${q.id}`}
                      className="standup-question-input"
                      rows={3}
                      value={answers[q.id] || ""}
                      onChange={(e) => setAnswer(q.id, e.target.value)}
                      onKeyDown={(e) => onAnswerKeyDown(e, q.id)}
                      placeholder="Type your answer… Start a line with * or - for a bullet list."
                    />
                  </div>
                ))}
              </>
            )}

            {error && <span className="standup-error" role="alert">{error}</span>}

            <div className="standup-update-foot">
              <span className="standup-card-foot mono">
                <Icon name="database" size={14} />
                Saved to the standup log
              </span>
              <div className="standup-update-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={clearAnswers}
                  disabled={!hasText || submitting}
                >
                  Clear
                </button>
                <button type="submit" className="btn btn-primary" disabled={!allAnswered || submitting}>
                  <Icon name="check" size={16} strokeWidth={2.2} />
                  {submitting ? "Saving…" : isEditing ? "Update standup" : "Submit standup"}
                </button>
              </div>
            </div>
          </form>
        </section>

        <div className="standup-side">
          <StandupShoutouts date={targetDate} dayShort={dayShort} />

          <section className="glass standup-card" aria-labelledby="standup-team-title">
            <div className="standup-team-head">
              <h2 id="standup-team-title" className="standup-card-title">Team so far</h2>
              <span className="standup-team-count mono">{team.inCount} of {team.expected} in</span>
            </div>
            <div className="standup-bar" aria-hidden="true">
              <div className="standup-bar-fill standup-bar-fill-cyan" style={{ width: `${teamPct}%` }} />
            </div>
            <div className="standup-team-row">
              {stack.length > 0 && (
                <span className="standup-stack" role="img" aria-label={`In: ${team.submitted.map((e) => e.name).join(", ")}`}>
                  {stack.map((e) => (
                    <Avatar
                      key={e.id}
                      name={e.name}
                      isMe={currentEmployee?.id === e.id}
                      className="avatar standup-stack-avatar"
                      title={e.name}
                    />
                  ))}
                  {team.submitted.length > STACK_MAX && (
                    <span className="avatar standup-stack-avatar standup-stack-more">+{team.submitted.length - STACK_MAX}</span>
                  )}
                </span>
              )}
              <span className="standup-team-waiting">
                {team.expected === 0 ? "Nobody is expected to submit." : waitingLabel(waitingNames)}
              </span>
            </div>
          </section>

          <section className="glass standup-card standup-recent" aria-labelledby="standup-recent-title">
            <h2 id="standup-recent-title" className="standup-card-title">Your recent updates</h2>
            {recent.length === 0 ? (
              <p className="standup-card-empty">Nothing yet.</p>
            ) : (
              <ul className="standup-recent-list">
                {recent.map((r) => (
                  <li key={r.date} className="standup-recent-item">
                    <span className="standup-recent-date mono">{shortDate(r.date)}</span>
                    <span className="standup-recent-note">{r.note || "—"}</span>
                    <span className={`pill ${RECENT_PILL[r.status].cls}`}>{RECENT_PILL[r.status].label}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
