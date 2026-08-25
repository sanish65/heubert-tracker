"use client";

import { LazyMotion, MotionConfig } from "motion/react";
import { useApp } from "@/context/AppContext";

// Kept as a separate module so Turbopack can split it into its own lazy chunk.
const loadFeatures = () => import("@/lib/motionFeatures").then((m) => m.default);

/**
 * App-wide defaults for motion/react.
 *
 * LazyMotion + the `m` component keep the animation engine out of the initial
 * bundle — components must import `m` from "motion/react-m", never `motion`
 * from "motion/react", or the whole feature set gets pulled back in eagerly.
 * `strict` makes that mistake throw in development instead of silently
 * doubling the bundle.
 *
 * `reducedMotion` is wired to the existing Animations toggle (AnimationToggle):
 *   - on  → "user", so the OS `prefers-reduced-motion` setting decides
 *   - off → "always", so motion skips transform/layout animation everywhere
 * Either way opacity still animates, which keeps state changes legible.
 */
export default function MotionProvider({ children }) {
  const { animationsEnabled } = useApp();

  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig
        reducedMotion={animationsEnabled ? "user" : "always"}
        transition={{ type: "spring", stiffness: 380, damping: 30, mass: 0.8 }}
      >
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
