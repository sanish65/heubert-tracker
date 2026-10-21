"use client";

import { useId } from "react";
import { useApp } from "@/context/AppContext";

// The app stores only these two; there is no "System" option.
const THEMES = [
  { value: "dark", label: "Dark" },
  { value: "light", label: "Light" },
];

// Theme as a two-option segmented control. Used in Settings (with a description)
// and in the top bar's account menu (without).
export default function ThemeToggle({ description }) {
  const { theme, toggleTheme } = useApp();
  const titleId = useId();

  return (
    <div className="pref-row">
      <div className="pref-text">
        <span className="pref-title" id={titleId}>Theme</span>
        {description && <span className="pref-desc">{description}</span>}
      </div>
      <div className="status-tabs" role="group" aria-labelledby={titleId}>
        {THEMES.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            className={`tab ${theme === value ? "tab-active" : ""}`}
            aria-pressed={theme === value}
            onClick={() => {
              if (theme !== value) toggleTheme();
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
