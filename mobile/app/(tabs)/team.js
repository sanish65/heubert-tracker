import { useMemo, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from "react-native";
import { useApp } from "../../context/AppContext";
import { useThemeColors, radius, fonts } from "../../lib/theme";
import { Screen, Card, EmptyState, Pill } from "../../components/ui";
import TopBar from "../../components/TopBar";
import Avatar from "../../components/Avatar";
import Icon from "../../components/Icon";
import AddEmployeeModal from "../../components/AddEmployeeModal";
import EmployeeDetailModal from "../../components/EmployeeDetailModal";
import { EMPLOYEE_STATUSES, employeeStatus } from "../../lib/options";

// Team, as the canvas's MobileTeam.dc.html: the top bar (Add for admins, as before), the search,
// the status filter, then the directory. A row opens the employee's screen (EmployeeDetailModal),
// which now holds the admin's Edit and Delete; the rows carried them before the redesign, along
// with the ID, joined date, phone and fines total that the employee's screen shows. You come first
// and people who resigned last, as on the canvas; the rest keep the directory's order (by name).

// The filter: everyone, then each status. On Leave, which the canvas does not draw, shows while
// someone has that status (or while it is the one chosen).
const STATUS_FILTERS = [{ value: "all", label: "All" }, ...EMPLOYEE_STATUSES];

// What the search matches, as the web's Employees: the name, either email, the ID (the one the app
// shows, so a person without an employee number is found by "EMP-" and their id).
const searchable = (emp) => [emp.name, emp.work_email, emp.personal_email, emp.emp_no || `EMP-${emp.id}`];

function AddButton({ onPress }) {
  const t = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add employee"
      style={({ pressed }) => [styles.add, { backgroundColor: pressed ? t.primaryHover : t.primary, boxShadow: t.glowPrimary }]}
    >
      <Icon name="plus" size={18} strokeWidth={2.2} color="#FFFFFF" />
      <Text style={styles.addText}>Add</Text>
    </Pressable>
  );
}

// The canvas's search: a 48-high glass field with the search icon; cyan edge while typing.
function SearchField({ value, onChangeText }) {
  const t = useThemeColors();
  const [focused, setFocused] = useState(false);
  return (
    <Card style={[styles.search, focused ? { borderColor: t.cyan, borderTopColor: t.cyan } : { borderColor: t.lineStrong }]}>
      <Icon name="search" size={18} strokeWidth={1.9} color={t.text3} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search name, email or ID"
        placeholderTextColor={t.text3}
        accessibilityLabel="Search employees"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.searchInput, { color: t.text1 }]}
      />
    </Card>
  );
}

// One status in the canvas's filter: a glass pill with its count; the chosen one filled primary.
// Its count is plain white where the canvas dims it to 80%, which is under 4.5:1 on the blue.
function StatusChip({ label, count, checked, onPress }) {
  const t = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked }}
      accessibilityLabel={`${label}, ${count}`}
      style={({ pressed }) => [
        styles.chip,
        checked ? { backgroundColor: t.primary, borderColor: t.primary } : { backgroundColor: pressed ? t.raised : t.surface, borderColor: t.lineStrong },
      ]}
    >
      <Text style={[styles.chipText, { color: checked ? "#FFFFFF" : t.text1, fontFamily: checked ? fonts.bodySemibold : fonts.bodyMedium }]}>{label}</Text>
      <Text style={[styles.chipCount, { color: checked ? "#FFFFFF" : t.text3 }]}>{count}</Text>
    </Pressable>
  );
}

