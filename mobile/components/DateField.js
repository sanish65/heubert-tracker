import { useState } from "react";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { useApp } from "../context/AppContext";
import { toDateStr } from "../lib/utils";
import Icon from "./Icon";
import { Button, IconButton } from "./ui";

// The canvas's date field (MobileRecordFine.dc.html "Date"): a 52px raised field on the stronger
// hairline, the calendar icon, the date in mono and the chevron; its edge turns cyan while the
// picker is open, as a focused TextField. The pickers themselves are the platform's, as before.

// Some columns come back as a bare "2026-08-15" and others as a full timestamp. Both the
// picker and every caller work in plain Y-M-D, so trim the time part on the way in.
function normalize(dateStr) {
  if (!dateStr) return "";
  return String(dateStr).split("T")[0];
}

// Built from the parts rather than Date.parse so the date lands on local midnight and
// never slips a day across a timezone boundary.
function toDate(dateStr) {
  const [y, m, d] = normalize(dateStr).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function formatDisplay(dateStr) {
  const date = toDate(dateStr);
  if (!date) return null;
  return date.toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}

export default function DateField({
  label,
  value,
  onChange,
  minimumDate,
  maximumDate,
  placeholder = "Select a date",
  clearable = false,
}) {
  const t = useThemeColors();
  const { theme } = useApp();
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState(null);

  const selected = toDate(value);
  const open = () => {
    setDraft(selected || new Date());
    setShow(true);
  };

  // Android puts up its own dialog and reports the final answer (or a dismissal) once, so
  // commit straight away. iOS renders the calendar inline and fires on every tap, so hold
  // the selection in a draft until Done.
  const handleChange = (event, selectedDate) => {
    if (Platform.OS === "android") {
      setShow(false);
      if (event.type === "dismissed" || !selectedDate) return;
      onChange(toDateStr(selectedDate));
      return;
    }
    if (selectedDate) setDraft(selectedDate);
  };

  const confirm = () => {
    onChange(toDateStr(draft || selected || new Date()));
    setShow(false);
  };

  const pickerProps = {
    value: draft || selected || new Date(),
    mode: "date",
    minimumDate: toDate(minimumDate) || undefined,
    maximumDate: toDate(maximumDate) || undefined,
    onChange: handleChange,
  };

  const display = formatDisplay(value);

  return (
    <View style={styles.field}>
      {label ? <Text style={[styles.label, { color: t.text2 }]}>{label}</Text> : null}

      <View style={styles.row}>
        <Pressable
          onPress={open}
          accessibilityRole="button"
          accessibilityLabel={`${label ? `${label}: ` : ""}${display || placeholder}`}
          style={({ pressed }) => [
            styles.input,
            { backgroundColor: pressed ? t.pbGray : t.raised, borderColor: show ? t.cyan : t.lineStrong },
          ]}
        >
          <Icon name="calendar" size={18} strokeWidth={1.9} color={t.text3} />
          <Text numberOfLines={1} style={[styles.value, display ? styles.valueMono : null, { color: display ? t.text1 : t.text3 }]}>
            {display || placeholder}
          </Text>
          <Icon name="chevron-down" size={18} strokeWidth={2} color={t.text3} />
        </Pressable>

        {clearable && value ? (
          <IconButton icon="x" onPress={() => onChange("")} accessibilityLabel={label ? `Clear ${label}` : "Clear date"} tone="plain" />
        ) : null}
      </View>

      {/* Android's picker is a native dialog and has to stay unwrapped; iOS's inline
          calendar needs its own overlay, or it would be buried inside the form's scroll
          view — and inside a bottom sheet it would be clipped off the bottom entirely. */}
      {show && Platform.OS === "android" && <DateTimePicker {...pickerProps} display="default" />}

      {Platform.OS === "ios" && (
        <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <Pressable style={styles.scrim} onPress={() => setShow(false)}>
            <View
              onStartShouldSetResponder={() => true}
              style={[styles.pickerSheet, { backgroundColor: t.surfaceSolid, borderColor: t.lineStrong, borderTopColor: t.glassHi }]}
            >
              <DateTimePicker {...pickerProps} display="inline" themeVariant={theme === "light" ? "light" : "dark"} />
              <View style={styles.pickerActions}>
                <Button title="Cancel" variant="secondary" onPress={() => setShow(false)} small />
                <Button title="Done" onPress={confirm} small />
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}

// Sizes and type from MobileRecordFine.dc.html (the field) and Foundations (the iOS picker's
// dialog: 20 round, the actions at the bottom, primary on the right).
const styles = StyleSheet.create({
  field: { marginBottom: 16 },
  label: { fontFamily: fonts.bodySemibold, fontSize: 13, marginBottom: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  input: {
    flex: 1,
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 14,
  },
  value: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  valueMono: { fontFamily: fonts.mono },
  // The same dimmed backdrop as a sheet's.
  scrim: { flex: 1, backgroundColor: "rgba(4, 6, 12, 0.55)", justifyContent: "center", padding: 20 },
  pickerSheet: { borderRadius: radius.xl, borderWidth: 1, padding: 12 },
  pickerActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10, paddingHorizontal: 4, paddingTop: 8 },
});
