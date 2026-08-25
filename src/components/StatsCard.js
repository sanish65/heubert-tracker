"use client";

import { useRef } from "react";
import { useMotionValue, useSpring, useMotionTemplate } from "motion/react";
import { div as MotionDiv } from "motion/react-m";
import { useApp } from "@/context/AppContext";

const TILT_SPRING = { stiffness: 260, damping: 22, mass: 0.6 };
const GLOW_SPRING = { stiffness: 200, damping: 30 };
const TILT_DEGREES = 8;
const GLOW_STRENGTH = 0.16;

export default function StatsCard({ icon, label, value, sub, color }) {
  const { animationsEnabled } = useApp();
  const ref = useRef(null);

  // Spotlight position tracks the cursor exactly — springing it would make the
  // highlight lag behind the pointer, which reads as sluggish rather than smooth.
  const mx = useMotionValue(50);
  const my = useMotionValue(50);

  // Tilt and glow are sprung so they settle and recover instead of snapping.
  const rotateX = useSpring(0, TILT_SPRING);
  const rotateY = useSpring(0, TILT_SPRING);
  const glow = useSpring(0, GLOW_SPRING);

  const spotlight = useMotionTemplate`radial-gradient(300px circle at ${mx}% ${my}%, ${color}, transparent 60%)`;

  const handlePointerMove = (e) => {
    if (!animationsEnabled || e.pointerType !== "mouse" || !ref.current) return;

    const rect = ref.current.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;

    mx.set(px * 100);
    my.set(py * 100);
    rotateX.set((0.5 - py) * TILT_DEGREES);
    rotateY.set((px - 0.5) * TILT_DEGREES);
    glow.set(GLOW_STRENGTH);
  };

  const handlePointerLeave = () => {
    rotateX.set(0);
    rotateY.set(0);
    glow.set(0);
  };

  return (
    <MotionDiv
      ref={ref}
      className="stats-card"
      style={{ "--card-accent": color, rotateX, rotateY, transformPerspective: 900 }}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      whileHover={{ y: -2 }}
      transition={TILT_SPRING}
    >
      <MotionDiv
        className="stats-card-glow"
        style={{ background: spotlight, opacity: glow }}
        aria-hidden="true"
      />
      <div className="stats-card-icon">{icon}</div>
      <div className="stats-card-info">
        <span className="stats-card-value">{value}</span>
        <span className="stats-card-label">{label}</span>
        {sub && <span className="stats-card-sub">{sub}</span>}
      </div>
    </MotionDiv>
  );
}
