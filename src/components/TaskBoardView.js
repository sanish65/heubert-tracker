"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import {
  issueKey,
  activeSprintOf,
  boardIssues,
  filterIssues,
  groupByStatus,
  swimlanes,
  orderForDrop,
  childProgress,
  sumPoints,
  isOverdue,
  daysBetween,
  describeExternalLink,
} from "@/lib/taskBoard";
import { kanbanIssues, normalizeWipLimits, wipStatus } from "@/lib/taskExtras";
import { useWorkflow } from "@/components/TaskWorkflowContext";
import { canTransition, isDone } from "@/lib/taskWorkflow";
import Icon from "@/components/Icon";
import { TypeIcon, PriorityIcon, StatusDot, Avatar, EpicChip, PointsBadge, formatShortDate, epicColor } from "@/components/TaskBits";

const SWIMLANE_KEY = "heubert-tasks-swimlanes";

function readSwimlanes() {
  try {
    return localStorage.getItem(SWIMLANE_KEY) || "none";
  } catch {
    return "none";
  }
}

function BoardCard({ task, project, tasks, tasksById, employeesById, today, isDragging, onOpen, onDragStart, onDragEnd, onDragOver }) {
  const owner = task.type === "subtask" ? tasksById.get(task.parent_id) : task;
  const epic = owner?.parent_id != null ? tasksById.get(owner.parent_id) : null;
  const parent = task.type === "subtask" ? owner : null;
  const progress = task.type !== "subtask" ? childProgress(task.id, tasks) : null;
  const link = describeExternalLink(task.external_url);
  const overdue = isOverdue(task, today);
  const { animationsEnabled } = useApp();

  return (
    <article
      className={`board-card ${animationsEnabled !== false ? "card-lift" : ""} ${isDragging ? "dragging" : ""} ${isDone(task) ? "is-done" : ""} ${task.flagged ? "is-flagged" : ""}`}
      draggable
      onDragStart={(e) => onDragStart(e, task)}
      onDragEnd={onDragEnd}
      onDragOver={(e) => onDragOver(e, task)}
      onClick={() => onOpen(task.id)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        // Keys pressed on the development link inside the card belong to the link.
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(task.id);
        }
      }}
    >
      <div className="board-card-top">
        <TypeIcon type={task.type} />
        <span className={`issue-key-text ${isDone(task) ? "is-done" : ""}`}>{issueKey(project, task)}</span>
        {task.flagged && (
          <span className="board-card-flag" title="Flagged as impeded" aria-label="Flagged">
            <Icon name="flag" size={14} strokeWidth={2.2} />
          </span>
        )}
        <PriorityIcon priority={task.priority} />
      </div>
      {parent && <div className="board-card-parent">↳ {issueKey(project, parent)} {parent.title}</div>}
      <h4 className="board-card-title">{task.title}</h4>
      {(epic || task.labels?.length > 0) && (
        <div className="board-card-tags">
          <EpicChip epic={epic} />
          {(task.labels || []).map((label) => (
            <span key={label} className="pill pill-gray issue-label">#{label}</span>
          ))}
        </div>
      )}
      <div className="board-card-foot">
        <PointsBadge value={task.type === "subtask" ? null : task.estimate} />
        {task.due_date && (
          <span className={`board-card-due ${overdue ? "overdue" : ""}`} title={overdue ? "Overdue" : "Due date"}>
            <Icon name="calendar" size={14} strokeWidth={2} />
            {formatShortDate(task.due_date)}
          </span>
        )}
        {progress?.total > 0 && (
          <span className="board-card-subtasks" title="Sub-tasks done">
            <Icon name="check" size={14} strokeWidth={2} />
            {progress.done}/{progress.total}
          </span>
        )}
        {link && (
          <a
            className="board-card-link"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            title={link.label}
            aria-label={link.label}
          >
            <Icon name="link" size={14} strokeWidth={2} />
          </a>
        )}
        <span className="board-card-assignee">
          <Avatar employee={employeesById.get(task.assignee_id)} />
        </span>
      </div>
    </article>
  );
}

