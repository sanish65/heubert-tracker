"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useApp } from "@/context/AppContext";
import {
  getNepalParts,
  isStandupWindowOpen,
  findTodaysSubmission,
  STANDUP_WINDOW_START_MIN,
} from "@/lib/standupWindow";

function pad(n) {
  return String(n).padStart(2, "0");
}

export default function StandupFormPage() {
  const {
    standupQuestions,
    standupSubmissions,
    currentEmployee,
    user,
    submitStandupResponse,
    updateStandupResponse,
  } = useApp();
  const [now, setNow] = useState(() => new Date());
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [savedAction, setSavedAction] = useState(null); // "submitted" | "updated" | null
  const savedTimeoutRef = useRef(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => () => clearTimeout(savedTimeoutRef.current), []);

  const nepal = getNepalParts(now);
  const isOpen = isStandupWindowOpen(nepal);
  const isBefore = nepal.hour * 60 + nepal.minute < STANDUP_WINDOW_START_MIN;

  const todaysSubmission = useMemo(
    () => findTodaysSubmission(standupSubmissions, nepal.dateStr, currentEmployee, user),
    [standupSubmissions, nepal.dateStr, currentEmployee, user]
  );

  const sortedQuestions = useMemo(
    () => [...standupQuestions].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
    [standupQuestions]
  );

  // Pre-fill the form when there's already a submission to edit. Keyed on the
  // submission's id (not the object itself) so saving our own edit — which updates
  // standupSubmissions and recomputes todaysSubmission with the same id — doesn't
  // stomp on whatever the user has typed since.
  useEffect(() => {
    if (!todaysSubmission) return;
    const a = todaysSubmission.answers || {};
    const seeded = {};
    sortedQuestions.forEach((q) => {
      seeded[q.id] = a[`question_${q.id}`] || a[q.id] || a[q.question] || "";
    });
    setAnswers(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todaysSubmission?.id]);

  const allAnswered = sortedQuestions.length > 0 && sortedQuestions.every((q) => (answers[q.id] || "").trim());
  const clockLabel = `${pad(nepal.hour)}:${pad(nepal.minute)}:${pad(nepal.second)}`;
  const isEditing = Boolean(todaysSubmission);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isOpen || !allAnswered || submitting) return;
    setSubmitting(true);
    setError("");
    const wasEditing = isEditing;
    const payload = {
      date: nepal.dateStr,
      email: currentEmployee?.work_email || currentEmployee?.personal_email || user?.email || "",
      name: currentEmployee?.name || user?.user_metadata?.full_name || user?.email || "",
      responded_at: new Date().toISOString(),
      answers: Object.fromEntries(sortedQuestions.map((q) => [`question_${q.id}`, (answers[q.id] || "").trim()])),
    };
    const { error: dbError } = wasEditing
      ? await updateStandupResponse(todaysSubmission.id, payload)
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

  // Window closed and nothing to edit anymore — read-only view of what was submitted.
  if (!isOpen && todaysSubmission) {
    return (
      <div className="standup-page">
        <div className="standup-page-header">
          <h2 className="standup-page-title">Daily Standup</h2>
          <span className="standup-page-clock">Nepal time {clockLabel}</span>
        </div>
        <div className="standup-window-banner standup-window-done">
          ✅ You submitted today&apos;s standup at{" "}
          {new Date(todaysSubmission.responded_at).toLocaleTimeString("en-US", {
            timeZone: "Asia/Kathmandu",
            hour: "2-digit",
            minute: "2-digit",
          })}
          .
        </div>
        <div className="standup-page-review">
          {sortedQuestions.map((q) => {
            const a = todaysSubmission.answers || {};
            const answer = a[`question_${q.id}`] || a[q.id] || a[q.question] || "";
            return (
              <div key={q.id} className="standup-page-review-item">
                <span className="standup-page-label">{q.question}</span>
                <div className="standup-page-review-answer">
                  {answer ? answer : <span className="standup-page-muted">No answer provided</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="standup-page">
      <div className="standup-page-header">
        <h2 className="standup-page-title">Daily Standup</h2>
        <span className="standup-page-clock">Nepal time {clockLabel}</span>
      </div>

      {!isOpen ? (
        <div className={`standup-window-banner ${isBefore ? "standup-window-before" : "standup-window-after"}`}>
          {isBefore
            ? "The standup form opens at 9:00 AM Nepal time. Come back then."
            : "Today's standup window (9:00 – 9:30 AM Nepal time) has closed."}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="standup-page-form">
          <div className="standup-window-banner standup-window-open">
            {isEditing
              ? "🟢 You can still edit your answers — window closes at 9:30 AM Nepal time."
              : "🟢 Standup window is open — closes at 9:30 AM Nepal time."}
          </div>
          {savedAction && (
            <div className="standup-window-banner standup-window-done" role="status">
              ✅ Standup {savedAction}!
            </div>
          )}
          {sortedQuestions.length === 0 ? (
            <p className="standup-page-muted standup-page-empty">No standup questions are configured yet.</p>
          ) : (
            sortedQuestions.map((q) => (
              <div key={q.id} className="standup-page-question">
                <label className="standup-page-label" htmlFor={`standup-q-${q.id}`}>{q.question}</label>
                <textarea
                  id={`standup-q-${q.id}`}
                  className="standup-page-textarea"
                  rows={3}
                  value={answers[q.id] || ""}
                  onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                  placeholder="Type your answer..."
                />
              </div>
            ))
          )}

          {error && <span className="standup-page-error">{error}</span>}

          <div className="standup-page-actions">
            <button type="submit" className="btn btn-primary" disabled={!allAnswered || submitting}>
              {submitting ? "Saving..." : isEditing ? "Update Standup" : "Submit Standup"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
