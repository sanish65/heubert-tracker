"use client";

import { useState, useMemo, useCallback } from "react";
import { describeLeave } from "@/lib/utils";
import { avatarColor } from "@/lib/avatar";
import Icon from "./Icon";
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

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Bar lanes under each week's day numbers (Leaves.dc.html). When a week needs more,
// the last lane turns into a per-day "+N" count, so a busy week never hides anyone.
const LANES = 3;

function pad(n) {
  return String(n).padStart(2, "0");
}

// Holidays take the top lane, then company events, then leaves.
const barRank = (bar) => (bar.holiday ? 2 : bar.event ? 1 : 0);

// Lowest free lane for each bar, in barRank order.
function assignLanes(bars) {
  const sorted = [...bars].sort(
    (a, b) => barRank(b) - barRank(a) || a.start - b.start || b.span - a.span
  );
  const laneEnds = [];
  for (const bar of sorted) {
    let lane = laneEnds.findIndex((end) => end < bar.start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = bar.start + bar.span - 1;
    bar.lane = lane;
  }
  return sorted;
}

export default function LeaveCalendar({
  leaves,
  selectedEmployee,
  publicHolidays = [],
  companyEvents = [],
  outOfSeasonLeaves = [],
  employeeOptions = [],
  onSelectEmployee,
}) {
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
  const holidayTitles = useMemo(() => {
    const map = new Map();
    (publicHolidays || []).forEach((h) => {
      const day = h.date?.split("T")[0];
      if (day && !map.has(day)) map.set(day, h.title);
    });
    return map;
  }, [publicHolidays]);

  // date-string → [event titles], for the company events (Events tab) on the calendar.
  const eventsByDay = useMemo(() => {
    const map = new Map();
    (companyEvents || []).forEach((e) => {
      const day = String(e.date || "").slice(0, 10);
      if (!day || !e.title) return;
      if (!map.has(day)) map.set(day, []);
      map.get(day).push({ id: e.id, title: e.title });
    });
    return map;
  }, [companyEvents]);

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

      if (!isWeekend && !holidayTitles.has(dtStr)) {
        dates.push(dtStr);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }, [holidayTitles]);

  const visibleLeaves = useMemo(
    () => (selectedEmployee ? leaves.filter((l) => l.employee_name === selectedEmployee) : leaves),
    [leaves, selectedEmployee]
  );

  // Each leave with the working days it covers, resolved once.
  const leaveDates = useMemo(
    () => visibleLeaves.map((leave) => ({ leave, dates: leave.dates || getDatesInRange(leave.start_date, leave.end_date) })),
    [visibleLeaves, getDatesInRange]
  );

  // date-string → [{ type, name, id, reason }]
  const leaveDateMap = useMemo(() => {
    const map = {};
    leaveDates.forEach(({ leave, dates }) => {
      dates.forEach((d) => {
        if (!map[d]) map[d] = [];
        map[d].push({ type: leave.type, name: leave.employee_name, id: leave.id, reason: leave.reason });
      });
    });
    return map;
  }, [leaveDates]);

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

  // date-string → { week, col } for the days on screen.
  const slotOf = useMemo(() => {
    const map = new Map();
    grid.days.forEach((day, i) => {
      const n = grid.lead + i;
      map.set(day.dateStr, { week: Math.floor(n / 7), col: n % 7 });
    });
    return map;
  }, [grid]);

  // Weeks of seven slots, each with its bars: one per run of consecutive days a person
  // (or a holiday) covers inside that week.
  const weeks = useMemo(() => {
    const count = Math.ceil((grid.lead + grid.days.length) / 7);
    const out = Array.from({ length: count }, () => ({ days: Array(7).fill(null), bars: [] }));
    grid.days.forEach((day) => {
      const { week, col } = slotOf.get(day.dateStr);
      out[week].days[col] = day;
    });

    const pushRuns = (slots, make) => {
      const sorted = [...slots].sort((a, b) => a.week - b.week || a.col - b.col);
      let run = null;
      for (const s of sorted) {
        if (run && run.week === s.week && run.start + run.span === s.col) {
          run.span += 1;
        } else {
          if (run) out[run.week].bars.push(make(run));
          run = { week: s.week, start: s.col, span: 1 };
        }
      }
      if (run) out[run.week].bars.push(make(run));
    };

    leaveDates.forEach(({ leave, dates }) => {
      const slots = dates.map((d) => slotOf.get(d)).filter(Boolean);
      pushRuns(slots, (run) => ({ ...run, leave, key: `${leave.id}-${run.week}-${run.start}` }));
    });

    // Consecutive holiday days with the same title share one bar.
    const byTitle = new Map();
    grid.days.forEach((day) => {
      const title = holidayTitles.get(day.dateStr);
      if (title === undefined) return;
      if (!byTitle.has(title)) byTitle.set(title, []);
      byTitle.get(title).push(slotOf.get(day.dateStr));
    });
    byTitle.forEach((slots, title) =>
      pushRuns(slots, (run) => ({ ...run, holiday: title, key: `h-${title}-${run.week}-${run.start}` }))
    );

    // Company events are one day each.
    grid.days.forEach((day) => {
      const { week, col } = slotOf.get(day.dateStr);
      (eventsByDay.get(day.dateStr) || []).forEach((event) =>
        out[week].bars.push({ week, start: col, span: 1, event, key: `e-${event.id}-${day.dateStr}` })
      );
    });

    out.forEach((w) => {
      const laid = assignLanes(w.bars);
      const overflowing = laid.some((b) => b.lane >= LANES);
      const shown = overflowing ? LANES - 1 : LANES;
      w.bars = laid.filter((b) => b.lane < shown);
      // Per day, everyone who did not get a lane of their own.
      w.more = [];
      if (overflowing) {
        for (let col = 0; col < 7; col++) {
          const hidden = laid.filter((b) => b.lane >= shown && b.start <= col && col < b.start + b.span);
          if (hidden.length) w.more.push({ col, names: hidden.map((b) => b.holiday || b.event?.title || b.leave.employee_name) });
        }
      }
    });
    return out;
  }, [grid, slotOf, leaveDates, holidayTitles, eventsByDay]);

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
    let count = 0;
    let days = 0;

    leaveDates.forEach(({ leave, dates }) => {
      const datesInThisMonth = dates.filter((d) => monthDates.has(d));

      if (datesInThisMonth.length > 0) {
        count++;
        days += (leave.type === "half" ? datesInThisMonth.length * 0.5 : datesInThisMonth.length);
      }
    });

    return { filteredLeavesCount: count, totalDays: days };
  }, [leaveDates, monthDates]);

  const onLeaveToday = (leaveDateMap[todayStr] || []).length;

  // Leaves that exist for this month but sit in a different season, so they are filtered
  // out of the grid above. Surfaced instead of silently dropped — a leave that shows up in
  // "Upcoming leaves" but nowhere on the calendar is otherwise impossible to explain.
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

  const options = selectedEmployee && !employeeOptions.includes(selectedEmployee)
    ? [selectedEmployee, ...employeeOptions]
    : employeeOptions;

  const renderDay = (day, col) => {
    const { dateStr, primary, secondary } = day;
    const dayLeaves = leaveDateMap[dateStr] || [];
    const isToday = dateStr === todayStr;
    const holidayTitle = holidayTitles.get(dateStr);
    const isHoliday = holidayTitle !== undefined;
    const isWeekend = col === 0 || col === 6;

    let cellClass = "cal-cell";
    if (isHoliday) cellClass += " is-holiday";
    else if (isWeekend) cellClass += " is-weekend";
    if (isToday) cellClass += " is-today";

    // One tooltip for the whole cell, one line per person.
    const tooltipLines = [];
    if (isHoliday) tooltipLines.push(`Holiday: ${holidayTitle}`);
    (eventsByDay.get(dateStr) || []).forEach((e) => tooltipLines.push(`Event: ${e.title}`));
    dayLeaves.forEach((l) => tooltipLines.push(`${l.name} — ${describeLeave(l)}`));
    const tooltip = tooltipLines.join("\n");

    return (
      <div
        key={dateStr}
        className={cellClass}
        style={{ gridColumn: col + 1 }}
        {...(tooltip ? { title: tooltip } : {})}
      >
        {isToday ? (
          <span className="cal-today-mark">
            <span className="cal-today-num">{primary}</span>
            <span className="cal-today-label mono">Today</span>
          </span>
        ) : (
          <span className="cal-day-num">{primary}</span>
        )}
        {secondary !== "" && <span className="cal-day-alt mono">{secondary}</span>}
      </div>
    );
  };

  const renderBar = (bar) => {
    const style = { gridColumn: `${bar.start + 1} / span ${bar.span}`, gridRow: bar.lane + 2 };
    if (bar.holiday) {
      return (
        <div key={bar.key} className="cal-bar cal-bar-holiday" style={style} title={`Public holiday: ${bar.holiday}`}>
          <span className="cal-bar-label">{bar.holiday}</span>
          <span className="cal-bar-tag mono">Holiday</span>
        </div>
      );
    }
    if (bar.event) {
      return (
        <div key={bar.key} className="cal-bar cal-bar-event" style={style} title={`Company event: ${bar.event.title}`}>
          <Icon name="flag" size={12} strokeWidth={2.2} />
          <span className="cal-bar-label">{bar.event.title}</span>
        </div>
      );
    }
    const { leave } = bar;
    const name = leave.employee_name;
    const tag = leave.type === "half" ? "½" : leave.type === "early" ? "Early" : "";
    return (
      <div
        key={bar.key}
        className={`cal-bar cal-bar-${leave.type}`}
        style={{ ...style, "--bar": avatarColor(name) }}
        title={`${name} — ${describeLeave(leave)}`}
      >
        <span className="cal-bar-label">{bar.span > 1 ? name : name.split(" ")[0]}</span>
        {tag && <span className="cal-bar-tag mono">{tag}</span>}
      </div>
    );
  };

  return (
    <section className="leave-cal-card glass-card" aria-labelledby="leave-cal-title">
      <div className="cal-header">
        <div className="cal-nav">
          <button type="button" className="btn-icon cal-nav-btn" onClick={prevMonth} aria-label="Previous month">
            <Icon name="chevron-left" size={16} strokeWidth={2} />
          </button>
          <button type="button" className="btn-icon cal-nav-btn" onClick={nextMonth} aria-label="Next month">
            <Icon name="chevron-right" size={16} strokeWidth={2} />
          </button>
        </div>
        <div className="cal-heading">
          <h2 id="leave-cal-title" className="cal-title">
            {calendar === "BS"
              ? `${BS_MONTH_NAMES[bsView.month - 1]} ${bsView.year}`
              : `${MONTHS[viewMonth]} ${viewYear}`}
          </h2>
          <span className="cal-title-alt mono">{titleAlt}</span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm cal-today-btn" onClick={goToday}>Today</button>
        <div className="status-tabs" role="group" aria-label="Calendar system">
          <button
            type="button"
            className={`tab ${calendar === "AD" ? "tab-active" : ""}`}
            aria-pressed={calendar === "AD"}
            onClick={() => handleCalendarChange("AD")}
          >
            English
          </button>
          <button
            type="button"
            lang="ne"
            className={`tab ${calendar === "BS" ? "tab-active" : ""}`}
            aria-pressed={calendar === "BS"}
            onClick={() => handleCalendarChange("BS")}
          >
            नेपाली
          </button>
        </div>
        {onSelectEmployee && (
          <label className="cal-filter">
            Show
            <select value={selectedEmployee || ""} onChange={(e) => onSelectEmployee(e.target.value)}>
              <option value="">All employees</option>
              {options.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      <div className="cal-stats-bar">
        <span className="cal-stat">
          <span className="cal-stat-num">{filteredLeavesCount}</span> leave records
        </span>
        <span className="cal-stat">
          <span className="cal-stat-num">{totalDays}</span> working days off
        </span>
        <span className="cal-stat">
          <span className="cal-stat-num">{onLeaveToday}</span> on leave today
        </span>
        {hiddenThisMonth > 0 && (
          <span
            className="pill pill-amber cal-stat-warn"
            title="These leaves belong to a different leave season. Switch season above to see them."
          >
            <Icon name="alert" size={12} strokeWidth={2.2} />
            {hiddenThisMonth} in another season
          </span>
        )}
      </div>

      <div className="cal-scroll">
        <div className="cal-month">
          <div className="cal-week cal-week-head" aria-hidden="true">
            {DAYS.map((d, i) => (
              <span key={d} className={`cal-head${i === 0 || i === 6 ? " is-weekend" : ""}`}>{d}</span>
            ))}
          </div>
          {weeks.map((week, w) => (
            <div key={w} className="cal-week">
              {week.days.map((day, col) => (day ? renderDay(day, col) : null))}
              {week.bars.map(renderBar)}
              {week.more.map(({ col, names }) => (
                <div
                  key={`more-${col}`}
                  className="cal-bar cal-bar-more"
                  style={{ gridColumn: col + 1, gridRow: LANES + 1 }}
                  title={names.join("\n")}
                >
                  <span className="cal-bar-label">+{names.length} more</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      <div className="cal-legend">
        <span className="cal-legend-item"><span className="cal-swatch cal-swatch-full" aria-hidden="true" />Full day</span>
        <span className="cal-legend-item"><span className="cal-swatch cal-swatch-half" aria-hidden="true" />Half day (½)</span>
        <span className="cal-legend-item"><span className="cal-swatch cal-swatch-early" aria-hidden="true" />Early leave</span>
        <span className="cal-legend-item"><span className="cal-swatch cal-swatch-holiday" aria-hidden="true" />Public holiday</span>
        <span className="cal-legend-item"><span className="cal-swatch cal-swatch-event" aria-hidden="true" />Company event</span>
        <span className="cal-legend-note">Bar colour = person · weekends and holidays are never counted</span>
      </div>
    </section>
  );
}
