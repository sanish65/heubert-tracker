"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";

export default function AddFineModal({ isOpen, onClose }) {
  const { addFine, employees, currentEmployee } = useApp();
  const today = new Date().toISOString().split("T")[0];
  const [form, setForm] = useState({
    name: "",
    date: today,
    amount: 25,
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

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
    setError("");
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name) {
      setError("Please select an employee");
      return;
    }
    if (!form.name || !form.amount) {
      setError("Please fill all required fields");
      return;
    }
    addFine({
      ...form,
      amount: Number(form.amount),
      createdAt: new Date().toISOString(),
    });
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
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name}
                    </option>
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
                <label htmlFor="fine-amount">Amount (Rs.)</label>
                <input
                  id="fine-amount"
                  type="number"
                  min="1"
                  value={form.amount}
                  onChange={handleChange("amount")}
                />
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
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Add Fine
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
