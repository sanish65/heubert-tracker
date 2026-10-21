import { useState } from "react";
import { useApp } from "../context/AppContext";
import { toDateStr } from "../lib/utils";
import { EMPLOYEE_STATUSES } from "../lib/options";
import { FormModal, TextField } from "./ui";
import { ChoiceGroup, SheetNote, SheetActions } from "./SheetParts";
import DateField from "./DateField";

// The statuses (lib/options.js) as the sheet's choice, in its own colours (a tone would colour
// only the statuses ChoiceGroup knows).
const STATUS_CHOICES = EMPLOYEE_STATUSES.map(({ value, label }) => ({ value, label }));

const formFrom = (employee) => ({
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

// The fields, filled from the employee when they mount. The caller passes no employee while the
// sheet is closed (the employee's screen does), so each opening starts from the record as it is
// then, and nothing refills the fields while someone is typing in them.
function EditEmployeeForm({ employee, onClose }) {
  const { updateEmployee } = useApp();
  const [form, setForm] = useState(() => formFrom(employee));
  const [error, setError] = useState("");
  const today = toDateStr(new Date());

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = () => {
    if (!form.name.trim()) return setError("Name is required");
    updateEmployee(employee.id, { ...form, name: form.name.trim() });
    onClose();
  };

  return (
    <>
      <TextField label="Full Name *" value={form.name} onChangeText={set("name")} />
      <TextField label="Employee ID" value={form.empNo} onChangeText={set("empNo")} />
      <DateField label="Date of Birth" value={form.dob} onChange={set("dob")} maximumDate={today} clearable />
      <DateField label="Office Joined Date" value={form.joinedDate} onChange={set("joinedDate")} clearable />
      <DateField label="Office Left Date" value={form.leftDate} onChange={set("leftDate")} clearable />
      <ChoiceGroup label="Status" value={form.status} options={STATUS_CHOICES} onChange={set("status")} />
      <TextField label="Work Email" value={form.workEmail} onChangeText={set("workEmail")} keyboardType="email-address" />
      <TextField label="Personal Email" value={form.personalEmail} onChangeText={set("personalEmail")} keyboardType="email-address" />
      <TextField label="Phone Number" value={form.phone} onChangeText={set("phone")} keyboardType="phone-pad" />
      <TextField label="Address" value={form.address} onChangeText={set("address")} />
      {error ? <SheetNote>{error}</SheetNote> : null}
      <SheetActions title="Save Changes" onPress={handleSubmit} onCancel={onClose} />
    </>
  );
}

// An employee's record, in the record sheet's look (MobileRecordFine.dc.html): the fields, the
// status as the sheet's segmented choice, Save Changes with Cancel under it.
export default function EditEmployeeModal({ isOpen, onClose, employee }) {
  if (!employee) return null;
  return (
    <FormModal visible={isOpen} onClose={onClose} title="Edit Employee Record">
      <EditEmployeeForm key={employee.id} employee={employee} onClose={onClose} />
    </FormModal>
  );
}
