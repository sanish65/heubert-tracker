import { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { useSubmitOnce } from "../lib/useSubmitOnce";
import { buildWorkingDates, toDateStr, computeLeaveBalances } from "../lib/utils";
import { LEAVE_TYPE_OPTIONS, SEGMENT_OPTIONS, DAY_OPTIONS } from "../lib/options";
import { formatBs } from "../lib/nepaliDate";
import { FormModal, TextField, Select } from "./ui";
import { EmployeePicker, ChoiceGroup, SheetSubtitle, SheetSwitch, SheetNote, SheetActions } from "./SheetParts";
import DateField from "./DateField";
import Icon from "./Icon";
import { useThemeColors, radius, fonts } from "../lib/theme";

// The record sheet of the canvas's MobileRecordLeave.dc.html, in its order: who, the leave category
// (the canvas's "Leave type") with the admin's balance override, the leave type (its "Duration")
// with the half-day segment, the dates, the reason. The edit sheet shares the parts below.

// Which half of the day, as the canvas's two buttons under the Duration: the chosen one primary-soft
// on a primary edge.
export function HalfDaySegment({ value, onChange }) {
  const t = useThemeColors();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Half Day Segment" style={styles.segments}>
      {SEGMENT_OPTIONS.map((opt) => {
        const selected = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            style={({ pressed }) => [
              styles.segment,
              selected ? { backgroundColor: t.primarySoft, borderColor: t.primary } : { borderColor: t.lineStrong, backgroundColor: pressed ? t.pbGray : "transparent" },
            ]}
          >
            <Icon name={opt.icon} size={18} strokeWidth={1.9} color={selected ? t.primaryText : t.text2} />
            <Text numberOfLines={1} style={[styles.segmentText, { color: selected ? t.text1 : t.text2, fontFamily: selected ? fonts.bodySemibold : fonts.bodyMedium }]}>
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// The days off: one date, or the first and the last side by side (the canvas's From and To), then
// their Bikram Sambat dates and the working days they count.
export function LeaveDates({ multiDay, onMultiDayChange, startDate, onStartChange, endDate, onEndChange, workingDayCount, showCount }) {
  const t = useThemeColors();
  const last = multiDay && endDate && endDate > startDate ? endDate : null;
  const bsStart = startDate ? formatBs(startDate) : "";
  const bsEnd = last ? formatBs(last) : "";
  const bs = bsStart ? `${bsStart}${bsEnd ? ` – ${bsEnd}` : ""} BS` : "";
  return (
    <>
      <ChoiceGroup label="Multiple Days?" value={multiDay ? "yes" : "no"} options={DAY_OPTIONS} onChange={onMultiDayChange} />
      {multiDay ? (
        <View style={styles.dateRow}>
          <View style={styles.dateCell}>
            <DateField label="Leave Date" value={startDate} onChange={onStartChange} />
          </View>
          <View style={styles.dateCell}>
            <DateField label="End Date" value={endDate} onChange={onEndChange} minimumDate={startDate} />
          </View>
        </View>
      ) : (
        <DateField label="Leave Date" value={startDate} onChange={onStartChange} />
      )}
      {bs || showCount ? (
        <View style={styles.dateNotes}>
          {bs ? <Text style={[styles.dateNote, { color: t.text3 }]}>{bs}</Text> : null}
          {showCount ? (
            <Text style={[styles.dateNote, { color: t.cyanText }]}>
              {workingDayCount} {workingDayCount === 1 ? "working day" : "working days"} · weekends & holidays skipped
            </Text>
          ) : null}
        </View>
      ) : null}
    </>
  );
}

// "Season · FY 2083/84" under the sheet's title, as the canvas.
export function SeasonLine({ title }) {
  return (
    <SheetSubtitle>
      <Text style={styles.seasonLine}>Season · {title}</Text>
    </SheetSubtitle>
  );
}

export default function AddLeaveModal({ isOpen, onClose }) {
  const [saving, submitOnce] = useSubmitOnce();
  const { addLeave, employees, currentEmployee, isAdmin, publicHolidays, leaves, leaveTypes, leaveSeasons } = useApp();
  const selectableEmployees = employees.filter(e => e.status !== "resigned" && e.name !== "Developers");
  const today = toDateStr(new Date());

  // A new leave always belongs to the season that is current NOW — never an earlier season
  // and never the pre-season bucket (null), whichever season the Leaves screen is browsing.
  // null only remains possible when no leave season exists at all.
  const currentSeason = leaveSeasons.length
    ? [...leaveSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0]
    : null;
  const currentSeasonId = currentSeason ? currentSeason.id : null;

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
  // Not enough balance: the canvas's amber warning rather than the red error.
  const [warning, setWarning] = useState("");

  const holidaySet = new Set((publicHolidays || []).map((h) => h.date?.split("T")[0]));
  const activeLeaveTypes = (leaveTypes || []).filter((lt) => lt.is_active);
  const balances = computeLeaveBalances(name, leaves, activeLeaveTypes, currentSeasonId, holidaySet);
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
      setWarning("");
    }
  }, [isOpen]);

  const effectiveEnd = multiDay && endDate ? endDate : startDate;
  const previewDates = startDate ? buildWorkingDates(startDate, effectiveEnd >= startDate ? effectiveEnd : startDate, holidaySet) : [];
  const workingDayCount = type === "half" ? previewDates.length * 0.5 : previewDates.length;

  const handleSubmit = () =>
    submitOnce(async () => {
      setError("");
      setWarning("");
      if (!name) return setError("Please select an employee");
      if (!startDate) return setError("Please select a start date");
      if (multiDay && endDate && endDate < startDate) return setError("End date cannot be before start date");

      const finalEnd = multiDay && endDate ? endDate : startDate;
      const dates = buildWorkingDates(startDate, finalEnd, holidaySet);
      if (dates.length === 0) return setError("The selected range has no working days (all weekends or holidays).");

      const requestedDays = type === "half" ? dates.length * 0.5 : dates.length;
      const selectedBalance = balances.find((b) => String(b.id) === String(leaveTypeId));
      if (selectedBalance && requestedDays > selectedBalance.remaining && !(isAdmin && overrideBalance)) {
        return setWarning(
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
        seasonId: currentSeasonId,
      });

      if (submitError) {
        setError(submitError.message || "Failed to save the leave. Please try again.");
        return;
      }

      onClose();
    });

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Record Leave">
      {currentSeason ? <SeasonLine title={currentSeason.title} /> : null}

      {!isAdmin && currentEmployee ? (
        <EmployeePicker value={currentEmployee.name} />
      ) : (
        <EmployeePicker value={name} names={selectableEmployees.map((e) => e.name)} onChange={setName} />
      )}

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
          {isAdmin && <SheetSwitch label="Override balance limit" value={overrideBalance} onValueChange={setOverrideBalance} last />}
        </>
      )}

      <ChoiceGroup label="Leave Type" solid value={type} options={LEAVE_TYPE_OPTIONS} onChange={setType} />
      {type === "half" && <HalfDaySegment value={segment} onChange={setSegment} />}

      <LeaveDates
        multiDay={multiDay}
        onMultiDayChange={(v) => {
          const isMulti = v === "yes";
          setMultiDay(isMulti);
          if (!isMulti) setEndDate("");
        }}
        startDate={startDate}
        onStartChange={setStartDate}
        endDate={endDate}
        onEndChange={setEndDate}
        workingDayCount={workingDayCount}
        showCount={previewDates.length > 0}
      />

      <TextField label="Reason" value={reason} onChangeText={setReason} placeholder="e.g. Doctor appointment" />

      {warning ? <SheetNote tone="warning">{warning}</SheetNote> : null}
      {error ? <SheetNote>{error}</SheetNote> : null}

      <SheetActions title={saving ? "Saving…" : "Record Leave"} onPress={handleSubmit} disabled={saving} onCancel={onClose} />
    </FormModal>
  );
}

// Sizes, gaps and type from MobileRecordLeave.dc.html: 6 between the Duration and its segments,
// 8 between side-by-side fields.
const styles = StyleSheet.create({
  seasonLine: { fontFamily: fonts.mono, fontSize: 12 },
  // Under the leave type's track (whose field keeps 16 below it), 6 apart from it.
  segments: { flexDirection: "row", gap: 8, marginTop: -10, marginBottom: 16 },
  segment: { flex: 1, height: 44, borderRadius: radius.md, borderWidth: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 8 },
  segmentText: { flexShrink: 1, fontSize: 14 },
  dateRow: { flexDirection: "row", gap: 8 },
  dateCell: { flex: 1 },
  // Under the date fields (which keep 14 below them), 6 apart.
  dateNotes: { gap: 4, marginTop: -8, marginBottom: 16, paddingLeft: 4 },
  dateNote: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 17 },
});
