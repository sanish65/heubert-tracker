"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";

export default function CapacityPage() {
  const { employees, calculateCapacity, publicHolidays, isAdmin, leaves, sprints, activeSprint, addSprint } = useApp();
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [showSprintModal, setShowSprintModal] = useState(false);

  // Sprint or Month Logic
  const sprintRange = useMemo(() => {
    if (activeSprint) {
      return {
        start: activeSprint.start_date,
        end: activeSprint.end_date,
        title: activeSprint.title || "Active Sprint"
      };
    }
    // Fallback to month if no sprint
    const [year, month] = selectedMonth.split('-').map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    return {
      start: `${selectedMonth}-01`,
      end: `${selectedMonth}-${lastDay}`,
      title: `Month: ${selectedMonth}`
    };
  }, [activeSprint, selectedMonth]);

  const periods = useMemo(() => {
    if (activeSprint) {
      return [{
        name: activeSprint.title || "Current Sprint",
        start: activeSprint.start_date,
        end: activeSprint.end_date
      }];
    }
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
  }, [selectedMonth, activeSprint]);

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
      const p2 = periods[1] ? calculateCapacity(emp.name, periods[1].start, periods[1].end) : 0;
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
    <div className="capacity-container page-fade-in">
      <div className="under-construction-banner">
        <span className="banner-icon">🚧</span>
        <div className="banner-content">
            <strong>PLANNER UNDER CONSTRUCTION</strong>
            <p>We are currently fine-tuning the resource allocation engine. Some data may shift slightly during live updates.</p>
        </div>
      </div>

      <header className="capacity-header-premium">
        <div className="header-main">
          <div className="header-info">
            <h2 className="capacity-title">🏗️ Team Working Capacity</h2>
            <p className="capacity-subtitle">Real-time capacity tracking & resource visualization</p>
          </div>
          <div className="header-controls-wrapper">
            <div className={`period-indicator-badge ${new Date().toISOString().slice(0, 7) === selectedMonth ? 'active' : ''}`}>
              {new Date().toISOString().slice(0, 7) === selectedMonth ? 'Current Month' : 'Historical View'}
            </div>
            <div className="header-actions">
              {isAdmin && (
                <button className="btn btn-warning btn-sm" onClick={() => setShowSprintModal(true)}>
                   🎯 Plan New Sprint
                </button>
              )}
              <div className="month-picker-premium">
                <label htmlFor="month-select" className="picker-label">Select Month</label>
                <input 
                  id="month-select"
                  type="month" 
                  value={selectedMonth} 
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="input-premium-styled"
                />
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="capacity-view-grid">
        {/* Summary Table */}
        <section className="capacity-card-premium">
          <div className="card-header-styled">
            <div className="card-title-group">
              <h3 className="card-title-lg">Monthly Detailed View</h3>
              <p className="card-subtitle-sm">Breakdown of net working hours per period</p>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => window.print()}>
              📥 Export Report
            </button>
          </div>
          <div className="table-responsive-premium">
            <table className="capacity-table-styled">
              <thead>
                <tr>
                  <th>Employee</th>
                  {periods.map(p => (
                    <th key={p.name}>{p.name}</th>
                  ))}
                  <th className="text-right">Total Capacity</th>
                </tr>
              </thead>
              <tbody>
                {capacityData.map(d => {
                    const totalRatio = d.total / 100; // Adjusted for sprint
                    const statusColor = totalRatio > 0.8 ? 'high' : totalRatio > 0.5 ? 'mid' : 'low';
                    return (
                        <tr key={d.name} className="interactive-row">
                            <td>
                                <div className="emp-info-td">
                                    <span className="emp-avatar-sm">{d.name.charAt(0)}</span>
                                    <span className="emp-name-bold">{d.name}</span>
                                </div>
                            </td>
                            <td>
                                <div className="capacity-stat-cell">
                                    <span className="hour-val">{d.p1}</span>
                                    <span className="hour-unit">hrs</span>
                                </div>
                            </td>
                            {periods[1] && (
                             <td>
                                 <div className="capacity-stat-cell">
                                     <span className="hour-val">{d.p2}</span>
                                     <span className="hour-unit">hrs</span>
                                 </div>
                             </td>
                            )}
                            <td className="text-right">
                                <div className={`total-capacity-badge badge-${statusColor}`}>
                                    {d.total} hrs
                                </div>
                            </td>
                        </tr>
                    );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Gantt Chart Visualization */}
        <section className="capacity-card-premium full-width">
          <div className="card-header-styled">
            <h3 className="card-title-lg">Timeline Visualization: {sprintRange.title}</h3>
            <div className="gantt-legend-premium">
                <div className="legend-item-styled"><span className="dot dot-working"></span> Working</div>
                <div className="legend-item-styled"><span className="dot dot-leave"></span> Leave</div>
                <div className="legend-item-styled"><span className="dot dot-holiday"></span> Holiday</div>
                <div className="legend-item-styled"><span className="dot dot-weekend"></span> Weekend</div>
            </div>
          </div>
          <div className="gantt-wrapper">
            <div className="gantt-container">
              <div className="gantt-header">
                <div className="gantt-row-label sticky-col">Employee</div>
                <div className="gantt-days">
                  {(() => {
                    const days = [];
                    const start = new Date(sprintRange.start);
                    const end = new Date(sprintRange.end);
                    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                      const day = d.getDate();
                      const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                      days.push(
                        <div key={d.toISOString()} className={`gantt-day-head ${isWeekend ? 'weekend-head' : ''}`}>
                          {day}
                        </div>
                      );
                    }
                    return days;
                  })()}
                </div>
              </div>
              <div className="gantt-body">
                {filteredEmployees.map(emp => (
                  <div key={emp.name} className="gantt-row">
                    <div className="gantt-row-label sticky-col">
                      <span className="emp-avatar-sm">{emp.name.charAt(0)}</span>
                      {emp.name.split(' ')[0]}
                    </div>
                    <div className="gantt-days">
                      {(() => {
                        const dayCells = [];
                        const start = new Date(sprintRange.start);
                        const end = new Date(sprintRange.end);
                        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                          const dateStr = d.toISOString().split('T')[0];
                          const dayOfWeek = d.getDay();
                          const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                          const isHoliday = publicHolidays.some(h => h.date === dateStr);
                          const holidayTitle = publicHolidays.find(h => h.date === dateStr)?.title;
                          
                          const leaveMatch = leaves.find(l => 
                            l.employee_name === emp.name && 
                            dateStr >= l.start_date && 
                            dateStr <= l.end_date
                          );

                          let status = 'working';
                          let title = `Working: ${dayOfWeek === 5 ? 5 : 6} hrs`;

                          if (isWeekend) {
                            status = 'weekend';
                            title = 'Weekend';
                          } else if (isHoliday) {
                            status = 'holiday';
                            title = `Holiday: ${holidayTitle}`;
                          } else if (leaveMatch) {
                            status = 'leave';
                            title = `Leave: ${leaveMatch.reason || leaveMatch.type}`;
                          }

                          dayCells.push(
                            <div 
                              key={d.toISOString()} 
                              className={`gantt-day-cell status-${status}`} 
                              title={`${emp.name} | ${d.toLocaleDateString()} | ${title}`}
                            />
                          );
                        }
                        return dayCells;
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Holiday Section moved to bottom of capacity or separate */}
      <section className="capacity-card-premium full-width mt-8">
        <div className="flex-between">
          <h3 className="card-title-lg">🌴 Public Holidays in {selectedMonth}</h3>
        </div>
        <div className="holiday-badges-premium">
          {publicHolidays
            .filter(h => h.date.startsWith(selectedMonth))
            .map(h => (
              <div key={h.id} className="holiday-badge-premium">
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

      {showSprintModal && (
        <SprintPlanningModal 
          onClose={() => setShowSprintModal(false)}
          addSprint={addSprint}
        />
      )}
    </div>
  );
}

function SprintPlanningModal({ onClose, addSprint }) {
  const [startDate, setStartDate] = useState("");
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!startDate || !title) return;
    setIsSubmitting(true);
    await addSprint(startDate, title);
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🎯 Plan New 10-Day Sprint</h3>
        </div>
        <form onSubmit={handleSubmit} className="premium-form">
          <div className="form-group-interactive">
             <label>Sprint Title</label>
             <input 
               type="text" 
               placeholder="e.g., Sprint 24.1" 
               value={title} 
               onChange={e => setTitle(e.target.value)}
               required
             />
          </div>
          <div className="form-group-interactive">
            <label>Start Date (Monday Recommended)</label>
            <input 
              type="date" 
              value={startDate} 
              onChange={e => setStartDate(e.target.value)} 
              required
            />
            <p className="form-hint">The end date will be automatically set to the 10th working day (2 weeks).</p>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-warning" disabled={isSubmitting}>
              {isSubmitting ? "Planning..." : "Activate Sprint"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
