import { useState, useEffect } from "react";
import { View, Text } from "react-native";
import { useApp } from "../context/AppContext";
import { buildWorkingDates, toDateStr } from "../lib/utils";
import { FormModal, TextField, Select, Button } from "./ui";
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

export default function AddLeaveModal({ isOpen, onClose }) {
  const { addLeave, employees, currentEmployee, isAdmin, publicHolidays } = useApp();
  const t = useThemeColors();
  const today = toDateStr(new Date());

  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [type, setType] = useState("full");
  const [segment, setSegment] = useState("first");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  const holidaySet = new Set((publicHolidays || []).map((h) => h.date?.split("T")[0]));

  useEffect(() => {
    if (isOpen && currentEmployee && !name) setName(currentEmployee.name);
  }, [isOpen, currentEmployee]);

  useEffect(() => {
    if (!isOpen) {
      setStartDate(today);
      setEndDate("");
      setMultiDay(false);
      setType("full");
      setSegment("first");
      setReason("");
      setError("");
    }
  }, [isOpen]);

  const effectiveEnd = multiDay && endDate ? endDate : startDate;
  const previewDates = startDate ? buildWorkingDates(startDate, effectiveEnd >= startDate ? effectiveEnd : startDate, holidaySet) : [];
  const workingDayCount = type === "half" ? previewDates.length * 0.5 : previewDates.length;

  const handleSubmit = () => {
    if (!name) return setError("Please select an employee");
    if (!startDate) return setError("Please select a start date");
    if (multiDay && endDate && endDate < startDate) return setError("End date cannot be before start date");

    const finalEnd = multiDay && endDate ? endDate : startDate;
    const dates = buildWorkingDates(startDate, finalEnd, holidaySet);
    if (dates.length === 0) return setError("The selected range has no working days (all weekends or holidays).");

    let finalReason = reason.trim();
    if (type === "half") {
      const segmentStr = segment === "first" ? "[First Half]" : "[Second Half]";
      finalReason = finalReason ? `${segmentStr} ${finalReason}` : segmentStr;
    }

    addLeave({ name, startDate, endDate: finalEnd, dates, type, reason: finalReason });
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

      <TextField label="Leave Date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} placeholder={today} />

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

      {multiDay && <TextField label="End Date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} placeholder={startDate} />}

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
