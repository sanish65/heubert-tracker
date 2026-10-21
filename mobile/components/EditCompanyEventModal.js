import { useState, useEffect } from "react";
import { Alert } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField } from "./ui";
import { SheetNote, SheetActions } from "./SheetParts";
import DateField from "./DateField";

// Edit or delete a company event, in the record sheet's look (MobileRecordLeave.dc.html): Save on
// the right, Delete Event beside it (the canvas's event rows show only Edit). A save or delete that
// fails keeps the sheet open and says why, as AddCompanyEventModal does.
export default function EditCompanyEventModal({ isOpen, onClose, event }) {
  const { updateCompanyEvent, deleteCompanyEvent } = useApp();
  const [date, setDate] = useState("");
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (event) {
      setDate(String(event.date || "").split("T")[0]);
      setTitle(event.title || "");
    }
    setError("");
  }, [event, isOpen]);

  if (!event) return null;

  const handleSubmit = async () => {
    if (!title || !date) return setError("Please fill all required fields");
    setSubmitting(true);
    setError("");
    try {
      const { error: failed } = await updateCompanyEvent(event.id, date, title);
      if (failed) setError(failed.message || "The event was not saved. Try again.");
      else onClose();
    } catch (e) {
      setError(e?.message || "The event was not saved. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete event?", `"${event.title}"`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSubmitting(true);
          setError("");
          try {
            const { error: failed } = await deleteCompanyEvent(event.id);
            if (failed) setError(failed.message || "The event was not deleted. Try again.");
            else onClose();
          } catch (e) {
            setError(e?.message || "The event was not deleted. Try again.");
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Edit Event">
      <TextField label="Event Name" value={title} onChangeText={setTitle} />
      <DateField label="Date" value={date} onChange={setDate} />
      {error ? <SheetNote>{error}</SheetNote> : null}
      <SheetActions
        title={submitting ? "Saving..." : "Save Changes"}
        onPress={handleSubmit}
        disabled={submitting}
        onCancel={onClose}
        secondary={{ title: "Delete Event", variant: "danger", onPress: handleDelete, disabled: submitting }}
      />
    </FormModal>
  );
}
