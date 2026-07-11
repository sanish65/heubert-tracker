import { useMemo, useState } from "react";
import { View, Text, ActivityIndicator, Alert } from "react-native";
import { useApp } from "../../context/AppContext";
import { useThemeColors } from "../../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Button } from "../../components/ui";
import { SkeletonList } from "../../components/Skeleton";
import { getNepalDateStr } from "../../lib/attendance";

function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatNepalTime(isoStr) {
  if (!isoStr) return null;
  return new Date(isoStr).toLocaleTimeString("en-US", {
    timeZone: "Asia/Kathmandu",
    hour: "numeric",
    minute: "2-digit",
  });
}

function HistoryRow({ record }) {
  const t = useThemeColors();
  const badgeColor = record.is_late ? t.accentAmber : t.accentGreen;
  return (
    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.textPrimary, fontSize: 14, fontWeight: "700" }}>{formatDate(record.date)}</Text>
        <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>
          In {formatNepalTime(record.check_in_at) || "—"} · Out {formatNepalTime(record.check_out_at) || "—"}
        </Text>
      </View>
      <View style={{ backgroundColor: badgeColor + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}>
        <Text style={{ color: badgeColor, fontSize: 11, fontWeight: "700" }}>
          {record.is_late ? `Late ${record.late_minutes}m` : "On time"}
        </Text>
      </View>
    </View>
  );
}

export default function AttendanceScreen() {
  const { attendance, currentEmployee, checkIn, checkOut, isLoaded } = useApp();
  const t = useThemeColors();
  const [busy, setBusy] = useState(false);

  const myRecords = useMemo(
    () =>
      (currentEmployee ? attendance.filter((a) => a.employee_name === currentEmployee.name) : [])
        .sort((a, b) => b.date.localeCompare(a.date)),
    [attendance, currentEmployee]
  );

  const todayStr = getNepalDateStr(new Date());
  const today = myRecords.find((a) => a.date === todayStr);

  const handleCheckIn = async () => {
    setBusy(true);
    try {
      await checkIn();
    } catch (err) {
      Alert.alert("Check-in failed", err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleCheckOut = async () => {
    setBusy(true);
    try {
      await checkOut();
    } catch (err) {
      Alert.alert("Check-out failed", err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  let statusText = "Not checked in yet";
  if (today?.check_out_at) {
    statusText = `Checked out at ${formatNepalTime(today.check_out_at)}`;
  } else if (today?.check_in_at) {
    statusText = `Checked in at ${formatNepalTime(today.check_in_at)}${today.is_late ? ` · Late by ${today.late_minutes}m` : ""}`;
  }

  return (
    <Screen>
      <Card>
        <SectionTitle>Today's Attendance</SectionTitle>
        <Text style={{ color: t.textSecondary, fontSize: 14, marginBottom: 16 }}>{statusText}</Text>

        {busy ? (
          <View style={{ paddingVertical: 12 }}>
            <ActivityIndicator color={t.accentIndigo} />
          </View>
        ) : !today?.check_in_at ? (
          <Button title="Check In" onPress={handleCheckIn} />
        ) : !today?.check_out_at ? (
          <Button title="Check Out" variant="accent" onPress={handleCheckOut} />
        ) : (
          <Text style={{ color: t.textMuted, fontSize: 13 }}>You're all done for today.</Text>
        )}

        <Text style={{ color: t.textMuted, fontSize: 11, marginTop: 12 }}>
          Requires you to be at the office and to verify with your device's fingerprint, face unlock, PIN, or pattern.
        </Text>
      </Card>

      <Card>
        <SectionTitle>My History</SectionTitle>
        {!isLoaded ? (
          <SkeletonList count={5} rightWidth={54} />
        ) : myRecords.length === 0 ? (
          <EmptyState icon="📍" text="No attendance records yet." />
        ) : (
          myRecords.slice(0, 14).map((r) => <HistoryRow key={r.id} record={r} />)
        )}
      </Card>
    </Screen>
  );
}
