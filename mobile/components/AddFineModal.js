import { useState, useEffect } from "react";
import { Text, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { useSubmitOnce } from "../lib/useSubmitOnce";
import { findExistingLateFine, fineToday, parseLocalDate } from "../lib/utils";
import { FINE_AMOUNTS, LATE_FINE_STATUSES } from "../lib/options";
import { FormModal } from "./ui";
import DateField from "./DateField";
import { EmployeePicker, ChoiceGroup, SheetSubtitle, SheetNote, SheetActions } from "./SheetParts";
import { useThemeColors, fonts } from "../lib/theme";

// The record sheet of the canvas's MobileRecordFine.dc.html, built from the sheet parts every sheet
// shares (SheetParts.js). The amounts and statuses are lib/options.js's, shared by every fine sheet.

export default function AddFineModal({ isOpen, onClose }) {
  const [saving, submitOnce] = useSubmitOnce();
  const { addFine, employees, currentEmployee, fines, fineSeasons } = useApp();
  const selectableEmployees = employees.filter(e => e.status !== "resigned" && e.name !== "Developers");
  const t = useThemeColors();
  const today = fineToday();

  const [name, setName] = useState("");
  const [date, setDate] = useState(today);
  const [amount, setAmount] = useState(25);
  const [status, setStatus] = useState("unpaid");
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen && currentEmployee && !name) setName(currentEmployee.name);
  }, [isOpen, currentEmployee]);

  useEffect(() => {
    if (!isOpen) {
      setDate(today);
      setAmount(25);
      setStatus("unpaid");
      setError("");
    }
  }, [isOpen]);

  // A new fine always belongs to the season that is current NOW — never an earlier season
  // and never a null season, whichever season the screen happens to be browsing.
  // null only remains possible when no season exists at all.
  const currentSeason = fineSeasons.length
    ? [...fineSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0]
    : null;
  const currentSeasonId = currentSeason ? currentSeason.id : null;

  // A late fine is one per person per day, whatever the amount.
  const existingFine = findExistingLateFine(fines, name, date);
  // Someone can only have been late on a day that has already happened.
  const isFutureDate = date > today;

  const handleSubmit = () =>
    submitOnce(async () => {
      if (!name) return setError("Please select an employee");
      if (!amount) return setError("Please fill all required fields");
      if (isFutureDate) return setError("A late fine can only be recorded for today or an earlier day.");

      const { error: submitError } = await addFine({ name, date, amount: Number(amount), status, seasonId: currentSeasonId });
      if (submitError) return setError(submitError.message || "Failed to save the fine. Please try again.");

      onClose();
    });

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Record a Fine">
      {currentSeason ? (
        <SheetSubtitle>
          {"Goes into "}
          <Text style={[styles.season, { color: t.cyanText }]}>{currentSeason.title}</Text>
          {", the current season."}
        </SheetSubtitle>
      ) : null}
      <EmployeePicker value={name} names={selectableEmployees.map((e) => e.name)} onChange={(v) => { setName(v); setError(""); }} />
      <DateField label="Date" value={date} maximumDate={parseLocalDate(today)} onChange={(v) => { setDate(v); setError(""); }} />
      <ChoiceGroup label="Amount (Rs.)" mono value={amount} options={FINE_AMOUNTS} onChange={(v) => { setAmount(v); setError(""); }} />
      <ChoiceGroup label="Status" value={status} options={LATE_FINE_STATUSES} onChange={setStatus} />

      {error ? <SheetNote>{error}</SheetNote> : null}
      {isFutureDate ? (
        <SheetNote>{`${date} hasn't happened yet. A late fine can only be dated today (${today}) or earlier.`}</SheetNote>
      ) : null}
      {existingFine ? (
        <SheetNote>
          {`${name} already has a Rs ${existingFine.amount} late fine on ${date}. A late fine is one per person per day — edit or delete the existing one instead.`}
        </SheetNote>
      ) : null}

      <SheetActions title={saving ? "Saving…" : "Add Fine"} onPress={handleSubmit} disabled={saving || !!existingFine || isFutureDate} onCancel={onClose} />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  season: { fontFamily: fonts.mono },
});
