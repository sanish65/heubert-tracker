"use client";

import { useId } from "react";
import { useApp } from "@/context/AppContext";

// Animations as a switch row: the whole row is the label. Used in Settings (with a
// description) and in the top bar's account menu (without).
export default function AnimationToggle({ description }) {
  const { animationsEnabled, toggleAnimations } = useApp();
  const titleId = useId();
  const descId = useId();

  return (
    <label className="pref-row">
      <span className="pref-text">
        <span className="pref-title" id={titleId}>Animations</span>
        {description && <span className="pref-desc" id={descId}>{description}</span>}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="pref-switch"
        checked={animationsEnabled}
        onChange={toggleAnimations}
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
      />
    </label>
  );
}
