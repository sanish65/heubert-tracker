"use client";

import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import { tenureLabel } from "@/lib/employeeDirectory";

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

// Each leave type's jar takes the next colour; unpaid leave is always amber.
const JAR_FILLS = ["var(--primary)", "var(--pf-red)", "var(--pf-violet)", "var(--pf-cyan)"];

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

// Employees.dc.html's details panel, beside the directory table. `balances`
// (computeLeaveBalances for the latest leave season), `stats` (getEmployeeStats) and
// `records` (the person's latest leaves and fines) come from EmployeeList.
export default function EmployeeDetailPanel({
  ref,
  employee,
  balances = [],
  seasonTitle = "",
  stats,
  records = [],
  today,
  onClose,
  onEdit,
  onRecordFine,
}) {
  const status = employeeStatus(employee);
  const empId = employee.emp_no || `EMP-${employee.id}`;

  return (
    <aside ref={ref} className="emp-panel glass" aria-labelledby="emp-detail-name">
      <div className="emp-panel-head">
        <Avatar name={employee.name} className="avatar emp-detail-avatar" aria-hidden="true" />
        <div className="emp-panel-title">
          <span className="eyebrow">Employee details</span>
          <h2 id="emp-detail-name">{employee.name}</h2>
          <div className="emp-detail-meta">
            <span className={`pill ${status.pill}`}>{status.label}</span>
            <span className="emp-detail-id mono">{empId}</span>
          </div>
        </div>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="Close employee details">
          <Icon name="x" size={16} />
        </button>
      </div>

      {(onEdit || onRecordFine) && (
        <div className="emp-panel-actions">
          {onEdit && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onEdit}>
              <Icon name="edit" size={15} /> Edit Employee
            </button>
          )}
          {onRecordFine && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={onRecordFine}>
              <Icon name="plus" size={15} strokeWidth={2} /> Record Fine
            </button>
          )}
        </div>
      )}

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
          {status.id !== "active" && employee.left_date && (
            <div className="emp-detail-tile">
              <dt>Left Date</dt>
              <dd>{formatDate(employee.left_date)}</dd>
            </div>
          )}
          <div className="emp-detail-tile">
            <dt>Tenure</dt>
            <dd>{tenureLabel(employee.joined_date, (status.id === "resigned" && employee.left_date) || today)}</dd>
          </div>
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
          <div className="emp-jars">
            {balances.map((b, i) => {
              const over = b.used > b.annual_days;
              const share = b.annual_days > 0 ? Math.max(0, Math.min(1, b.remaining / b.annual_days)) : 0;
              const fill = b.is_unpaid ? "var(--unpaid)" : JAR_FILLS[i % JAR_FILLS.length];
              const label = over ? `${b.used - b.annual_days} days over` : `${b.remaining} of ${b.annual_days} days left`;
              return (
                <div key={b.id} className={`emp-jar${over ? " is-over" : ""}`}>
                  <div className="emp-jar-glass" role="img" aria-label={`${b.name}: ${label}`}>
                    <span className="emp-jar-fill" style={{ height: `${Math.round(share * 100)}%`, background: fill }} />
                  </div>
                  <span className="emp-jar-name">{b.name}</span>
                  <span className="emp-jar-left">
                    {over ? (
                      <>
                        <span className="mono">{b.used - b.annual_days}</span> days over
                      </>
                    ) : (
                      <>
                        <span className="mono">{b.remaining}</span> / {b.annual_days} days left
                      </>
                    )}
                  </span>
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

      <section className="emp-detail-section" aria-labelledby="emp-detail-records">
        <h3 id="emp-detail-records" className="emp-detail-title">Recent records</h3>
        {records.length === 0 ? (
          <p className="empty-msg">No leaves or late fines yet.</p>
        ) : (
          <ul className="emp-records">
            {records.map((r) => (
              <li key={r.id} className="emp-record">
                <span className={`emp-record-icon is-${r.kind}`} aria-hidden="true">
                  <Icon name={r.kind === "leave" ? "calendar" : "clock"} size={16} />
                </span>
                <span className="emp-record-text">
                  <span className="emp-record-title">{r.title}</span>
                  <span className="emp-record-date mono">{r.dateLabel}</span>
                </span>
                <span className={`pill ${r.pill}`}>{r.pillLabel}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
