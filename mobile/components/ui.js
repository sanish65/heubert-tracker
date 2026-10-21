import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Modal, StyleSheet, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useThemeColors, radius, fonts } from "../lib/theme";
import Icon, { ICON_NAMES } from "./Icon";
import Aurora from "./Aurora";

// The blocks every screen is built from, in the look of the "Heubert Tracker Revamp" canvas
// (docs/mobile-ui-revamp/design: Foundations for the controls, the mobile artboards for the rest).
// Colours come from useThemeColors(). The custom font families carry their weight in their name,
// so nothing here sets fontWeight.

export function Screen({ children, scroll = true, style }) {
  const t = useThemeColors();
  const Container = scroll ? ScrollView : View;
  // Android resizes the window itself (adjustResize); iOS needs the scroll view to inset
  // itself by the keyboard height, or the keyboard sits on top of whatever has focus.
  const scrollProps = scroll
    ? {
        keyboardShouldPersistTaps: "handled",
        keyboardDismissMode: Platform.OS === "ios" ? "interactive" : "on-drag",
        automaticallyAdjustKeyboardInsets: true,
      }
    : {};
  // The ink and the aurora stay put; the transparent container scrolls over them.
  return (
    <View style={{ flex: 1, backgroundColor: t.ink }}>
      <Aurora />
      <Container
        style={[{ flex: 1 }, !scroll && style]}
        contentContainerStyle={scroll ? [{ padding: 16, paddingBottom: 40 }, style] : undefined}
        {...scrollProps}
      >
        {children}
      </Container>
    </View>
  );
}

// Glass: the translucent surface over the aurora, a hairline edge, and the canvas's inset top
// highlight drawn as a 1px top border (React Native has no inset shadow). There is no background
// blur (a native module; intent.md, Out of scope).
export function Card({ children, style }) {
  const t = useThemeColors();
  return (
    <View
      style={[
        {
          backgroundColor: t.surface,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: t.line,
          borderTopColor: t.glassHi,
          paddingVertical: 16,
          paddingHorizontal: 18,
          marginBottom: 14,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: t.shadowOffsetY },
          shadowOpacity: t.shadowOpacity,
          shadowRadius: t.shadowRadius,
          elevation: t.elevation,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children, style }) {
  const t = useThemeColors();
  return (
    <Text accessibilityRole="header" style={[styles.sectionTitle, { color: t.text1 }, style]}>
      {children}
    </Text>
  );
}

// The small mono caps line above a title or naming a section: dates, seasons, "Account".
// `onPage` for one drawn straight on the page (a header) rather than on glass: it takes the deeper
// pageEyebrow cyan, which stays 4.5:1 over the aurora in both themes.
export function Eyebrow({ children, onPage = false, style }) {
  const t = useThemeColors();
  return <Text style={[styles.eyebrow, { color: onPage ? t.pageEyebrow : t.cyanText }, style]}>{children}</Text>;
}

const ICONS = new Set(ICON_NAMES);

// `icon` is an Icon name; anything else draws the default, so no emoji reaches an empty state.
export function EmptyState({ icon, text }) {
  const t = useThemeColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 32, paddingHorizontal: 16 }}>
      <Icon name={ICONS.has(icon) ? icon : "sparkles"} size={28} color={t.text3} style={{ marginBottom: 8 }} />
      <Text style={[styles.emptyText, { color: t.text3 }]}>{text}</Text>
    </View>
  );
}

// The variant names screens used before the redesign keep working until each screen is migrated:
// accent and warning draw as secondary, success as primary.
function buttonVariant(variant) {
  switch (variant) {
    case "secondary":
    case "orange":
    case "danger":
    case "ghost":
      return variant;
    case "accent":
    case "warning":
      return "secondary";
    default:
      return "primary";
  }
}

// Foundations "Controls". `pressed` is the canvas's hover colour where it has one; a variant
// without one dims instead.
function buttonColors(t, variant) {
  switch (variant) {
    case "secondary":
      return { bg: t.surface, pressed: t.raised, border: t.lineStrong, text: t.text1 };
    case "orange": // people moments only: Meeting, celebrations and wishes
      return { bg: t.orange, pressed: t.orangeHover, text: "#0A0E17" };
    case "danger":
      return { bg: t.pbRed, border: t.redEdge, text: t.pfRed };
    case "ghost":
      return { bg: "transparent", text: t.text2 };
    default:
      return { bg: t.primary, pressed: t.primaryHover, text: "#FFFFFF" };
  }
}

