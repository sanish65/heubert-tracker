"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";

export default function AddPublicHolidayModal({ isOpen, onClose }) {
  const { addPublicHoliday } = useApp();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !title) return;
    await addPublicHoliday(date, title);
    onClose();
    setDate("");
    setTitle("");
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🌴 Add Public Holiday</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="premium-form">
          <div className="form-group-interactive">
            <label>Date</label>
            <input 
              type="date" 
              value={date} 
              onChange={(e) => setDate(e.target.value)} 
              required 
            />
          </div>
          <div className="form-group-interactive">
            <label>Holiday Name</label>
            <input 
              type="text" 
              placeholder="e.g. Dashain"
              value={title} 
              onChange={(e) => setTitle(e.target.value)} 
              required 
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Holiday</button>
          </div>
        </form>
      </div>
    </div>
  );
}
