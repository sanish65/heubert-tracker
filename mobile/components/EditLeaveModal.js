import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { buildWorkingDates, computeLeaveBalances } from "../lib/utils";
import { FormModal, TextField, Select } from "./ui";
import { EmployeePicker, ChoiceGroup, SheetSwitch, SheetNote, SheetActions } from "./SheetParts";
import { HalfDaySegment, LeaveDates, SeasonLine } from "./AddLeaveModal";
import { LEAVE_TYPE_OPTIONS } from "../lib/options";

// A leave's edit sheet, in the record sheet's look (MobileRecordLeave.dc.html): the person and the
// season are fixed; the category, the kind of day, the dates and the reason change.
export default function EditLeaveModal({ isOpen, onClose, leave }) {
  const { updateLeave, publicHolidays, leaves, leaveTypes, leaveSeasons, isAdmin } = useApp();
  const [startDate, setStartDate] = useState("");
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
  const [submitting, setSubmitting] = useState(false);

  const holidaySet = new Set((publicHolidays || []).map((h) => h.date?.split("T")[0]));
  const activeLeaveTypes = (leaveTypes || []).filter((lt) => lt.is_active);
  const otherLeaves = leave ? leaves.filter((l) => l.id !== leave.id) : leaves;
  const balances = computeLeaveBalances(leave?.employee_name, otherLeaves, activeLeaveTypes, leave?.season_id ?? null, holidaySet);
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
      setWarning("");
    }
  }, [leave, isOpen]);

  if (!leave) return null;

  // The season the leave counts in; leaves from before seasons are the Pre Fiscal Year ones.
  const seasonTitle = leave.season_id ? leaveSeasons.find((s) => s.id === leave.season_id)?.title : "Pre Fiscal Year Leaves";
  const effectiveEnd = multiDay ? endDate : startDate;
  const previewDates = startDate ? buildWorkingDates(startDate, effectiveEnd >= startDate ? effectiveEnd : startDate, holidaySet) : [];
  const workingDayCount = type === "half" ? previewDates.length * 0.5 : previewDates.length;

  const handleSubmit = async () => {
    setError("");
    setWarning("");
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
    <FormModal visible={isOpen} onClose={onClose} title="Edit Leave Record">
      {seasonTitle ? <SeasonLine title={seasonTitle} /> : null}
      <EmployeePicker value={leave.employee_name} />
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
          if (!isMulti) setEndDate(startDate);
        }}
        startDate={startDate}
        onStartChange={setStartDate}
        endDate={endDate}
        onEndChange={setEndDate}
        workingDayCount={workingDayCount}
        showCount={previewDates.length > 0}
      />
      <TextField label="Reason" value={reason} onChangeText={setReason} />
      {warning ? <SheetNote tone="warning">{warning}</SheetNote> : null}
      {error ? <SheetNote>{error}</SheetNote> : null}
      <SheetActions title={submitting ? "Saving..." : "Save Changes"} onPress={handleSubmit} disabled={submitting} onCancel={onClose} />
    </FormModal>
  );
}
