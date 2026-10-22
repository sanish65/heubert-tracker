"use client";

import { useState, useSyncExternalStore } from "react";
import { useApp } from "@/context/AppContext";
import { FESTIVE_SEASON_START } from "@/lib/festiveSeason";
import Icon from "./Icon";

// Counts down to Dashain & Tihar and to the office vacation; the banner
// disappears once the vacation begins. Targets are midnight local time.
const SHOW_FROM = FESTIVE_SEASON_START;
const FESTIVAL_START = new Date(2026, 9, 11); // Oct 11, 2026
const VACATION_START = new Date(2026, 9, 17); // Oct 17, 2026

const TIMERS = [
  { target: FESTIVAL_START, label: "Dashain & Tihar festive begins in", date: "Sunday, Oct 11", done: "Dashain & Tihar have begun!" },
  { target: VACATION_START, label: "Vacation starts in", date: "Saturday, Oct 17" },
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

// Shared colours for the festival children. Shading and highlights are translucent
// overlays, so they work on any skin tone or outfit colour passed in.
const HAIR = "#1f1510";
const INK = "#2a1a12";
const GOLD = "#fde68a";
const CREAM = "#f5ecd7";
const SHOE = "#3b2417";
const SHADE = "rgba(30, 16, 53, 0.2)";
const SHINE = "rgba(255, 255, 255, 0.22)";
const BLUSH = "rgba(244, 114, 182, 0.38)";
const TIKA = "#dc2626";

// A child's face on a 60-wide grid: ears, face, soft shading, brows, eyes, nose,
// cheeks, the red Dashain tika and a smile (open and laughing when `laughing`).
// `dx`/`dy`/`k` place and scale it so the swing rider can share it.
function KidFace({ skin, laughing, dx = 0, dy = 0, k = 1 }) {
  return (
    <g transform={`translate(${dx} ${dy}) scale(${k})`}>
      <circle cx="19.6" cy="22" r="2.6" fill={skin} />
      <circle cx="40.4" cy="22" r="2.6" fill={skin} />
      <circle cx="40.4" cy="22" r="2.6" fill={SHADE} />
      <ellipse cx="30" cy="20.5" rx="10.5" ry="11" fill={skin} />
      <path d="M36 11 Q41.8 15 40.4 23 Q39 29.5 33.5 31.2 Q38.6 26 38.6 20 Q38.4 14.5 36 11 Z" fill={SHADE} />
      <path d="M24 17.6 Q25.9 16.6 27.8 17.4 M32.2 17.4 Q34.1 16.6 36 17.6" fill="none" stroke={HAIR} strokeWidth="0.9" strokeLinecap="round" />
      <ellipse cx="25.9" cy="21.3" rx="1.35" ry="1.6" fill={INK} />
      <ellipse cx="34.1" cy="21.3" rx="1.35" ry="1.6" fill={INK} />
      <circle cx="26.4" cy="20.7" r="0.45" fill="#fff" />
      <circle cx="34.6" cy="20.7" r="0.45" fill="#fff" />
      <path d="M29.3 24.1 Q30 24.9 30.7 24.1" fill="none" stroke="rgba(120, 53, 15, 0.55)" strokeWidth="0.8" strokeLinecap="round" />
      <circle cx="23" cy="25.6" r="2" fill={BLUSH} />
      <circle cx="37" cy="25.6" r="2" fill={BLUSH} />
      <ellipse cx="30" cy="15.4" rx="0.9" ry="1.4" fill={TIKA} />
      {laughing ? (
        <>
          <path d="M26.8 26.6 Q30 31.6 33.2 26.6 Z" fill="#7f1d1d" />
          <ellipse cx="30" cy="28.9" rx="1.5" ry="0.8" fill="#f87171" />
        </>
      ) : (
        <path d="M27 26.8 Q30 29.6 33 26.8" fill="none" stroke={INK} strokeWidth="1" strokeLinecap="round" />
      )}
    </g>
  );
}

// Hair and headwear, drawn over the face. "daura" is a boy in a Dhaka topi, "frock" a
// girl with bangs and bowed pigtails, "kurta" a girl with a centre parting, a braid
// over the shoulder and a marigold.
function KidHair({ outfit, cloth }) {
  if (outfit === "frock") {
    return (
      <>
        <path d="M19 23 Q17.5 9 30 8.5 Q42.5 9 41 23 Q40.5 15.5 36 13.5 Q31 14.8 25 13 Q21 15 19 23 Z" fill={HAIR} />
        <path d="M15.5 16.5 L19.5 18.6 L15.8 21 Z M21.5 16.5 L19.5 18.6 L22 21 Z" fill={cloth} />
        <path d="M44.5 16.5 L40.5 18.6 L44.2 21 Z M38.5 16.5 L40.5 18.6 L38 21 Z" fill={cloth} />
        <circle cx="19.5" cy="18.7" r="1.1" fill={GOLD} />
        <circle cx="40.5" cy="18.7" r="1.1" fill={GOLD} />
      </>
    );
  }
  if (outfit === "kurta") {
    return (
      <>
        <path d="M19.2 23 Q18 8.5 30 8.2 Q42 8.5 40.8 23 Q40 15 34 12.6 L30 11.4 L26 12.6 Q20 15 19.2 23 Z" fill={HAIR} />
        <circle cx="38.4" cy="12.2" r="2.3" fill="#f59e0b" />
        <circle cx="38.4" cy="12.2" r="0.9" fill="#fde047" />
      </>
    );
  }
  return (
    <>
      <path d="M19.3 23 Q18.8 16.5 20.6 14.4 L23.2 14.6 Q21.2 17.4 21.2 23 Z M40.7 23 Q41.2 16.5 39.4 14.4 L36.8 14.6 Q38.8 17.4 38.8 23 Z" fill={HAIR} />
      <path d="M18.8 15.6 L20.8 4.6 Q31 1.6 41.2 3.8 L41.4 15.6 Q30 12.2 18.8 15.6 Z" fill="#1f2937" />
      <path d="M20.6 9.2 l2 -2 l2 2 l2 -2 l2 2 l2 -2 l2 2 l2 -2 l2 2 l2 -2 l2 2" fill="none" stroke="#fbbf24" strokeWidth="0.9" strokeLinejoin="round" />
      {[22.5, 26.5, 30.5, 34.5, 38.5].map((x) => (
        <circle key={x} cx={x} cy="12" r="0.8" fill="#ef4444" />
      ))}
      <path d="M21 5.2 Q31 2.4 40.8 4.4" fill="none" stroke={SHINE} strokeWidth="1.2" strokeLinecap="round" />
    </>
  );
}

// Pigtails and side hair sit behind the face, so they are drawn first.
function KidBackHair({ outfit }) {
  if (outfit === "frock") {
    return (
      <>
        <circle cx="16.4" cy="24.5" r="4.2" fill={HAIR} />
        <circle cx="43.6" cy="24.5" r="4.2" fill={HAIR} />
      </>
    );
  }
  if (outfit === "kurta") {
    return <path d="M18.5 18 Q17 28 20.5 32.5 L22.5 30.5 Q20.4 24 21 18 Z M41.5 18 Q43 28 39.5 32.5 L37.5 30.5 Q39.6 24 39 18 Z" fill={HAIR} />;
  }
  return null;
}

// Shoulder, elbow, wrist and where the hand sits, per pose. The kite hand ends on
// the string's anchor (.dashain-kid-string: 34px in, 56px up); "jump" raises both.
const KID_ARMS = {
  kite: [[[21.5, 39], [16.5, 49], [20, 57], [21, 58.5]], [[38.5, 39], [46, 29], [52, 17.5], [53.5, 14.5]]],
  jump: [[[21.5, 39], [14, 31], [10.5, 21], [9.8, 18.6]], [[38.5, 39], [46, 31], [49.5, 21], [50.2, 18.6]]],
  wave: [[[21.5, 39], [16, 49.5], [17, 58.5], [17.4, 60.4]], [[38.5, 39], [47, 34], [50, 24], [50.6, 20.4]]],
};

function KidArm({ points, cloth, skin, shortSleeve, open }) {
  const [shoulder, elbow, wrist, hand] = points;
  const path = `M${shoulder} L${elbow} L${wrist}`;
  return (
    <>
      <path d={path} fill="none" stroke={shortSleeve ? skin : cloth} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      {shortSleeve ? (
        <circle cx={shoulder[0]} cy={shoulder[1] + 1} r="4.3" fill={cloth} />
      ) : (
        <circle cx={wrist[0]} cy={wrist[1]} r="2.6" fill={GOLD} />
      )}
      {open ? (
        <>
          <ellipse cx={hand[0]} cy={hand[1]} rx="2.9" ry="3.5" fill={skin} />
          <path d={`M${hand[0] - 2.6} ${hand[1] + 0.8} l-1.8 -1.6`} stroke={skin} strokeWidth="1.6" strokeLinecap="round" />
        </>
      ) : (
        <circle cx={hand[0]} cy={hand[1]} r="2.8" fill={skin} />
      )}
    </>
  );
}

// The garment in the shirt colour, with its gold trim and a shaded right side.
function KidOutfit({ outfit, cloth }) {
  if (outfit === "frock") {
    return (
      <>
        <path d="M21 37 Q30 33.5 39 37 L38 52 L22 52 Z" fill={cloth} />
        <path d="M22 51 L38 51 L46 71 Q30 75 14 71 Z" fill={cloth} />
        <path d="M34 51 L38 51 L46 71 Q42 72.6 38 73.4 Z M35 37 L39 37 L38 52 L34.5 52 Z" fill={SHADE} />
        {[[20, 65], [26, 60], [31, 67], [37, 61], [41, 67], [29, 56], [23, 70]].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="0.9" fill={SHINE} />
        ))}
        <path d="M14.4 70.4 Q18 73.8 22 72.2 Q26 75.2 30 73.4 Q34 75.2 38 72.2 Q42 73.8 45.6 70.4" fill="none" stroke="#fff" strokeWidth="1.2" strokeOpacity="0.75" strokeLinecap="round" />
        <rect x="21.5" y="49.8" width="17" height="3" rx="1.5" fill={GOLD} />
        <path d="M25 36.2 Q27.4 40.4 30 37.6 Q32.6 40.4 35 36.2 Q30 34.6 25 36.2 Z" fill="#fff" />
      </>
    );
  }
  if (outfit === "kurta") {
    return (
      <>
        <path d="M20 37 Q30 33 40 37 L43 76 Q30 78.5 17 76 Z" fill={cloth} />
        <path d="M36 36.4 Q38.5 36.4 40 37 L43 76 Q40.5 76.7 37.5 77.2 Z" fill={SHADE} />
        <path d="M26 36.2 Q30 41.2 34 36.2" fill="none" stroke={GOLD} strokeWidth="1.2" strokeLinecap="round" />
        <path d="M17.4 73.2 Q30 75.8 42.6 73.2" fill="none" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
        <path d="M21 36.4 L25.4 35.8 L42 62.5 L38.6 64.6 Z" fill={GOLD} fillOpacity="0.8" />
      </>
    );
  }
  // Daura with a dark istakot (waistcoat) over it.
  return (
    <>
      <path d="M20 37 Q30 33 40 37 L42.5 72 Q30 75 17.5 72 Z" fill={cloth} />
      <path d="M33 58 Q36.6 63.4 39 71.4" fill="none" stroke={GOLD} strokeWidth="1" strokeLinecap="round" />
      <path d="M20 37 Q23.6 35.4 27 36.4 L27.4 58 L19.1 58 Z M40 37 Q36.4 35.4 33 36.4 L32.6 58 L40.9 58 Z" fill="#1e293b" fillOpacity="0.9" />
      <path d="M36 37 Q38.5 36.4 40 37 L42.5 72 Q39.6 73 36.8 73.4 Z" fill={SHADE} />
      {[42, 47.5, 53].map((y) => (
        <circle key={y} cx="32.2" cy={y} r="0.7" fill={GOLD} />
      ))}
      <path d="M27 36.4 Q30 38.6 33 36.4" fill="none" stroke={GOLD} strokeWidth="0.9" strokeLinecap="round" />
    </>
  );
}

