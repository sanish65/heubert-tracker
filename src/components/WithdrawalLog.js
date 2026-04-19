"use client";

import { useApp } from "@/context/AppContext";

export default function WithdrawalLog({ onWithdraw }) {
  const { withdrawals, isAdmin, deleteWithdrawal } = useApp();

  const totalWithdrawn = withdrawals.reduce((s, w) => s + w.amount, 0);

  const formatDate = (ts) => {
    const d = new Date(ts);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <aside className="withdrawal-log">
      <div className="withdrawal-log-header">
        <div>
          <h3 className="section-title" style={{ marginBottom: "0.15rem" }}>
            💸 Withdrawals
          </h3>
          <span className="fine-count">
            Rs. {totalWithdrawn.toLocaleString()} withdrawn · {withdrawals.length} record{withdrawals.length !== 1 ? "s" : ""}
          </span>
        </div>
        {isAdmin && (
          <button className="btn btn-primary btn-sm" onClick={onWithdraw}>
            + Withdraw
          </button>
        )}
      </div>

      <div className="withdrawal-list">
        {withdrawals.length === 0 ? (
          <p className="empty-msg" style={{ padding: "1rem 0" }}>
            No withdrawals recorded yet.
          </p>
        ) : (
          withdrawals.map((w) => (
            <div key={w.id} className="withdrawal-item">
              <div className="withdrawal-top">
                <span className="withdrawal-amount">Rs. {w.amount.toLocaleString()}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="withdrawal-date">{formatDate(w.created_at)}</span>
                  {isAdmin && (
                    <button 
                      className="btn-icon-delete" 
                      onClick={() => {
                        if (confirm("Delete this withdrawal record?")) {
                          deleteWithdrawal(w.id);
                        }
                      }}
                      title="Delete withdrawal"
                    >
                      🗑
                    </button>
                  )}
                </div>
              </div>
              <p className="withdrawal-reason">{w.reason}</p>
              <span className="withdrawal-by">— {w.withdrawn_by}</span>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
