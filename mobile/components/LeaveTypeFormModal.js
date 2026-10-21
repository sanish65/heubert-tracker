import { useState, useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Button } from "./ui";
import { FieldLabel, SheetSwitch, SheetNote, SheetActions } from "./SheetParts";
import Icon from "./Icon";
import { useThemeColors, radius, fonts } from "../lib/theme";

// A leave type's fields, as the canvas's "New leave type" card (MobileLeaveSettings.dc.html): the
// name, the category (it follows the unpaid switch) beside the annual days, then Active and Unpaid.
// Leave Settings draws them in its card to add a type (`inline`: Cancel and save side by side, as
// the card), and in the sheet below to edit one (the sheet's actions).
export function LeaveTypeForm({ isOpen = true, onClose, editing, inline = false }) {
  const { addLeaveType, updateLeaveType, leaveTypes } = useApp();
  const t = useThemeColors();
  const [name, setName] = useState("");
  const [annualDays, setAnnualDays] = useState("");
  const [isUnpaid, setIsUnpaid] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    if (editing) {
      setName(editing.name);
      setAnnualDays(String(editing.annual_days));
      setIsUnpaid(editing.is_unpaid);
      setIsActive(editing.is_active);
    } else {
      setName("");
      setAnnualDays("");
      setIsUnpaid(false);
      setIsActive(true);
    }
    setError("");
  }, [isOpen, editing]);

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    const days = parseFloat(annualDays);
    if (!trimmedName) return setError("Please enter a name");
    if (isNaN(days) || days < 0) return setError("Please enter a valid number of annual days");

    const duplicate = leaveTypes.some(
      (t2) => t2.name.toLowerCase() === trimmedName.toLowerCase() && t2.id !== editing?.id
    );
    if (duplicate) return setError("A leave type with this name already exists");

    setLoading(true);
    const payload = { name: trimmedName, annualDays: days, isUnpaid, isActive };
    const { error: dbError } = editing
      ? await updateLeaveType(editing.id, payload)
      : await addLeaveType(payload);
    setLoading(false);

    if (dbError) return setError(dbError.message || "Something went wrong");
    onClose();
  };

  const submitTitle = loading ? "Saving..." : editing ? "Save Changes" : "Add Leave Type";
  const category = isUnpaid ? "Unpaid" : "Paid";

  return (
    <>
      <TextField label="Leave Type Name" value={name} onChangeText={(v) => { setName(v); setError(""); }} placeholder="e.g. Personal Leave" />

      <View style={styles.pair}>
        <View style={styles.pairCell}>
          <FieldLabel>Category</FieldLabel>
          <View accessible accessibilityLabel={`Category: ${category}`} style={[styles.category, { borderColor: t.lineStrong }]}>
            <View style={[styles.categoryDot, { backgroundColor: isUnpaid ? t.unpaid : t.primary }]} />
            <Text numberOfLines={1} style={[styles.categoryText, { color: t.text1 }]}>
              {category}
            </Text>
            <Icon name="lock" size={15} color={t.text3} />
          </View>
        </View>
        <View style={styles.pairCell}>
          <TextField
            label="Annual Days"
            value={annualDays}
            onChangeText={(v) => { setAnnualDays(v); setError(""); }}
            placeholder="e.g. 14"
            keyboardType="numeric"
            style={styles.daysInput}
          />
          <Text style={[styles.daysUnit, { color: t.text3 }]}>
            days
          </Text>
        </View>
      </View>
      <Text style={[styles.caption, { color: t.text3 }]}>Category follows the unpaid toggle below.</Text>

      <View style={[styles.switches, { borderTopColor: t.line }]}>
        <SheetSwitch label="Active" description="Visible when recording leave" value={isActive} onValueChange={setIsActive} />
        <SheetSwitch label="Unpaid leave (fallback once other balances run out)" value={isUnpaid} onValueChange={setIsUnpaid} last />
      </View>

      {error ? <SheetNote>{error}</SheetNote> : null}

      {inline ? (
        <View style={styles.inlineActions}>
          <Button title="Cancel" variant="secondary" onPress={onClose} style={[styles.inlineAction, styles.inlineCancel]} />
          <Button title={submitTitle} icon="check" onPress={handleSubmit} disabled={loading} style={[styles.inlineAction, styles.inlineSave]} />
        </View>
      ) : (
        <SheetActions title={submitTitle} onPress={handleSubmit} disabled={loading} onCancel={onClose} />
      )}
    </>
  );
}

// The edit sheet (and the add sheet, should a screen open one), in the record sheet's look.
export default function LeaveTypeFormModal({ isOpen, onClose, editing }) {
  return (
    <FormModal visible={isOpen} onClose={onClose} title={editing ? "Edit Leave Type" : "Add Leave Type"}>
      <LeaveTypeForm isOpen={isOpen} onClose={onClose} editing={editing} />
    </FormModal>
  );
}

// Sizes, gaps and type from MobileLeaveSettings.dc.html: the category and the days side by side 10
// apart; the switches between hairlines; Cancel and save 50 high, save the wider.
const styles = StyleSheet.create({
  pair: { flexDirection: "row", gap: 10 },
  pairCell: { flex: 1, minWidth: 0 },
  // As high as the text field beside it, and as far from what follows.
  category: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderStyle: "dashed", borderRadius: radius.sm, marginBottom: 14 },
  categoryDot: { width: 8, height: 8, borderRadius: radius.pill },
  categoryText: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  daysInput: { paddingRight: 52, fontFamily: fonts.mono, fontSize: 14 },
  // In the field: 12 from its right edge, centred on its 44 (the field keeps 14 below it).
  daysUnit: { position: "absolute", right: 12, bottom: 28, fontFamily: fonts.mono, fontSize: 12, lineHeight: 16, pointerEvents: "none" },
  caption: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: -6, marginBottom: 14 },
  switches: { borderTopWidth: 1, marginBottom: 14 },
  inlineActions: { flexDirection: "row", gap: 10 },
  inlineAction: { minHeight: 50, borderRadius: radius.md },
  inlineCancel: { flex: 1, backgroundColor: "transparent" },
  inlineSave: { flex: 1.4 },
});
