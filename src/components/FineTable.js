"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import WithdrawalLog from "./WithdrawalLog";

export default function FineTable({ selectedEmployee, onAddFine, onWithdraw }) {
  const { fines, toggleFineStatus, deleteFine, isAdmin, isFineAdmin } = useApp();
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");

  const filtered = useMemo(() => {
    let list = [...fines];

    // Employee filter
    if (selectedEmployee) {
      list = list.filter((f) => f.employee_name === selectedEmployee);
    }

    // Status filter
    if (statusFilter !== "all") {
      list = list.filter((f) => f.status === statusFilter);
    }

    // Search
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (f) =>
          f.employee_name.toLowerCase().includes(q) ||
          f.date.includes(q) ||
          String(f.amount).includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "name") cmp = a.employee_name.localeCompare(b.employee_name);
      else if (sortField === "amount") cmp = a.amount - b.amount;
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [fines, selectedEmployee, statusFilter, searchTerm, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const sortIcon = (field) => {
    if (sortField !== field) return "⇅";
    return sortDir === "asc" ? "↑" : "↓";
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      weekday: "short",
    });
  };

  const totalFiltered = filtered.reduce((s, f) => s + f.amount, 0);

  return (
    <div className="fine-split-layout">
      <section className="fine-section">
        <div className="fine-header">
          <div className="fine-title-group">
            <h3 className="section-title">
              Fine Records
              {selectedEmployee && (
                <span className="filter-badge">{selectedEmployee}</span>
              )}
            </h3>
            <span className="fine-count">
              {filtered.length} records · Rs. {totalFiltered.toLocaleString()}
            </span>
          </div>
          <button className="btn btn-primary" onClick={onAddFine}>
            <span>+</span> Record Fine
          </button>
        </div>

        <div className="fine-filters">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name, date, amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="status-tabs">
            {["all", "paid", "unpaid"].map((s) => (
              <button
                key={s}
                className={`tab ${statusFilter === s ? "tab-active" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="table-wrapper">
          <table className="data-table fine-table">
            <thead>
              <tr>
                <th onClick={() => handleSort("date")}>
                  Date {sortIcon("date")}
                </th>
                <th onClick={() => handleSort("name")}>
                  Employee {sortIcon("name")}
                </th>
                <th onClick={() => handleSort("amount")}>
                  Amount {sortIcon("amount")}
                </th>
                <th onClick={() => handleSort("status")}>
                  Status {sortIcon("status")}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="empty-row">
                    No records found
                  </td>
                </tr>
              ) : (
                filtered.map((f) => (
                  <tr key={f.id}>
                    <td className="date-cell">{formatDate(f.date)}</td>
                    <td className="emp-name-cell">
                      <span className="emp-avatar">
                        {f.employee_name.charAt(0).toUpperCase()}
                      </span>
                      {f.employee_name}
                    </td>
                    <td className="amount-cell">Rs. {f.amount}</td>
                    <td>
                      <span
                        className={`status-badge ${f.status} ${!(isAdmin || isFineAdmin) ? 'status-static' : ''}`}
                        onClick={() => (isAdmin || isFineAdmin) && toggleFineStatus(f.id)}
                        title={(isAdmin || isFineAdmin) ? "Click to toggle status" : ""}
                      >
                        {f.status}
                      </span>
                    </td>
                    <td>
                      {(isAdmin || isFineAdmin) && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => deleteFine(f.id)}
                          title="Delete"
                        >
                          🗑
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <WithdrawalLog onWithdraw={onWithdraw} />
    </div>
  );
}
