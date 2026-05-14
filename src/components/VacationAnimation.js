import React from "react";

export default function VacationAnimation() {
  return (
    <div className="vacation-animation-container">
      <div className="vacation-scenery">
        {/* Sky/clouds */}
        <div className="cloud cloud-1">☁️</div>
        <div className="cloud cloud-2">☁️</div>
        <div className="cloud cloud-3">☁️</div>
        <div className="cloud cloud-4">☁️</div>
        
        {/* Passing trees to simulate speed */}
        <div className="passing-tree tree-1">🌲</div>
        <div className="passing-tree tree-2">🌳</div>
        <div className="passing-tree tree-3">🌲</div>

        {/* The moving vehicle */}
        <div className="bus-wrapper">
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
