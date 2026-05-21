"use client";

import { useApp } from "@/context/AppContext";

export default function AnimationToggle() {
  const { animationsEnabled, toggleAnimations } = useApp();

  return (
    <div className="theme-toggle-container">
      <div className="theme-toggle-content">
        <span className="theme-toggle-icon">✨</span>
        <span className="theme-toggle-text">Animations</span>
      </div>
      <label className="switch">
        <input 
          type="checkbox" 
          checked={animationsEnabled} 
          onChange={toggleAnimations} 
        />
        <span className="slider round"></span>
      </label>
    </div>
  );
}
