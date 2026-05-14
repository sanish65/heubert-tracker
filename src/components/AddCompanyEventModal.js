"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";

export default function AddCompanyEventModal({ isOpen, onClose }) {
  const { addCompanyEvent } = useApp();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !date) {
      setError("Please fill all required fields");
      return;
    }
    setLoading(true);
    await addCompanyEvent(date, title);
    setLoading(false);
    onClose();
    setDate("");
    setTitle("");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📅 Record an Event</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-section-title">✨ Event Details</div>
            <div className="form-grid-horizontal">
              <div className="form-group-interactive" style={{ flex: 2 }}>
                <label htmlFor="event-title">Event Name</label>
                <input 
                  id="event-title"
                  type="text" 
                  placeholder="e.g., Company Retreat" 
                  required 
                  value={title} 
                  onChange={e => { setTitle(e.target.value); setError(""); }} 
                  autoFocus
                />
              </div>
              <div className="form-group-interactive">
                <label htmlFor="event-date">Date</label>
                <input 
                  id="event-date"
                  type="date" 
                  required 
                  value={date} 
                  onChange={e => { setDate(e.target.value); setError(""); }} 
                />
              </div>
            </div>
          </div>
          {error && <span className="form-error">{error}</span>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Adding..." : "Add Event"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