// Legs and shoes: cream suruwal or pyjama, or bare legs with white socks under a frock.
function KidLegs({ outfit, skin, spread }) {
  const shoes = (
    <>
      <rect x={20 - spread} y="91.4" width="9.6" height="5" rx="2.5" fill={SHOE} />
      <rect x={30.4 + spread} y="91.4" width="9.6" height="5" rx="2.5" fill={SHOE} />
      <path d={`M${21.4 - spread} 92.6 h3 M${33.6 + spread} 92.6 h3`} stroke={SHINE} strokeWidth="0.9" strokeLinecap="round" />
    </>
  );
  if (outfit === "frock") {
    return (
      <>
        <path d={`M24 68 L${24 - spread} 92 H${28.4 - spread} L28.4 68 Z M31.6 68 L${31.6 + spread} 92 H${36 + spread} L36 68 Z`} fill={skin} />
        <path d={`M${24 - spread} 86.5 H${28.4 - spread} V92 H${24 - spread} Z M${31.6 + spread} 86.5 H${36 + spread} V92 H${31.6 + spread} Z`} fill="#fff" />
        {shoes}
      </>
    );
  }
  return (
    <>
      <path d={`M21.5 64 Q21 80 ${23 - spread} 92 H${28.2 - spread} Q28.6 78 29.6 64 Z M38.5 64 Q39 80 ${37 + spread} 92 H${31.8 + spread} Q31.4 78 30.4 64 Z`} fill={CREAM} />
      <path d={`M34.6 64 Q35 79 ${33.6 + spread} 92 H${31.8 + spread} Q31.4 78 30.4 64 Z`} fill={SHADE} />
      {shoes}
    </>
  );
}

