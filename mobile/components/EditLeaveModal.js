import { useState, useEffect } from "react";
import { Text } from "react-native";
import { useApp } from "../context/AppContext";
import { buildWorkingDates } from "../lib/utils";
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

export default function EditLeaveModal({ isOpen, onClose, leave }) {
  const { updateLeave, publicHolidays } = useApp();
  const t = useThemeColors();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [type, setType] = useState("full");
  const [segment, setSegment] = useState("first");
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const holidaySet = new Set((publicHolidays || []).map((h) => h.date?.split("T")[0]));

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

    let finalReason = reason.trim();
    if (type === "half") {
      const segmentStr = segment === "first" ? "[First Half]" : "[Second Half]";
      finalReason = finalReason ? `${segmentStr} ${finalReason}` : segmentStr;
    }

    setSubmitting(true);
    try {
      const { error } = await updateLeave(leave.id, { start_date: startDate, end_date: finalEnd, type, reason: finalReason, dates });
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
      <TextField label="Leave Date (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
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
      {multiDay && <TextField label="End Date (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} />}
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
