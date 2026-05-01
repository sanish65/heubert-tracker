"use client";

/**
 * HuebertLogo3D
 * A 3D animated loading logo built from the first letters of employee names.
 * Team: Sanish · Nikhil · Pranay · Pratisha · Bhoomi · Sameer
 * Initials arranged on a 3D-rotating ring + a central "H" nucleus.
 */

export default function HuebertLogo3D({ size = 180 }) {
  // Employee initials in order – one per orbital node
  const members = [
    { letter: "S", name: "Sanish",   color: "#7C3AED" },
    { letter: "N", name: "Nikhil",   color: "#2563EB" },
    { letter: "P", name: "Pranay",   color: "#059669" },
    { letter: "P", name: "Pratisha", color: "#D97706" },
    { letter: "B", name: "Bhoomi",   color: "#DB2777" },
    { letter: "S", name: "Sameer",   color: "#0891B2" },
  ];

  const count  = members.length;
  const radius = size * 0.38;          // orbit radius
  const nodeR  = size * 0.115;         // node circle radius
  const cx     = size / 2;
  const cy     = size / 2;

  // Evenly placed angles (degrees)
  const angles = members.map((_, i) => (360 / count) * i - 90);

  return (
    <div
      className="heubert-logo-3d-wrapper"
      style={{ width: size, height: size, position: "relative" }}
    >
      {/* ── Keyframe styles injected once ── */}
      <style>{`
        @keyframes hb-spin {
          from { transform: rotateY(0deg) rotateX(15deg); }
          to   { transform: rotateY(360deg) rotateX(15deg); }
        }
        @keyframes hb-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.5); }
          50%       { box-shadow: 0 0 0 ${nodeR * 0.8}px rgba(124,58,237,0); }
        }
        @keyframes hb-glow {
          0%, 100% { opacity: 0.55; transform: scale(1);   }
          50%       { opacity: 1;    transform: scale(1.08); }
        }
        @keyframes hb-node-bob {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-4px); }
        }
        @keyframes hb-ring-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes hb-counter-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }

        .hb-scene {
          width: 100%;
          height: 100%;
          perspective: ${size * 3}px;
          perspective-origin: 50% 45%;
        }
        .hb-stage {
          width: 100%;
          height: 100%;
          position: relative;
          transform-style: preserve-3d;
          animation: hb-spin 8s linear infinite;
        }

        /* Orbital ring plane */
        .hb-ring-svg {
          position: absolute;
          top: 0; left: 0;
          width: 100%; height: 100%;
          pointer-events: none;
        }

        /* Central nucleus */
        .hb-nucleus {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: ${nodeR * 1.9}px;
          height: ${nodeR * 1.9}px;
          border-radius: 50%;
          background: linear-gradient(135deg, #7C3AED 0%, #2563EB 100%);
          display: flex; align-items: center; justify-content: center;
          font-family: 'Inter', 'Segoe UI', sans-serif;
          font-size: ${nodeR * 1.1}px;
          font-weight: 800;
          color: #fff;
          letter-spacing: -0.5px;
          animation: hb-pulse 2.4s ease-in-out infinite;
          z-index: 10;
        }

        /* Orbital nodes */
        .hb-node {
          position: absolute;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Inter', 'Segoe UI', sans-serif;
          font-weight: 700;
          color: #fff;
          z-index: 5;
          animation: hb-counter-spin 8s linear infinite,
                     hb-node-bob 2.5s ease-in-out infinite;
          cursor: default;
          user-select: none;
        }
        .hb-node::after {
          content: '';
          position: absolute;
          inset: -3px;
          border-radius: 50%;
          background: transparent;
          border: 2px solid rgba(255,255,255,0.25);
        }

        /* Ring track */
        .hb-track {
          fill: none;
          stroke: rgba(255,255,255,0.08);
          stroke-width: 1.5;
          stroke-dasharray: 6 4;
        }
        /* Glowing ring highlight */
        .hb-track-glow {
          fill: none;
          stroke: url(#hb-ring-grad);
          stroke-width: 2;
          opacity: 0.5;
          animation: hb-glow 3s ease-in-out infinite;
        }
      `}</style>

      <div className="hb-scene">
        <div className="hb-stage">

          {/* SVG ring tracks */}
          <svg className="hb-ring-svg" viewBox={`0 0 ${size} ${size}`}>
            <defs>
              <linearGradient id="hb-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="#7C3AED" stopOpacity="0.8" />
                <stop offset="50%"  stopColor="#2563EB" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#DB2777" stopOpacity="0.8" />
              </linearGradient>
            </defs>
            {/* Elliptical orbit (3D perspective trick) */}
            <ellipse
              className="hb-track"
              cx={cx} cy={cy}
              rx={radius} ry={radius * 0.32}
            />
            <ellipse
              className="hb-track-glow"
              cx={cx} cy={cy}
              rx={radius} ry={radius * 0.32}
            />
            {/* Connector lines from center to each node */}
            {angles.map((deg, i) => {
              const rad = (deg * Math.PI) / 180;
              const nx = cx + radius * Math.cos(rad);
              const ny = cy + radius * Math.sin(rad) * 0.32;
              return (
                <line
                  key={i}
                  x1={cx} y1={cy} x2={nx} y2={ny}
                  stroke={members[i].color}
                  strokeWidth="0.8"
                  strokeOpacity="0.3"
                />
              );
            })}
          </svg>

          {/* Orbital member nodes */}
          {members.map((m, i) => {
            const deg = angles[i];
            const rad = (deg * Math.PI) / 180;
            const nx = cx + radius * Math.cos(rad);
            const ny = cy + radius * Math.sin(rad) * 0.32;
            const delay = `${(i * 0.4).toFixed(1)}s`;
            return (
              <div
                key={i}
                className="hb-node"
                title={m.name}
                style={{
                  left: nx - nodeR,
                  top:  ny - nodeR,
                  width:  nodeR * 2,
                  height: nodeR * 2,
                  fontSize: nodeR * 0.9,
                  background: `radial-gradient(circle at 35% 35%, ${m.color}cc, ${m.color}ff)`,
                  boxShadow: `0 0 ${nodeR}px ${m.color}80`,
                  animationDelay: delay,
                }}
              >
                {m.letter}
              </div>
            );
          })}

          {/* Central "H" nucleus */}
          <div className="hb-nucleus">H</div>

        </div>
      </div>
    </div>
  );
}
