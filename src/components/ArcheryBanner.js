"use client";

import { useState, useSyncExternalStore } from "react";
import { useApp } from "@/context/AppContext";

// Team bonding, Thursday Oct 8, 2026: archery night. Shown at the next morning's meeting
// (Friday Oct 9, local time) as a little memory of the evening. Oct 8 is only there so it
// could be previewed the night before; drop it once that's done.
const SHOW_ON = ["2026-10-08", "2026-10-09"];

// Where each arrow's tip lands on the 120×120 target, and when it flies (seconds into
// the loop). The last one is the bullseye that sets off the confetti.
const HITS = [
  { x: 74, y: 48, delay: 0.2 },
  { x: 49, y: 70, delay: 1.0 },
  { x: 68, y: 72, delay: 1.8 },
  { x: 60, y: 60, delay: 2.6, bullseye: true },
];
const ARROW_LENGTH = 78;
// The bullseye lands ~3.4s into a lane's loop; its +10 and confetti go off then.
const BULLSEYE_AT = 3.4;

// One shooting lane per archer, side by side. `offset` staggers the lanes so the volleys
// don't fly in lockstep; `hideBelow` drops a lane on narrower screens (see the CSS).
const LANES = [
  { head: "#fcd34d", shirt: "#e2e8f0", offset: 0 },
  { head: "#f9a8d4", shirt: "#93c5fd", offset: 1.4, hideBelow: "md" },
  { head: "#86efac", shirt: "#fca5a5", offset: 0.7, hideBelow: "lg" },
];

// The crowd behind the shooting line.
const FANS = [
  { head: "#fdba74", body: "#c4b5fd", delay: 0 },
  { head: "#fde047", body: "#5eead4", delay: 0.25, flag: true },
  { head: "#f0abfc", body: "#fcd34d", delay: 0.5 },
];
const CONFETTI = ["#facc15", "#f87171", "#60a5fa", "#4ade80", "#f472b6", "#fb923c", "#a78bfa", "#fde047"];

// Today's local date as YYYY-MM-DD; null while server-rendering so the banner never
// renders on the server and then disagrees with the browser.
const subscribeNever = () => () => {};
const readToday = () => new Date().toLocaleDateString("en-CA");

function Target() {
  return (
    <svg className="archery-target-face" width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="60" r="58" fill="#f8fafc" stroke="#cbd5e1" strokeWidth="2" />
      <circle cx="60" cy="60" r="46" fill="#1f2937" />
      <circle cx="60" cy="60" r="35" fill="#2563eb" />
      <circle cx="60" cy="60" r="24" fill="#dc2626" />
      <circle cx="60" cy="60" r="13" fill="#facc15" />
      <circle cx="60" cy="60" r="4" fill="#ca8a04" />
    </svg>
  );
}

// An arrow pointing right; its tip sits at the right edge of the element.
function Arrow({ x, y, delay, bullseye, offset }) {
  return (
    <div
      className={`archery-arrow ${bullseye ? "archery-arrow-bullseye" : ""}`}
      style={{ left: x - ARROW_LENGTH, top: y - 6, width: ARROW_LENGTH, animationDelay: `${delay + offset}s` }}
    >
      <svg width={ARROW_LENGTH} height="12" viewBox="0 0 78 12" aria-hidden="true">
        <path d="M2 2 L12 6 L2 10 M8 2 L18 6 L8 10" fill="none" stroke="#f472b6" strokeWidth="2.5" strokeLinecap="round" />
        <line x1="6" y1="6" x2="68" y2="6" stroke="#d6a76b" strokeWidth="2.5" strokeLinecap="round" />
        <path d="M66 1.5 L78 6 L66 10.5 Z" fill="#cbd5e1" />
      </svg>
    </div>
  );
}

