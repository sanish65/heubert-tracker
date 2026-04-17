"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";

export default function StandupFineTable({ selectedEmployee, onAddStandup }) {
  const { standupFines, toggleStandupFineStatus, deleteStandupFine, isAdmin, isFineAdmin } = useApp();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, paid, unpaid
  const [sortConfig, setSortConfig] = useState({ key: "date", direction: "desc" });

  const filteredFines = useMemo(() => {
    let list = [...standupFines];

    if (selectedEmployee) {
      list = list.filter((f) => f.employee_name === selectedEmployee);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (f) =>
          f.employee_name.toLowerCase().includes(q) ||
          f.date.includes(q)
      );
    }

    if (filter !== "all") {
      list = list.filter((f) => f.status === filter);
    }

    list.sort((a, b) => {
      if (a[sortConfig.key] < b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? -1 : 1;
      }
      if (a[sortConfig.key] > b[sortConfig.key]) {
        return sortConfig.direction === "asc" ? 1 : -1;
      }
      return 0;
    });

    return list;
  }, [standupFines, selectedEmployee, search, filter, sortConfig]);

  const stats = useMemo(() => {
    return { count: filteredFines.length };
  }, [filteredFines]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  return (
    <div className="fine-section">
      <div className="fine-header">
        <div className="fine-title-group">
          <h2 className="section-title">
            Missing Standup Records
            <span className="fine-count">{stats.count} instances</span>
          </h2>
          {selectedEmployee && <span className="filter-badge">Filter: {selectedEmployee}</span>}
        </div>
        <button className="btn btn-primary" onClick={onAddStandup}>
          <span>+</span> Standup Fine
        </button>

        <div className="fine-filters">
          <div className="search-box">
            <span className="search-icon">🔍</span>
            <input
              type="text"
              placeholder="Search by name or date..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="status-tabs">
            <button
              className={`tab ${filter === "all" ? "tab-active" : ""}`}
              onClick={() => setFilter("all")}
            >
              All
            </button>
            <button
              className={`tab ${filter === "paid" ? "tab-active" : ""}`}
              onClick={() => setFilter("paid")}
            >
              Completed
            </button>
            <button
              className={`tab ${filter === "unpaid" ? "tab-active" : ""}`}
              onClick={() => setFilter("unpaid")}
            >
              Pending
            </button>
          </div>
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              <th onClick={() => handleSort("date")}>Date {sortConfig.key === "date" && (sortConfig.direction === "asc" ? "↑" : "↓")}</th>
              <th onClick={() => handleSort("employee_name")}>Employee {sortConfig.key === "employee_name" && (sortConfig.direction === "asc" ? "↑" : "↓")}</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFines.length === 0 ? (
              <tr>
                <td colSpan="4" className="empty-row">No standup records found</td>
              </tr>
            ) : (
              filteredFines.map((fine) => (
                <tr key={fine.id}>
                  <td className="date-cell">{formatDate(fine.date)}</td>
                  <td>
                    <div className="emp-name-cell">
                      <div className="emp-avatar">{fine.employee_name.charAt(0)}</div>
                      {fine.employee_name}
                    </div>
                  </td>
                  <td>
                    <span
                      className={`status-badge ${fine.status} ${!(isAdmin || isFineAdmin) ? 'status-static' : ''}`}
                      onClick={() => (isAdmin || isFineAdmin) && toggleStandupFineStatus(fine.id)}
                    >
                      {fine.status === "paid" ? "contribution complete" : "pending contribution"}
                    </span>
                  </td>
                  <td>
                    {(isAdmin || isFineAdmin) && (
                      <button
                        className="btn btn-sm btn-danger"
                        onClick={() => deleteStandupFine(fine.id)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
