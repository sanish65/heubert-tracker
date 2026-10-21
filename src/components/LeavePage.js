"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import LeaveCalendar from "./LeaveCalendar";
import EditLeaveModal from "./EditLeaveModal";
import Icon from "./Icon";
import Avatar from "./Avatar";
import { formatBs } from "@/lib/nepaliDate";
import { computeLeaveBalances, parseHalfDaySegment, stripHalfDaySegmentPrefix, groupPublicHolidays } from "@/lib/utils";

const TYPE_LABELS = { full: "Full Day", half: "Half Day", early: "Early Leave" };
const SEGMENT_LABELS = { first: "First Half", second: "Second Half" };
const PRE_SEASON = "pre-season";
const PRE_SEASON_LABEL = "Pre Fiscal Year Leaves";

// A leave type's meter turns amber from this share of its quota used.
const WARN_SHARE = 0.8;

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// Whole days from `from` to `to`, both "YYYY-MM-DD".
function daysBetween(from, to) {
  const [y1, m1, d1] = from.split("-").map(Number);
  const [y2, m2, d2] = to.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

// Parsed as local time — a bare "YYYY-MM-DD" goes through Date() as UTC and can render
// as the day before in timezones behind it.
function toDate(day) {
  return new Date(day + "T00:00:00");
}

function shortDate(day, withWeekday = false) {
  const d = toDate(day);
  return d.toLocaleDateString("en-US", {
    ...(withWeekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

function formatHolidayDate(day) {
  return toDate(day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// "Today", "Tomorrow", "In 7 days", "3 days ago" for a leave or holiday span.
function relativeWhen(start, end, today) {
  if (start <= today && today <= end) return { text: "Today", now: true };
  if (start > today) {
    const n = daysBetween(today, start);
    return { text: n === 1 ? "Tomorrow" : `In ${n} days`, soon: n === 1 };
  }
  const n = daysBetween(end, today);
  return { text: n === 1 ? "Yesterday" : `${n} days ago`, past: true };
}

// Used against quota: primary within it, amber from WARN_SHARE, red once over.
function meterState(used, quota) {
  if (used > quota) return "over";
  if (quota > 0 && used / quota >= WARN_SHARE) return "warn";
  return "ok";
}

export default function LeavePage({ onAddHoliday, onAddSeason, onEditSeason }) {
  const { leaves: allLeaves, leaveSeasons, employees, deleteLeave, isAdmin, canManageLeave, publicHolidays, deletePublicHoliday, leaveTypes, animationsEnabled } = useApp();
  const { confirmDialog } = useDialog();
  const leaveExcludedNames = useMemo(
    () => new Set(employees.filter((e) => e.leave_excluded).map((e) => e.name)),
    [employees]
  );
  const leaves = useMemo(
    () => allLeaves.filter((l) => !leaveExcludedNames.has(l.employee_name)),
    [allLeaves, leaveExcludedNames]
  );
  const [filterEmployee, setFilterEmployee] = useState("");
  const [editingLeave, setEditingLeave] = useState(null);
  const [activeSeasonId, setActiveSeasonId] = useState(null);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const today = localToday();

  const leaveTypeById = useMemo(() => {
    const map = new Map();
    (leaveTypes || []).forEach((t) => map.set(t.id, t));
    return map;
  }, [leaveTypes]);

  const holidaySet = useMemo(
    () => new Set((publicHolidays || []).map((h) => h.date?.split("T")[0])),
    [publicHolidays]
  );

  // Stored one row per day; shown as one entry per holiday. Upcoming first, soonest at
  // the top, then past ones most recent first.
  const holidayGroups = useMemo(() => {
    const groups = groupPublicHolidays(publicHolidays);
    const upcoming = groups.filter((h) => h.endDate >= today);
    const past = groups.filter((h) => h.endDate < today).reverse();
    return [...upcoming, ...past];
  }, [publicHolidays, today]);

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
  const seasonLabel = activeSeason ? activeSeason.title : activeSeasonId === PRE_SEASON ? PRE_SEASON_LABEL : "";

  const seasonLeaves = useMemo(() => {
    if (activeSeasonId === PRE_SEASON) return leaves.filter((l) => !l.season_id);
    return leaves.filter((l) => l.season_id === activeSeasonId);
  }, [leaves, activeSeasonId]);

  // Real leaves the season filter keeps off the calendar — passed in so the calendar can
  // flag them instead of silently swallowing them.
  const outOfSeasonLeaves = useMemo(() => {
    if (activeSeasonId === PRE_SEASON) return leaves.filter((l) => !!l.season_id);
    return leaves.filter((l) => (l.season_id ?? null) !== activeSeasonId);
  }, [leaves, activeSeasonId]);

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

  // Leaves not yet over, soonest first. When there are none (a past season), the list
  // shows every record instead.
  const upcoming = useMemo(
    () => filtered.filter((l) => (l.end_date || l.start_date) >= today).reverse(),
    [filtered, today]
  );
  const showingAll = showAllRecords || upcoming.length === 0;
  const listed = showingAll ? filtered : upcoming;

  // Employee leave summary — scoped to the active season, so a new season starts at zero
  const empSummary = useMemo(() => {
    return employees.filter((emp) => !emp.leave_excluded).map((emp) => {
      const empLeaves = seasonLeaves.filter((l) => l.employee_name === emp.name);
      const totalDays = empLeaves.reduce((sum, l) => {
        const days = l.dates ? l.dates.length : calculateDays(l.start_date, l.end_date, l.type);
        return sum + (l.type === "half" ? days * 0.5 : days);
      }, 0);
      return { name: emp.name, records: empLeaves.length, totalDays };
    }).filter((e) => e.records > 0).sort((a, b) => b.totalDays - a.totalDays);
  }, [employees, seasonLeaves]);

  // Per person, each active leave type's used-of-quota for the active season.
  const balancesByName = useMemo(() => {
    const map = new Map();
    empSummary.forEach((emp) => {
      map.set(emp.name, computeLeaveBalances(emp.name, leaves, leaveTypes, effectiveSeasonId, holidaySet));
    });
    return map;
  }, [empSummary, leaves, leaveTypes, effectiveSeasonId, holidaySet]);

  const toggleEmployee = (name) => setFilterEmployee(filterEmployee === name ? "" : name);

  const renderSeasonChip = (s, isLatest) => {
    const isActive = activeSeasonId === s.id;
    return (
      <span key={s.id} className={`leave-season-chip${isActive ? " is-active" : ""}${isAdmin ? " has-edit" : ""}`}>
        <button
          type="button"
          className="leave-season-btn"
          aria-pressed={isActive}
          onClick={() => setActiveSeasonId(s.id)}
        >
          {isActive && <span className="leave-season-dot" aria-hidden="true" />}
          <span className="leave-season-name">{s.title}</span>
          {isLatest && <span className="leave-season-current mono">Current</span>}
        </button>
        {isAdmin && (
          <button
            type="button"
            className="leave-season-edit"
            onClick={() => onEditSeason(s)}
            aria-label={`Edit season ${s.title}`}
            title="Edit season"
          >
            <Icon name="edit" size={14} strokeWidth={2} />
          </button>
        )}
      </span>
    );
  };

  const renderLeave = (leave) => {
    const dayCount =
      leave.type === "half"
        ? (leave.dates || []).length * 0.5
        : (leave.dates || []).length;
    const days = dayCount || calculateDays(leave.start_date, leave.end_date, leave.type);
    const end = leave.end_date || leave.start_date;
    const when = relativeWhen(leave.start_date, end, today);
    const segment = parseHalfDaySegment(leave);
    const leaveType = leaveTypeById.get(leave.leave_type_id);
    const reason = stripHalfDaySegmentPrefix(leave.reason);
    const sameDay = leave.start_date === end;
    const bs = sameDay ? formatBs(leave.start_date) : `${formatBs(leave.start_date)} – ${formatBs(end)}`;

    return (
      <article key={leave.id} className="leave-item">
        <Avatar name={leave.employee_name} className="avatar leave-item-avatar" aria-hidden="true" />
        <div className="leave-item-body">
          <div className="leave-item-top">
            <span className="leave-item-name">{leave.employee_name}</span>
            <span className={`leave-item-when mono${when.now ? " is-now" : ""}`}>{when.text}</span>
          </div>
          <span className="leave-item-dates mono" title={bs ? `${bs} BS` : undefined}>
            {sameDay ? shortDate(leave.start_date, true) : `${shortDate(leave.start_date)} – ${shortDate(end)}`}
            {" · "}
            {plural(days, "working day")}
          </span>
          <div className="leave-item-pills">
            <span className="pill pill-gray">{TYPE_LABELS[leave.type]}</span>
            <span className={`pill ${!leaveType ? "pill-gray" : leaveType.is_unpaid ? "pill-amber" : "pill-cyan"}`}>
              {leaveType?.name || "Uncategorized"}
              {leaveType?.is_unpaid ? " · Unpaid" : ""}
            </span>
            {segment && <span className="pill pill-violet">{SEGMENT_LABELS[segment]}</span>}
          </div>
          {reason && <span className="leave-item-reason">{reason}</span>}
        </div>
        {canManageLeave(leave) && (
          <div className="leave-item-actions">
            <button
              type="button"
              className="btn-icon btn-sm leave-icon-btn"
              onClick={() => setEditingLeave(leave)}
              aria-label={`Edit leave for ${leave.employee_name}`}
              title="Edit"
            >
              <Icon name="edit" size={15} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="btn-icon btn-sm leave-icon-btn leave-icon-delete"
              onClick={async () => { if (await confirmDialog(`Delete leave? ${leave.employee_name}`, { danger: true })) deleteLeave(leave.id); }}
              aria-label={`Delete leave for ${leave.employee_name}`}
              title="Delete"
            >
              <Icon name="trash" size={15} strokeWidth={2} />
            </button>
          </div>
        )}
      </article>
    );
  };

  const renderHoliday = (holiday) => {
    const when = relativeWhen(holiday.startDate, holiday.endDate, today);
    const start = toDate(holiday.startDate);
    let pill = { text: plural(holiday.days, "day"), cls: "pill-gray" };
    if (when.now) pill = { text: "Today", cls: "pill-amber" };
    else if (when.soon) pill = { text: "Tomorrow", cls: "pill-amber" };
    else if (when.past) pill = { text: "Past", cls: "pill-gray" };
    const range = holiday.days === 1
      ? formatHolidayDate(holiday.startDate)
      : `${shortDate(holiday.startDate)} – ${formatHolidayDate(holiday.endDate)} · ${plural(holiday.days, "day")}`;

    return (
      <div key={holiday.key} className={`leave-holiday${when.past ? " is-past" : ""}${when.now || when.soon ? " is-near" : ""}`}>
        <div className="leave-holiday-date" title={`${formatBs(holiday.startDate)} BS`}>
          <span className="leave-holiday-mon mono">{start.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span>
          <span className="leave-holiday-day">{String(start.getDate()).padStart(2, "0")}</span>
        </div>
        <div className="leave-holiday-text">
          <div className="leave-holiday-top">
            <span className="leave-holiday-title">{holiday.title}</span>
            <span className={`pill ${pill.cls}`}>{pill.text}</span>
          </div>
          <span className="leave-holiday-range mono">{range}</span>
        </div>
        {isAdmin && (
          <button
            type="button"
            className="btn-icon btn-sm leave-icon-btn"
            aria-label={holiday.days === 1 ? `Delete holiday ${holiday.title}` : `Delete all ${holiday.days} days of ${holiday.title}`}
            title="Delete holiday"
            onClick={async () => {
              const what = holiday.days === 1
                ? `holiday "${holiday.title}"`
                : `all ${holiday.days} days of "${holiday.title}"`;
              if (await confirmDialog(`Delete ${what}?`, { danger: true })) {
                deletePublicHoliday(holiday.ids);
              }
            }}
          >
            <Icon name="x" size={15} strokeWidth={2} />
          </button>
        )}
      </div>
    );
  };

  const renderSummaryCard = (emp) => {
    const balances = balancesByName.get(emp.name) || [];
    const unpaid = balances.filter((b) => b.is_unpaid).reduce((s, b) => s + b.used, 0);
    const isActive = filterEmployee === emp.name;
    return (
      <article
        key={emp.name}
        className={`leave-emp-card${animationsEnabled !== false ? " card-lift" : ""}${isActive ? " is-active" : ""}`}
      >
        <div className="leave-emp-head">
          <Avatar name={emp.name} className="avatar" aria-hidden="true" />
          <div className="leave-emp-text">
            <span className="leave-emp-name">{emp.name}</span>
            <span className="leave-emp-meta">
              {plural(emp.records, "record")} · {unpaid ? `${unpaid}d unpaid` : "no unpaid"}
            </span>
          </div>
          <span className="leave-emp-total">{emp.totalDays}d</span>
          <button
            type="button"
            className="btn-icon btn-sm leave-emp-filter"
            aria-pressed={isActive}
            aria-label={isActive ? "Show everyone on the calendar" : `Show only ${emp.name} on the calendar`}
            title={isActive ? "Show everyone" : "Show on calendar"}
            onClick={() => toggleEmployee(emp.name)}
          >
            <Icon name="calendar" size={14} strokeWidth={2} />
          </button>
        </div>
        {balances.length > 0 && (
          <div className="leave-meters">
            {balances.map((b) => {
              const state = meterState(b.used, b.annual_days);
              const width = b.annual_days > 0 ? Math.min(100, (b.used / b.annual_days) * 100) : b.used > 0 ? 100 : 0;
              const left = state === "over"
                ? `${b.used - b.annual_days} over`
                : b.remaining === 0 ? "None left" : `${b.remaining} left`;
              return (
                <div key={b.id} className={`leave-meter is-${state}`}>
                  <div className="leave-meter-row">
                    <span className="leave-meter-name">{b.name}</span>
                    <span className="leave-meter-used mono">{b.used} / {b.annual_days}</span>
                    <span className="leave-meter-left">{left}</span>
                  </div>
                  <div className="leave-meter-track" aria-hidden="true">
                    <div className="leave-meter-fill" style={{ width: `${width}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </article>
    );
  };

  return (
    <>
      <div className="leave-page">
        <section className="leave-season-bar glass" aria-label="Leave season">
          <span className="eyebrow leave-season-label">Season</span>
          <div className="leave-season-chips" role="group" aria-label="Choose leave season">
            {sortedLeaveSeasons.map((s, i) => renderSeasonChip(s, i === 0))}
            {hasPreSeasonLeaves && (
              <button
                type="button"
                className={`leave-season-pre${activeSeasonId === PRE_SEASON ? " is-active" : ""}`}
                aria-pressed={activeSeasonId === PRE_SEASON}
                onClick={() => setActiveSeasonId(PRE_SEASON)}
              >
                <Icon name="folder" size={14} strokeWidth={2} />
                {PRE_SEASON_LABEL}
              </button>
            )}
            {sortedLeaveSeasons.length === 0 && !hasPreSeasonLeaves && (
              <span className="empty-msg">No leave seasons yet.</span>
            )}
          </div>
          {isAdmin && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onAddSeason}>
              <Icon name="plus" size={14} strokeWidth={2.2} /> New Season
            </button>
          )}
        </section>

        <div className="leave-layout">
          <LeaveCalendar
            leaves={seasonLeaves}
            selectedEmployee={filterEmployee || null}
            publicHolidays={publicHolidays}
            outOfSeasonLeaves={outOfSeasonLeaves}
            employeeOptions={empSummary.map((e) => e.name)}
            onSelectEmployee={setFilterEmployee}
          />

          <div className="leave-side">
            <section className="leave-side-card glass-card" aria-labelledby="leave-list-title">
              <div className="leave-card-head">
                <h2 id="leave-list-title" className="section-title">
                  {showingAll ? "Leave records" : "Upcoming leaves"}
                </h2>
                <span className="pill pill-blue">{plural(listed.length, "record")}</span>
              </div>
              {filterEmployee && (
                <button
                  type="button"
                  className="pill pill-blue leave-filter-chip"
                  onClick={() => setFilterEmployee("")}
                  aria-label={`Clear filter: ${filterEmployee}`}
                >
                  {filterEmployee}
                  <Icon name="x" size={12} strokeWidth={2.4} />
                </button>
              )}
              {listed.length === 0 ? (
                <p className="empty-msg">No leave records in this season yet. Use Record Leave above to add one.</p>
              ) : (
                <div className="leave-items">{listed.map(renderLeave)}</div>
              )}
              {upcoming.length > 0 && filtered.length > upcoming.length && (
                <button type="button" className="leave-link-btn" onClick={() => setShowAllRecords((v) => !v)}>
                  {showAllRecords ? "Show upcoming only" : `Show all ${plural(filtered.length, "leave record")}`}
                </button>
              )}
            </section>

            <section className="leave-side-card glass-card" aria-labelledby="leave-holidays-title">
              <div className="leave-card-head">
                <h2 id="leave-holidays-title" className="section-title">Public holidays</h2>
                {isAdmin && (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={onAddHoliday}>
                    <Icon name="plus" size={13} strokeWidth={2.4} /> Add Holiday
                  </button>
                )}
              </div>
              {holidayGroups.length === 0 ? (
                <p className="empty-msg">No public holidays recorded.</p>
              ) : (
                <div className="leave-holidays">{holidayGroups.map(renderHoliday)}</div>
              )}
            </section>
          </div>
        </div>

        <section className="leave-summary glass-card" aria-labelledby="leave-summary-title">
          <div className="leave-summary-head">
            <div className="leave-summary-heading">
              <h2 id="leave-summary-title" className="section-title">Leave summary by employee</h2>
              <span className="leave-summary-sub">
                Days used against each leave type&apos;s yearly quota{seasonLabel ? ` in ${seasonLabel}` : ""} · quotas are set in Settings, Leave Types
              </span>
            </div>
            <div className="leave-meter-legend">
              <span className="leave-meter-key"><span className="leave-meter-swatch is-ok" aria-hidden="true" />Within quota</span>
              <span className="leave-meter-key"><span className="leave-meter-swatch is-warn" aria-hidden="true" />80% used</span>
              <span className="leave-meter-key"><span className="leave-meter-swatch is-over" aria-hidden="true" />Over quota</span>
            </div>
          </div>
          {empSummary.length === 0 ? (
            <p className="empty-msg">No leave records in this season yet.</p>
          ) : (
            <div className="leave-emp-grid">{empSummary.map(renderSummaryCard)}</div>
          )}
        </section>
      </div>

      <EditLeaveModal
        isOpen={!!editingLeave}
        onClose={() => setEditingLeave(null)}
        leave={editingLeave}
      />
    </>
  );
}
