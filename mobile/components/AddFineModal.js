import { useState, useEffect } from "react";
import { Text } from "react-native";
import { useApp } from "../context/AppContext";
import { toDateStr } from "../lib/utils";
import { FormModal, TextField, Select, Button } from "./ui";
import { useThemeColors } from "../lib/theme";

export default function AddFineModal({ isOpen, onClose, seasonId }) {
  const { addFine, employees, currentEmployee, fines, fineSeasons } = useApp();
  const t = useThemeColors();
  const today = toDateStr(new Date());

  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState(25);
  const [status, setStatus] = useState("unpaid");
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  useEffect(() => {
    if (isOpen && currentEmployee && !name) setName(currentEmployee.name);
  }, [isOpen, currentEmployee]);

  useEffect(() => {
    if (!isOpen) {
      setDate(today);
      setAmount(25);
      setStatus("unpaid");
      setError("");
      setDuplicateWarning(false);
    }
  }, [isOpen]);

  const latestFineSeasonId = fineSeasons.length
    ? [...fineSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0].id
    : null;

  const doAdd = () => {
    addFine({ name, date, amount: Number(amount), status, seasonId: seasonId ?? latestFineSeasonId });
    setDuplicateWarning(false);
    onClose();
  };

  const handleSubmit = () => {
    if (!name) return setError("Please select an employee");
    if (!amount) return setError("Please fill all required fields");

    const isDuplicate = fines.some((f) => f.employee_name === name && f.date === date && Number(f.amount) === Number(amount));
    if (isDuplicate && !duplicateWarning) {
      setDuplicateWarning(true);
      return;
    }
    doAdd();
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Record a Fine">
      <Select label="Employee" value={name} onSelect={(v) => { setName(v); setError(""); setDuplicateWarning(false); }} options={employees.map((e) => ({ value: e.name, label: e.name }))} />
      <TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={(v) => { setDate(v); setDuplicateWarning(false); }} />
      <Select label="Amount (Rs.)" value={amount} onSelect={(v) => { setAmount(v); setDuplicateWarning(false); }} options={[{ value: 25, label: "Rs 25" }, { value: 50, label: "Rs 50" }]} />
      <Select label="Status" value={status} onSelect={setStatus} options={[{ value: "unpaid", label: "Unpaid" }, { value: "paid", label: "Paid" }]} />

      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
      {duplicateWarning ? (
        <Text style={{ color: t.accentAmber, fontSize: 13, marginBottom: 12 }}>
          ⚠️ A Rs {amount} fine for {name} on {date} already exists.
        </Text>
      ) : null}

      <Button title={duplicateWarning ? "Add Anyway" : "Add Fine"} variant={duplicateWarning ? "warning" : "primary"} onPress={handleSubmit} />
    </FormModal>
  );
}
