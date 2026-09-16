"use client";

import { useState, useMemo, useCallback } from "react";
import { describeLeave } from "@/lib/utils";
import {
  adToBs,
  bsToAd,
  bsMonthLength,
  bsMonthSpan,
  bsMonthRange,
  BS_MONTH_NAMES,
  BS_YEAR_BOUNDS,
} from "@/lib/nepaliDate";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function pad(n) {
  return String(n).padStart(2, "0");
}

// Dots are a type summary, capped so they stay on one row. The "N on leave" line
// underneath is the authoritative count, so capping here never hides information.
const MAX_DOTS = 6;
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function LeaveCalendar({ leaves, selectedEmployee, publicHolidays = [], outOfSeasonLeaves = [] }) {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [calendar, setCalendar] = useState("AD"); // "AD" = Gregorian month, "BS" = Nepali month
  const [bsView, setBsView] = useState(() => {
    const bs = adToBs(todayStr);
    return bs ? { year: bs.year, month: bs.month } : { year: BS_YEAR_BOUNDS.max, month: 1 };
  });

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

  // The month on screen, as a flat list of days plus the blanks padding the first week. A
  // BS month maps onto a contiguous run of Gregorian days, so both calendars reduce to the
  // same shape and everything downstream stays calendar-agnostic.
  const grid = useMemo(() => {
    const days = [];

    if (calendar === "BS") {
      const length = bsMonthLength(bsView.year, bsView.month);
      for (let d = 1; d <= length; d++) {
        const dateStr = bsToAd(bsView.year, bsView.month, d);
        if (!dateStr) continue;
        const [, m, dd] = dateStr.split("-").map(Number);
        // Name the month on its 1st, so the small date still orients you mid-grid.
        days.push({ dateStr, primary: d, secondary: dd === 1 ? `${dd} ${SHORT_MONTHS[m - 1]}` : dd });
      }
    } else {
      const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
      for (let d = 1; d <= daysInMonth; d++) {
        const dateStr = `${viewYear}-${pad(viewMonth + 1)}-${pad(d)}`;
        const bs = adToBs(dateStr);
        days.push({
          dateStr,
          primary: d,
          secondary: !bs ? "" : bs.day === 1 ? `${bs.day} ${BS_MONTH_NAMES[bs.month - 1]}` : bs.day,
        });
      }
    }

    const lead = days.length ? new Date(days[0].dateStr + "T00:00:00").getDay() : 0;
    return { days, lead };
  }, [calendar, viewYear, viewMonth, bsView]);

  const monthDates = useMemo(() => new Set(grid.days.map((d) => d.dateStr)), [grid]);

  // The same span expressed in the calendar you're not currently viewing by.
  const titleAlt = useMemo(() => {
    const { days } = grid;
    if (days.length === 0) return "";
    const first = days[0].dateStr;
    const last = days[days.length - 1].dateStr;

    if (calendar === "BS") {
      const fmt = (s) => {
        const [, m, d] = s.split("-").map(Number);
        return `${SHORT_MONTHS[m - 1]} ${d}`;
      };
      return `${fmt(first)} – ${fmt(last)}, ${last.split("-")[0]}`;
    }
    return `${bsMonthRange(first, last)} BS`;
  }, [grid, calendar]);

  // Monthly stats
  const { filteredLeavesCount, totalDays } = useMemo(() => {
    const filtered = selectedEmployee
      ? leaves.filter((l) => l.employee_name === selectedEmployee)
      : leaves;
    
    let count = 0;
    let days = 0;

    filtered.forEach((l) => {
      const dates = l.dates || getDatesInRange(l.start_date, l.end_date);
      const datesInThisMonth = dates.filter((d) => monthDates.has(d));

      if (datesInThisMonth.length > 0) {
        count++;
        days += (l.type === "half" ? datesInThisMonth.length * 0.5 : datesInThisMonth.length);
      }
    });

    return { filteredLeavesCount: count, totalDays: days };
  }, [leaves, selectedEmployee, monthDates, getDatesInRange]);

  // Leaves that exist for this month but sit in a different season, so they are filtered
  // out of the grid above. Surfaced instead of silently dropped — a leave that shows up in
  // "Upcoming Leaves" but nowhere on the calendar is otherwise impossible to explain.
  const hiddenThisMonth = useMemo(() => {
    const candidates = selectedEmployee
      ? (outOfSeasonLeaves || []).filter((l) => l.employee_name === selectedEmployee)
      : outOfSeasonLeaves || [];
    return candidates.filter((l) => {
      const dates = l.dates || getDatesInRange(l.start_date, l.end_date);
      return dates.some((d) => monthDates.has(d));
    }).length;
  }, [outOfSeasonLeaves, selectedEmployee, monthDates, getDatesInRange]);

  const shiftBs = (delta) =>
    setBsView((v) => {
      let month = v.month + delta;
      let year = v.year;
      if (month < 1) { month = 12; year -= 1; }
      if (month > 12) { month = 1; year += 1; }
      return year < BS_YEAR_BOUNDS.min || year > BS_YEAR_BOUNDS.max ? v : { year, month };
    });

  const prevMonth = () => {
    if (calendar === "BS") return shiftBs(-1);
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (calendar === "BS") return shiftBs(1);
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
    const bs = adToBs(todayStr);
    if (bs) setBsView({ year: bs.year, month: bs.month });
  };

  // Switching calendars stays on the same stretch of time: the target calendar's stored
  // month is kept when it still overlaps what's on screen, so toggling back and forth
  // returns you where you started, and re-anchors on the midpoint otherwise.
  const handleCalendarChange = (next) => {
    if (next === calendar) return;
    const { days } = grid;
    const first = days[0]?.dateStr;
    const last = days[days.length - 1]?.dateStr;

    if (first) {
      const stored =
        next === "BS"
          ? bsMonthSpan(bsView.year, bsView.month)
          : [
              `${viewYear}-${pad(viewMonth + 1)}-01`,
              `${viewYear}-${pad(viewMonth + 1)}-${pad(new Date(viewYear, viewMonth + 1, 0).getDate())}`,
            ];

      if (!(stored && stored[0] <= last && stored[1] >= first)) {
        const anchor = days[Math.floor(days.length / 2)].dateStr;
        if (next === "BS") {
          const bs = adToBs(anchor);
          if (bs) setBsView({ year: bs.year, month: bs.month });
        } else {
          const [y, m] = anchor.split("-").map(Number);
          setViewYear(y);
          setViewMonth(m - 1);
        }
      }
    }
    setCalendar(next);
  };

  const cells = [];
  // Empty cells before first day
  for (let i = 0; i < grid.lead; i++) {
    cells.push(<div key={`e-${i}`} className="cal-cell cal-empty" />);
  }
  // Day cells
  for (const { dateStr, primary, secondary } of grid.days) {
    const dayLeaves = leaveDateMap[dateStr] || [];
    const isToday = dateStr === todayStr;

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
      <div key={dateStr} className={cellClass} {...(tooltip ? { title: tooltip } : {})}>
        <span className="cal-day-num">
          {primary}
          {secondary !== "" && <span className="cal-day-alt">{secondary}</span>}
        </span>
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
          {calendar === "BS"
            ? `${BS_MONTH_NAMES[bsView.month - 1]} ${bsView.year}`
            : `${MONTHS[viewMonth]} ${viewYear}`}
          <span className="cal-title-alt">{titleAlt}</span>
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
        <div className="cal-calendar-toggle">
          <button
            type="button"
            className={`toggle-pill ${calendar === "AD" ? "active" : ""}`}
            onClick={() => handleCalendarChange("AD")}
          >
            English
          </button>
          <button
            type="button"
            className={`toggle-pill ${calendar === "BS" ? "active" : ""}`}
            onClick={() => handleCalendarChange("BS")}
          >
            नेपाली
          </button>
        </div>
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
