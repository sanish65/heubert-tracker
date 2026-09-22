import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Button } from "./ui";
import DateField from "./DateField";

export default function EditCompanyEventModal({ isOpen, onClose, event }) {
  const { updateCompanyEvent } = useApp();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (event) {
      setDate(String(event.date || "").split("T")[0]);
      setTitle(event.title || "");
    }
  }, [event, isOpen]);

  if (!event) return null;

  const handleSubmit = async () => {
    if (!title || !date) return;
    setSubmitting(true);
    try {
      const { error } = await updateCompanyEvent(event.id, date, title);
      if (!error) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="📅 Edit Event">
      <TextField label="Event Name" value={title} onChangeText={setTitle} />
      <DateField label="Date" value={date} onChange={setDate} />
      <Button title={submitting ? "Saving..." : "Save Changes"} onPress={handleSubmit} disabled={submitting} />
    </FormModal>
  );
}
