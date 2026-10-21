"use client";

import { useState } from "react";
import PrivilegeSettingsPage from "@/components/PrivilegeSettingsPage";
import LeaveSettingsPage from "@/components/LeaveSettingsPage";
import ThemeToggle from "@/components/ThemeToggle";
import AnimationToggle from "@/components/AnimationToggle";

const SECTIONS = [
  { id: "roles", label: "Roles" },
  { id: "lists", label: "List visibility" },
  { id: "leave-types", label: "Leave types" },
  { id: "prefs", label: "Preferences" },
];

// The admin Settings tab (Settings.dc.html): section links, roles, list visibility,
// leave types, then your own preferences. The page heading comes from PageHead.
export default function SettingsPage() {
  const [current, setCurrent] = useState(SECTIONS[0].id);

  return (
    <div className="settings-page">
      <nav className="settings-nav glass" aria-label="Settings sections">
        {SECTIONS.map(({ id, label }) => (
          <a
            key={id}
            href={`#${id}`}
            className={`settings-nav-link${current === id ? " is-current" : ""}`}
            aria-current={current === id ? "true" : undefined}
            onClick={() => setCurrent(id)}
          >
            {label}
          </a>
        ))}
      </nav>

      <PrivilegeSettingsPage />
      <LeaveSettingsPage />

      <section id="prefs" className="settings-section settings-card settings-prefs glass-card" aria-labelledby="settings-prefs-title">
        <h2 id="settings-prefs-title" className="settings-heading">Your preferences</h2>
        <ThemeToggle description="Dark is the default." />
        <AnimationToggle description="Festival scenes and celebration effects. Off also respects reduced motion." />
      </section>
    </div>
  );
}
