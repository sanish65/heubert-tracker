"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import LeaveCalendar from "./LeaveCalendar";

const TYPE_LABELS = { full: "Full Day", half: "Half Day", early: "Early Leave" };
const TYPE_ICONS = { full: "📅", half: "🌗", early: "🚪" };

export default function LeavePage({ onAddLeave, onAddHoliday }) {
  const { leaves, employees, deleteLeave, isAdmin, currentEmployee, publicHolidays, deletePublicHoliday } = useApp();
  const [filterEmployee, setFilterEmployee] = useState("");

  const calculateDays = (start, end, type) => {
    const s = new Date(start + "T00:00:00");
    const e = new Date(end + "T00:00:00");
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    return type === "half" ? diff * 0.5 : diff;
  };

  const filtered = useMemo(() => {
    let list = [...leaves];
    if (filterEmployee) {
      list = list.filter((l) => l.employee_name === filterEmployee);
    }
    return list.sort((a, b) => (b.start_date > a.start_date ? -1 : 1)).reverse();
  }, [leaves, filterEmployee]);

  // Employee leave summary
  const empSummary = useMemo(() => {
    return employees.map((emp) => {
      const empLeaves = leaves.filter((l) => l.employee_name === emp.name);
      const totalDays = empLeaves.reduce((sum, l) => {
        return sum + calculateDays(l.start_date, l.end_date, l.type);
      }, 0);
      return { name: emp.name, records: empLeaves.length, totalDays };
    }).filter((e) => e.records > 0).sort((a, b) => b.totalDays - a.totalDays);
  }, [employees, leaves]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="leave-page">
      <div className="leave-layout">
        {/* Left: Calendar */}
        <div className="leave-calendar-col">
          <LeaveCalendar 
            leaves={leaves} 
            selectedEmployee={filterEmployee || null} 
            publicHolidays={publicHolidays}
          />
        </div>

        {/* Right: Leave records + summary */}
        <div className="leave-records-col">
          {/* Employee leave summary cards */}
          {empSummary.length > 0 && (
            <div className="leave-emp-summary">
              <h4 className="section-title-sm">Leave Summary by Employee</h4>
              <div className="leave-emp-chips">
                <button
                  className={`leave-emp-chip ${filterEmployee === "" ? "active" : ""}`}
                  onClick={() => setFilterEmployee("")}
                >
                  All ({leaves.length})
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
                <button className="btn btn-accent btn-sm btn-leave-record" onClick={onAddLeave}>
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
                        </div>
                        {(isAdmin || (currentEmployee && leave.employee_name === currentEmployee.name)) && (
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() => deleteLeave(leave.id)}
                            title="Delete"
                          >
                            🗑
                          </button>
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
                          {calculateDays(leave.start_date, leave.end_date, leave.type)} days
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
  );
}
