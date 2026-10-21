import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { fineToday, parseLocalDate } from "../lib/utils";
import { FormModal } from "./ui";
import DateField from "./DateField";
import { EmployeePicker, ChoiceGroup, SheetNote, SheetActions } from "./SheetParts";
import { STANDUP_FINE_STATUSES } from "../lib/options";

// A missed standup, in the record sheet's look (MobileRecordFine.dc.html). A second record for the
// same person and day warns first (amber, as MobileRecordLeave's warning) and needs Add Anyway.
export default function AddStandupFineModal({ isOpen, onClose }) {
  const { addStandupFine, employees, currentEmployee, standupFines } = useApp();
  const selectableEmployees = employees.filter(e => e.status !== "resigned" && e.name !== "Developers");
  const today = fineToday();

  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [status, setStatus] = useState("unpaid");
  const [error, setError] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  useEffect(() => {
    if (isOpen && currentEmployee && !name) setName(currentEmployee.name);
  }, [isOpen, currentEmployee]);

  useEffect(() => {
    if (!isOpen) {
      setDate(today);
      setStatus("unpaid");
      setError("");
      setDuplicateWarning(false);
    }
  }, [isOpen]);

  // A missed standup can only be recorded for a day that has already happened.
  const isFutureDate = date > today;

  const doAdd = async () => {
    const { error: submitError } = await addStandupFine({ name, date, status });
    if (submitError) return setError(submitError.message || "Failed to save the record. Please try again.");
    setDuplicateWarning(false);
    onClose();
  };

  const handleSubmit = () => {
    if (!name) return setError("Please select an employee");
    if (isFutureDate) return setError("A standup fine can only be recorded for today or an earlier day.");
    const isDuplicate = standupFines.some((s) => s.employee_name === name && s.date === date);
    if (isDuplicate && !duplicateWarning) {
      setDuplicateWarning(true);
      return;
    }
    doAdd();
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Missing Standup Report">
      <EmployeePicker
        value={name}
        names={selectableEmployees.map((e) => e.name)}
        onChange={(v) => { setName(v); setError(""); setDuplicateWarning(false); }}
      />
      <DateField label="Date of Incident" value={date} maximumDate={parseLocalDate(today)} onChange={(v) => { setDate(v); setError(""); setDuplicateWarning(false); }} />
      <ChoiceGroup label="Payment Status" value={status} options={STANDUP_FINE_STATUSES} onChange={setStatus} />

      {error ? <SheetNote>{error}</SheetNote> : null}
      {isFutureDate ? (
        <SheetNote>{`${date} hasn't happened yet. A standup fine can only be dated today (${today}) or earlier.`}</SheetNote>
      ) : null}
      {duplicateWarning ? <SheetNote tone="warning">{`A standup fine for ${name} on ${date} already exists.`}</SheetNote> : null}

      <SheetActions
        title={duplicateWarning ? "Add Anyway" : "Record Fine"}
        variant={duplicateWarning ? "secondary" : "primary"}
        onPress={handleSubmit}
        disabled={isFutureDate}
        onCancel={onClose}
      />
    </FormModal>
  );
}
