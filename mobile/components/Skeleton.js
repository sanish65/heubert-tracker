import { useState } from "react";
import { View, Animated, Easing, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { useThemeColors } from "../lib/theme";
import { Card } from "./ui";

const shimmerProgress = new Animated.Value(0);
Animated.loop(
  Animated.timing(shimmerProgress, {
    toValue: 1,
    duration: 1400,
    easing: Easing.linear,
    useNativeDriver: true,
  })
).start();

export function SkeletonBlock({ width = "100%", height = 14, radius = 6, style }) {
  const t = useThemeColors();
  const [measuredWidth, setMeasuredWidth] = useState(typeof width === "number" ? width : 0);

  const translateX = shimmerProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [-Math.max(measuredWidth, 1), Math.max(measuredWidth, 1)],
  });

  return (
    <View
      onLayout={(e) => setMeasuredWidth(e.nativeEvent.layout.width)}
      style={[{ width, height, borderRadius: radius, backgroundColor: t.border, overflow: "hidden" }, style]}
    >
      {measuredWidth > 0 && (
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateX }] }]}>
          <Svg width={measuredWidth} height={height}>
            <Defs>
              <LinearGradient id="shimmer-gradient" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor={t.textPrimary} stopOpacity={0} />
                <Stop offset="0.5" stopColor={t.textPrimary} stopOpacity={0.16} />
                <Stop offset="1" stopColor={t.textPrimary} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width={measuredWidth} height={height} fill="url(#shimmer-gradient)" />
          </Svg>
        </Animated.View>
      )}
    </View>
  );
}

export function SkeletonCircle({ size = 34, style }) {
  return <SkeletonBlock width={size} height={size} radius={size / 2} style={style} />;
}

export function SkeletonRow({ avatar = false, rightWidth = 0, divider = false }) {
  const t = useThemeColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 10,
        borderBottomWidth: divider ? 1 : 0,
        borderBottomColor: t.border,
      }}
    >
      {avatar && <SkeletonCircle size={34} style={{ marginRight: 10 }} />}
      <View style={{ flex: 1 }}>
        <SkeletonBlock width="60%" height={14} style={{ marginBottom: 6 }} />
        <SkeletonBlock width="40%" height={11} />
      </View>
      {rightWidth > 0 && <SkeletonBlock width={rightWidth} height={20} radius={6} style={{ marginLeft: 10 }} />}
    </View>
  );
}

export function SkeletonList({ count = 5, ...rowProps }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonRow key={i} divider={i < count - 1} {...rowProps} />
      ))}
    </View>
  );
}

// Small detail-card placeholder for screens waiting on a single record (e.g. a joined session).
export function DetailCardSkeleton() {
  return (
    <Card>
      <SkeletonBlock width="50%" height={18} style={{ marginBottom: 8 }} />
      <SkeletonBlock width="30%" height={12} style={{ marginBottom: 16 }} />
      <SkeletonRow divider />
      <SkeletonRow divider />
      <SkeletonRow />
    </Card>
  );
}