function Archer({ head, shirt, offset }) {
  return (
    <div className="archery-archer" aria-hidden="true">
      <svg width="64" height="86" viewBox="0 0 64 86">
        {/* body */}
        <circle cx="20" cy="12" r="8" fill={head} />
        <path d="M20 20 V54 M20 54 L10 82 M20 54 L30 82" stroke={shirt} strokeWidth="4" strokeLinecap="round" />
        {/* front arm holding the bow */}
        <path d="M20 30 L44 30" stroke={shirt} strokeWidth="4" strokeLinecap="round" />
        {/* bow */}
        <path d="M44 6 Q62 30 44 54" fill="none" stroke="#a16207" strokeWidth="4" strokeLinecap="round" />
      </svg>
      {/* the string and drawing hand pull back and release on a loop */}
      <div className="archery-draw" style={{ animationDelay: `${offset}s` }}>
        <svg width="64" height="86" viewBox="0 0 64 86">
          <path d="M44 6 L30 30 L44 54" fill="none" stroke="#f8fafc" strokeWidth="1.2" />
          <path d="M20 30 L30 30" stroke={shirt} strokeWidth="4" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

// An archer, their target and their volley. Drawn at full size and scaled down as a
// whole, so arrows still land exactly on the rings.
function Lane({ head, shirt, offset, hideBelow }) {
  return (
    <div className={`archery-lane ${hideBelow ? `archery-hide-below-${hideBelow}` : ""}`}>
      <div className="archery-lane-inner">
        <Archer head={head} shirt={shirt} offset={offset} />
        <div className="archery-target">
          <Target />
          {HITS.map((h, i) => <Arrow key={i} {...h} offset={offset} />)}
          <span className="archery-score" style={{ animationDelay: `${BULLSEYE_AT + offset}s` }}>+10</span>
          <div className="archery-confetti">
            {CONFETTI.map((color, i) => (
              <span
                key={i}
                style={{
                  "--angle": `${(360 / CONFETTI.length) * i}deg`,
                  background: color,
                  animationDelay: `${BULLSEYE_AT + offset}s`,
                }}
              />
            ))}
          </div>
          <span className="archery-stand" />
        </div>
      </div>
    </div>
  );
}

// A teammate on the sidelines, arms up and bouncing; one waves a little flag.
function Fan({ head, body, delay, flag }) {
  return (
    <div className="archery-fan" style={{ animationDelay: `${delay}s` }}>
      <svg width="30" height="58" viewBox="0 0 30 58" aria-hidden="true">
        {flag && (
          <>
            <path d="M25 2 V18" stroke="#e2e8f0" strokeWidth="1.5" />
            <path d="M25 2 L35 6 L25 10 Z" fill="#f43f5e" />
          </>
        )}
        <circle cx="15" cy="12" r="6" fill={head} />
        <path d="M15 18 V38 M15 38 L9 56 M15 38 L21 56" stroke={body} strokeWidth="3.5" strokeLinecap="round" />
        <path d="M15 23 L5 11 M15 23 L25 11" stroke={body} strokeWidth="3" strokeLinecap="round" />
        <path d="M12.5 14 Q15 16.5 17.5 14" fill="none" stroke="#1e1b4b" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function ArcheryBanner() {
  const { animationsEnabled } = useApp();
  // Dismissal is not persisted: closing hides the banner until the next reload.
  const [closed, setClosed] = useState(false);
  const today = useSyncExternalStore(subscribeNever, readToday, () => null);

  if (closed || !SHOW_ON.includes(today)) return null;

  return (
    <div className={`archery-banner ${animationsEnabled === false ? "archery-still" : ""}`}>
      <div className="archery-text">
        <strong>🏹 Bullseye, team!</strong>
        <span>
          Last night&apos;s archery was a hit — thanks everyone for the laughs, the trash talk and
          the surprisingly good aim. Here&apos;s to hitting our targets this sprint too. 🎯
        </span>
        <span className="archery-date">Team bonding · Thu, Oct 8</span>
      </div>

      <div className="archery-range" aria-hidden="true">
        <div className="archery-crowd">
          {FANS.map((f, i) => <Fan key={i} {...f} />)}
        </div>
        {LANES.map((lane, i) => <Lane key={i} {...lane} />)}
      </div>

      <button type="button" className="archery-close" onClick={() => setClosed(true)} aria-label="Dismiss archery banner">
        ×
      </button>
    </div>
  );
}
