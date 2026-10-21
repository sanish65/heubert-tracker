"use client";

import { Fragment, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import {
  ISSUE_TYPES,
  issueKey,
  filterIssues,
  backlogSections,
  orderForDrop,
  childProgress,
  sumPoints,
  statusInfo,
  canDeleteTask,
} from "@/lib/taskBoard";
import Icon from "@/components/Icon";
import { TypeIcon, PriorityIcon, StatusLozenge, StatusDot, Avatar, EpicChip, PointsBadge, formatShortDate, epicColor } from "@/components/TaskBits";

const EPICS_PANEL_KEY = "heubert-tasks-epics-panel";
const ROW_TYPES = ISSUE_TYPES.filter((t) => ["story", "task", "bug"].includes(t.value));

function readPanel() {
  try {
    return localStorage.getItem(EPICS_PANEL_KEY) !== "closed";
  } catch {
    return true;
  }
}

// Points per status category, Jira's three pills on a sprint header.
function categoryPoints(issues) {
  const totals = { todo: 0, progress: 0, done: 0 };
  for (const t of issues) totals[statusInfo(t.status).category] += Number(t.estimate) || 0;
  return totals;
}

function InlineCreateRow({ onCreate }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("story");
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  if (!open) {
    return (
      <button type="button" className="backlog-create-btn" onClick={() => setOpen(true)}>
        <Icon name="plus" size={16} strokeWidth={2.2} /> Create issue
      </button>
    );
  }

  const submit = async () => {
    if (busy || !title.trim()) return;
    setBusy(true);
    const ok = await onCreate({ title, type });
    setBusy(false);
    if (ok) setTitle("");
    // Keep typing the next issue; focus left on the page would hand the next "c" or
    // "/" to the keyboard shortcuts.
    inputRef.current?.focus();
  };

  return (
    <div className="backlog-inline-create">
      <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Issue type">
        {ROW_TYPES.map((t) => (
          <option key={t.value} value={t.value}>{t.label}</option>
        ))}
      </select>
      <input
        type="text"
        autoFocus
        placeholder="What needs to be done? (Enter to create, Esc to close)"
        value={title}
        ref={inputRef}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submit();
          }
          if (e.key === "Escape") setOpen(false);
        }}
        readOnly={busy}
      />
    </div>
  );
}

function BacklogRow({ task, project, tasks, tasksById, employeesById, isDragging, onOpen, onDragStart, onDragEnd, onDragOver }) {
  const epic = task.parent_id != null ? tasksById.get(task.parent_id) : null;
  const progress = childProgress(task.id, tasks);
  return (
    <li
      className={`backlog-row ${isDragging ? "dragging" : ""}`}
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, task)}
      onClick={() => onOpen(task.id)}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen(task.id);
      }}
    >
      <TypeIcon type={task.type} />
      <span className={`issue-key-text ${task.status === "done" ? "is-done" : ""}`}>{issueKey(project, task)}</span>
      <span className="backlog-row-title">{task.title}</span>
      <span className="backlog-row-meta">
        <EpicChip epic={epic} />
        {progress.total > 0 && (
          <span className="board-card-subtasks" title="Sub-tasks done">
            <Icon name="check" size={14} strokeWidth={2} />
            {progress.done}/{progress.total}
          </span>
        )}
        <StatusLozenge status={task.status} />
        <PointsBadge value={task.estimate} />
        <PriorityIcon priority={task.priority} />
        <Avatar employee={employeesById.get(task.assignee_id)} />
      </span>
    </li>
  );
}

