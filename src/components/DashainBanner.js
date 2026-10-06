"use client";

import { useState, useSyncExternalStore } from "react";
import { useApp } from "@/context/AppContext";
import { FESTIVE_SEASON_START } from "@/lib/festiveSeason";

// Counts down to Dashain & Tihar and to the office vacation; the banner
// disappears once the vacation begins. Targets are midnight local time.
const SHOW_FROM = FESTIVE_SEASON_START;
const FESTIVAL_START = new Date(2026, 9, 11); // Oct 11, 2026
const VACATION_START = new Date(2026, 9, 17); // Oct 17, 2026

const TIMERS = [
  { target: FESTIVAL_START, label: "🪁 Dashain & Tihar festive begins in", date: "Sunday, Oct 11", done: "🎉 Dashain & Tihar have begun!" },
  { target: VACATION_START, label: "🏖️ Vacation starts in", date: "Saturday, Oct 17" },
];

const KITES = [
  { left: "60%", top: "14%", size: 34, body: "#ef4444", stripe: "#facc15", delay: 0 },
  { left: "70%", top: "6%", size: 26, body: "#22c55e", stripe: "#f97316", delay: 1.1 },
  { left: "80%", top: "24%", size: 30, body: "#3b82f6", stripe: "#f472b6", delay: 0.5, wide: true },
  { left: "90%", top: "8%", size: 22, body: "#a855f7", stripe: "#fde047", delay: 1.7, wide: true },
];

const FIREWORKS = [
  { left: "66%", top: "28%", color: "#fde047", delay: 0 },
  { left: "84%", top: "16%", color: "#f472b6", delay: 0.9 },
  { left: "75%", top: "38%", color: "#38bdf8", delay: 1.7 },
  { left: "93%", top: "30%", color: "#fb923c", delay: 2.4, wide: true },
];
const SPARKS = 12;

const LIGHT_COLORS = ["#fde047", "#fb923c", "#f472b6", "#fef3c7"];

function Kite({ left, top, size, body, stripe, delay, wide }) {
  return (
    <div className={`dashain-kite ${wide ? "dashain-wide-only" : ""}`} style={{ left, top, animationDelay: `${delay}s` }}>
      <svg width={size} height={size * 2.4} viewBox="0 0 40 96" aria-hidden="true">
        <path d="M20 0 L40 20 L20 46 L0 20 Z" fill={body} />
        <path d="M20 0 L20 46 M0 20 L40 20" stroke={stripe} strokeWidth="3" />
        <path
          d="M20 46 Q14 56 20 64 T20 82 T20 96"
          fill="none"
          stroke="rgba(255,255,255,0.7)"
          strokeWidth="1.5"
        />
        <path d="M17 58 L23 62 M17 72 L23 76" stroke={stripe} strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span className="dashain-kite-string" />
    </div>
  );
}

function Firework({ left, top, color, delay, wide }) {
  return (
    <div className={`dashain-firework ${wide ? "dashain-wide-only" : ""}`} style={{ left, top }}>
      {Array.from({ length: SPARKS }).map((_, i) => (
        <span
          key={i}
          className="dashain-spark"
          style={{
            "--angle": `${(360 / SPARKS) * i}deg`,
            background: color,
            boxShadow: `0 0 6px ${color}`,
            animationDelay: `${delay}s`,
          }}
        />
      ))}
    </div>
  );
}

function Diya({ delay }) {
  return (
    <div className="dashain-diya">
      <span className="dashain-flame" style={{ animationDelay: `${delay}s` }} />
      <svg width="22" height="10" viewBox="0 0 22 10" aria-hidden="true">
        <path d="M0 0 Q11 14 22 0 Z" fill="#b45309" />
        <path d="M3 1 Q11 8 19 1" fill="none" stroke="#fbbf24" strokeWidth="1" />
      </svg>
    </div>
  );
}

// Tihar rooftops strung with marigold lights, silhouetted against the dusk.
function TiharSkyline() {
  return (
    <svg
      className="dashain-skyline"
      viewBox="0 0 400 60"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 60 V38 H30 V30 L45 20 L60 30 V38 H80 V26 L100 14 L120 26 V40 H140 V32 H170 V22 L182 12 L194 22 V36 H220 V28 L240 16 L260 28 V40 H285 V30 H310 V20 L325 8 L340 20 V34 H365 V28 L382 18 L400 28 V60 Z"
        fill="#1e1035"
      />
      {[
        [40, 34], [52, 34], [92, 32], [108, 32], [178, 28], [188, 28],
        [232, 34], [248, 34], [318, 28], [332, 28], [376, 36],
      ].map(([x, y], i) => (
        <rect key={i} x={x} y={y} width="5" height="6" fill="#fbbf24" opacity="0.85" />
      ))}
    </svg>
  );
}

function StringLights() {
  const count = 28;
  return (
    <div className="dashain-lights" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => {
        // Two droops across the banner.
        const t = (i / (count - 1)) * 2;
        const sag = Math.sin((t % 1) * Math.PI) * 14;
        return (
          <span
            key={i}
            className="dashain-bulb"
            style={{
              left: `${(i / (count - 1)) * 100}%`,
              top: `${sag}px`,
              background: LIGHT_COLORS[i % LIGHT_COLORS.length],
              color: LIGHT_COLORS[i % LIGHT_COLORS.length],
              animationDelay: `${(i % 4) * 0.35}s`,
            }}
          />
        );
      })}
    </div>
  );
}

