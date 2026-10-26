"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import Icon from "@/components/Icon";

const emptyForm = { name: "", annualDays: "", isUnpaid: false, isActive: true, countsInLeaveLeft: true };

function initialFormFor(editing) {
  return editing
    ? {
        name: editing.name,
        annualDays: String(editing.annual_days),
        isUnpaid: editing.is_unpaid,
        isActive: editing.is_active,
        countsInLeaveLeft: editing.counts_in_leave_left !== false,
      }
    : emptyForm;
}

function LeaveTypeFormModal({ isOpen, onClose, editing }) {
  const { addLeaveType, updateLeaveType, leaveTypes } = useApp();
  const [form, setForm] = useState(() => initialFormFor(editing));
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    const annualDays = parseFloat(form.annualDays);
    if (!name) { setError("Please enter a name"); return; }
    if (isNaN(annualDays) || annualDays < 0) { setError("Please enter a valid number of annual days"); return; }

    const duplicate = leaveTypes.some(
      (t) => t.name.toLowerCase() === name.toLowerCase() && t.id !== editing?.id
    );
    if (duplicate) { setError("A leave type with this name already exists"); return; }

    const payload = { name, annualDays, isUnpaid: form.isUnpaid, isActive: form.isActive, countsInLeaveLeft: form.countsInLeaveLeft };
    const { error: dbError } = editing
      ? await updateLeaveType(editing.id, payload)
      : await addLeaveType(payload);

    if (dbError) { setError(dbError.message || "Something went wrong"); return; }
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon"><Icon name="calendar" size={20} /></span>
          <h2>{editing ? "Edit leave type" : "Add leave type"}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} className="premium-form">
          <div className="form-group-interactive">
            <label>Leave Type Name</label>
            <input
              type="text"
              placeholder="e.g. Personal Leave"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              autoFocus
              required
            />
          </div>
          <div className="form-group-interactive">
            <label>Annual Days</label>
            <input
              type="number"
              step="0.5"
              min="0"
              placeholder="e.g. 14"
              value={form.annualDays}
              onChange={(e) => setForm((prev) => ({ ...prev, annualDays: e.target.value }))}
              required
            />
          </div>
          <div className="form-group-interactive">
            <label className="leave-multiday-toggle">
              <input
                type="checkbox"
                checked={form.isUnpaid}
                onChange={(e) => setForm((prev) => ({ ...prev, isUnpaid: e.target.checked }))}
              />
              <span>Unpaid leave (fallback once other balances run out)</span>
            </label>
          </div>
          <div className="form-group-interactive">
            <label className="leave-multiday-toggle">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              />
              <span>Active (visible when recording leave)</span>
            </label>
          </div>
          <div className="form-group-interactive">
            <label className="leave-multiday-toggle">
              <input
                type="checkbox"
                checked={form.countsInLeaveLeft}
                onChange={(e) => setForm((prev) => ({ ...prev, countsInLeaveLeft: e.target.checked }))}
              />
              <span>Counts in leave left (the Employees list&apos;s total, e.g. personal, sick, festival)</span>
            </label>
          </div>

          {error && <div className="form-error" role="alert"><Icon name="alert" size={16} />{error}</div>}

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? "Save Changes" : "Add Leave Type"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// The Leave types section of the Settings screen (Settings.dc.html).
export default function LeaveSettingsPage() {
  const { leaveTypes, deleteLeaveType, isAdmin } = useApp();
  const { confirmDialog, alertDialog } = useDialog();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formKey, setFormKey] = useState(0);

  if (!isAdmin) {
    return <p className="empty-msg">Only admins can configure leave types.</p>;
  }

  const openAdd = () => { setEditing(null); setFormKey((k) => k + 1); setShowForm(true); };
  const openEdit = (t) => { setEditing(t); setFormKey((k) => k + 1); setShowForm(true); };

  return (
    <>
      <section id="leave-types" className="settings-section settings-card glass-card" aria-labelledby="settings-leave-title">
        <div className="settings-card-head">
          <div className="settings-head-text">
            <h2 id="settings-leave-title" className="settings-heading">Leave type configuration</h2>
            <p className="settings-sub">Annual quotas reset with each leave season.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            <Icon name="plus" size={16} strokeWidth={2.2} /> Add Leave Type
          </button>
        </div>

        <div className="settings-table-scroll">
          <table className="data-table settings-table">
            <thead>
              <tr>
                <th scope="col">Leave type</th>
                <th scope="col">Category</th>
                <th scope="col">Annual days</th>
                <th scope="col">Status</th>
                <th scope="col" className="settings-num">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leaveTypes.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty-row">No leave types configured yet</td>
                </tr>
              ) : (
                leaveTypes.map((t) => (
                  <tr key={t.id}>
                    <td className="settings-table-name">{t.name}</td>
                    <td>{t.is_unpaid ? "Unpaid" : "Paid"}</td>
                    <td className="settings-table-days mono">{t.annual_days}</td>
                    <td>
                      <span className={`pill ${t.is_active ? "pill-green" : "pill-gray"}`}>
                        {t.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="settings-num">
                      <span className="settings-row-actions">
                        <button
                          type="button"
                          className="btn-icon settings-icon-btn"
                          onClick={() => openEdit(t)}
                          aria-label={`Edit ${t.name}`}
                          title="Edit"
                        >
                          <Icon name="edit" size={16} />
                        </button>
                        <button
                          type="button"
                          className="btn-icon settings-icon-btn settings-icon-delete"
                          onClick={async () => {
                            if (await confirmDialog(`Delete leave type "${t.name}"? Existing leave records will keep their history but no longer count against this balance.`, { danger: true })) {
                              const { error } = await deleteLeaveType(t.id);
                              if (error) await alertDialog(`Error deleting leave type: ${error.message || "Check connection"}`, { tone: "error" });
                            }
                          }}
                          aria-label={`Delete ${t.name}`}
                          title="Delete"
                        >
                          <Icon name="trash" size={16} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Outside the glass card: its backdrop-filter would trap the fixed overlay inside it. */}
      <LeaveTypeFormModal key={formKey} isOpen={showForm} onClose={() => setShowForm(false)} editing={editing} />
    </>
  );
}
