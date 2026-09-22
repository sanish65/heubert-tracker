import { useState } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useThemeColors, radius } from "../lib/theme";
import { useApp } from "../context/AppContext";
import { toDateStr } from "../lib/utils";

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
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
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

  return (
    <View style={{ marginBottom: 14 }}>
      {label ? (
        <Text style={{ color: t.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>{label}</Text>
      ) : null}

      <View style={{ flexDirection: "row", alignItems: "center" }}>
        <Pressable
          onPress={open}
          style={{
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: t.bgInput,
            borderWidth: 1,
            borderColor: t.border,
            borderRadius: radius.sm,
            paddingHorizontal: 12,
            paddingVertical: 10,
          }}
        >
          <Text style={{ color: value ? t.textPrimary : t.textMuted, fontSize: 15 }}>
            {formatDisplay(value) || placeholder}
          </Text>
          <Text style={{ fontSize: 15 }}>📅</Text>
        </Pressable>

        {clearable && value ? (
          <Pressable onPress={() => onChange("")} hitSlop={8} style={{ paddingHorizontal: 10 }}>
            <Text style={{ color: t.textMuted, fontSize: 18 }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {/* Android's picker is a native dialog and has to stay unwrapped; iOS's inline
          calendar needs its own overlay, or it would be buried inside the form's scroll
          view — and inside a bottom sheet it would be clipped off the bottom entirely. */}
      {show && Platform.OS === "android" && <DateTimePicker {...pickerProps} display="default" />}

      {Platform.OS === "ios" && (
        <Modal visible={show} transparent animationType="fade" onRequestClose={() => setShow(false)}>
          <Pressable
            style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.65)", justifyContent: "center", padding: 20 }}
            onPress={() => setShow(false)}
          >
            <View
              onStartShouldSetResponder={() => true}
              style={{ backgroundColor: t.bgElevated, borderRadius: radius.lg, padding: 12 }}
            >
              <DateTimePicker {...pickerProps} display="inline" themeVariant={theme === "light" ? "light" : "dark"} />
              <View style={{ flexDirection: "row", justifyContent: "flex-end", gap: 18, paddingHorizontal: 8, paddingVertical: 6 }}>
                <Pressable onPress={() => setShow(false)} hitSlop={8}>
                  <Text style={{ color: t.textSecondary, fontSize: 16, fontWeight: "600" }}>Cancel</Text>
                </Pressable>
                <Pressable onPress={confirm} hitSlop={8}>
                  <Text style={{ color: t.accentIndigo, fontSize: 16, fontWeight: "700" }}>Done</Text>
                </Pressable>
              </View>
            </View>
          </Pressable>
        </Modal>
      )}
    </View>
  );
}