function LingePing({ say }) {
  return (
    <div className="dashain-ping" aria-hidden="true">
      {say && <span className="dashain-ping-bubble" lang="ne">{say}</span>}
      <svg width="70" height="90" viewBox="0 0 70 90">
        <path d="M6 90 L30 4 M64 90 L40 4" stroke="#a16207" strokeWidth="4" strokeLinecap="round" />
        <path d="M26 6 H44" stroke="#a16207" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div className="dashain-ping-swing">
        <svg width="24" height="70" viewBox="0 0 24 70">
          <path d="M4 0 V52 M20 0 V52" stroke="#d6d3d1" strokeWidth="1.5" />
          <rect x="2" y="52" width="20" height="3" rx="1" fill="#78350f" />
          <circle cx="12" cy="36" r="4" fill="#fbbf24" />
          <path d="M12 40 V50 M12 44 L6 38 M12 44 L18 38 M12 50 L8 56 M12 50 L16 56" stroke="#fef3c7" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </div>
    </div>
  );
}

// A child standing in front of the rooftops. `pose` is "kite" (one arm up on a
// kite string), "jump" (both arms up, bouncing) or "wave".
function Kid({ left, pose, shirt, head, say, sayDelay, wide }) {
  const arms = {
    kite: "M9 21 L5 31 M21 21 L27 7",
    jump: "M9 21 L3 9 M21 21 L27 9",
    wave: "M9 21 L5 31 M21 21 L26 11",
  }[pose];

  return (
    <div className={`dashain-kid dashain-kid-${pose} ${wide ? "dashain-wide-only" : ""}`} style={{ left }}>
      {say && (
        <span className="dashain-kid-bubble" lang="ne" style={{ animationDelay: `${sayDelay}s` }}>
          {say}
        </span>
      )}
      {pose === "kite" && <span className="dashain-kid-string" />}
      <svg width="39" height="65" viewBox="0 0 30 50">
        <path d={arms} stroke={shirt} strokeWidth="3" strokeLinecap="round" />
        <rect x="9" y="17" width="12" height="16" rx="4" fill={shirt} />
        <path d="M13 33 L12 47 M17 33 L18 47" stroke="#fef3c7" strokeWidth="3" strokeLinecap="round" />
        <circle cx="15" cy="10" r="7" fill={head} />
        <circle cx="12.5" cy="9.5" r="1" fill="#1e1035" />
        <circle cx="17.5" cy="9.5" r="1" fill="#1e1035" />
        <path d="M12 12.5 Q15 15 18 12.5" fill="none" stroke="#1e1035" strokeWidth="1" strokeLinecap="round" />
      </svg>
    </div>
  );
}

// The festival backdrop: string lights, fireworks, kites, the Tihar skyline,
// the linge ping and a row of diyas. Also used behind the loading screen.
export function FestiveScene({ kites = KITES, fireworks = FIREWORKS, diyas = 14, swingSay, kids = [] }) {
  return (
    <div className="dashain-scene" aria-hidden="true">
      <StringLights />
      {fireworks.map((f, i) => <Firework key={i} {...f} />)}
      {kites.map((k, i) => <Kite key={i} {...k} />)}
      <TiharSkyline />
      <LingePing say={swingSay} />
      {kids.map((k, i) => <Kid key={i} {...k} />)}
      <div className="dashain-diyas">
        {Array.from({ length: diyas }).map((_, i) => <Diya key={i} delay={(i % 5) * 0.2} />)}
      </div>
    </div>
  );
}

// A once-a-second clock for the countdown. The snapshot is whole seconds so it
// stays stable between ticks.
const subscribeToClock = (onTick) => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
};
const readClock = () => Math.floor(Date.now() / 1000);

function countdownParts(target, nowSeconds) {
  const left = Math.max(0, Math.floor(target.getTime() / 1000) - nowSeconds);
  return [
    { value: Math.floor(left / 86400), label: "Days" },
    { value: Math.floor((left % 86400) / 3600), label: "Hours" },
    { value: Math.floor((left % 3600) / 60), label: "Mins" },
    { value: left % 60, label: "Secs" },
  ];
}

function Countdown({ target, label, date, done, nowSeconds }) {
  if (nowSeconds * 1000 >= target.getTime()) {
    return (
      <div className="dashain-timer dashain-timer-done">
        <span className="dashain-title">{done}</span>
      </div>
    );
  }

  return (
    <div className="dashain-timer">
      <span className="dashain-title">
        {label} <span className="dashain-date">{date}</span>
      </span>
      <div className="dashain-countdown" role="timer" aria-live="off">
        {countdownParts(target, nowSeconds).map(({ value, label: unit }) => (
          <div key={unit} className="dashain-count-tile">
            <span className="dashain-count-value">{String(value).padStart(2, "0")}</span>
            <span className="dashain-count-label">{unit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashainBanner() {
  const { animationsEnabled } = useApp();
  // Dismissal is not persisted: closing hides the banner until the next reload.
  const [closed, setClosed] = useState(false);
  const nowSeconds = useSyncExternalStore(subscribeToClock, readClock, () => null);

  if (closed || nowSeconds === null) return null;
  const nowMs = nowSeconds * 1000;
  if (nowMs < SHOW_FROM.getTime() || nowMs >= VACATION_START.getTime()) return null;
  const festivalStarted = nowMs >= FESTIVAL_START.getTime();

  return (
    <div className={`dashain-banner ${animationsEnabled === false ? "dashain-still" : ""}`}>
      <FestiveScene />

      <div className="dashain-text">
        <strong lang="ne">{festivalStarted ? "शुभ दशैं तथा तिहार" : "दशैं आउँदैछ!"}</strong>
        <div className="dashain-timers">
          {TIMERS.map((t) => <Countdown key={t.label} {...t} nowSeconds={nowSeconds} />)}
        </div>
      </div>

      <button type="button" className="dashain-close" onClick={() => setClosed(true)} aria-label="Dismiss festival banner">
        ×
      </button>
    </div>
  );
}
