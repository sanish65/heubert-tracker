// Whether decorative motion (the loader, the skeleton shimmer) may play: the app's Animations
// setting and the phone's reduce-motion setting, either one off means still (criterion 11 of
// docs/mobile-ui-revamp/intent.md). Pure (no imports), so src/lib/mobileMotion.test.mjs loads it
// under plain Node; the hook that feeds it is lib/useMotionAllowed.js.
//
// `reduceMotion` is null until the phone has answered, and that counts as still: someone who asked
// for less motion never sees a frame of it. Animations not loaded yet counts as on, as the app has
// always read it (`animationsEnabled === false` is the only off).
export function motionAllowed(animationsEnabled, reduceMotion) {
  return animationsEnabled !== false && reduceMotion === false;
}
