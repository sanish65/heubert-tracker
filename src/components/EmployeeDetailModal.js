"use client";

import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";

// The statuses the employee form stores (EditEmployeeModal), each with its pill colour.
const STATUSES = {
  active: { label: "Active", pill: "pill-green" },
  "on-leave": { label: "On Leave", pill: "pill-cyan" },
  resigned: { label: "Resigned", pill: "pill-gray" },
};

export const EMPLOYEE_STATUSES = Object.entries(STATUSES).map(([id, s]) => ({ id, ...s }));

// No status means active, as everywhere else in the app.
export function employeeStatus(employee) {
  const id = employee?.status || "active";
  return { id, ...(STATUSES[id] || { label: id, pill: "pill-gray" }) };
}

// A leave type's meter turns amber from this share of its quota used, as on Leaves.
const WARN_SHARE = 0.8;

function meterState(used, quota) {
  if (used > quota) return "over";
  if (quota > 0 && used / quota >= WARN_SHARE) return "warn";
  return "ok";
}

const rs = (n) => `Rs. ${n.toLocaleString()}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function formatDate(dateStr) {
  if (!dateStr) return "N/A";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fineNote({ records, unpaid }) {
  if (records === 0) return "No late fines";
  return `${plural(records, "late fine record")}${unpaid === 0 ? " · all paid" : ""}`;
}

// `balances` (computeLeaveBalances for the latest leave season), `seasonTitle` and
// `stats` (getEmployeeStats) come from EmployeeList, which already has them for its table.
export default function EmployeeDetailModal({ isOpen, onClose, employee, balances = [], seasonTitle = "", stats }) {
  if (!isOpen || !employee) return null;

  const status = employeeStatus(employee);
  const empId = employee.emp_no || `EMP-${employee.id}`;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content modal-large emp-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="emp-detail-name"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <Avatar name={employee.name} className="avatar emp-detail-avatar" aria-hidden="true" />
          <div className="modal-title-group">
            <span className="modal-eyebrow">Employee details</span>
            <h2 id="emp-detail-name">{employee.name}</h2>
            <div className="emp-detail-meta">
              <span className={`pill ${status.pill}`}>{status.label}</span>
              <span className="emp-detail-id mono">{empId}</span>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="x" size={18} />
          </button>
        </div>

        <section className="emp-detail-section" aria-labelledby="emp-detail-profile">
          <h3 id="emp-detail-profile" className="emp-detail-title">
            <Icon name="user" size={16} />
            Profile
          </h3>
          <dl className="emp-detail-tiles">
            <div className="emp-detail-tile">
              <dt>Employee ID</dt>
              <dd>{empId}</dd>
            </div>
            <div className="emp-detail-tile">
              <dt>Date of Birth</dt>
              <dd>{formatDate(employee.dob)}</dd>
            </div>
            <div className="emp-detail-tile">
              <dt>Joined Date</dt>
              <dd>{formatDate(employee.joined_date)}</dd>
            </div>
            {status.id !== "active" && (
              <div className="emp-detail-tile">
                <dt>Left Date</dt>
                <dd>{formatDate(employee.left_date)}</dd>
              </div>
            )}
          </dl>
        </section>

        <section className="emp-detail-section" aria-labelledby="emp-detail-contact">
          <h3 id="emp-detail-contact" className="emp-detail-title">
            <Icon name="mail" size={16} />
            Contact
          </h3>
          <dl className="emp-detail-rows">
            <div className="emp-detail-row">
              <dt>Work Email</dt>
              <dd className="mono">{employee.work_email || "N/A"}</dd>
            </div>
            <div className="emp-detail-row">
              <dt>Personal Email</dt>
              <dd className="mono">{employee.personal_email || "N/A"}</dd>
            </div>
            <div className="emp-detail-row">
              <dt>Phone</dt>
              <dd className="mono">{employee.phone || "N/A"}</dd>
            </div>
            <div className="emp-detail-row">
              <dt>Address</dt>
              <dd>{employee.address || "N/A"}</dd>
            </div>
          </dl>
        </section>

        <section className="emp-detail-section" aria-labelledby="emp-detail-leave">
          <div className="emp-detail-head">
            <h3 id="emp-detail-leave" className="emp-detail-title">
              <Icon name="calendar" size={16} />
              Leave balances
            </h3>
            {seasonTitle && <span className="emp-detail-season mono">{seasonTitle}</span>}
          </div>
          {balances.length === 0 ? (
            <p className="empty-msg">No active leave types configured yet.</p>
          ) : (
            <div className="leave-meters emp-detail-meters">
              {balances.map((b) => {
                const state = meterState(b.used, b.annual_days);
                const width = b.annual_days > 0 ? Math.min(100, (b.used / b.annual_days) * 100) : b.used > 0 ? 100 : 0;
                const left = state === "over"
                  ? `${b.used - b.annual_days} over`
                  : b.remaining === 0 ? "None left" : `${b.remaining} left`;
                return (
                  <div key={b.id} className={`leave-meter is-${state}`}>
                    <div className="leave-meter-row">
                      <span className="leave-meter-name">{b.name}{b.is_unpaid ? " (Unpaid)" : ""}</span>
                      <span className="leave-meter-used mono">{b.used} / {b.annual_days}</span>
                      <span className="leave-meter-left">{left}</span>
                    </div>
                    <div className="leave-meter-track" aria-hidden="true">
                      <div className="leave-meter-fill" style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {stats && (
          <section className="emp-detail-section" aria-labelledby="emp-detail-fines">
            <h3 id="emp-detail-fines" className="emp-detail-title">
              <Icon name="wallet" size={16} />
              Fines
            </h3>
            <div className="emp-detail-fines">
              <div className="emp-detail-tile">
                <span className="emp-detail-label">Total</span>
                <span className="emp-detail-figure">{rs(stats.total)}</span>
              </div>
              <div className="emp-detail-tile">
                <span className="emp-detail-label">Paid</span>
                <span className={`emp-detail-figure ${stats.paid > 0 ? "is-paid" : "is-none"}`}>{rs(stats.paid)}</span>
              </div>
              <div className="emp-detail-tile">
                <span className="emp-detail-label">Unpaid</span>
                <span className={`emp-detail-figure ${stats.unpaid > 0 ? "is-unpaid" : "is-none"}`}>{rs(stats.unpaid)}</span>
              </div>
            </div>
            <span className="emp-detail-note">{fineNote(stats)}</span>
          </section>
        )}
      </div>
    </div>
  );
}
