import { useState, useEffect } from "react";
import { Alert } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField } from "./ui";
import { SheetActions } from "./SheetParts";

// Rename or delete a leave season, in the record sheet's look (MobileRecordLeave.dc.html): Save on
// the right, Delete Season beside it.
export default function EditLeaveSeasonModal({ isOpen, onClose, season }) {
  const { updateLeaveSeason, deleteLeaveSeason } = useApp();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (season) setTitle(season.title || "");
  }, [season, isOpen]);

  if (!season) return null;

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await updateLeaveSeason(season.id, title.trim());
      if (!error) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete season?",
      `"${season.title}" — leave records already in this season are kept (they just become unassigned).`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setSubmitting(true);
            try {
              await deleteLeaveSeason(season.id);
              onClose();
            } finally {
              setSubmitting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Edit Leave Season">
      <TextField label="Season Title" value={title} onChangeText={setTitle} />
      <SheetActions
        title={submitting ? "Saving..." : "Save Changes"}
        onPress={handleSubmit}
        disabled={submitting}
        onCancel={onClose}
        secondary={{ title: "Delete Season", variant: "danger", onPress: handleDelete, disabled: submitting }}
      />
    </FormModal>
  );
}