export default function TaskBoardView({ project, tasks, sprints, filters, currentEmployeeId, employeesById, tasksById, today, board, onOpenIssue, onCompleteSprint, onGoToBacklog }) {
  const { alertDialog } = useDialog();
  const [laneMode, setLaneMode] = useState(readSwimlanes);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [draggingId, setDraggingId] = useState(null);
  // { laneId, status, beforeId } — beforeId null means the bottom of that cell.
  const [dropTarget, setDropTarget] = useState(null);

  // Scrum boards show the active sprint; Kanban boards show all open work, no sprints.
  const isKanban = project.board_mode === "kanban";
  const sprint = isKanban ? null : activeSprintOf(sprints);
  const sprintIssues = useMemo(
    () => (isKanban ? kanbanIssues(tasks) : boardIssues(tasks, sprint?.id ?? null)),
    [tasks, sprint, isKanban]
  );
  const workflow = useWorkflow();
  const wipLimits = normalizeWipLimits(project.wip_limits, workflow.filter((s) => s.category !== "done").map((s) => s.value));
  // WIP counts every issue in the column, not only the ones a filter leaves visible.
  const columnTotals = groupByStatus(sprintIssues, workflow);
  const keyOf = (t) => issueKey(project, t);
  const visible = filterIssues(sprintIssues, filters, { currentEmployeeId, keyOf });
  const lanes = swimlanes(visible, laneMode, { employeesById, tasksById });
  const columnCounts = groupByStatus(visible, workflow);
  // While a card is dragged, the columns its workflow doesn't allow it into refuse it.
  const draggingStatus = draggingId == null ? null : tasksById.get(draggingId)?.status;
  const canDropIn = (status) => draggingStatus == null || canTransition(draggingStatus, status, workflow);

  const changeLaneMode = (mode) => {
    setLaneMode(mode);
    try {
      localStorage.setItem(SWIMLANE_KEY, mode);
    } catch {}
  };

  if (!isKanban && !sprint) {
    return (
      <div className="tasks-empty-state glass">
        <div className="tasks-empty-icon"><Icon name="kanban" size={22} /></div>
        <h3>No active sprint</h3>
        <p>Plan a sprint in the backlog and start it to see its work here.</p>
        <button className="btn btn-primary" onClick={onGoToBacklog}>Go to backlog</button>
      </div>
    );
  }

  const daysLeft = sprint?.end_date ? daysBetween(today, sprint.end_date) : null;

  const handleDragStart = (e, task) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", String(task.id));
    setDraggingId(task.id);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDropTarget(null);
  };

  const cardDragOver = (laneId, cell) => (e, task) => {
    if (draggingId == null || !canDropIn(task.status)) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const below = e.clientY > rect.top + rect.height / 2;
    const index = cell.findIndex((t) => t.id === task.id);
    const beforeId = below ? cell[index + 1]?.id ?? null : task.id;
    if (dropTarget?.laneId !== laneId || dropTarget?.status !== task.status || dropTarget?.beforeId !== beforeId) {
      setDropTarget({ laneId, status: task.status, beforeId });
    }
  };

  const cellDragOver = (laneId, status) => (e) => {
    if (draggingId == null || !canDropIn(status)) return;
    e.preventDefault();
    if (dropTarget?.laneId !== laneId || dropTarget?.status !== status) setDropTarget({ laneId, status, beforeId: null });
  };

  // Dropping into another swimlane changes what the lane stands for, as in Jira: the
  // assignee, or the epic. A sub-task's epic comes from its parent, so it keeps its lane.
  const laneFields = (id, laneId) => {
    const task = tasksById.get(id);
    if (!task || laneId === "all") return {};
    const value = laneId.endsWith("-none") ? null : Number(laneId.slice(2));
    if (laneMode === "assignee" && (task.assignee_id ?? null) !== value) return { assignee_id: value };
    if (laneMode === "epic" && task.type !== "subtask" && (task.parent_id ?? null) !== value) return { parent_id: value };
    return {};
  };

  const cellDrop = (laneId, status) => async (e) => {
    e.preventDefault();
    const id = draggingId ?? Number(e.dataTransfer.getData("text/plain"));
    const target = dropTarget?.laneId === laneId && dropTarget?.status === status ? dropTarget : { status, beforeId: null };
    setDraggingId(null);
    setDropTarget(null);
    if (!id || target.beforeId === id) return;
    const from = tasksById.get(id)?.status;
    if (from && !canTransition(from, status, workflow)) {
      const label = (key) => workflow.find((s) => s.value === key)?.label || key;
      await alertDialog(`This workflow doesn't allow moving from ${label(from)} to ${label(status)}.`, { tone: "error" });
      return;
    }
    // Ranked against every issue in the sprint with that status, not just the visible
    // ones, so a drop made under a filter still lands where it was dropped.
    const column = sprintIssues.filter((t) => t.status === status);
    const fields = { status, sort_order: orderForDrop(column, target.beforeId, id), ...laneFields(id, laneId) };
    const { error } = await board.moveIssue(id, fields);
    if (error) await alertDialog(`Couldn't move the issue: ${error.message || "Check connection"}`, { tone: "error" });
  };

  const toggleLane = (id) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className={`board-view lanes-${laneMode}`}>
      <div className="board-sprint-bar">
        {isKanban ? (
          <div className="board-sprint-info">
            <h3 className="board-sprint-name">Kanban board</h3>
            <span className="board-sprint-dates">
              {sprintIssues.length} {sprintIssues.length === 1 ? "issue" : "issues"} · Done shows the last 14 days
            </span>
          </div>
        ) : (
          <div className="board-sprint-info">
            <h3 className="board-sprint-name">{sprint.name}</h3>
            <span className="board-sprint-dates">
              {formatShortDate(sprint.start_date)} – {formatShortDate(sprint.end_date)}
              {daysLeft != null && (
                <span className={`board-sprint-left ${daysLeft < 0 ? "overdue" : ""}`}>
                  {daysLeft < 0 ? ` · ${-daysLeft} days over` : ` · ${daysLeft} days left`}
                </span>
              )}
            </span>
            {sprint.goal && (
              <p className="board-sprint-goal">
                <Icon name="flag" size={14} /> {sprint.goal}
              </p>
            )}
          </div>
        )}
        <div className="board-sprint-actions">
          <label className="board-lane-select">
            Group by
            <select value={laneMode} onChange={(e) => changeLaneMode(e.target.value)}>
              <option value="none">None</option>
              <option value="assignee">Assignee</option>
              <option value="epic">Epic</option>
            </select>
          </label>
          {!isKanban && (
            <button className="btn btn-secondary btn-sm" onClick={() => onCompleteSprint(sprint)}>
              Complete sprint
            </button>
          )}
        </div>
      </div>

      <div className="board-scroll" style={{ "--board-columns": workflow.length }}>
        <div className="board-grid board-header-row">
          {workflow.map((status) => {
            const wip = wipStatus(columnTotals[status.value].length, wipLimits[status.value]);
            return (
              <div
                key={status.value}
                className={`board-column-head glass ${wip?.over ? "is-over-wip" : ""}`}
                title={wip ? `WIP limit ${wip.limit}${wip.over ? ": over the limit" : ""}` : undefined}
              >
                <StatusDot status={status.value} />
                <span className="board-column-title">{status.label}</span>
                <span className="board-column-count">
                  {wip ? `${columnTotals[status.value].length} / ${wip.limit}` : columnCounts[status.value].length}
                  {sumPoints(columnCounts[status.value]) > 0 && ` · ${sumPoints(columnCounts[status.value])} pts`}
                </span>
                {wip?.over && <span className="pill pill-red board-wip-pill">Over limit</span>}
              </div>
            );
          })}
        </div>

        {lanes.map((lane) => {
          const cells = groupByStatus(lane.issues, workflow);
          const isCollapsed = collapsed.has(lane.id);
          return (
            <div key={lane.id} className="board-lane">
              {lane.title && (
                <button type="button" className="board-lane-head" onClick={() => toggleLane(lane.id)}>
                  <Icon name="chevron-down" size={16} className={`board-lane-caret ${isCollapsed ? "collapsed" : ""}`} />
                  {lane.epic && <span className="board-lane-swatch" style={{ background: epicColor(lane.epic) }} />}
                  {lane.title}
                  <span className="board-lane-count">{lane.issues.length} {lane.issues.length === 1 ? "issue" : "issues"}</span>
                </button>
              )}
              {!isCollapsed && (
                <div className="board-grid">
                  {workflow.map((status) => {
                    const cell = cells[status.value];
                    const isTarget = dropTarget?.laneId === lane.id && dropTarget?.status === status.value;
                    return (
                      <div
                        key={status.value}
                        className={`board-cell glass ${isTarget ? "drop-active" : ""} ${canDropIn(status.value) ? "" : "drop-blocked"}`}
                        onDragOver={cellDragOver(lane.id, status.value)}
                        onDrop={cellDrop(lane.id, status.value)}
                      >
                        {cell.map((task) => (
                          <div key={task.id}>
                            {isTarget && dropTarget.beforeId === task.id && draggingId !== task.id && <div className="board-drop-indicator" />}
                            <BoardCard
                              task={task}
                              project={project}
                              tasks={tasks}
                              tasksById={tasksById}
                              employeesById={employeesById}
                              today={today}
                              isDragging={draggingId === task.id}
                              onOpen={onOpenIssue}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                              onDragOver={cardDragOver(lane.id, cell)}
                            />
                          </div>
                        ))}
                        {isTarget && dropTarget.beforeId == null && <div className="board-drop-indicator" />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {visible.length === 0 && (
          <p className="tasks-muted-center">
            {sprintIssues.length === 0
              ? isKanban
                ? "No issues yet. Press c to create one."
                : "This sprint has no issues yet. Add some from the backlog."
              : "No issues match these filters."}
          </p>
        )}
      </div>
    </div>
  );
}
