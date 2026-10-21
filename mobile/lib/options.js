// The domain lists the sheets and screens share, in the app's words: an employee's statuses, a
// fine's amounts and statuses, the kinds of leave. They lived in the sheet components before; the
// Team, Employee and Meeting screens read them from here now. Pure: no imports, tested by
// src/lib/mobileOptions.test.mjs.

// The statuses an employee can have, as the edit sheet stores them, and the canvas pill each shows
// as: active green and resigned red (MobileTeam.dc.html), on leave cyan (the canvas's leave colour).
export const EMPLOYEE_STATUSES = [
  { value: "active", label: "Active", tone: "green" },
  { value: "resigned", label: "Resigned", tone: "red" },
  { value: "on-leave", label: "On Leave", tone: "cyan" },
];

// No status means active, as everywhere in the app; one the app does not know shows as it is, grey.
export function employeeStatus(employee) {
  const value = employee?.status || "active";
  return EMPLOYEE_STATUSES.find((s) => s.value === value) || { value, label: String(value), tone: "gray" };
}

// The two amounts a late fine can be, and the two statuses in each fine sheet's own words.
export const FINE_AMOUNTS = [
  { value: 25, label: "Rs. 25" },
  { value: 50, label: "Rs. 50" },
];
export const LATE_FINE_STATUSES = [
  { value: "unpaid", label: "Unpaid", tone: "amber" },
  { value: "paid", label: "Paid", tone: "green" },
];
export const STANDUP_FINE_STATUSES = [
  { value: "unpaid", label: "Pending", tone: "amber" },
  { value: "paid", label: "Complete", tone: "green" },
];

// The three kinds of leave, the two halves of a day, and a leave's one or several days.
export const LEAVE_TYPE_OPTIONS = [
  { value: "full", label: "Full Day" },
  { value: "half", label: "Half Day" },
  { value: "early", label: "Early Leave" },
];
export const SEGMENT_OPTIONS = [
  { value: "first", label: "First Half", icon: "sunrise" },
  { value: "second", label: "Second Half", icon: "sunset" },
];
export const DAY_OPTIONS = [
  { value: "no", label: "Single day" },
  { value: "yes", label: "Multiple days" },
];
