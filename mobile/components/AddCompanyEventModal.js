import { useState } from "react";
import { Text } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Button } from "./ui";
import { useThemeColors } from "../lib/theme";

export default function AddCompanyEventModal({ isOpen, onClose }) {
  const { addCompanyEvent } = useApp();
  const t = useThemeColors();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!title || !date) return setError("Please fill all required fields");
    setLoading(true);
    await addCompanyEvent(date, title);
    setLoading(false);
    setDate("");
    setTitle("");
    onClose();
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="📅 Record an Event">
      <TextField label="Event Name" value={title} onChangeText={(v) => { setTitle(v); setError(""); }} placeholder="e.g., Company Retreat" />
      <TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={(v) => { setDate(v); setError(""); }} />
      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
      <Button title={loading ? "Adding..." : "Add Event"} onPress={handleSubmit} disabled={loading} />
    </FormModal>
  );
}
