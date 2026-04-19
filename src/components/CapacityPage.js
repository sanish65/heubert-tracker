"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";

export default function CapacityPage() {
  const { employees, calculateCapacity, publicHolidays, isAdmin } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM

  // Date Logic
  const periods = useMemo(() => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    
    return [
      {
        name: "Period 1 (1st - 14th)",
        start: `${selectedMonth}-01`,
        end: `${selectedMonth}-14`
      },
      {
        name: `Period 2 (15th - ${lastDay}th)`,
        start: `${selectedMonth}-15`,
        end: `${selectedMonth}-${lastDay}`
      }
    ];
  }, [selectedMonth]);

  // Filter out Samir
  const filteredEmployees = useMemo(() => {
    return employees.filter(e => 
      e.work_email?.toLowerCase() !== 'samir@heubert.com' && 
      e.status === 'active'
    );
  }, [employees]);

  const capacityData = useMemo(() => {
    return filteredEmployees.map(emp => {
      const p1 = calculateCapacity(emp.name, periods[0].start, periods[0].end);
      const p2 = calculateCapacity(emp.name, periods[1].start, periods[1].end);
      return {
        name: emp.name,
        p1,
        p2,
        total: p1 + p2
      };
    });
  }, [filteredEmployees, calculateCapacity, periods]);

  // Max capacity for scaling graphs
  const maxCap = Math.max(...capacityData.map(d => Math.max(d.p1, d.p2)), 84); // 14 days * 6hrs = 84 max

  return (
    <div className="capacity-container">
      <header className="section-header-compact">
        <h2>🏗️ Team Working Capacity</h2>
        <div className="header-controls">
          <input 
            type="month" 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="input-premium"
          />
        </div>
      </header>

      <div className="capacity-grid">
        {/* Summary Table */}
        <section className="capacity-card">
          <h3 className="card-title">Monthly Detailed View</h3>
          <div className="table-responsive">
            <table className="fine-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>{periods[0].name}</th>
                  <th>{periods[1].name}</th>
                  <th>Total Monthly</th>
                </tr>
              </thead>
              <tbody>
                {capacityData.map(d => (
                  <tr key={d.name}>
                    <td className="font-bold">{d.name}</td>
                    <td><span className="capacity-value">{d.p1} hrs</span></td>
                    <td><span className="capacity-value">{d.p2} hrs</span></td>
                    <td><span className="capacity-total">{d.total} hrs</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* Visualization */}
        <section className="capacity-card visualization-card">
          <h3 className="card-title">Capacity Visualization</h3>
          <div className="graph-area">
            {capacityData.map(d => (
              <div key={d.name} className="graph-row">
                <div className="graph-label">{d.name}</div>
                <div className="graph-bars">
                  <div className="bar-wrapper">
                    <div 
                      className="bar p1-bar" 
                      style={{ width: `${(d.p1 / maxCap) * 100}%` }}
                      title={`P1: ${d.p1} hrs`}
                    >
                      <span className="bar-val">{d.p1}</span>
                    </div>
                  </div>
                  <div className="bar-wrapper">
                    <div 
                      className="bar p2-bar" 
                      style={{ width: `${(d.p2 / maxCap) * 100}%` }}
                      title={`P2: ${d.p2} hrs`}
                    >
                      <span className="bar-val">{d.p2}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="graph-legend">
              <span className="legend-item"><span className="legend-box p1-bar"></span> Period 1</span>
              <span className="legend-item"><span className="legend-box p2-bar"></span> Period 2</span>
            </div>
          </div>
        </section>
      </div>

      {/* Holiday Section moved to bottom of capacity or separate */}
      <section className="capacity-card full-width">
        <div className="flex-between">
          <h3 className="card-title">🌴 Public Holidays in {selectedMonth}</h3>
        </div>
        <div className="holiday-badges">
          {publicHolidays
            .filter(h => h.date.startsWith(selectedMonth))
            .map(h => (
              <div key={h.id} className="holiday-badge">
                <span className="h-date">{new Date(h.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}</span>
                <span className="h-title">{h.title}</span>
              </div>
            ))
          }
          {publicHolidays.filter(h => h.date.startsWith(selectedMonth)).length === 0 && (
            <p className="empty-msg">No holidays recorded for this month.</p>
          )}
        </div>
      </section>
    </div>
  );
}
