"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";

export default function EditFineSeasonModal({ isOpen, onClose, season }) {
  const { updateFineSeason, deleteFineSeason } = useApp();
  const { confirmDialog, alertDialog } = useDialog();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (season) {
      setTitle(season.title || "");
    }
  }, [season]);

  if (!isOpen || !season) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await updateFineSeason(season.id, title.trim());
      onClose();
    } catch (err) {
      await alertDialog("Failed to update season.", { tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!(await confirmDialog(`Delete "${season.title}"? Fines already recorded in this season are kept (they just become unassigned) — nothing is deleted from your totals.`, { danger: true }))) return;
    setSubmitting(true);
    try {
      await deleteFineSeason(season.id);
      onClose();
    } catch (err) {
      await alertDialog("Failed to delete season.", { tone: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ Edit Fine Season</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group-interactive">
            <label>Season Title</label>
            <input
              type="text"
              placeholder="e.g. Late Fines - Season 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="modal-actions" style={{ justifyContent: "space-between" }}>
            <button type="button" className="btn btn-danger" onClick={handleDelete} disabled={submitting}>
              Delete Season
            </button>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? "Saving..." : "Save Season"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
