"use client";

// Static stars [x, y, radius, opacity]
const STARS = [
  [55,  48,  1.2, 0.6], [130, 22,  1.0, 0.5], [205, 88,  1.5, 0.7], [295, 55,  1.0, 0.45],
  [370, 130, 1.2, 0.55],[445, 18,  1.5, 0.65],[510, 75,  1.0, 0.5], [595, 108, 1.2, 0.6],
  [670, 42,  1.0, 0.45],[748, 100, 1.5, 0.7], [835, 60,  1.0, 0.5], [915, 140, 1.2, 0.55],
  [998, 28,  1.5, 0.65],[1075,98,  1.0, 0.5], [1155,72,  1.2, 0.6], [1245,130, 1.0, 0.45],
  [1340,45,  1.5, 0.7], [1415,105, 1.0, 0.5],
  [72,  205, 1.0, 0.4], [158, 240, 1.2, 0.5], [250, 185, 1.0, 0.45],[325, 268, 1.5, 0.6],
  [415, 215, 1.0, 0.4], [490, 255, 1.2, 0.55],[568, 180, 1.0, 0.45],[645, 240, 1.5, 0.65],
  [718, 275, 1.0, 0.5], [800, 200, 1.2, 0.55],[888, 248, 1.0, 0.4], [965, 220, 1.5, 0.6],
  [1042,270, 1.0, 0.45],[1128,198, 1.2, 0.5], [1220,250, 1.0, 0.45],[1315,280, 1.5, 0.65],
  [1395,235, 1.0, 0.4],
  [135, 360, 1.2, 0.5], [308, 340, 1.0, 0.45],[485, 405, 1.5, 0.6], [655, 375, 1.0, 0.4],
  [828, 358, 1.2, 0.55],[1005,398, 1.0, 0.45],[1188,352, 1.5, 0.65],[1365,388, 1.0, 0.4],
  [60,  480, 1.0, 0.35],[240, 465, 1.2, 0.45],[420, 488, 1.5, 0.55],[600, 472, 1.0, 0.4],
  [780, 492, 1.2, 0.5], [960, 468, 1.0, 0.4], [1140,485, 1.5, 0.55],[1320,475, 1.0, 0.35],
];

// Twinkling stars [x, y]
const TWINKLE = [
  [175, 125],[448, 68], [718, 152],[958, 38], [1275,85],
  [342, 315],[638, 272],[895, 332],[1148,295],[1378,258],
  [88,  455],[518, 438],[775, 415],[1048,472],[1298,440],
  [260, 190],[580, 210],[850, 180],[1100,230],[1420,310],
];

