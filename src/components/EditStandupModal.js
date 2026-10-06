"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import { fineToday } from "@/lib/utils";

export default function EditStandupModal({ isOpen, onClose, record }) {
  const { updateStandupFine } = useApp();
  const { alertDialog } = useDialog();
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("late");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setDate(record.date || "");
      setStatus(record.status || "late");
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  // A standup fine records a standup that was already missed, so it can never be moved
  // to a day that has not happened yet.
  const today = fineToday();
  const isFutureDate = date > today;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isFutureDate) {
      await alertDialog("A standup fine can only be dated today or an earlier day.", { tone: 'error' });
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await updateStandupFine(record.id, {
        date,
        status
      });
      if (!error) onClose();
      else await alertDialog(error.message || "Failed to update record.", { tone: 'error' });
    } catch (err) {
      console.error("Update error:", err);
      await alertDialog("Error updating record.", { tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📝 Edit Standup Record</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group-interactive">
            <label>Employee</label>
            <input type="text" value={record.employee_name} disabled className="input-disabled" />
          </div>
          <div className="form-group-interactive">
            <label>Date</label>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="form-group-interactive">
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="unpaid">Contribution pending</option>
              <option value="paid">Contribution complete</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting || isFutureDate}>
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
