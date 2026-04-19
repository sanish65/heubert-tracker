"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";

export default function WithdrawModal({ isOpen, onClose }) {
  const { addWithdrawal, user } = useApp();
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      setError("Please enter a valid amount greater than 0.");
      return;
    }
    if (!reason.trim()) {
      setError("Please provide a reason for withdrawal.");
      return;
    }

    setSubmitting(true);
    try {
      await addWithdrawal(parsedAmount, reason.trim());
      setAmount("");
      setReason("");
      onClose();
    } catch (err) {
      setError("Failed to record withdrawal. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>💸 Record Withdrawal</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <div className="form-section-title">💰 Withdrawal Details</div>
            <div className="form-group-interactive">
              <label htmlFor="withdraw-amount">Amount (Rs.)</label>
              <input
                id="withdraw-amount"
                type="number"
                placeholder="e.g. 500"
                value={amount}
                onChange={(e) => { setAmount(e.target.value); setError(""); }}
                min="1"
                step="any"
                required
                autoFocus
              />
            </div>
            <div className="form-group-interactive">
              <label htmlFor="withdraw-reason">Reason</label>
              <textarea
                id="withdraw-reason"
                placeholder="e.g. Office supplies, team lunch..."
                value={reason}
                onChange={(e) => { setReason(e.target.value); setError(""); }}
                rows={3}
                required
                style={{ resize: "vertical" }}
              />
            </div>
            <div className="form-group-interactive">
              <label>Withdrawn By</label>
              <input
                type="text"
                value={user?.user_metadata?.full_name || user?.email || ""}
                readOnly
                style={{ opacity: 0.6, cursor: "not-allowed" }}
              />
            </div>
          </div>

          {error && <span className="form-error">{error}</span>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? "Saving..." : "Record Withdrawal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
