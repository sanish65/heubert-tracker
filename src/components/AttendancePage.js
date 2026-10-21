"use client";

import { useState, useMemo, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import StatsCard from "./StatsCard";
import AttendancePunchWidget from "./AttendancePunchWidget";
import EditAttendanceModal from "./EditAttendanceModal";
import Modal from "./Modal";
import Icon from "./Icon";
import {
  formatBs,
  formatBsDevanagari,
  formatBsNumeric,
  bsMonthRange,
  adToBs,
  bsToAd,
  bsMonthLength,
  bsMonthSpan,
  BS_MONTH_NAMES,
  BS_YEAR_BOUNDS,
} from "@/lib/nepaliDate";

function pad(n) {
  return String(n).padStart(2, "0");
}

function formatTime(isoStr) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleTimeString("en-US", {
    timeZone: "Asia/Kathmandu",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function formatWeekday(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
}

function formatMonthDay(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Status pill per day, from the canvas pill set: leave cyan (criterion 11); holidays,
// weekends and days not yet reached grey.
const STATUS_STYLES = {
  present: { pill: "pill-green", label: "Present" },
  late: { pill: "pill-amber", label: "Late" },
  absent: { pill: "pill-red", label: "Absent" },
  leave: { pill: "pill-cyan", label: "Leave" },
  holiday: { pill: "pill-gray", label: "Holiday" },
  weekend: { pill: "pill-gray", label: "Weekend" },
  pending: { pill: "pill-gray", label: "Pending" },
  upcoming: { pill: "pill-gray", label: "Upcoming" },
};

// Dot colours for the summary tiles, as on the artboard.
const STAT_DOTS = {
  present: "var(--accent-green)",
  late: "var(--unpaid)",
  absent: "var(--accent-red)",
  leave: "var(--cyan)",
  hours: "var(--primary)",
};

// First and last Gregorian day of a period, as ["YYYY-MM-DD", "YYYY-MM-DD"].
function adMonthSpan(month) {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return null;
  return [`${month}-01`, `${month}-${pad(new Date(y, m, 0).getDate())}`];
}

function formatHours(hours) {
  if (hours == null) return "—";
  return `${hours.toFixed(1)}h`;
}

function StatusPill({ status }) {
  const s = STATUS_STYLES[status];
  if (!s) return null;
  return <span className={`pill ${s.pill}`}>{s.label}</span>;
}

export default function AttendancePage() {
  const {
    employees,
    attendance,
    leaves,
    publicHolidays,
    leaveTypes,
    officeSettings,
    updateOfficeSettings,
    currentEmployee,
    isAdmin,
    canPunchAttendance,
    setEmployeePunchAccess,
    setEmployeeOfficeBoundPunch,
    deleteAttendanceRecord,
  } = useApp();
  const { confirmDialog, alertDialog } = useDialog();

  const [selectedEmployee, setSelectedEmployee] = useState(currentEmployee?.name || "");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [calendar, setCalendar] = useState("AD"); // "AD" = Gregorian month, "BS" = Nepali month
  const [bsPeriod, setBsPeriod] = useState(() => {
    const bs = adToBs(new Date().toISOString().slice(0, 10));
    return bs ? { year: bs.year, month: bs.month } : { year: BS_YEAR_BOUNDS.max, month: 1 };
  });
  const [editingDay, setEditingDay] = useState(null);
  const [expanded, setExpanded] = useState(false);

  const handleDeleteRecord = async (record) => {
    if (
      !(await confirmDialog(`Delete attendance for ${record.employee_name} on ${formatDate(record.date)}?`, {
        danger: true,
      }))
    ) {
      return;
    }
    const { error } = await deleteAttendanceRecord(record.id);
    if (error) await alertDialog(`Error deleting attendance: ${error.message || "Check connection"}`, { tone: "error" });
  };

  useEffect(() => {
    if (!selectedEmployee && currentEmployee?.name) setSelectedEmployee(currentEmployee.name);
  }, [currentEmployee, selectedEmployee]);

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status !== "resigned").sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  );

  const todayStr = new Date().toISOString().slice(0, 10);

  // The days the sheet covers, as Gregorian date strings. A BS month maps onto a
  // contiguous run of Gregorian days that straddles two Gregorian months.
  const range = useMemo(() => {
    if (calendar === "BS") {
      const length = bsMonthLength(bsPeriod.year, bsPeriod.month);
      const days = [];
      for (let d = 1; d <= length; d++) {
        const dateStr = bsToAd(bsPeriod.year, bsPeriod.month, d);
        if (dateStr) days.push(dateStr);
      }
      return days;
    }

    const [year, month] = selectedMonth.split("-").map(Number);
    if (!year || !month) return [];
    const lastDay = new Date(year, month, 0).getDate();
    const days = [];
    for (let d = 1; d <= lastDay; d++) days.push(`${selectedMonth}-${pad(d)}`);
    return days;
  }, [calendar, selectedMonth, bsPeriod]);

  // Switching calendars keeps you on the same stretch of time. The target calendar's stored
  // period is kept when it still overlaps what's on screen, so toggling back and forth
  // returns you exactly where you started; otherwise it re-anchors on the midpoint of the
  // current view. The two calendars' months are offset by roughly half a month, so the
  // midpoint alone would drift a month on about one switch in six.
  const handleCalendarChange = (next) => {
    if (next === calendar) return;

    const first = range[0];
    const last = range[range.length - 1];
    const stored =
      next === "BS" ? bsMonthSpan(bsPeriod.year, bsPeriod.month) : adMonthSpan(selectedMonth);
    const stillOverlaps = stored && first && stored[0] <= last && stored[1] >= first;

    if (first && !stillOverlaps) {
      const anchor = range[Math.floor(range.length / 2)];
      if (next === "BS") {
        const bs = adToBs(anchor);
        if (bs) setBsPeriod({ year: bs.year, month: bs.month });
      } else {
        setSelectedMonth(anchor.slice(0, 7));
      }
    }
    setCalendar(next);
  };

  const sheet = useMemo(() => {
    if (!selectedEmployee) return [];

    const holidayTitles = new Map(publicHolidays.map((h) => [h.date, h.title]));
    const leaveTypeNames = new Map((leaveTypes || []).map((t) => [t.id, t.name]));
    const empLeaves = leaves.filter((l) => l.employee_name === selectedEmployee);
    const empAttendance = new Map(
      attendance.filter((a) => a.employee_name === selectedEmployee).map((a) => [a.date, a])
    );

    const days = [];
    for (const dateStr of range) {
      const [y, m, d] = dateStr.split("-").map(Number);
      const dow = new Date(y, m - 1, d).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidayTitles.has(dateStr);
      const leave = empLeaves.find((l) => dateStr >= l.start_date && dateStr <= l.end_date);
      const onLeave = !!leave;
      const record = empAttendance.get(dateStr);
      const hours =
        record?.check_in_at && record?.check_out_at
          ? (new Date(record.check_out_at) - new Date(record.check_in_at)) / 3600000
          : null;

      let status;
      if (onLeave) status = "leave";
      else if (isHoliday) status = "holiday";
      else if (isWeekend) status = "weekend";
      else if (record?.is_late) status = "late";
      else if (record?.check_in_at) status = "present";
      else if (dateStr < todayStr) status = "absent";
      else if (dateStr === todayStr) status = "pending";
      else status = "upcoming";

      // Short context beside the status pill: minutes late, the holiday, the leave type.
      let note = "";
      if (status === "late" && record?.late_minutes) note = `${record.late_minutes} min late`;
      else if (status === "holiday") note = holidayTitles.get(dateStr) || "";
      else if (status === "leave") note = leaveTypeNames.get(leave.leave_type_id) || "";

      days.push({ dateStr, record, status, hours, note, isToday: dateStr === todayStr });
    }
    return days;
  }, [selectedEmployee, attendance, leaves, publicHolidays, leaveTypes, range, todayStr]);

  // Headline for the period on screen, plus the same span expressed in the other calendar.
  const periodLabel =
    calendar === "BS"
      ? `${BS_MONTH_NAMES[bsPeriod.month - 1]} ${bsPeriod.year} BS`
      : new Date(`${selectedMonth}-01T00:00:00`).toLocaleDateString("en-US", {
          month: "long",
          year: "numeric",
        });

  const bsYearOptions = useMemo(() => {
    const current = adToBs(todayStr)?.year ?? BS_YEAR_BOUNDS.max;
    const years = new Set([bsPeriod.year]);
    for (let y = current - 10; y <= current + 1; y++) {
      if (y >= BS_YEAR_BOUNDS.min && y <= BS_YEAR_BOUNDS.max) years.add(y);
    }
    return [...years].sort((a, b) => b - a);
  }, [todayStr, bsPeriod.year]);

  const periodSubLabel = useMemo(() => {
    if (range.length === 0) return "";
    const first = range[0];
    const last = range[range.length - 1];
    if (calendar === "BS") {
      const fmt = (s) =>
        new Date(s + "T00:00:00").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        });
      return `${fmt(first)} – ${fmt(last)}`;
    }
    return `${bsMonthRange(first, last)} BS`;
  }, [range, calendar]);

  const summary = useMemo(() => {
    const counts = { present: 0, late: 0, absent: 0, leave: 0 };
    let totalHours = 0;
    sheet.forEach((d) => {
      if (d.status && counts[d.status] !== undefined) counts[d.status]++;
      if (d.hours != null) totalHours += d.hours;
    });
    return { ...counts, totalHours };
  }, [sheet]);

  const handleExportCsv = () => {
    const rows = [["Date", "Nepali Date", "Check In", "Check Out", "Hours", "Status"]];
    sheet.forEach((d) => {
      rows.push([
        d.dateStr,
        formatBsNumeric(d.dateStr),
        formatTime(d.record?.check_in_at),
        formatTime(d.record?.check_out_at),
        d.hours != null ? d.hours.toFixed(2) : "",
        STATUS_STYLES[d.status]?.label || "",
      ]);
    });
    const csv = rows
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const periodSlug =
      calendar === "BS" ? `BS${bsPeriod.year}-${pad(bsPeriod.month)}` : selectedMonth;
    a.download = `attendance-${selectedEmployee}-${periodSlug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const sheetSub = [selectedEmployee, periodLabel].filter(Boolean).join(" · ");

  return (
    <section className="attendance-section">
      {canPunchAttendance ? (
        <AttendancePunchWidget />
      ) : (
        <p className="attendance-note">
          Check-in and check-out happen from the mobile app — this view is read-only.
        </p>
      )}

      <section className="attendance-sheet glass-card" aria-labelledby="attendance-sheet-title">
        <div className="attendance-sheet-head">
          <div className="attendance-sheet-heading">
            <h2 id="attendance-sheet-title" className="section-title">
              Monthly sheet
            </h2>
            <span className="attendance-sheet-sub">
              {sheetSub}
              {periodSubLabel && (
                <>
                  {sheetSub && " · "}
                  <span className="mono">{periodSubLabel}</span>
                </>
              )}
            </span>
          </div>

          <label className="attendance-filter-label">
            Employee
            <select
              className="attendance-select"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
            >
              <option value="">Select employee…</option>
              {activeEmployees.map((e) => (
                <option key={e.id} value={e.name}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>

          <div className="status-tabs" role="group" aria-label="Calendar">
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

          {calendar === "AD" ? (
            <input
              type="month"
              aria-label="Month"
              className="attendance-select attendance-month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
            />
          ) : (
            <>
              <select
                aria-label="Nepali month"
                className="attendance-select"
                value={bsPeriod.month}
                onChange={(e) => setBsPeriod((p) => ({ ...p, month: Number(e.target.value) }))}
              >
                {BS_MONTH_NAMES.map((name, i) => (
                  <option key={name} value={i + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                aria-label="Nepali year"
                className="attendance-select attendance-month"
                value={bsPeriod.year}
                onChange={(e) => setBsPeriod((p) => ({ ...p, year: Number(e.target.value) }))}
              >
                {bsYearOptions.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </>
          )}

          <div className="attendance-sheet-actions">
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setExpanded(true)}
              disabled={!selectedEmployee}
              title="Open the full sheet"
            >
              Enlarge
            </button>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportCsv}
              disabled={!selectedEmployee}
            >
              <Icon name="download" size={15} strokeWidth={2} /> Export CSV
            </button>
          </div>
        </div>

        {!selectedEmployee ? (
          <p className="empty-msg">Select an employee to view their attendance sheet.</p>
        ) : (
          <>
            <div className="stats-grid attendance-stats">
              <StatsCard label="Present" value={summary.present} color={STAT_DOTS.present} />
              <StatsCard label="Late" value={summary.late} color={STAT_DOTS.late} />
              <StatsCard label="Absent" value={summary.absent} color={STAT_DOTS.absent} />
              <StatsCard label="Leave" value={summary.leave} color={STAT_DOTS.leave} />
              <StatsCard label="Hours worked" value={formatHours(summary.totalHours)} color={STAT_DOTS.hours} />
            </div>

            <AttendanceSheetTable
              sheet={sheet}
              isAdmin={isAdmin}
              calendar={calendar}
              onEdit={setEditingDay}
              onDelete={handleDeleteRecord}
            />
          </>
        )}
      </section>

      {isAdmin && (
        <div className="attendance-access-grid">
          <OfficeBoundPunchPanel
            employees={activeEmployees}
            setEmployeeOfficeBoundPunch={setEmployeeOfficeBoundPunch}
          />
          <WebPunchAccessPanel employees={activeEmployees} setEmployeePunchAccess={setEmployeePunchAccess} />
        </div>
      )}

      {isAdmin && (
        <OfficeSettingsPanel officeSettings={officeSettings} updateOfficeSettings={updateOfficeSettings} />
      )}

      <Modal isOpen={expanded} onClose={() => setExpanded(false)} size="modal-content-full">
        <div className="modal-header">
          <h2>
            {selectedEmployee} — {periodLabel}
          </h2>
          <button className="modal-close" onClick={() => setExpanded(false)} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>
        <p className="attendance-sheet-sub">
          <span className="mono">{periodSubLabel}</span> · {summary.present} present · {summary.late} late ·{" "}
          {summary.absent} absent · {summary.leave} leave · {formatHours(summary.totalHours)}
        </p>
        <AttendanceSheetTable
          sheet={sheet}
          isAdmin={isAdmin}
          calendar={calendar}
          onEdit={setEditingDay}
          onDelete={handleDeleteRecord}
          tall
        />
      </Modal>

      <EditAttendanceModal
        isOpen={!!editingDay}
        onClose={() => setEditingDay(null)}
        employeeName={selectedEmployee}
        day={editingDay}
      />
    </section>
  );
}

function AttendanceSheetTable({ sheet, isAdmin, calendar, onEdit, onDelete, tall }) {
  return (
    <div className={`attendance-table-scroll ${tall ? "scrollable-table-tall" : ""}`}>
      <table className="data-table attendance-table">
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Check In</th>
            <th scope="col">Check Out</th>
            <th scope="col" className="attendance-num">
              Hours
            </th>
            <th scope="col">Status</th>
            {isAdmin && (
              <th scope="col" className="attendance-num">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {sheet.length === 0 ? (
            <tr>
              <td colSpan={isAdmin ? 6 : 5} className="empty-row">
                No data for this month.
              </td>
            </tr>
          ) : (
            sheet.map((d) => {
              const primaryDate =
                calendar === "BS" ? `${formatWeekday(d.dateStr)}, ${formatBs(d.dateStr)}` : formatDate(d.dateStr);
              const altDate = calendar === "BS" ? formatMonthDay(d.dateStr) : formatBs(d.dateStr);
              const quiet = d.status === "weekend" || d.status === "holiday";
              return (
                <tr key={d.dateStr} className={d.isToday ? "attendance-row-today" : undefined}>
                  <td>
                    <span className="attendance-date" title={formatBsDevanagari(d.dateStr)}>
                      <span className={`attendance-date-main ${quiet ? "is-quiet" : ""}`}>
                        {primaryDate}
                        {d.isToday && <span className="pill pill-cyan">Today</span>}
                      </span>
                      <span className="attendance-date-alt">{altDate}</span>
                    </span>
                  </td>
                  <td className={`attendance-time ${d.status === "late" ? "is-late" : ""}`}>
                    {formatTime(d.record?.check_in_at)}
                  </td>
                  <td className="attendance-time">{formatTime(d.record?.check_out_at)}</td>
                  <td className="attendance-num attendance-hours">{formatHours(d.hours)}</td>
                  <td>
                    <span className="attendance-status">
                      <StatusPill status={d.status} />
                      {d.note && <span className="attendance-status-note">{d.note}</span>}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="attendance-num">
                      <span className="attendance-actions">
                        {d.record ? (
                          <>
                            <button
                              type="button"
                              className="btn-icon btn-sm attendance-icon-btn"
                              onClick={() => onEdit(d)}
                              aria-label={`Edit attendance for ${primaryDate}`}
                              title="Edit attendance"
                            >
                              <Icon name="edit" size={15} />
                            </button>
                            <button
                              type="button"
                              className="btn-icon btn-sm attendance-icon-btn attendance-icon-delete"
                              onClick={() => onDelete(d.record)}
                              aria-label={`Delete attendance for ${primaryDate}`}
                              title="Delete"
                            >
                              <Icon name="trash" size={15} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="btn-icon btn-sm attendance-icon-btn attendance-icon-add"
                            onClick={() => onEdit(d)}
                            aria-label={`Add attendance for ${primaryDate}`}
                            title="Add attendance"
                          >
                            <Icon name="plus" size={15} strokeWidth={2} />
                          </button>
                        )}
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
  );
}

// Checkbox chips for one web-punch category; a check icon marks the selected names.
function PunchAccessCard({ icon, tone, title, description, groupLabel, employees, isChecked, onToggle, pendingId }) {
  return (
    <section className="attendance-access glass-card">
      <div className="attendance-card-head">
        <span className={`attendance-card-icon pill-${tone}`}>
          <Icon name={icon} size={18} />
        </span>
        <h2 className="section-title">{title}</h2>
        <span className="pill pill-gray">Admin</span>
      </div>
      <p className="attendance-card-desc">{description}</p>
      {employees.length === 0 ? (
        <p className="empty-msg">No employees yet.</p>
      ) : (
        <div className="project-member-picker" role="group" aria-label={groupLabel}>
          {employees.map((emp) => {
            const checked = isChecked(emp);
            return (
              <label
                key={emp.id}
                className={`project-member-chip ${checked ? "active" : ""}`}
                style={pendingId === emp.id ? { opacity: 0.6, pointerEvents: "none" } : undefined}
              >
                <input type="checkbox" checked={checked} onChange={() => onToggle(emp)} />
                {checked && <Icon name="check" size={14} strokeWidth={2.4} />}
                <span>{emp.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </section>
  );
}

function WebPunchAccessPanel({ employees, setEmployeePunchAccess }) {
  const [pendingId, setPendingId] = useState(null);

  const handleToggle = async (emp) => {
    setPendingId(emp.id);
    try {
      await setEmployeePunchAccess(emp.id, !(emp.can_punch_web && !emp.web_punch_office_bound));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <PunchAccessCard
      icon="home"
      tone="violet"
      title="Freelance / WFH"
      description="For employees without a fixed office desk to geofence against — freelancers, remote/WFH staff, etc. Selected employees can punch in/out from this website (no location check), in addition to the mobile app."
      groupLabel="Freelance and WFH employees"
      employees={employees}
      isChecked={(emp) => emp.can_punch_web && !emp.web_punch_office_bound}
      onToggle={handleToggle}
      pendingId={pendingId}
    />
  );
}

function OfficeBoundPunchPanel({ employees, setEmployeeOfficeBoundPunch }) {
  const [pendingId, setPendingId] = useState(null);

  const handleToggle = async (emp) => {
    setPendingId(emp.id);
    try {
      await setEmployeeOfficeBoundPunch(emp.id, !(emp.can_punch_web && emp.web_punch_office_bound));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <PunchAccessCard
      icon="building"
      tone="blue"
      title="Office employees"
      description="Geofenced web punch. For on-site employees who want to punch from the tracker website instead of the mobile app. Unlike Freelance/WFH, these employees must be within the office radius (below) to punch in or out — same rule as the mobile app, checked via browser location."
      groupLabel="Office employees with web punch"
      employees={employees}
      isChecked={(emp) => emp.can_punch_web && emp.web_punch_office_bound}
      onToggle={handleToggle}
      pendingId={pendingId}
    />
  );
}

function OfficeSettingsPanel({ officeSettings, updateOfficeSettings }) {
  const [form, setForm] = useState({
    latitude: "",
    longitude: "",
    radius_meters: "",
    late_fine_amount: "",
    checkin_reminder_time: "",
    checkout_reminder_time: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (officeSettings) {
      setForm({
        latitude: String(officeSettings.latitude),
        longitude: String(officeSettings.longitude),
        radius_meters: String(officeSettings.radius_meters),
        late_fine_amount: String(officeSettings.late_fine_amount),
        checkin_reminder_time: officeSettings.checkin_reminder_time || "10:00",
        checkout_reminder_time: officeSettings.checkout_reminder_time || "18:30",
      });
    }
  }, [officeSettings]);

  const handleChange = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await updateOfficeSettings({
        latitude: Number(form.latitude),
        longitude: Number(form.longitude),
        radius_meters: Number(form.radius_meters),
        late_fine_amount: Number(form.late_fine_amount),
        checkin_reminder_time: form.checkin_reminder_time,
        checkout_reminder_time: form.checkout_reminder_time,
      });
      if (error) throw error;
    } finally {
      setSaving(false);
    }
  };

  const fields = [
    { key: "latitude", label: "Latitude", inputMode: "decimal" },
    { key: "longitude", label: "Longitude", inputMode: "decimal" },
    { key: "radius_meters", label: "Radius (meters)", inputMode: "numeric" },
    { key: "late_fine_amount", label: "Late fine amount (Rs.)", inputMode: "numeric" },
    { key: "checkin_reminder_time", label: "Missed check-in reminder time", type: "time" },
    { key: "checkout_reminder_time", label: "Missed check-out reminder time", type: "time" },
  ];
  const radius = Number(form.radius_meters);

  return (
    <section className="attendance-settings glass-card" aria-labelledby="office-settings-title">
      <div className="attendance-settings-main">
        <div className="attendance-card-head">
          <span className="attendance-card-icon pill-cyan">
            <Icon name="pin" size={18} />
          </span>
          <h2 id="office-settings-title" className="section-title">
            Office location &amp; rules
          </h2>
          <span className="pill pill-gray">Admin</span>
        </div>
        <p className="attendance-card-desc">
          Employees must be within this radius to check in or out from the mobile app or a geofenced web punch.
        </p>
        <div className="attendance-card-grid">
          {fields.map((f) => (
            <div key={f.key} className="attendance-field">
              <label htmlFor={`office-${f.key}`}>{f.label}</label>
              <input
                id={`office-${f.key}`}
                type={f.type || "text"}
                inputMode={f.inputMode}
                className="attendance-input"
                value={form[f.key]}
                onChange={handleChange(f.key)}
              />
            </div>
          ))}
        </div>
        <div className="attendance-settings-foot">
          <span className="attendance-settings-hint">
            <Icon name="mail" size={16} strokeWidth={2} />
            Employees who haven&apos;t checked in/out by these times (Asia/Kathmandu) get an email reminder.
          </span>
          <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <figure className="attendance-geofence-figure">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          fill="none"
          role="img"
          aria-label={Number.isFinite(radius) ? `Geofence: ${radius} m radius around the office` : "Geofence around the office"}
        >
          <circle className="attendance-fence-ring" cx="100" cy="100" r="88" strokeWidth="1.5" strokeDasharray="5 5" />
          <circle className="attendance-fence-inner" cx="100" cy="100" r="52" strokeWidth="1" />
          <path className="attendance-fence-ray" d="M100 100 L188 100" strokeWidth="1" strokeDasharray="2 3" />
          {Number.isFinite(radius) && (
            <text className="attendance-fence-label" x="144" y="94" textAnchor="middle">
              {radius} m
            </text>
          )}
          <circle className="attendance-fence-pin" cx="100" cy="100" r="7" strokeWidth="2" />
        </svg>
        <figcaption>Office pin and check-in radius</figcaption>
      </figure>
    </section>
  );
}
