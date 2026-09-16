"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import { nepalLocalToUtcIso, isoToNepalTimeInput } from "@/lib/attendanceTime";
import { formatBs, formatBsDevanagari } from "@/lib/nepaliDate";
import Modal from "./Modal";

function formatLongDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function EditAttendanceModal({ isOpen, onClose, employeeName, day }) {
  const { upsertAttendanceRecord, deleteAttendanceRecord } = useApp();
  const { confirmDialog, alertDialog } = useDialog();
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const record = day?.record;

  useEffect(() => {
    setCheckInTime(isoToNepalTimeInput(record?.check_in_at));
    setCheckOutTime(isoToNepalTimeInput(record?.check_out_at));
  }, [record, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (checkOutTime && !checkInTime) {
      await alertDialog("Set a check-in time before a check-out time.", { tone: "error" });
      return;
    }
    if (checkInTime && checkOutTime && checkOutTime <= checkInTime) {
      await alertDialog("Check-out must be later than check-in.", { tone: "error" });
      return;
    }
    if (!checkInTime && !checkOutTime && !record) {
      onClose();
      return;
    }

    setSubmitting(true);
    try {
      await upsertAttendanceRecord(employeeName, day.dateStr, {
        check_in_at: nepalLocalToUtcIso(day.dateStr, checkInTime),
        check_out_at: nepalLocalToUtcIso(day.dateStr, checkOutTime),
      });
      onClose();
    } catch (err) {
      console.error("Save attendance error:", err);
      await alertDialog(err.message || "Error saving attendance.", { tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleClear = async () => {
    const confirmed = await confirmDialog(
      `Clear attendance for ${employeeName} on ${formatLongDate(day.dateStr)}? The day will count as absent.`,
      { danger: true }
    );
    if (!confirmed) return;

    setSubmitting(true);
    try {
      const { error } = await deleteAttendanceRecord(record.id);
      if (error) throw error;
      onClose();
    } catch (err) {
      console.error("Clear attendance error:", err);
      await alertDialog(err.message || "Error clearing attendance.", { tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen && !!day} onClose={onClose} size="modal-content-small">
      {day && (
        <>
          <div className="modal-header">
            <h2>📍 {record ? "Edit Attendance" : "Add Attendance"}</h2>
            <button className="modal-close" onClick={onClose}>
              ×
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="form-group-interactive">
              <label>Employee</label>
              <input type="text" value={employeeName} disabled className="input-disabled" />
            </div>
            <div className="form-group-interactive">
              <label>Date</label>
              <input type="text" value={formatLongDate(day.dateStr)} disabled className="input-disabled" />
              <span className="form-hint" title={formatBsDevanagari(day.dateStr)}>
                {formatBs(day.dateStr)} BS
              </span>
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
            <p className="form-hint">
              Times are Nepal time. Lateness is recalculated from the check-in time you set.
            </p>

            <div className="modal-actions">
              {record && (
                <button type="button" className="btn btn-danger" onClick={handleClear} disabled={submitting}>
                  Clear day
                </button>
              )}
              <button type="button" className="btn btn-ghost" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Saving…" : record ? "Save Changes" : "Add Record"}
              </button>
            </div>
          </form>
        </>
      )}
    </Modal>
  );
}
