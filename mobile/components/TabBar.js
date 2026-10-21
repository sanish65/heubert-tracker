import { View, Text, Pressable, Platform, StyleSheet } from "react-native";
import { useThemeColors, fonts, radius } from "../lib/theme";
import Icon from "./Icon";

// The five tabs, in the order and with the icons of the canvas tab bar (MobileTabBar.dc.html): the
// route each opens, its label, its icon. Attendance is a tab route as well, but it opens from Home
// and has no item (`href: null` in app/(tabs)/_layout.js).
const TABS = [
  { name: "index", label: "Home", icon: "dashboard" },
  { name: "fines", label: "Fines", icon: "wallet" },
  { name: "leaves", label: "Leaves", icon: "calendar" },
  { name: "team", label: "Team", icon: "users" },
  { name: "more", label: "More", icon: "menu" },
];

// The canvas tab bar, passed to <Tabs tabBar>. No blur (intent.md, Out of scope), so the bar takes
// the opaque glass fill, `surfaceStrong`, over the ink: the pair src/lib/mobileTokens.test.mjs holds
// every label colour to 4.5:1 against. The active tab is the canvas's: its icon in a primary-soft
// pill with the cyan dot, its label brighter.
export default function TabBar({ state, navigation, insets }) {
  const t = useThemeColors();
  const focused = state.routes[state.index]?.name;
  // A tab route with no item (Attendance) is drawn as a stacked screen with its own Back, as its
  // artboard: no bar under it.
  if (!TABS.some((tab) => tab.name === focused)) return null;

  return (
    <View style={{ backgroundColor: t.ink }}>
      <View
        accessibilityRole="tablist"
        style={[
          styles.bar,
          {
            backgroundColor: t.surfaceStrong,
            borderTopColor: t.line,
            paddingLeft: 8 + insets.left,
            paddingRight: 8 + insets.right,
            paddingBottom: Math.max(insets.bottom, 8),
          },
        ]}
      >
        {TABS.map((tab, index) => {
          const route = state.routes.find((r) => r.name === tab.name);
          if (!route) return null;
          const selected = tab.name === focused;
          // As React Navigation's own tab bar: a tabPress listener may cancel the switch, and the
          // tab you are on hears the press but does not navigate.
          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!selected && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          const onLongPress = () => navigation.emit({ type: "tabLongPress", target: route.key });
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              onLongPress={onLongPress}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              // VoiceOver does not announce the tab role, so iOS hears the position the way React
              // Navigation's tab bar said it.
              accessibilityLabel={Platform.OS === "ios" ? `${tab.label}, tab, ${index + 1} of ${TABS.length}` : undefined}
              style={styles.item}
            >
              <View style={[styles.marker, selected && { backgroundColor: t.primarySoft }]}>
                <Icon name={tab.icon} size={20} strokeWidth={1.9} color={selected ? t.primaryText : t.text3} />
                {selected ? <View style={[styles.dot, { backgroundColor: t.cyan }]} /> : null}
              </View>
              <Text
                numberOfLines={1}
                style={[styles.label, { color: selected ? t.text1 : t.text3, fontFamily: selected ? fonts.bodySemibold : fonts.bodyMedium }]}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", paddingTop: 8, borderTopWidth: 1 },
  item: { flex: 1, minHeight: 52, alignItems: "center", justifyContent: "center", gap: 3 },
  marker: { width: 52, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  dot: { position: "absolute", top: 3, right: 9, width: 5, height: 5, borderRadius: radius.pill },
  label: { fontSize: 12 },
});
