import { useState, useEffect } from "react";
import { Text, View, Switch } from "react-native";
import { useApp } from "../context/AppContext";
import { buildWorkingDates, computeLeaveBalances } from "../lib/utils";
import { FormModal, TextField, Select, Button } from "./ui";
import DateField from "./DateField";
import { useThemeColors } from "../lib/theme";

const TYPE_OPTIONS = [
  { value: "full", label: "📅 Full Day" },
  { value: "half", label: "🌗 Half Day" },
  { value: "early", label: "🚪 Early Leave" },
];
const SEGMENT_OPTIONS = [
  { value: "first", label: "🌅 First Half" },
  { value: "second", label: "🌇 Second Half" },
];

export default function EditLeaveModal({ isOpen, onClose, leave }) {
  const { updateLeave, publicHolidays, leaves, leaveTypes, isAdmin } = useApp();
  const t = useThemeColors();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [type, setType] = useState("full");
  const [segment, setSegment] = useState("first");
  const [reason, setReason] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [overrideBalance, setOverrideBalance] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const holidaySet = new Set((publicHolidays || []).map((h) => h.date?.split("T")[0]));
  const activeLeaveTypes = (leaveTypes || []).filter((lt) => lt.is_active);
  const otherLeaves = leave ? leaves.filter((l) => l.id !== leave.id) : leaves;
  const balances = computeLeaveBalances(leave?.employee_name, otherLeaves, activeLeaveTypes, new Date().getFullYear(), holidaySet);
  const selectableBalances = isAdmin ? balances : balances.filter((b) => b.remaining > 0 || String(b.id) === String(leaveTypeId));

  useEffect(() => {
    if (leave && isOpen) {
      const isMulti = leave.start_date !== leave.end_date;
      let initReason = leave.reason || "";
      let initSegment = "first";
      if (leave.type === "half") {
        if (initReason.startsWith("[First Half]")) {
          initSegment = "first";
          initReason = initReason.replace("[First Half]", "").trim();
        } else if (initReason.startsWith("[Second Half]")) {
          initSegment = "second";
          initReason = initReason.replace("[Second Half]", "").trim();
        }
      }
      setStartDate(leave.start_date || "");
      setEndDate(leave.end_date || "");
      setType(leave.type || "full");
      setSegment(initSegment);
      setReason(initReason);
      setMultiDay(isMulti);
      setLeaveTypeId(leave.leave_type_id ? String(leave.leave_type_id) : "");
      setOverrideBalance(false);
      setError("");
    }
  }, [leave, isOpen]);

  if (!leave) return null;

  const effectiveEnd = multiDay ? endDate : startDate;
  const previewDates = startDate ? buildWorkingDates(startDate, effectiveEnd >= startDate ? effectiveEnd : startDate, holidaySet) : [];
  const workingDayCount = type === "half" ? previewDates.length * 0.5 : previewDates.length;

  const handleSubmit = async () => {
    if (!startDate) return setError("Please select a start date");
    if (multiDay && endDate && endDate < startDate) return setError("End date cannot be before start date");

    const finalEnd = multiDay && endDate ? endDate : startDate;
    const dates = buildWorkingDates(startDate, finalEnd, holidaySet);
    if (dates.length === 0) return setError("The selected range has no working days (all weekends or holidays).");

    const requestedDays = type === "half" ? dates.length * 0.5 : dates.length;
    const selectedBalance = balances.find((b) => String(b.id) === String(leaveTypeId));
    if (selectedBalance && requestedDays > selectedBalance.remaining && !(isAdmin && overrideBalance)) {
      return setError(
        `Insufficient ${selectedBalance.name} balance (${selectedBalance.remaining} remaining). Consider Unpaid Leave instead.`
      );
    }

    let finalReason = reason.trim();
    if (type === "half") {
      const segmentStr = segment === "first" ? "[First Half]" : "[Second Half]";
      finalReason = finalReason ? `${segmentStr} ${finalReason}` : segmentStr;
    }

    setSubmitting(true);
    try {
      const { error } = await updateLeave(leave.id, {
        start_date: startDate,
        end_date: finalEnd,
        type,
        reason: finalReason,
        leave_type_id: leaveTypeId ? Number(leaveTypeId) : null,
      });
      if (!error) onClose();
      else setError("Failed to update leave record.");
    } catch (err) {
      setError("Error updating leave.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="🏖️ Edit Leave Record">
      <TextField label="Employee" value={leave.employee_name} editable={false} />
      <Select label="Leave Type" value={type} onSelect={setType} options={TYPE_OPTIONS} />
      {type === "half" && <Select label="Half Day Segment" value={segment} onSelect={setSegment} options={SEGMENT_OPTIONS} />}
      {selectableBalances.length > 0 && (
        <>
          <Select
            label="Leave Category"
            value={leaveTypeId}
            onSelect={setLeaveTypeId}
            options={[
              { value: "", label: "Uncategorized" },
              ...selectableBalances.map((b) => ({
                value: String(b.id),
                label: `${b.name} (${b.remaining}/${b.annual_days})`,
              })),
            ]}
          />
          {isAdmin && (
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <Text style={{ color: t.textPrimary, fontSize: 14 }}>Override balance limit</Text>
              <Switch value={overrideBalance} onValueChange={setOverrideBalance} trackColor={{ true: t.accentIndigo }} />
            </View>
          )}
        </>
      )}
      <DateField label="Leave Date" value={startDate} onChange={setStartDate} />
      <Select
        label="Multiple Days?"
        value={multiDay ? "yes" : "no"}
        onSelect={(v) => {
          const isMulti = v === "yes";
          setMultiDay(isMulti);
          if (!isMulti) setEndDate(startDate);
        }}
        options={[
          { value: "no", label: "Single day" },
          { value: "yes", label: "Multiple days" },
        ]}
      />
      {multiDay && <DateField label="End Date" value={endDate} onChange={setEndDate} minimumDate={startDate} />}
      {previewDates.length > 0 && (
        <Text style={{ color: t.textSecondary, fontSize: 13, marginBottom: 14 }}>
          {workingDayCount} {workingDayCount === 1 ? "working day" : "working days"} · weekends & holidays skipped
        </Text>
      )}
      <TextField label="Reason" value={reason} onChangeText={setReason} />
      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
      <Button title={submitting ? "Saving..." : "Save Changes"} onPress={handleSubmit} disabled={submitting} />
    </FormModal>
  );
}
