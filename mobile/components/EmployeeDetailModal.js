import { useMemo } from "react";
import { View, Text } from "react-native";
import { useApp } from "../context/AppContext";
import { useThemeColors } from "../lib/theme";
import { FormModal } from "./ui";
import { computeLeaveBalances } from "../lib/utils";

const JAR_COLORS = ["accentIndigo", "accentRed", "accentViolet", "accentGreen", "accentAmber", "accentSky"];

function LeaveJar({ label, remaining, total, color, isUnpaid }) {
  const t = useThemeColors();
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  return (
    <View style={{ alignItems: "center", width: 78, marginRight: 12, marginBottom: 12 }}>
      <View style={{ width: 40, height: 70, borderRadius: 8, backgroundColor: t.border, overflow: "hidden", justifyContent: "flex-end" }}>
        <View style={{ height: `${pct}%`, backgroundColor: t[color] }} />
      </View>
      <Text style={{ color: t.textPrimary, fontSize: 12, fontWeight: "600", marginTop: 6, textAlign: "center" }}>
        {label}{isUnpaid ? " (Unpaid)" : ""}
      </Text>
      <Text style={{ color: t.textMuted, fontSize: 11, textAlign: "center" }}>{remaining} / {total} left</Text>
    </View>
  );
}

export default function EmployeeDetailModal({ isOpen, onClose, employee }) {
  const { leaves, leaveTypes, leaveSeasons, publicHolidays } = useApp();
  const t = useThemeColors();

  const holidaySet = useMemo(() => new Set((publicHolidays || []).map((h) => h.date?.split("T")[0])), [publicHolidays]);

  const latestLeaveSeason = useMemo(() => {
    if (!leaveSeasons || leaveSeasons.length === 0) return null;
    return [...leaveSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  }, [leaveSeasons]);

  const balances = useMemo(() => {
    if (!employee) return [];
    return computeLeaveBalances(employee.name, leaves, leaveTypes, latestLeaveSeason?.id ?? null, holidaySet);
  }, [employee, leaves, leaveTypes, latestLeaveSeason, holidaySet]);

  if (!employee) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const DetailRow = ({ label, value }) => (
    <View style={{ marginBottom: 10, flexBasis: "48%" }}>
      <Text style={{ color: t.textMuted, fontSize: 11, textTransform: "uppercase", letterSpacing: 0.3 }}>{label}</Text>
      <Text style={{ color: t.textPrimary, fontSize: 14, fontWeight: "600", marginTop: 2 }}>{value}</Text>
    </View>
  );

  return (
    <FormModal visible={isOpen} onClose={onClose} title={employee.name}>
      <Text style={{ color: t.textSecondary, fontSize: 13, fontWeight: "700", marginBottom: 8 }}>👤 Profile</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <DetailRow label="Employee ID" value={employee.emp_no || `EMP-${employee.id}`} />
        <DetailRow label="Date of Birth" value={formatDate(employee.dob)} />
        <DetailRow label="Joined Date" value={formatDate(employee.joined_date)} />
        <DetailRow label="Left Date" value={formatDate(employee.left_date)} />
      </View>

      <Text style={{ color: t.textSecondary, fontSize: 13, fontWeight: "700", marginTop: 8, marginBottom: 8 }}>📞 Contact</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
        <DetailRow label="Phone" value={employee.phone || "N/A"} />
        <DetailRow label="Work Email" value={employee.work_email || "N/A"} />
        <DetailRow label="Personal Email" value={employee.personal_email || "N/A"} />
        <DetailRow label="Address" value={employee.address || "N/A"} />
      </View>

      <Text style={{ color: t.textSecondary, fontSize: 13, fontWeight: "700", marginTop: 8, marginBottom: 8 }}>
        🫙 Leave Balances{latestLeaveSeason ? ` (${latestLeaveSeason.title})` : ""}
      </Text>
      {balances.length === 0 ? (
        <Text style={{ color: t.textMuted, fontSize: 13 }}>No active leave types configured yet.</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {balances.map((b, idx) => (
            <LeaveJar key={b.id} label={b.name} remaining={b.remaining} total={b.annual_days} isUnpaid={b.is_unpaid} color={JAR_COLORS[idx % JAR_COLORS.length]} />
          ))}
        </View>
      )}
    </FormModal>
  );
}
