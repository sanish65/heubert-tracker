"use client";

import { useState, useMemo } from "react";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function LeaveCalendar({ leaves, selectedEmployee }) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  // Helper to generate dates between start and end
  const getDatesInRange = (start, end) => {
    const dates = [];
    let current = new Date(start + "T00:00:00");
    const last = new Date(end + "T00:00:00");
    while (current <= last) {
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  // Build a map: date-string → [{ type, name }]
  const leaveDateMap = useMemo(() => {
    const map = {};
    const filtered = selectedEmployee
      ? leaves.filter((l) => l.employee_name === selectedEmployee)
      : leaves;

    filtered.forEach((leave) => {
      const dates = getDatesInRange(leave.start_date, leave.end_date);
      dates.forEach((d) => {
        if (!map[d]) map[d] = [];
        map[d].push({ type: leave.type, name: leave.employee_name, id: leave.id });
      });
    });
    return map;
  }, [leaves, selectedEmployee]);

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
      const dates = getDatesInRange(l.start_date, l.end_date);
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
  }, [leaves, selectedEmployee, viewYear, viewMonth]);

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

    let cellClass = "cal-cell";
    if (isToday) cellClass += " cal-today";
    if (dayLeaves.length > 0) {
      const hasHalf = dayLeaves.some((l) => l.type === "half");
      const hasEarly = dayLeaves.some((l) => l.type === "early");
      const hasFull = dayLeaves.some((l) => l.type === "full");
      if (hasFull) cellClass += " cal-full-leave";
      else if (hasHalf) cellClass += " cal-half-leave";
      else if (hasEarly) cellClass += " cal-early-leave";
    }

    cells.push(
      <div key={day} className={cellClass} title={dayLeaves.map((l) => `${l.name} (${l.type})`).join(", ")}>
        <span className="cal-day-num">{day}</span>
        {dayLeaves.length > 0 && (
          <div className="cal-dots">
            {dayLeaves.slice(0, 3).map((l, i) => (
              <span
                key={i}
                className={`cal-dot cal-dot-${l.type}`}
                title={`${l.name} (${l.type})`}
              />
            ))}
            {dayLeaves.length > 3 && <span className="cal-dot-more">+{dayLeaves.length - 3}</span>}
          </div>
        )}
        {dayLeaves.length > 0 && (
          <div className="cal-names">
            {dayLeaves.slice(0, 2).map((l, i) => (
              <span key={i} className={`cal-name cal-name-${l.type}`}>
                {l.name.split(" ")[0]}
              </span>
            ))}
            {dayLeaves.length > 2 && (
              <span className="cal-name cal-name-more">+{dayLeaves.length - 2}</span>
            )}
          </div>
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
      </div>
    </div>
  );
}
