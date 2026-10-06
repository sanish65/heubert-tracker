"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { findExistingPublicHoliday, expandDateRange } from "@/lib/utils";

export default function AddPublicHolidayModal({ isOpen, onClose }) {
  const { addPublicHoliday, publicHolidays } = useApp();
  const [date, setDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [title, setTitle] = useState("");
  const [error, setError] = useState("");

  // Blank end date means a one-day holiday, so the common case stays a single field.
  const days = expandDateRange(date, endDate);
  const backwards = Boolean(date && endDate && endDate < date);
  // Flag clashes as soon as the dates are picked, rather than waiting for submit.
  const clashes = days.map((day) => findExistingPublicHoliday(publicHolidays, day)).filter(Boolean);

  const reset = () => {
    setDate("");
    setEndDate("");
    setTitle("");
    setError("");
  };

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!date || !title || backwards || clashes.length) return;

    const { error: submitError } = await addPublicHoliday(date, title, endDate || undefined);
    if (submitError) {
      setError(submitError.message || "Failed to add the holiday. Please try again.");
      return;
    }

    onClose();
    reset();
  };

  const handleClose = () => {
    onClose();
    setError("");
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>🌴 Add Public Holiday</h2>
          <button className="close-btn" onClick={handleClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit} className="premium-form">
          <div className="form-row">
            <div className="form-group-interactive">
              <label>Start Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => { setDate(e.target.value); setError(""); }}
                required
              />
            </div>
            <div className="form-group-interactive">
              <label>End Date <span className="label-hint">optional</span></label>
              <input
                type="date"
                value={endDate}
                min={date || undefined}
                onChange={(e) => { setEndDate(e.target.value); setError(""); }}
              />
            </div>
          </div>
          <div className="form-group-interactive">
            <label>Holiday Name</label>
            <input
              type="text"
              placeholder="e.g. Dashain"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setError(""); }}
              required
            />
          </div>

          {days.length > 1 && !clashes.length && (
            <span className="form-hint">
              {days.length} days — {days[0]} to {days[days.length - 1]}.
            </span>
          )}
          {backwards && (
            <span className="form-error">The end date must be on or after the start date.</span>
          )}
          {!backwards && clashes.length > 0 && (
            <span className="form-error">
              {clashes.length === 1
                ? `${clashes[0].title} is already the holiday on ${String(clashes[0].date).split("T")[0]}.`
                : `${clashes.length} of those days already have a holiday (${String(clashes[0].date).split("T")[0]} onwards).`}
              {" "}Delete them first to replace them.
            </span>
          )}
          {error && !clashes.length && !backwards && <span className="form-error">{error}</span>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={handleClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={backwards || clashes.length > 0}
            >
              {days.length > 1 ? `Add ${days.length}-Day Holiday` : "Add Holiday"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
