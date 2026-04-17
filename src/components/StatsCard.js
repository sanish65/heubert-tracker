"use client";

export default function StatsCard({ icon, label, value, sub, color }) {
  return (
    <div className="stats-card" style={{ "--card-accent": color }}>
      <div className="stats-card-icon">{icon}</div>
      <div className="stats-card-info">
        <span className="stats-card-value">{value}</span>
        <span className="stats-card-label">{label}</span>
        {sub && <span className="stats-card-sub">{sub}</span>}
      </div>
    </div>
  );
}
