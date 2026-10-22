"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import { issueKey, sortByRank, canDeleteTask } from "@/lib/taskBoard";
import { isDone } from "@/lib/taskWorkflow";
import { sortVersions, versionProgress, isVersionOverdue } from "@/lib/taskExtras";
import { TypeIcon, StatusLozenge, Avatar, formatShortDate } from "@/components/TaskBits";

const STATUS_PILL = {
  unreleased: { label: "Unreleased", cls: "pill-blue" },
  released: { label: "Released", cls: "pill-green" },
  archived: { label: "Archived", cls: "pill-gray" },
};

// Create or edit a release: name, dates, a short description.
export function VersionFormModal({ version, versions, board, onClose }) {
  const { alertDialog } = useDialog();
  const [form, setForm] = useState(() => ({
    name: version?.name || "",
    description: version?.description || "",
    start_date: version?.start_date || "",
    release_date: version?.release_date || "",
  }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k, v) => {
    setForm((p) => ({ ...p, [k]: v }));
    setError("");
  };

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const name = form.name.trim();
    if (!name) return setError("Give the release a name, e.g. v1.4");
    if (versions.some((v) => v.id !== version?.id && v.name.toLowerCase() === name.toLowerCase())) return setError("Another release already has this name");
    if (form.start_date && form.release_date && form.release_date < form.start_date) return setError("The release date can't be before the start date");
    setBusy(true);
    const { error: dbError } = version ? await board.updateVersion(version.id, form) : await board.createVersion(form);
    setBusy(false);
    if (dbError) {
      await alertDialog(`Couldn't save the release: ${dbError.message}`, { tone: "error" });
      return;
    }
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose}>
      <div className="modal-header">
        <h2>{version ? "Edit release" : "Create release"}</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
      <form onSubmit={submit} className="premium-form">
        <div className="form-group-interactive">
          <label>Name</label>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. v1.4 or October release" autoFocus required />
        </div>
        <div className="form-row">
          <div className="form-group-interactive">
            <label>Start date</label>
            <input type="date" value={form.start_date} onChange={(e) => set("start_date", e.target.value)} />
          </div>
          <div className="form-group-interactive">
            <label>Release date</label>
            <input type="date" value={form.release_date} onChange={(e) => set("release_date", e.target.value)} />
          </div>
        </div>
        <div className="form-group-interactive">
          <label>Description</label>
          <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="What ships in it?" />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : version ? "Save" : "Create"}</button>
        </div>
      </form>
    </Modal>
  );
}

// Jira's Release dialog: open issues move to another release, or out of any release.
function ReleaseModal({ version, versions, tasks, board, onClose }) {
  const { alertDialog } = useDialog();
  const open = tasks.filter((t) => t.fix_version_id === version.id && !isDone(t) && t.type !== "epic");
  const others = sortVersions(versions).filter((v) => v.id !== version.id && v.status === "unreleased");
  const [moveTo, setMoveTo] = useState(others[0] ? String(others[0].id) : "");
  const [busy, setBusy] = useState(false);

  const release = async () => {
    if (busy) return;
    setBusy(true);
    const { error } = await board.releaseVersion(version.id, moveTo ? Number(moveTo) : null);
    setBusy(false);
    if (error) {
      await alertDialog(`Couldn't release: ${error.message}`, { tone: "error" });
      return;
    }
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose}>
      <div className="modal-header">
        <h2>Release {version.name}</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
      {open.length === 0 ? (
        <p className="sprint-modal-note">Every issue in this release is done. It&apos;s ready to ship.</p>
      ) : (
        <>
          <p className="sprint-modal-note">
            {open.length} {open.length === 1 ? "issue isn't" : "issues aren't"} done yet. Where should {open.length === 1 ? "it" : "they"} go?
          </p>
          <div className="form-group-interactive">
            <label>Move open issues to</label>
            <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              {others.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
              <option value="">No release</option>
            </select>
          </div>
        </>
      )}
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={release} disabled={busy}>{busy ? "Releasing..." : "Release"}</button>
      </div>
    </Modal>
  );
}

