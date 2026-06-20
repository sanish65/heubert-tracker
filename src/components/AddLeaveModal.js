"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { buildWorkingDates } from "@/lib/utils";

// Returns YYYY-MM-DD string from a local Date object
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Strictly local midnight date
function parseLocalDate(str) {
  if (!str) return new Date();
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}



export default function AddLeaveModal({ isOpen, onClose }) {
  const { addLeave, employees, currentEmployee, isAdmin, publicHolidays } = useApp();
  const today = toDateStr(new Date());

  const [form, setForm] = useState({
    name: "",
    startDate: today,
    type: "full",
    segment: "first", // "first" or "second"
    reason: "",
  });
  const [multiDay, setMultiDay] = useState(false);
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState("");

  // Build a Set of public holiday date strings for fast lookup
  const holidaySet = new Set((publicHolidays || []).map((h) => h.date?.split("T")[0]));

  // Auto-select current employee if not admin
  useEffect(() => {
    if (isOpen && currentEmployee && !form.name) {
      setForm((prev) => ({ ...prev, name: currentEmployee.name }));
    }
  }, [isOpen, currentEmployee, form.name]);

  // Reset to defaults when modal closes
  useEffect(() => {
    if (!isOpen) {
      setMultiDay(false);
      setEndDate("");
      setError("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
  };

  // Derived working dates for preview
  const effectiveEnd = multiDay && endDate ? endDate : form.startDate;
  const previewDates =
    form.startDate && effectiveEnd >= form.startDate
      ? buildWorkingDates(form.startDate, effectiveEnd, holidaySet)
      : form.startDate
      ? buildWorkingDates(form.startDate, form.startDate, holidaySet)
      : [];
  const workingDayCount =
    form.type === "half" ? previewDates.length * 0.5 : previewDates.length;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) { setError("Please select an employee"); return; }
    if (!form.startDate) { setError("Please select a start date"); return; }
    if (multiDay && endDate && endDate < form.startDate) {
      setError("End date cannot be before start date");
      return;
    }

    const finalEnd = multiDay && endDate ? endDate : form.startDate;
    const dates = buildWorkingDates(form.startDate, finalEnd, holidaySet);

    if (dates.length === 0) {
      setError("The selected range has no working days (all weekends or holidays).");
      return;
    }

    let finalReason = form.reason.trim();
    if (form.type === "half") {
      const segmentStr = form.segment === "first" ? "[First Half]" : "[Second Half]";
      finalReason = finalReason ? `${segmentStr} ${finalReason}` : segmentStr;
    }

    addLeave({
      name: form.name,
      startDate: form.startDate,
      endDate: finalEnd,
      dates,
      type: form.type,
      reason: finalReason,
      createdAt: new Date().toISOString(),
    });

    setForm({ name: "", startDate: today, type: "full", segment: "first", reason: "" });
    setMultiDay(false);
    setEndDate("");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Record Leave</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-sections-container">

            {/* 1. Employee & Type */}
            <div className="form-section">
              <div className="form-section-title">🏖️ Leave Baseline</div>
              <div className="form-grid-horizontal">
                <div className="form-group-interactive">
                  <label htmlFor="leave-employee">Target Employee</label>
                  <select
                    id="leave-employee"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    autoFocus
                    disabled={!isAdmin}
                  >
                    {!isAdmin && currentEmployee ? (
                      <option value={currentEmployee.name}>{currentEmployee.name}</option>
                    ) : (
                      <>
                        <option value="">Select employee</option>
                        {employees.map((emp) => (
                          <option key={emp.id} value={emp.name}>{emp.name}</option>
                        ))}
                      </>
                    )}
                  </select>
                </div>
                <div className="form-group-interactive">
                  <label>Leave Type</label>
                  <div className="leave-type-options">
                    {[
                      { value: "full", label: "Full Day", icon: "📅" },
                      { value: "half", label: "Half Day", icon: "🌗" },
                      { value: "early", label: "Early Leave", icon: "🚪" },
                    ].map((opt) => (
                      <label
                        key={opt.value}
                        className={`leave-type-chip ${form.type === opt.value ? "active" : ""}`}
                      >
                        <input
                          type="radio"
                          name="leaveType"
                          value={opt.value}
                          checked={form.type === opt.value}
                          onChange={handleChange("type")}
                        />
                        <span>{opt.icon} {opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {form.type === "half" && (
                  <div className="form-group-interactive">
                    <label>Half Day Segment</label>
                    <div className="leave-type-options">
                      {[
                        { value: "first", label: "First Half", icon: "🌅" },
                        { value: "second", label: "Second Half", icon: "🌇" },
                      ].map((opt) => (
                        <label
                          key={opt.value}
                          className={`leave-type-chip ${form.segment === opt.value ? "active" : ""}`}
                        >
                          <input
                            type="radio"
                            name="leaveSegment"
                            value={opt.value}
                            checked={form.segment === opt.value}
                            onChange={handleChange("segment")}
                          />
                          <span>{opt.icon} {opt.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Dates */}
            <div className="form-section">
              <div className="form-section-title">📅 Timeline</div>
              <div className="form-grid-horizontal">
                <div className="form-group-interactive">
                  <label htmlFor="leave-start">Leave Date</label>
                  <input
                    id="leave-start"
                    type="date"
                    value={form.startDate}
                    onChange={handleChange("startDate")}
                  />
                </div>

                {/* Multi-day toggle */}
                <div className="form-group-interactive">
                  <label>Multiple Days?</label>
                  <label className="leave-multiday-toggle">
                    <input
                      type="checkbox"
                      checked={multiDay}
                      onChange={(e) => {
                        setMultiDay(e.target.checked);
                        if (!e.target.checked) setEndDate("");
                      }}
                    />
                    <span className={`toggle-pill ${multiDay ? "active" : ""}`}>
                      {multiDay ? "Yes — set end date" : "No — single day"}
                    </span>
                  </label>
                </div>

                {multiDay && (
                  <div className="form-group-interactive">
                    <label htmlFor="leave-end">End Date</label>
                    <input
                      id="leave-end"
                      type="date"
                      value={endDate}
                      min={form.startDate}
                      onChange={(e) => { setEndDate(e.target.value); setError(""); }}
                    />
                  </div>
                )}

                {previewDates.length > 0 && (
                  <div className="form-group-interactive">
                    <label>Working Days</label>
                    <div className="leave-summary-badge" style={{ margin: 0, padding: "10px" }}>
                      {workingDayCount} {workingDayCount === 1 ? "working day" : "working days"}
                      {multiDay && endDate && (
                        <span className="leave-skip-note"> · weekends &amp; holidays skipped</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Details */}
            <div className="form-section">
              <div className="form-section-title">💬 Additional Information</div>
              <div className="form-group-interactive">
                <label htmlFor="leave-reason">Reason for Leave</label>
                <input
                  id="leave-reason"
                  type="text"
                  placeholder="e.g. Doctor appointment, personal work..."
                  value={form.reason}
                  onChange={handleChange("reason")}
                />
              </div>
            </div>
          </div>

          {error && <span className="form-error">{error}</span>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Record Leave</button>
          </div>
        </form>
      </div>
    </div>
  );
}
