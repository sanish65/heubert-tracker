import React from "react";

const WavingCharacter = ({ delay }) => (
  <svg width="24" height="40" viewBox="0 0 24 40" style={{ margin: "0 -2px" }}>
    {/* Body */}
    <rect x="10" y="14" width="4" height="15" fill="#4B5563" rx="2" />
    {/* Head */}
    <circle cx="12" cy="8" r="5" fill="#FCD34D" />
    {/* Legs */}
    <line x1="11" y1="29" x2="9" y2="38" stroke="#4B5563" strokeWidth="2.5" strokeLinecap="round" />
    <line x1="13" y1="29" x2="15" y2="38" stroke="#4B5563" strokeWidth="2.5" strokeLinecap="round" />
    {/* Static Arm (left) */}
    <line x1="10" y1="16" x2="6" y2="24" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" />
    {/* Waving Arm (right) */}
    <g style={{ transformOrigin: "14px 16px", animation: `wave 0.8s infinite alternate ${delay}s ease-in-out` }}>
      <line x1="14" y1="16" x2="20" y2="10" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" />
    </g>
  </svg>
);

export default function VacationAnimation() {
  return (
    <div className="vacation-animation-container">
      <div className="vacation-scenery">
        {/* Sky/clouds */}
        <div className="cloud cloud-1">☁️</div>
        <div className="cloud cloud-2">☁️</div>
        <div className="cloud cloud-3">☁️</div>
        <div className="cloud cloud-4">☁️</div>
        
        {/* Passing trees to simulate speed (comes from between) */}
        <div className="trees-wrapper">
          <div className="passing-tree tree-1">🌲</div>
          <div className="passing-tree tree-2">🌳</div>
          <div className="passing-tree tree-3">🌲</div>
        </div>

        {/* 3 People waving bye on the left side */}
        <div className="waving-people">
          <WavingCharacter delay={0} />
          <WavingCharacter delay={0.2} />
          <WavingCharacter delay={0.4} />
        </div>

        {/* The moving vehicle */}
        <div className="bus-wrapper">
          <span className="party-text">yay, lets party</span>
          <div className="bus-emoji">🚐</div>
        </div>

        {/* The Resort Destination */}
        <div className="resort-destination">
          <span className="palm">🌴</span>
          <span className="resort-building">🛖</span>
          <span className="beach">🏖️</span>
        </div>
        
        {/* Road line */}
        <div className="road-line"></div>
      </div>
    </div>
  );
}
