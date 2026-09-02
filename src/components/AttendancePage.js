"use client";

import { useState, useMemo, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import StatsCard from "./StatsCard";
import AttendancePunchWidget from "./AttendancePunchWidget";
import EditAttendanceModal from "./EditAttendanceModal";

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

const STATUS_STYLES = {
  present: { bg: "var(--accent-green-soft)", color: "var(--accent-green)", label: "Present" },
  late: { bg: "var(--accent-amber-soft)", color: "var(--accent-amber)", label: "Late" },
  absent: { bg: "var(--accent-red-soft)", color: "var(--accent-red)", label: "Absent" },
  leave: { bg: "var(--accent-indigo-soft)", color: "var(--accent-indigo)", label: "Leave" },
  holiday: { bg: "var(--accent-orange-soft)", color: "var(--accent-orange)", label: "Holiday" },
  weekend: { bg: "rgba(148, 163, 184, 0.15)", color: "#94a3b8", label: "Weekend" },
  pending: { bg: "rgba(148, 163, 184, 0.15)", color: "var(--text-muted)", label: "Pending" },
  upcoming: { bg: "rgba(148, 163, 184, 0.1)", color: "var(--text-muted)", label: "Upcoming" },
};

function formatHours(hours) {
  if (hours == null) return "—";
  return `${hours.toFixed(1)}h`;
}

function StatusPill({ status }) {
  const s = STATUS_STYLES[status];
  if (!s) return null;
  return (
    <span className="status-badge" style={{ background: s.bg, color: s.color, cursor: "default" }}>
      {s.label}
    </span>
  );
}

export default function AttendancePage() {
  const {
    employees,
    attendance,
    leaves,
    publicHolidays,
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
  const [editingRecord, setEditingRecord] = useState(null);

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

  const sheet = useMemo(() => {
    if (!selectedEmployee) return [];

    const holidaySet = new Set(publicHolidays.map((h) => h.date));
    const [year, month] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const empLeaves = leaves.filter((l) => l.employee_name === selectedEmployee);
    const empAttendance = new Map(
      attendance.filter((a) => a.employee_name === selectedEmployee).map((a) => [a.date, a])
    );

    const days = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${selectedMonth}-${pad(d)}`;
      const dow = new Date(year, month - 1, d).getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidaySet.has(dateStr);
      const onLeave = empLeaves.some((l) => dateStr >= l.start_date && dateStr <= l.end_date);
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

      days.push({ dateStr, record, status, hours });
    }
    return days;
  }, [selectedEmployee, attendance, leaves, publicHolidays, selectedMonth, todayStr]);

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
    const rows = [["Date", "Check In", "Check Out", "Hours", "Status"]];
    sheet.forEach((d) => {
      rows.push([
        d.dateStr,
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
    a.download = `attendance-${selectedEmployee}-${selectedMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="attendance-section">
      <div className="fine-header">
        <div>
          <h3 className="section-title">📍 Attendance</h3>
          <span className="fine-count">
            {canPunchAttendance
              ? "Punch in/out below, or check-in and check-out from the mobile app."
              : "Check-in and check-out happen from the mobile app — this view is read-only."}
          </span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleExportCsv} disabled={!selectedEmployee}>
          ⬇ Export CSV
        </button>
      </div>

      {canPunchAttendance && <AttendancePunchWidget />}

      <div className="attendance-filters">
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
        <input
          type="month"
          className="attendance-select"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        />
      </div>

      {!selectedEmployee ? (
        <p className="empty-msg">Select an employee to view their attendance sheet.</p>
      ) : (
        <>
          <div className="stats-grid">
            <StatsCard icon="✅" label="Present" value={summary.present} color="var(--accent-green)" />
            <StatsCard icon="⏰" label="Late" value={summary.late} color="var(--accent-amber)" />
            <StatsCard icon="🚫" label="Absent" value={summary.absent} color="var(--accent-red)" />
            <StatsCard icon="🏖️" label="Leave" value={summary.leave} color="var(--accent-indigo)" />
            <StatsCard icon="🕒" label="Hours Worked" value={formatHours(summary.totalHours)} color="var(--accent-indigo)" />
          </div>

          <div className="table-wrapper scrollable-table">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Hours</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
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
                  sheet.map((d) => (
                    <tr key={d.dateStr}>
                      <td className="date-cell">{formatDate(d.dateStr)}</td>
                      <td>{formatTime(d.record?.check_in_at)}</td>
                      <td>{formatTime(d.record?.check_out_at)}</td>
                      <td>{formatHours(d.hours)}</td>
                      <td>
                        <StatusPill status={d.status} />
                      </td>
                      {isAdmin && (
                        <td>
                          {d.record && (
                            <div className="action-btns">
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => setEditingRecord(d.record)}
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteRecord(d.record)}
                                title="Delete"
                              >
                                🗑
                              </button>
                            </div>
                          )}
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isAdmin && (
        <WebPunchAccessPanel employees={activeEmployees} setEmployeePunchAccess={setEmployeePunchAccess} />
      )}

      {isAdmin && (
        <OfficeBoundPunchPanel employees={activeEmployees} setEmployeeOfficeBoundPunch={setEmployeeOfficeBoundPunch} />
      )}

      {isAdmin && (
        <OfficeSettingsPanel officeSettings={officeSettings} updateOfficeSettings={updateOfficeSettings} />
      )}

      <EditAttendanceModal
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        record={editingRecord}
      />
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
    <div className="attendance-card">
      <h3 className="section-title">🏠 Freelance / WFH Employees</h3>
      <span className="fine-count">
        For employees without a fixed office desk to geofence against — freelancers, remote/WFH staff, etc.
        Selected employees can punch in/out from this website (no location check), in addition to the mobile app.
      </span>
      {employees.length === 0 ? (
        <p className="empty-msg">No employees yet.</p>
      ) : (
        <div className="project-member-picker">
          {employees.map((emp) => {
            const checked = emp.can_punch_web && !emp.web_punch_office_bound;
            return (
              <label
                key={emp.id}
                className={`project-member-chip ${checked ? "active" : ""}`}
                style={pendingId === emp.id ? { opacity: 0.6, pointerEvents: "none" } : undefined}
              >
                <input type="checkbox" checked={checked} onChange={() => handleToggle(emp)} />
                <span>{emp.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
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
    <div className="attendance-card">
      <h3 className="section-title">🏢 Office Employees (Geofenced Web Punch)</h3>
      <span className="fine-count">
        For on-site employees who want to punch from the tracker website instead of the mobile app. Unlike
        Freelance/WFH, these employees must be within the office radius (below) to punch in or out — same rule
        as the mobile app, checked via browser location.
      </span>
      {employees.length === 0 ? (
        <p className="empty-msg">No employees yet.</p>
      ) : (
        <div className="project-member-picker">
          {employees.map((emp) => {
            const checked = emp.can_punch_web && emp.web_punch_office_bound;
            return (
              <label
                key={emp.id}
                className={`project-member-chip ${checked ? "active" : ""}`}
                style={pendingId === emp.id ? { opacity: 0.6, pointerEvents: "none" } : undefined}
              >
                <input type="checkbox" checked={checked} onChange={() => handleToggle(emp)} />
                <span>{emp.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
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

  return (
    <div className="attendance-card">
      <h3 className="section-title">📍 Office Location</h3>
      <span className="fine-count">Employees must be within this radius to check in or out from the mobile app.</span>
      <div className="attendance-card-grid">
        <div className="attendance-field">
          <label>Latitude</label>
          <input className="attendance-input" value={form.latitude} onChange={handleChange("latitude")} />
        </div>
        <div className="attendance-field">
          <label>Longitude</label>
          <input className="attendance-input" value={form.longitude} onChange={handleChange("longitude")} />
        </div>
        <div className="attendance-field">
          <label>Radius (meters)</label>
          <input className="attendance-input" value={form.radius_meters} onChange={handleChange("radius_meters")} />
        </div>
        <div className="attendance-field">
          <label>Late fine amount (Rs.)</label>
          <input className="attendance-input" value={form.late_fine_amount} onChange={handleChange("late_fine_amount")} />
        </div>
        <div className="attendance-field">
          <label>Missed check-in reminder time</label>
          <input
            type="time"
            className="attendance-input"
            value={form.checkin_reminder_time}
            onChange={handleChange("checkin_reminder_time")}
          />
        </div>
        <div className="attendance-field">
          <label>Missed check-out reminder time</label>
          <input
            type="time"
            className="attendance-input"
            value={form.checkout_reminder_time}
            onChange={handleChange("checkout_reminder_time")}
          />
        </div>
      </div>
      <span className="fine-count">
        Employees who haven't checked in/out by these times (Asia/Kathmandu) get an email reminder.
      </span>
      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
