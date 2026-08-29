"use client";

import { useApp } from "@/context/AppContext";

export default function AdminFloatingButtons({ activeTab, onOpenProjects, onOpenLeaveSettings }) {
  const { isAdmin } = useApp();
  if (!isAdmin) return null;

  return (
    <div className="admin-fab-group">
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
    </div>
  );
}
