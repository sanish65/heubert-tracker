import { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { Stack } from "expo-router";
import { useApp } from "../context/AppContext";
import { useThemeColors } from "../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Button } from "../components/ui";
import LeaveTypeFormModal from "../components/LeaveTypeFormModal";

export default function LeaveSettingsScreen() {
  const { leaveTypes, deleteLeaveType, isAdmin } = useApp();
  const t = useThemeColors();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  if (!isAdmin) {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Leave Settings" }} />
        <Card>
          <Text style={{ color: t.textMuted, fontSize: 14 }}>Only admins can configure leave types.</Text>
        </Card>
      </Screen>
    );
  }

  const confirmDelete = (leaveType) => {
    Alert.alert("Delete leave type?", `"${leaveType.name}"`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteLeaveType(leaveType.id) },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Leave Settings" }} />
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <SectionTitle>🗂️ Leave Types</SectionTitle>
          <Button title="+ Add" small onPress={() => setShowAdd(true)} />
        </View>

        {leaveTypes.length === 0 ? (
          <EmptyState text="No leave types configured yet." />
        ) : (
          leaveTypes.map((lt) => (
            <View
              key={lt.id}
              style={{ flexDirection: "row", alignItems: "center", borderLeftWidth: 3, borderLeftColor: lt.is_unpaid ? t.accentAmber : t.accentIndigo, backgroundColor: t.bgElevated, borderRadius: 8, padding: 12, marginBottom: 8 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.textPrimary, fontSize: 14, fontWeight: "700" }}>{lt.name}</Text>
                <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>
                  {lt.annual_days} days/yr · {lt.is_unpaid ? "Unpaid" : "Paid"} · {lt.is_active ? "Active" : "Inactive"}
                </Text>
              </View>
              <View style={{ flexDirection: "row", gap: 14 }}>
                <Pressable onPress={() => setEditing(lt)}>
                  <Text style={{ fontSize: 16 }}>✏️</Text>
                </Pressable>
                <Pressable onPress={() => confirmDelete(lt)}>
                  <Text style={{ color: t.accentRed, fontSize: 18 }}>×</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </Card>

      <LeaveTypeFormModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
      <LeaveTypeFormModal isOpen={!!editing} onClose={() => setEditing(null)} editing={editing} />
    </Screen>
  );
}
