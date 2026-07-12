import { View, Text, TextInput, Pressable, ScrollView, Modal, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useThemeColors, radius } from "../lib/theme";

export function Screen({ children, scroll = true, style }) {
  const t = useThemeColors();
  const Container = scroll ? ScrollView : View;
  return (
    <Container
      style={[{ flex: 1, backgroundColor: t.bg }, !scroll && style]}
      contentContainerStyle={scroll ? [{ padding: 16, paddingBottom: 40 }, style] : undefined}
    >
      {children}
    </Container>
  );
}

export function Card({ children, style }) {
  const t = useThemeColors();
  return (
    <View
      style={[
        {
          backgroundColor: t.card,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: t.border,
          padding: 14,
          marginBottom: 12,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.3,
          shadowRadius: 10,
          elevation: 3,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionTitle({ children }) {
  const t = useThemeColors();
  return <Text style={{ color: t.textPrimary, fontSize: 18, fontWeight: "700", letterSpacing: -0.3, marginBottom: 10 }}>{children}</Text>;
}

export function EmptyState({ icon = "📭", text }) {
  const t = useThemeColors();
  return (
    <View style={{ alignItems: "center", paddingVertical: 32 }}>
      <Text style={{ fontSize: 32, marginBottom: 8 }}>{icon}</Text>
      <Text style={{ color: t.textMuted, fontSize: 14 }}>{text}</Text>
    </View>
  );
}

const VARIANT_COLORS = {
  primary: "accentIndigo",
  accent: "accentSky",
  danger: "accentRed",
  warning: "accentAmber",
  success: "accentGreen",
};

export function Button({ title, onPress, variant = "primary", disabled, small }) {
  const t = useThemeColors();
  const isGhost = variant === "ghost";
  const isPrimary = variant === "primary";
  const bg = isGhost ? "transparent" : t[VARIANT_COLORS[variant] || "accentIndigo"];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.btnSmall,
        { overflow: "hidden", backgroundColor: isPrimary ? "transparent" : bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        isGhost && { borderWidth: 1, borderColor: t.border },
      ]}
    >
      {isPrimary && (
        <LinearGradient
          colors={[t.accentIndigo, t.accentViolet]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text style={[styles.btnText, isGhost && { color: t.textSecondary }, small && styles.btnTextSmall]}>{title}</Text>
    </Pressable>
  );
}

export function TextField({ label, value, onChangeText, placeholder, keyboardType, multiline, editable = true, style }) {
  const t = useThemeColors();
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ color: t.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>{label}</Text> : null}
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.textMuted}
        keyboardType={keyboardType}
        multiline={multiline}
        editable={editable}
        style={[
          {
            backgroundColor: editable ? t.bgElevated : t.border,
            color: editable ? t.textPrimary : t.textMuted,
            borderWidth: 1,
            borderColor: t.border,
            borderRadius: radius.sm,
            paddingHorizontal: 12,
            paddingVertical: 10,
            fontSize: 15,
            minHeight: multiline ? 80 : undefined,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
      />
    </View>
  );
}

export function Chip({ label, active, onPress, color }) {
  const t = useThemeColors();
  const activeColor = color || t.accentIndigo;
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: radius.xl,
        borderWidth: 1,
        borderColor: active ? activeColor : t.border,
        backgroundColor: active ? activeColor + "22" : "transparent",
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: active ? activeColor : t.textSecondary, fontSize: 13, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

export function FormModal({ visible, onClose, title, children }) {
  const t = useThemeColors();
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.55)", justifyContent: "flex-end" }}>
        <View
          style={{
            backgroundColor: t.bgElevated,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            padding: 20,
            maxHeight: "88%",
          }}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <Text style={{ color: t.textPrimary, fontSize: 18, fontWeight: "700" }}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: t.textMuted, fontSize: 22 }}>✕</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled">{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

export function Select({ label, value, options, onSelect }) {
  const t = useThemeColors();
  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ color: t.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>{label}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {options.map((opt) => (
          <Chip key={opt.value} label={opt.label} active={value === opt.value} onPress={() => onSelect(opt.value)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  btn: { paddingVertical: 12, paddingHorizontal: 18, borderRadius: radius.sm, alignItems: "center" },
  btnSmall: { paddingVertical: 8, paddingHorizontal: 12 },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15, letterSpacing: -0.2 },
  btnTextSmall: { fontSize: 13 },
});
