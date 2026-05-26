"use client";

import { useApp } from "@/context/AppContext";

export default function AnimationToggle() {
  const { animationsEnabled, toggleAnimations } = useApp();

  return (
    <div className="theme-toggle-row">
      <div className="theme-toggle-label">
        <span className="theme-toggle-icon">✨</span>
        <span className="theme-toggle-text">Animations</span>
      </div>
      <button
        role="switch"
        aria-checked={animationsEnabled}
        onClick={toggleAnimations}
        className={`theme-switch ${animationsEnabled ? "theme-switch-on" : "theme-switch-off"}`}
        title={`Toggle animations`}
      >
        <span className="theme-switch-thumb" />
      </button>
    </div>
  );
}
