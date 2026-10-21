import { useState, useEffect } from "react";
import { Alert } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField } from "./ui";
import { SheetNote, SheetActions } from "./SheetParts";

// Rename or delete a Word of the Day season, in the record sheet's look (MobileRecordFine.dc.html):
// Save on the right, Delete Season beside it (it was a link under the season chips before). A save
// or delete that fails keeps the sheet open and says why.
export default function EditWordSeasonModal({ isOpen, onClose, season }) {
  const { updateWordSeason, deleteWordSeason } = useApp();
  const [title, setTitle] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (season) setTitle(season.title || "");
    setError("");
  }, [season, isOpen]);

  if (!season) return null;

  const handleSubmit = async () => {
    if (!title.trim()) return setError("Please enter a season title");
    setSubmitting(true);
    setError("");
    try {
      const { error: failed } = await updateWordSeason(season.id, title.trim());
      if (failed) setError(failed.message || "The season was not saved. Try again.");
      else onClose();
    } catch (e) {
      setError(e?.message || "The season was not saved. Try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert("Delete season?", `"${season.title}" and all its words will be removed.`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          setSubmitting(true);
          setError("");
          try {
            const { error: failed } = await deleteWordSeason(season.id);
            if (failed) setError(failed.message || "The season was not deleted. Try again.");
            else onClose();
          } catch (e) {
            setError(e?.message || "The season was not deleted. Try again.");
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Edit Season">
      <TextField label="Season Title" value={title} onChangeText={setTitle} />
      {error ? <SheetNote>{error}</SheetNote> : null}
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
