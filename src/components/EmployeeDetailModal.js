"use client";

import { useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { computeLeaveBalances } from "@/lib/utils";

const JAR_PALETTE = [
  { top: "#60a5fa", bottom: "#2563eb" },
  { top: "#f87171", bottom: "#dc2626" },
  { top: "#c084fc", bottom: "#9333ea" },
  { top: "#34d399", bottom: "#059669" },
  { top: "#fbbf24", bottom: "#d97706" },
  { top: "#22d3ee", bottom: "#0891b2" },
  { top: "#fb923c", bottom: "#ea580c" },
  { top: "#94a3b8", bottom: "#475569" },
];

function LeaveJar({ label, remaining, total, colors, isUnpaid }) {
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  return (
    <div className="leave-jar-card">
      <div className="leave-jar">
        <div
          className="leave-jar-fill"
          style={{
            height: `${pct}%`,
            background: `linear-gradient(180deg, ${colors.top}, ${colors.bottom})`,
          }}
        />
      </div>
      <span className="leave-jar-label">{label}{isUnpaid ? " (Unpaid)" : ""}</span>
      <span className="leave-jar-stat">{remaining} / {total} days left</span>
    </div>
  );
}

export default function EmployeeDetailModal({ isOpen, onClose, employee }) {
  const { leaves, leaveTypes, leaveSeasons, publicHolidays } = useApp();

  const holidaySet = useMemo(
    () => new Set((publicHolidays || []).map((h) => h.date?.split("T")[0])),
    [publicHolidays]
  );

  const latestLeaveSeason = useMemo(() => {
    if (!leaveSeasons || leaveSeasons.length === 0) return null;
    return [...leaveSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  }, [leaveSeasons]);

  const balances = useMemo(() => {
    if (!employee) return [];
    return computeLeaveBalances(employee.name, leaves, leaveTypes, latestLeaveSeason?.id ?? null, holidaySet);
  }, [employee, leaves, leaveTypes, latestLeaveSeason, holidaySet]);

  if (!isOpen || !employee) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Employee Details</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="emp-detail-header">
          <div className="emp-avatar emp-avatar-lg">{employee.name?.charAt(0)}</div>
          <div>
            <h3 className="emp-detail-name">{employee.name}</h3>
            <span className={`status-badge ${employee.status || "active"}`}>
              {employee.status || "active"}
            </span>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">👤 Profile</div>
          <div className="emp-detail-grid">
            <div className="emp-detail-item">
              <span className="emp-detail-label">Employee ID</span>
              <span className="emp-detail-value">{employee.emp_no || `EMP-${employee.id}`}</span>
            </div>
            <div className="emp-detail-item">
              <span className="emp-detail-label">Date of Birth</span>
              <span className="emp-detail-value">{formatDate(employee.dob)}</span>
            </div>
            <div className="emp-detail-item">
              <span className="emp-detail-label">Joined Date</span>
              <span className="emp-detail-value">{formatDate(employee.joined_date)}</span>
            </div>
            <div className="emp-detail-item">
              <span className="emp-detail-label">Left Date</span>
              <span className="emp-detail-value">{formatDate(employee.left_date)}</span>
            </div>
          </div>
        </div>

        <div className="form-section">
          <div className="form-section-title">📞 Contact</div>
          <div className="emp-detail-grid">
            <div className="emp-detail-item">
              <span className="emp-detail-label">Phone</span>
              <span className="emp-detail-value">{employee.phone || "N/A"}</span>
            </div>
            <div className="emp-detail-item">
              <span className="emp-detail-label">Work Email</span>
              <span className="emp-detail-value">{employee.work_email || "N/A"}</span>
            </div>
            <div className="emp-detail-item">
              <span className="emp-detail-label">Personal Email</span>
              <span className="emp-detail-value">{employee.personal_email || "N/A"}</span>
            </div>
            <div className="emp-detail-item">
              <span className="emp-detail-label">Address</span>
              <span className="emp-detail-value">{employee.address || "N/A"}</span>
            </div>
          </div>
        </div>

        <div className="form-section" style={{ border: "none", marginBottom: 0 }}>
          <div className="form-section-title">🫙 Leave Balances{latestLeaveSeason ? ` (${latestLeaveSeason.title})` : ""}</div>
          {balances.length === 0 ? (
            <p className="empty-msg">No active leave types configured yet.</p>
          ) : (
            <div className="leave-jar-grid">
              {balances.map((b, idx) => (
                <LeaveJar
                  key={b.id}
                  label={b.name}
                  remaining={b.remaining}
                  total={b.annual_days}
                  isUnpaid={b.is_unpaid}
                  colors={JAR_PALETTE[idx % JAR_PALETTE.length]}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