export default function TaskReleasesView({ project, tasks, versions, employeesById, board, today, onOpenIssue }) {
  const { user, isAdmin } = useApp();
  const { confirmDialog, alertDialog } = useDialog();
  const [form, setForm] = useState(null); // { version } — version null to create
  const [releasing, setReleasing] = useState(null);
  const [expanded, setExpanded] = useState(() => new Set());
  const [showArchived, setShowArchived] = useState(false);

  const list = sortVersions(versions).filter((v) => showArchived || v.status !== "archived");
  const archivedCount = versions.filter((v) => v.status === "archived").length;
  const unassigned = tasks.filter((t) => t.fix_version_id == null && t.type !== "epic" && t.type !== "subtask" && !isDone(t)).length;

  const toggle = (id) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const setStatus = async (version, status) => {
    const { error } = await board.updateVersion(version.id, { status });
    if (error) await alertDialog(`Couldn't update: ${error.message}`, { tone: "error" });
  };

  const remove = async (version, count) => {
    const note = count ? ` Its ${count} ${count === 1 ? "issue keeps" : "issues keep"} working, with no release.` : "";
    if (!(await confirmDialog(`Delete release ${version.name}?${note}`, { danger: true }))) return;
    const { error } = await board.deleteVersion(version.id);
    if (error) await alertDialog(`Couldn't delete: ${error.message}`, { tone: "error" });
  };

  return (
    <div className="releases-view">
      <div className="releases-head">
        <p className="releases-sub">
          Group issues into releases (fix versions) and ship them together. {unassigned > 0 && `${unassigned} open ${unassigned === 1 ? "issue has" : "issues have"} no release yet.`}
        </p>
        <div className="releases-actions">
          {archivedCount > 0 && (
            <button type="button" className={`project-filter-chip ${showArchived ? "active" : ""}`} onClick={() => setShowArchived((v) => !v)}>
              Show archived ({archivedCount})
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ version: null })}>
            <Icon name="plus" size={16} strokeWidth={2.2} /> Create release
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="tasks-empty-state glass">
          <div className="tasks-empty-icon"><Icon name="flag" size={22} /></div>
          <h3>No releases yet</h3>
          <p>Create one, then set the Fix version on issues (or in bulk from the backlog) to plan what ships in it.</p>
        </div>
      ) : (
        <ul className="releases-list">
          {list.map((v) => {
            const progress = versionProgress(v.id, tasks);
            const pill = STATUS_PILL[v.status];
            const overdue = isVersionOverdue(v, today);
            const canDelete = canDeleteTask({ task: v, isAdmin, email: user?.email });
            const isOpen = expanded.has(v.id);
            const issues = sortByRank(tasks.filter((t) => t.fix_version_id === v.id && t.type !== "epic"));
            return (
              <li key={v.id} className="release-card glass-card">
                <div className="release-top">
                  <button type="button" className="release-toggle" onClick={() => toggle(v.id)} aria-expanded={isOpen}>
                    <Icon name="chevron-down" size={16} className={`board-lane-caret ${isOpen ? "" : "collapsed"}`} />
                    <strong className="release-name">{v.name}</strong>
                  </button>
                  <span className={`pill ${pill.cls}`}>{pill.label}</span>
                  {overdue && <span className="pill pill-red">Overdue</span>}
                  <span className="release-dates mono">
                    {v.start_date ? formatShortDate(v.start_date) : "No start"} → {v.release_date ? formatShortDate(v.release_date) : "No date"}
                    {v.status === "released" && v.released_at ? ` · released ${formatShortDate(v.released_at)}` : ""}
                  </span>
                  <div className="release-actions">
                    {v.status === "unreleased" && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setReleasing(v)}>Release</button>
                    )}
                    {v.status === "released" && (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(v, "unreleased")}>Unrelease</button>
                    )}
                    {v.status !== "archived" ? (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(v, "archived")}>Archive</button>
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setStatus(v, v.released_at ? "released" : "unreleased")}>Restore</button>
                    )}
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ version: v })}>
                      <Icon name="edit" size={16} /> Edit
                    </button>
                    {canDelete && (
                      <button type="button" className="btn btn-ghost btn-sm issue-delete-btn" onClick={() => remove(v, progress.total)}>
                        <Icon name="trash" size={16} />
                      </button>
                    )}
                  </div>
                </div>
                {v.description && <p className="release-desc">{v.description}</p>}
                <div className="release-progress" role="img" aria-label={`${progress.done} done, ${progress.inProgress} in progress, ${progress.todo} to do`}>
                  {progress.total === 0 ? (
                    <span className="release-progress-empty" />
                  ) : (
                    <>
                      <span className="seg-done" style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                      <span className="seg-progress" style={{ width: `${(progress.inProgress / progress.total) * 100}%` }} />
                    </>
                  )}
                </div>
                <div className="release-counts">
                  <span>{progress.total} {progress.total === 1 ? "issue" : "issues"}</span>
                  <span className="release-count-done">{progress.done} done</span>
                  <span className="release-count-progress">{progress.inProgress} in progress</span>
                  <span>{progress.todo} to do</span>
                  <span className="mono">{progress.percent}%</span>
                </div>
                {isOpen && (
                  <ul className="issue-child-list release-issues">
                    {issues.length === 0 && <li className="issue-muted release-empty">No issues in this release yet.</li>}
                    {issues.map((t) => (
                      <li key={t.id} className="issue-child-row" onClick={() => onOpenIssue(t.id)}>
                        <TypeIcon type={t.type} />
                        <span className="issue-key-text">{issueKey(project, t)}</span>
                        <span className={`issue-child-title ${isDone(t) ? "is-done" : ""}`}>{t.title}</span>
                        <Avatar employee={employeesById.get(t.assignee_id)} />
                        <StatusLozenge status={t.status} />
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {form && <VersionFormModal version={form.version} versions={versions} board={board} onClose={() => setForm(null)} />}
      {releasing && <ReleaseModal version={releasing} versions={versions} tasks={tasks} board={board} onClose={() => setReleasing(null)} />}
    </div>
  );
}
