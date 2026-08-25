"use client";

import { useEffect } from "react";
import { useMotionValue, useSpring, useTransform } from "motion/react";
import { div as MotionDiv } from "motion/react-m";
import { useApp } from "@/context/AppContext";

/**
 * Cursor-reactive ambient background.
 *
 * A fixed layer behind all page content, so it shows through the empty gutters
 * either side of the 1200px .app-shell and gets picked up by the glass cards'
 * backdrop-filter as they sit over it.
 *
 * Two kinds of blob:
 *   - `tracks: true` follows the cursor directly with spring lag. This is the
 *     one that makes the effect legible — measured against anchored blobs alone,
 *     a ~200px drift of a 660px blurred blob moved the gutter's mean colour by
 *     0.3/255, i.e. invisibly.
 *   - the rest are anchored at a fixed % of the viewport and drift *toward* the
 *     cursor by at most `drift` px, on softer springs so they trail the leader.
 *     They carry the ambient wash; the tracker carries the reaction.
 */
const BLOBS = [
  {
    color: "rgba(129, 140, 248, 0.34)", // follows the cursor
    size: 620,
    tracks: true,
    spring: { stiffness: 90, damping: 26, mass: 0.7 },
  },
  {
    color: "rgba(99, 102, 241, 0.30)", // indigo — left gutter
    size: 760,
    x: "6%",
    y: "20%",
    drift: 170,
    spring: { stiffness: 26, damping: 18, mass: 1.2 },
  },
  {
    color: "rgba(139, 92, 246, 0.26)", // violet — right gutter
    size: 660,
    x: "94%",
    y: "44%",
    drift: 230,
    spring: { stiffness: 44, damping: 20, mass: 0.9 },
  },
  {
    color: "rgba(129, 140, 248, 0.18)", // pale indigo — bottom left, trails
    size: 560,
    x: "10%",
    y: "88%",
    drift: 120,
    spring: { stiffness: 18, damping: 16, mass: 1.4 },
  },
];

function AuroraBlob({ color, size, x, y, drift = 0, spring, tracks, nx, ny, px, py, revealed }) {
  // Vertical drift is damped — full-strength Y movement makes the anchored blobs
  // feel like they're sliding rather than floating.
  const driftX = useTransform(nx, (v) => v * drift);
  const driftY = useTransform(ny, (v) => v * drift * 0.55);

  const offsetX = useSpring(tracks ? px : driftX, spring);
  const offsetY = useSpring(tracks ? py : driftY, spring);

  return (
    <MotionDiv
      className="aurora-blob"
      style={{
        left: tracks ? 0 : x,
        top: tracks ? 0 : y,
        width: size,
        height: size,
        background: `radial-gradient(circle, ${color}, transparent 70%)`,
        x: offsetX,
        y: offsetY,
        // The tracker starts invisible so its initial spring from 0,0 to the
        // viewport centre is never seen; it fades in on the first mouse move.
        ...(tracks ? { opacity: revealed } : null),
      }}
    />
  );
}

export default function AmbientAurora() {
  const { animationsEnabled } = useApp();

  // Cursor offset from viewport centre, -0.5 … 0.5 on each axis.
  const nx = useMotionValue(0);
  const ny = useMotionValue(0);
  // Absolute cursor position, for the tracking blob.
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const revealed = useSpring(0, { stiffness: 55, damping: 24 });

  useEffect(() => {
    if (!animationsEnabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Park the tracker at the centre while it's still transparent.
    px.set(window.innerWidth / 2);
    py.set(window.innerHeight / 2);

    // The layer is pointer-events: none and mostly sits under content, so the
    // cursor is tracked on the window rather than on the layer itself.
    const onMove = (e) => {
      // Don't gate on matchMedia("(hover: none)") — a touchscreen laptop reports
      // that even with a mouse attached. Filter per event instead, so a hybrid
      // device animates for the mouse and stays still for a finger.
      if (e.pointerType === "touch") return;
      nx.set(e.clientX / window.innerWidth - 0.5);
      ny.set(e.clientY / window.innerHeight - 0.5);
      px.set(e.clientX);
      py.set(e.clientY);
      revealed.set(1);
    };

    const onLeave = () => {
      nx.set(0);
      ny.set(0);
      revealed.set(0);
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    document.documentElement.addEventListener("pointerleave", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("pointerleave", onLeave);
    };
  }, [animationsEnabled, nx, ny, px, py, revealed]);

  return (
    <div className="aurora-layer" aria-hidden="true">
      {BLOBS.map((blob, i) => (
        <AuroraBlob key={i} {...blob} nx={nx} ny={ny} px={px} py={py} revealed={revealed} />
      ))}
    </div>
  );
}
