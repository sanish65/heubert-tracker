"use client";

import { useApp } from "@/context/AppContext";

// The day the new fiscal year (and new leave/fine seasons) begins.
const TARGET_DATE = new Date(2026, 6, 17); // July 17, 2026

const HEAD_COLORS = [
  "#FCD34D", "#F87171", "#60A5FA", "#34D399",
  "#C084FC", "#FB923C", "#22D3EE", "#F472B6",
];

function CheeringFigure({ index }) {
  const color = HEAD_COLORS[index % HEAD_COLORS.length];
  const delay = (index % 8) * 0.09;

  return (
    <div className="cheer-figure" style={{ animationDelay: `${delay}s` }}>
      <svg width="20" height="34" viewBox="0 0 24 40">
        <rect x="10" y="14" width="4" height="15" fill="#4B5563" rx="2" />
        <circle cx="12" cy="8" r="5" fill={color} />
        <line x1="11" y1="29" x2="9" y2="38" stroke="#4B5563" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="13" y1="29" x2="15" y2="38" stroke="#4B5563" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="10" y1="16" x2="4" y2="4" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" />
        <line x1="14" y1="16" x2="20" y2="4" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function NewFiscalYearBanner() {
  const { animationsEnabled } = useApp();

  const isTargetDay = new Date().toDateString() === TARGET_DATE.toDateString();
  if (!isTargetDay) return null;

  return (
    <div className="fiscal-year-banner">
      <div className="fiscal-year-banner-text">
        <strong>🎉 Oh yeah, a new fiscal year!</strong>
        <span>New leaves, a fresh season for fines, and a brand new working year — let's make it a great one!</span>
      </div>
      {animationsEnabled !== false && (
        <div className="cheer-crowd">
          {Array.from({ length: 16 }).map((_, i) => (
            <CheeringFigure key={i} index={i} />
          ))}
        </div>
      )}
    </div>
  );
}