function LingePing({ say }) {
  const skin = "#d39a6a";
  const cloth = "#f43f5e";
  return (
    <div className="dashain-ping" aria-hidden="true">
      {say && <span className="dashain-ping-bubble" lang="ne">{say}</span>}
      <svg width="70" height="90" viewBox="0 0 70 90">
        <path d="M6 90 L30 4 M64 90 L40 4" stroke="#a16207" strokeWidth="4" strokeLinecap="round" />
        <path d="M26 6 H44" stroke="#a16207" strokeWidth="5" strokeLinecap="round" />
      </svg>
      <div className="dashain-ping-swing">
        {/* Same 24x70 box as before, drawn on a doubled grid: a girl in a kurta sits on
            the seat, gripping both ropes, her feet dangling. */}
        <svg width="24" height="70" viewBox="0 0 48 140">
          <path d="M8 0 V104 M40 0 V104" stroke="#d6d3d1" strokeWidth="3" />
          <rect x="4" y="104" width="40" height="6" rx="2" fill="#78350f" />
          <path d="M17 104 L17.5 125 H22.5 L22.5 104 Z M25.5 104 L25.5 125 H30.5 L31 104 Z" fill={CREAM} />
          <rect x="15.4" y="124.4" width="8.2" height="5" rx="2.5" fill={SHOE} />
          <rect x="24.4" y="124.4" width="8.2" height="5" rx="2.5" fill={SHOE} />
          <path d="M15.5 81 Q24 77.5 32.5 81 L34 104 L14 104 Z" fill={cloth} />
          <path d="M28.5 79.8 Q31 80.2 32.5 81 L34 104 L29.5 104 Z" fill={SHADE} />
          <path d="M13.4 100 Q24 108 34.6 100 L34.6 106 Q24 112.4 13.4 106 Z" fill={cloth} />
          <path d="M13.6 105.4 Q24 111.6 34.4 105.4" fill="none" stroke={GOLD} strokeWidth="1.4" strokeLinecap="round" />
          <path d="M20.6 80.2 Q24 84 27.4 80.2" fill="none" stroke={GOLD} strokeWidth="1.1" strokeLinecap="round" />
          <path d="M17 83 Q11 92 8.8 85.4 M31 83 Q37 92 39.2 85.4" fill="none" stroke={cloth} strokeWidth="4.4" strokeLinecap="round" />
          <circle cx="8.4" cy="84.6" r="2.6" fill={skin} />
          <circle cx="39.6" cy="84.6" r="2.6" fill={skin} />
          <rect x="21.5" y="72" width="5" height="9" rx="2" fill={skin} />
          <rect x="21.5" y="72" width="5" height="3" fill={SHADE} />
          <g transform="translate(0 50) scale(0.8)">
            <KidBackHair outfit="frock" />
          </g>
          <KidFace skin={skin} laughing dx={0} dy={50} k={0.8} />
          <g transform="translate(0 50) scale(0.8)">
            <KidHair outfit="frock" cloth={GOLD} />
          </g>
        </svg>
      </div>
    </div>
  );
}

