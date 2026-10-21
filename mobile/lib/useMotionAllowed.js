import { useSyncExternalStore } from "react";
import { AccessibilityInfo } from "react-native";
import { useApp } from "../context/AppContext";
import { motionAllowed } from "./motion";

// The phone's reduce-motion setting, read once and kept current through its change listener. One
// native subscription for the whole app, however many components ask (a skeleton list has a dozen
// blocks); it is dropped when the last one unmounts. null until the phone answers.
let reduceMotion = null;
let subscription = null;
const listeners = new Set();

function publish(value) {
  reduceMotion = value;
  listeners.forEach((listener) => listener());
}

function subscribe(listener) {
  listeners.add(listener);
  if (!subscription) {
    subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => publish(!!enabled));
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => publish(!!enabled))
      // A phone that cannot say has not asked for less motion; the Animations setting still applies.
      .catch(() => publish(false));
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && subscription) {
      subscription.remove();
      subscription = null;
    }
  };
}

const getReduceMotion = () => reduceMotion;

// True when decorative motion may play: Animations on in the app and reduce-motion off on the phone.
export default function useMotionAllowed() {
  const { animationsEnabled } = useApp() || {};
  const reduce = useSyncExternalStore(subscribe, getReduceMotion);
  return motionAllowed(animationsEnabled, reduce);
}
