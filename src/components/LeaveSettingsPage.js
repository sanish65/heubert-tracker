"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";

const emptyForm = { name: "", annualDays: "", isUnpaid: false, isActive: true };

function initialFormFor(editing) {
  return editing
    ? {
        name: editing.name,
        annualDays: String(editing.annual_days),
        isUnpaid: editing.is_unpaid,
        isActive: editing.is_active,
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

    const payload = { name, annualDays, isUnpaid: form.isUnpaid, isActive: form.isActive };
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
          <h2>{editing ? "Edit Leave Type" : "Add Leave Type"}</h2>
          <button className="close-btn" onClick={onClose}>&times;</button>
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

          {error && <span className="form-error">{error}</span>}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editing ? "Save Changes" : "Add Leave Type"}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LeaveSettingsPage() {
  const { leaveTypes, deleteLeaveType, isAdmin } = useApp();
  const { confirmDialog, alertDialog } = useDialog();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formKey, setFormKey] = useState(0);

  if (!isAdmin) {
    return (
      <div className="employee-directory">
        <p className="empty-msg">Only admins can configure leave types.</p>
      </div>
    );
  }

  const openAdd = () => { setEditing(null); setFormKey((k) => k + 1); setShowForm(true); };
  const openEdit = (t) => { setEditing(t); setFormKey((k) => k + 1); setShowForm(true); };

  return (
    <div className="employee-directory">
      <div className="directory-header">
        <div className="directory-title">
          <h2 className="section-title">Leave Type Configuration</h2>
          <span className="directory-count">{leaveTypes.length} types</span>
        </div>
        <button className="btn btn-primary btn-add-employee" onClick={openAdd}>
          <span>+</span> Add Leave Type
        </button>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Annual Days</th>
              <th>Category</th>
              <th>Status</th>
              <th>Actions</th>
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
                  <td>{t.name}</td>
                  <td>{t.annual_days}</td>
                  <td>
                    <span className={`status-badge ${t.is_unpaid ? "inactive" : "active"}`}>
                      {t.is_unpaid ? "Unpaid" : "Paid"}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${t.is_active ? "active" : "inactive"}`}>
                      {t.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>
                    <div className="action-group">
                      <button className="btn btn-sm btn-ghost" onClick={() => openEdit(t)}>Edit</button>
                      <button
                        className="btn btn-sm btn-danger-ghost"
                        onClick={async () => {
                          if (await confirmDialog(`Delete leave type "${t.name}"? Existing leave records will keep their history but no longer count against this balance.`, { danger: true })) {
                            const { error } = await deleteLeaveType(t.id);
                            if (error) await alertDialog(`Error deleting leave type: ${error.message || "Check connection"}`, { tone: "error" });
                          }
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <LeaveTypeFormModal key={formKey} isOpen={showForm} onClose={() => setShowForm(false)} editing={editing} />
    </div>
  );
}
