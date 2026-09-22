import { useState } from "react";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Button } from "./ui";
import DateField from "./DateField";

export default function AddPublicHolidayModal({ isOpen, onClose }) {
  const { addPublicHoliday } = useApp();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");

  const handleSubmit = async () => {
    if (!date || !title) return;
    await addPublicHoliday(date, title);
    setDate("");
    setTitle("");
    onClose();
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="🌴 Add Public Holiday">
      <DateField label="Date" value={date} onChange={setDate} />
      <TextField label="Holiday Name" value={title} onChangeText={setTitle} placeholder="e.g. Dashain" />
      <Button title="Add Holiday" onPress={handleSubmit} />
    </FormModal>
  );
}
