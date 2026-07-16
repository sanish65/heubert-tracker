"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";

export default function EditLeaveSeasonModal({ isOpen, onClose, season }) {
  const { updateLeaveSeason, deleteLeaveSeason } = useApp();
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
      await updateLeaveSeason(season.id, title.trim());
      onClose();
    } catch (err) {
      alert("Failed to update season.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${season.title}"? Leave records already in this season are kept (they just become unassigned) — nothing is deleted from history.`)) return;
    setSubmitting(true);
    try {
      await deleteLeaveSeason(season.id);
      onClose();
    } catch (err) {
      alert("Failed to delete season.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>✏️ Edit Leave Season</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group-interactive">
            <label>Season Title</label>
            <input
              type="text"
              placeholder="e.g. Fiscal Year 2026"
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
