import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Select, Button } from "./ui";

export default function EditStandupModal({ isOpen, onClose, record }) {
  const { updateStandupFine } = useApp();
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("unpaid");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setDate(record.date || "");
      setStatus(record.status || "unpaid");
    }
  }, [record, isOpen]);

  if (!record) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { error } = await updateStandupFine(record.id, { date, status });
      if (!error) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="📝 Edit Standup Record">
      <TextField label="Employee" value={record.employee_name} editable={false} />
      <TextField label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} />
      <Select label="Status" value={status} onSelect={setStatus} options={[{ value: "unpaid", label: "Pending" }, { value: "paid", label: "Complete" }]} />
      <Button title={submitting ? "Saving..." : "Save Changes"} onPress={handleSubmit} disabled={submitting} />
    </FormModal>
  );
}
