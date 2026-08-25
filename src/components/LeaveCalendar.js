"use client";

import { useState, useMemo, useCallback } from "react";
import { describeLeave } from "@/lib/utils";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Dots are a type summary, capped so they stay on one row. The "N on leave" line
// underneath is the authoritative count, so capping here never hides information.
const MAX_DOTS = 6;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function LeaveCalendar({ leaves, selectedEmployee, publicHolidays = [], outOfSeasonLeaves = [] }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  // Normalized once: `date` may come back as "YYYY-MM-DD" or a full timestamp
  const holidaySet = useMemo(
    () => new Set((publicHolidays || []).map((h) => h.date?.split("T")[0])),
    [publicHolidays]
  );

  // Helper to generate dates between start and end (legacy fallback)
  const getDatesInRange = useCallback((start, end) => {
    const dates = [];
    if (!start || !end) return dates;
    let current = new Date(start + "T00:00:00");
    const last = new Date(end + "T00:00:00");
    while (current <= last) {
      const dow = current.getDay();
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      const dtStr = `${y}-${m}-${d}`;

      const isWeekend = dow === 0 || dow === 6;

      if (!isWeekend && !holidaySet.has(dtStr)) {
        dates.push(dtStr);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [holidaySet]);

  // Build a map: date-string → [{ type, name }]
  const leaveDateMap = useMemo(() => {
    const map = {};
    const filtered = selectedEmployee
      ? leaves.filter((l) => l.employee_name === selectedEmployee)
      : leaves;

    filtered.forEach((leave) => {
      const dates = leave.dates || getDatesInRange(leave.start_date, leave.end_date);
      dates.forEach((d) => {
        if (!map[d]) map[d] = [];
        map[d].push({ type: leave.type, name: leave.employee_name, id: leave.id, reason: leave.reason });
      });
    });
    return map;
  }, [leaves, selectedEmployee, getDatesInRange]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Monthly stats
  const { filteredLeavesCount, totalDays } = useMemo(() => {
    const filtered = selectedEmployee
      ? leaves.filter((l) => l.employee_name === selectedEmployee)
      : leaves;
    
    let count = 0;
    let days = 0;

    filtered.forEach((l) => {
      const dates = l.dates || getDatesInRange(l.start_date, l.end_date);
      const datesInThisMonth = dates.filter((d) => {
        const dt = new Date(d + "T00:00:00");
        return dt.getFullYear() === viewYear && dt.getMonth() === viewMonth;
      });

      if (datesInThisMonth.length > 0) {
        count++;
        days += (l.type === "half" ? datesInThisMonth.length * 0.5 : datesInThisMonth.length);
      }
    });

    return { filteredLeavesCount: count, totalDays: days };
  }, [leaves, selectedEmployee, viewYear, viewMonth, getDatesInRange]);

  // Leaves that exist for this month but sit in a different season, so they are filtered
  // out of the grid above. Surfaced instead of silently dropped — a leave that shows up in
  // "Upcoming Leaves" but nowhere on the calendar is otherwise impossible to explain.
  const hiddenThisMonth = useMemo(() => {
    const candidates = selectedEmployee
      ? (outOfSeasonLeaves || []).filter((l) => l.employee_name === selectedEmployee)
      : outOfSeasonLeaves || [];
    return candidates.filter((l) => {
      const dates = l.dates || getDatesInRange(l.start_date, l.end_date);
      return dates.some((d) => {
        const dt = new Date(d + "T00:00:00");
        return dt.getFullYear() === viewYear && dt.getMonth() === viewMonth;
      });
    }).length;
  }, [outOfSeasonLeaves, selectedEmployee, viewYear, viewMonth, getDatesInRange]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const cells = [];
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) {
    cells.push(<div key={`e-${i}`} className="cal-cell cal-empty" />);
  }
  // Day cells
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayLeaves = leaveDateMap[dateStr] || [];
    const isToday =
      day === now.getDate() &&
      viewMonth === now.getMonth() &&
      viewYear === now.getFullYear();

    const isHoliday = holidaySet.has(dateStr);
    const holidayTitle = publicHolidays.find((h) => h.date?.split("T")[0] === dateStr)?.title;

    let cellClass = "cal-cell";
    if (isToday) cellClass += " cal-today";
    if (isHoliday) cellClass += " holiday-day-cell";
    
    if (dayLeaves.length > 0) {
      const hasHalf = dayLeaves.some((l) => l.type === "half");
      const hasEarly = dayLeaves.some((l) => l.type === "early");
      const hasFull = dayLeaves.some((l) => l.type === "full");
      if (hasFull) cellClass += " cal-full-leave";
      else if (hasHalf) cellClass += " cal-half-leave";
      else if (hasEarly) cellClass += " cal-early-leave";
    }

    // One tooltip for the whole cell, one line per person. No titles on the dots
    // themselves — a child title would replace this one when hovering a dot.
    const tooltipLines = [];
    if (isHoliday) tooltipLines.push(`Holiday: ${holidayTitle}`);
    dayLeaves.forEach((l) => tooltipLines.push(`${l.name} — ${describeLeave(l)}`));
    const tooltip = tooltipLines.join("\n");

    cells.push(
      <div key={day} className={cellClass} {...(tooltip ? { title: tooltip } : {})}>
        <span className="cal-day-num">{day}</span>
        {dayLeaves.length > 0 && (
          <>
            <div className="cal-dots">
              {dayLeaves.slice(0, MAX_DOTS).map((l, i) => (
                <span key={i} className={`cal-dot cal-dot-${l.type}`} />
              ))}
            </div>
            <span className="cal-count">
              {dayLeaves.length}
              <span className="cal-count-label"> on leave</span>
            </span>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="calendar-container">
      <div className="cal-header">
        <button className="btn btn-ghost btn-sm" onClick={prevMonth}>‹</button>
        <h3 className="cal-title">
          {MONTHS[viewMonth]} {viewYear}
        </h3>
        <button className="btn btn-ghost btn-sm" onClick={goToday}>Today</button>
        <button className="btn btn-ghost btn-sm" onClick={nextMonth}>›</button>
      </div>

      <div className="cal-stats-bar">
        <span className="cal-stat">
          <span className="cal-stat-num">{filteredLeavesCount}</span> leave records
        </span>
        <span className="cal-stat">
          <span className="cal-stat-num">{totalDays}</span> total days
        </span>
        {hiddenThisMonth > 0 && (
          <span className="cal-stat cal-stat-warn" title="These leaves belong to a different leave season — switch season above to see them.">
            ⚠️ <span className="cal-stat-num">{hiddenThisMonth}</span> in another season
          </span>
        )}
      </div>

      <div className="cal-grid">
        {DAYS.map((d) => (
          <div key={d} className="cal-head">{d}</div>
        ))}
        {cells}
      </div>

      <div className="cal-legend">
        <span className="cal-legend-item">
          <span className="cal-legend-dot cal-dot-full" /> Full Day
        </span>
        <span className="cal-legend-item">
          <span className="cal-legend-dot cal-dot-half" /> Half Day
        </span>
        <span className="cal-legend-item">
          <span className="cal-legend-dot cal-dot-early" /> Early Leave
        </span>
        <span className="cal-legend-item">
          <span className="cal-legend-dot" style={{ background: 'rgba(255, 122, 0, 0.2)', border: '1px solid var(--accent-orange)' }} /> Public Holiday
        </span>
      </div>
    </div>
  );
}
