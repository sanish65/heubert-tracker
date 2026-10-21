import { useState } from "react";
import { View, Text, Alert, StyleSheet } from "react-native";
import { useGoBack } from "../lib/useGoBack";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Screen, ScreenHeader, Card, EmptyState, Button, IconButton, Pill } from "../components/ui";
import LeaveTypeFormModal, { LeaveTypeForm } from "../components/LeaveTypeFormModal";

// Leave Settings, as the canvas's MobileLeaveSettings.dc.html: Back to More, what the types do, Add
// Leave Type opening the "New leave type" card, then the types with edit (the sheet) and delete.
// Admins only, as before; everyone else sees why. Adding, editing and deleting call AppContext as
// before.

// One type, as the canvas's row: its colour bar (paid blue, unpaid amber, inactive grey), the name,
// paid or unpaid and the days a year, Active or Inactive, then edit and delete.
function LeaveTypeRow({ leaveType: lt, onEdit, onDelete }) {
  const t = useThemeColors();
  return (
    <View style={[styles.row, { borderTopColor: t.line }]}>
      <View style={[styles.bar, { backgroundColor: !lt.is_active ? t.lineStrong : lt.is_unpaid ? t.unpaid : t.primary }]} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowName, { color: lt.is_active ? t.text1 : t.text3 }]}>
          {lt.name}
        </Text>
        <Text style={[styles.rowMeta, { color: t.text3 }]}>
          {lt.is_unpaid ? "Unpaid" : "Paid"}
          {" · "}
          <Text style={[styles.rowDays, { color: t.text2 }]}>{lt.annual_days} days/yr</Text>
        </Text>
      </View>
      <Pill tone={lt.is_active ? "green" : "gray"}>{lt.is_active ? "Active" : "Inactive"}</Pill>
      <View style={styles.rowActions}>
        <IconButton
          icon="edit"
          tone="plain"
          size={44}
          iconSize={17}
          color={t.text2}
          onPress={() => onEdit(lt)}
          accessibilityLabel={`Edit ${lt.name}`}
          style={[styles.rowBtn, { borderColor: t.line }]}
        />
        <IconButton icon="trash" tone="danger" size={44} iconSize={17} onPress={() => onDelete(lt)} accessibilityLabel={`Delete ${lt.name}`} style={styles.rowBtn} />
      </View>
    </View>
  );
}

export default function LeaveSettingsScreen() {
  const { leaveTypes, deleteLeaveType, isAdmin } = useApp();
  const t = useThemeColors();
  const goBack = useGoBack();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  if (!isAdmin) {
    return (
      <Screen>
        <ScreenHeader title="Leave Settings" onBack={goBack} />
        <Card style={styles.list}>
          <EmptyState icon="lock" text="Only admins can configure leave types." />
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

  const activeCount = leaveTypes.filter((lt) => lt.is_active).length;

  return (
    <Screen>
      <ScreenHeader
        title="Leave Settings"
        subtitle={`Admin · ${leaveTypes.length} leave ${leaveTypes.length === 1 ? "type" : "types"}`}
        onBack={goBack}
      />

      <Text style={[styles.intro, { color: t.text2 }]}>
        {"Annual quotas reset with each leave season. Inactive types stay on old records but can't be picked for new leave."}
      </Text>

      <Button title="Add Leave Type" icon="plus" onPress={() => setShowAdd((open) => !open)} style={[styles.add, { boxShadow: t.glowPrimary }]} />

      {showAdd ? (
        <Card style={[styles.form, { backgroundColor: t.surfaceStrong, borderColor: t.primary, borderTopColor: t.primary }]}>
          <View style={styles.formHead}>
            <Text accessibilityRole="header" style={[styles.title, { color: t.text1 }]}>
              New leave type
            </Text>
            <IconButton icon="x" tone="plain" size={44} color={t.text2} onPress={() => setShowAdd(false)} accessibilityLabel="Close form" style={styles.formClose} />
          </View>
          <LeaveTypeForm inline onClose={() => setShowAdd(false)} />
        </Card>
      ) : null}

      <Card style={styles.list}>
        <View style={styles.listHead}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.text1 }]}>
            Leave types
          </Text>
          <Text style={[styles.count, { color: t.text3 }]}>{activeCount} active</Text>
        </View>
        {leaveTypes.length === 0 ? (
          <EmptyState icon="calendar" text="No leave types configured yet." />
        ) : (
          leaveTypes.map((lt) => <LeaveTypeRow key={lt.id} leaveType={lt} onEdit={setEditing} onDelete={confirmDelete} />)
        )}
      </Card>

      <LeaveTypeFormModal isOpen={!!editing} onClose={() => setEditing(null)} editing={editing} />
    </Screen>
  );
}

// Sizes, gaps and type from MobileLeaveSettings.dc.html: 14 between the parts, 20-radius cards.
const styles = StyleSheet.create({
  intro: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21, marginHorizontal: 2, marginBottom: 14 },
  add: { minHeight: 50, borderRadius: 14, marginBottom: 14 },

  // The new type's card: the stronger glass on a primary edge, 16 by 18 in.
  form: { borderRadius: radius.xl, paddingTop: 16, paddingBottom: 18 },
  formHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  formClose: { marginRight: -8 },
  title: { flex: 1, fontFamily: fonts.display, fontSize: 17 },

  list: { borderRadius: radius.xl, paddingTop: 16, paddingBottom: 6 },
  listHead: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 8 },
  count: { fontFamily: fonts.mono, fontSize: 12 },
  // A type: 68 high, a hairline above, a 3-wide colour bar.
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingVertical: 8, borderTopWidth: 1 },
  bar: { width: 3, height: 38, borderRadius: 2 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  rowName: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  rowMeta: { fontFamily: fonts.body, fontSize: 13 },
  rowDays: { fontFamily: fonts.mono, fontSize: 12 },
  rowActions: { flexDirection: "row", gap: 4, marginRight: -6 },
  rowBtn: { borderRadius: radius.md },
});
