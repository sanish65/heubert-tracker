import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { FormModal } from "./ui";
import { EmployeePicker, ChoiceGroup, SheetActions } from "./SheetParts";
import { FINE_AMOUNTS, LATE_FINE_STATUSES } from "../lib/options";

// The late fine's edit sheet, in the record sheet's look (MobileRecordFine.dc.html): the person is
// fixed; the amount and the status change.
export default function EditFineModal({ isOpen, onClose, fine }) {
  const { updateFine } = useApp();
  const [amount, setAmount] = useState(25);
  const [status, setStatus] = useState("unpaid");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (fine) {
      setAmount(fine.amount || 25);
      setStatus(fine.status || "unpaid");
    }
  }, [fine, isOpen]);

  if (!fine) return null;

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { error } = await updateFine(fine.id, { amount: Number(amount), status });
      if (!error) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Edit Late Fine">
      <EmployeePicker value={fine.employee_name} />
      <ChoiceGroup label="Amount (Rs.)" mono value={amount} options={FINE_AMOUNTS} onChange={setAmount} />
      <ChoiceGroup label="Status" value={status} options={LATE_FINE_STATUSES} onChange={setStatus} />
      <SheetActions title={submitting ? "Saving..." : "Save Changes"} onPress={handleSubmit} disabled={submitting} onCancel={onClose} />
    </FormModal>
  );
}
