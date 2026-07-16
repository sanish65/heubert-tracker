import { useState } from "react";
import { Text } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Button } from "./ui";
import { useThemeColors } from "../lib/theme";

export default function AddLeaveSeasonModal({ isOpen, onClose }) {
  const { addLeaveSeason } = useApp();
  const t = useThemeColors();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await addLeaveSeason(title.trim());
      setTitle("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="🏖️ New Leave Season">
      <TextField label="Season Title" value={title} onChangeText={setTitle} placeholder="e.g. Fiscal Year 2026" />
      <Text style={{ color: t.textMuted, fontSize: 13, marginBottom: 14 }}>
        Every employee's leave balances reset to their full annual quota under a new season.
      </Text>
      <Button title={submitting ? "Creating..." : "Create Season"} onPress={handleSubmit} disabled={submitting} />
    </FormModal>
  );
}
