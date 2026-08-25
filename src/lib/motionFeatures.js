// Dynamically imported by <MotionProvider> so the animation engine loads after
// first paint instead of sitting in the initial bundle.
//
// domAnimation = animations + enter/exit + hover/tap/focus gestures, which is
// everything we currently use. Swap to `domMax` if we add drag or layout
// animations (bigger, but adds the layout-projection engine).
import { domAnimation } from "framer-motion";

export default domAnimation;
