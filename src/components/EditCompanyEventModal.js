"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import Icon from "@/components/Icon";

export default function EditCompanyEventModal({ isOpen, onClose, event }) {
  const { updateCompanyEvent } = useApp();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && event) {
      setDate(event.date);
      setTitle(event.title);
      setError("");
    }
  }, [isOpen, event]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title || !date) {
      setError("Please fill all required fields");
      return;
    }
    setLoading(true);
    await updateCompanyEvent(event.id, date, title);
    setLoading(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon"><Icon name="flag" size={20} /></span>
          <h2>Edit event</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-section-title">Event details</div>
            <div className="form-grid-horizontal">
              <div className="form-group-interactive" style={{ flex: 2 }}>
                <label htmlFor="edit-event-title">Event Name</label>
                <input 
                  id="edit-event-title"
                  type="text" 
                  placeholder="e.g., Company Retreat" 
                  required 
                  value={title} 
                  onChange={e => { setTitle(e.target.value); setError(""); }} 
                  autoFocus
                />
              </div>
              <div className="form-group-interactive">
                <label htmlFor="edit-event-date">Date</label>
                <input 
                  id="edit-event-date"
                  type="date" 
                  required 
                  value={date} 
                  onChange={e => { setDate(e.target.value); setError(""); }} 
                />
              </div>
            </div>
          </div>
          {error && <div className="form-error" role="alert"><Icon name="alert" size={16} />{error}</div>}
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
