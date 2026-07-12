import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useThemeColors, radius } from "../lib/theme";
import { toDateStr } from "../lib/utils";

function formatDisplay(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function DateField({ label, value, onChange, minimumDate }) {
  const t = useThemeColors();
  const [show, setShow] = useState(false);

  const handleChange = (event, selectedDate) => {
    if (Platform.OS === "android") setShow(false);
    if (event.type === "dismissed" || !selectedDate) return;
    onChange(toDateStr(selectedDate));
    if (Platform.OS === "ios") setShow(false);
  };

  return (
    <View style={{ marginBottom: 14 }}>
      {label ? <Text style={{ color: t.textSecondary, fontSize: 13, marginBottom: 6, fontWeight: "600" }}>{label}</Text> : null}
      <Pressable
        onPress={() => setShow(true)}
        style={{
          backgroundColor: t.bgElevated,
          borderWidth: 1,
          borderColor: t.border,
          borderRadius: radius.sm,
          paddingHorizontal: 12,
          paddingVertical: 10,
        }}
      >
        <Text style={{ color: value ? t.textPrimary : t.textMuted, fontSize: 15 }}>
          {formatDisplay(value) || "Select a date"}
        </Text>
      </Pressable>

      {show && (
        <DateTimePicker
          value={value ? new Date(value + "T00:00:00") : new Date()}
          mode="date"
          display={Platform.OS === "ios" ? "inline" : "default"}
          minimumDate={minimumDate ? new Date(minimumDate + "T00:00:00") : undefined}
          onChange={handleChange}
        />
      )}
    </View>
  );
}
