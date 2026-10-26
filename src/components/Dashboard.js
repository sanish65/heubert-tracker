import { useState } from "react";
import { useApp } from "@/context/AppContext";
import StatsCard from "./StatsCard";
import EventBanner from "@/components/EventBanner";
import NewFiscalYearBanner from "@/components/NewFiscalYearBanner";
import DashainBanner from "@/components/DashainBanner";
import { useDialog } from "@/context/DialogContext";
import { groupPublicHolidays } from "@/lib/utils";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import { formatBs, formatBsDevanagari } from "@/lib/nepaliDate";
import { getNepalDateStr } from "@/lib/attendanceTime";

// "Fri, Oct 16 · 30 Ashwin 2083": English then Nepali, as in the page header and on
// Leaves. The English year only shows for a date from another year.
function englishAndNepali(dateStr) {
  const day = String(dateStr || "").slice(0, 10);
  const [y, m, d] = day.split("-").map(Number);
  if (!y || !m || !d) return String(dateStr || "");
  const sameYear = y === Number(getNepalDateStr(new Date()).slice(0, 4));
  const english = new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    timeZone: "UTC",
  });
  const nepali = formatBs(day);
  return nepali ? `${english} · ${nepali}` : english;
}

// Parsed as local time — a bare "YYYY-MM-DD" goes through Date() as UTC and can render as
// the day before in timezones behind it.
function formatHolidayDay(day) {
  return new Date(day + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

// Month and day for the holiday date block, parsed as local time like formatHolidayDay.
function holidayDateBlock(day) {
  const d = new Date(day + "T00:00:00");
  return {
    month: d.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    day: String(d.getDate()).padStart(2, "0"),
  };
}

export default function Dashboard() {
  const { fines, fineSeasons, standupFines, employees, leaves, withdrawals, publicHolidays, companyEvents } = useApp();
  const { alertDialog } = useDialog();
  const [sendingWish, setSendingWish] = useState(null); // empId
  const [selectedFineSeasonId, setSelectedFineSeasonId] = useState(null); // null = follow latest season

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
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const upcomingLeaves = leaves
    .filter((l) => l.end_date >= todayStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  // A multi-day holiday is stored a row per day, so fold it back into one entry and keep
  // it listed until its last day has passed rather than its first.
  const upcomingHolidays = groupPublicHolidays(publicHolidays).filter((h) => h.endDate >= todayStr);

  // Celebrations: Birthdays and Anniversaries (15-day window)
  const windowMs = 15 * 24 * 60 * 60 * 1000;
  const celebrations = employees.flatMap(emp => {
    const list = [];
    const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    const getCelebrationsForDate = (originalDate, type) => {
      const d = new Date(originalDate);
      const yearsToCheck = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];
      
      yearsToCheck.forEach(y => {
        const occurrence = new Date(y, d.getMonth(), d.getDate());
        const diffDays = (occurrence - todayNoTime) / (1000 * 60 * 60 * 24);
        
        if (Math.abs(diffDays) <= 15) {
          const isToday = occurrence.toDateString() === today.toDateString();
          
          if (type === 'birthday') {
            list.push({
              type: 'birthday',
              date: occurrence,
              displayDate: `${occurrence.toLocaleString('default', { month: 'short' })} ${occurrence.getDate()}`,
              name: 'Birthday',
              email: emp.work_email || emp.personal_email,
              empName: emp.name,
              isToday
            });
          } else {
            const years = y - d.getFullYear();
            if (years > 0) {
              list.push({
                type: 'anniversary',
                date: occurrence,
                displayDate: `${occurrence.toLocaleString('default', { month: 'short' })} ${occurrence.getDate()}`,
                name: `${years} Year${years > 1 ? 's' : ''} at Heubert!`,
                email: emp.work_email || emp.personal_email,
                empName: emp.name,
                years: years,
                isToday
              });
            }
          }
        }
      });
    };

    if (emp.dob) getCelebrationsForDate(emp.dob, 'birthday');
    if (emp.joined_date) getCelebrationsForDate(emp.joined_date, 'anniversary');
    
    return list;
  }).sort((a, b) => a.date - b.date);

  const handleWish = async (celebration) => {
    setSendingWish(celebration.empName);
    try {
      const res = await fetch('/api/send-wish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: celebration.email, 
          name: celebration.empName,
          type: celebration.type,
          years: celebration.years
        }),
      });
      const data = await res.json();
      if (data.success) {
        await alertDialog(`${celebration.type === 'birthday' ? 'Birthday' : 'Anniversary'} wish sent to ${celebration.empName}!`, { tone: 'success' });
      } else {
        await alertDialog(`Error: ${data.error || 'Failed to send wish'}`, { tone: 'error' });
      }
    } catch (err) {
      await alertDialog("System error while sending email.", { tone: 'error' });
    } finally {
      setSendingWish(null);
    }
  };

  // Fine seasons — the chart below is scoped to whichever season is selected,
  // defaulting to the latest one. Accumulated totals in the stat cards above
  // are unaffected — they always span every fine, regardless of season.
  const sortedFineSeasons = [...fineSeasons].sort(
    (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
  );
  const latestFineSeasonId = sortedFineSeasons[0]?.id ?? null;
  const hasUnassignedFines = fines.some((f) => !f.season_id);
  const effectiveFineSeasonId =
    selectedFineSeasonId !== null
      ? selectedFineSeasonId
      : latestFineSeasonId ?? (hasUnassignedFines ? "unassigned" : null);
  const activeFineSeason = sortedFineSeasons.find((s) => s.id === effectiveFineSeasonId);

  const seasonFines =
    effectiveFineSeasonId === "unassigned"
      ? fines.filter((f) => !f.season_id)
      : fines.filter((f) => f.season_id === effectiveFineSeasonId);

  // Per-employee breakdown for bar chart
  const empData = employees
    .filter(emp => emp.status !== 'resigned' && !emp.late_fine_excluded)
    .map((emp) => {
      const empFines = seasonFines.filter((f) => f.employee_name === emp.name);
      return {
        name: emp.name,
        paid: empFines.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0),
        unpaid: empFines.filter((f) => f.status === "unpaid").reduce((s, f) => s + f.amount, 0),
      };
    }).sort((a, b) => (b.paid + b.unpaid) - (a.paid + a.unpaid));

  const leastFined = empData.length > 0 ? empData[empData.length - 1] : null;

  const maxTotal = Math.max(...empData.map((e) => e.paid + e.unpaid), 1);


  return (
    <section className="dashboard">
      <EventBanner />
      <NewFiscalYearBanner />
      <DashainBanner />

      <div className="stats-grid" aria-label="Key figures">
        <StatsCard
          label="Late fines"
          value={`Rs. ${totalAmount.toLocaleString()}`}
          sub={`${fines.length} records`}
          color="#3D63F0"
        />
        <StatsCard
          label="Unpaid"
          value={`Rs. ${unpaidAmount.toLocaleString()}`}
          sub={`${fines.filter(f => f.status === 'unpaid').length} late entries`}
          color="#F5A524"
        />
        <StatsCard
          label="Collected"
          value={`Rs. ${paidAmount.toLocaleString()}`}
          sub={`Rs. ${totalWithdrawn.toLocaleString()} withdrawn · Rs. ${remaining >= 0 ? remaining.toLocaleString() : 0} remaining`}
          color="#22C55E"
        />
        <StatsCard
          label="Standups"
          value={standupFines.length}
          sub={`${standupUnpaid.length} pending`}
          color="#F43F5E"
        />
        <StatsCard
          label="Team"
          value={employees.length}
          sub="active"
          color="#2DD4EF"
        />
      </div>

      <div className="dash-row">
        <section className="dash-chart glass-card">
          <div className="dash-chart-head">
            <div className="dash-chart-heading">
              <h2 className="section-title">Fines by employee</h2>
              <span className="dash-subtitle">Paid and unpaid late fines this season</span>
            </div>
            {(sortedFineSeasons.length > 0 || hasUnassignedFines) && (
              <label className="dash-season">
                Season
                <select
                  className="dash-season-select"
                  value={String(effectiveFineSeasonId)}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedFineSeasonId(val === "unassigned" ? "unassigned" : Number(val));
                  }}
                >
                  {sortedFineSeasons.map((s) => (
                    <option key={s.id} value={s.id}>{s.title}</option>
                  ))}
                  {hasUnassignedFines && <option value="unassigned">Pre Fiscal Year Fines</option>}
                </select>
              </label>
            )}
          </div>
          {empData.length === 0 ? (
            <p className="empty-msg">No fines recorded in {activeFineSeason ? activeFineSeason.title : "this season"} yet.</p>
          ) : (
            <div className="dash-bars">
              {empData.map((emp) => (
                <div key={emp.name} className="dash-bar-row">
                  <span className="dash-bar-name">{emp.name.split(' ')[0]}</span>
                  <div className="bar-track">
                    <div className="bar-fill bar-paid" style={{ width: `${(emp.paid / maxTotal) * 100}%` }} />
                    <div className="bar-fill bar-unpaid" style={{ width: `${(emp.unpaid / maxTotal) * 100}%` }} />
                  </div>
                  <span className="dash-bar-total mono">Rs. {(emp.paid + emp.unpaid).toLocaleString()}</span>
                  <span className="dash-bar-tip mono" aria-hidden="true">
                    <span className="dash-legend-swatch paid" />Paid Rs. {emp.paid.toLocaleString()}
                    <span className="dash-legend-swatch unpaid" />Unpaid Rs. {emp.unpaid.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="dash-legend">
            <span className="dash-legend-item"><span className="dash-legend-swatch paid" aria-hidden="true" />Paid</span>
            <span className="dash-legend-item"><span className="dash-legend-swatch unpaid" aria-hidden="true" />Unpaid</span>
          </div>
        </section>

        <div className="dash-side">
          {seasonFines.length > 0 && leastFined && (
            <section className="dash-champion glass-card" aria-label="On-time champion">
              <Avatar name={leastFined.name} className="avatar avatar-lg" aria-hidden="true" />
              <div className="dash-champion-text">
                <span className="eyebrow dash-champion-eyebrow">On-time champion</span>
                <span className="dash-champion-name">{leastFined.name}</span>
                <span className="dash-row-meta">Always on time, low on fine.</span>
              </div>
            </section>
          )}

          <section className="dash-card glass-card">
            <div className="dash-card-head">
              <h2 className="section-title">Pending standups</h2>
              {standupUnpaid.length > 0 && <span className="pill pill-red">{standupUnpaid.length} pending</span>}
            </div>
            {standupUnpaid.length > 0 ? (
              <div className="dash-list">
                {standupUnpaid.map((f) => (
                  <div key={f.id} className="dash-item">
                    <Avatar name={f.employee_name} className="avatar" aria-hidden="true" />
                    <div className="dash-item-text">
                      <span className="dash-item-name">{f.employee_name}</span>
                      <span className="dash-row-meta" title={formatBsDevanagari(String(f.date).slice(0, 10))}>{englishAndNepali(f.date)}</span>
                    </div>
                    <span className="pill pill-amber">Pending</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-msg">All caught up!</p>
            )}
          </section>
        </div>
      </div>

      <div className="dash-grid">
        <section className="dash-card glass-card">
          <h2 className="section-title">Upcoming leaves</h2>
          {upcomingLeaves.length > 0 ? (
            <div className="dash-list">
              {upcomingLeaves.map((l) => (
                <div key={l.id} className="dash-item">
                  <Avatar name={l.employee_name} className="avatar" aria-hidden="true" />
                  <div className="dash-item-text">
                    <span className="dash-item-name">{l.employee_name}</span>
                    <span className="dash-row-meta">
                      {l.start_date === l.end_date ? l.start_date : `${l.start_date} – ${l.end_date}`}
                    </span>
                  </div>
                  <span className="pill pill-cyan dash-leave-type">{l.type}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-msg">No leaves planned soon.</p>
          )}
        </section>

        <section className="dash-card glass-card">
          <h2 className="section-title">Upcoming holidays</h2>
          {upcomingHolidays.length > 0 ? (
            <div className="dash-list">
              {upcomingHolidays.map((h) => {
                const block = holidayDateBlock(h.startDate);
                return (
                  <div key={h.key} className="dash-holiday">
                    <div className="dash-date-block" aria-hidden="true">
                      <span className="dash-date-month">{block.month}</span>
                      <span className="dash-date-day">{block.day}</span>
                    </div>
                    <div className="dash-item-text">
                      <span className="dash-item-name">{h.title}</span>
                      <span className="dash-row-meta">
                        {formatHolidayDay(h.startDate)}
                        {h.days > 1 && ` – ${formatHolidayDay(h.endDate)} · ${h.days} days`}
                      </span>
                    </div>
                    {h.startDate <= todayStr && h.endDate >= todayStr && <span className="pill pill-cyan">Today</span>}
                    {h.startDate === tomorrowStr && <span className="pill pill-cyan">Tomorrow</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="empty-msg">No upcoming holidays.</p>
          )}
        </section>

        <section className="dash-card glass-card">
          <h2 className="section-title">Celebrations</h2>
          {celebrations.length > 0 ? (
            <div className="dash-list">
              {celebrations.map((c, idx) => (
                c.isToday ? (
                  <div key={idx} className="dash-celebration dash-celebration-today">
                    <span className="dash-celebration-icon" aria-hidden="true">
                      <Icon name={c.type === 'birthday' ? 'cake' : 'award'} size={18} strokeWidth={2} />
                    </span>
                    <div className="dash-item-text">
                      <span className="dash-item-name">{c.empName}</span>
                      <span className="dash-row-meta">{c.name} · Today</span>
                    </div>
                    <button
                      type="button"
                      className={`btn btn-orange btn-sm ${sendingWish === c.empName ? 'btn-loading' : ''}`}
                      onClick={() => !sendingWish && handleWish(c)}
                      disabled={!!sendingWish}
                      title={`Send ${c.type} wish`}
                    >
                      {sendingWish === c.empName ? 'Sending...' : 'Send Wish'}
                    </button>
                  </div>
                ) : (
                  <div key={idx} className="dash-celebration">
                    <span className="dash-celebration-icon" aria-hidden="true">
                      <Icon name={c.type === 'birthday' ? 'cake' : 'award'} size={18} />
                    </span>
                    <div className="dash-item-text">
                      <span className="dash-item-name">{c.empName}</span>
                      <span className="dash-row-meta">{c.name}</span>
                    </div>
                    <span className="dash-celebration-date mono">{c.displayDate}</span>
                  </div>
                )
              ))}
            </div>
          ) : (
            <p className="empty-msg">No celebrations within 15 days.</p>
          )}
        </section>
      </div>
    </section>
  );
}