export function Button({ title, onPress, variant = "primary", icon, disabled, small, style }) {
  const t = useThemeColors();
  const c = buttonColors(t, buttonVariant(variant));
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        variant === "orange" && { borderRadius: radius.pill },
        {
          backgroundColor: pressed && c.pressed ? c.pressed : c.bg,
          borderColor: c.border || "transparent",
          opacity: disabled ? 0.45 : pressed && !c.pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 16 : 18} strokeWidth={2} color={c.text} /> : null}
      <Text style={[styles.btnText, small && styles.btnTextSmall, { color: c.text }]}>{title}</Text>
    </Pressable>
  );
}

// The canvas's icon-only buttons: glass on bars and headers (the default), raised inside a glass
// panel, plain for actions in a row, danger for destructive ones.
function iconButtonColors(t, tone) {
  switch (tone) {
    case "raised":
      return { bg: t.raised, border: t.line, icon: t.text2 };
    case "plain":
      return { bg: "transparent", pressed: t.raised, border: "transparent", icon: t.text3 };
    case "danger":
      return { bg: t.pbRed, border: t.lineStrong, icon: t.pfRed };
    default:
      return { bg: t.surface, pressed: t.raised, border: t.line, top: t.glassHi, icon: t.text2 };
  }
}

// Development only: an icon button without a label is silent to TalkBack and VoiceOver.
const unlabelled = new Set();
function warnUnlabelled(icon) {
  if (!__DEV__ || unlabelled.has(icon)) return;
  unlabelled.add(icon);
  console.warn(`IconButton "${icon}" has no accessibilityLabel, so a screen reader has nothing to announce.`);
}

// 40x40 in rows and panels (44 to the finger through hitSlop); 44 in headers and sheets, as the
// artboards. `accessibilityLabel` is required: the icon is the button's only content.
export function IconButton({ icon, onPress, accessibilityLabel, tone = "glass", color, disabled, size = 40, iconSize = 18, style }) {
  const t = useThemeColors();
  const c = iconButtonColors(t, tone);
  if (!accessibilityLabel) warnUnlabelled(icon);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={2}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        styles.iconBtn,
        { width: size, height: size },
        {
          backgroundColor: pressed && c.pressed ? c.pressed : c.bg,
          borderColor: c.border,
          opacity: disabled ? 0.45 : pressed && !c.pressed ? 0.8 : 1,
        },
        c.top && { borderTopColor: c.top },
        style,
      ]}
    >
      <Icon name={icon} size={iconSize} color={color || c.icon} />
    </Pressable>
  );
}

