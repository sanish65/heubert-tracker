import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Select, Button } from "./ui";
import DateField from "./DateField";
import { fineToday, parseLocalDate } from "../lib/utils";

export default function EditStandupModal({ isOpen, onClose, record }) {
  const { updateStandupFine } = useApp();
  const [date, setDate] = useState("");
  const [status, setStatus] = useState("unpaid");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (record) {
      setDate(String(record.date || "").split("T")[0]);
      setStatus(record.status || "unpaid");
    }
  }, [record, isOpen]);

  if (!record) return null;

  // A standup fine records a standup that was already missed, so it can never be moved
  // to a day that has not happened yet.
  const today = fineToday();
  const isFutureDate = date > today;

  const handleSubmit = async () => {
    if (isFutureDate) return;
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
      <DateField label="Date" value={date} maximumDate={parseLocalDate(today)} onChange={setDate} />
      <Select label="Status" value={status} onSelect={setStatus} options={[{ value: "unpaid", label: "Pending" }, { value: "paid", label: "Complete" }]} />
      <Button title={submitting ? "Saving..." : "Save Changes"} onPress={handleSubmit} disabled={submitting || isFutureDate} />
    </FormModal>
  );
}
