"use client";

import { useApp } from "@/context/AppContext";
import StatsCard from "./StatsCard";

export default function Dashboard() {
  const { fines, standupFines, employees } = useApp();

  // Late Fines
  const totalAmount = fines.reduce((s, f) => s + f.amount, 0);
  const paidAmount = fines
    .filter((f) => f.status === "paid")
    .reduce((s, f) => s + f.amount, 0);
  const unpaidAmount = fines
    .filter((f) => f.status === "unpaid")
    .reduce((s, f) => s + f.amount, 0);

  // Standup Fines
  const standupUnpaid = standupFines.filter((f) => f.status === "unpaid");

  // Per-employee breakdown for bar chart
  const empData = employees.map((emp) => {
    const empFines = fines.filter((f) => f.employee_name === emp.name);
    return {
      name: emp.name,
      paid: empFines.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0),
      unpaid: empFines.filter((f) => f.status === "unpaid").reduce((s, f) => s + f.amount, 0),
    };
  }).sort((a, b) => (b.paid + b.unpaid) - (a.paid + a.unpaid));

  const maxTotal = Math.max(...empData.map((e) => e.paid + e.unpaid), 1);

  return (
    <section className="dashboard">
      <div className="stats-grid">
        <StatsCard
          icon="💰"
          label="Late Fines"
          value={`Rs. ${totalAmount.toLocaleString()}`}
          sub={`${fines.length} records`}
          color="#6366f1"
        />
        <StatsCard
          icon="📝"
          label="Standup Records"
          value={standupFines.length}
          sub={`${standupUnpaid.length} pending`}
          color="#f43f5e"
        />
        <StatsCard
          icon="⏳"
          label="Unpaid Fines"
          value={`Rs. ${unpaidAmount.toLocaleString()}`}
          sub={`${fines.filter(f => f.status === 'unpaid').length} late entries`}
          color="#ef4444"
        />
        <StatsCard
          icon="👥"
          label="Employees"
          value={employees.length}
          sub="active"
          color="#f59e0b"
        />
      </div>

      <div className="chart-container">
        <h3 className="section-title">Fines by Employee</h3>
        <div className="bar-chart">
          {empData.map((emp) => (
            <div key={emp.name} className="bar-row">
              <span className="bar-label">{emp.name.split(' ')[0]}</span>
              <div className="bar-track">
                <div
                  className="bar-fill bar-paid"
                  style={{ width: `${(emp.paid / maxTotal) * 100}%` }}
                >
                  {emp.paid > 0 && <span className="bar-value">{emp.paid}</span>}
                </div>
                <div
                  className="bar-fill bar-unpaid"
                  style={{ width: `${(emp.unpaid / maxTotal) * 100}%` }}
                >
                  {emp.unpaid > 0 && <span className="bar-value">{emp.unpaid}</span>}
                </div>
              </div>
              <span className="bar-total">Rs. {emp.paid + emp.unpaid}</span>
            </div>
          ))}
        </div>
        <div className="chart-legend">
          <span className="legend-item"><span className="legend-dot paid" /> Paid</span>
          <span className="legend-item"><span className="legend-dot unpaid" /> Unpaid</span>
        </div>
      </div>
    </section>
  );
}
