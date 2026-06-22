"use client";

// 2880px wide (2× viewport) wave paths for seamless translateX(-1440px) loop
const WAVE1 = "M0,556 C90,549 90,549 180,556 C270,563 270,563 360,556 C450,549 450,549 540,556 C630,563 630,563 720,556 C810,549 810,549 900,556 C990,563 990,563 1080,556 C1170,549 1170,549 1260,556 C1350,563 1350,563 1440,556 C1530,549 1530,549 1620,556 C1710,563 1710,563 1800,556 C1890,549 1890,549 1980,556 C2070,563 2070,563 2160,556 C2250,549 2250,549 2340,556 C2430,563 2430,563 2520,556 C2610,549 2610,549 2700,556 C2790,563 2790,563 2880,556 L2880,900 L0,900 Z";
const WAVE2 = "M0,563 C120,551 120,551 240,563 C360,575 360,575 480,563 C600,551 600,551 720,563 C840,575 840,575 960,563 C1080,551 1080,551 1200,563 C1320,575 1320,575 1440,563 C1560,551 1560,551 1680,563 C1800,575 1800,575 1920,563 C2040,551 2040,551 2160,563 C2280,575 2280,575 2400,563 C2520,551 2520,551 2640,563 C2760,575 2760,575 2880,563 L2880,900 L0,900 Z";
const WAVE3 = "M0,572 C180,554 180,554 360,572 C540,590 540,590 720,572 C900,554 900,554 1080,572 C1260,590 1260,590 1440,572 C1620,554 1620,554 1800,572 C1980,590 1980,590 2160,572 C2340,554 2340,554 2520,572 C2700,590 2700,590 2880,572 L2880,900 L0,900 Z";
const FOAM3  = "M0,572 C180,554 180,554 360,572 C540,590 540,590 720,572 C900,554 900,554 1080,572 C1260,590 1260,590 1440,572 C1620,554 1620,554 1800,572 C1980,590 1980,590 2160,572 C2340,554 2340,554 2520,572 C2700,590 2700,590 2880,572";

const STARS = [
  [120,42],[200,72],[350,32],[480,58],[600,25],[750,62],[880,37],[1020,52],[1200,32],[1320,68],[1400,42],
  [160,95],[280,115],[420,82],[560,98],[700,88],[840,104],[980,78],[1100,98],[1250,88],[1380,104],
  [70,135],[300,145],[450,130],[680,155],[820,138],[1000,148],[1150,132],[1300,145],[50,170],[440,180],
];

// Rain drop positions for the storm (x relative to storm group origin at x=0)
const RAIN_A = Array.from({length: 18}, (_, i) => [i * 17 - 10, 248 + (i % 4) * 18]);
const RAIN_B = Array.from({length: 18}, (_, i) => [i * 17 - 3,  264 + (i % 4) * 18]);

