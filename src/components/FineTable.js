"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import WithdrawalLog from "./WithdrawalLog";
import EditFineModal from "./EditFineModal";
import { ModalPortal } from "./Modal";
import StatsCard from "./StatsCard";
import Icon from "./Icon";
import Avatar from "./Avatar";
import { formatBs } from "@/lib/nepaliDate";

const UNASSIGNED = "unassigned";
const PRE_FY_LABEL = "Pre Fiscal Year Fines";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "unpaid", label: "Unpaid" },
  { id: "paid", label: "Paid" },
];

const COLUMNS = [
  { field: "name", label: "Employee" },
  { field: "date", label: "Date" },
  { field: "amount", label: "Amount", numeric: true },
  { field: "status", label: "Status" },
];

const rs = (n) => `Rs. ${n.toLocaleString()}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    weekday: "short",
  });
}

export default function FineTable({ selectedEmployee, initialSeasonId, onWithdraw, onAddSeason, onEditSeason }) {
  const { fines: allFines, fineSeasons, employees, withdrawals, toggleFineStatus, deleteFine, canManageFines } = useApp();
  const { confirmDialog } = useDialog();
  const lateFineExcludedNames = useMemo(
    () => new Set(employees.filter((e) => e.late_fine_excluded).map((e) => e.name)),
    [employees]
  );
  const fines = useMemo(
    () => allFines.filter((f) => !lateFineExcludedNames.has(f.employee_name)),
    [allFines, lateFineExcludedNames]
  );
  const canManageSeasons = canManageFines;

  // null = follow the latest season. initialSeasonId (from a bell row): that fine's season, null for none.
  const [pickedSeasonId, setPickedSeasonId] = useState(
    initialSeasonId === undefined ? null : initialSeasonId ?? UNASSIGNED
  );
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

  // Totals per season in one pass: the rail's meta lines and the all-seasons foot.
  const seasonStats = useMemo(() => {
    const bySeason = new Map();
    let total = 0;
    let unpaid = 0;
    for (const f of fines) {
      const key = f.season_id || UNASSIGNED;
      const s = bySeason.get(key) || { total: 0, count: 0 };
      s.total += f.amount;
      s.count += 1;
      bySeason.set(key, s);
      total += f.amount;
      if (f.status === "unpaid") unpaid += f.amount;
    }
    return { bySeason, total, unpaid };
  }, [fines]);

  const unassignedStats = seasonStats.bySeason.get(UNASSIGNED);
  const unassignedCount = unassignedStats?.count ?? 0;

  // Until a season is picked, show the latest one (or the pre-fiscal-year bucket when
  // there are no seasons yet).
  const activeSeasonId = pickedSeasonId ?? latestSeasonId ?? (unassignedCount > 0 ? UNASSIGNED : null);
  const activeSeason = activeSeasonId === UNASSIGNED
    ? null
    : fineSeasons.find((s) => s.id === activeSeasonId);
  const seasonLabel = activeSeasonId === UNASSIGNED ? PRE_FY_LABEL : activeSeason ? activeSeason.title : "Select a season";

  const seasonFines = useMemo(() => {
    if (activeSeasonId === UNASSIGNED) return fines.filter((f) => !f.season_id);
    return fines.filter((f) => f.season_id === activeSeasonId);
  }, [fines, activeSeasonId]);

  const seasonSummary = useMemo(() => {
    const s = { total: 0, paid: 0, unpaid: 0, paidCount: 0, unpaidCount: 0 };
    for (const f of seasonFines) {
      s.total += f.amount;
      if (f.status === "paid") { s.paid += f.amount; s.paidCount += 1; }
      else if (f.status === "unpaid") { s.unpaid += f.amount; s.unpaidCount += 1; }
    }
    return s;
  }, [seasonFines]);

  // The jar holds every paid fine, so these match the Dashboard's collected/remaining.
  const totalWithdrawn = useMemo(() => withdrawals.reduce((s, w) => s + w.amount, 0), [withdrawals]);
  const jarCollected = useMemo(
    () => allFines.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0),
    [allFines]
  );
  const jarRemaining = Math.max(jarCollected - totalWithdrawn, 0);

  // Employee and search narrow the list; the status filter applies on top, so each
  // segment can show its own count.
  const searched = useMemo(() => {
    let list = seasonFines;
    if (selectedEmployee) {
      list = list.filter((f) => f.employee_name === selectedEmployee);
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
    return list;
  }, [seasonFines, selectedEmployee, searchTerm]);

  const statusCounts = useMemo(() => {
    const c = { all: searched.length, paid: 0, unpaid: 0 };
    for (const f of searched) if (f.status in c) c[f.status] += 1;
    return c;
  }, [searched]);

  const filtered = useMemo(() => {
    const list = statusFilter === "all" ? [...searched] : searched.filter((f) => f.status === statusFilter);
    list.sort((a, b) => {
      let cmp = 0;
      if (sortField === "date") cmp = a.date.localeCompare(b.date);
      else if (sortField === "name") cmp = a.employee_name.localeCompare(b.employee_name);
      else if (sortField === "amount") cmp = a.amount - b.amount;
      else if (sortField === "status") cmp = a.status.localeCompare(b.status);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [searched, statusFilter, sortField, sortDir]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const totalFiltered = filtered.reduce((s, f) => s + f.amount, 0);

  // Per-employee breakdown for the active season's bar chart
  const empData = useMemo(() => {
    const byName = new Map();
    for (const f of seasonFines) {
      const e = byName.get(f.employee_name) || { paid: 0, unpaid: 0 };
      if (f.status === "paid") e.paid += f.amount;
      else if (f.status === "unpaid") e.unpaid += f.amount;
      byName.set(f.employee_name, e);
    }
    return employees
      .filter((emp) => emp.status !== "resigned" && !emp.late_fine_excluded)
      .map((emp) => ({ name: emp.name, ...(byName.get(emp.name) || { paid: 0, unpaid: 0 }) }))
      .filter((e) => e.paid + e.unpaid > 0)
      .sort((a, b) => (b.paid + b.unpaid) - (a.paid + a.unpaid));
  }, [employees, seasonFines]);

  const maxTotal = Math.max(...empData.map((e) => e.paid + e.unpaid), 1);

  const seasonMeta = (key) => {
    const s = seasonStats.bySeason.get(key);
    return s ? `${rs(s.total)} · ${plural(s.count, "fine")}` : "No fines yet";
  };

  return (
    <div className="fine-page">
      <div className="fine-top">
        <nav className="fine-rail glass" aria-label="Fine seasons">
          <div className="fine-rail-head">
            <h2 className="section-title">Fine seasons</h2>
            {canManageSeasons && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onAddSeason}>
                <Icon name="plus" size={14} strokeWidth={2.2} /> New season
              </button>
            )}
          </div>

          <div className="fine-rail-list">
            {unassignedCount > 0 && (
              <>
                <div className={`fine-season${activeSeasonId === UNASSIGNED ? " is-active" : ""}`}>
                  <button
                    type="button"
                    className="fine-season-btn"
                    aria-pressed={activeSeasonId === UNASSIGNED}
                    onClick={() => setPickedSeasonId(UNASSIGNED)}
                  >
                    <span className="fine-season-icon"><Icon name="folder" size={16} /></span>
                    <span className="fine-season-text">
                      <span className="fine-season-title">{PRE_FY_LABEL}</span>
                      <span className="fine-season-meta mono">{seasonMeta(UNASSIGNED)}</span>
                    </span>
                  </button>
                </div>
                <div className="fine-rail-divider" aria-hidden="true" />
              </>
            )}
            {fineSeasons.length === 0 ? (
              <p className="empty-msg">No seasons yet</p>
            ) : (
              sortedSeasons.map((s) => {
                const isActive = activeSeasonId === s.id;
                return (
                  <div key={s.id} className={`fine-season${isActive ? " is-active" : ""}`}>
                    <button
                      type="button"
                      className="fine-season-btn"
                      aria-pressed={isActive}
                      onClick={() => setPickedSeasonId(s.id)}
                    >
                      <span className="fine-season-icon"><Icon name="calendar" size={16} /></span>
                      <span className="fine-season-text">
                        <span className="fine-season-title">
                          <span className="fine-season-name">{s.title}</span>
                          {s.id === latestSeasonId && <span className="pill pill-cyan">Current</span>}
                        </span>
                        <span className="fine-season-meta mono">{seasonMeta(s.id)}</span>
                      </span>
                    </button>
                    {canManageSeasons && (
                      <button
                        type="button"
                        className="btn-icon btn-sm fine-season-edit"
                        onClick={() => onEditSeason(s)}
                        aria-label={`Edit season ${s.title}`}
                        title="Edit season"
                      >
                        <Icon name="edit" size={15} />
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <div className="fine-rail-foot">
            <span className="eyebrow">All seasons</span>
            <span className="fine-rail-total mono">{rs(seasonStats.total)}</span>
            <span className="fine-rail-note">
              Accumulated total · <span className="fine-rail-unpaid">{rs(seasonStats.unpaid)} unpaid</span>
            </span>
          </div>
        </nav>

        <div className="fine-main">
          <section className="fine-tiles" aria-label="Season summary">
            <StatsCard
              label="Total"
              value={rs(seasonSummary.total)}
              sub={`${plural(seasonFines.length, "fine")} this season`}
              color="#3D63F0"
            />
            <StatsCard
              label="Paid"
              value={rs(seasonSummary.paid)}
              sub={`${plural(seasonSummary.paidCount, "fine")} settled`}
              color="#22C55E"
            />
            <StatsCard
              label="Unpaid"
              value={rs(seasonSummary.unpaid)}
              sub={`${plural(seasonSummary.unpaidCount, "fine")} open`}
              color="#F5A524"
            />
            <StatsCard
              label="Withdrawn"
              value={rs(totalWithdrawn)}
              sub={plural(withdrawals.length, "withdrawal")}
              color="#A78BFA"
            />
            <StatsCard
              label="Remaining"
              value={rs(jarRemaining)}
              sub="Paid minus withdrawn"
              color="#2DD4EF"
            />
          </section>

          <section className="dash-chart glass-card fine-chart">
            <div className="dash-chart-head">
              <div className="dash-chart-heading">
                <h2 className="section-title">Fines by employee</h2>
                <span className="dash-subtitle">{seasonLabel} · paid and unpaid, highest first</span>
              </div>
              <div className="dash-legend">
                <span className="dash-legend-item"><span className="dash-legend-swatch paid" aria-hidden="true" />Paid</span>
                <span className="dash-legend-item"><span className="dash-legend-swatch unpaid" aria-hidden="true" />Unpaid</span>
              </div>
            </div>
            {empData.length === 0 ? (
              <p className="empty-msg">No fines recorded in this season yet.</p>
            ) : (
              <div className="dash-bars">
                {empData.map((emp) => (
                  <div key={emp.name} className="dash-bar-row">
                    <span className="dash-bar-name">{emp.name.split(" ")[0]}</span>
                    <div className="bar-track" title={`${emp.name}: ${rs(emp.paid)} paid, ${rs(emp.unpaid)} unpaid`}>
                      <div className="bar-fill bar-paid" style={{ width: `${(emp.paid / maxTotal) * 100}%` }} />
                      <div className="bar-fill bar-unpaid" style={{ width: `${(emp.unpaid / maxTotal) * 100}%` }} />
                    </div>
                    <span className="dash-bar-total mono">{rs(emp.paid + emp.unpaid)}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      <div className="fine-bottom">
        <section className="fine-records glass-card">
          <div className="fine-records-head">
            <div className="fine-records-heading">
              <h2 className="section-title">
                Fine records
                {selectedEmployee && <span className="pill pill-blue">{selectedEmployee}</span>}
              </h2>
              <span className="fine-records-sub">
                {plural(filtered.length, "record")} · {rs(totalFiltered)} · {seasonLabel}
              </span>
            </div>
          </div>

          <div className="fine-toolbar">
            <label className="fine-search">
              <Icon name="search" size={16} strokeWidth={2} />
              <input
                type="search"
                aria-label="Search fine records"
                placeholder="Search by name, date, amount..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>
            <div className="status-tabs" role="group" aria-label="Filter by status">
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`tab ${statusFilter === s.id ? "tab-active" : ""}`}
                  aria-pressed={statusFilter === s.id}
                  onClick={() => setStatusFilter(s.id)}
                >
                  {s.label} <span className="tab-count mono">{statusCounts[s.id]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="fine-table-scroll">
            <table className="data-table fine-table">
              <thead>
                <tr>
                  {COLUMNS.map((c) => {
                    const sorted = sortField === c.field;
                    return (
                      <th
                        key={c.field}
                        scope="col"
                        className={c.numeric ? "fine-num" : undefined}
                        aria-sort={sorted ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                      >
                        <button type="button" className={`fine-sort${sorted ? " is-sorted" : ""}`} onClick={() => handleSort(c.field)}>
                          {c.label}
                          {sorted && (
                            <Icon
                              name="chevron-down"
                              size={12}
                              strokeWidth={2.4}
                              className={sortDir === "asc" ? "fine-sort-asc" : ""}
                            />
                          )}
                        </button>
                      </th>
                    );
                  })}
                  {canManageFines && <th scope="col" className="fine-num">Actions</th>}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={canManageFines ? 5 : 4} className="empty-row">
                      No records found
                    </td>
                  </tr>
                ) : (
                  filtered.map((f) => {
                    const dateLabel = formatDate(f.date);
                    const bs = formatBs(f.date);
                    const nextStatus = f.status === "paid" ? "unpaid" : "paid";
                    return (
                      <tr key={f.id}>
                        <td>
                          <span className="fine-emp">
                            <Avatar name={f.employee_name} className="avatar" aria-hidden="true" />
                            <span className="fine-emp-name">{f.employee_name}</span>
                          </span>
                        </td>
                        <td>
                          <span className="fine-date">
                            <span className="mono">{dateLabel}</span>
                            {bs && <span className="fine-date-bs mono">{bs}</span>}
                          </span>
                        </td>
                        <td className="amount-cell fine-num">{rs(f.amount)}</td>
                        <td>
                          {canManageFines ? (
                            <button
                              type="button"
                              className={`status-badge ${f.status}`}
                              onClick={async () => {
                                if (await confirmDialog(`Mark as ${nextStatus}? ${f.employee_name} · Rs. ${f.amount}`)) toggleFineStatus(f.id);
                              }}
                              aria-label={`${f.status}: mark ${f.employee_name}, ${dateLabel} as ${nextStatus}`}
                              title="Click to toggle status"
                            >
                              <span className="fine-status-dot" aria-hidden="true" />
                              {f.status}
                            </button>
                          ) : (
                            <span className={`status-badge ${f.status} status-static`}>
                              <span className="fine-status-dot" aria-hidden="true" />
                              {f.status}
                            </span>
                          )}
                        </td>
                        {canManageFines && (
                          <td className="fine-num">
                            <span className="fine-actions">
                              <button
                                type="button"
                                className="btn-icon btn-sm"
                                onClick={() => setEditingFine(f)}
                                aria-label={`Edit fine for ${f.employee_name}, ${dateLabel}`}
                                title="Edit"
                              >
                                <Icon name="edit" size={15} />
                              </button>
                              <button
                                type="button"
                                className="btn-icon btn-sm fine-delete"
                                onClick={async () => {
                                  if (await confirmDialog(`Delete fine? ${f.employee_name} · Rs. ${f.amount}`, { danger: true })) deleteFine(f.id);
                                }}
                                aria-label={`Delete fine for ${f.employee_name}, ${dateLabel}`}
                                title="Delete"
                              >
                                <Icon name="trash" size={15} />
                              </button>
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <WithdrawalLog
          onWithdraw={onWithdraw}
          collected={jarCollected}
          withdrawn={totalWithdrawn}
          remaining={jarRemaining}
        />
      </div>

      {/* .fine-page is a size container, which would anchor this fixed dialog. */}
      <ModalPortal>
        <EditFineModal
          isOpen={!!editingFine}
          onClose={() => setEditingFine(null)}
          fine={editingFine}
        />
      </ModalPortal>
    </div>
  );
}
