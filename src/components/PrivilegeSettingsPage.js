"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import Icon from "@/components/Icon";
import Avatar from "@/components/Avatar";

const ROLE_TOGGLES = [
  { field: "is_admin", icon: "lock", title: "Admins", description: "Selected employees get full admin access — manage employees, seasons, attendance settings and every fine/leave/standup record. You can't remove your own admin access here." },
  { field: "is_fine_admin", icon: "wallet", title: "Fine admins", description: "Selected employees can manage fine seasons and toggle fine paid/unpaid status, without full admin access." },
];

const EXCLUSION_LISTS = [
  { field: "standup_excluded", title: "Standup list", description: "Selected employees are skipped in the standup list — they won't show up as missing a submission." },
  { field: "leave_excluded", title: "Leaves", description: "Selected employees are hidden from the leaves list and leave summary." },
  { field: "late_fine_excluded", title: "Late fines", description: "Selected employees are hidden from late fine records, charts and the \"file a fine\" picker." },
  { field: "standup_fine_excluded", title: "Standup fines", description: "Selected employees are hidden from standup fine records and the \"file a fine\" picker." },
];

// The Roles and List visibility sections of the Settings screen (Settings.dc.html).
export default function PrivilegeSettingsPage() {
  const { employees, isAdmin, setEmployeeFlag, currentEmployee } = useApp();
  const activeEmployees = employees.filter((e) => e.status !== "resigned");

  if (!isAdmin) {
    return <p className="empty-msg">Only admins can configure privileges.</p>;
  }

  return (
    <>
      <section id="roles" className="settings-section settings-grid" aria-label="Roles">
        {ROLE_TOGGLES.map(({ field, icon, title, description }) => (
          <FlagPanel
            key={field}
            icon={icon}
            title={title}
            description={description}
            field={field}
            employees={activeEmployees}
            setEmployeeFlag={setEmployeeFlag}
            currentEmployee={currentEmployee}
          />
        ))}
      </section>

      <section id="lists" className="settings-section settings-stack" aria-labelledby="settings-lists-title">
        <div className="settings-head-text">
          <h2 id="settings-lists-title" className="settings-heading">List visibility</h2>
          <p className="settings-sub">People picked here are skipped on that list — they won&apos;t show as missing or appear in its charts.</p>
        </div>
        <div className="settings-grid">
          {EXCLUSION_LISTS.map(({ field, title, description }) => (
            <FlagPanel
              key={field}
              compact
              title={title}
              description={description}
              field={field}
              employees={activeEmployees}
              setEmployeeFlag={setEmployeeFlag}
            />
          ))}
        </div>
      </section>
    </>
  );
}

// One flag as a panel of person chips: role panels carry an icon tile and avatar chips,
// compact panels (List visibility) plain name chips.
function FlagPanel({ icon, compact = false, title, description, field, employees, setEmployeeFlag, currentEmployee }) {
  const [pendingId, setPendingId] = useState(null);
  const Heading = compact ? "h3" : "h2";
  const selectedCount = employees.filter((emp) => emp[field]).length;

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
    <div className={`settings-panel glass-card${compact ? " settings-panel-compact" : ""}`}>
      <div className="settings-panel-head">
        {icon && (
          <span className="settings-panel-icon">
            <Icon name={icon} size={18} />
          </span>
        )}
        <div className="settings-head-text">
          <Heading className="settings-panel-title">{title}</Heading>
          <p className="settings-panel-desc">{description}</p>
        </div>
        <span className="settings-panel-count mono">
          {selectedCount} of {employees.length}
        </span>
      </div>
      {employees.length === 0 ? (
        <p className="empty-msg">No employees yet.</p>
      ) : (
        <div className="project-member-picker settings-chips" role="group" aria-label={title}>
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
                <ChipLead compact={compact} checked={checked} name={emp.name} />
                <span>{emp.name}</span>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Role chips lead with the person's avatar, swapped for a check once picked;
// compact chips show only the check.
function ChipLead({ compact, checked, name }) {
  if (compact) return checked ? <Icon name="check" size={13} strokeWidth={2.6} /> : null;
  if (checked) {
    return (
      <span className="project-member-mark" aria-hidden="true">
        <Icon name="check" size={14} strokeWidth={2.6} />
      </span>
    );
  }
  return <Avatar name={name} className="avatar project-chip-avatar" aria-hidden="true" />;
}
