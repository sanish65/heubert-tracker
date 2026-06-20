"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { buildWorkingDates } from "@/lib/utils";

const LEAVE_TYPE_OPTIONS = [
  { value: "full", label: "Full Day", icon: "📅" },
  { value: "half", label: "Half Day", icon: "🌗" },
  { value: "early", label: "Early Leave", icon: "🚪" },
];

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseLocalDate(str) {
  if (!str) return new Date();
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}


export default function EditLeaveModal({ isOpen, onClose, leave }) {
  const { updateLeave, publicHolidays } = useApp();
  const [form, setForm] = useState({
    startDate: "",
    endDate: "",
    type: "full",
    segment: "first",
    reason: "",
  });
  const [multiDay, setMultiDay] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const holidaySet = new Set((publicHolidays || []).map((h) => h.date?.split("T")[0]));

  useEffect(() => {
    if (leave && isOpen) {
      const isMulti = leave.start_date !== leave.end_date;
      let initReason = leave.reason || "";
      let initSegment = "first";

      if (leave.type === "half") {
        if (initReason.startsWith("[First Half]")) {
          initSegment = "first";
          initReason = initReason.replace("[First Half]", "").trim();
        } else if (initReason.startsWith("[Second Half]")) {
          initSegment = "second";
          initReason = initReason.replace("[Second Half]", "").trim();
        }
      }

      setForm({
        startDate: leave.start_date || "",
        endDate: leave.end_date || "",
        type: leave.type || "full",
        segment: initSegment,
        reason: initReason,
      });
      setMultiDay(isMulti);
      setError("");
    }
  }, [leave, isOpen]);

  if (!isOpen || !leave) return null;

  const effectiveEnd = multiDay ? form.endDate : form.startDate;
  const previewDates =
    form.startDate && effectiveEnd >= form.startDate
      ? buildWorkingDates(form.startDate, effectiveEnd || form.startDate, holidaySet)
      : form.startDate
      ? buildWorkingDates(form.startDate, form.startDate, holidaySet)
      : [];
  const workingDayCount = form.type === "half" ? previewDates.length * 0.5 : previewDates.length;

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.startDate) { setError("Please select a start date"); return; }
    if (multiDay && form.endDate && form.endDate < form.startDate) {
      setError("End date cannot be before start date");
      return;
    }

    const finalEnd = multiDay && form.endDate ? form.endDate : form.startDate;
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

    setSubmitting(true);
    try {
      const { error } = await updateLeave(leave.id, {
        start_date: form.startDate,
        end_date: finalEnd,
        type: form.type,
        reason: finalReason,
        dates,
      });
      if (!error) onClose();
      else setError("Failed to update leave record.");
    } catch (err) {
      console.error("Update error:", err);
      setError("Error updating leave.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🏖️ Edit Leave Record</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-sections-container">
            {/* Employee — read-only */}
            <div className="form-section">
              <div className="form-section-title">👤 Employee</div>
              <div className="form-group-interactive">
                <label>Employee</label>
                <input type="text" value={leave.employee_name} disabled className="input-disabled" />
              </div>
            </div>

            {/* Type */}
            <div className="form-section">
              <div className="form-section-title">🏖️ Leave Type</div>
              <div className="form-group-interactive">
                <div className="leave-type-options">
                  {LEAVE_TYPE_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`leave-type-chip ${form.type === opt.value ? "active" : ""}`}
                    >
                      <input
                        type="radio"
                        name="editLeaveType"
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
                <div className="form-group-interactive" style={{ marginTop: "1rem" }}>
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
                          name="editLeaveSegment"
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

            {/* Dates */}
            <div className="form-section">
              <div className="form-section-title">📅 Timeline</div>
              <div className="form-grid-horizontal">
                <div className="form-group-interactive">
                  <label htmlFor="edit-leave-start">Leave Date</label>
                  <input
                    id="edit-leave-start"
                    type="date"
                    value={form.startDate}
                    onChange={handleChange("startDate")}
                  />
                </div>

                <div className="form-group-interactive">
                  <label>Multiple Days?</label>
                  <label className="leave-multiday-toggle">
                    <input
                      type="checkbox"
                      checked={multiDay}
                      onChange={(e) => {
                        setMultiDay(e.target.checked);
                        if (!e.target.checked) setForm((p) => ({ ...p, endDate: p.startDate }));
                      }}
                    />
                    <span className={`toggle-pill ${multiDay ? "active" : ""}`}>
                      {multiDay ? "Yes — set end date" : "No — single day"}
                    </span>
                  </label>
                </div>

                {multiDay && (
                  <div className="form-group-interactive">
                    <label htmlFor="edit-leave-end">End Date</label>
                    <input
                      id="edit-leave-end"
                      type="date"
                      value={form.endDate}
                      min={form.startDate}
                      onChange={handleChange("endDate")}
                    />
                  </div>
                )}

                {previewDates.length > 0 && (
                  <div className="form-group-interactive">
                    <label>Working Days</label>
                    <div className="leave-summary-badge" style={{ margin: 0, padding: "10px" }}>
                      {workingDayCount} {workingDayCount === 1 ? "working day" : "working days"}
                      {multiDay && (
                        <span className="leave-skip-note"> · weekends &amp; holidays skipped</span>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Reason */}
            <div className="form-section">
              <div className="form-section-title">💬 Additional Information</div>
              <div className="form-group-interactive">
                <label htmlFor="edit-leave-reason">Reason for Leave</label>
                <input
                  id="edit-leave-reason"
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
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
