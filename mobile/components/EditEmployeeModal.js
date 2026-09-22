import { useState, useEffect } from "react";
import { Text } from "react-native";
import { useApp } from "../context/AppContext";
import { toDateStr } from "../lib/utils";
import { FormModal, TextField, Select, Button } from "./ui";
import DateField from "./DateField";
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
  const today = toDateStr(new Date());
  const [error, setError] = useState("");

  useEffect(() => {
    if (employee) {
      setForm({
        name: employee.name || "",
        empNo: employee.emp_no || "",
        dob: String(employee.dob || "").split("T")[0],
        joinedDate: String(employee.joined_date || "").split("T")[0],
        leftDate: String(employee.left_date || "").split("T")[0],
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
      <DateField label="Date of Birth" value={form.dob} onChange={set("dob")} maximumDate={today} clearable />
      <DateField label="Office Joined Date" value={form.joinedDate} onChange={set("joinedDate")} clearable />
      <DateField label="Office Left Date" value={form.leftDate} onChange={set("leftDate")} clearable />
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
