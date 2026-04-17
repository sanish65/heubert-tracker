"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";

export default function AddStandupFineModal({ isOpen, onClose }) {
  const { addStandupFine, employees, currentEmployee } = useApp();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    name: "",
    date: today,
    status: "unpaid",
  });
  const [error, setError] = useState("");

  // Auto-select current employee if available
  useEffect(() => {
    if (isOpen && currentEmployee && !form.name) {
      setForm(prev => ({ ...prev, name: currentEmployee.name }));
    }
  }, [isOpen, currentEmployee, form.name]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) {
      setError("Please select an employee");
      return;
    }
    addStandupFine({
      ...form,
      createdAt: new Date().toISOString(),
    });
    setForm({ name: "", date: today, status: "unpaid" });
    onClose();
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
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                />
              </div>
              <div className="form-group-interactive">
                <label htmlFor="standup-status">Payment Status</label>
                <select
                  id="standup-status"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value })}
                >
                  <option value="unpaid">Pending contribution</option>
                  <option value="paid">Contribution complete</option>
                </select>
              </div>
            </div>
          </div>
          {error && <span className="form-error">{error}</span>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Record Fine</button>
          </div>
        </form>
      </div>
    </div>
  );
}
