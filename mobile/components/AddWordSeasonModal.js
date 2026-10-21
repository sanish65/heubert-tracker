import { useState } from "react";
import { useApp } from "../context/AppContext";
import { FormModal, TextField } from "./ui";
import { SheetActions } from "./SheetParts";

// A new Word of the Day season, in the record sheet's look (MobileRecordFine.dc.html).
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
    <FormModal visible={isOpen} onClose={onClose} title="New Season">
      <TextField label="Season Title" value={title} onChangeText={setTitle} placeholder="e.g. Word of the Day - Season 3" />
      <SheetActions title={submitting ? "Creating..." : "Create Season"} icon="plus" onPress={handleSubmit} disabled={submitting} onCancel={onClose} />
    </FormModal>
  );
}