// A child standing in front of the rooftops. `pose` is "kite" (one arm up on a kite
// string, a latai spool in the other hand), "jump" (both arms up, bouncing) or "wave".
// `shirt` colours the outfit, `head` is the skin tone and `outfit` picks the clothes:
// "daura" (daura suruwal, waistcoat and Dhaka topi), "frock" or "kurta".
function Kid({ left, pose, shirt, head, outfit = "daura", say, sayDelay, wide }) {
  const [leftArm, rightArm] = KID_ARMS[pose] || KID_ARMS.wave;
  const shortSleeve = outfit === "frock";
  const spool = leftArm[3];

  return (
    <div className={`dashain-kid dashain-kid-${pose} ${wide ? "dashain-wide-only" : ""}`} style={{ left }}>
      {say && (
        <span className="dashain-kid-bubble" lang="ne" style={{ animationDelay: `${sayDelay}s` }}>
          {say}
        </span>
      )}
      {pose === "kite" && <span className="dashain-kid-string" />}
      {/* Same 39x65 box as the old figure, on a 60x100 grid. */}
      <svg width="39" height="65" viewBox="0 0 60 100">
        <KidBackHair outfit={outfit} />
        <KidLegs outfit={outfit} skin={head} spread={pose === "jump" ? 2 : 0} />
        <rect x="26.5" y="29" width="7" height="9" rx="2" fill={head} />
        <rect x="26.5" y="29" width="7" height="3.6" fill={SHADE} />
        <KidOutfit outfit={outfit} cloth={shirt} />
        {outfit === "kurta" && (
          <g fill={HAIR}>
            {[[40.2, 31.5], [41, 36], [41.4, 40.5], [41.4, 45]].map(([x, y]) => (
              <ellipse key={y} cx={x} cy={y} rx="2.4" ry="2.7" />
            ))}
            <path d="M40.4 47.4 L42.4 47.4 L43 51 L39.8 51 Z" fill="#ef4444" />
          </g>
        )}
        {pose === "kite" && (
          <>
            <path d={`M${spool[0]} ${spool[1]} L${rightArm[3][0]} ${rightArm[3][1]}`} stroke="rgba(255, 255, 255, 0.6)" strokeWidth="0.5" />
            <rect x={spool[0] - 4.5} y={spool[1] - 1.8} width="9" height="3.6" rx="1" fill="#b45309" />
            <path d={`M${spool[0] - 4.5} ${spool[1] - 2.6} v5.2 M${spool[0] + 4.5} ${spool[1] - 2.6} v5.2`} stroke="#78350f" strokeWidth="1.2" strokeLinecap="round" />
          </>
        )}
        <KidArm points={leftArm} cloth={shirt} skin={head} shortSleeve={shortSleeve} />
        <KidArm points={rightArm} cloth={shirt} skin={head} shortSleeve={shortSleeve} open={pose === "wave"} />
        <KidFace skin={head} laughing={pose === "jump"} />
        <KidHair outfit={outfit} cloth={shirt} />
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
    <section className="announce-card glass" aria-label="Festival announcement">
      <span className="announce-icon" aria-hidden="true">
        <Icon name="flag" size={20} strokeWidth={2} />
      </span>

      <div className="announce-text">
        <strong className="announce-title" lang="ne">{festivalStarted ? "शुभ दशैं तथा तिहार" : "दशैं आउँदैछ!"}</strong>
        <div className="dashain-timers">
          {TIMERS.map((t) => <Countdown key={t.label} {...t} nowSeconds={nowSeconds} />)}
        </div>
      </div>

      <button type="button" className="announce-dismiss" onClick={() => setClosed(true)} aria-label="Dismiss festival banner">
        <Icon name="x" size={16} strokeWidth={2} />
      </button>

      {animationsEnabled !== false && (
        <div className="announce-scene announce-scene-festive">
          <FestiveScene />
        </div>
      )}
    </section>
  );
}
