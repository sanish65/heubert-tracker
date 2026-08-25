"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { findExistingLateFine } from "@/lib/utils";

export default function AddFineModal({ isOpen, onClose }) {
  const { addFine, employees, currentEmployee, fines, fineSeasons } = useApp();
  const selectableEmployees = employees.filter(emp => emp.status !== "resigned" && emp.name !== "Developers");
  const today = new Date().toISOString().split("T")[0];

  // A new fine always belongs to the season that is current NOW — never an earlier season
  // and never a null season, whichever season the page happens to be browsing. Anything else
  // drops the record out of the season-scoped views while it still shows up in totals.
  // null only remains possible when no season exists at all.
  const currentSeasonId = (fineSeasons || []).length
    ? [...fineSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0].id
    : null;
  const [form, setForm] = useState({
    name: "",
    date: today,
    amount: 25,
    status: "unpaid",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && currentEmployee && !form.name) {
      setForm(prev => ({ ...prev, name: currentEmployee.name }));
    }
  }, [isOpen, currentEmployee, form.name]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
  };

  // A late fine is one per person per day, whatever the amount — surfaced live so the
  // block is visible before the user tries to submit.
  const existingFine = findExistingLateFine(fines, form.name, form.date);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name) { setError("Please select an employee"); return; }
    if (!form.amount) { setError("Please fill all required fields"); return; }

    const { error: submitError } = await addFine({
      ...form,
      amount: Number(form.amount),
      seasonId: currentSeasonId,
      createdAt: new Date().toISOString(),
    });

    if (submitError) {
      setError(submitError.message || "Failed to save the fine. Please try again.");
      return;
    }

    setForm({ name: "", date: today, amount: 25, status: "unpaid" });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Record a Fine</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-section-title">💸 Fine Details</div>
            <div className="form-grid-horizontal">
              <div className="form-group-interactive">
                <label htmlFor="fine-employee">Employee</label>
                <select
                  id="fine-employee"
                  value={form.name}
                  onChange={handleChange("name")}
                  autoFocus
                >
                  <option value="">Select employee</option>
                  {selectableEmployees.map((emp) => (
                    <option key={emp.id} value={emp.name}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group-interactive">
                <label htmlFor="fine-date">Date</label>
                <input
                  id="fine-date"
                  type="date"
                  value={form.date}
                  onChange={handleChange("date")}
                />
              </div>
              <div className="form-group-interactive">
                <label>Amount (Rs.)</label>
                <div className="amount-preset-options">
                  {[25, 50].map(val => (
                    <label key={val} className={`amount-chip ${form.amount == val ? 'active' : ''}`}>
                      <input
                        type="radio"
                        name="fineAmount"
                        value={val}
                        checked={form.amount == val}
                        onChange={() => { setForm(prev => ({ ...prev, amount: val })); setDuplicateWarning(false); }}
                      />
                      <span>RS {val}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-group-interactive">
                <label htmlFor="fine-status">Status</label>
                <select
                  id="fine-status"
                  value={form.status}
                  onChange={handleChange("status")}
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
          </div>

          {error && <span className="form-error">{error}</span>}

          {existingFine && (
            <div className="duplicate-warning">
              <span className="duplicate-warning-icon">🚫</span>
              <div className="duplicate-warning-text">
                <strong>Already fined for this day</strong>
                <p>
                  <strong>{form.name}</strong> already has a RS {existingFine.amount} late fine on{" "}
                  <strong>{form.date}</strong>. A late fine is one per person per day — edit or
                  delete the existing fine instead.
                </p>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={!!existingFine}>
              Add Fine
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
