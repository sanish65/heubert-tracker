import { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useApp } from "../../context/AppContext";
import { useThemeColors } from "../../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Button } from "../../components/ui";
import AddEmployeeModal from "../../components/AddEmployeeModal";
import EditEmployeeModal from "../../components/EditEmployeeModal";

const STATUS_COLOR = { active: "accentGreen", resigned: "accentRed", "on-leave": "accentAmber" };

export default function TeamScreen() {
  const { employees, removeEmployee, getEmployeeStats, isAdmin } = useApp();
  const t = useThemeColors();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const confirmDelete = (emp) => {
    Alert.alert("Delete employee?", `Are you sure you want to delete ${emp.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await removeEmployee(emp.id);
          if (error) Alert.alert("Error", error.message || "Check connection");
        },
      },
    ]);
  };

  return (
    <Screen>
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <View>
            <SectionTitle>Employee Directory</SectionTitle>
            <Text style={{ color: t.textMuted, fontSize: 12 }}>{employees.length} Members</Text>
          </View>
          {isAdmin && <Button title="+ Add" small onPress={() => setShowAdd(true)} />}
        </View>

        {employees.length === 0 ? (
          <EmptyState text="No employees found" />
        ) : (
          employees.map((emp) => {
            const stats = getEmployeeStats(emp.name);
            return (
              <View key={emp.id} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.accentIndigo + "33", alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                    <Text style={{ color: t.accentIndigo, fontWeight: "700" }}>{emp.name?.charAt(0)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.textPrimary, fontSize: 14, fontWeight: "700" }}>{emp.name}</Text>
                    <Text style={{ color: t.textMuted, fontSize: 12 }}>{emp.emp_no || `EMP-${emp.id}`} · Joined {formatDate(emp.joined_date)}</Text>
                  </View>
                  <View style={{ backgroundColor: t[STATUS_COLOR[emp.status] || "accentGreen"] + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: t[STATUS_COLOR[emp.status] || "accentGreen"], fontSize: 11, fontWeight: "700" }}>{emp.status || "active"}</Text>
                  </View>
                </View>
                {(emp.work_email || emp.personal_email || emp.phone) && (
                  <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 6 }}>
                    {emp.work_email || emp.personal_email || "No email"} {emp.phone ? `· ${emp.phone}` : ""}
                  </Text>
                )}
                <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>
                  Rs. {stats.total.toLocaleString()} fines · {stats.records} records
                </Text>
                {isAdmin && (
                  <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                    <Pressable onPress={() => setEditing(emp)}>
                      <Text style={{ color: t.accentIndigo, fontSize: 13, fontWeight: "600" }}>Edit</Text>
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(emp)}>
                      <Text style={{ color: t.accentRed, fontSize: 13, fontWeight: "600" }}>Delete</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}
      </Card>

      <AddEmployeeModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
      <EditEmployeeModal isOpen={!!editing} onClose={() => setEditing(null)} employee={editing} />
    </Screen>
  );
}
