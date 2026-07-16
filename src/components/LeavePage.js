"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import LeaveCalendar from "./LeaveCalendar";
import EditLeaveModal from "./EditLeaveModal";
import { computeLeaveBalances } from "@/lib/utils";

const TYPE_LABELS = { full: "Full Day", half: "Half Day", early: "Early Leave" };
const TYPE_ICONS = { full: "📅", half: "🌗", early: "🚪" };
const PRE_SEASON = "pre-season";

export default function LeavePage({ onAddLeave, onAddHoliday, onAddSeason, onEditSeason }) {
  const { leaves, leaveSeasons, employees, deleteLeave, isAdmin, currentEmployee, publicHolidays, deletePublicHoliday, leaveTypes } = useApp();
  const [filterEmployee, setFilterEmployee] = useState("");
  const [editingLeave, setEditingLeave] = useState(null);
  const [activeSeasonId, setActiveSeasonId] = useState(null);

  const leaveTypeById = useMemo(() => {
    const map = new Map();
    (leaveTypes || []).forEach((t) => map.set(t.id, t));
    return map;
  }, [leaveTypes]);

  const holidaySet = useMemo(
    () => new Set((publicHolidays || []).map((h) => h.date?.split("T")[0])),
    [publicHolidays]
  );

  const sortedLeaveSeasons = useMemo(
    () => [...leaveSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [leaveSeasons]
  );

  const hasPreSeasonLeaves = useMemo(() => leaves.some((l) => !l.season_id), [leaves]);

  // Default to the latest season once seasons load, but only the first time
  useMemo(() => {
    if (activeSeasonId === null && sortedLeaveSeasons.length > 0) {
      setActiveSeasonId(sortedLeaveSeasons[0].id);
    }
  }, [sortedLeaveSeasons, activeSeasonId]);

  const activeSeason = activeSeasonId === PRE_SEASON ? null : sortedLeaveSeasons.find((s) => s.id === activeSeasonId);
  const effectiveSeasonId = activeSeasonId === PRE_SEASON ? null : activeSeasonId;

  const seasonLeaves = useMemo(() => {
    if (activeSeasonId === PRE_SEASON) return leaves.filter((l) => !l.season_id);
    return leaves.filter((l) => l.season_id === activeSeasonId);
  }, [leaves, activeSeasonId]);

  const employeeBalances = useMemo(() => {
    if (!filterEmployee) return [];
    return computeLeaveBalances(filterEmployee, leaves, leaveTypes, effectiveSeasonId, holidaySet);
  }, [filterEmployee, leaves, leaveTypes, effectiveSeasonId, holidaySet]);

  const calculateDays = (start, end, type) => {
    let diff = 0;
    const sDate = new Date(start + "T00:00:00");
    const eDate = new Date(end + "T00:00:00");
    
    let current = new Date(sDate);
    while (current <= eDate) {
      const dow = current.getDay();
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      const dtStr = `${y}-${m}-${d}`;
      
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = publicHolidays.some(h => h.date.startsWith(dtStr));
      
      if (!isWeekend && !isHoliday) {
        diff++;
      }
      current.setDate(current.getDate() + 1);
    }

    return type === "half" ? diff * 0.5 : diff;
  };

  const filtered = useMemo(() => {
    let list = [...seasonLeaves];
    if (filterEmployee) {
      list = list.filter((l) => l.employee_name === filterEmployee);
    }
    return list.sort((a, b) => (b.start_date > a.start_date ? -1 : 1)).reverse();
  }, [seasonLeaves, filterEmployee]);

  // Employee leave summary — scoped to the active season, so a new season starts at zero
  const empSummary = useMemo(() => {
    return employees.map((emp) => {
      const empLeaves = seasonLeaves.filter((l) => l.employee_name === emp.name);
      const totalDays = empLeaves.reduce((sum, l) => {
        const days = l.dates ? l.dates.length : calculateDays(l.start_date, l.end_date, l.type);
        return sum + (l.type === "half" ? days * 0.5 : days);
      }, 0);
      return { name: emp.name, records: empLeaves.length, totalDays };
    }).filter((e) => e.records > 0).sort((a, b) => b.totalDays - a.totalDays);
  }, [employees, seasonLeaves]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <>
      <div className="leave-page">
      {/* Leave Seasons */}
      <div className="leave-season-bar">
        <div className="leave-season-chips">
          {hasPreSeasonLeaves && (
            <button
              className={`leave-emp-chip ${activeSeasonId === PRE_SEASON ? "active" : ""}`}
              onClick={() => setActiveSeasonId(PRE_SEASON)}
            >
              🗂️ Pre Fiscal Year Leaves
            </button>
          )}
          {sortedLeaveSeasons.map((s) => (
            <button
              key={s.id}
              className={`leave-emp-chip ${activeSeasonId === s.id ? "active" : ""}`}
              onClick={() => setActiveSeasonId(s.id)}
            >
              🏖️ {s.title}
              {isAdmin && (
                <span
                  className="leave-season-edit"
                  onClick={(e) => { e.stopPropagation(); onEditSeason(s); }}
                  title="Edit Season"
                >
                  ✏️
                </span>
              )}
            </button>
          ))}
          {sortedLeaveSeasons.length === 0 && !hasPreSeasonLeaves && (
            <span className="empty-msg">No leave seasons yet.</span>
          )}
        </div>
        {isAdmin && (
          <button className="btn btn-ghost btn-sm" onClick={onAddSeason}>
            + New Season
          </button>
        )}
      </div>

      <div className="leave-layout">
        {/* Left: Calendar */}
        <div className="leave-calendar-col">
          <LeaveCalendar
            leaves={seasonLeaves}
            selectedEmployee={filterEmployee || null}
            publicHolidays={publicHolidays}
          />
        </div>

        {/* Right: Leave records + summary */}
        <div className="leave-records-col">
          {/* Employee leave summary cards */}
          {empSummary.length > 0 ? (
            <div className="leave-emp-summary">
              <h4 className="section-title-sm">
                Leave Summary by Employee
                {activeSeason ? ` — ${activeSeason.title}` : activeSeasonId === PRE_SEASON ? " — Pre Fiscal Year Leaves" : ""}
              </h4>
              <div className="leave-emp-chips">
                <button
                  className={`leave-emp-chip ${filterEmployee === "" ? "active" : ""}`}
                  onClick={() => setFilterEmployee("")}
                >
                  All ({seasonLeaves.length})
                </button>
                {empSummary.map((emp) => (
                  <button
                    key={emp.name}
                    className={`leave-emp-chip ${filterEmployee === emp.name ? "active" : ""}`}
                    onClick={() =>
                      setFilterEmployee(filterEmployee === emp.name ? "" : emp.name)
                    }
                  >
                    {emp.name}
                    <span className="chip-badge">{emp.totalDays}d</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="leave-emp-summary">
              <h4 className="section-title-sm">Leave Summary by Employee</h4>
              <p className="empty-msg">No leave records in this season yet.</p>
            </div>
          )}

          {/* Leave balances for the selected employee */}
          {filterEmployee && employeeBalances.length > 0 && (
            <div className="leave-emp-summary">
              <h4 className="section-title-sm">
                {filterEmployee}'s Leave Balances
                {activeSeason ? ` (${activeSeason.title})` : ""}
              </h4>
              <div className="leave-emp-chips">
                {employeeBalances.map((b) => (
                  <span key={b.id} className="leave-emp-chip">
                    {b.name}
                    <span className="chip-badge">{b.remaining}/{b.annual_days}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Leave records list */}
          <div className="leave-list">
            <div className="leave-list-header">
              <h4 className="section-title-sm">
                Leave Records
                <span className="leave-list-count">{filtered.length} records</span>
              </h4>
              <div className="leave-list-actions">
                {isAdmin && (
                  <button className="btn btn-ghost btn-sm" onClick={onAddHoliday}>
                    🌴 Add Holiday
                  </button>
                )}
                <button className="btn btn-accent btn-sm btn-leave-record" onClick={() => onAddLeave(effectiveSeasonId)}>
                  <span>+</span> Record Leave
                </button>
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="leave-empty">
                <span className="leave-empty-icon">🏖️</span>
                <p>No leave records yet</p>
                <p className="leave-empty-sub">Use the "Record Leave" button to add one</p>
              </div>
            ) : (
              <div className="leave-cards">
                {filtered.map((leave) => {
                  const dayCount =
                    leave.type === "half"
                      ? (leave.dates || []).length * 0.5
                      : (leave.dates || []).length;
                  return (
                    <div key={leave.id} className={`leave-card leave-card-${leave.type}`}>
                      <div className="leave-card-top">
                        <div className="leave-card-info">
                          <span className="leave-card-name">
                            <span className="emp-avatar-sm">
                              {leave.employee_name.charAt(0).toUpperCase()}
                            </span>
                            {leave.employee_name}
                          </span>
                          <span className={`leave-type-badge leave-type-${leave.type}`}>
                            {TYPE_ICONS[leave.type]} {TYPE_LABELS[leave.type]}
                          </span>
                          <span className="leave-type-badge">
                            {leaveTypeById.get(leave.leave_type_id)?.name || "Uncategorized"}
                          </span>
                        </div>
                        {(isAdmin || (currentEmployee && leave.employee_name === currentEmployee.name)) && (
                          <div className="action-btns">
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => setEditingLeave(leave)}
                              title="Edit"
                            >
                              ✏️
                            </button>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => window.confirm(`Delete leave? ${leave.employee_name}`) && deleteLeave(leave.id)}
                              title="Delete"
                            >
                              🗑
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="leave-card-dates">
                        <span className="leave-date-range">
                          {formatDate(leave.start_date)}
                          {leave.start_date !== leave.end_date && (
                            <> → {formatDate(leave.end_date)}</>
                          )}
                        </span>
                        <span className="leave-day-count">
                          {dayCount || calculateDays(leave.start_date, leave.end_date, leave.type)} working days
                        </span>
                      </div>
                      {leave.reason && (
                        <div className="leave-card-reason">
                          💬 {leave.reason}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Public Holidays Section */}
      <div className="public-holidays-section">
        <div className="section-header-compact">
          <h3 className="section-title-sm">🌴 Public Holidays</h3>
          {isAdmin && (
            <button className="btn btn-ghost btn-xs" onClick={onAddHoliday}>
              + Add Holiday
            </button>
          )}
        </div>
        <div className="holiday-list-grid">
          {publicHolidays.length === 0 ? (
            <p className="empty-msg">No public holidays recorded.</p>
          ) : (
            publicHolidays.map((holiday) => (
              <div key={holiday.id} className="holiday-list-item">
                <div className="holiday-info">
                  <span className="holiday-date">
                    {new Date(holiday.date).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                  <span className="holiday-title">{holiday.title}</span>
                </div>
                {isAdmin && (
                  <button
                    className="btn-delete-holiday"
                    onClick={() => {
                        if (confirm(`Delete holiday "${holiday.title}"?`)) {
                            deletePublicHoliday(holiday.id);
                        }
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
      </div>

      <EditLeaveModal
        isOpen={!!editingLeave}
        onClose={() => setEditingLeave(null)}
        leave={editingLeave}
      />
    </>
  );
}
