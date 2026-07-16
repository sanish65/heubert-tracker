import { View, Text } from "react-native";
import { useThemeColors } from "../lib/theme";

// The day the new fiscal year (and new leave/fine seasons) begins.
const TARGET_DATE = new Date(2026, 6, 17); // July 17, 2026

export default function NewFiscalYearBanner() {
  const t = useThemeColors();

  const isTargetDay = new Date().toDateString() === TARGET_DATE.toDateString();
  if (!isTargetDay) return null;

  return (
    <View
      style={{
        backgroundColor: t.accentAmber + "22",
        borderWidth: 1,
        borderColor: t.accentAmber + "55",
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
      }}
    >
      <Text style={{ color: t.textPrimary, fontWeight: "700", fontSize: 15 }}>🎉 Oh yeah, a new fiscal year!</Text>
      <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 4 }}>
        New leaves, a fresh season for fines, and a brand new working year — let's make it a great one!
      </Text>
    </View>
  );
}
