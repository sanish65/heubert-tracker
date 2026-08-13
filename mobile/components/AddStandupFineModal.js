import { useState, useEffect } from "react";
import { Text } from "react-native";
import { useApp } from "../context/AppContext";
import { toDateStr } from "../lib/utils";
import { FormModal, TextField, Select, Button } from "./ui";
import { useThemeColors } from "../lib/theme";

export default function AddStandupFineModal({ isOpen, onClose }) {
  const { addStandupFine, employees, currentEmployee, standupFines } = useApp();
  const selectableEmployees = employees.filter(e => e.status !== "resigned" && e.name !== "Developers");
  const t = useThemeColors();
  const today = toDateStr(new Date());

  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState("unpaid");
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  useEffect(() => {
    if (isOpen && currentEmployee && !name) setName(currentEmployee.name);
  }, [isOpen, currentEmployee]);

  useEffect(() => {
    if (!isOpen) {
      setDate(today);
      setStatus("unpaid");
      setError("");
      setDuplicateWarning(false);
    }
  }, [isOpen]);

  const doAdd = () => {
    addStandupFine({ name, date, status });
    setDuplicateWarning(false);
    onClose();
  };

  const handleSubmit = () => {
    if (!name) return setError("Please select an employee");
    const isDuplicate = standupFines.some((s) => s.employee_name === name && s.date === date);
    if (isDuplicate && !duplicateWarning) {
      setDuplicateWarning(true);
      return;
    }
    doAdd();
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Missing Standup Report">
      <Select label="Employee" value={name} onSelect={(v) => { setName(v); setError(""); setDuplicateWarning(false); }} options={selectableEmployees.map((e) => ({ value: e.name, label: e.name }))} />
      <TextField label="Date of Incident (YYYY-MM-DD)" value={date} onChangeText={(v) => { setDate(v); setDuplicateWarning(false); }} />
      <Select label="Payment Status" value={status} onSelect={setStatus} options={[{ value: "unpaid", label: "Pending" }, { value: "paid", label: "Complete" }]} />

      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
      {duplicateWarning ? (
        <Text style={{ color: t.accentAmber, fontSize: 13, marginBottom: 12 }}>
          ⚠️ A standup fine for {name} on {date} already exists.
        </Text>
      ) : null}

      <Button title={duplicateWarning ? "Add Anyway" : "Record Fine"} variant={duplicateWarning ? "warning" : "primary"} onPress={handleSubmit} />
    </FormModal>
  );
}
