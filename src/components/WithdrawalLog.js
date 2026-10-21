"use client";

import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import Icon from "./Icon";
import Avatar from "./Avatar";

const rs = (n) => `Rs. ${n.toLocaleString()}`;

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// `collected`, `withdrawn` and `remaining` come from FineTable, which also shows them
// as summary tiles, so the jar meter and the tiles never disagree.
export default function WithdrawalLog({ onWithdraw, collected, withdrawn, remaining }) {
  const { withdrawals, canManageFines, deleteWithdrawal } = useApp();
  const { confirmDialog } = useDialog();

  const outShare = collected > 0 ? Math.min((withdrawn / collected) * 100, 100) : 0;

  return (
    <aside className="withdrawal-log glass-card" aria-label="Withdrawal log">
      <div className="withdrawal-log-head">
        <div className="withdrawal-log-heading">
          <h2 className="section-title">Withdrawals</h2>
          <span className="withdrawal-log-sub">
            {rs(withdrawn)} withdrawn · {withdrawals.length} record{withdrawals.length !== 1 ? "s" : ""}
          </span>
        </div>
        {canManageFines ? (
          <button type="button" className="btn btn-secondary btn-sm" onClick={onWithdraw}>
            <Icon name="wallet" size={14} /> Withdraw
          </button>
        ) : (
          <span className="withdrawal-log-icon" aria-hidden="true">
            <Icon name="wallet" size={18} />
          </span>
        )}
      </div>

      <div className="withdrawal-jar">
        <div className="withdrawal-jar-row">
          <span className="withdrawal-jar-label">Left in the jar</span>
          <span className="withdrawal-jar-value mono">{rs(remaining)}</span>
        </div>
        <div
          className="withdrawal-jar-track"
          role="img"
          aria-label={`${rs(withdrawn)} of ${rs(collected)} collected has been withdrawn`}
        >
          <div className="withdrawal-jar-fill" style={{ width: `${outShare}%` }} />
        </div>
        <span className="withdrawal-jar-note mono">
          {rs(collected)} collected · {rs(withdrawn)} out
        </span>
      </div>

      <div className="withdrawal-list">
        {withdrawals.length === 0 ? (
          <p className="empty-msg">No withdrawals recorded yet.</p>
        ) : (
          withdrawals.map((w) => {
            const date = formatDate(w.created_at);
            return (
              <div key={w.id} className="withdrawal-item">
                <div className="withdrawal-top">
                  <span className="withdrawal-amount mono">{rs(w.amount)}</span>
                  <span className="withdrawal-date mono">{date}</span>
                  {canManageFines && (
                    <button
                      type="button"
                      className="btn-icon btn-sm withdrawal-delete"
                      onClick={async () => {
                        if (await confirmDialog("Delete this withdrawal record?", { danger: true })) {
                          deleteWithdrawal(w.id);
                        }
                      }}
                      aria-label={`Delete withdrawal of ${rs(w.amount)} on ${date}`}
                      title="Delete withdrawal"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  )}
                </div>
                <p className="withdrawal-reason">{w.reason}</p>
                {w.withdrawn_by && (
                  <span className="withdrawal-by">
                    <Avatar name={w.withdrawn_by} className="avatar avatar-sm" aria-hidden="true" />
                    Withdrawn by {w.withdrawn_by}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
