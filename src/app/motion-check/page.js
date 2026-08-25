"use client";

import { useEffect, useState } from "react";
import { useMotionValue, useSpring, useTransform, AnimatePresence } from "motion/react";
import { div as MotionDiv } from "motion/react-m";
import { useApp } from "@/context/AppContext";
import StatsCard from "@/components/StatsCard";

const box = {
  width: 120,
  height: 120,
  borderRadius: 16,
  display: "grid",
  placeItems: "center",
  fontWeight: 700,
  color: "#fff",
};

export default function MotionCheck() {
  const { animationsEnabled, toggleAnimations, theme } = useApp();
  const [env, setEnv] = useState(null);
  const [showExit, setShowExit] = useState(true);

  // Test A — motion values written straight to style. This is the mechanism the
  // aurora and the card spotlight use; it works with or without LazyMotion.
  const nx = useMotionValue(0);
  const slide = useSpring(useTransform(nx, (v) => v * 260), { stiffness: 60, damping: 18 });

  useEffect(() => {
    const onMove = (e) => nx.set(e.clientX / window.innerWidth - 0.5);
    window.addEventListener("pointermove", onMove, { passive: true });
    // Diagnostics page only: these values exist solely to be read off the screen,
    // and matchMedia/innerWidth are unavailable until after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv({
      reduced: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      hoverNone: window.matchMedia("(hover: none)").matches,
      width: window.innerWidth,
      stored: localStorage.getItem("heubert-animations"),
    });
    return () => window.removeEventListener("pointermove", onMove);
  }, [nx]);

  const row = (k, v, bad) => (
    <tr key={k}>
      <td style={{ padding: "6px 16px 6px 0", color: "var(--text-secondary)" }}>{k}</td>
      <td style={{ padding: "6px 0", fontWeight: 700, color: bad ? "var(--accent-red)" : "var(--accent-green)" }}>
        {String(v)}
      </td>
    </tr>
  );

  return (
    <div className="app-shell" style={{ paddingTop: 32, paddingBottom: 64 }}>
      <h1 style={{ marginBottom: 8 }}>Motion diagnostics</h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
        Move your mouse around, then hover each box. Tell me which tests move.
      </p>

      <table style={{ marginBottom: 32, fontSize: 14 }}>
        <tbody>
          {env === null
            ? row("state", "reading…", true)
            : [
                row("animationsEnabled (app toggle)", animationsEnabled, !animationsEnabled),
                row("localStorage heubert-animations", env.stored ?? "(unset → defaults on)", env.stored === "false"),
                row("OS prefers-reduced-motion", env.reduced, env.reduced),
                row("matchMedia (hover: none)", env.hoverNone, env.hoverNone),
                row("theme", theme, false),
                row("viewport width", env.width + "px  (gutters exist above 1200)", env.width < 1200),
              ]}
        </tbody>
      </table>

      <button className="btn btn-primary" onClick={toggleAnimations} style={{ marginBottom: 32 }}>
        Toggle animations (currently {animationsEnabled ? "ON" : "OFF"})
      </button>

      <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 40 }}>
        <div>
          <p style={{ marginBottom: 8, fontSize: 13 }}>A — motion core (follows mouse X)</p>
          <MotionDiv style={{ ...box, background: "var(--accent-indigo)", x: slide }}>A</MotionDiv>
        </div>

        <div>
          <p style={{ marginBottom: 8, fontSize: 13 }}>B — gestures (hover me)</p>
          <MotionDiv
            style={{ ...box, background: "var(--accent-green)" }}
            whileHover={{ scale: 1.35, rotate: 8 }}
          >
            B
          </MotionDiv>
        </div>

        <div>
          <p style={{ marginBottom: 8, fontSize: 13 }}>C — exit animation</p>
          <AnimatePresence>
            {showExit && (
              <MotionDiv
                style={{ ...box, background: "var(--accent-amber)" }}
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6, rotate: -20 }}
              >
                C
              </MotionDiv>
            )}
          </AnimatePresence>
          <button className="btn btn-ghost" onClick={() => setShowExit((s) => !s)} style={{ marginTop: 8 }}>
            toggle C
          </button>
        </div>
      </div>

      <p style={{ marginBottom: 8, fontSize: 13 }}>D — the real StatsCard (hover for tilt + spotlight)</p>
      <div style={{ display: "flex", gap: 16, maxWidth: 700 }}>
        <StatsCard icon="✅" label="Present" value="12" color="var(--accent-green)" />
        <StatsCard icon="⏰" label="Late" value="3" sub="this week" color="var(--accent-amber)" />
      </div>
    </div>
  );
}
