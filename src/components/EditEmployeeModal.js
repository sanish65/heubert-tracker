"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";

export default function EditEmployeeModal({ isOpen, onClose, employee }) {
  const { updateEmployee } = useApp();
  const [form, setForm] = useState({
    name: "",
    empNo: "",
    dob: "",
    joinedDate: "",
    leftDate: "",
    workEmail: "",
    personalEmail: "",
    phone: "",
    address: "",
    status: "active",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name || "",
        empNo: employee.emp_no || "",
        dob: employee.dob || "",
        joinedDate: employee.joined_date || "",
        leftDate: employee.left_date || "",
        workEmail: employee.work_email || "",
        personalEmail: employee.personal_email || "",
        phone: employee.phone || "",
        address: employee.address || "",
        status: employee.status || "active",
      });
    }
  }, [employee]);

  if (!isOpen || !employee) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    updateEmployee(employee.id, {
      ...form,
      name: form.name.trim(),
    });
    setError("");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Edit Employee Record</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-sections-container">
            {/* 1. Personal Info */}
            <div className="form-section">
              <div className="form-section-title">👤 Personal Information</div>
              <div className="form-grid-horizontal">
                <div className="form-group-interactive">
                  <label htmlFor="edit-name">Full Name *</label>
                  <input
                    id="edit-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    autoFocus
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="edit-no">Employee ID</label>
                  <input
                    id="edit-no"
                    type="text"
                    value={form.empNo}
                    onChange={(e) => setForm({ ...form, empNo: e.target.value })}
                    placeholder="e.g. EMP-001"
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="edit-dob">Date of Birth</label>
                  <input
                    id="edit-dob"
                    type="date"
                    value={form.dob}
                    onChange={(e) => setForm({ ...form, dob: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* 2. Employment */}
            <div className="form-section">
              <div className="form-section-title">💼 Employment Details</div>
              <div className="form-grid-horizontal">
                <div className="form-group-interactive">
                  <label htmlFor="edit-joined">Office Joined Date</label>
                  <input
                    id="edit-joined"
                    type="date"
                    value={form.joinedDate}
                    onChange={(e) => setForm({ ...form, joinedDate: e.target.value })}
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="edit-left">Office Left Date</label>
                  <input
                    id="edit-left"
                    type="date"
                    value={form.leftDate}
                    onChange={(e) => setForm({ ...form, leftDate: e.target.value })}
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="edit-status">Status</label>
                  <select
                    id="edit-status"
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="resigned">Resigned</option>
                    <option value="on-leave">On Leave</option>
                  </select>
                </div>
              </div>
            </div>

            {/* 3. Contact & Location */}
            <div className="form-section">
              <div className="form-section-title">📧 Contact & Location</div>
              <div className="form-grid-horizontal">
                <div className="form-group-interactive">
                  <label htmlFor="edit-work-email">Work Email</label>
                  <input
                    id="edit-work-email"
                    type="email"
                    value={form.workEmail}
                    onChange={(e) => setForm({ ...form, workEmail: e.target.value })}
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="edit-pers-email">Personal Email</label>
                  <input
                    id="edit-pers-email"
                    type="email"
                    value={form.personalEmail}
                    onChange={(e) => setForm({ ...form, personalEmail: e.target.value })}
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="edit-phone">Phone Number</label>
                  <input
                    id="edit-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  />
                </div>
                <div className="form-group-interactive full-width">
                  <label htmlFor="edit-address">Address</label>
                  <input
                    id="edit-address"
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                  />
                </div>
              </div>
            </div>
          </div>
          {error && <span className="form-error">{error}</span>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Changes</button>
          </div>
        </form>
      </div>
    </div>
  );
}
