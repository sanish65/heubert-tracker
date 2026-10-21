"use client";

import { useState } from "react";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import { defaultSprintDates, nextSprintName, daysBetween, countsTowardPoints, sumPoints } from "@/lib/taskBoard";

const DURATIONS = [1, 2, 3, 4];

function addDaysStr(dateStr, days) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// mode: "create" | "edit" | "start". Starting is editing plus the start_task_sprint call,
// which is the step that freezes the committed points for the velocity chart.
export function SprintFormModal({ isOpen, onClose, mode, sprint, project, sprints, issueCount, today, board }) {
  const [form, setForm] = useState(() => {
    const defaults = defaultSprintDates(today);
    // Dates saved when a sprint was planned may be weeks old by the time it starts.
    // Starting defaults to today and keeps the planned length.
    if (mode === "start" && (!sprint?.start_date || sprint.start_date < today)) {
      const length = sprint?.start_date && sprint?.end_date ? daysBetween(sprint.start_date, sprint.end_date) : null;
      return {
        name: sprint?.name || "",
        goal: sprint?.goal || "",
        start_date: today,
        end_date: length != null && length >= 0 ? addDaysStr(today, length) : defaults.end,
      };
    }
    return {
      name: sprint?.name || nextSprintName(project.issue_key, sprints),
      goal: sprint?.goal || "",
      start_date: sprint?.start_date || defaults.start,
      end_date: sprint?.end_date || defaults.end,
    };
  });
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const setField = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError("");
  };

  const setDuration = (weeks) => {
    if (!form.start_date) return;
    setField("end_date", addDaysStr(form.start_date, weeks * 7 - 1));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Please name the sprint");
      return;
    }
    if (form.start_date && form.end_date && form.end_date < form.start_date) {
      setError("The end date can't be before the start date");
      return;
    }
    if (mode === "start" && (!form.start_date || !form.end_date)) {
      setError("A sprint needs both dates to start");
      return;
    }
    setIsSaving(true);
    try {
      let result;
      if (mode === "create") {
        result = await board.createSprint(form);
      } else {
        result = await board.updateSprint(sprint.id, form);
        if (!result.error && mode === "start") {
          result = await board.startSprint(sprint.id, form);
        }
      }
      if (result.error) {
        setError(result.error.message || "Something went wrong");
        return;
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const length = form.start_date && form.end_date ? daysBetween(form.start_date, form.end_date) + 1 : null;
  const title = mode === "create" ? "Create sprint" : mode === "start" ? "Start sprint" : "Edit sprint";

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="modal-header">
        <h2>{title}</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
      <form onSubmit={handleSubmit} className="premium-form">
        {mode === "start" && (
          <p className="sprint-modal-note">
            {issueCount} {issueCount === 1 ? "issue" : "issues"} will be included in this sprint.
          </p>
        )}
        <div className="form-group-interactive">
          <label>Sprint name</label>
          <input type="text" value={form.name} onChange={(e) => setField("name", e.target.value)} autoFocus required />
        </div>
        <div className="form-group-interactive">
          <label>Duration</label>
          <div className="status-tabs sprint-duration-chips">
            {DURATIONS.map((weeks) => (
              <button
                key={weeks}
                type="button"
                className={`tab ${length === weeks * 7 ? "tab-active" : ""}`}
                onClick={() => setDuration(weeks)}
              >
                {weeks} {weeks === 1 ? "week" : "weeks"}
              </button>
            ))}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group-interactive">
            <label>Start date</label>
            <input type="date" value={form.start_date} onChange={(e) => setField("start_date", e.target.value)} />
          </div>
          <div className="form-group-interactive">
            <label>End date</label>
            <input type="date" value={form.end_date} onChange={(e) => setField("end_date", e.target.value)} />
          </div>
        </div>
        <div className="form-group-interactive">
          <label>Sprint goal</label>
          <textarea
            rows={3}
            placeholder="What should this sprint achieve?"
            value={form.goal}
            onChange={(e) => setField("goal", e.target.value)}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? "Saving..." : mode === "start" ? "Start" : mode === "create" ? "Create" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const NEW_SPRINT = "new";

// Jira's "Complete sprint": done work stays in the closed sprint for its report, open
// work moves to the backlog, a future sprint, or a new sprint made on the spot.
export function CompleteSprintModal({ isOpen, onClose, sprint, project, sprints, sprintIssues, board }) {
  const futureSprints = sprints.filter((s) => s.state === "future");
  const [moveTo, setMoveTo] = useState(futureSprints[0] ? String(futureSprints[0].id) : "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const standard = sprintIssues.filter(countsTowardPoints);
  const done = standard.filter((t) => t.status === "done");
  const open = standard.filter((t) => t.status !== "done");
  // complete_task_sprint refuses these: a sub-task follows its parent, and a done
  // parent stays in the closed sprint, so the sub-task would vanish with it.
  const doneIds = new Set(done.map((t) => t.id));
  const stranded = sprintIssues.filter((t) => t.type === "subtask" && t.status !== "done" && doneIds.has(t.parent_id));

  const handleComplete = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setError("");
    try {
      let target = moveTo ? Number(moveTo) : null;
      if (moveTo === NEW_SPRINT) {
        const created = await board.createSprint({ name: nextSprintName(project.issue_key, sprints) });
        if (created.error) {
          setError(created.error.message);
          return;
        }
        target = created.data.id;
      }
      const { error: dbError } = await board.completeSprint(sprint.id, target);
      if (dbError) {
        setError(dbError.message || "Something went wrong");
        return;
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="modal-header">
        <h2>Complete {sprint.name}</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
      <div className="sprint-complete-summary">
        <div className="sprint-complete-stat">
          <strong>{done.length}</strong>
          <span>completed · {sumPoints(done)} pts</span>
        </div>
        <div className="sprint-complete-stat">
          <strong>{open.length}</strong>
          <span>open · {sumPoints(open)} pts</span>
        </div>
      </div>
      {stranded.length > 0 && (
        <p className="form-error">
          {stranded.length} open sub-task{stranded.length === 1 ? "" : "s"} belong to issues already marked Done. Finish
          {stranded.length === 1 ? " it" : " them"} or reopen the parent before completing the sprint.
        </p>
      )}
      {open.length > 0 ? (
        <div className="form-group-interactive">
          <label>Move open issues to</label>
          <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
            <option value="">Backlog</option>
            {futureSprints.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            <option value={NEW_SPRINT}>New sprint</option>
          </select>
        </div>
      ) : (
        <p className="sprint-modal-note">Every issue in this sprint is done.</p>
      )}
      {error && <p className="form-error">{error}</p>}
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={handleComplete} disabled={isSaving || stranded.length > 0}>
          {isSaving ? "Completing..." : "Complete sprint"}
        </button>
      </div>
    </Modal>
  );
}
