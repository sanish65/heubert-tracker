"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useSubmitOnce } from "@/lib/useSubmitOnce";
import { findExistingPublicHoliday, expandDateRange } from "@/lib/utils";
import Icon from "@/components/Icon";

export default function AddPublicHolidayModal({ isOpen, onClose }) {
  const [saving, submitOnce] = useSubmitOnce();
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

  const handleSubmit = (e) => {
    e.preventDefault();
    return submitOnce(async () => {
      if (!date || !title || backwards || clashes.length) return;

      const { error: submitError } = await addPublicHoliday(date, title, endDate || undefined);
      if (submitError) {
        setError(submitError.message || "Failed to add the holiday. Please try again.");
        return;
      }

      onClose();
      reset();
    });
  };

  const handleClose = () => {
    onClose();
    setError("");
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon"><Icon name="flag" size={20} /></span>
          <h2>Add public holiday</h2>
          <button className="modal-close" onClick={handleClose} aria-label="Close"><Icon name="x" size={18} /></button>
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
            <div className="form-error" role="alert"><Icon name="alert" size={16} />The end date must be on or after the start date.</div>
          )}
          {!backwards && clashes.length > 0 && (
            <div className="form-error" role="alert">
              <Icon name="alert" size={16} />
              <span>
                {clashes.length === 1
                  ? `${clashes[0].title} is already the holiday on ${String(clashes[0].date).split("T")[0]}.`
                  : `${clashes.length} of those days already have a holiday (${String(clashes[0].date).split("T")[0]} onwards).`}
                {" "}Delete them first to replace them.
              </span>
            </div>
          )}
          {error && !clashes.length && !backwards && <div className="form-error" role="alert"><Icon name="alert" size={16} />{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={handleClose}>Cancel</button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || backwards || clashes.length > 0}
            >
              {saving ? "Saving…" : days.length > 1 ? `Add ${days.length}-Day Holiday` : "Add Holiday"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
