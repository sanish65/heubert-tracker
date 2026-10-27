"use client";

import { useEffect, useState } from "react";

// How the bell gets your attention when something new arrives: a short chime, and, if you
// allowed it, a desktop notification while the tracker sits in a background tab. Client
// only. Both are switched in the account menu (NotificationPrefs) and remembered per browser.

const PREFS_KEY = "heubert-notify-prefs";
const ALERTED_KEY = "heubert-notify-alerted";
const ALERTED_MAX = 300;
// Older than this, a notification is news you missed, not news arriving: it shows in the
// bell but doesn't chime.
const FRESH_MS = 24 * 60 * 60 * 1000;
const PREFS_EVENT = "heubert-notify-prefs";

const DEFAULT_PREFS = { sound: true, desktop: false };

export function readAlertPrefs() {
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch {
    return DEFAULT_PREFS;
  }
}

export function writeAlertPrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {}
  window.dispatchEvent(new Event(PREFS_EVENT));
}

// The prefs, kept in step across every component that shows or uses them.
export function useAlertPrefs() {
  const [prefs, setPrefs] = useState(readAlertPrefs);
  useEffect(() => {
    const sync = () => setPrefs(readAlertPrefs());
    window.addEventListener(PREFS_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PREFS_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const update = (patch) => writeAlertPrefs({ ...readAlertPrefs(), ...patch });
  return [prefs, update];
}

// ── The chime ───────────────────────────────────────────────────────────────

// Browsers only let a page make sound after you've interacted with it, so the audio
// context is created (or resumed) on your first click or key press and kept for later.
let audio = null;

function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!audio) audio = new Ctx();
    if (audio.state === "suspended") audio.resume();
  } catch {}
}

if (typeof window !== "undefined") {
  window.addEventListener("pointerdown", unlockAudio, { passive: true });
  window.addEventListener("keydown", unlockAudio);
}

// Two soft rising notes, about half a second. Silent when the browser hasn't allowed sound yet.
export function playChime() {
  try {
    if (!audio || audio.state !== "running") return;
    const start = audio.currentTime + 0.02;
    [
      { freq: 880, at: 0 },
      { freq: 1318.5, at: 0.14 },
    ].forEach(({ freq, at }) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, start + at);
      gain.gain.linearRampToValueAtTime(0.18, start + at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + at + 0.4);
      osc.connect(gain).connect(audio.destination);
      osc.start(start + at);
      osc.stop(start + at + 0.42);
    });
  } catch {}
}

// ── Desktop notifications ───────────────────────────────────────────────────

export function desktopSupported() {
  return typeof window !== "undefined" && "Notification" in window;
}

export function desktopPermission() {
  return desktopSupported() ? Notification.permission : "unsupported";
}

export async function requestDesktopPermission() {
  if (!desktopSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// ── Alerting once per notification ──────────────────────────────────────────

function readAlerted() {
  try {
    return new Set(JSON.parse(localStorage.getItem(ALERTED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

function writeAlerted(set) {
  try {
    localStorage.setItem(ALERTED_KEY, JSON.stringify([...set].slice(-ALERTED_MAX)));
  } catch {}
}

// Chimes (and, in a background tab, raises a desktop notification) for each bell item that
// is new: not alerted before in this browser, newer than when you last opened the bell, and
// from the last day. `describe(item)` → { title, body } for the desktop notification;
// `onOpen(item)` runs when one is clicked. Several at once make one chime.
export function useNotificationAlerts(items, { seenAt, describe, onOpen, enabled = true }) {
  const [prefs] = useAlertPrefs();
  useEffect(() => {
    if (!enabled || !items?.length) return;
    const alerted = readAlerted();
    const seen = Date.parse(seenAt ?? "");
    const now = Date.now();
    const fresh = items.filter((item) => {
      if (alerted.has(item.id)) return false;
      const at = Date.parse(item.at);
      return Number.isFinite(at) && now - at < FRESH_MS && !(Number.isFinite(seen) && at <= seen);
    });
    if (!fresh.length) return;
    fresh.forEach((item) => alerted.add(item.id));
    writeAlerted(alerted);

    if (prefs.sound) playChime();
    if (prefs.desktop && desktopPermission() === "granted" && document.visibilityState !== "visible") {
      fresh.slice(0, 3).forEach((item) => {
        try {
          const { title, body } = describe(item);
          const note = new Notification(title, { body, tag: item.id, icon: "/logo.png" });
          note.onclick = () => {
            window.focus();
            onOpen?.(item);
            note.close();
          };
        } catch {}
      });
    }
    // describe and onOpen are read at alert time only; items and seenAt drive it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, seenAt, enabled, prefs.sound, prefs.desktop]);
}
