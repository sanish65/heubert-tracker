"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import Modal from "@/components/Modal";

export default function AddFineSeasonModal({ isOpen, onClose }) {
  // <Modal> stays mounted so it can animate the close, so the form lives in its
  // own component — it unmounts with the modal and its state resets, same as the
  // old `if (!isOpen) return null` behaviour.
  return (
    <Modal isOpen={isOpen} onClose={onClose} size="modal-content-small">
      <AddFineSeasonForm onClose={onClose} />
    </Modal>
  );
}

function AddFineSeasonForm({ onClose }) {
  const { addFineSeason } = useApp();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return;

    setSubmitting(true);
    try {
      await addFineSeason(title.trim());
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
        <h2>💰 New Fine Season</h2>
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
