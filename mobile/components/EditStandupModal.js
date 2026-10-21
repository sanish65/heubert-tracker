import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { FormModal } from "./ui";
import DateField from "./DateField";
import { EmployeePicker, ChoiceGroup, SheetActions } from "./SheetParts";
import { STANDUP_FINE_STATUSES } from "../lib/options";
import { fineToday, parseLocalDate } from "../lib/utils";

// A standup record's edit sheet, in the record sheet's look (MobileRecordFine.dc.html): the person
// is fixed; the day and the status change.
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
    <FormModal visible={isOpen} onClose={onClose} title="Edit Standup Record">
      <EmployeePicker value={record.employee_name} />
      <DateField label="Date" value={date} maximumDate={parseLocalDate(today)} onChange={setDate} />
      <ChoiceGroup label="Status" value={status} options={STANDUP_FINE_STATUSES} onChange={setStatus} />
      <SheetActions title={submitting ? "Saving..." : "Save Changes"} onPress={handleSubmit} disabled={submitting || isFutureDate} onCancel={onClose} />
    </FormModal>
  );
}
