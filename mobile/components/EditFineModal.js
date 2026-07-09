import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Select, Button } from "./ui";

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
    <FormModal visible={isOpen} onClose={onClose} title="💰 Edit Late Fine">
      <TextField label="Employee" value={fine.employee_name} editable={false} />
      <Select label="Amount (Rs.)" value={amount} onSelect={setAmount} options={[{ value: 25, label: "Rs 25" }, { value: 50, label: "Rs 50" }]} />
      <Select label="Status" value={status} onSelect={setStatus} options={[{ value: "unpaid", label: "Unpaid" }, { value: "paid", label: "Paid" }]} />
      <Button title={submitting ? "Saving..." : "Save Changes"} onPress={handleSubmit} disabled={submitting} />
    </FormModal>
  );
}