// A person in the directory, as the canvas's row: photo or initials, name and email, the status
// pill, the chevron to their screen. The canvas dims a resigned row; that would take its text under
// 4.5:1, so the red pill says it instead.
function EmployeeRow({ employee, isMe, first, onPress }) {
  const t = useThemeColors();
  const status = employeeStatus(employee);
  const email = employee.work_email || employee.personal_email;
  const label = [isMe ? `${employee.name}, you` : employee.name, status.label, email].filter(Boolean).join(", ");
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Open profile`}
      style={({ pressed }) => [styles.row, !first && { borderTopWidth: 1, borderTopColor: t.line }, pressed && styles.pressed]}
    >
      <Avatar name={employee.name} size={40} isMe={isMe} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowName, { color: t.text1 }]}>
          {isMe ? `${employee.name} (you)` : employee.name}
        </Text>
        {email ? (
          <Text numberOfLines={1} style={[styles.rowEmail, { color: t.text3 }]}>
            {email}
          </Text>
        ) : null}
      </View>
      <Pill tone={status.tone}>{status.label}</Pill>
      <Icon name="chevron-right" size={18} strokeWidth={2} color={t.text3} />
    </Pressable>
  );
}

export default function TeamScreen() {
  const { employees, isAdmin, currentEmployee } = useApp();
  const [showAdd, setShowAdd] = useState(false);
  // The person whose screen is open, by id: it shows each edit, and closes once they are deleted.
  const [viewingId, setViewingId] = useState(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const myId = currentEmployee?.id ?? null;

  // You first, then everyone still here, then those who resigned, each in the directory's order.
  const ordered = useMemo(() => {
    const me = [];
    const here = [];
    const resigned = [];
    for (const emp of employees) {
      if (myId !== null && emp.id === myId) me.push(emp);
      else if (employeeStatus(emp).value === "resigned") resigned.push(emp);
      else here.push(emp);
    }
    return [...me, ...here, ...resigned];
  }, [employees, myId]);

  // The search narrows the list and the filter applies on top, so each chip counts within the
  // search, as the web's Employees.
  const searched = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ordered;
    return ordered.filter((emp) => searchable(emp).some((value) => String(value ?? "").toLowerCase().includes(q)));
  }, [ordered, query]);

  const counts = useMemo(() => {
    const c = { all: searched.length };
    for (const emp of searched) {
      const status = employeeStatus(emp).value;
      c[status] = (c[status] || 0) + 1;
    }
    return c;
  }, [searched]);

  const anyOnLeave = employees.some((emp) => employeeStatus(emp).value === "on-leave");
  const filters = STATUS_FILTERS.filter((f) => f.value !== "on-leave" || anyOnLeave || statusFilter === "on-leave");
  const visible = statusFilter === "all" ? searched : searched.filter((emp) => employeeStatus(emp).value === statusFilter);

  const viewing = viewingId === null ? null : employees.find((emp) => emp.id === viewingId) || null;

  return (
    <Screen>
      <TopBar
        title="Team"
        eyebrow={`Employee directory · ${employees.length}`}
        right={isAdmin ? <AddButton onPress={() => setShowAdd(true)} /> : null}
        bell={false}
        account={false}
      />

      <SearchField value={query} onChangeText={setQuery} />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersContent}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Filter by status" style={styles.filtersRow}>
          {filters.map((f) => (
            <StatusChip key={f.value} label={f.label} count={counts[f.value] || 0} checked={statusFilter === f.value} onPress={() => setStatusFilter(f.value)} />
          ))}
        </View>
      </ScrollView>

      <Card style={styles.directory}>
        {visible.length === 0 ? (
          <EmptyState icon="users" text="No employees found" />
        ) : (
          visible.map((emp, i) => (
            <EmployeeRow key={emp.id} employee={emp} isMe={myId !== null && emp.id === myId} first={i === 0} onPress={() => setViewingId(emp.id)} />
          ))
        )}
      </Card>

      <AddEmployeeModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
      <EmployeeDetailModal isOpen={!!viewing} onClose={() => setViewingId(null)} employee={viewing} />
    </Screen>
  );
}

// Sizes, gaps and type from MobileTeam.dc.html.
const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },

  // Add: 44 high and 14 round, the plus 12 in.
  add: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingLeft: 12, paddingRight: 16, borderRadius: 14 },
  addText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: "#FFFFFF" },

  // The search, the filter and the directory, 12 apart.
  search: { flexDirection: "row", alignItems: "center", gap: 11, height: 48, paddingVertical: 0, paddingLeft: 15, paddingRight: 14, borderRadius: 14, marginBottom: 12 },
  searchInput: { flex: 1, height: "100%", paddingVertical: 0, fontFamily: fonts.body, fontSize: 15 },
  // The filter scrolls sideways, edge to edge, once it is wider than the phone.
  filters: { flexGrow: 0, marginHorizontal: -16, marginBottom: 12 },
  filtersContent: { paddingHorizontal: 16 },
  filtersRow: { flexDirection: "row", gap: 8 },
  chip: { flexDirection: "row", alignItems: "center", gap: 8, height: 44, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: 14 },
  chipCount: { fontFamily: fonts.mono, fontSize: 12 },

  // The directory: a 20-round glass card, 4 by 16 in; rows at least 68 high on a hairline.
  directory: { borderRadius: radius.xl, paddingVertical: 4, paddingHorizontal: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 68, paddingVertical: 8 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  rowEmail: { fontFamily: fonts.mono, fontSize: 12 },
});
