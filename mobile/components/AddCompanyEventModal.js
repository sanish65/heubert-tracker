import { useState } from "react";
import { useApp } from "../context/AppContext";
import { FormModal, TextField } from "./ui";
import { SheetNote, SheetActions } from "./SheetParts";
import DateField from "./DateField";

// A company event, in the record sheet's look (MobileRecordLeave.dc.html).
export default function AddCompanyEventModal({ isOpen, onClose }) {
  const { addCompanyEvent } = useApp();
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
    <FormModal visible={isOpen} onClose={onClose} title="Record an Event">
      <TextField label="Event Name" value={title} onChangeText={(v) => { setTitle(v); setError(""); }} placeholder="e.g., Company Retreat" />
      <DateField label="Date" value={date} onChange={(v) => { setDate(v); setError(""); }} />
      {error ? <SheetNote>{error}</SheetNote> : null}
      <SheetActions title={loading ? "Adding..." : "Add Event"} icon="plus" onPress={handleSubmit} disabled={loading} onCancel={onClose} />
    </FormModal>
  );
}