export default function TaskBacklogView({
  project,
  tasks,
  sprints,
  filters,
  currentEmployeeId,
  employeesById,
  tasksById,
  board,
  onOpenIssue,
  onCreateSprint,
  onEditSprint,
  onStartSprint,
  onCompleteSprint,
}) {
  const { user, isAdmin } = useApp();
  const { confirmDialog, alertDialog } = useDialog();
  const [epicFilter, setEpicFilter] = useState(null);
  const [showEpics, setShowEpics] = useState(readPanel);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [draggingId, setDraggingId] = useState(null);
  // { sectionId, beforeId } — sectionId is a sprint id, or "backlog".
  const [dropTarget, setDropTarget] = useState(null);
  const [newEpicTitle, setNewEpicTitle] = useState("");
  const [creatingEpic, setCreatingEpic] = useState(false);

  const keyOf = (t) => issueKey(project, t);
  const { sprints: sections, backlog, hiddenDone } = backlogSections(tasks, sprints);
  const visibleFilters = { ...filters, epicId: epicFilter };
  const applyFilters = (list) =>
    filterIssues(list, visibleFilters, { currentEmployeeId, keyOf }).filter((t) => t.id !== epicFilter);
  const hasActive = sprints.some((s) => s.state === "active");
  const epics = tasks.filter((t) => t.type === "epic").sort((a, b) => (a.number ?? 0) - (b.number ?? 0));

  const togglePanel = () => {
    setShowEpics((prev) => {
      try {
        localStorage.setItem(EPICS_PANEL_KEY, prev ? "closed" : "open");
      } catch {}
      return !prev;
    });
  };

  const toggleSection = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const createIn = (sprintId) => async ({ title, type }) => {
    const { error } = await board.createIssue({ title, type, sprint_id: sprintId, parent_id: epicFilter });
    if (error) {
      await alertDialog(`Couldn't create the issue: ${error.message}`, { tone: "error" });
      return false;
    }
    return true;
  };

  const createEpic = async () => {
    if (creatingEpic || !newEpicTitle.trim()) return;
    setCreatingEpic(true);
    const { error } = await board.createIssue({ title: newEpicTitle, type: "epic" });
    setCreatingEpic(false);
    if (error) {
      await alertDialog(`Couldn't create the epic: ${error.message}`, { tone: "error" });
      return;
    }
    setNewEpicTitle("");
  };

  const deleteSprint = async (sprint, count) => {
    const note = count ? ` Its ${count} ${count === 1 ? "issue goes" : "issues go"} back to the backlog.` : "";
    if (!(await confirmDialog(`Delete ${sprint.name}?${note}`, { danger: true }))) return;
    const { error } = await board.deleteSprint(sprint.id);
    if (error) await alertDialog(`Couldn't delete the sprint: ${error.message}`, { tone: "error" });
  };

  const handleDragStart = (e, task) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(task.id));
    setDraggingId(task.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
  };

  const rowDragOver = (sectionId, list) => (e, task) => {
    if (draggingId == null) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const below = e.clientY > rect.top + rect.height / 2;
    const index = list.findIndex((t) => t.id === task.id);
    const beforeId = below ? list[index + 1]?.id ?? null : task.id;
    if (dropTarget?.sectionId !== sectionId || dropTarget?.beforeId !== beforeId) setDropTarget({ sectionId, beforeId });
  };

  const sectionDragOver = (sectionId) => (e) => {
    if (draggingId == null) return;
    e.preventDefault();
    if (dropTarget?.sectionId !== sectionId) setDropTarget({ sectionId, beforeId: null });
  };

  const sectionDrop = (sectionId, fullList) => async (e) => {
    e.preventDefault();
    const id = draggingId ?? Number(e.dataTransfer.getData("text/plain"));
    const target = dropTarget?.sectionId === sectionId ? dropTarget : { sectionId, beforeId: null };
    setDraggingId(null);
    setDropTarget(null);
    if (!id || target.beforeId === id) return;
    const sort_order = orderForDrop(fullList, target.beforeId, id);
    const sprint_id = sectionId === "backlog" ? null : sectionId;
    const { error } = await board.moveIssue(id, { sprint_id, sort_order });
    if (error) await alertDialog(`Couldn't move the issue: ${error.message || "Check connection"}`, { tone: "error" });
  };

  const renderRows = (sectionId, fullList) => {
    const rows = applyFilters(fullList);
    const isTarget = dropTarget?.sectionId === sectionId;
    return (
      <ul className={`backlog-rows ${isTarget ? "drop-active" : ""}`} onDragOver={sectionDragOver(sectionId)} onDrop={sectionDrop(sectionId, fullList)}>
        {rows.map((task) => (
          <Fragment key={task.id}>
            {isTarget && dropTarget.beforeId === task.id && draggingId !== task.id && <li className="board-drop-indicator" />}
            <BacklogRow
              task={task}
              project={project}
              tasks={tasks}
              tasksById={tasksById}
              employeesById={employeesById}
              isDragging={draggingId === task.id}
              onOpen={onOpenIssue}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={rowDragOver(sectionId, rows)}
            />
          </Fragment>
        ))}
        {isTarget && dropTarget.beforeId == null && <li className="board-drop-indicator" />}
        {rows.length === 0 && (
          <li className="backlog-empty">
            {fullList.length === 0
              ? sectionId === "backlog"
                ? "Your backlog is empty."
                : "Plan this sprint by dragging issues here from the backlog."
              : "No issues match these filters."}
          </li>
        )}
      </ul>
    );
  };

  return (
    <div className={`backlog-view ${showEpics ? "with-epics" : ""}`}>
      {showEpics && (
        <aside className="backlog-epics glass">
          <div className="backlog-epics-head">
            <h3 className="eyebrow">Epics</h3>
            <button type="button" className="btn-icon btn-sm" onClick={togglePanel} title="Hide epics" aria-label="Hide epics">
              <Icon name="x" size={16} />
            </button>
          </div>
          <button
            type="button"
            className={`backlog-epic-item ${epicFilter == null ? "active" : ""}`}
            onClick={() => setEpicFilter(null)}
          >
            All issues
          </button>
          {epics.map((epic) => {
            const progress = childProgress(epic.id, tasks);
            const color = epicColor(epic);
            return (
              <div key={epic.id} className={`backlog-epic-item ${epicFilter === epic.id ? "active" : ""}`} style={{ borderLeftColor: color }}>
                <button type="button" className="backlog-epic-name" onClick={() => setEpicFilter(epicFilter === epic.id ? null : epic.id)}>
                  {epic.title}
                </button>
                <div className="backlog-epic-progress" title={`${progress.done} of ${progress.total} done`}>
                  <span style={{ width: `${progress.percent}%`, background: color }} />
                </div>
                <div className="backlog-epic-foot">
                  <span><span className="mono">{issueKey(project, epic)}</span> · {progress.total} issues</span>
                  <button type="button" className="issue-field-link" onClick={() => onOpenIssue(epic.id)}>Details</button>
                </div>
              </div>
            );
          })}
          <div className="backlog-epic-create">
            <input
              type="text"
              placeholder="+ Create epic"
              value={newEpicTitle}
              onChange={(e) => setNewEpicTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  createEpic();
                }
              }}
            />
          </div>
        </aside>
      )}

      <div className="backlog-main">
        {!showEpics && (
          <button type="button" className="btn btn-ghost btn-sm backlog-show-epics" onClick={togglePanel}>
            <Icon name="layers" size={16} /> Show epics
          </button>
        )}

        {sections.map(({ sprint, issues }) => {
          const isCollapsed = collapsed.has(sprint.id);
          const points = categoryPoints(issues);
          const canDeleteSprint = canDeleteTask({ task: sprint, isAdmin, email: user?.email });
          return (
            <section key={sprint.id} className={`backlog-section glass ${sprint.state === "active" ? "is-active" : ""}`}>
              <header className="backlog-section-head">
                <button type="button" className="backlog-section-toggle" onClick={() => toggleSection(sprint.id)}>
                  <Icon name="chevron-down" size={16} className={`board-lane-caret ${isCollapsed ? "collapsed" : ""}`} />
                  <StatusDot status={sprint.state === "active" ? "in_progress" : "todo"} />
                  <strong>{sprint.name}</strong>
                  {sprint.state === "active" && <span className="pill pill-blue">Active</span>}
                  <span className="backlog-section-sub">
                    {sprint.start_date && sprint.end_date
                      ? `${formatShortDate(sprint.start_date)} – ${formatShortDate(sprint.end_date)}`
                      : "Dates not set"}
                    {" · "}
                    {issues.length} {issues.length === 1 ? "issue" : "issues"}
                  </span>
                </button>
                <div className="backlog-section-actions">
                  <span className="pill pill-blue backlog-points" title="To Do points">{points.todo}</span>
                  <span className="pill pill-amber backlog-points" title="In progress points">{points.progress}</span>
                  <span className="pill pill-green backlog-points" title="Done points">{points.done}</span>
                  {sprint.state === "active" ? (
                    <button className="btn btn-secondary btn-sm" onClick={() => onCompleteSprint(sprint)}>Complete sprint</button>
                  ) : (
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onStartSprint(sprint, issues.length)}
                      disabled={hasActive}
                      title={hasActive ? "Complete the active sprint first" : "Start this sprint"}
                    >
                      Start sprint
                    </button>
                  )}
                  <button className="btn btn-ghost btn-sm" onClick={() => onEditSprint(sprint)}>
                    <Icon name="edit" size={16} /> Edit
                  </button>
                  {canDeleteSprint && sprint.state !== "active" && (
                    <button className="btn btn-ghost btn-sm issue-delete-btn" onClick={() => deleteSprint(sprint, issues.length)}>
                      <Icon name="trash" size={16} /> Delete
                    </button>
                  )}
                </div>
              </header>
              {sprint.goal && !isCollapsed && (
                <p className="backlog-sprint-goal">
                  <Icon name="flag" size={14} /> {sprint.goal}
                </p>
              )}
              {!isCollapsed && (
                <>
                  {renderRows(sprint.id, issues)}
                  <InlineCreateRow onCreate={createIn(sprint.id)} />
                </>
              )}
            </section>
          );
        })}

        <section className="backlog-section glass">
          <header className="backlog-section-head">
            <button type="button" className="backlog-section-toggle" onClick={() => toggleSection("backlog")}>
              <Icon name="chevron-down" size={16} className={`board-lane-caret ${collapsed.has("backlog") ? "collapsed" : ""}`} />
              <StatusDot status="backlog" />
              <strong>Backlog</strong>
              <span className="backlog-section-sub">
                {backlog.length} {backlog.length === 1 ? "issue" : "issues"} · {sumPoints(backlog)} pts
                {hiddenDone > 0 && ` · ${hiddenDone} done hidden`}
              </span>
            </button>
            <div className="backlog-section-actions">
              <button className="btn btn-secondary btn-sm" onClick={onCreateSprint}>Create sprint</button>
            </div>
          </header>
          {!collapsed.has("backlog") && (
            <>
              {renderRows("backlog", backlog)}
              <InlineCreateRow onCreate={createIn(null)} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}
