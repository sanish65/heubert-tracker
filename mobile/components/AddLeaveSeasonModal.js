import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField } from "./ui";
import { SheetActions } from "./SheetParts";
import { useThemeColors, fonts } from "../lib/theme";

// A new leave season, in the record sheet's look (MobileRecordLeave.dc.html).
export default function AddLeaveSeasonModal({ isOpen, onClose }) {
  const { addLeaveSeason } = useApp();
  const t = useThemeColors();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      await addLeaveSeason(title.trim());
      setTitle("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="New Leave Season">
      <TextField label="Season Title" value={title} onChangeText={setTitle} placeholder="e.g. Fiscal Year 2026" />
      <Text style={[styles.note, { color: t.text3 }]}>
        {"Every employee's leave balances reset to their full annual quota under a new season."}
      </Text>
      <SheetActions title={submitting ? "Creating..." : "Create Season"} onPress={handleSubmit} disabled={submitting} onCancel={onClose} />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: -4, marginBottom: 16 },
});
