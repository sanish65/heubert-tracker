import { useState, useEffect } from "react";
import { Text } from "react-native";
import { useApp } from "../context/AppContext";
import { toDateStr, findExistingLateFine } from "../lib/utils";
import { FormModal, TextField, Select, Button } from "./ui";
import { useThemeColors } from "../lib/theme";

export default function AddFineModal({ isOpen, onClose }) {
  const { addFine, employees, currentEmployee, fines, fineSeasons } = useApp();
  const selectableEmployees = employees.filter(e => e.status !== "resigned" && e.name !== "Developers");
  const t = useThemeColors();
  const today = toDateStr(new Date());

  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState(25);
  const [status, setStatus] = useState("unpaid");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && currentEmployee && !name) setName(currentEmployee.name);
  }, [isOpen, currentEmployee]);

  useEffect(() => {
    if (!isOpen) {
      setDate(today);
      setAmount(25);
      setStatus("unpaid");
      setError("");
    }
  }, [isOpen]);

  // A new fine always belongs to the season that is current NOW — never an earlier season
  // and never a null season, whichever season the screen happens to be browsing.
  // null only remains possible when no season exists at all.
  const currentSeasonId = fineSeasons.length
    ? [...fineSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0].id
    : null;

  // A late fine is one per person per day, whatever the amount.
  const existingFine = findExistingLateFine(fines, name, date);

  const handleSubmit = async () => {
    if (!name) return setError("Please select an employee");
    if (!amount) return setError("Please fill all required fields");

    const { error: submitError } = await addFine({ name, date, amount: Number(amount), status, seasonId: currentSeasonId });
    if (submitError) return setError(submitError.message || "Failed to save the fine. Please try again.");

    onClose();
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Record a Fine">
      <Select label="Employee" value={name} onSelect={(v) => { setName(v); setError(""); }} options={selectableEmployees.map((e) => ({ value: e.name, label: e.name }))} />
      <TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={(v) => { setDate(v); setError(""); }} />
      <Select label="Amount (Rs.)" value={amount} onSelect={(v) => { setAmount(v); setError(""); }} options={[{ value: 25, label: "Rs 25" }, { value: 50, label: "Rs 50" }]} />
      <Select label="Status" value={status} onSelect={setStatus} options={[{ value: "unpaid", label: "Unpaid" }, { value: "paid", label: "Paid" }]} />

      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
      {existingFine ? (
        <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>
          🚫 {name} already has a Rs {existingFine.amount} late fine on {date}. A late fine is
          one per person per day — edit or delete the existing one instead.
        </Text>
      ) : null}

      <Button title="Add Fine" variant="primary" onPress={handleSubmit} disabled={!!existingFine} />
    </FormModal>
  );
}
