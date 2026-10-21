import { useState } from "react";
import { View, Text, Pressable, Switch, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { Button } from "./ui";
import Icon from "./Icon";
import Avatar from "./Avatar";
import { useThemeColors, radius, fonts } from "../lib/theme";

// The parts of the canvas's form sheet (MobileRecordFine.dc.html and MobileRecordLeave.dc.html, the
// references for every sheet in the app): the employee picker, the two-way and three-way choices,
// the switches, the error and warning notes, and the actions at the bottom. Every sheet builds from
// these, inside FormModal (ui.js).

const CHOICE_TONES = {
  amber: { fill: "pbAmber", text: "pfAmber" },
  green: { fill: "pbGreen", text: "pfGreen" },
};

export function FieldLabel({ children }) {
  const t = useThemeColors();
  return <Text style={[styles.label, { color: t.text2 }]}>{children}</Text>;
}

// The line under a sheet's title. FormModal draws the title row, so this comes first in the sheet
// and takes back most of that row's 16px gap.
export function SheetSubtitle({ children }) {
  const t = useThemeColors();
  return <Text style={[styles.subtitle, { color: t.text3 }]}>{children}</Text>;
}

// The canvas's employee select: the person's avatar and name in a 52px field, the list opening
// under it. Without `onChange` it is the same field read-only (the edit sheets, where the person
// is fixed).
export function EmployeePicker({ label = "Employee", value, names = [], onChange }) {
  const t = useThemeColors();
  const { currentEmployee } = useApp();
  const [open, setOpen] = useState(false);
  const me = currentEmployee?.name;

  const content = (
    <>
      {value ? <Avatar name={value} size={28} isMe={value === me} /> : null}
      <Text numberOfLines={1} style={[styles.pickerValue, { color: value ? t.text1 : t.text3 }]}>
        {value || "Select an employee"}
      </Text>
    </>
  );

  if (!onChange) {
    return (
      <View style={styles.field}>
        <FieldLabel>{label}</FieldLabel>
        <View accessible accessibilityLabel={`${label}: ${value || ""}`} style={[styles.picker, { backgroundColor: t.raised, borderColor: t.line }]}>
          {content}
        </View>
      </View>
    );
  }

  const pick = (name) => {
    setOpen(false);
    onChange(name);
  };

  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value || "none"}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.picker, { backgroundColor: pressed ? t.pbGray : t.raised, borderColor: open ? t.cyan : t.lineStrong }]}
      >
        {content}
        <Icon name="chevron-down" size={18} strokeWidth={2} color={t.text3} style={open ? styles.flipped : null} />
      </Pressable>
      {open ? (
        <View accessibilityRole="radiogroup" accessibilityLabel={label} style={[styles.pickerList, { backgroundColor: t.raised, borderColor: t.lineStrong }]}>
          {names.map((name) => {
            const selected = name === value;
            return (
              <Pressable
                key={name}
                onPress={() => pick(name)}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                style={({ pressed }) => [styles.pickerOption, (selected || pressed) && { backgroundColor: selected ? t.primarySoft : t.pbGray }]}
              >
                <Avatar name={name} size={28} isMe={name === me} />
                <Text numberOfLines={1} style={[styles.pickerOptionText, { color: t.text1 }]}>
                  {name}
                </Text>
                {selected ? <Icon name="check" size={18} strokeWidth={2} color={t.primaryText} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// A two-way choice, as the canvas's Amount and Status: the options side by side on a raised track.
// The chosen one is primary-soft on a primary edge, or, with a `tone`, its status colours and dot.
// `mono` sets amounts in the mono font. `solid` is MobileRecordLeave's Duration instead: a quieter
// track, the chosen option filled primary with white text.
export function ChoiceGroup({ label, value, options, onChange, mono = false, solid = false }) {
  const t = useThemeColors();
  return (
    <View style={styles.field}>
      <FieldLabel>{label}</FieldLabel>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={label}
        style={[styles.choices, solid ? [styles.choicesSolid, { borderColor: t.line }] : { borderColor: t.lineStrong }, { backgroundColor: t.raised }]}
      >
        {options.map((opt) => {
          const selected = opt.value === value;
          const tone = selected && opt.tone ? CHOICE_TONES[opt.tone] : null;
          let color = selected ? (tone ? t[tone.text] : t.primaryText) : t.text3;
          let font = mono ? fonts.monoMedium : selected ? fonts.bodySemibold : fonts.bodyMedium;
          let chosen = selected && { backgroundColor: tone ? t[tone.fill] : t.primarySoft, borderColor: tone ? "transparent" : t.primaryEdge };
          if (solid) {
            color = selected ? "#FFFFFF" : t.text2;
            font = selected ? fonts.bodySemibold : fonts.bodyMedium;
            chosen = selected && { backgroundColor: t.primary, boxShadow: t.glowPrimarySm };
          }
          return (
            <Pressable
              key={String(opt.value)}
              onPress={() => onChange(opt.value)}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              style={[styles.choice, solid && styles.choiceSolid, chosen]}
            >
              {tone ? <View style={[styles.choiceDot, { backgroundColor: color }]} /> : null}
              <Text numberOfLines={1} style={[styles.choiceText, solid && styles.choiceTextSolid, { color, fontFamily: font }]}>
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// An on/off setting, as the canvas's Leave Settings rows: the label (and a quieter line under it),
// the switch on the right, at least 60 high. `last` leaves off the hairline under the final row.
export function SheetSwitch({ label, description, value, onValueChange, last = false }) {
  const t = useThemeColors();
  return (
    <View style={[styles.switchRow, !last && { borderBottomWidth: 1, borderBottomColor: t.line }]}>
      <View style={styles.switchText}>
        <Text style={[styles.switchLabel, { color: t.text1 }]}>{label}</Text>
        {description ? <Text style={[styles.switchDescription, { color: t.text3 }]}>{description}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        accessibilityLabel={description ? `${label}, ${description}` : label}
        trackColor={{ true: t.primary }}
      />
    </View>
  );
}

// A sheet's error (red, as the canvas's "Already fined for this day") or warning (amber, as
// MobileRecordLeave's), read out as it appears.
export function SheetNote({ tone = "error", children }) {
  const t = useThemeColors();
  const warning = tone === "warning";
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={[styles.note, { backgroundColor: warning ? t.pbAmber : t.pbRed, borderColor: warning ? t.amberEdge : "transparent" }]}
    >
      <Icon name={warning ? "alert-triangle" : "alert"} size={18} strokeWidth={2} color={warning ? t.pfAmber : t.pfRed} style={styles.noteIcon} />
      <Text style={[styles.noteText, { color: warning ? t.text1 : t.pfRed }]}>{children}</Text>
    </View>
  );
}

// The sheet's actions, as the canvas: the primary across the sheet, 52 high and 14 round with its
// glow, Cancel under it. A second action (`secondary`, Button props) takes the primary's left half.
export function SheetActions({ title, icon = "check", variant = "primary", onPress, disabled, onCancel, secondary }) {
  const t = useThemeColors();
  const primary = (
    <Button
      title={title}
      icon={icon}
      variant={variant}
      onPress={onPress}
      disabled={disabled}
      style={[styles.action, variant === "primary" && { boxShadow: t.glowPrimary }, secondary && styles.actionHalf]}
    />
  );
  return (
    <View style={styles.actions}>
      {secondary ? (
        <View style={styles.actionRow}>
          <Button {...secondary} style={[styles.action, styles.actionHalf]} />
          {primary}
        </View>
      ) : (
        primary
      )}
      <Button title="Cancel" variant="ghost" onPress={onCancel} />
    </View>
  );
}

// Sizes, gaps and type from MobileRecordFine.dc.html: 16 between the sheet's parts, 6 under a label;
// the solid choice and the switches from MobileRecordLeave.dc.html and MobileLeaveSettings.dc.html.
const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, marginBottom: 6 },
  subtitle: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: -12, marginBottom: 16 },

  picker: { flexDirection: "row", alignItems: "center", gap: 10, height: 52, paddingLeft: 12, paddingRight: 16, borderWidth: 1, borderRadius: 14 },
  pickerValue: { flex: 1, fontFamily: fonts.body, fontSize: 16 },
  flipped: { transform: [{ rotate: "180deg" }] },
  pickerList: { marginTop: 6, paddingVertical: 4, borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  pickerOption: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 12 },
  pickerOptionText: { flex: 1, fontFamily: fonts.body, fontSize: 15 },

  choices: { flexDirection: "row", gap: 4, padding: 4, borderWidth: 1, borderRadius: 14 },
  // The solid track: 3 in, 12 round, on the quieter hairline.
  choicesSolid: { padding: 3, borderRadius: radius.md },
  // Every option keeps a 1px edge (transparent unless chosen), so choosing one moves nothing.
  choice: {
    flex: 1,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  choiceSolid: { borderRadius: 9 },
  choiceDot: { width: 7, height: 7, borderRadius: radius.pill },
  choiceText: { flexShrink: 1, fontSize: 15 },
  choiceTextSolid: { fontSize: 14 },

  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 8 },
  switchText: { flex: 1, gap: 2 },
  switchLabel: { fontFamily: fonts.bodyMedium, fontSize: 15, lineHeight: 21 },
  switchDescription: { fontFamily: fonts.body, fontSize: 13 },

  note: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, marginBottom: 16 },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },

  actions: { gap: 4, marginTop: 4 },
  actionRow: { flexDirection: "row", gap: 10 },
  action: { minHeight: 52, borderRadius: 14 },
  actionHalf: { flex: 1 },
});