// The header of a stacked screen, as the canvas's Settings and Withdrawals: Back, the title, then
// any actions. Put it first inside <Screen>; it clears the status bar itself. Back shows when
// `onBack` is given (a screen passes router.back). `centered` puts the title in the middle, as the
// Attendance and Withdrawals artboards: with Back and nothing on the right, a spacer as wide as
// Back balances it. `subtitle` is the mono line under the title (Projects' "6 projects · 3 active");
// it is on the page, so text2 where the canvas has text3 (4.5:1 over the light aurora).
export function ScreenHeader({ title, subtitle, onBack, right, centered = false }) {
  const t = useThemeColors();
  const insets = useSafeAreaInsets();
  const align = centered && styles.headerTitleCentered;
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      {onBack ? (
        <IconButton icon="chevron-left" onPress={onBack} accessibilityLabel="Back" color={t.text1} size={44} style={styles.headerBtn} />
      ) : null}
      <View style={styles.headerText}>
        <Text accessibilityRole="header" numberOfLines={1} style={[styles.headerTitle, align, { color: t.text1 }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text numberOfLines={1} style={[styles.headerSubtitle, align, { color: t.text2 }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
      {centered && onBack && !right ? <View style={styles.headerSpacer} /> : null}
    </View>
  );
}

export function TextField({ label, value, onChangeText, placeholder, keyboardType, multiline, editable = true, style, autoFocus, returnKeyType, onSubmitEditing }) {
  const t = useThemeColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={[styles.label, { color: t.text2 }]}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.text3}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
        autoFocus={autoFocus}
        returnKeyType={returnKeyType}
        onSubmitEditing={onSubmitEditing}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        accessibilityLabel={label}
        style={[
          {
            backgroundColor: t.raised,
            color: editable ? t.text1 : t.text3,
            borderWidth: 1,
            // Read-only fields keep the quieter hairline, as Foundations' disabled control.
            borderColor: focused ? t.cyan : editable ? t.lineStrong : t.line,
            borderRadius: radius.sm,
            paddingHorizontal: 12,
            paddingVertical: 10,
            minHeight: multiline ? 80 : 44,
            fontFamily: fonts.body,
            fontSize: 15,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
      />
    </View>
  );
}

// The canvas chip: a glass pill; the chosen one takes the primary-soft fill on a primary edge. A
// long label (a project's name) ends in an ellipsis rather than running past the row.
export function Chip({ label, active, onPress }) {
  const t = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: active ? t.primary : t.lineStrong,
          backgroundColor: active ? t.primarySoft : pressed ? t.raised : t.surface,
        },
      ]}
    >
      <Text numberOfLines={1} style={[styles.chipText, { color: active ? t.primaryText : t.text2, fontFamily: active ? fonts.bodySemibold : fonts.bodyMedium }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// The dimmed backdrop behind a sheet, the same in both themes.
const SCRIM = "rgba(4, 6, 12, 0.55)";

// The canvas sheet (MobileRecordFine, MobileRecordLeave). The fill is the solid surface, as on
// those artboards: with no blur behind it, the translucent surfaceStrong over the backdrop greys
// the light theme's sheet and drops cyanText on it to 4.2:1.
export function FormModal({ visible, onClose, title, children }) {
  const t = useThemeColors();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: SCRIM, justifyContent: "flex-end" }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.sheet, { backgroundColor: t.surfaceSolid, borderColor: t.lineStrong, borderTopColor: t.glassHi }]}>
          <View style={[styles.sheetHandle, { backgroundColor: t.lineStrong }]} />
          <View style={styles.sheetHeader}>
            <Text accessibilityRole="header" style={[styles.sheetTitle, { color: t.text1 }]}>
              {title}
            </Text>
            <IconButton icon="x" onPress={onClose} accessibilityLabel="Close" tone="raised" size={44} style={styles.roundBtn} />
          </View>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            contentContainerStyle={{ paddingBottom: 12 }}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function Select({ label, value, options, onSelect }) {
  const t = useThemeColors();
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={[styles.label, { color: t.text2 }]}>{label}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {options.map((opt) => (
          <Chip key={opt.value} label={opt.label} active={value === opt.value} onPress={() => onSelect(opt.value)} />
        ))}
      </View>
    </View>
  );
}

// The canvas status pills: paid green; unpaid or pending amber; overdue or error red; leave cyan;
// priority blue; review violet; low grey. Each pair is a tinted fill (`pb*`) and its text (`pf*`).
const PILL_TONES = {
  blue: ["pbBlue", "pfBlue"],
  green: ["pbGreen", "pfGreen"],
  amber: ["pbAmber", "pfAmber"],
  red: ["pbRed", "pfRed"],
  violet: ["pbViolet", "pfViolet"],
  cyan: ["pbCyan", "pfCyan"],
  gray: ["pbGray", "pfGray"],
};

// In a column, pass style={{ alignSelf: "flex-start" }} so the pill keeps to its text.
export function Pill({ tone = "gray", children, style }) {
  const t = useThemeColors();
  // Own keys only: PILL_TONES["constructor"] is Object's constructor. An unknown tone is grey.
  const [fill, text] = Object.prototype.hasOwnProperty.call(PILL_TONES, tone) ? PILL_TONES[tone] : PILL_TONES.gray;
  return (
    <View style={[styles.pill, { backgroundColor: t[fill] }, style]}>
      <Text numberOfLines={1} style={[styles.pillText, { color: t[text] }]}>
        {children}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontFamily: fonts.display, fontSize: 17, marginBottom: 10 },
  // The canvas's .08em at 12px.
  eyebrow: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.96, textTransform: "uppercase" },
  emptyText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, textAlign: "center" },
  // Every variant keeps a 1px border (transparent where it has none), so all are the same size.
  btn: {
    minHeight: 44,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  btnSmall: { minHeight: 40, paddingHorizontal: 14, gap: 6 },
  btnText: { flexShrink: 1, fontFamily: fonts.bodySemibold, fontSize: 15, textAlign: "center" },
  btnTextSmall: { fontSize: 14 },
  iconBtn: { borderRadius: radius.sm, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  headerBtn: { borderRadius: 14 },
  roundBtn: { borderRadius: radius.pill },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14 },
  headerText: { flex: 1, minWidth: 0 },
  headerTitle: { fontFamily: fonts.display, fontSize: 20, letterSpacing: -0.2 },
  headerSubtitle: { fontFamily: fonts.mono, fontSize: 12 },
  headerTitleCentered: { textAlign: "center" },
  headerSpacer: { width: 44 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, marginBottom: 6 },
  chip: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
    maxWidth: "100%",
  },
  chipText: { fontSize: 14 },
  sheet: {
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 20,
    maxHeight: "88%",
  },
  sheetHandle: { alignSelf: "center", width: 40, height: 5, borderRadius: radius.pill, marginBottom: 16 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 },
  sheetTitle: { flex: 1, fontFamily: fonts.display, fontSize: 22, letterSpacing: -0.3 },
  pill: { height: 22, flexShrink: 0, paddingHorizontal: 8, borderRadius: radius.pill, justifyContent: "center" },
  pillText: { fontFamily: fonts.bodySemibold, fontSize: 12 },
});
