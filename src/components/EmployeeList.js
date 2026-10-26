"use client";

import { useMemo, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import { computeLeaveBalances } from "@/lib/utils";
import { getNepalDateStr } from "@/lib/attendanceTime";
import { SORTS, inLeaveLeft, recentRecords, sortRows } from "@/lib/employeeDirectory";
import Avatar from "./Avatar";
import Icon from "./Icon";
import EmployeeDetailPanel, { EMPLOYEE_STATUSES, employeeStatus } from "./EmployeeDetailPanel";

const STATUS_FILTERS = [{ id: "all", label: "All" }, ...EMPLOYEE_STATUSES];

const rs = (n) => `Rs. ${n.toLocaleString()}`;

const formatDate = (dateStr) => {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// openEmployeeId: a person opened from the top bar's search. page.js remounts the list
// (a new key) for each such request, so it only ever seeds the first render.
// onRecordFine(name): opens Record Fine for that person; absent for those who can't.
export default function EmployeeList({ onEditEmployee, onRecordFine, openEmployeeId }) {
  const {
    employees,
    fines,
    removeEmployee,
    getEmployeeStats,
    isAdmin,
    leaves,
    leaveTypes,
    leaveSeasons,
    publicHolidays,
  } = useApp();
  const { confirmDialog, alertDialog } = useDialog();
  const [viewingId, setViewingId] = useState(openEmployeeId ?? null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState("name");
  const panelRef = useRef(null);
  const today = getNepalDateStr(new Date());

  const holidaySet = useMemo(
    () => new Set((publicHolidays || []).map((h) => h.date?.split("T")[0])),
    [publicHolidays]
  );

  // Leave left is counted in the latest leave season, as on the Leaves page, over the types
  // that count in it (personal, sick, festival; not work from home, unpaid or exam).
  const leaveSeason = useMemo(() => {
    if (!leaveSeasons || leaveSeasons.length === 0) return null;
    return [...leaveSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  }, [leaveSeasons]);

  // Grouped once, so each row reads only its own leaves rather than every leave.
  const leavesByName = useMemo(() => {
    const map = new Map();
    for (const leave of leaves || []) {
      if (!map.has(leave.employee_name)) map.set(leave.employee_name, []);
      map.get(leave.employee_name).push(leave);
    }
    return map;
  }, [leaves]);

  const rows = useMemo(
    () =>
      employees.map((emp) => {
        const balances = computeLeaveBalances(
          emp.name,
          leavesByName.get(emp.name) || [],
          leaveTypes,
          leaveSeason?.id ?? null,
          holidaySet
        );
        return {
          emp,
          status: employeeStatus(emp),
          stats: getEmployeeStats(emp.name),
          balances,
          leaveLeft: inLeaveLeft(balances).reduce((sum, b) => sum + b.remaining, 0),
          leaveTotal: inLeaveLeft(balances).reduce((sum, b) => sum + b.annual_days, 0),
        };
      }),
    [employees, leavesByName, leaveTypes, leaveSeason, holidaySet, getEmployeeStats]
  );

  // Search narrows the list; the status filter applies on top, so each segment can
  // show its own count.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(({ emp }) =>
      [emp.name, emp.work_email, emp.personal_email, emp.emp_no].some((value) =>
        String(value ?? "").toLowerCase().includes(q)
      )
    );
  }, [rows, query]);

  const statusCounts = useMemo(() => {
    const counts = { all: searched.length };
    for (const row of searched) counts[row.status.id] = (counts[row.status.id] || 0) + 1;
    return counts;
  }, [searched]);

  const visible = useMemo(
    () => sortRows(statusFilter === "all" ? searched : searched.filter((row) => row.status.id === statusFilter), sort),
    [searched, statusFilter, sort]
  );

  const viewing = viewingId === null ? null : rows.find((row) => row.emp.id === viewingId) || null;
  const viewingRecords = viewing
    ? recentRecords({ name: viewing.emp.name, leaves: leavesByName.get(viewing.emp.name) || [], fines, leaveTypes, today })
    : [];
  // Record Fine lists only people who can be fined (AddFineModal's own rule).
  const canFineViewing = Boolean(
    onRecordFine && viewing && viewing.status.id !== "resigned" && !viewing.emp.late_fine_excluded
  );

  // On a narrow screen the panel sits above the table; bring it into view.
  const openDetails = (id) => {
    setViewingId(id);
    requestAnimationFrame(() => panelRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" }));
  };

  const handleDelete = async (emp) => {
    if (!(await confirmDialog(`Are you sure you want to delete ${emp.name}?`, { danger: true }))) return;
    const { error } = await removeEmployee(emp.id);
    if (error) {
      await alertDialog(`Error deleting employee: ${error.message || "Check connection"}`, { tone: "error" });
    }
  };

  return (
    <div className="emp-page">
      <div className="emp-toolbar">
        <label className="emp-search glass">
          <Icon name="search" size={16} strokeWidth={2} />
          <input
            type="search"
            aria-label="Search employees"
            placeholder="Search name, email or employee ID…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </label>
        <div className="status-tabs" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`tab ${statusFilter === f.id ? "tab-active" : ""}`}
              aria-pressed={statusFilter === f.id}
              onClick={() => setStatusFilter(f.id)}
            >
              {f.label} <span className="tab-count mono">{statusCounts[f.id] || 0}</span>
            </button>
          ))}
        </div>
        <label className="emp-sort">
          Sort
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((s) => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="emp-layout">
      <section className="emp-table-card glass" aria-label="Employees">
        <div className="emp-table-scroll">
          <table className="data-table emp-table">
            <thead>
              <tr>
                <th scope="col">Employee</th>
                <th scope="col">Joined</th>
                <th scope="col">Status</th>
                <th scope="col" className="emp-num">Fines</th>
                <th scope="col">Leave left</th>
                {isAdmin && (
                  <th scope="col" className="emp-num">
                    <span className="emp-hidden-label">Actions</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 6 : 5} className="empty-row">No employees found</td>
                </tr>
              ) : (
                visible.map(({ emp, status, stats, leaveLeft, leaveTotal }) => {
                  const email = emp.work_email || emp.personal_email;
                  const showLeave = status.id !== "resigned" && leaveTotal > 0;
                  return (
                    <tr
                      key={emp.id}
                      className={`clickable-row${status.id === "resigned" ? " is-resigned" : ""}${viewingId === emp.id ? " is-selected" : ""}`}
                      onClick={() => openDetails(emp.id)}
                    >
                      <td>
                        {/* The row's click opens the details; the button is its keyboard stop. */}
                        <button type="button" className="emp-open" aria-label={`View details for ${emp.name}`}>
                          <Avatar name={emp.name} className="avatar" aria-hidden="true" />
                          <span className="emp-open-text">
                            <span className="emp-open-name">{emp.name}</span>
                            {email && <span className="emp-open-email mono">{email}</span>}
                          </span>
                        </button>
                      </td>
                      <td className="emp-joined mono">{formatDate(emp.joined_date)}</td>
                      <td>
                        <span className={`pill ${status.pill}`}>{status.label}</span>
                      </td>
                      <td className="emp-num">
                        <span className="emp-fines">
                          <span className="emp-fines-total mono">{rs(stats.total)}</span>
                          <span className={`emp-fines-note${stats.unpaid > 0 ? " is-unpaid" : ""}`}>
                            {stats.unpaid > 0 ? `${rs(stats.unpaid)} unpaid` : stats.total > 0 ? "All paid" : "No fines"}
                          </span>
                        </span>
                      </td>
                      <td>
                        {showLeave ? (
                          <span className="emp-leave">
                            <span className="emp-leave-text">
                              <span className="emp-leave-left mono">{leaveLeft}</span> of {leaveTotal} days
                            </span>
                            <span className="emp-leave-track" aria-hidden="true">
                              <span
                                className="emp-leave-fill"
                                style={{ width: `${Math.min(100, Math.round((leaveLeft / leaveTotal) * 100))}%` }}
                              />
                            </span>
                          </span>
                        ) : (
                          <span className="emp-leave-none">—</span>
                        )}
                      </td>
                      {isAdmin && (
                        <td className="emp-num" onClick={(e) => e.stopPropagation()}>
                          <span className="emp-actions">
                            <button
                              type="button"
                              className="btn-icon btn-sm"
                              onClick={() => onEditEmployee(emp)}
                              aria-label={`Edit ${emp.name}`}
                              title="Edit employee"
                            >
                              <Icon name="edit" size={16} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon btn-sm emp-delete"
                              onClick={() => handleDelete(emp)}
                              aria-label={`Delete ${emp.name}`}
                              title="Delete employee"
                            >
                              <Icon name="trash" size={16} />
                            </button>
                          </span>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="emp-table-foot">
          <span>Showing {visible.length} of {employees.length} members</span>
          {leaveSeason && <span className="emp-table-season mono">Leave balances · {leaveSeason.title}</span>}
        </div>
      </section>

      {viewing && (
        <EmployeeDetailPanel
          ref={panelRef}
          employee={viewing.emp}
          balances={viewing.balances}
          seasonTitle={leaveSeason?.title}
          stats={viewing.stats}
          records={viewingRecords}
          today={today}
          onClose={() => setViewingId(null)}
          onEdit={isAdmin ? () => onEditEmployee(viewing.emp) : null}
          onRecordFine={canFineViewing ? () => onRecordFine(viewing.emp.name) : null}
        />
      )}
      </div>
    </div>
  );
}
