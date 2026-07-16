"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import WithdrawalLog from "./WithdrawalLog";
import EditFineModal from "./EditFineModal";

const UNASSIGNED = "unassigned";

export default function FineTable({ selectedEmployee, onAddFine, onWithdraw, onAddSeason, onEditSeason }) {
  const { fines, fineSeasons, employees, toggleFineStatus, deleteFine, isAdmin, isFineAdmin } = useApp();
  const canManageSeasons = isAdmin || isFineAdmin;

  const [activeSeasonId, setActiveSeasonId] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortField, setSortField] = useState("date");
  const [sortDir, setSortDir] = useState("desc");
  const [editingFine, setEditingFine] = useState(null);

  const sortedSeasons = useMemo(
    () => [...fineSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [fineSeasons]
  );
  const latestSeasonId = sortedSeasons[0]?.id ?? null;

  // Default to the latest season once seasons load, but only the first time
  useMemo(() => {
    if (activeSeasonId === null && latestSeasonId !== null) {
      setActiveSeasonId(latestSeasonId);
    }
  }, [latestSeasonId, activeSeasonId]);

  const activeSeason = activeSeasonId === UNASSIGNED
    ? null
    : fineSeasons.find(s => s.id === activeSeasonId);

  const unassignedCount = useMemo(
    () => fines.filter(f => !f.season_id).length,
    [fines]
  );

  const seasonFines = useMemo(() => {
    if (activeSeasonId === UNASSIGNED) return fines.filter(f => !f.season_id);
    return fines.filter(f => f.season_id === activeSeasonId);
  }, [fines, activeSeasonId]);

  // Accumulation always spans every fine ever recorded, regardless of season
  const accumulatedTotal = useMemo(() => fines.reduce((s, f) => s + f.amount, 0), [fines]);
  const accumulatedUnpaid = useMemo(
    () => fines.filter(f => f.status === "unpaid").reduce((s, f) => s + f.amount, 0),
    [fines]
  );

  const filtered = useMemo(() => {
    let list = [...seasonFines];

    if (selectedEmployee) {
      list = list.filter((f) => f.employee_name === selectedEmployee);
    }

    if (statusFilter !== "all") {
      list = list.filter((f) => f.status === statusFilter);
    }

    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(
        (f) =>
          f.employee_name.toLowerCase().includes(q) ||
          f.date.includes(q) ||
          String(f.amount).includes(q)
      );
    }

    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "name") cmp = a.employee_name.localeCompare(b.employee_name);
      else if (sortField === "amount") cmp = a.amount - b.amount;
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });

    return list;
  }, [seasonFines, selectedEmployee, statusFilter, searchTerm, sortField, sortDir]);

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

  // Per-employee breakdown for the active season's bar chart
  const empData = useMemo(() => {
    return employees
      .filter(emp => emp.status !== "resigned" && emp.name !== "Sameer")
      .map((emp) => {
        const empFines = seasonFines.filter((f) => f.employee_name === emp.name);
        return {
          name: emp.name,
          paid: empFines.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0),
          unpaid: empFines.filter((f) => f.status === "unpaid").reduce((s, f) => s + f.amount, 0),
        };
      })
      .filter((e) => e.paid + e.unpaid > 0)
      .sort((a, b) => (b.paid + b.unpaid) - (a.paid + a.unpaid));
  }, [employees, seasonFines]);

  const maxTotal = Math.max(...empData.map((e) => e.paid + e.unpaid), 1);

  return (
    <div className="fine-page-container">
      <aside className="word-sidebar">
        <div className="sidebar-header">
          <h3 className="sidebar-title">💰 Fine Seasons</h3>
          {canManageSeasons && (
            <button className="btn-icon-add" onClick={onAddSeason} title="Add New Season">
              +
            </button>
          )}
        </div>
        <div className="season-list">
          {unassignedCount > 0 && (
            <div
              className={`season-item ${activeSeasonId === UNASSIGNED ? "active" : ""}`}
              onClick={() => setActiveSeasonId(UNASSIGNED)}
            >
              <span className="season-name">🗂️ Pre Fiscal Year Fines</span>
            </div>
          )}
          {fineSeasons.length === 0 ? (
            <div className="sidebar-empty">
              <p className="empty-msg">No seasons yet</p>
            </div>
          ) : (
            sortedSeasons.map((s) => (
              <div
                key={s.id}
                className={`season-item ${activeSeasonId === s.id ? "active" : ""}`}
                onClick={() => setActiveSeasonId(s.id)}
              >
                <span className="season-name">{s.title}</span>
                {canManageSeasons && (
                  <button
                    className="btn-edit-small action-icon"
                    style={{ background: "transparent", border: "none", cursor: "pointer", marginLeft: "auto", fontSize: "1rem" }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditSeason(s);
                    }}
                    title="Edit Season"
                  >
                    ✏️
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="fine-content-area">
        <div className="fine-season-summary">
          <span
            className="active-season-badge"
            style={{
              fontSize: "0.75rem",
              fontWeight: "700",
              textTransform: "uppercase",
              letterSpacing: "1px",
              color: "var(--accent, #00796b)",
              padding: "4px 8px",
              background: "rgba(0, 121, 107, 0.1)",
              borderRadius: "12px",
              width: "fit-content",
            }}
          >
            {activeSeasonId === UNASSIGNED ? "Pre Fiscal Year Fines" : activeSeason ? activeSeason.title : "Select a Season"}
          </span>
          <span className="accumulated-stat">
            Accumulated total (all seasons): Rs. {accumulatedTotal.toLocaleString()} · Rs. {accumulatedUnpaid.toLocaleString()} unpaid
          </span>
        </div>

        <div className="chart-container">
          <h3 className="section-title">
            Fines by Employee{activeSeason ? ` — ${activeSeason.title}` : activeSeasonId === UNASSIGNED ? " — Pre Fiscal Year Fines" : ""}
          </h3>
          {empData.length === 0 ? (
            <p className="empty-msg">No fines recorded in this season yet.</p>
          ) : (
            <div className="bar-chart">
              {empData.map((emp) => (
                <div key={emp.name} className="bar-row">
                  <span className="bar-label">{emp.name.split(" ")[0]}</span>
                  <div className="bar-track">
                    <div className="bar-fill bar-paid" style={{ width: `${(emp.paid / maxTotal) * 100}%` }}>
                      {emp.paid > 0 && <span className="bar-value">{emp.paid}</span>}
                    </div>
                    <div className="bar-fill bar-unpaid" style={{ width: `${(emp.unpaid / maxTotal) * 100}%` }}>
                      {emp.unpaid > 0 && <span className="bar-value">{emp.unpaid}</span>}
                    </div>
                  </div>
                  <span className="bar-total">Rs. {emp.paid + emp.unpaid}</span>
                </div>
              ))}
            </div>
          )}
          <div className="chart-legend">
            <span className="legend-item"><span className="legend-dot paid" /> Paid</span>
            <span className="legend-item"><span className="legend-dot unpaid" /> Unpaid</span>
          </div>
        </div>

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
              <button
                className="btn btn-primary"
                onClick={() => onAddFine(latestSeasonId)}
              >
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

            <div className="table-wrapper scrollable-table">
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
                            className={`status-badge ${f.status} ${!(isAdmin || isFineAdmin) ? "status-static" : ""}`}
                            onClick={() => (isAdmin || isFineAdmin) && window.confirm(`Mark as ${f.status === "paid" ? "unpaid" : "paid"}? ${f.employee_name} · Rs. ${f.amount}`) && toggleFineStatus(f.id)}
                            title={(isAdmin || isFineAdmin) ? "Click to toggle status" : ""}
                          >
                            {f.status}
                          </span>
                        </td>
                        <td>
                          {(isAdmin || isFineAdmin) && (
                            <div className="action-btns">
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => setEditingFine(f)}
                                title="Edit"
                              >
                                ✏️
                              </button>
                              <button
                                className="btn btn-sm btn-danger"
                                onClick={() => window.confirm(`Delete fine? ${f.employee_name} · Rs. ${f.amount}`) && deleteFine(f.id)}
                                title="Delete"
                              >
                                🗑
                              </button>
                            </div>
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

        <EditFineModal
          isOpen={!!editingFine}
          onClose={() => setEditingFine(null)}
          fine={editingFine}
        />
      </main>
    </div>
  );
}