export default function SpaceScene() {
  return (
    <div style={{
      position: "fixed", inset: 0,
      pointerEvents: "none",
      zIndex: 0,
      overflow: "hidden",
    }}>
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        width="100%" height="100%"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="ss-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#010108" />
            <stop offset="35%"  stopColor="#050320" />
            <stop offset="75%"  stopColor="#07052e" />
            <stop offset="100%" stopColor="#020118" />
          </linearGradient>

          <radialGradient id="ss-nebula-a" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#7c3aed" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ss-nebula-b" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#db2777" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#db2777" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="ss-nebula-c" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#1d4ed8" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0" />
          </radialGradient>

          <radialGradient id="ss-planet-grad" cx="38%" cy="32%" r="62%">
            <stop offset="0%"   stopColor="#f4d070" />
            <stop offset="38%"  stopColor="#e8a030" />
            <stop offset="68%"  stopColor="#c07020" />
            <stop offset="100%" stopColor="#7a3c10" />
          </radialGradient>
          <radialGradient id="ss-moon-grad" cx="38%" cy="32%" r="58%">
            <stop offset="0%"   stopColor="#d4dce8" />
            <stop offset="55%"  stopColor="#9aacc0" />
            <stop offset="100%" stopColor="#687888" />
          </radialGradient>

          <filter id="ss-blur-soft" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2.5" />
          </filter>
          <filter id="ss-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="4" result="b" />
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>

        {/* ── SPACE BACKGROUND ── */}
        <rect width="1440" height="900" fill="url(#ss-bg)" />

        {/* ── NEBULA CLOUDS ── */}
        <ellipse cx="280"  cy="185" rx="340" ry="240" fill="url(#ss-nebula-a)" />
        <ellipse cx="1160" cy="140" rx="275" ry="195" fill="url(#ss-nebula-b)" />
        <ellipse cx="740"  cy="320" rx="390" ry="280" fill="url(#ss-nebula-c)" opacity="0.65" />
        <ellipse cx="520"  cy="680" rx="220" ry="140" fill="url(#ss-nebula-a)" opacity="0.4" />

        {/* ── STATIC STARS ── */}
        {STARS.map(([x, y, r, op], i) => (
          <circle key={i} cx={x} cy={y} r={r} fill="white" opacity={op} />
        ))}

        {/* ── TWINKLING STARS ── */}
        {TWINKLE.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="1.5" fill="white"
            className={`ss-twinkle-${(i % 3) + 1}`} />
        ))}

        {/* ── SATURN-LIKE PLANET (upper right) ── */}
        <g transform="translate(1175, 248)">
          {/* Shadow ring (back, below planet) */}
          <ellipse cx="0" cy="28" rx="130" ry="32"
            fill="none" stroke="#b86a18" strokeWidth="26" opacity="0.5" />
          {/* Planet sphere */}
          <circle cx="0" cy="0" r="90" fill="url(#ss-planet-grad)" />
          {/* Atmosphere glow */}
          <circle cx="0" cy="0" r="90" fill="none" stroke="#f4d070" strokeWidth="3" opacity="0.15" />
          {/* Surface bands */}
          <path d="M-90,8  Q0,18  90,8"  stroke="#d49528" strokeWidth="5.5" fill="none" opacity="0.35" />
          <path d="M-88,22 Q0,33  88,22" stroke="#b87820" strokeWidth="4"   fill="none" opacity="0.3" />
          <path d="M-78,-12 Q0,-4 78,-12" stroke="#e8c040" strokeWidth="3.5" fill="none" opacity="0.32"/>
          <path d="M-68,-28 Q0,-19 68,-28" stroke="#d0a030" strokeWidth="2.5" fill="none" opacity="0.28"/>
          <path d="M-60,-40 Q0,-31 60,-40" stroke="#c09028" strokeWidth="2"   fill="none" opacity="0.22"/>
          {/* Front ring (over planet, clipped to front half) */}
          <path d="M-130,28 Q0,2 130,28"
            fill="none" stroke="#c87a20" strokeWidth="26" opacity="0.55" />
          {/* Ring inner shadow edge */}
          <path d="M-130,28 Q0,2 130,28"
            fill="none" stroke="#8a4a08" strokeWidth="4" opacity="0.35" />
          {/* Small storm spot */}
          <ellipse cx="30" cy="14" rx="12" ry="7" fill="#c07018" opacity="0.4" />
        </g>

        {/* ── MOON (lower left) ── */}
        <g transform="translate(315, 640)">
          {/* Glow halo */}
          <circle cx="0" cy="0" r="55" fill="white" opacity="0.04" />
          {/* Sphere */}
          <circle cx="0" cy="0" r="44" fill="url(#ss-moon-grad)" opacity="0.9" />
          {/* Craters */}
          <circle cx="-10" cy="-8"  r="7"   fill="#8a9dae" opacity="0.35" />
          <circle cx="12"  cy="10"  r="5.5" fill="#8a9dae" opacity="0.3" />
          <circle cx="6"   cy="-18" r="4"   fill="#8a9dae" opacity="0.25" />
          <circle cx="-18" cy="12"  r="3.5" fill="#8a9dae" opacity="0.28" />
          <circle cx="0"   cy="18"  r="3"   fill="#8a9dae" opacity="0.22" />
        </g>

        {/* ── SATELLITE ORBIT (Continue Doing ♻) ── */}
        {/* Orbit ring around moon */}
        <ellipse cx="315" cy="640" rx="82" ry="22"
          fill="none" stroke="rgba(96,165,250,0.22)" strokeWidth="1.2" strokeDasharray="6 5" />
        {/* Satellite on a circular path using animateMotion */}
        <g>
          <rect x="-6" y="-4" width="11" height="7" rx="1.5" fill="#c0c8d8">
            <animateMotion dur="14s" repeatCount="indefinite">
              <mpath href="#ss-orbit-path" />
            </animateMotion>
          </rect>
          <rect x="-18" y="-2" width="10" height="3" rx="1" fill="#4080e8" opacity="0.85">
            <animateMotion dur="14s" repeatCount="indefinite">
              <mpath href="#ss-orbit-path" />
            </animateMotion>
          </rect>
          <rect x="7"  y="-2" width="10" height="3" rx="1" fill="#4080e8" opacity="0.85">
            <animateMotion dur="14s" repeatCount="indefinite">
              <mpath href="#ss-orbit-path" />
            </animateMotion>
          </rect>
        </g>
        {/* Hidden orbit path for animateMotion */}
        <ellipse id="ss-orbit-path" cx="315" cy="640" rx="82" ry="22" fill="none" stroke="none" />

        {/* ── ROCKET 1 (large, red/white — "Start Doing") ── */}
        <g className="ss-rocket-1">
          {/* Exhaust plume */}
          <g className="ss-flame-1">
            <path d="M-10,56 Q-5,95 0,80 Q5,95 10,56"  fill="#ff5500" opacity="0.88" />
            <path d="M-7,56 Q-3,78 0,68 Q3,78 7,56"    fill="#ffaa00" opacity="0.82" />
            <path d="M-4,56 Q-1.5,65 0,60 Q1.5,65 4,56" fill="#fff0a0" opacity="0.75" />
          </g>
          {/* Body */}
          <rect x="-13" y="-44" width="26" height="100" rx="10" fill="#e8ecf4" />
          {/* Nose cone */}
          <path d="M-13,-44 Q0,-84 13,-44 Z" fill="#e74c3c" />
          {/* Fins */}
          <path d="M-13,44 L-28,66 L-13,55 Z" fill="#c0392b" />
          <path d="M13,44  L28,66  L13,55  Z" fill="#c0392b" />
          {/* Stripe */}
          <rect x="-13" y="10" width="26" height="7" rx="1" fill="#e74c3c" opacity="0.75" />
          <rect x="-13" y="-4" width="26" height="4" rx="1" fill="#3498db" opacity="0.5" />
          {/* Window */}
          <circle cx="0" cy="-12" r="10" fill="#85c1e9" opacity="0.92" stroke="#6ab0d8" strokeWidth="1.5" />
          <circle cx="0" cy="-12" r="7"  fill="#5dade2" opacity="0.7" />
          {/* Window shine */}
          <circle cx="-3" cy="-15" r="2.5" fill="white" opacity="0.4" />
        </g>

        {/* ── ROCKET 2 (smaller, green — "Continue Doing") ── */}
        <g className="ss-rocket-2">
          <g className="ss-flame-2">
            <path d="M-7,40 Q-3.5,65 0,55 Q3.5,65 7,40"  fill="#ff6600" opacity="0.85" />
            <path d="M-4.5,40 Q-2,54 0,47 Q2,54 4.5,40"  fill="#ffcc00" opacity="0.78" />
          </g>
          <rect x="-9" y="-30" width="18" height="70" rx="7" fill="#dce0ea" />
          <path d="M-9,-30 Q0,-60 9,-30 Z" fill="#27ae60" />
          <path d="M-9,30 L-20,48 L-9,38 Z" fill="#1e8449" />
          <path d="M9,30  L20,48  L9,38  Z" fill="#1e8449" />
          <rect x="-9" y="6"  width="18" height="5" rx="1" fill="#27ae60" opacity="0.65" />
          <circle cx="0" cy="-6" r="7" fill="#82e0aa" opacity="0.9" stroke="#6ecf96" strokeWidth="1" />
          <circle cx="-2" cy="-8" r="2" fill="white" opacity="0.38" />
        </g>

        {/* ── SHOOTING STAR 1 ── */}
        <g className="ss-shoot-1">
          <line x1="0" y1="0" x2="110" y2="28" stroke="white" strokeWidth="2.2" strokeLinecap="round" opacity="0.9" />
          <line x1="0" y1="0" x2="155" y2="40" stroke="white" strokeWidth="1"   strokeLinecap="round" opacity="0.5" />
        </g>

        {/* ── SHOOTING STAR 2 ── */}
        <g className="ss-shoot-2">
          <line x1="0" y1="0" x2="80"  y2="20" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.8" />
          <line x1="0" y1="0" x2="120" y2="30" stroke="white" strokeWidth="0.9" strokeLinecap="round" opacity="0.45" />
        </g>

        {/* ── COMET ── */}
        <g className="ss-comet">
          {/* Head */}
          <circle cx="0" cy="0" r="4.5" fill="white" opacity="0.95" />
          <circle cx="0" cy="0" r="8"   fill="white" opacity="0.15" />
          {/* Tail */}
          <path d="M0,0 L110,38"  stroke="rgba(210,230,255,0.55)" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M0,0 L160,55"  stroke="rgba(210,230,255,0.28)" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M0,0 L200,68"  stroke="rgba(210,230,255,0.12)" strokeWidth="1"   strokeLinecap="round" />
        </g>

        {/* ── DISTANT GALAXY SMUDGE ── */}
        <ellipse cx="650" cy="520" rx="55" ry="18" fill="rgba(180,160,255,0.12)" transform="rotate(-35 650 520)" />
        <ellipse cx="648" cy="518" rx="28" ry="8"  fill="rgba(200,180,255,0.18)" transform="rotate(-35 648 518)" />


      </svg>

      <style jsx global>{`
        /* ── STAR TWINKLE ── */
        @keyframes ss-twinkle {
          0%, 100% { opacity: 0.25; r: 1px; }
          50%       { opacity: 1;    r: 2px; }
        }
        .ss-twinkle-1 { animation: ss-twinkle 2.6s ease-in-out infinite; }
        .ss-twinkle-2 { animation: ss-twinkle 3.8s ease-in-out infinite; animation-delay: -1.4s; }
        .ss-twinkle-3 { animation: ss-twinkle 4.5s ease-in-out infinite; animation-delay: -2.8s; }

        /* ── ROCKET 1 — diagonal ascent, loops ── */
        @keyframes ss-r1-fly {
          0%   { transform: translate(200px,  980px) rotate(-15deg); opacity: 0; }
          4%   { opacity: 1; }
          94%  { opacity: 1; }
          100% { transform: translate(680px, -150px) rotate(-15deg); opacity: 0; }
        }
        .ss-rocket-1 { animation: ss-r1-fly 28s ease-in-out infinite; }

        /* ── ROCKET 2 — steeper ascent, different timing ── */
        @keyframes ss-r2-fly {
          0%   { transform: translate(980px, 980px) rotate(-28deg); opacity: 0; }
          5%   { opacity: 1; }
          93%  { opacity: 1; }
          100% { transform: translate(1250px, -150px) rotate(-28deg); opacity: 0; }
        }
        .ss-rocket-2 { animation: ss-r2-fly 40s ease-in-out infinite; animation-delay: -18s; }

        /* ── FLAME FLICKER ── */
        @keyframes ss-flicker {
          0%, 100% { transform: scaleY(1)    scaleX(1);    opacity: 0.88; }
          25%       { transform: scaleY(1.35) scaleX(0.85); opacity: 1;    }
          60%       { transform: scaleY(0.78) scaleX(1.15); opacity: 0.72; }
          80%       { transform: scaleY(1.2)  scaleX(0.92); opacity: 0.95; }
        }
        .ss-flame-1 { animation: ss-flicker 0.18s ease-in-out infinite; transform-origin: 0px 56px; }
        .ss-flame-2 { animation: ss-flicker 0.14s ease-in-out infinite; transform-origin: 0px 40px; animation-delay: -0.06s; }

        /* ── SHOOTING STARS ── */
        @keyframes ss-shoot-a {
          0%         { transform: translate(-180px, 80px);   opacity: 0; }
          3%         { opacity: 1; }
          28%, 100%  { transform: translate(1650px, 490px);  opacity: 0; }
        }
        @keyframes ss-shoot-b {
          0%         { transform: translate(-120px, 240px);  opacity: 0; }
          4%         { opacity: 1; }
          22%, 100%  { transform: translate(1650px, 620px);  opacity: 0; }
        }
        .ss-shoot-1 { animation: ss-shoot-a 16s ease-in infinite; }
        .ss-shoot-2 { animation: ss-shoot-b 24s ease-in infinite; animation-delay: -10s; }

        /* ── COMET ── */
        @keyframes ss-comet-fly {
          0%         { transform: translate(1520px, -60px);  opacity: 0; }
          4%         { opacity: 1; }
          42%, 100%  { transform: translate(-200px, 720px);  opacity: 0; }
        }
        .ss-comet { animation: ss-comet-fly 32s ease-in infinite; animation-delay: -12s; }
      `}</style>
    </div>
  );
}
