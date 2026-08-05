import { useState, useEffect } from "react";
import { View, Text, Switch } from "react-native";
import { useApp } from "../context/AppContext";
import { buildWorkingDates, toDateStr, computeLeaveBalances } from "../lib/utils";
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

export default function AddLeaveModal({ isOpen, onClose, seasonId }) {
  const { addLeave, employees, currentEmployee, isAdmin, publicHolidays, leaves, leaveTypes, leaveSeasons } = useApp();
  const t = useThemeColors();
  const today = toDateStr(new Date());

  const latestLeaveSeasonId = leaveSeasons.length
    ? [...leaveSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0].id
    : null;
  // Only fall back to the latest season when the caller didn't pass a seasonId at all
  // (e.g. the meeting screen's quick-add). An explicit null (e.g. viewing the
  // Pre Fiscal Year bucket) must be respected, not silently upgraded.
  const effectiveSeasonId = seasonId === undefined ? latestLeaveSeasonId : seasonId;

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [type, setType] = useState("full");
  const [segment, setSegment] = useState("first");
  const [reason, setReason] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [overrideBalance, setOverrideBalance] = useState(false);
  const [error, setError] = useState("");

  const holidaySet = new Set((publicHolidays || []).map((h) => h.date?.split("T")[0]));
  const activeLeaveTypes = (leaveTypes || []).filter((lt) => lt.is_active);
  const balances = computeLeaveBalances(name, leaves, activeLeaveTypes, effectiveSeasonId, holidaySet);
  const selectableBalances = isAdmin ? balances : balances.filter((b) => b.remaining > 0);

  useEffect(() => {
    if (isOpen && currentEmployee && !name) setName(currentEmployee.name);
  }, [isOpen, currentEmployee]);

  useEffect(() => {
    if (isOpen && !leaveTypeId && activeLeaveTypes.length > 0) {
      const defaultType = activeLeaveTypes.find((lt) => !lt.is_unpaid) || activeLeaveTypes[0];
      setLeaveTypeId(String(defaultType.id));
    }
  }, [isOpen, activeLeaveTypes, leaveTypeId]);

  useEffect(() => {
    if (!isOpen) {
      setStartDate(today);
      setEndDate("");
      setMultiDay(false);
      setType("full");
      setSegment("first");
      setReason("");
      setLeaveTypeId("");
      setOverrideBalance(false);
      setError("");
    }
  }, [isOpen]);

  const effectiveEnd = multiDay && endDate ? endDate : startDate;
  const previewDates = startDate ? buildWorkingDates(startDate, effectiveEnd >= startDate ? effectiveEnd : startDate, holidaySet) : [];
  const workingDayCount = type === "half" ? previewDates.length * 0.5 : previewDates.length;

  const handleSubmit = async () => {
    if (!name) return setError("Please select an employee");
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

    const { error: submitError } = await addLeave({
      name,
      startDate,
      endDate: finalEnd,
      dates,
      type,
      reason: finalReason,
      leaveTypeId: leaveTypeId ? Number(leaveTypeId) : null,
      seasonId: effectiveSeasonId,
    });

    if (submitError) {
      setError(submitError.message || "Failed to save the leave. Please try again.");
      return;
    }

    onClose();
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="🏖️ Record Leave">
      {!isAdmin && currentEmployee ? (
        <TextField label="Employee" value={currentEmployee.name} editable={false} />
      ) : (
        <Select label="Employee" value={name} onSelect={setName} options={employees.map((e) => ({ value: e.name, label: e.name }))} />
      )}

      <Select label="Leave Type" value={type} onSelect={setType} options={TYPE_OPTIONS} />
      {type === "half" && <Select label="Half Day Segment" value={segment} onSelect={setSegment} options={SEGMENT_OPTIONS} />}

      {selectableBalances.length > 0 && (
        <>
          <Select
            label="Leave Category"
            value={leaveTypeId}
            onSelect={setLeaveTypeId}
            options={selectableBalances.map((b) => ({
              value: String(b.id),
              label: `${b.name} (${b.remaining}/${b.annual_days})`,
            }))}
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

      <View style={{ flexDirection: "row", marginBottom: 14 }}>
        <Select
          label="Multiple Days?"
          value={multiDay ? "yes" : "no"}
          onSelect={(v) => {
            const isMulti = v === "yes";
            setMultiDay(isMulti);
            if (!isMulti) setEndDate("");
          }}
          options={[
            { value: "no", label: "Single day" },
            { value: "yes", label: "Multiple days" },
          ]}
        />
      </View>

      {multiDay && <DateField label="End Date" value={endDate} onChange={setEndDate} minimumDate={startDate} />}

      {previewDates.length > 0 && (
        <Text style={{ color: t.textSecondary, fontSize: 13, marginBottom: 14 }}>
          {workingDayCount} {workingDayCount === 1 ? "working day" : "working days"} · weekends & holidays skipped
        </Text>
      )}

      <TextField label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. Doctor appointment" />

      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}

      <Button title="Record Leave" onPress={handleSubmit} variant="accent" />
    </FormModal>
  );
}
