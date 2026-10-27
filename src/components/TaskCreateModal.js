"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import {
  ISSUE_TYPES,
  PRIORITIES,
  ESTIMATE_OPTIONS,
  LABELS_MAX,
  LINK_CHOICES,
  allowedParentTypes,
  issueKey,
  linkRow,
} from "@/lib/taskBoard";
import { isDone } from "@/lib/taskWorkflow";

function emptyForm(defaults) {
  return {
    type: defaults.type || "story",
    title: "",
    description: "",
    assignee_id: defaults.assignee_id ?? null,
    priority: "medium",
    estimate: "",
    parent_id: defaults.parent_id ?? null,
    sprint_id: defaults.sprint_id ?? null,
    labels: "",
    due_date: "",
    external_url: "",
    fix_version_id: null,
    // Jira's "Linked issues" on create: e.g. a bug that "relates to" the story it was found in.
    link_choice: "relates:out",
    link_target_id: null,
  };
}

// Jira's Create dialog: one form for every issue type, showing only the fields and
// parents that are valid for the type picked.
export default function TaskCreateModal({ isOpen, onClose, project, tasks, sprints, versions = [], employees, board, defaults = {}, onCreated }) {
  const [form, setForm] = useState(() => emptyForm(defaults));
  const [createAnother, setCreateAnother] = useState(false);
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const setField = (key, value) => {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Switching type drops a parent that's no longer allowed rather than failing the save.
      if (key === "type") {
        const parent = tasks.find((t) => t.id === prev.parent_id);
        if (parent && !allowedParentTypes(value).includes(parent.type)) next.parent_id = null;
      }
      return next;
    });
    setError("");
  };

  const parentOptions = useMemo(() => {
    const types = allowedParentTypes(form.type);
    return tasks.filter((t) => types.includes(t.type) && !isDone(t));
  }, [tasks, form.type]);

  // Any issue can be linked, newest first.
  const linkOptions = useMemo(() => [...tasks].sort((a, b) => (b.number || 0) - (a.number || 0)), [tasks]);

  const openSprints = sprints.filter((s) => s.state !== "closed");
  const assignees = employees.filter((e) => e.status === "active");
  const isEpic = form.type === "epic";
  const isSubtask = form.type === "subtask";

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSaving) return;
    if (!form.title.trim()) {
      setError("Please enter a summary");
      return;
    }
    if (isSubtask && !form.parent_id) {
      setError("A sub-task needs a parent issue");
      return;
    }
    setIsSaving(true);
    try {
      const { link_choice, link_target_id, ...issueFields } = form;
      const fields = {
        ...issueFields,
        parent_id: isEpic ? null : form.parent_id,
        // Epics never sit in a sprint, and the database puts sub-tasks in their parent's.
        sprint_id: isEpic || isSubtask ? null : form.sprint_id,
        estimate: isEpic || isSubtask ? null : form.estimate,
      };
      const { data, error: dbError } = await board.createIssue(fields);
      if (dbError) {
        setError(dbError.message || "Something went wrong");
        return;
      }
      if (link_target_id && data?.id) {
        const { error: linkError } = await board.linkIssues(linkRow(link_choice, data.id, link_target_id));
        if (linkError) {
          // The issue exists; only the link is missing, and it can be added from the issue.
          setError(`${issueKey(project, data)} was created, but the link wasn't saved: ${linkError.message}`);
          onCreated?.(data);
          return;
        }
      }
      onCreated?.(data);
      if (createAnother) {
        setForm((prev) => ({ ...emptyForm(defaults), type: prev.type, parent_id: prev.parent_id, sprint_id: prev.sprint_id }));
      } else {
        onClose();
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="modal-content-wide">
      <div className="modal-header">
        <h2>Create issue <span className="issue-modal-project">in {project.name}</span></h2>
        <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>

      <form onSubmit={handleSubmit} className="premium-form issue-create-form">
        <div className="issue-form-grid">
          <div className="form-group-interactive">
            <label>Issue type</label>
            <select value={form.type} onChange={(e) => setField("type", e.target.value)}>
              {ISSUE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group-interactive">
            <label>Priority</label>
            <select value={form.priority} onChange={(e) => setField("priority", e.target.value)}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-group-interactive">
          <label>Summary</label>
          <input
            type="text"
            placeholder={isEpic ? "e.g. Checkout redesign" : "What needs to be done?"}
            value={form.title}
            onChange={(e) => setField("title", e.target.value)}
            autoFocus
            required
          />
        </div>
        <div className="form-group-interactive">
          <label>Description</label>
          <textarea
            rows={4}
            placeholder="Context, steps to reproduce, acceptance criteria…"
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
          />
        </div>

        <div className="issue-form-grid">
          {!isEpic && (
            <div className="form-group-interactive">
              <label>{isSubtask ? "Parent issue" : "Epic"}</label>
              <select
                value={form.parent_id ?? ""}
                onChange={(e) => setField("parent_id", e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">{isSubtask ? "Choose a parent…" : "No epic"}</option>
                {parentOptions.map((t) => (
                  <option key={t.id} value={t.id}>{issueKey(project, t)} {t.title}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group-interactive issue-form-link">
            <label htmlFor="create-link-target">Linked issue</label>
            <div className="issue-form-link-row">
              <select aria-label="Link type" value={form.link_choice} onChange={(e) => setField("link_choice", e.target.value)}>
                {LINK_CHOICES.map((c) => (
                  <option key={c.id} value={c.id}>{c.phrase}</option>
                ))}
              </select>
              <select
                id="create-link-target"
                value={form.link_target_id ?? ""}
                onChange={(e) => setField("link_target_id", e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">None</option>
                {linkOptions.map((t) => (
                  <option key={t.id} value={t.id}>{issueKey(project, t)} {t.title}</option>
                ))}
              </select>
            </div>
          </div>
          {!isEpic && !isSubtask && (
            <div className="form-group-interactive">
              <label>Sprint</label>
              <select
                value={form.sprint_id ?? ""}
                onChange={(e) => setField("sprint_id", e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">Backlog</option>
                {openSprints.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}{s.state === "active" ? " (active)" : ""}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group-interactive">
            <label>Assignee</label>
            <select
              value={form.assignee_id ?? ""}
              onChange={(e) => setField("assignee_id", e.target.value ? Number(e.target.value) : null)}
            >
              <option value="">Unassigned</option>
              {assignees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          {!isEpic && !isSubtask && (
            <div className="form-group-interactive">
              <label>Story points</label>
              <select value={form.estimate} onChange={(e) => setField("estimate", e.target.value)}>
                <option value="">None</option>
                {ESTIMATE_OPTIONS.map((n) => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-group-interactive">
            <label>Due date</label>
            <input type="date" value={form.due_date} onChange={(e) => setField("due_date", e.target.value)} />
          </div>
          <div className="form-group-interactive">
            <label>Labels</label>
            <input
              type="text"
              placeholder={`Comma separated, up to ${LABELS_MAX}`}
              value={form.labels}
              onChange={(e) => setField("labels", e.target.value)}
            />
          </div>
          {versions.some((v) => v.status === "unreleased") && (
            <div className="form-group-interactive">
              <label>Fix version</label>
              <select
                value={form.fix_version_id ?? ""}
                onChange={(e) => setField("fix_version_id", e.target.value ? Number(e.target.value) : null)}
              >
                <option value="">None</option>
                {versions.filter((v) => v.status === "unreleased").map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="form-group-interactive">
          <label>Development link</label>
          <input
            type="text"
            placeholder="GitHub pull request or Jira issue URL"
            value={form.external_url}
            onChange={(e) => setField("external_url", e.target.value)}
          />
        </div>

        {error && <p className="form-error">{error}</p>}

        <div className="modal-actions issue-create-actions">
          <label className="issue-create-another">
            <input type="checkbox" checked={createAnother} onChange={(e) => setCreateAnother(e.target.checked)} />
            Create another
          </label>
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
