"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";

export default function AddFineModal({ isOpen, onClose }) {
  const { addFine, employees, currentEmployee, fines } = useApp();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    name: "",
    date: today,
    amount: 25,
    status: "unpaid",
  });
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  useEffect(() => {
    if (isOpen && currentEmployee && !form.name) {
      setForm(prev => ({ ...prev, name: currentEmployee.name }));
    }
  }, [isOpen, currentEmployee, form.name]);

  if (!isOpen) return null;

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
    setDuplicateWarning(false);
  };

  const doAdd = () => {
    addFine({ ...form, amount: Number(form.amount), createdAt: new Date().toISOString() });
    setForm({ name: "", date: today, amount: 25, status: "unpaid" });
    setDuplicateWarning(false);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) { setError("Please select an employee"); return; }
    if (!form.amount) { setError("Please fill all required fields"); return; }

    const isDuplicate = fines.some(f =>
      f.employee_name === form.name &&
      f.date === form.date &&
      Number(f.amount) === Number(form.amount)
    );

    if (isDuplicate && !duplicateWarning) {
      setDuplicateWarning(true);
      return;
    }

    doAdd();
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
                  {employees.map((emp) => (
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

          {duplicateWarning && (
            <div className="duplicate-warning">
              <span className="duplicate-warning-icon">⚠️</span>
              <div className="duplicate-warning-text">
                <strong>Duplicate entry detected</strong>
                <p>A RS {form.amount} fine for <strong>{form.name}</strong> on <strong>{form.date}</strong> already exists. Add it anyway?</p>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setDuplicateWarning(false); onClose(); }}>
              Cancel
            </button>
            {duplicateWarning ? (
              <button type="submit" className="btn btn-warning">
                Add Anyway
              </button>
            ) : (
              <button type="submit" className="btn btn-primary">
                Add Fine
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
