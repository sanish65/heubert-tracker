import { useState, useEffect } from "react";
import { Text } from "react-native";
import { useApp } from "../context/AppContext";
import { fineToday, parseLocalDate } from "../lib/utils";
import { FormModal, Select, Button } from "./ui";
import DateField from "./DateField";
import { useThemeColors } from "../lib/theme";

export default function AddStandupFineModal({ isOpen, onClose }) {
  const { addStandupFine, employees, currentEmployee, standupFines } = useApp();
  const selectableEmployees = employees.filter(e => e.status !== "resigned" && e.name !== "Developers");
  const t = useThemeColors();
  const today = fineToday();

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

  // A missed standup can only be recorded for a day that has already happened.
  const isFutureDate = date > today;

  const doAdd = async () => {
    const { error: submitError } = await addStandupFine({ name, date, status });
    if (submitError) return setError(submitError.message || "Failed to save the record. Please try again.");
    setDuplicateWarning(false);
    onClose();
  };

  const handleSubmit = () => {
    if (!name) return setError("Please select an employee");
    if (isFutureDate) return setError("A standup fine can only be recorded for today or an earlier day.");
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
      <DateField label="Date of Incident" value={date} maximumDate={parseLocalDate(today)} onChange={(v) => { setDate(v); setError(""); setDuplicateWarning(false); }} />
      <Select label="Payment Status" value={status} onSelect={setStatus} options={[{ value: "unpaid", label: "Pending" }, { value: "paid", label: "Complete" }]} />

      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
      {isFutureDate ? (
        <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>
          🚫 {date} hasn't happened yet. A standup fine can only be dated today ({today}) or earlier.
        </Text>
      ) : null}
      {duplicateWarning ? (
        <Text style={{ color: t.accentAmber, fontSize: 13, marginBottom: 12 }}>
          ⚠️ A standup fine for {name} on {date} already exists.
        </Text>
      ) : null}

      <Button title={duplicateWarning ? "Add Anyway" : "Record Fine"} variant={duplicateWarning ? "warning" : "primary"} onPress={handleSubmit} disabled={isFutureDate} />
    </FormModal>
  );
}
