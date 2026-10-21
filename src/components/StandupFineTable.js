"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import EditStandupModal from "./EditStandupModal";
import StatsCard from "./StatsCard";
import Icon from "./Icon";
import Avatar from "./Avatar";
import { formatBs } from "@/lib/nepaliDate";
import { getNepalParts } from "@/lib/standupWindow";

const STATUS_FILTERS = [
  { id: "all", label: "All" },
  { id: "unpaid", label: "Pending" },
  { id: "paid", label: "Completed" },
];

const COLUMNS = [
  { field: "date", label: "Date" },
  { field: "employee_name", label: "Employee" },
];

const STATUS_LABEL = { paid: "Contribution complete", unpaid: "Pending contribution" };

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function formatDate(dateStr) {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function StandupFineTable({ selectedEmployee }) {
  const {
    standupFines: allStandupFines,
    standupSubmissions,
    employees,
    toggleStandupFineStatus,
    deleteStandupFine,
    canManageFines,
    animationsEnabled,
  } = useApp();
  const { confirmDialog } = useDialog();
  const standupFineExcludedNames = useMemo(
    () => new Set(employees.filter((e) => e.standup_fine_excluded).map((e) => e.name)),
    [employees]
  );
  const standupFines = useMemo(
    () => allStandupFines.filter((f) => !standupFineExcludedNames.has(f.employee_name)),
    [allStandupFines, standupFineExcludedNames]
  );
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all, paid, unpaid
  const [sortConfig, setSortConfig] = useState({ key: "date", direction: "desc" });
  const [thanks, setThanks] = useState(null); // { name, date } after a contribution is settled
  const [editingRecord, setEditingRecord] = useState(null);
  const thanksTimeoutRef = useRef(null);

  useEffect(() => () => clearTimeout(thanksTimeoutRef.current), []);

  const summary = useMemo(() => {
    let paid = 0;
    let unpaid = 0;
    for (const f of standupFines) {
      if (f.status === "paid") paid += 1;
      else if (f.status === "unpaid") unpaid += 1;
    }
    return { total: standupFines.length, paid, unpaid };
  }, [standupFines]);

  // Forms in today (Nepal date) out of the people standup fines apply to.
  const todayStr = getNepalParts(new Date()).dateStr;
  const submittedToday = useMemo(
    () => standupSubmissions.filter((s) => s.date === todayStr).length,
    [standupSubmissions, todayStr]
  );
  const expectedToday = useMemo(
    () => employees.filter((e) => e.status !== "resigned" && !e.standup_fine_excluded).length,
    [employees]
  );

  // Employee and search narrow the list; the status filter applies on top, so each
  // segment can show its own count.
  const searched = useMemo(() => {
    let list = standupFines;
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
    return list;
  }, [standupFines, selectedEmployee, search]);

  const statusCounts = useMemo(() => {
    const c = { all: searched.length, paid: 0, unpaid: 0 };
    for (const f of searched) if (f.status in c) c[f.status] += 1;
    return c;
  }, [searched]);

  const filteredFines = useMemo(() => {
    const list = filter === "all" ? [...searched] : searched.filter((f) => f.status === filter);
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
  }, [searched, filter, sortConfig]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "asc" ? "desc" : "asc",
    }));
  };

  const handleToggle = async (fine) => {
    const next = fine.status === "paid" ? "unpaid" : "paid";
    if (!(await confirmDialog(`Mark as ${next}? ${fine.employee_name} · ${fine.date}`))) return;
    if (fine.status === "unpaid") {
      setThanks({ name: fine.employee_name, date: fine.date });
      clearTimeout(thanksTimeoutRef.current);
      thanksTimeoutRef.current = setTimeout(() => setThanks(null), 3000);
    }
    await toggleStandupFineStatus(fine.id);
  };

  return (
    <>
      <div className="fine-page">
        <section className="fine-tiles" aria-label="Standup summary">
          <StatsCard
            label="Total instances"
            value={summary.total}
            sub="Missed standup forms"
            color="#3D63F0"
          />
          <StatsCard
            label="Pending"
            value={summary.unpaid}
            sub="Contributions still owed"
            color="#F5A524"
          />
          <StatsCard
            label="Completed"
            value={summary.paid}
            sub="Contributions settled"
            color="#22C55E"
          />
          <StatsCard
            label="Submitted today"
            value={`${submittedToday} / ${expectedToday}`}
            sub="Window closes 9:30 AM"
            color="#2DD4EF"
          />
        </section>

        <div className="fine-bottom">
          <section className="fine-records glass-card">
            <div className="fine-records-head">
              <div className="fine-records-heading">
                <h2 className="section-title">
                  Missing standup records
                  {selectedEmployee && <span className="pill pill-blue">{selectedEmployee}</span>}
                </h2>
                <span className="fine-records-sub">{plural(filteredFines.length, "instance")}</span>
              </div>
            </div>

            <div className="fine-toolbar">
              <label className="fine-search">
                <Icon name="search" size={16} strokeWidth={2} />
                <input
                  type="search"
                  aria-label="Search standup records"
                  placeholder="Search by name or date..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="status-tabs" role="group" aria-label="Filter by contribution status">
                {STATUS_FILTERS.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className={`tab ${filter === s.id ? "tab-active" : ""}`}
                    aria-pressed={filter === s.id}
                    onClick={() => setFilter(s.id)}
                  >
                    {s.label} <span className="tab-count mono">{statusCounts[s.id]}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="fine-table-scroll">
              <table className="data-table fine-table standup-table">
                <thead>
                  <tr>
                    {COLUMNS.map((c) => {
                      const sorted = sortConfig.key === c.field;
                      return (
                        <th
                          key={c.field}
                          scope="col"
                          aria-sort={sorted ? (sortConfig.direction === "asc" ? "ascending" : "descending") : undefined}
                        >
                          <button type="button" className={`fine-sort${sorted ? " is-sorted" : ""}`} onClick={() => handleSort(c.field)}>
                            {c.label}
                            {sorted && (
                              <Icon
                                name="chevron-down"
                                size={12}
                                strokeWidth={2.4}
                                className={sortConfig.direction === "asc" ? "fine-sort-asc" : ""}
                              />
                            )}
                          </button>
                        </th>
                      );
                    })}
                    <th scope="col">Status</th>
                    {canManageFines && <th scope="col" className="fine-num">Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredFines.length === 0 ? (
                    <tr>
                      <td colSpan={canManageFines ? 4 : 3} className="empty-row">No standup records found</td>
                    </tr>
                  ) : (
                    filteredFines.map((fine) => {
                      const dateLabel = formatDate(fine.date);
                      const bs = formatBs(fine.date);
                      const statusLabel = STATUS_LABEL[fine.status] || fine.status;
                      const nextStatus = fine.status === "paid" ? "unpaid" : "paid";
                      return (
                        <tr key={fine.id}>
                          <td>
                            <span className="fine-date">
                              <span className="mono">{dateLabel}</span>
                              {bs && <span className="fine-date-bs mono">{bs}</span>}
                            </span>
                          </td>
                          <td>
                            <span className="fine-emp">
                              <Avatar name={fine.employee_name} className="avatar" aria-hidden="true" />
                              <span className="fine-emp-name">{fine.employee_name}</span>
                            </span>
                          </td>
                          <td>
                            {canManageFines ? (
                              <button
                                type="button"
                                className={`status-badge ${fine.status}`}
                                onClick={() => handleToggle(fine)}
                                aria-label={`${statusLabel}: mark ${fine.employee_name}, ${dateLabel} as ${nextStatus}`}
                                title="Click to toggle status"
                              >
                                <span className="fine-status-dot" aria-hidden="true" />
                                {statusLabel}
                              </button>
                            ) : (
                              <span className={`status-badge ${fine.status} status-static`}>
                                <span className="fine-status-dot" aria-hidden="true" />
                                {statusLabel}
                              </span>
                            )}
                          </td>
                          {canManageFines && (
                            <td className="fine-num">
                              <span className="fine-actions">
                                <button
                                  type="button"
                                  className="btn-icon btn-sm"
                                  onClick={() => setEditingRecord(fine)}
                                  aria-label={`Edit standup record for ${fine.employee_name}, ${dateLabel}`}
                                  title="Edit"
                                >
                                  <Icon name="edit" size={15} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-icon btn-sm fine-delete"
                                  onClick={async () => {
                                    if (await confirmDialog(`Delete record? ${fine.employee_name} · ${fine.date}`, { danger: true })) deleteStandupFine(fine.id);
                                  }}
                                  aria-label={`Delete standup record for ${fine.employee_name}, ${dateLabel}`}
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
        </div>
      </div>

      {/* Outside .fine-page: its container query box must not anchor this fixed card. */}
      {thanks && (
        <section
          className={`standup-thanks${animationsEnabled !== false ? " standup-thanks-enter" : ""}`}
          role="status"
          aria-label="Latest contribution"
        >
          <span className="standup-thanks-icon">
            <Icon name="sparkles" size={20} strokeWidth={2} />
          </span>
          <span className="standup-thanks-text">
            <span className="standup-thanks-title">Thanks for the party, {thanks.name.split(" ")[0]}!</span>
            <span className="standup-thanks-sub">
              {thanks.name} settled the standup contribution · <span className="mono">{formatDate(thanks.date)}</span>
            </span>
          </span>
        </section>
      )}

      <EditStandupModal
        isOpen={!!editingRecord}
        onClose={() => setEditingRecord(null)}
        record={editingRecord}
      />
    </>
  );
}
