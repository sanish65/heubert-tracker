"use client";

import { useId, useState } from "react";
import { useAlertPrefs, desktopPermission, desktopSupported, requestDesktopPermission } from "@/lib/notifyAlerts";

// The bell's two switches, in the account menu beside Theme and Animations: a chime when a
// notification arrives, and desktop notifications while the tracker is in a background tab.
// Turning desktop on asks the browser for permission; a refusal is the browser's to undo.
export default function NotificationPrefs() {
  const [prefs, update] = useAlertPrefs();
  const [permission, setPermission] = useState(desktopPermission);
  const soundId = useId();
  const desktopId = useId();
  const noteId = useId();
  const blocked = permission === "denied";

  const toggleDesktop = async (on) => {
    if (!on) return update({ desktop: false });
    const answer = permission === "granted" ? "granted" : await requestDesktopPermission();
    setPermission(answer);
    update({ desktop: answer === "granted" });
  };

  return (
    <>
      <label className="pref-row">
        <span className="pref-text">
          <span className="pref-title" id={soundId}>Notification sound</span>
        </span>
        <input
          type="checkbox"
          role="switch"
          className="pref-switch"
          checked={prefs.sound}
          onChange={(e) => update({ sound: e.target.checked })}
          aria-labelledby={soundId}
        />
      </label>
      {desktopSupported() && (
        <label className="pref-row">
          <span className="pref-text">
            <span className="pref-title" id={desktopId}>Desktop notifications</span>
            {blocked && (
              <span className="pref-desc" id={noteId}>Blocked in this browser&apos;s site settings.</span>
            )}
          </span>
          <input
            type="checkbox"
            role="switch"
            className="pref-switch"
            checked={prefs.desktop && permission === "granted"}
            disabled={blocked}
            onChange={(e) => toggleDesktop(e.target.checked)}
            aria-labelledby={desktopId}
            aria-describedby={blocked ? noteId : undefined}
          />
        </label>
      )}
    </>
  );
}
