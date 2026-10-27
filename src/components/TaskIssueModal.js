"use client";

import { useMemo, useState } from "react";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import { useIssueDetail } from "@/lib/useTasks";
import {
  ISSUE_TYPES,
  PRIORITIES,
  ESTIMATE_OPTIONS,
  LINK_CHOICES,
  EPIC_COLORS,
  issueKey,
  parseIssueKey,
  parentCandidates,
  childProgress,
  sortByRank,
  canDeleteTask,
  describeIssueLink,
  describeExternalLink,
  describeActivity,
  isOverdue,
  issueType,
} from "@/lib/taskBoard";
import { TypeIcon, PriorityIcon, StatusLozenge, Avatar, formatDateTime, epicColor } from "@/components/TaskBits";
import TaskMarkdown from "@/components/TaskMarkdown";
import { MentionTextarea, TimeTrackingPanel, WorklogList, AttachmentsSection, WatchButton } from "@/components/TaskIssueExtras";
import { mentionedIds, sortVersions } from "@/lib/taskExtras";
import { isDone, nextStatuses, statusMeta } from "@/lib/taskWorkflow";
import { useWorkflow } from "@/components/TaskWorkflowContext";


function InlineCreate({ placeholder, typeOptions, onCreate }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState(typeOptions[0].value);
  const [busy, setBusy] = useState(false);

  if (!open) {
    return (
      <button type="button" className="issue-inline-add" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} strokeWidth={2.2} /> {placeholder}
      </button>
    );
  }

  const submit = async () => {
    if (busy || !title.trim()) return;
    setBusy(true);
    const ok = await onCreate({ title, type });
    setBusy(false);
    if (ok) setTitle("");
  };

  return (
    <div className="issue-inline-create">
      {typeOptions.length > 1 && (
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {typeOptions.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>
      )}
      <input
        type="text"
        autoFocus
        placeholder="What needs to be done?"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") setOpen(false);
        }}
      />
      <button type="button" className="btn btn-primary btn-sm" onClick={submit} disabled={busy || !title.trim()}>
        Create
      </button>
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>
        Cancel
      </button>
    </div>
  );
}

function ChildRow({ child, project, employeesById, onOpen }) {
  return (
    <li className="issue-child-row" onClick={() => onOpen(child.id)}>
      <TypeIcon type={child.type} />
      <span className="issue-key-text">{issueKey(project, child)}</span>
      <span className={`issue-child-title ${isDone(child) ? "is-done" : ""}`}>{child.title}</span>
      <PriorityIcon priority={child.priority} />
      <Avatar employee={employeesById.get(child.assignee_id)} />
      <StatusLozenge status={child.status} />
    </li>
  );
}

