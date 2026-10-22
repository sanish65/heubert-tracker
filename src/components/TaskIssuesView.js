"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import { TypeIcon, PriorityIcon, StatusLozenge, Avatar, PointsBadge, formatShortDate } from "@/components/TaskBits";
import { useWorkflow } from "@/components/TaskWorkflowContext";
import { issueKey, issueType, priorityInfo, isOverdue } from "@/lib/taskBoard";
import { statusMeta } from "@/lib/taskWorkflow";
import { sortIssues } from "@/lib/taskQuery";
import { toCsv } from "@/lib/csv";

const COLUMNS = [
  { field: "key", label: "Key" },
  { field: null, label: "Summary" },
  { field: "status", label: "Status" },
  { field: "assignee", label: "Assignee" },
  { field: "priority", label: "Priority" },
  { field: "points", label: "Points" },
  { field: null, label: "Sprint" },
  { field: "due", label: "Due" },
  { field: "updated", label: "Updated" },
];

const PAGE = 100;

// Jira's issue search: every issue the current search matches, epics included, as a
// table. The query's ORDER BY sorts it until a column header is clicked.
export default function TaskIssuesView({ project, issues, order, invalid = false, sprints, versions, employeesById, today, onOpenIssue }) {
  const workflow = useWorkflow();
  const [sortBy, setSortBy] = useState(null); // { field, dir }
  const [shown, setShown] = useState(PAGE);

  const sprintsById = new Map(sprints.map((s) => [s.id, s]));
  const versionsById = new Map(versions.map((v) => [v.id, v]));
  const ctx = { workflow, employeesById };
  const rows = sortIssues(issues, sortBy ? [sortBy] : order, ctx);
  const keyOf = (t) => issueKey(project, t);

  const toggleSort = (field) =>
    setSortBy((prev) => (prev?.field === field ? { field, dir: prev.dir === "asc" ? "desc" : "asc" } : { field, dir: field === "key" || field === "due" ? "asc" : "desc" }));

  const exportCsv = () => {
    const header = ["Key", "Type", "Summary", "Status", "Assignee", "Priority", "Points", "Sprint", "Fix version", "Labels", "Due", "Created", "Updated", "Resolved"];
    const body = rows.map((t) => [
      keyOf(t),
      issueType(t.type).label,
      t.title,
      statusMeta(t.status, workflow).label,
      employeesById.get(t.assignee_id)?.name || "",
      priorityInfo(t.priority).label,
      t.estimate ?? "",
      sprintsById.get(t.sprint_id)?.name || "",
      versionsById.get(t.fix_version_id)?.name || "",
      (t.labels || []).join(", "),
      t.due_date || "",
      t.created_at || "",
      t.updated_at || "",
      t.completed_at || "",
    ]);
    const blob = new Blob([toCsv(header, body)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${project.issue_key}-issues-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="issues-view">
      <div className="issues-view-bar">
        <span className="issues-view-count">
          {invalid ? "—" : `${rows.length} ${rows.length === 1 ? "issue" : "issues"}`}
        </span>
        <button type="button" className="btn btn-secondary btn-sm" onClick={exportCsv} disabled={invalid || !rows.length}>
          <Icon name="download" size={14} /> Export CSV
        </button>
      </div>

      {invalid ? (
        <p className="tasks-muted-center">Fix the query above to see its issues.</p>
      ) : rows.length === 0 ? (
        <p className="tasks-muted-center">No issues match this search.</p>
      ) : (
        <div className="issues-table-wrap glass">
          <table className="issues-table">
            <thead>
              <tr>
                {COLUMNS.map((c) => {
                  const active = sortBy?.field === c.field;
                  return (
                    <th key={c.label} scope="col" aria-sort={active ? (sortBy.dir === "asc" ? "ascending" : "descending") : undefined}>
                      {c.field ? (
                        <button type="button" className={`issues-sort ${active ? "is-active" : ""}`} onClick={() => toggleSort(c.field)}>
                          {c.label}
                          {active && <Icon name="chevron-down" size={12} className={sortBy.dir === "asc" ? "is-asc" : ""} />}
                        </button>
                      ) : (
                        c.label
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, shown).map((t) => {
                const assignee = employeesById.get(t.assignee_id);
                return (
                  <tr key={t.id} onClick={() => onOpenIssue(t.id)}>
                    <td className="issues-key">
                      <span className="issues-cell-row">
                        <TypeIcon type={t.type} />
                        <button type="button" className="issue-key-text" onClick={(e) => { e.stopPropagation(); onOpenIssue(t.id); }}>
                          {keyOf(t)}
                        </button>
                      </span>
                    </td>
                    <td className="issues-summary">{t.title}</td>
                    <td><StatusLozenge status={t.status} /></td>
                    <td>
                      {assignee ? (
                        <span className="issues-cell-row">
                          <Avatar employee={assignee} /> {assignee.name}
                        </span>
                      ) : (
                        <span className="issues-muted">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <span className="issues-cell-row">
                        <PriorityIcon priority={t.priority} /> {priorityInfo(t.priority).label}
                      </span>
                    </td>
                    <td><PointsBadge value={t.estimate} /></td>
                    <td>{sprintsById.get(t.sprint_id)?.name || ""}</td>
                    <td className={isOverdue(t, today) ? "issues-overdue" : ""}>{t.due_date ? formatShortDate(t.due_date) : ""}</td>
                    <td>{formatShortDate(t.updated_at || t.created_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length > shown && (
            <button type="button" className="btn btn-ghost btn-sm issues-more" onClick={() => setShown((n) => n + PAGE)}>
              Show {Math.min(PAGE, rows.length - shown)} more of {rows.length - shown}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
