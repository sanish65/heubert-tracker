import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Button } from "./ui";

export default function EditWordSeasonModal({ isOpen, onClose, season }) {
  const { updateWordSeason } = useApp();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (season) setTitle(season.title || "");
  }, [season, isOpen]);

  if (!season) return null;

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await updateWordSeason(season.id, title.trim());
      if (!error) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="📚 Edit Season">
      <TextField label="Season Title" value={title} onChangeText={setTitle} />
      <Button title={submitting ? "Saving..." : "Save Changes"} onPress={handleSubmit} disabled={submitting} />
    </FormModal>
  );
}
