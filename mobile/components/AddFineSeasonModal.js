import { useState } from "react";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Button } from "./ui";

export default function AddFineSeasonModal({ isOpen, onClose }) {
  const { addFineSeason } = useApp();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await addFineSeason(title.trim());
      setTitle("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="💰 New Fine Season">
      <TextField label="Season Title" value={title} onChangeText={setTitle} placeholder="e.g. Late Fines - Season 1" />
      <Button title={submitting ? "Creating..." : "Create Season"} onPress={handleSubmit} disabled={submitting} />
    </FormModal>
  );
}
