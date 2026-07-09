import { useState } from "react";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Button } from "./ui";

export default function AddWordSeasonModal({ isOpen, onClose }) {
  const { addWordSeason } = useApp();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await addWordSeason(title.trim());
      setTitle("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="📚 New Season">
      <TextField label="Season Title" value={title} onChangeText={setTitle} placeholder="e.g. Word of the Day - Season 3" />
      <Button title={submitting ? "Creating..." : "Create Season"} onPress={handleSubmit} disabled={submitting} />
    </FormModal>
  );
}
