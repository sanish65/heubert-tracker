"use client";

import { useState, useMemo, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import StatsCard from "./StatsCard";

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
  } = useApp();

  const [selectedEmployee, setSelectedEmployee] = useState(currentEmployee?.name || "");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

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
          <span className="fine-count">Check-in and check-out happen from the mobile app — this view is read-only.</span>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={handleExportCsv} disabled={!selectedEmployee}>
          ⬇ Export CSV
        </button>
      </div>

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
                </tr>
              </thead>
              <tbody>
                {sheet.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="empty-row">
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
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {isAdmin && (
        <OfficeSettingsPanel officeSettings={officeSettings} updateOfficeSettings={updateOfficeSettings} />
      )}
    </section>
  );
}

function OfficeSettingsPanel({ officeSettings, updateOfficeSettings }) {
  const [form, setForm] = useState({ latitude: "", longitude: "", radius_meters: "", late_fine_amount: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (officeSettings) {
      setForm({
        latitude: String(officeSettings.latitude),
        longitude: String(officeSettings.longitude),
        radius_meters: String(officeSettings.radius_meters),
        late_fine_amount: String(officeSettings.late_fine_amount),
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
      </div>
      <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
