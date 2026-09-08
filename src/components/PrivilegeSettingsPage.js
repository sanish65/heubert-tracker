"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";

const ROLE_TOGGLES = [
  { field: "is_admin", title: "🛡️ Admins", description: "Selected employees get full admin access — manage employees, seasons, attendance settings and every fine/leave/standup record." },
  { field: "is_fine_admin", title: "💵 Fine Admins", description: "Selected employees can manage fine seasons and toggle fine paid/unpaid status, without full admin access." },
];

const EXCLUSION_LISTS = [
  { field: "standup_excluded", title: "📝 Standup List", description: "Selected employees are skipped in the standup list — they won't show up as missing a submission." },
  { field: "leave_excluded", title: "🏖️ Leaves", description: "Selected employees are hidden from the leaves list and leave summary." },
  { field: "late_fine_excluded", title: "⏰ Late Fines", description: "Selected employees are hidden from late fine records, charts and the \"file a fine\" picker." },
  { field: "standup_fine_excluded", title: "🎉 Standup Fines", description: "Selected employees are hidden from standup fine records and the \"file a fine\" picker." },
];

export default function PrivilegeSettingsPage() {
  const { employees, isAdmin, setEmployeeFlag, currentEmployee } = useApp();
  const activeEmployees = employees.filter((e) => e.status !== "resigned");

  if (!isAdmin) {
    return (
      <div className="employee-directory">
        <p className="empty-msg">Only admins can configure privileges.</p>
      </div>
    );
  }

  return (
    <div className="employee-directory">
      <div className="directory-header">
        <div className="directory-title">
          <h2 className="section-title">Privilege Settings</h2>
          <span className="directory-count">Roles &amp; list visibility</span>
        </div>
      </div>

      <div className="exclusion-panels">
        {ROLE_TOGGLES.map(({ field, title, description }) => (
          <FlagPanel
            key={field}
            title={title}
            description={description}
            field={field}
            employees={activeEmployees}
            setEmployeeFlag={setEmployeeFlag}
            currentEmployee={currentEmployee}
          />
        ))}
        {EXCLUSION_LISTS.map(({ field, title, description }) => (
          <FlagPanel
            key={field}
            title={title}
            description={description}
            field={field}
            employees={activeEmployees}
            setEmployeeFlag={setEmployeeFlag}
          />
        ))}
      </div>
    </div>
  );
}

function FlagPanel({ title, description, field, employees, setEmployeeFlag, currentEmployee }) {
  const [pendingId, setPendingId] = useState(null);

  // Can't revoke your own admin access from this panel — that would lock you out with no
  // way back in short of editing the database directly.
  const isSelfLock = (emp) => field === "is_admin" && emp.id === currentEmployee?.id && emp[field];

  const handleToggle = async (emp) => {
    if (isSelfLock(emp)) return;
    setPendingId(emp.id);
    try {
      await setEmployeeFlag(emp.id, field, !emp[field]);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <div className="attendance-card">
      <h3 className="section-title">{title}</h3>
      <span className="fine-count">{description}</span>
      {employees.length === 0 ? (
        <p className="empty-msg">No employees yet.</p>
      ) : (
        <div className="project-member-picker">
          {employees.map((emp) => {
            const checked = !!emp[field];
            const locked = isSelfLock(emp);
            return (
              <label
                key={emp.id}
                className={`project-member-chip ${checked ? "active" : ""}`}
                title={locked ? "You can't remove your own admin access here." : undefined}
                style={pendingId === emp.id || locked ? { opacity: 0.6, pointerEvents: locked ? "none" : undefined } : undefined}
              >
                <input type="checkbox" checked={checked} disabled={locked} onChange={() => handleToggle(emp)} />
                <span>{emp.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}
