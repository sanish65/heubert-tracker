"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";

export default function EditFineModal({ isOpen, onClose, fine }) {
  const { updateFine } = useApp();
  const [amount, setAmount] = useState(50);
  const [status, setStatus] = useState("unpaid");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (fine) {
      setAmount(fine.amount || 50);
      setStatus(fine.status || "unpaid");
    }
  }, [fine, isOpen]);

  if (!isOpen || !fine) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await updateFine(fine.id, {
        amount: Number(amount),
        status
      });
      if (!error) onClose();
      else alert("Failed to update fine.");
    } catch (err) {
      console.error("Update error:", err);
      alert("Error updating fine.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💰 Edit Late Fine</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-group-interactive">
            <label>Employee</label>
            <input type="text" value={fine.employee_name} disabled className="input-disabled" />
          </div>
          <div className="form-group-interactive">
            <label>Amount (Rs.)</label>
            <input 
              type="number" 
              value={amount} 
              onChange={e => setAmount(e.target.value)} 
              required 
              min="0"
            />
          </div>
          <div className="form-group-interactive">
            <label>Status</label>
            <select value={status} onChange={e => setStatus(e.target.value)}>
              <option value="unpaid">Unpaid</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
