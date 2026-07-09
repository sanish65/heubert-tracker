import { useState, useEffect } from "react";
import { Text } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Select, Button } from "./ui";
import { useThemeColors } from "../lib/theme";

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "resigned", label: "Resigned" },
  { value: "on-leave", label: "On Leave" },
];

export default function EditEmployeeModal({ isOpen, onClose, employee }) {
  const { updateEmployee } = useApp();
  const t = useThemeColors();
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name || "",
        empNo: employee.emp_no || "",
        dob: employee.dob || "",
        joinedDate: employee.joined_date || "",
        leftDate: employee.left_date || "",
        workEmail: employee.work_email || "",
        personalEmail: employee.personal_email || "",
        phone: employee.phone || "",
        address: employee.address || "",
        status: employee.status || "active",
      });
      setError("");
    }
  }, [employee]);

  if (!employee || !form) return null;

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = () => {
    if (!form.name.trim()) return setError("Name is required");
    updateEmployee(employee.id, { ...form, name: form.name.trim() });
    onClose();
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Edit Employee Record">
      <TextField label="Full Name *" value={form.name} onChangeText={set("name")} />
      <TextField label="Employee ID" value={form.empNo} onChangeText={set("empNo")} />
      <TextField label="Date of Birth (YYYY-MM-DD)" value={form.dob} onChangeText={set("dob")} />
      <TextField label="Office Joined Date (YYYY-MM-DD)" value={form.joinedDate} onChangeText={set("joinedDate")} />
      <TextField label="Office Left Date (YYYY-MM-DD)" value={form.leftDate} onChangeText={set("leftDate")} />
      <Select label="Status" value={form.status} onSelect={set("status")} options={STATUS_OPTIONS} />
      <TextField label="Work Email" value={form.workEmail} onChangeText={set("workEmail")} keyboardType="email-address" />
      <TextField label="Personal Email" value={form.personalEmail} onChangeText={set("personalEmail")} keyboardType="email-address" />
      <TextField label="Phone Number" value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
      <TextField label="Address" value={form.address} onChangeText={set("address")} />
      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
      <Button title="Save Changes" onPress={handleSubmit} />
    </FormModal>
  );
}
