// The Employees page's sums and lists: tenure, the details panel's recent records and
// the directory's sort orders. Pure, no imports, so it runs under `npm test`.

// "2 yrs 7 mos" from the joined date to `until` (the left date, or today).
export function tenureLabel(joined, until) {
  if (!joined || !until) return "N/A";
  const [y1, m1, d1] = String(joined).slice(0, 10).split("-").map(Number);
  const [y2, m2, d2] = String(until).slice(0, 10).split("-").map(Number);
  let months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (!Number.isFinite(months) || months < 0) return "N/A";
  if (months === 0) return "Under a month";
  const years = Math.floor(months / 12);
  months %= 12;
  return [years ? `${years} ${years === 1 ? "yr" : "yrs"}` : "", months ? `${months} ${months === 1 ? "mo" : "mos"}` : ""]
    .filter(Boolean)
    .join(" ");
}

const DAY_MS = 86400000;

function longDate(day) {
  const d = new Date(`${String(day).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function leaveLength(leave) {
  if (leave.type === "half") return "half day";
  const start = Date.parse(`${leave.start_date}T00:00:00Z`);
  const end = Date.parse(`${leave.end_date || leave.start_date}T00:00:00Z`);
  const days = Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / DAY_MS) + 1 : 1;
  return days <= 1 ? "full day" : `${days} days`;
}

// A person's latest leaves and late fines, newest first: "Sick leave · full day" with
// Upcoming / On leave / Taken, and "Late fine · Rs. 200" with Paid / Unpaid.
export function recentRecords({ name, leaves = [], fines = [], leaveTypes = [], today, limit = 4 }) {
  const typeName = new Map(leaveTypes.map((t) => [t.id, t.name]));
  const items = [];
  for (const l of leaves) {
    if (l.employee_name !== name || !l.start_date) continue;
    const end = l.end_date || l.start_date;
    const kind = typeName.get(l.leave_type_id);
    const when = l.start_date > today ? ["Upcoming", "pill-cyan"] : end >= today ? ["On leave", "pill-blue"] : ["Taken", "pill-gray"];
    items.push({
      id: `leave-${l.id}`,
      kind: "leave",
      day: l.start_date,
      // "Sick" reads "Sick leave"; a type already named "Casual Leave" stays as it is.
      title: `${kind ? (/leave$/i.test(kind) ? kind : `${kind} leave`) : "Leave"} · ${leaveLength(l)}`,
      dateLabel: longDate(l.start_date),
      pillLabel: when[0],
      pill: when[1],
    });
  }
  for (const f of fines) {
    if (f.employee_name !== name || !f.date) continue;
    const paid = f.status === "paid";
    items.push({
      id: `fine-${f.id}`,
      kind: "fine",
      day: String(f.date).slice(0, 10),
      title: `Late fine · Rs. ${Number(f.amount || 0).toLocaleString()}`,
      dateLabel: longDate(f.date),
      pillLabel: paid ? "Paid" : "Unpaid",
      pill: paid ? "pill-green" : "pill-amber",
    });
  }
  return items.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0)).slice(0, limit);
}

export const SORTS = [
  { id: "name", label: "Name A–Z" },
  { id: "joined", label: "Joined date" },
  { id: "unpaid", label: "Unpaid fines" },
];

// rows: [{ emp, stats }]. Joined date puts the longest-serving first; unpaid fines puts
// the most owed first. Ties fall back to the name.
export function sortRows(rows, sort) {
  const byName = (a, b) => String(a.emp.name || "").localeCompare(String(b.emp.name || ""));
  const list = [...rows];
  if (sort === "joined") {
    return list.sort((a, b) => {
      const x = a.emp.joined_date || "9999-12-31";
      const y = b.emp.joined_date || "9999-12-31";
      return x < y ? -1 : x > y ? 1 : byName(a, b);
    });
  }
  if (sort === "unpaid") return list.sort((a, b) => (b.stats?.unpaid || 0) - (a.stats?.unpaid || 0) || byName(a, b));
  return list.sort(byName);
}

// The leave balances "Leave left" adds up: the types set to count in it (personal, sick,
// festival), not work from home, unpaid or exam leave. A type saved before that setting
// existed (counts_in_leave_left missing) follows the rule its migration applies.
export function inLeaveLeft(balances) {
  return (balances || []).filter((b) =>
    typeof b.counts_in_leave_left === "boolean"
      ? b.counts_in_leave_left
      : !b.is_unpaid && !/work from home|exam/i.test(b.name || "")
  );
}
