import { useState, useMemo } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { useApp } from "../../context/AppContext";
import { useThemeColors } from "../../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Button, Chip } from "../../components/ui";
import LeaveCalendar from "../../components/LeaveCalendar";
import AddLeaveModal from "../../components/AddLeaveModal";
import EditLeaveModal from "../../components/EditLeaveModal";
import AddPublicHolidayModal from "../../components/AddPublicHolidayModal";
import { computeLeaveBalances } from "../../lib/utils";

const TYPE_LABELS = { full: "Full Day", half: "Half Day", early: "Early Leave" };
const TYPE_ICONS = { full: "📅", half: "🌗", early: "🚪" };
const TYPE_COLORS = { full: "accentIndigo", half: "accentAmber", early: "accentSky" };

export default function LeavesScreen() {
  const { leaves, employees, deleteLeave, isAdmin, currentEmployee, publicHolidays, deletePublicHoliday, leaveTypes } = useApp();
  const t = useThemeColors();
  const [filterEmployee, setFilterEmployee] = useState("");
  const [editingLeave, setEditingLeave] = useState(null);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showAddHoliday, setShowAddHoliday] = useState(false);

  const leaveTypeById = useMemo(() => {
    const map = new Map();
    (leaveTypes || []).forEach((lt) => map.set(lt.id, lt));
    return map;
  }, [leaveTypes]);

  const holidaySet = useMemo(
    () => new Set((publicHolidays || []).map((h) => h.date?.split("T")[0])),
    [publicHolidays]
  );

  const employeeBalances = useMemo(() => {
    if (!filterEmployee) return [];
    return computeLeaveBalances(filterEmployee, leaves, leaveTypes, new Date().getFullYear(), holidaySet);
  }, [filterEmployee, leaves, leaveTypes, holidaySet]);

  const calculateDays = (start, end, type) => {
    let diff = 0;
    let current = new Date(start + "T00:00:00");
    const eDate = new Date(end + "T00:00:00");
    while (current <= eDate) {
      const dow = current.getDay();
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      const dtStr = `${y}-${m}-${d}`;
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = publicHolidays.some((h) => h.date.startsWith(dtStr));
      if (!isWeekend && !isHoliday) diff++;
      current.setDate(current.getDate() + 1);
    }
    return type === "half" ? diff * 0.5 : diff;
  };

  const filtered = useMemo(() => {
    let list = [...leaves];
    if (filterEmployee) list = list.filter((l) => l.employee_name === filterEmployee);
    return list.sort((a, b) => (b.start_date > a.start_date ? -1 : 1)).reverse();
  }, [leaves, filterEmployee]);

  const empSummary = useMemo(() => {
    return employees
      .map((emp) => {
        const empLeaves = leaves.filter((l) => l.employee_name === emp.name);
        const totalDays = empLeaves.reduce((sum, l) => {
          const days = l.dates ? l.dates.length : calculateDays(l.start_date, l.end_date, l.type);
          return sum + (l.type === "half" ? days * 0.5 : days);
        }, 0);
        return { name: emp.name, records: empLeaves.length, totalDays };
      })
      .filter((e) => e.records > 0)
      .sort((a, b) => b.totalDays - a.totalDays);
  }, [employees, leaves]);

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const confirmDeleteLeave = (leave) => {
    Alert.alert("Delete leave?", `${leave.employee_name} · ${leave.start_date}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteLeave(leave.id) },
    ]);
  };

  const confirmDeleteHoliday = (holiday) => {
    Alert.alert("Delete holiday?", holiday.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deletePublicHoliday(holiday.id) },
    ]);
  };

  return (
    <Screen>
      <Card>
        <LeaveCalendar leaves={leaves} selectedEmployee={filterEmployee || null} publicHolidays={publicHolidays} />
      </Card>

      {empSummary.length > 0 && (
        <Card>
          <SectionTitle>Leave Summary by Employee</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            <Chip label={`All (${leaves.length})`} active={filterEmployee === ""} onPress={() => setFilterEmployee("")} />
            {empSummary.map((emp) => (
              <Chip
                key={emp.name}
                label={`${emp.name} · ${emp.totalDays}d`}
                active={filterEmployee === emp.name}
                onPress={() => setFilterEmployee(filterEmployee === emp.name ? "" : emp.name)}
              />
            ))}
          </View>
        </Card>
      )}

      {filterEmployee && employeeBalances.length > 0 && (
        <Card>
          <SectionTitle>{filterEmployee}'s Leave Balances ({new Date().getFullYear()})</SectionTitle>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {employeeBalances.map((b) => (
              <Chip key={b.id} label={`${b.name}: ${b.remaining}/${b.annual_days}`} active={false} onPress={() => {}} />
            ))}
          </View>
        </Card>
      )}

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <SectionTitle>Leave Records ({filtered.length})</SectionTitle>
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
          {isAdmin && <Button title="🌴 Add Holiday" variant="ghost" small onPress={() => setShowAddHoliday(true)} />}
          <Button title="+ Record Leave" variant="accent" small onPress={() => setShowAddLeave(true)} />
        </View>

        {filtered.length === 0 ? (
          <EmptyState icon="🏖️" text="No leave records yet" />
        ) : (
          filtered.map((leave) => {
            const canEdit = isAdmin || (currentEmployee && leave.employee_name === currentEmployee.name);
            const dayCount = leave.type === "half" ? (leave.dates || []).length * 0.5 : (leave.dates || []).length;
            return (
              <View key={leave.id} style={{ borderLeftWidth: 3, borderLeftColor: t[TYPE_COLORS[leave.type]], backgroundColor: t.bgElevated, borderRadius: 10, padding: 12, marginBottom: 10 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.textPrimary, fontWeight: "700", fontSize: 14 }}>{leave.employee_name}</Text>
                    <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>
                      {TYPE_ICONS[leave.type]} {TYPE_LABELS[leave.type]} · {leaveTypeById.get(leave.leave_type_id)?.name || "Uncategorized"}
                    </Text>
                  </View>
                  {canEdit && (
                    <View style={{ flexDirection: "row", gap: 14 }}>
                      <Pressable onPress={() => setEditingLeave(leave)}>
                        <Text style={{ fontSize: 16 }}>✏️</Text>
                      </Pressable>
                      <Pressable onPress={() => confirmDeleteLeave(leave)}>
                        <Text style={{ fontSize: 16 }}>🗑</Text>
                      </Pressable>
                    </View>
                  )}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 8 }}>
                  <Text style={{ color: t.textSecondary, fontSize: 13 }}>
                    {formatDate(leave.start_date)}
                    {leave.start_date !== leave.end_date ? ` → ${formatDate(leave.end_date)}` : ""}
                  </Text>
                  <Text style={{ color: t.textMuted, fontSize: 12 }}>
                    {dayCount || calculateDays(leave.start_date, leave.end_date, leave.type)} working days
                  </Text>
                </View>
                {leave.reason ? <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 6 }}>💬 {leave.reason}</Text> : null}
              </View>
            );
          })
        )}
      </Card>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <SectionTitle>🌴 Public Holidays</SectionTitle>
          {isAdmin && <Button title="+ Add" variant="ghost" small onPress={() => setShowAddHoliday(true)} />}
        </View>
        {publicHolidays.length === 0 ? (
          <EmptyState text="No public holidays recorded." />
        ) : (
          publicHolidays.map((holiday) => (
            <View
              key={holiday.id}
              style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: t.border }}
            >
              <View>
                <Text style={{ color: t.textPrimary, fontSize: 14, fontWeight: "600" }}>{holiday.title}</Text>
                <Text style={{ color: t.textMuted, fontSize: 12 }}>
                  {new Date(holiday.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </Text>
              </View>
              {isAdmin && (
                <Pressable onPress={() => confirmDeleteHoliday(holiday)}>
                  <Text style={{ color: t.accentRed, fontSize: 18 }}>×</Text>
                </Pressable>
              )}
            </View>
          ))
        )}
      </Card>

      <AddLeaveModal isOpen={showAddLeave} onClose={() => setShowAddLeave(false)} />
      <EditLeaveModal isOpen={!!editingLeave} onClose={() => setEditingLeave(null)} leave={editingLeave} />
      <AddPublicHolidayModal isOpen={showAddHoliday} onClose={() => setShowAddHoliday(false)} />
    </Screen>
  );
}
