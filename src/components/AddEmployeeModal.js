"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";

export default function AddEmployeeModal({ isOpen, onClose }) {
  const { addEmployee, employees } = useApp();
  const [form, setForm] = useState({
    name: "",
    empNo: "",
    dob: "",
    joinedDate: new Date().toISOString().split("T")[0],
    leftDate: "",
    workEmail: "",
    personalEmail: "",
    phone: "",
    address: "",
  });
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Name is required");
      return;
    }
    if (employees.find((emp) => emp.name.toLowerCase() === form.name.trim().toLowerCase())) {
      setError("Employee with this name already exists");
      return;
    }
    addEmployee({
      ...form,
      name: form.name.trim(),
      status: "active",
    });
    setForm({
      name: "",
      empNo: "",
      dob: "",
      joinedDate: new Date().toISOString().split("T")[0],
      leftDate: "",
      workEmail: "",
      personalEmail: "",
      phone: "",
      address: "",
    });
    setError("");
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Employee</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-sections-container">
            {/* 1. Personal Info */}
            <div className="form-section">
              <div className="form-section-title">👤 Personal Information</div>
              <div className="form-grid-horizontal">
                <div className="form-group-interactive">
                  <label htmlFor="emp-name">Full Name *</label>
                  <input
                    id="emp-name"
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. John Doe"
                    autoFocus
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="emp-no">Employee ID</label>
                  <input
                    id="emp-no"
                    type="text"
                    value={form.empNo}
                    onChange={(e) => setForm({ ...form, empNo: e.target.value })}
                    placeholder="e.g. EMP-001"
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="emp-dob">Date of Birth</label>
                  <input
                    id="emp-dob"
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
                  <label htmlFor="emp-joined">Office Joined Date</label>
                  <input
                    id="emp-joined"
                    type="date"
                    value={form.joinedDate}
                    onChange={(e) => setForm({ ...form, joinedDate: e.target.value })}
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="emp-left">Office Left Date</label>
                  <input
                    id="emp-left"
                    type="date"
                    value={form.leftDate}
                    onChange={(e) => setForm({ ...form, leftDate: e.target.value })}
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="emp-phone">Phone Number</label>
                  <input
                    id="emp-phone"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="+977-..."
                  />
                </div>
              </div>
            </div>

            {/* 3. Contact & Location */}
            <div className="form-section">
              <div className="form-section-title">📧 Contact & Location</div>
              <div className="form-grid-horizontal">
                <div className="form-group-interactive">
                  <label htmlFor="emp-work-email">Work Email</label>
                  <input
                    id="emp-work-email"
                    type="email"
                    value={form.workEmail}
                    onChange={(e) => setForm({ ...form, workEmail: e.target.value })}
                    placeholder="work@gmail.com"
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="emp-pers-email">Personal Email</label>
                  <input
                    id="emp-pers-email"
                    type="email"
                    value={form.personalEmail}
                    onChange={(e) => setForm({ ...form, personalEmail: e.target.value })}
                    placeholder="personal@gmail.com"
                  />
                </div>
                <div className="form-group-interactive">
                  <label htmlFor="emp-address">Address</label>
                  <input
                    id="emp-address"
                    type="text"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="City, District..."
                  />
                </div>
              </div>
            </div>
          </div>
          {error && <span className="form-error">{error}</span>}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create Employee</button>
          </div>
        </form>
      </div>
    </div>
  );
}
