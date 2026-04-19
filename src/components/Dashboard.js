import { useState } from "react";
import { useApp } from "@/context/AppContext";
import StatsCard from "./StatsCard";

export default function Dashboard() {
  const { fines, standupFines, employees, leaves, withdrawals } = useApp();
  const [sendingWish, setSendingWish] = useState(null); // empId

  // Late Fines
  const totalAmount = fines.reduce((s, f) => s + f.amount, 0);
  const paidAmount = fines
    .filter((f) => f.status === "paid")
    .reduce((s, f) => s + f.amount, 0);
  const unpaidAmount = fines
    .filter((f) => f.status === "unpaid")
    .reduce((s, f) => s + f.amount, 0);

  // Withdrawals
  const totalWithdrawn = withdrawals.reduce((s, w) => s + w.amount, 0);
  const remaining = paidAmount - totalWithdrawn;

  // Standup Fines
  const standupUnpaid = standupFines.filter((f) => f.status === "unpaid");

  // Upcoming Leaves
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const upcomingLeaves = leaves
    .filter((l) => l.end_date >= todayStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 5);

  // Celebrations: Birthdays and Anniversaries
  const currentMonth = today.getMonth(); // 0-11
  const celebrations = employees.flatMap(emp => {
    const list = [];
    if (emp.dob) {
      const bday = new Date(emp.dob);
      if (bday.getMonth() === currentMonth) {
        list.push({ 
          type: 'birthday', 
          date: `${bday.toLocaleString('default', { month: 'short' })} ${bday.getDate()}`,
          name: emp.name,
          email: emp.work_email || emp.personal_email,
          empName: emp.name,
          isToday: bday.getDate() === today.getDate() && bday.getMonth() === today.getMonth()
        });
      }
    }
    if (emp.joined_date) {
      const jday = new Date(emp.joined_date);
      if (jday.getMonth() === currentMonth) {
        const years = today.getFullYear() - jday.getFullYear();
        if (years > 0) {
          list.push({ 
            type: 'anniversary', 
            date: `${jday.toLocaleString('default', { month: 'short' })} ${jday.getDate()}`,
            name: `${years} Year${years > 1 ? 's' : ''} at Heubert!`,
            empName: emp.name,
            isToday: jday.getDate() === today.getDate() && jday.getMonth() === today.getMonth()
          });
        }
      }
    }
    return list;
  }).sort((a, b) => {
    const dayA = parseInt(a.date.split(' ')[1]);
    const dayB = parseInt(b.date.split(' ')[1]);
    return dayA - dayB;
  });

  const handleWish = async (celebration) => {
    setSendingWish(celebration.empName);
    try {
      const res = await fetch('/api/send-wish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: celebration.email, 
          name: celebration.empName 
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(`✨ Birthday wish sent to ${celebration.empName}!`);
      } else {
        alert(`❌ Error: ${data.error || 'Failed to send wish'}`);
      }
    } catch (err) {
      alert("💥 System error while sending email.");
    } finally {
      setSendingWish(null);
    }
  };

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
        <StatsCard
          icon="💸"
          label="Collected & Withdrawn"
          value={`Rs. ${paidAmount.toLocaleString()}`}
          sub={`Rs. ${totalWithdrawn.toLocaleString()} withdrawn · Rs. ${remaining >= 0 ? remaining.toLocaleString() : 0} remaining`}
          color="#10b981"
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
      <div className="dashboard-extras-grid">
        <div className="chart-container">
          <h3 className="section-title">🕒 Pending Standups</h3>
          <div className="compact-list">
            {standupUnpaid.length > 0 ? (
              standupUnpaid.slice(0, 5).map((f) => (
                <div key={f.id} className="compact-item">
                  <span className="item-name">{f.employee_name}</span>
                  <span className="item-meta">{f.date}</span>
                  <span className="status-badge unpaid">Pending</span>
                </div>
              ))
            ) : (
              <p className="empty-msg">All caught up! 🎉</p>
            )}
          </div>
        </div>

        <div className="chart-container">
          <h3 className="section-title">🏖️ Upcoming Leaves</h3>
          <div className="compact-list">
            {upcomingLeaves.length > 0 ? (
              upcomingLeaves.map((l) => (
                <div key={l.id} className="compact-item">
                  <span className="item-name">{l.employee_name}</span>
                  <span className="item-meta">
                    {l.start_date === l.end_date ? l.start_date : `${l.start_date} to ${l.end_date}`}
                  </span>
                  <span className="leave-type-tag">{l.type}</span>
                </div>
              ))
            ) : (
              <p className="empty-msg">No leaves planned soon.</p>
            )}
          </div>
        </div>
        <div className="chart-container celebration-container">
          <h3 className="section-title">✨ Celebrations</h3>
          <div className="compact-list">
            {celebrations.length > 0 ? (
              celebrations.map((c, idx) => (
                <div key={idx} className={`compact-item ${c.isToday ? 'highlight-today' : ''}`}>
                  <div className="item-info">
                    <span className="item-icon">{c.type === 'birthday' ? '🎂' : '🏆'}</span>
                    <div className="item-text">
                      <span className="item-name">{c.empName}</span>
                      <span className="celebration-detail">{c.name}</span>
                    </div>
                  </div>
                  <div className="item-actions">
                    <span className="celebration-date">{c.date}</span>
                    {c.type === 'birthday' && (
                      <button 
                        className={`btn btn-sm btn-wish ${sendingWish === c.empName ? 'btn-loading' : ''}`} 
                        onClick={() => !sendingWish && handleWish(c)}
                        disabled={!!sendingWish}
                        title="Send birthday wish"
                      >
                        {sendingWish === c.empName ? 'Sending...' : 'Send Wish'}
                      </button>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="empty-msg">No celebrations this month.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
