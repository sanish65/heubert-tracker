"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";

export default function AddWordSeasonModal({ isOpen, onClose }) {
  const { addWordSeason } = useApp();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await addWordSeason(title.trim());
      setTitle("");
      onClose();
    } catch (err) {
      alert("Failed to add season.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📚 New Season</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group-interactive">
            <label>Season Title</label>
            <input
              type="text"
              placeholder="e.g. Word of the Day - Season 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create Season"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
