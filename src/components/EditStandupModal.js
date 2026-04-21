"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";

export default function EditStandupModal({ isOpen, onClose, record }) {
  const { updateStandupFine } = useApp();
  const [status, setStatus] = useState("late");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setStatus(record.status || "late");
    }
  }, [record, isOpen]);

  if (!isOpen || !record) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await updateStandupFine(record.id, {
        status
      });
      if (!error) onClose();
      else alert("Failed to update record.");
    } catch (err) {
      console.error("Update error:", err);
      alert("Error updating record.");
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
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="unpaid">Contribution pending</option>
              <option value="paid">Contribution complete</option>
            </select>
          </div>

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