export default function SailboatScene() {
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
          <linearGradient id="sc-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#080f2b" />
            <stop offset="55%"  stopColor="#132f6e" />
            <stop offset="100%" stopColor="#1f5494" />
          </linearGradient>
          <linearGradient id="sc-ocean" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#1565a8" />
            <stop offset="100%" stopColor="#041828" />
          </linearGradient>
          <radialGradient id="sc-sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#ffe877" stopOpacity="1" />
            <stop offset="45%"  stopColor="#ffd700" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="sc-moon" cx="50%" cy="50%" r="50%">
            <stop offset="0%"   stopColor="#e8f4f8" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#b0cfe8" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="sc-sunpath" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#ffd700" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ffd700" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="sc-anchor-chain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#8899aa" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#8899aa" stopOpacity="0.2" />
          </linearGradient>
        </defs>

        {/* ── SKY ── */}
        <rect width="1440" height="560" fill="url(#sc-sky)" />

        {/* Stars */}
        {STARS.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 5 === 0 ? 1.6 : 1} fill="white"
            opacity={0.3 + (i % 4) * 0.12} />
        ))}

        {/* Moon */}
        <circle cx="180" cy="130" r="90" fill="url(#sc-moon)" />
        <circle cx="178" cy="128" r="38" fill="#d6eaf8" opacity="0.9" />
        <circle cx="168" cy="118" r="5"  fill="#c0d9ec" opacity="0.6" />
        <circle cx="190" cy="138" r="3.5" fill="#c0d9ec" opacity="0.5" />
        <circle cx="175" cy="144" r="4"  fill="#c0d9ec" opacity="0.5" />

        {/* Sun */}
        <circle cx="1200" cy="195" r="130" fill="url(#sc-sun)" />
        <circle cx="1200" cy="195" r="54"  fill="#FFE170" opacity="0.92" />
        {[0,30,60,90,120,150,180,210,240,270,300,330].map(a => (
          <line key={a}
            x1={1200 + Math.cos(a * Math.PI / 180) * 60}
            y1={195  + Math.sin(a * Math.PI / 180) * 60}
            x2={1200 + Math.cos(a * Math.PI / 180) * 82}
            y2={195  + Math.sin(a * Math.PI / 180) * 82}
            stroke="#FFE170" strokeWidth="2.5" opacity="0.55"
          />
        ))}
        <rect x="1120" y="556" width="160" height="120" fill="url(#sc-sunpath)" />

        {/* ── CLOUDS ── */}
        <g className="sc-cloud-1">
          <ellipse cx="200" cy="120" rx="65" ry="28" fill="white" opacity="0.22" />
          <ellipse cx="252" cy="106" rx="50" ry="24" fill="white" opacity="0.22" />
          <ellipse cx="305" cy="118" rx="58" ry="26" fill="white" opacity="0.22" />
          <ellipse cx="348" cy="126" rx="38" ry="18" fill="white" opacity="0.22" />
        </g>
        <g className="sc-cloud-2">
          <ellipse cx="620" cy="82"  rx="55" ry="26" fill="white" opacity="0.18" />
          <ellipse cx="675" cy="66"  rx="68" ry="32" fill="white" opacity="0.18" />
          <ellipse cx="732" cy="79"  rx="44" ry="20" fill="white" opacity="0.18" />
        </g>
        <g className="sc-cloud-3">
          <ellipse cx="940" cy="152" rx="48" ry="22" fill="white" opacity="0.15" />
          <ellipse cx="988" cy="136" rx="60" ry="28" fill="white" opacity="0.15" />
          <ellipse cx="1042" cy="150" rx="42" ry="19" fill="white" opacity="0.15" />
        </g>
        <g className="sc-cloud-4">
          <ellipse cx="380" cy="195" rx="42" ry="18" fill="white" opacity="0.14" />
          <ellipse cx="424" cy="182" rx="55" ry="25" fill="white" opacity="0.14" />
          <ellipse cx="472" cy="194" rx="40" ry="17" fill="white" opacity="0.14" />
        </g>

        {/* ── WIND STREAKS ── */}
        <g className="sc-wind-1">
          <line x1="0" y1="310" x2="210" y2="307" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.18"/>
          <line x1="0" y1="320" x2="120" y2="318" stroke="white" strokeWidth="1"   strokeLinecap="round" opacity="0.12"/>
        </g>
        <g className="sc-wind-2">
          <line x1="0" y1="415" x2="260" y2="412" stroke="white" strokeWidth="1.8" strokeLinecap="round" opacity="0.2"/>
          <line x1="0" y1="426" x2="150" y2="424" stroke="white" strokeWidth="1"   strokeLinecap="round" opacity="0.13"/>
        </g>
        <g className="sc-wind-3">
          <line x1="0" y1="200" x2="175" y2="198" stroke="white" strokeWidth="1"   strokeLinecap="round" opacity="0.14"/>
          <line x1="0" y1="210" x2="100" y2="208" stroke="white" strokeWidth="0.8" strokeLinecap="round" opacity="0.1"/>
        </g>
        <g className="sc-wind-4">
          <line x1="0" y1="475" x2="230" y2="473" stroke="white" strokeWidth="1.5" strokeLinecap="round" opacity="0.22"/>
          <line x1="0" y1="486" x2="140" y2="484" stroke="white" strokeWidth="1"   strokeLinecap="round" opacity="0.15"/>
        </g>
        <g className="sc-wind-5">
          <line x1="0" y1="155" x2="165" y2="153" stroke="white" strokeWidth="1"   strokeLinecap="round" opacity="0.12"/>
          <line x1="0" y1="165" x2="95"  y2="163" stroke="white" strokeWidth="0.8" strokeLinecap="round" opacity="0.08"/>
        </g>

        {/* ── OCEAN ── */}
        <rect y="556" width="1440" height="344" fill="url(#sc-ocean)" />

        {/* ── ISLANDS ── */}
        {/* Island left */}
        <g transform="translate(68,548)">
          <ellipse cx="90" cy="8"  rx="100" ry="15" fill="#1e4a0e" />
          <ellipse cx="90" cy="4"  rx="84"  ry="10" fill="#2a6612" />
          <ellipse cx="90" cy="10" rx="98"  ry="7"  fill="#c4a030" opacity="0.8" />
          <path d="M82,0 Q76,-18 70,-36 Q64,-52 60,-66" stroke="#4a2c0e" strokeWidth="3"   fill="none" strokeLinecap="round"/>
          <path d="M60,-66 Q38,-78 28,-70"              stroke="#246b14" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
          <path d="M60,-66 Q42,-90 35,-84"              stroke="#246b14" strokeWidth="4"   fill="none" strokeLinecap="round"/>
          <path d="M60,-66 Q60,-90 55,-96"              stroke="#2d8018" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          <path d="M60,-66 Q75,-88 82,-80"              stroke="#2d8018" strokeWidth="4"   fill="none" strokeLinecap="round"/>
          <path d="M60,-66 Q78,-76 85,-68"              stroke="#246b14" strokeWidth="4.5" fill="none" strokeLinecap="round"/>
          <path d="M118,0 Q124,-15 130,-30 Q136,-44 142,-54" stroke="#4a2c0e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <path d="M142,-54 Q162,-64 172,-58" stroke="#246b14" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          <path d="M142,-54 Q157,-70 156,-64" stroke="#2d8018" strokeWidth="3"   fill="none" strokeLinecap="round"/>
          <path d="M142,-54 Q126,-66 122,-60" stroke="#246b14" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          <ellipse cx="30" cy="6" rx="10" ry="6" fill="#4a4a3a" opacity="0.8"/>
        </g>

        {/* Island right */}
        <g transform="translate(1230,551)">
          <ellipse cx="55" cy="6"  rx="68" ry="11" fill="#1e4a0e" opacity="0.85" />
          <ellipse cx="55" cy="3"  rx="55" ry="8"  fill="#2a6612" opacity="0.85" />
          <ellipse cx="55" cy="8"  rx="66" ry="5"  fill="#c4a030" opacity="0.65" />
          <path d="M55,-1 Q50,-15 46,-28 Q42,-40 40,-50" stroke="#4a2c0e" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
          <path d="M40,-50 Q22,-60 15,-55" stroke="#246b14" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          <path d="M40,-50 Q28,-66 24,-61" stroke="#2d8018" strokeWidth="3"   fill="none" strokeLinecap="round"/>
          <path d="M40,-50 Q54,-64 58,-58" stroke="#246b14" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
          <path d="M40,-50 Q52,-58 58,-53" stroke="#2d8018" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
        </g>

        {/* ── ROCKS / STONES ── */}
        {/* Rock cluster A — centre-left */}
        <g transform="translate(365,549)">
          <path d="M0,12 L-6,0 L8,-4 L18,2 L20,12 Z"           fill="#2e3440" opacity="0.85"/>
          <path d="M14,12 L10,2 L22,-2 L30,4 L28,12 Z"          fill="#3a414f" opacity="0.8"/>
          <path d="M-2,12 L-10,5 L-4,-3 L4,0 L6,10 Z"          fill="#252c38" opacity="0.9"/>
          {/* White foam at base */}
          <path d="M-12,12 Q5,8 32,12" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" fill="none"/>
        </g>

        {/* Rock cluster B — centre */}
        <g transform="translate(695,550)">
          <path d="M0,10 L-8,0 L6,-6 L14,0 L12,10 Z"           fill="#2e3440" opacity="0.8"/>
          <path d="M10,10 L8,1 L18,-3 L24,3 L22,10 Z"          fill="#3a414f" opacity="0.75"/>
          <path d="M-5,10 L-12,4 L-5,-2 L2,2 Z"                fill="#252c38" opacity="0.85"/>
          <path d="M-14,10 Q4,6 26,10" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" fill="none"/>
        </g>

        {/* Rock cluster C — right of centre */}
        <g transform="translate(1070,550)">
          <path d="M0,11 L-5,0 L9,-5 L18,1 L16,11 Z"           fill="#2e3440" opacity="0.82"/>
          <path d="M12,11 L9,2 L20,-1 L26,5 L24,11 Z"          fill="#3a414f" opacity="0.78"/>
          <path d="M-2,11 L-9,5 L-2,-1 L5,3 Z"                 fill="#252c38" opacity="0.88"/>
          <path d="M-11,11 Q8,7 28,11" stroke="rgba(255,255,255,0.28)" strokeWidth="1.5" fill="none"/>
        </g>

        {/* ── DISTANT TINY BOATS (horizon silhouettes) ── */}
        <g opacity="0.5">
          <line  x1="520"  y1="550" x2="520"  y2="537" stroke="#aaa" strokeWidth="1" />
          <path  d="M520,550 L534,550 L520,537 Z" fill="rgba(220,220,220,0.7)" />
          <path  d="M506,550 Q520,554 534,550"    stroke="#6b4010" strokeWidth="1.2" fill="none" />
        </g>
        <g opacity="0.38">
          <line  x1="822"  y1="551" x2="822"  y2="541" stroke="#aaa" strokeWidth="0.8" />
          <path  d="M822,551 L833,551 L822,541 Z" fill="rgba(220,220,220,0.6)" />
          <path  d="M811,551 Q822,555 833,551"    stroke="#6b4010" strokeWidth="1" fill="none" />
        </g>

        {/* ── BOAT 1 — drifting left → right ── */}
        <g className="sc-b1-drift">
          <g className="sc-b1-bob">
            <rect x="-1.5" y="-110" width="3"   height="116" fill="#4a2c0e"/>
            <path d="M0,-105 Q68,-58 78,4 L0,0 Z"            fill="rgba(252,248,238,0.93)" stroke="rgba(180,160,120,0.4)" strokeWidth="0.6"/>
            <path d="M0,-88  Q-50,-44 -58,0 L0,0 Z"          fill="rgba(252,248,238,0.87)" stroke="rgba(180,160,120,0.4)" strokeWidth="0.5"/>
            <line x1="0" y1="3.5" x2="78" y2="3.5"          stroke="#4a2c0e" strokeWidth="1.8"/>
            <path d="M-58,0 C-32,22 32,26 84,13 L86,17 C32,30 -32,26 -61,5 Z" fill="#5a2a12"/>
            <path d="M-58,0 C-32,13 32,17 84,4  L84,13 C32,26 -32,22 -58,8 Z" fill="#8B3a14"/>
            <path d="M-58,0 C-32,13 32,17 84,4"              stroke="#D2600E" strokeWidth="1.5" fill="none"/>
            <rect x="-10" y="-14" width="34" height="14" rx="3" fill="#C8A86A"/>
            <rect x="-10" y="-14" width="34" height="4"  rx="2" fill="#B89058" opacity="0.6"/>
            <circle cx="4"  cy="-8" r="3.5" fill="#4a9fd4" opacity="0.75" stroke="#8B7355" strokeWidth="0.8"/>
            <circle cx="16" cy="-8" r="3.5" fill="#4a9fd4" opacity="0.75" stroke="#8B7355" strokeWidth="0.8"/>
            <path d="M0,-110 L18,-101 L0,-92 Z"              fill="#e74c3c"/>
            <path d="M-62,6 Q-30,10 0,6 Q30,10 88,5"        stroke="rgba(255,255,255,0.22)" strokeWidth="1.5" fill="none"/>
          </g>
        </g>

        {/* ── BOAT 2 — ANCHORED (fixed, gentle bob only) ── */}
        <g transform="translate(820, 552)">
          <g className="sc-b2-bob">
            {/* Mast */}
            <rect x="-1" y="-80" width="2.5" height="84" fill="#4a2c0e"/>
            {/* Sails hang limp / slightly furled — anchored so barely moving */}
            <path d="M0,-76 Q-30,-55 -35,0 L0,0 Z"         fill="rgba(240,235,220,0.75)" stroke="rgba(180,160,120,0.4)" strokeWidth="0.5"/>
            <path d="M0,-60 Q22,-40 24,0  L0,0 Z"           fill="rgba(240,235,220,0.7)"/>
            {/* Hull */}
            <path d="M-62,3 C-32,18 28,22 64,11 L66,14 C28,25 -32,21 -64,7 Z" fill="#5a2a12"/>
            <path d="M-62,0 C-32,11 28,14 64,3  L64,11 C28,22 -32,18 -62,7 Z" fill="#8B3a14"/>
            <path d="M-62,0 C-32,11 28,14 64,3"            stroke="#D2600E" strokeWidth="1" fill="none"/>
            <rect x="-6" y="-10" width="22" height="10" rx="2.5" fill="#C8A86A"/>
            <circle cx="4" cy="-6" r="2.5" fill="#4a9fd4" opacity="0.7" stroke="#8B7355" strokeWidth="0.7"/>
            {/* Flag — blue, hanging a bit down since wind is light here */}
            <path d="M0,-80 L-14,-74 L0,-68 Z"             fill="#3498db"/>

            {/* ── ANCHOR CHAIN — fades into deep water ── */}
            <path d="M-5,12 Q-4,22 -5,32 Q-6,42 -5,52 Q-4,62 -5,72 Q-6,82 -5,92"
              stroke="url(#sc-anchor-chain)" strokeWidth="2.2"
              strokeDasharray="4 3" fill="none" strokeLinecap="round"/>

            {/* ── ANCHOR — sitting on the seabed (visible through water) ── */}
            <g transform="translate(-5,95)" opacity="0.75">
              {/* Ring */}
              <circle cx="0"  cy="-8" r="5.5" fill="none" stroke="#6a7a8a" strokeWidth="1.8"/>
              {/* Shank */}
              <line x1="0" y1="-2.5" x2="0" y2="22" stroke="#5a6a7a" strokeWidth="2.5"/>
              {/* Stock (crossbar at top) */}
              <line x1="-14" y1="-2" x2="14" y2="-2" stroke="#5a6a7a" strokeWidth="2" strokeLinecap="round"/>
              {/* Crown */}
              <circle cx="0" cy="22" r="3" fill="#5a6a7a"/>
              {/* Left fluke */}
              <path d="M0,22 Q-14,24 -18,34 Q-16,38 -12,36 Q-10,28 0,26"
                fill="#5a6a7a" stroke="#5a6a7a" strokeWidth="0.5"/>
              {/* Right fluke */}
              <path d="M0,22 Q14,24 18,34 Q16,38 12,36 Q10,28 0,26"
                fill="#5a6a7a" stroke="#5a6a7a" strokeWidth="0.5"/>
              {/* Seabed shadow */}
              <ellipse cx="0" cy="38" rx="16" ry="4" fill="#0a2040" opacity="0.4"/>
            </g>

            {/* Water ripple from anchor chain */}
            <path d="M-22,6 Q-15,9 -5,7 Q5,5 14,7 Q28,9 50,5"
              stroke="rgba(255,255,255,0.2)" strokeWidth="1.2" fill="none"/>
          </g>
        </g>

        {/* ── DRIFTING PLANKS / DRIFTWOOD ── */}
        <g className="sc-plank-1">
          <rect x="-28" y="-3" width="56" height="5.5" rx="2.5" fill="#6B4F20" opacity="0.65"/>
          <rect x="-28" y="-3" width="56" height="1.5" rx="1"   fill="#8B6A30" opacity="0.5"/>
        </g>
        <g className="sc-plank-2">
          <rect x="-20" y="-2" width="40" height="4" rx="2" fill="#5A3D18" opacity="0.55"/>
        </g>
        <g className="sc-plank-3">
          <rect x="-15" y="-2" width="30" height="3.5" rx="1.5" fill="#7A5528" opacity="0.5"/>
        </g>

        {/* ── WAVES ── */}
        <g className="sc-wave-1"><path d={WAVE1} fill="#1a5c8a" opacity="0.55"/></g>
        <g className="sc-wave-2"><path d={WAVE2} fill="#2171b0" opacity="0.65"/></g>
        <g className="sc-wave-3">
          <path d={WAVE3} fill="#2e8bc0" opacity="0.72"/>
          <path d={FOAM3} stroke="rgba(255,255,255,0.32)" strokeWidth="2.2" fill="none"/>
        </g>

        {/* ── SEAGULLS ── */}
        <g className="sc-gull-1">
          <path d="M0,0 Q9,-6 18,0 Q27,-6 36,0"  stroke="rgba(255,255,255,0.75)" strokeWidth="1.8" fill="none" transform="translate(280,285)"/>
          <path d="M0,0 Q7,-5 14,0 Q21,-5 28,0"  stroke="rgba(255,255,255,0.65)" strokeWidth="1.5" fill="none" transform="translate(316,272)"/>
        </g>
        <g className="sc-gull-2">
          <path d="M0,0 Q11,-7 22,0 Q33,-7 44,0" stroke="rgba(255,255,255,0.65)" strokeWidth="2"   fill="none" transform="translate(0,345)"/>
        </g>
        <g className="sc-gull-3">
          <path d="M0,0 Q7,-4 14,0 Q21,-4 28,0"  stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" fill="none" transform="translate(0,265)"/>
        </g>

        {/* ── HORIZON SHIMMER ── */}
        <rect x="0" y="553" width="1440" height="5" fill="rgba(255,255,255,0.12)"/>

        {/* ── STORM (occasional — appears every ~45s, lasts ~10s) ── */}
        <g className="sc-storm-group" style={{ transformOrigin: "500px 180px" }}>
          {/* Sky darkening overlay */}
          <rect x="250" y="0" width="600" height="560" fill="#050a18" className="sc-storm-sky"/>

          {/* Storm cloud body */}
          <g className="sc-storm-cloud">
            <ellipse cx="500" cy="215" rx="140" ry="60" fill="#1a2230"/>
            <ellipse cx="420" cy="228" rx="90"  ry="50" fill="#1e2840"/>
            <ellipse cx="580" cy="222" rx="105" ry="54" fill="#1e2840"/>
            <ellipse cx="500" cy="200" rx="125" ry="48" fill="#252e42"/>
            <ellipse cx="460" cy="190" rx="85"  ry="40" fill="#2c3650" opacity="0.9"/>
            <ellipse cx="540" cy="193" rx="95"  ry="42" fill="#2c3650" opacity="0.9"/>
            {/* Inner dark turbulent core */}
            <ellipse cx="500" cy="220" rx="110" ry="45" fill="#0d1220" opacity="0.6"/>
          </g>

          {/* Rain — two staggered layers for density */}
          <g className="sc-rain-a">
            {RAIN_A.map(([x, y], i) => (
              <line key={i}
                x1={310 + x} y1={y}
                x2={304 + x} y2={y + 35}
                stroke="rgba(160,210,255,0.45)" strokeWidth="1.1" strokeLinecap="round"
              />
            ))}
          </g>
          <g className="sc-rain-b">
            {RAIN_B.map(([x, y], i) => (
              <line key={i}
                x1={310 + x} y1={y}
                x2={304 + x} y2={y + 35}
                stroke="rgba(140,195,255,0.35)" strokeWidth="0.9" strokeLinecap="round"
              />
            ))}
          </g>

          {/* Lightning bolt */}
          <path className="sc-lightning"
            d="M498,205 L480,248 L496,248 L468,300 L500,252 L484,252 Z"
            fill="#fff8c0" filter="none"
          />
          {/* Lightning glow */}
          <path className="sc-lightning"
            d="M498,205 L480,248 L496,248 L468,300 L500,252 L484,252 Z"
            fill="rgba(255,240,100,0.3)" strokeWidth="8" stroke="rgba(255,240,100,0.15)"
          />

          {/* Storm sea swell lines */}
          <g className="sc-storm-swell">
            <path d="M300,560 C340,548 380,572 420,560 C460,548 500,572 540,560 C580,548 620,572 660,560 C700,548 740,572 780,560 C820,548 860,572 900,560"
              stroke="rgba(255,255,255,0.35)" strokeWidth="3" fill="none"/>
            <path d="M310,568 C355,556 395,578 440,568 C480,556 525,578 570,568 C610,556 650,578 695,568 C735,556 775,578 820,568 C860,556 900,578 940,568"
              stroke="rgba(255,255,255,0.25)" strokeWidth="2.5" fill="none"/>
          </g>
        </g>

      </svg>

      <style jsx global>{`
        /* ── WAVES ── */
        @keyframes sc-wave-scroll {
          from { transform: translateX(0); }
          to   { transform: translateX(-1440px); }
        }
        .sc-wave-1 { animation: sc-wave-scroll 24s linear infinite; }
        .sc-wave-2 { animation: sc-wave-scroll 16s linear infinite; }
        .sc-wave-3 { animation: sc-wave-scroll 10s linear infinite; }

        /* ── BOAT 1 drift ── */
        @keyframes sc-b1-drift {
          from { transform: translate(-180px, 549px); }
          to   { transform: translate(1640px, 549px); }
        }
        @keyframes sc-b1-bob {
          0%, 100% { transform: translateY(0px)  rotate(-1.4deg); }
          50%       { transform: translateY(-7px) rotate(2deg); }
        }
        .sc-b1-drift { animation: sc-b1-drift 95s linear infinite; }
        .sc-b1-bob   { animation: sc-b1-bob   3.4s ease-in-out infinite; }

        /* ── BOAT 2 anchored bob (no drift) ── */
        @keyframes sc-b2-bob {
          0%, 100% { transform: translateY(0px)  rotate(-0.8deg); }
          30%       { transform: translateY(-4px) rotate(0.5deg); }
          70%       { transform: translateY(-2px) rotate(-0.4deg); }
        }
        .sc-b2-bob { animation: sc-b2-bob 4.5s ease-in-out infinite; }

        /* ── DRIFTING PLANKS ── */
        @keyframes sc-plank-d1 {
          from { transform: translate(-100px, 580px) rotate(-3deg); }
          to   { transform: translate(1540px, 584px) rotate(4deg); }
        }
        @keyframes sc-plank-d2 {
          from { transform: translate(-100px, 610px) rotate(5deg); }
          to   { transform: translate(1540px, 606px) rotate(-3deg); }
        }
        @keyframes sc-plank-d3 {
          from { transform: translate(1540px, 595px) rotate(-4deg); }
          to   { transform: translate(-100px, 599px) rotate(3deg); }
        }
        .sc-plank-1 { animation: sc-plank-d1 55s linear infinite; animation-delay: -10s; }
        .sc-plank-2 { animation: sc-plank-d2 70s linear infinite; animation-delay: -35s; }
        .sc-plank-3 { animation: sc-plank-d3 60s linear infinite; animation-delay: -20s; }

        /* ── CLOUDS ── */
        @keyframes sc-cloud-scroll {
          from { transform: translateX(-450px); }
          to   { transform: translateX(1840px); }
        }
        .sc-cloud-1 { animation: sc-cloud-scroll 65s  linear infinite; }
        .sc-cloud-2 { animation: sc-cloud-scroll 85s  linear infinite; animation-delay: -28s; }
        .sc-cloud-3 { animation: sc-cloud-scroll 72s  linear infinite; animation-delay: -48s; }
        .sc-cloud-4 { animation: sc-cloud-scroll 100s linear infinite; animation-delay: -16s; }

        /* ── WIND STREAKS ── */
        @keyframes sc-wind-streak {
          0%   { transform: translateX(-350px); opacity: 0; }
          12%  { opacity: 1; }
          88%  { opacity: 1; }
          100% { transform: translateX(1790px); opacity: 0; }
        }
        .sc-wind-1 { animation: sc-wind-streak 8s  ease-in-out infinite; }
        .sc-wind-2 { animation: sc-wind-streak 12s ease-in-out infinite; animation-delay: -4s; }
        .sc-wind-3 { animation: sc-wind-streak 9s  ease-in-out infinite; animation-delay: -7s; }
        .sc-wind-4 { animation: sc-wind-streak 14s ease-in-out infinite; animation-delay: -2s; }
        .sc-wind-5 { animation: sc-wind-streak 7s  ease-in-out infinite; animation-delay: -5s; }

        /* ── SEAGULLS ── */
        @keyframes sc-gull-1 {
          0%   { transform: translate(-120px, 0);     opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translate(1560px, -25px); opacity: 0; }
        }
        @keyframes sc-gull-2 {
          0%   { transform: translate(-120px, 0);    opacity: 0; }
          8%   { opacity: 1; }
          92%  { opacity: 1; }
          100% { transform: translate(1560px, 18px); opacity: 0; }
        }
        @keyframes sc-gull-3 {
          from { transform: translate(-120px, 0);     opacity: 0.6; }
          to   { transform: translate(1560px, -12px); opacity: 0; }
        }
        .sc-gull-1 { animation: sc-gull-1 38s linear infinite; animation-delay: -12s; }
        .sc-gull-2 { animation: sc-gull-2 50s linear infinite; animation-delay: -25s; }
        .sc-gull-3 { animation: sc-gull-3 32s linear infinite; animation-delay: -8s; }

        /* ── STORM CYCLE (45s total: storm ~8s, calm 37s) ── */
        /* storm-group: fades whole storm in/out */
        @keyframes sc-storm-fade {
          0%,  4%           { opacity: 0; transform: scale(0.95); }
          10%, 20%          { opacity: 1; transform: scale(1); }
          26%, 100%         { opacity: 0; transform: scale(0.95); }
        }
        .sc-storm-group {
          animation: sc-storm-fade 45s ease-in-out infinite;
          animation-delay: -30s;
        }

        /* Sky darkening — slightly delayed start */
        @keyframes sc-storm-sky-fade {
          0%,  6%           { opacity: 0; }
          12%, 20%          { opacity: 0.5; }
          28%, 100%         { opacity: 0; }
        }
        .sc-storm-sky {
          animation: sc-storm-sky-fade 45s ease-in-out infinite;
          animation-delay: -30s;
        }

        /* Cloud: same fade as group but driven by parent */
        .sc-storm-cloud { opacity: 1; }

        /* Rain falls continuously — only visible when parent group is visible */
        @keyframes sc-rain-fall {
          from { transform: translateY(0px); }
          to   { transform: translateY(40px); }
        }
        .sc-rain-a { animation: sc-rain-fall 0.45s linear infinite; }
        .sc-rain-b { animation: sc-rain-fall 0.45s linear infinite; animation-delay: -0.22s; }

        /* Lightning flashes 2-3 times inside the storm window */
        @keyframes sc-lightning-flash {
          0%,  10.5%, 12%,  14.5%, 16%,  18%, 100% { opacity: 0; }
          11%                                         { opacity: 1; }
          13%                                         { opacity: 0.6; }
          15%                                         { opacity: 1; }
          17%                                         { opacity: 0.4; }
        }
        .sc-lightning {
          animation: sc-lightning-flash 45s ease-in-out infinite;
          animation-delay: -30s;
        }

        /* Storm swell — same parent-driven visibility */
        .sc-storm-swell { opacity: 1; }
      `}</style>
    </div>
  );
}
