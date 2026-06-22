"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";

export default function AddStandupFineModal({ isOpen, onClose }) {
  const { addStandupFine, employees, currentEmployee, standupFines } = useApp();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    name: "",
    date: today,
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

  const doAdd = () => {
    addStandupFine({ ...form, createdAt: new Date().toISOString() });
    setForm({ name: "", date: today, status: "unpaid" });
    setDuplicateWarning(false);
    onClose();
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) { setError("Please select an employee"); return; }

    const isDuplicate = standupFines.some(s =>
      s.employee_name === form.name &&
      s.date === form.date
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
          <h2>Missing Standup Report</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-section-title">📝 Record Details</div>
            <div className="form-grid-horizontal">
              <div className="form-group-interactive">
                <label htmlFor="standup-employee">Select Employee</label>
                <select
                  id="standup-employee"
                  value={form.name}
                  onChange={(e) => { setForm({ ...form, name: e.target.value }); setError(""); setDuplicateWarning(false); }}
                  autoFocus
                >
                  <option value="">Choose...</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.name}>{emp.name}</option>
                  ))}
                </select>
              </div>
              <div className="form-group-interactive">
                <label htmlFor="standup-date">Date of Incident</label>
                <input
                  id="standup-date"
                  type="date"
                  value={form.date}
                  onChange={(e) => { setForm({ ...form, date: e.target.value }); setDuplicateWarning(false); }}
                />
              </div>
              <div className="form-group-interactive">
                <label htmlFor="standup-status">Payment Status</label>
                <select
                  id="standup-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="unpaid">Contribution pending</option>
                  <option value="paid">Contribution complete</option>
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
                <p>A standup fine for <strong>{form.name}</strong> on <strong>{form.date}</strong> already exists. Add it anyway?</p>
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
                Record Fine
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
