"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";

export default function AddLeaveModal({ isOpen, onClose }) {
  const { addLeave, employees, currentEmployee, isAdmin } = useApp();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    name: "",
    startDate: today,
    endDate: today,
    type: "full", // "full" | "half" | "early"
    reason: "",
  });
  const [error, setError] = useState("");

  // Auto-select current employee if available
  useEffect(() => {
    if (isOpen && currentEmployee && !form.name) {
      setForm(prev => ({ ...prev, name: currentEmployee.name }));
    }
  }, [isOpen, currentEmployee, form.name]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) {
      setError("Please select an employee");
      return;
    }
    if (!form.startDate) {
      setError("Please select a start date");
      return;
    }
    if (!form.endDate) {
      setError("Please select an end date");
      return;
    }
    if (form.endDate < form.startDate) {
      setError("End date cannot be before start date");
      return;
    }

    // Generate dates array between start and end (inclusive)
    const dates = [];
    let current = new Date(form.startDate + "T00:00:00");
    const end = new Date(form.endDate + "T00:00:00");
    
    while (current <= end) {
      // Manually build YYYY-MM-DD to avoid UTC shift from toISOString()
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      dates.push(`${y}-${m}-${d}`);
      current.setDate(current.getDate() + 1);
    }

    addLeave({
      name: form.name,
      startDate: form.startDate,
      endDate: form.endDate,
      dates,
      type: form.type,
      reason: form.reason.trim(),
      createdAt: new Date().toISOString(),
    });

    setForm({
      name: "",
      startDate: today,
      endDate: today,
      type: "full",
      reason: "",
    });
    onClose();
  };

  const dayCount = (() => {
    if (!form.startDate || !form.endDate || form.endDate < form.startDate) return 0;
    const s = new Date(form.startDate + "T00:00:00");
    const e = new Date(form.endDate + "T00:00:00");
    const diff = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
    if (form.type === "half") return diff * 0.5;
    return diff;
  })();

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
                          <option key={emp.id} value={emp.name}>
                            {emp.name}
                          </option>
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
              </div>
            </div>

            {/* 2. Dates */}
            <div className="form-section">
              <div className="form-section-title">📅 Timeline</div>
              <div className="form-grid-horizontal">
                <div className="form-group-interactive">
                  <label htmlFor="leave-start">Start Date</label>
                  <input
                    id="leave-start"
                    type="date"
                    value={form.startDate}
                    onChange={handleChange("startDate")}
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="leave-end">End Date</label>
                  <input
                    id="leave-end"
                    type="date"
                    value={form.endDate}
                    onChange={handleChange("endDate")}
                  />
                </div>
                {dayCount > 0 && (
                  <div className="form-group-interactive">
                    <label>Duration Summary</label>
                    <div className="leave-summary-badge" style={{ margin: 0, padding: '10px' }}>
                       {dayCount} {dayCount === 1 ? "day" : "days"} leave
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
