"use client";

import { useApp } from "@/context/AppContext";

// KPI tile (Main.dc.html): mono label with a glowing colour dot, a large value, a
// muted sub line. The hover lift comes from .card-lift, and only while animations
// are on. `icon` is accepted for existing callers but no longer shown.
export default function StatsCard({ label, value, sub, color }) {
  const { animationsEnabled } = useApp();

  return (
    <div className={`stats-card glass-card${animationsEnabled !== false ? " card-lift" : ""}`}>
      <div className="stats-card-head">
        <span className="eyebrow">{label}</span>
        <span
          className="stats-card-dot"
          style={{ background: color, boxShadow: `0 0 10px ${color}` }}
          aria-hidden="true"
        />
      </div>
      <span className="stats-card-value">{value}</span>
      {sub && <span className="stats-card-sub">{sub}</span>}
    </div>
  );
}
