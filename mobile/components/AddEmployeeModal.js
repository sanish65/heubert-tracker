import { useState } from "react";
import { Text } from "react-native";
import { useApp } from "../context/AppContext";
import { toDateStr } from "../lib/utils";
import { FormModal, TextField, Button } from "./ui";
import DateField from "./DateField";
import { useThemeColors } from "../lib/theme";

const emptyForm = () => ({
  name: "",
  empNo: "",
  dob: "",
  joinedDate: toDateStr(new Date()),
  leftDate: "",
  workEmail: "",
  personalEmail: "",
  phone: "",
  address: "",
});

export default function AddEmployeeModal({ isOpen, onClose }) {
  const { addEmployee, employees } = useApp();
  const t = useThemeColors();
  const [form, setForm] = useState(emptyForm());
  const today = toDateStr(new Date());
  const [error, setError] = useState("");

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = () => {
    if (!form.name.trim()) return setError("Name is required");
    if (employees.find((emp) => emp.name.toLowerCase() === form.name.trim().toLowerCase())) {
      return setError("Employee with this name already exists");
    }
    addEmployee({ ...form, name: form.name.trim(), status: "active" });
    setForm(emptyForm());
    setError("");
    onClose();
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Add New Employee">
      <TextField label="Full Name *" value={form.name} onChangeText={set("name")} placeholder="e.g. John Doe" />
      <TextField label="Employee ID" value={form.empNo} onChangeText={set("empNo")} placeholder="e.g. EMP-001" />
      <DateField label="Date of Birth" value={form.dob} onChange={set("dob")} maximumDate={today} clearable />
      <DateField label="Office Joined Date" value={form.joinedDate} onChange={set("joinedDate")} clearable />
      <DateField label="Office Left Date" value={form.leftDate} onChange={set("leftDate")} clearable />
      <TextField label="Phone Number" value={form.phone} onChangeText={set("phone")} placeholder="+977-..." keyboardType="phone-pad" />
      <TextField label="Work Email" value={form.workEmail} onChangeText={set("workEmail")} placeholder="work@gmail.com" keyboardType="email-address" />
      <TextField label="Personal Email" value={form.personalEmail} onChangeText={set("personalEmail")} placeholder="personal@gmail.com" keyboardType="email-address" />
      <TextField label="Address" value={form.address} onChangeText={set("address")} placeholder="City, District..." />
      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
      <Button title="Create Employee" onPress={handleSubmit} />
    </FormModal>
  );
}
