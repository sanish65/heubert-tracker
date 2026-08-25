"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import Modal from "@/components/Modal";

export default function AddLeaveSeasonModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="modal-content-small">
      <AddLeaveSeasonForm onClose={onClose} />
    </Modal>
  );
}

function AddLeaveSeasonForm({ onClose }) {
  const { addLeaveSeason } = useApp();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await addLeaveSeason(title.trim());
      setTitle("");
      onClose();
    } catch (err) {
      alert("Failed to add season.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="modal-header">
        <h2>🏖️ New Leave Season</h2>
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
        <p className="empty-msg" style={{ margin: "8px 0 0", textAlign: "left" }}>
          Every employee&apos;s leave balances reset to their full annual quota under a new season.
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? "Creating..." : "Create Season"}
          </button>
        </div>
      </form>
    </>
  );
}
