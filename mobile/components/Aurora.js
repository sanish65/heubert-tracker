// The canvas aurora: the four soft colour blobs behind every screen, as the mobile artboards'
// `.ht .aurora` rule draws them (docs/mobile-ui-revamp/design/Mobile*.dc.html, the same rule in
// all twenty). React Native has no CSS gradients, so each blob is a react-native-svg ellipse with a
// radial gradient. The layer is pinned to the screen; content scrolls over it.
//
// Still on purpose: nothing here animates, so it is the same with Animations off or the phone's
// reduce-motion setting on (criterion 11). The canvas's faint dot grid is left out: it is 3% white,
// and its drawing cost on a phone was not measured.
import { memo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { useApp } from "../context/AppContext";
import { tokens } from "../lib/tokens";

// CSS `radial-gradient(RXpx RYpx at X% Y%, rgba(colour, a), transparent 70%)`: RX and RY are the
// radii of the ending ellipse, and the colour is gone at 70% of them. So each blob is an ellipse of
// 0.7 x those radii, filled from the colour at `a` in its centre to the same colour at 0 on its
// edge (the same colour, not transparent black, so the fade never darkens on Android).
const FADE_END = 0.7;

const BLOBS = tokens.aurora;

// Memoised on the theme: every screen re-renders on any app state change, the blobs only when the
// theme flips. The theme is in the gradient ids so a flip defines new gradients rather than
// repainting old ones.
const AuroraBlobs = memo(function AuroraBlobs({ theme }) {
  const blobs = BLOBS[theme];
  return (
    <Svg width="100%" height="100%">
      <Defs>
        {blobs.map((blob, i) => (
          <RadialGradient key={i} id={`aurora-${theme}-${i}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={blob.color} stopOpacity={blob.alpha} />
            <Stop offset="1" stopColor={blob.color} stopOpacity={0} />
          </RadialGradient>
        ))}
      </Defs>
      {blobs.map((blob, i) => (
        <Ellipse
          key={i}
          cx={blob.cx}
          cy={blob.cy}
          rx={blob.rx * FADE_END}
          ry={blob.ry * FADE_END}
          fill={`url(#aurora-${theme}-${i})`}
        />
      ))}
    </Svg>
  );
});

export default function Aurora() {
  const { theme } = useApp();
  // Decoration only: never touchable, never read out.
  return (
    <View
      pointerEvents="none"
      style={styles.layer}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      <AuroraBlobs theme={theme === "light" ? "light" : "dark"} />
    </View>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFill, overflow: "hidden" },
});
