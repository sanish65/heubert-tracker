import { useState, useEffect } from "react";
import { Text, View, Switch } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Button } from "./ui";
import { useThemeColors } from "../lib/theme";

export default function LeaveTypeFormModal({ isOpen, onClose, editing }) {
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

  return (
    <FormModal visible={isOpen} onClose={onClose} title={editing ? "Edit Leave Type" : "Add Leave Type"}>
      <TextField label="Leave Type Name" value={name} onChangeText={(v) => { setName(v); setError(""); }} placeholder="e.g. Personal Leave" />
      <TextField label="Annual Days" value={annualDays} onChangeText={(v) => { setAnnualDays(v); setError(""); }} placeholder="e.g. 14" keyboardType="numeric" />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <Text style={{ color: t.textPrimary, fontSize: 14, flex: 1, marginRight: 12 }}>Unpaid leave (fallback once other balances run out)</Text>
        <Switch value={isUnpaid} onValueChange={setIsUnpaid} trackColor={{ true: t.accentIndigo }} />
      </View>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <Text style={{ color: t.textPrimary, fontSize: 14, flex: 1, marginRight: 12 }}>Active (visible when recording leave)</Text>
        <Switch value={isActive} onValueChange={setIsActive} trackColor={{ true: t.accentIndigo }} />
      </View>

      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
      <Button title={loading ? "Saving..." : editing ? "Save Changes" : "Add Leave Type"} onPress={handleSubmit} disabled={loading} />
    </FormModal>
  );
}
