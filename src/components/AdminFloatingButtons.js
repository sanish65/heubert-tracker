"use client";

import { useSyncExternalStore } from "react";
import { useApp } from "@/context/AppContext";

// Whether the admin has tucked the buttons away. Kept in this browser only — a per-viewer
// convenience, so a failed read (private window, blocked storage) just shows the buttons.
const HIDDEN_KEY = "heubert_admin_fab_hidden";
const CHANGE_EVENT = "heubert-admin-fab-change";

const readHidden = () => {
  try { return localStorage.getItem(HIDDEN_KEY) === "1"; } catch { return false; }
};
const writeHidden = (hidden) => {
  try { localStorage.setItem(HIDDEN_KEY, hidden ? "1" : "0"); } catch { /* storage blocked */ }
  window.dispatchEvent(new Event(CHANGE_EVENT));
};
const subscribe = (onChange) => {
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onChange); // another tab toggled it
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

export default function AdminFloatingButtons({ activeTab, onOpenProjects, onOpenLeaveSettings, onOpenPrivilegeSettings }) {
  const { isAdmin } = useApp();
  // Server render has no storage: show the buttons, then follow the browser's choice.
  const hidden = useSyncExternalStore(subscribe, readHidden, () => false);
  if (!isAdmin) return null;

  if (hidden) {
    return (
      <button
        type="button"
        className="admin-fab-reveal"
        onClick={() => writeHidden(false)}
        title="Show admin shortcuts"
        aria-label="Show admin shortcuts"
      >
        ⚙️
      </button>
    );
  }

  return (
    <div className="admin-fab-group">
      <button
        type="button"
        className="admin-fab-hide"
        onClick={() => writeHidden(true)}
        title="Hide these shortcuts"
        aria-label="Hide admin shortcuts"
      >
        ×
      </button>
      <button
        type="button"
        className={`admin-fab ${activeTab === "projects" ? "admin-fab-active" : ""}`}
        onClick={onOpenProjects}
        title="Projects"
      >
        <span className="admin-fab-icon">🚀</span>
        <span>Projects</span>
      </button>
      <button
        type="button"
        className={`admin-fab ${activeTab === "leave-settings" ? "admin-fab-active" : ""}`}
        onClick={onOpenLeaveSettings}
        title="Leave Settings"
      >
        <span className="admin-fab-icon">⚙️</span>
        <span>Leave Settings</span>
      </button>
      <button
        type="button"
        className={`admin-fab ${activeTab === "privilege-settings" ? "admin-fab-active" : ""}`}
        onClick={onOpenPrivilegeSettings}
        title="Privilege Settings"
      >
        <span className="admin-fab-icon">🔐</span>
        <span>Privilege Settings</span>
      </button>
    </div>
  );
}
