"use client";

import { useApp } from "@/context/AppContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useApp();
  const isDark = theme === "dark";

  return (
    <div className="theme-toggle-row">
      <div className="theme-toggle-label">
        <span className="theme-toggle-icon">{isDark ? "🌙" : "☀️"}</span>
        <span className="theme-toggle-text">Dark Mode</span>
      </div>
      <button
        role="switch"
        aria-checked={isDark}
        onClick={toggleTheme}
        className={`theme-switch ${isDark ? "theme-switch-on" : "theme-switch-off"}`}
        title={`Switch to ${isDark ? "light" : "dark"} mode`}
      >
        <span className="theme-switch-thumb" />
      </button>
    </div>
  );
}
