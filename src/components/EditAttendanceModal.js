"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import { nepalLocalToUtcIso, isoToNepalTimeInput } from "@/lib/attendanceTime";

export default function EditAttendanceModal({ isOpen, onClose, record }) {
  const { updateAttendanceRecord } = useApp();
  const { alertDialog } = useDialog();
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setCheckInTime(isoToNepalTimeInput(record.check_in_at));
      setCheckOutTime(isoToNepalTimeInput(record.check_out_at));
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await updateAttendanceRecord(record.id, {
        check_in_at: nepalLocalToUtcIso(record.date, checkInTime),
        check_out_at: nepalLocalToUtcIso(record.date, checkOutTime),
      });
      onClose();
    } catch (err) {
      console.error("Update error:", err);
      await alertDialog(err.message || "Error updating attendance.", { tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📍 Edit Attendance</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group-interactive">
            <label>Employee</label>
            <input type="text" value={record.employee_name} disabled className="input-disabled" />
          </div>
          <div className="form-group-interactive">
            <label>Date</label>
            <input type="text" value={record.date} disabled className="input-disabled" />
          </div>
          <div className="form-row">
            <div className="form-group-interactive">
              <label>Check-in time</label>
              <input type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
            </div>
            <div className="form-group-interactive">
              <label>Check-out time</label>
              <input type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