// Jira's Move: pick another project. The dialog says what changes, as Jira's move screen
// does; the database does the move (move_task_to_project) and hands back the new key.
function MoveIssueModal({ issue, issueKeyText, project, projects, subtaskCount, childCount, board, onMoved, onClose }) {
  const { alertDialog } = useDialog();
  const targets = projects.filter((p) => p.id !== project.id && p.issue_key && p.status !== "archived");
  const [projectId, setProjectId] = useState(targets[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const target = targets.find((p) => p.id === Number(projectId));
  const isEpic = issue.type === "epic";

  const move = async () => {
    if (!target) return;
    setSaving(true);
    const { data, error } = await board.moveToProject(issue.id, target.id);
    setSaving(false);
    if (error) {
      await alertDialog(`Couldn't move ${issueKeyText}: ${error.message}`, { tone: "error" });
      return;
    }
    onMoved(data);
  };

  return (
    <Modal isOpen onClose={onClose}>
      <div className="modal-header">
        <h2>Move {issueKeyText}</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
      {targets.length === 0 ? (
        <p className="form-error">There&apos;s no other project with an issue key to move it to.</p>
      ) : (
        <>
          <div className="form-group-interactive">
            <label htmlFor="move-project">Move to project</label>
            <select id="move-project" value={projectId} onChange={(e) => setProjectId(e.target.value)}>
              {targets.map((p) => (
                <option key={p.id} value={p.id}>{p.issue_key} · {p.name}</option>
              ))}
            </select>
          </div>
          <ul className="move-issue-notes">
            <li>It gets {target?.issue_key || "the project"}&apos;s next number; links to {issueKeyText} keep working.</li>
            <li>Its status goes to {target?.name || "that project"}&apos;s matching column (to do, in progress or done).</li>
            <li>It leaves its sprint{isEpic ? "" : ", epic"} and fix version, and lands at the bottom of the backlog.</li>
            {subtaskCount > 0 && <li>Its {subtaskCount} sub-task{subtaskCount === 1 ? " moves" : "s move"} with it.</li>}
            {isEpic && childCount > 0 && <li>The {childCount} issue{childCount === 1 ? "" : "s"} in this epic stay here, without an epic.</li>}
            <li>Comments, history, work logs, attachments and watchers come along.</li>
          </ul>
        </>
      )}
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={move} disabled={saving || !target}>{saving ? "Moving..." : "Move"}</button>
      </div>
    </Modal>
  );
}

export default function TaskIssueModal({ issueId, onClose, onOpenIssue, project, tasks, sprints, versions = [], employees, board, today }) {
  const { user, isAdmin, currentEmployee, projects } = useApp();
  const { confirmDialog, alertDialog } = useDialog();
  const detail = useIssueDetail(issueId);
  const workflow = useWorkflow();

  const issue = tasks.find((t) => t.id === issueId) || null;
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const employeesById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [editingDescription, setEditingDescription] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [labelsDraft, setLabelsDraft] = useState(null);
  const [dueDraft, setDueDraft] = useState(null);
  const [linkUrlDraft, setLinkUrlDraft] = useState(null);
  const [activityTab, setActivityTab] = useState("comments");
  const [commentDraft, setCommentDraft] = useState("");
  const [commentMentions, setCommentMentions] = useState([]);
  const [isPosting, setIsPosting] = useState(false);
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [linkChoice, setLinkChoice] = useState(LINK_CHOICES[0].id);
  const [linkTarget, setLinkTarget] = useState("");
  const [copied, setCopied] = useState(false);
  const [moving, setMoving] = useState(false);

  const linkGroups = useMemo(() => {
    const groups = new Map();
    for (const link of detail.links) {
      const { phrase, otherId } = describeIssueLink(link, issueId);
      if (!groups.has(phrase)) groups.set(phrase, []);
      groups.get(phrase).push({ link, other: tasksById.get(otherId) });
    }
    return [...groups.entries()];
  }, [detail.links, issueId, tasksById]);

  if (!issue) {
    return (
      <Modal isOpen onClose={onClose}>
        <div className="modal-header">
          <h2>Issue not found</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <p className="empty-msg">It may have been deleted, or it belongs to a different project.</p>
      </Modal>
    );
  }

  const key = issueKey(project, issue);
  const isEpic = issue.type === "epic";
  const isSubtask = issue.type === "subtask";
  const parent = issue.parent_id != null ? tasksById.get(issue.parent_id) : null;
  const children = sortByRank(tasks.filter((t) => t.parent_id === issue.id));
  const progress = childProgress(issue.id, tasks);
  const openSprints = sprints.filter((s) => s.state !== "closed" || s.id === issue.sprint_id);
  const assignees = employees.filter((e) => e.status === "active" || e.id === issue.assignee_id || e.id === issue.reporter_id);
  const canDelete = canDeleteTask({ task: issue, isAdmin, email: user?.email });
  const myEmail = (user?.email || "").toLowerCase();
  const devLink = describeExternalLink(issue.external_url);

  const save = async (fields) => {
    const { error } = await board.updateIssue(issue.id, fields);
    if (error) await alertDialog(`Couldn't save: ${error.message || "Check connection"}`, { tone: "error" });
    else detail.reload();
    return !error;
  };

  const commitTitle = async () => {
    setEditingTitle(false);
    const next = titleDraft.trim();
    if (next && next !== issue.title) await save({ title: next });
  };

  const commitDescription = async () => {
    setEditingDescription(false);
    if ((descriptionDraft || "").trim() !== (issue.description || "")) await save({ description: descriptionDraft });
  };

  const changeType = async (type) => {
    if (type === issue.type) return;
    // Becoming an epic leaves the epic it was in and any sprint; leaving epic is
    // refused by the database while it still holds issues, which the error explains.
    const fields = type === "epic" ? { type, parent_id: null, sprint_id: null } : { type };
    if (issue.type === "epic" && type !== "epic") fields.epic_color = null;
    await save(fields);
  };

  const handleDelete = async () => {
    const subtaskCount = children.filter((c) => c.type === "subtask").length;
    const note = isEpic
      ? children.length
        ? ` The ${children.length} issues in this epic stay, without an epic.`
        : ""
      : subtaskCount
        ? ` Its ${subtaskCount} sub-task${subtaskCount === 1 ? " is" : "s are"} deleted with it.`
        : "";
    if (!(await confirmDialog(`Delete ${key} "${issue.title}"?${note} This can't be undone.`, { danger: true }))) return;
    const { error } = await board.deleteIssue(issue.id);
    if (error) {
      await alertDialog(`Couldn't delete: ${error.message}`, { tone: "error" });
      return;
    }
    onClose();
  };

  // Moved: open it under its new key, in its new project (TasksPage follows the link).
  const afterMove = (newKey) => {
    setMoving(false);
    onClose();
    if (newKey) window.location.hash = `issue=${newKey}`;
  };

  const copyLink = async () => {
    const url = `${window.location.origin}${window.location.pathname}#issue=${key}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      await alertDialog(url, { title: "Issue link" });
    }
  };

  const createChild = async ({ title, type }) => {
    const { error } = await board.createIssue({
      title,
      type: isEpic ? type : "subtask",
      parent_id: issue.id,
      sprint_id: isEpic ? null : issue.sprint_id,
    });
    if (error) {
      await alertDialog(`Couldn't create: ${error.message}`, { tone: "error" });
      return false;
    }
    return true;
  };

  const postComment = async () => {
    if (isPosting || !commentDraft.trim()) return;
    setIsPosting(true);
    const { error } = await detail.addComment(commentDraft, mentionedIds(commentDraft, commentMentions));
    setIsPosting(false);
    if (error) {
      await alertDialog(`Couldn't post comment: ${error.message}`, { tone: "error" });
      return;
    }
    setCommentDraft("");
    setCommentMentions([]);
  };

  // Jira's Clone: same content and plan, a new number, opened straight away.
  const cloneIssue = async () => {
    const { data, error } = await board.cloneIssue(issue);
    if (error) {
      await alertDialog(`Couldn't clone: ${error.message}`, { tone: "error" });
      return;
    }
    onOpenIssue(data.id, data);
  };

  const removeWorklog = async (w) => {
    if (!(await confirmDialog("Delete this work log? The time comes off the issue's time spent.", { danger: true }))) return;
    const { error } = await detail.deleteWorklog(w.id);
    if (error) await alertDialog(`Couldn't delete: ${error.message}`, { tone: "error" });
    else board.reload();
  };

  const removeComment = async (comment) => {
    if (!(await confirmDialog("Delete this comment?", { danger: true }))) return;
    const { error } = await detail.deleteComment(comment.id);
    if (error) await alertDialog(`Couldn't delete comment: ${error.message}`, { tone: "error" });
  };

  const addLink = async () => {
    const parsed = parseIssueKey(linkTarget.split(/\s+/)[0]);
    const other = parsed && parsed.key === project.issue_key ? tasks.find((t) => t.number === parsed.number) : null;
    if (!other) {
      await alertDialog("Pick an issue from this project, e.g. " + `${project.issue_key}-1`, { tone: "error" });
      return;
    }
    if (other.id === issue.id) {
      await alertDialog("An issue can't link to itself.", { tone: "error" });
      return;
    }
    const choice = LINK_CHOICES.find((c) => c.id === linkChoice);
    const [sourceId, targetId] = choice.inward ? [other.id, issue.id] : [issue.id, other.id];
    const { error } = await detail.addLink(sourceId, targetId, choice.type);
    if (error) {
      const duplicate = /duplicate key|unique/i.test(error.message || "");
      await alertDialog(duplicate ? "Those issues are already linked that way." : `Couldn't link: ${error.message}`, { tone: "error" });
      return;
    }
    setLinkTarget("");
    setShowLinkForm(false);
  };

  const sprintName = (id) => sprints.find((s) => s.id === id)?.name;
  const resolve = {
    employee: (id) => employeesById.get(id)?.name,
    sprint: sprintName,
    issue: (id) => {
      const t = tasksById.get(id);
      return t ? `${issueKey(project, t)} ${t.title}` : null;
    },
    project: (id) => projects.find((p) => p.id === id)?.name,
    status: (key) => statusMeta(key, workflow).label,
  };

  const history = [...detail.activity].reverse();
  const timeline =
    activityTab === "all"
      ? [
          ...detail.comments.map((c) => ({ kind: "comment", at: c.created_at, item: c })),
          ...detail.activity.map((a) => ({ kind: "history", at: a.created_at, item: a })),
        ].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      : null;

  const renderComment = (comment) => {
    const mine = (comment.author_email || "").toLowerCase() === myEmail;
    return (
      <li key={`c-${comment.id}`} className="issue-comment">
        <div className="issue-comment-head">
          <Avatar employee={{ name: comment.author_name || comment.author_email }} />
          <span className="issue-comment-author">{comment.author_name || comment.author_email}</span>
          <span className="issue-comment-time">{formatDateTime(comment.created_at)}</span>
          {(mine || isAdmin) && (
            <button type="button" className="issue-comment-delete" onClick={() => removeComment(comment)} title="Delete comment" aria-label="Delete comment">
              <Icon name="x" size={16} />
            </button>
          )}
        </div>
        <TaskMarkdown text={comment.body} className="issue-comment-body" />
      </li>
    );
  };

  const renderHistory = (entry) => {
    const text = describeActivity(entry, resolve);
    return (
      <li key={`h-${entry.id}`} className="issue-history-row">
        <span className="issue-history-actor">{entry.actor_name || entry.actor_email || "Someone"}</span>{" "}
        {text.verb}
        <span className="issue-history-time">{formatDateTime(entry.created_at)}</span>
        {text.from !== undefined && (
          <div className="issue-history-change">
            <span className="issue-history-from">{text.from}</span> → <span className="issue-history-to">{text.to}</span>
          </div>
        )}
      </li>
    );
  };

  return (
    <Modal isOpen onClose={onClose} size="modal-content-wide issue-modal">
      <div className="issue-modal-top">
        <nav className="issue-breadcrumbs">
          <span>{project.name}</span>
          {parent && (
            <>
              <span className="issue-crumb-sep">/</span>
              <button type="button" className="issue-crumb-link" onClick={() => onOpenIssue(parent.id)}>
                <TypeIcon type={parent.type} /> <span className="mono">{issueKey(project, parent)}</span>
              </button>
            </>
          )}
          <span className="issue-crumb-sep">/</span>
          <span className="issue-crumb-current">
            <TypeIcon type={issue.type} /> <span className="mono">{key}</span>
          </span>
        </nav>
        <div className="issue-modal-actions">
          <button
            type="button"
            className={`btn btn-ghost btn-sm ${issue.flagged ? "is-flagged" : ""}`}
            aria-pressed={Boolean(issue.flagged)}
            onClick={() => save({ flagged: !issue.flagged })}
            title={issue.flagged ? "Remove the flag" : "Flag as impeded"}
          >
            <Icon name="flag" size={16} /> {issue.flagged ? "Flagged" : "Flag"}
          </button>
          <WatchButton detail={detail} currentEmployee={currentEmployee} employeesById={employeesById} />
          <button type="button" className="btn btn-ghost btn-sm" onClick={cloneIssue} title="Copy this issue as a new one">
            <Icon name="copy" size={16} /> Clone
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={copyLink}>
            <Icon name={copied ? "check" : "link"} size={16} /> {copied ? "Copied" : "Copy link"}
          </button>
          {canDelete && !isSubtask && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMoving(true)} title="Move this issue to another project">
              <Icon name="arrow-right" size={16} /> Move
            </button>
          )}
          {canDelete && (
            <button type="button" className="btn btn-ghost btn-sm issue-delete-btn" onClick={handleDelete}>
              <Icon name="trash" size={16} /> Delete
            </button>
          )}
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
      </div>

      <div className="issue-modal-layout">
        <div className="issue-main">
          {editingTitle ? (
            <input
              className="issue-title-input"
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditingTitle(false);
              }}
            />
          ) : (
            <h2
              className="issue-title"
              onClick={() => {
                setTitleDraft(issue.title);
                setEditingTitle(true);
              }}
              title="Click to edit"
            >
              {issue.title}
            </h2>
          )}

          {issue.flagged && (
            <div className="issue-flag-banner" role="status">
              <Icon name="flag" size={16} /> Flagged as impeded. It needs help before it can move on.
            </div>
          )}

          <section className="issue-section">
            <h3 className="eyebrow issue-section-title">Description</h3>
            {editingDescription ? (
              <>
                <textarea
                  className="issue-description-input"
                  rows={8}
                  autoFocus
                  value={descriptionDraft}
                  onChange={(e) => setDescriptionDraft(e.target.value)}
                />
                <div className="issue-edit-actions">
                  <button type="button" className="btn btn-primary btn-sm" onClick={commitDescription}>Save</button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditingDescription(false)}>Cancel</button>
                  <span className="issue-md-hint">**bold**, *italic*, `code`, - lists, links, {project.issue_key}-12</span>
                </div>
              </>
            ) : (
              <div
                className={`issue-description ${issue.description ? "" : "is-empty"}`}
                onClick={() => {
                  setDescriptionDraft(issue.description || "");
                  setEditingDescription(true);
                }}
                title="Click to edit"
              >
                {issue.description ? <TaskMarkdown text={issue.description} /> : "Add a description…"}
              </div>
            )}
          </section>

          <AttachmentsSection detail={detail} myEmail={myEmail} isAdmin={isAdmin} />

          {!isSubtask && (
            <section className="issue-section">
              <div className="issue-section-head">
                <h3 className="eyebrow issue-section-title">{isEpic ? "Issues in this epic" : "Sub-tasks"}</h3>
                {progress.total > 0 && (
                  <span className="issue-progress-text">{progress.done} of {progress.total} done</span>
                )}
              </div>
              {progress.total > 0 && (
                <div className="issue-progress-bar">
                  <span style={{ width: `${progress.percent}%` }} />
                </div>
              )}
              {children.length > 0 && (
                <ul className="issue-child-list">
                  {children.map((child) => (
                    <ChildRow key={child.id} child={child} project={project} employeesById={employeesById} onOpen={onOpenIssue} />
                  ))}
                </ul>
              )}
              <InlineCreate
                placeholder={isEpic ? "Add issue to epic" : "Add sub-task"}
                typeOptions={isEpic ? ISSUE_TYPES.filter((t) => ["story", "task", "bug"].includes(t.value)) : [issueType("subtask")]}
                onCreate={createChild}
              />
            </section>
          )}

          <section className="issue-section">
            <div className="issue-section-head">
              <h3 className="eyebrow issue-section-title">Linked issues</h3>
              {!showLinkForm && (
                <button type="button" className="issue-inline-add" onClick={() => setShowLinkForm(true)}>
                  <Icon name="plus" size={16} strokeWidth={2.2} /> Link issue
                </button>
              )}
            </div>
            {showLinkForm && (
              <div className="issue-link-form">
                <select value={linkChoice} onChange={(e) => setLinkChoice(e.target.value)}>
                  {LINK_CHOICES.map((c) => (
                    <option key={c.id} value={c.id}>{c.phrase}</option>
                  ))}
                </select>
                <input
                  type="text"
                  list={`issue-link-options-${issue.id}`}
                  placeholder={`${project.issue_key}-1`}
                  value={linkTarget}
                  onChange={(e) => setLinkTarget(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addLink();
                    }
                  }}
                  autoFocus
                />
                <datalist id={`issue-link-options-${issue.id}`}>
                  {tasks
                    .filter((t) => t.id !== issue.id)
                    .map((t) => (
                      <option key={t.id} value={`${issueKey(project, t)} ${t.title}`} />
                    ))}
                </datalist>
                <button type="button" className="btn btn-primary btn-sm" onClick={addLink}>Link</button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowLinkForm(false)}>Cancel</button>
              </div>
            )}
            {linkGroups.length === 0 && !showLinkForm && <p className="issue-muted">No linked issues.</p>}
            {linkGroups.map(([phrase, rows]) => (
              <div key={phrase} className="issue-link-group">
                <span className="issue-link-phrase">{phrase}</span>
                <ul className="issue-child-list">
                  {rows.map(({ link, other }) => (
                    <li key={link.id} className="issue-child-row" onClick={() => other && onOpenIssue(other.id)}>
                      {other ? (
                        <>
                          <TypeIcon type={other.type} />
                          <span className="issue-key-text">{issueKey(project, other)}</span>
                          <span className={`issue-child-title ${isDone(other) ? "is-done" : ""}`}>{other.title}</span>
                          <StatusLozenge status={other.status} />
                        </>
                      ) : (
                        <span className="issue-child-title">An issue in another project</span>
                      )}
                      <button
                        type="button"
                        className="issue-comment-delete"
                        title="Remove link"
                        aria-label="Remove link"
                        onClick={async (e) => {
                          e.stopPropagation();
                          const { error } = await detail.deleteLink(link.id);
                          if (error) await alertDialog(`Couldn't remove link: ${error.message}`, { tone: "error" });
                        }}
                      >
                        <Icon name="x" size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>

          <section className="issue-section">
            <div className="issue-section-head">
              <h3 className="eyebrow issue-section-title">Activity</h3>
              <div className="status-tabs issue-activity-tabs">
                {[
                  { value: "all", label: "All" },
                  { value: "comments", label: `Comments (${detail.comments.length})` },
                  { value: "history", label: "History" },
                  { value: "worklog", label: `Work log (${detail.worklogs.length})` },
                ].map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    className={`tab ${activityTab === tab.value ? "tab-active" : ""}`}
                    onClick={() => setActivityTab(tab.value)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {(activityTab === "all" || activityTab === "comments") && (
              <div className="issue-comment-compose">
                <MentionTextarea
                  placeholder="Add a comment… Type @ to mention someone (Ctrl+Enter to post)"
                  value={commentDraft}
                  onChange={setCommentDraft}
                  mentions={commentMentions}
                  onMentionsChange={setCommentMentions}
                  employees={employees}
                  onSubmit={postComment}
                />
                <button type="button" className="btn btn-secondary btn-sm" onClick={postComment} disabled={isPosting || !commentDraft.trim()}>
                  {isPosting ? "Posting..." : "Save"}
                </button>
              </div>
            )}

            <ul className="issue-activity-list">
              {activityTab === "comments" &&
                (detail.comments.length === 0 ? (
                  <li className="issue-muted">No comments yet.</li>
                ) : (
                  [...detail.comments].reverse().map(renderComment)
                ))}
              {activityTab === "history" && history.map(renderHistory)}
              {activityTab === "worklog" && (
                <WorklogList worklogs={detail.worklogs} myEmail={myEmail} isAdmin={isAdmin} onDelete={removeWorklog} />
              )}
              {activityTab === "all" &&
                timeline.map((entry) => (entry.kind === "comment" ? renderComment(entry.item) : renderHistory(entry.item)))}
            </ul>
          </section>
        </div>

        <aside className="issue-sidebar">
          <div className="issue-field">
            <label>Status</label>
            <select className={`issue-status-select status-${statusMeta(issue.status, workflow).cls}`} value={issue.status} onChange={(e) => save({ status: e.target.value })}>
              {/* Only the statuses this one may move to, as Jira's transition menu. */}
              {nextStatuses(issue.status, workflow).map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
              {!workflow.some((s) => s.value === issue.status) && (
                <option value={issue.status}>{statusMeta(issue.status, workflow).label}</option>
              )}
            </select>
          </div>

          <div className="issue-field">
            <label>Assignee</label>
            <select
              value={issue.assignee_id ?? ""}
              onChange={(e) => save({ assignee_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">Unassigned</option>
              {assignees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
            {currentEmployee && issue.assignee_id !== currentEmployee.id && (
              <button type="button" className="issue-field-link" onClick={() => save({ assignee_id: currentEmployee.id })}>
                Assign to me
              </button>
            )}
          </div>

          <div className="issue-field">
            <label>Reporter</label>
            <select
              value={issue.reporter_id ?? ""}
              onChange={(e) => save({ reporter_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">None</option>
              {assignees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div className="issue-field">
            <label>Issue type</label>
            {isSubtask ? (
              <div className="issue-field-static"><TypeIcon type="subtask" /> Sub-task</div>
            ) : (
              <select value={issue.type} onChange={(e) => changeType(e.target.value)}>
                {ISSUE_TYPES.filter((t) => t.value !== "subtask").map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            )}
          </div>

          <div className="issue-field">
            <label>Priority</label>
            <select value={issue.priority} onChange={(e) => save({ priority: e.target.value })}>
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>

          {!isEpic && (
            <div className="issue-field">
              <label>{isSubtask ? "Parent" : "Epic"}</label>
              <select
                value={issue.parent_id ?? ""}
                onChange={(e) => save({ parent_id: e.target.value ? Number(e.target.value) : null })}
              >
                {!isSubtask && <option value="">No epic</option>}
                {parentCandidates(tasks, issue).map((t) => (
                  <option key={t.id} value={t.id}>{issueKey(project, t)} {t.title}</option>
                ))}
              </select>
            </div>
          )}

          {!isEpic && (
            <div className="issue-field">
              <label>Sprint</label>
              {isSubtask ? (
                <div className="issue-field-static">{sprintName(issue.sprint_id) || "Backlog"} <span className="issue-muted">(from parent)</span></div>
              ) : (
                <select
                  value={issue.sprint_id ?? ""}
                  onChange={(e) => save({ sprint_id: e.target.value ? Number(e.target.value) : null })}
                >
                  <option value="">Backlog</option>
                  {openSprints.map((s) => (
                    <option key={s.id} value={s.id} disabled={s.state === "closed"}>
                      {s.name}{s.state === "active" ? " (active)" : s.state === "closed" ? " (closed)" : ""}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {!isEpic && !isSubtask && (
            <div className="issue-field">
              <label>Story points</label>
              <select
                value={issue.estimate == null ? "" : String(Number(issue.estimate))}
                onChange={(e) => save({ estimate: e.target.value })}
              >
                <option value="">None</option>
                {ESTIMATE_OPTIONS.map((n) => (
                  <option key={n} value={String(n)}>{n}</option>
                ))}
                {issue.estimate != null && !ESTIMATE_OPTIONS.includes(Number(issue.estimate)) && (
                  <option value={String(Number(issue.estimate))}>{Number(issue.estimate)}</option>
                )}
              </select>
            </div>
          )}

          <div className="issue-field">
            <label>Fix version</label>
            <select
              value={issue.fix_version_id ?? ""}
              onChange={(e) => save({ fix_version_id: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">None</option>
              {sortVersions(versions)
                .filter((v) => v.status !== "archived" || v.id === issue.fix_version_id)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}{v.status === "released" ? " (released)" : v.status === "archived" ? " (archived)" : ""}
                  </option>
                ))}
            </select>
          </div>

          <TimeTrackingPanel issue={issue} detail={detail} save={save} today={today} onLogged={board.reload} />

          <div className="issue-field">
            <label>Due date</label>
            <input
              type="date"
              className={isOverdue(issue, today) ? "is-overdue" : ""}
              value={dueDraft ?? (issue.due_date ? String(issue.due_date).slice(0, 10) : "")}
              onChange={(e) => setDueDraft(e.target.value)}
              onBlur={async () => {
                // Saved on blur: typing a year fires a full date per digit (0002-, 0020-, …).
                const current = issue.due_date ? String(issue.due_date).slice(0, 10) : "";
                if (dueDraft != null && dueDraft !== current) await save({ due_date: dueDraft });
                setDueDraft(null);
              }}
            />
          </div>

          <div className="issue-field">
            <label>Labels</label>
            <input
              type="text"
              placeholder="Comma separated"
              value={labelsDraft ?? (issue.labels || []).join(", ")}
              onChange={(e) => setLabelsDraft(e.target.value)}
              onBlur={async () => {
                if (labelsDraft != null && labelsDraft !== (issue.labels || []).join(", ")) await save({ labels: labelsDraft });
                setLabelsDraft(null);
              }}
            />
          </div>

          <div className="issue-field">
            <label>Development</label>
            <input
              type="text"
              placeholder="GitHub PR or Jira URL"
              value={linkUrlDraft ?? (issue.external_url || "")}
              onChange={(e) => setLinkUrlDraft(e.target.value)}
              onBlur={async () => {
                if (linkUrlDraft != null && linkUrlDraft !== (issue.external_url || "")) await save({ external_url: linkUrlDraft });
                setLinkUrlDraft(null);
              }}
            />
            {devLink && (
              <a className={`issue-dev-link link-${devLink.kind}`} href={devLink.url} target="_blank" rel="noopener noreferrer">
                {devLink.label} <Icon name="external" size={14} />
              </a>
            )}
          </div>

          {isEpic && (
            <div className="issue-field">
              <label>Epic colour</label>
              <div className="issue-epic-swatches">
                {EPIC_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`issue-epic-swatch ${epicColor(issue) === color ? "active" : ""}`}
                    style={{ background: color }}
                    onClick={() => save({ epic_color: color })}
                    aria-label={`Use colour ${color}`}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="issue-meta">
            <div>Created {formatDateTime(issue.created_at)}</div>
            {issue.updated_at && <div>Updated {formatDateTime(issue.updated_at)}</div>}
            {issue.completed_at && <div>Resolved {formatDateTime(issue.completed_at)}</div>}
          </div>
        </aside>
      </div>

      {moving && (
        <MoveIssueModal
          issue={issue}
          issueKeyText={key}
          project={project}
          projects={projects}
          subtaskCount={children.filter((c) => c.type === "subtask").length}
          childCount={children.length}
          board={board}
          onMoved={afterMove}
          onClose={() => setMoving(false)}
        />
      )}
    </Modal>
  );
}
