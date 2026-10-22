"use client";

// Small presentational pieces shared by the Tasks tab's board, backlog and issue views.

import Icon from "@/components/Icon";
import PersonAvatar from "@/components/Avatar";
import { issueType, priorityInfo, EPIC_COLORS } from "@/lib/taskBoard";
import { statusMeta } from "@/lib/taskWorkflow";
import { useWorkflow } from "@/components/TaskWorkflowContext";

// Line icons for the issue types; the type's pill colour comes from .type-<value> in CSS.
const TYPE_ICONS = { epic: "sparkles", story: "book", task: "check", bug: "alert", subtask: "chevron-right" };

export function formatShortDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function formatDateTime(value) {
  if (!value) return "";
  return new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// An epic without a stored colour still gets a stable one, picked from its id.
export function epicColor(epic) {
  if (!epic) return EPIC_COLORS[0];
  return epic.epic_color || EPIC_COLORS[Math.abs(Number(epic.id) || 0) % EPIC_COLORS.length];
}

export function TypeIcon({ type }) {
  const info = issueType(type);
  return (
    <span className={`issue-type-icon type-${info.value}`} title={info.label} aria-label={info.label} role="img">
      <Icon name={TYPE_ICONS[info.value] || "check"} size={12} strokeWidth={2.4} />
    </span>
  );
}

export function PriorityIcon({ priority }) {
  const info = priorityInfo(priority);
  return (
    <span className={`pill task-priority task-priority--${info.value}`} title={`${info.label} priority`}>
      {info.label}
    </span>
  );
}

// A custom status wears its category's colour; the built-in four keep their own.
export function StatusLozenge({ status }) {
  const meta = statusMeta(status, useWorkflow());
  return <span className={`pill task-status task-status--${meta.cls}`}>{meta.label}</span>;
}

// Also used for things that aren't statuses ("backlog", a sprint's state), which keep
// their own dot colour.
export function StatusDot({ status }) {
  const workflow = useWorkflow();
  const cls = workflow.some((s) => s.value === status) ? statusMeta(status, workflow).cls : status;
  return <span className={`task-status-dot task-status-dot--${cls}`} aria-hidden="true" />;
}

export function Avatar({ employee }) {
  if (!employee) {
    return (
      <span className="avatar avatar-sm issue-avatar-none" title="Unassigned" aria-label="Unassigned">
        ?
      </span>
    );
  }
  return <PersonAvatar name={employee.name} className="avatar avatar-sm" title={employee.name} aria-label={employee.name} />;
}

export function EpicChip({ epic }) {
  if (!epic) return null;
  const color = epicColor(epic);
  return (
    <span className="issue-epic-chip" style={{ color, borderColor: color }} title={`Epic: ${epic.title}`}>
      {epic.title}
    </span>
  );
}

export function PointsBadge({ value }) {
  if (value == null || value === "") return null;
  return (
    <span className="issue-points" title="Story points">
      {Number(value)}
    </span>
  );
}
