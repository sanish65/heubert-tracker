"use client";

import { Fragment, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import {
  ISSUE_TYPES,
  PRIORITIES,
  issueKey,
  filterIssues,
  backlogSections,
  orderForDrop,
  childProgress,
  sumPoints,
  statusInfo,
  canDeleteTask,
} from "@/lib/taskBoard";
import { isDone } from "@/lib/taskWorkflow";
import { sortVersions } from "@/lib/taskExtras";
import { useWorkflow } from "@/components/TaskWorkflowContext";
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
  for (const t of issues) totals[t.status_category || statusInfo(t.status).category] += Number(t.estimate) || 0;
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

function BacklogRow({ task, project, tasks, tasksById, employeesById, isDragging, selected, onToggleSelect, onOpen, onDragStart, onDragEnd, onDragOver }) {
  const epic = task.parent_id != null ? tasksById.get(task.parent_id) : null;
  const progress = childProgress(task.id, tasks);
  return (
    <li
      className={`backlog-row ${isDragging ? "dragging" : ""} ${selected ? "is-selected" : ""} ${task.flagged ? "is-flagged" : ""}`}
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
      <input
        type="checkbox"
        className="backlog-row-check"
        checked={selected}
        aria-label={`Select ${issueKey(project, task)}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onChange={(e) => onToggleSelect(task.id, e.nativeEvent.shiftKey)}
      />
      <TypeIcon type={task.type} />
      <span className={`issue-key-text ${isDone(task) ? "is-done" : ""}`}>{issueKey(project, task)}</span>
      {task.flagged && (
        <span className="board-card-flag" title="Flagged as impeded" aria-label="Flagged">
          <Icon name="flag" size={14} strokeWidth={2.2} />
        </span>
      )}
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

// The bar that appears while backlog rows are ticked: one change for all of them.
function BulkBar({ count, sprints, versions, employees, isKanban, canDelete, onApply, onDelete, onClear }) {
  const workflow = useWorkflow();
  const [busy, setBusy] = useState(false);
  const apply = async (fields) => {
    setBusy(true);
    await onApply(fields);
    setBusy(false);
  };
  const pick = (handler) => (e) => {
    const value = e.target.value;
    e.target.value = "";
    if (value !== "") handler(value);
  };
  return (
    <div className="backlog-bulk glass" role="region" aria-label="Bulk edit">
      <strong>{count} selected</strong>
      {!isKanban && (
        <select aria-label="Move to sprint" defaultValue="" disabled={busy} onChange={pick((v) => apply({ sprint_id: v === "backlog" ? null : Number(v) }))}>
          <option value="" disabled>Move to…</option>
          <option value="backlog">Backlog</option>
          {sprints.filter((s) => s.state !== "closed").map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      )}
      <select aria-label="Set status" defaultValue="" disabled={busy} onChange={pick((v) => apply({ status: v }))}>
        <option value="" disabled>Status…</option>
        {workflow.map((st) => (
          <option key={st.value} value={st.value}>{st.label}</option>
        ))}
      </select>
      <select aria-label="Set assignee" defaultValue="" disabled={busy} onChange={pick((v) => apply({ assignee_id: v === "none" ? null : Number(v) }))}>
        <option value="" disabled>Assignee…</option>
        <option value="none">Unassigned</option>
        {employees.filter((e) => e.status === "active").map((e) => (
          <option key={e.id} value={e.id}>{e.name}</option>
        ))}
      </select>
      <select aria-label="Set priority" defaultValue="" disabled={busy} onChange={pick((v) => apply({ priority: v }))}>
        <option value="" disabled>Priority…</option>
        {PRIORITIES.map((pr) => (
          <option key={pr.value} value={pr.value}>{pr.label}</option>
        ))}
      </select>
      {versions.length > 0 && (
        <select aria-label="Set fix version" defaultValue="" disabled={busy} onChange={pick((v) => apply({ fix_version_id: v === "none" ? null : Number(v) }))}>
          <option value="" disabled>Fix version…</option>
          <option value="none">None</option>
          {sortVersions(versions).filter((v) => v.status === "unreleased").map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      )}
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => apply({ flagged: true })}>
        <Icon name="flag" size={16} /> Flag
      </button>
      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => apply({ flagged: false })}>
        Unflag
      </button>
      {canDelete && (
        <button type="button" className="btn btn-ghost btn-sm issue-delete-btn" disabled={busy} onClick={onDelete}>
          <Icon name="trash" size={16} /> Delete
        </button>
      )}
      <button type="button" className="btn-icon btn-sm backlog-bulk-close" aria-label="Clear selection" onClick={onClear}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

export default function TaskBacklogView({
  project,
  tasks,
  sprints,
  versions = [],
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
  const { user, isAdmin, employees } = useApp();
  const { confirmDialog, alertDialog } = useDialog();
  const [epicFilter, setEpicFilter] = useState(null);
  const [showEpics, setShowEpics] = useState(readPanel);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [draggingId, setDraggingId] = useState(null);
  // { sectionId, beforeId } — sectionId is a sprint id, or "backlog".
  const [dropTarget, setDropTarget] = useState(null);
  const [newEpicTitle, setNewEpicTitle] = useState("");
  const [creatingEpic, setCreatingEpic] = useState(false);
  const [selected, setSelected] = useState(() => new Set());
  const [lastPicked, setLastPicked] = useState(null);

  const keyOf = (t) => issueKey(project, t);
  // A Kanban project has no sprints: the backlog is one ranked list of open work.
  const isKanban = project.board_mode === "kanban";
  const { sprints: sections, backlog, hiddenDone } = isKanban
    ? backlogSections(tasks.map((t) => (t.sprint_id == null ? t : { ...t, sprint_id: null })), [])
    : backlogSections(tasks, sprints);
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

  // ── Bulk edit ──
  // Only rows on screen count: not ones a filter hides or a collapsed section folds away,
  // so a bulk change never touches issues the person can't see ticked.
  const listedIds = [
    ...sections.filter((sec) => !collapsed.has(sec.sprint.id)).flatMap((sec) => applyFilters(sec.issues)),
    ...(collapsed.has("backlog") ? [] : applyFilters(backlog)),
  ].map((t) => t.id);
  const selectedIds = [...selected].filter((id) => tasksById.has(id) && listedIds.includes(id));
  const toggleSelect = (id, withShift) => {
    setSelected((prev) => {
      const next = new Set(prev);
      // Shift-click ticks everything between the last ticked row and this one.
      if (withShift && lastPicked != null && listedIds.includes(lastPicked) && listedIds.includes(id)) {
        const [a, b] = [listedIds.indexOf(lastPicked), listedIds.indexOf(id)].sort((x, y) => x - y);
        for (const rowId of listedIds.slice(a, b + 1)) next.add(rowId);
      } else if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setLastPicked(id);
  };
  const clearSelection = () => setSelected(new Set());
  const canBulkDelete = selectedIds.every((id) => canDeleteTask({ task: tasksById.get(id), isAdmin, email: user?.email }));

  const applyBulk = async (fields) => {
    const { error, skipped } = await board.bulkUpdate(selectedIds, fields);
    if (error) await alertDialog(`Couldn't update the issues: ${error.message}`, { tone: "error" });
    else if (skipped) {
      await alertDialog(`${skipped} ${skipped === 1 ? "issue wasn't" : "issues weren't"} moved: the workflow doesn't allow that status change from where ${skipped === 1 ? "it is" : "they are"}.`);
    }
  };

  const deleteBulk = async () => {
    if (!(await confirmDialog(`Delete ${selectedIds.length} issues? Their sub-tasks are deleted with them. This can't be undone.`, { danger: true }))) return;
    const { error } = await board.bulkDelete(selectedIds);
    if (error) await alertDialog(`Couldn't delete: ${error.message}`, { tone: "error" });
    else clearSelection();
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
    // Kanban lists everything in one section; reordering there must not take an issue out
    // of the sprint it keeps for when the project goes back to Scrum.
    const fields = isKanban ? { sort_order } : { sprint_id: sectionId === "backlog" ? null : sectionId, sort_order };
    const { error } = await board.moveIssue(id, fields);
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
              selected={selected.has(task.id)}
              onToggleSelect={toggleSelect}
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

        {selectedIds.length > 0 && (
          <BulkBar
            count={selectedIds.length}
            sprints={sprints}
            versions={versions}
            employees={employees}
            isKanban={isKanban}
            canDelete={canBulkDelete}
            onApply={applyBulk}
            onDelete={deleteBulk}
            onClear={clearSelection}
          />
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
              <strong>{isKanban ? "Open work" : "Backlog"}</strong>
              <span className="backlog-section-sub">
                {backlog.length} {backlog.length === 1 ? "issue" : "issues"} · {sumPoints(backlog)} pts
                {hiddenDone > 0 && ` · ${hiddenDone} done hidden`}
              </span>
            </button>
            {!isKanban && (
              <div className="backlog-section-actions">
                <button className="btn btn-secondary btn-sm" onClick={onCreateSprint}>Create sprint</button>
              </div>
            )}
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
