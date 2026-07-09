import { useState, useEffect } from "react";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Button } from "./ui";

export default function EditWordModal({ isOpen, onClose, word }) {
  const { updateWord } = useApp();
  const [form, setForm] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (word) {
      setForm({
        word: word.word || "",
        phonetic: word.phonetic || "",
        definition: word.definition || "",
        example: word.example || "",
        translation: word.translation || "",
      });
    }
  }, [word, isOpen]);

  if (!word || !form) return null;

  const set = (field) => (value) => setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.word || !form.definition) return;
    setSubmitting(true);
    try {
      const { error } = await updateWord(word.id, form);
      if (!error) onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="📖 Edit Word">
      <TextField label="Word" value={form.word} onChangeText={set("word")} />
      <TextField label="Type / Phonetic" value={form.phonetic} onChangeText={set("phonetic")} />
      <TextField label="Translation (Optional)" value={form.translation} onChangeText={set("translation")} />
      <TextField label="Definition" value={form.definition} onChangeText={set("definition")} multiline />
      <TextField label="Example Sentence" value={form.example} onChangeText={set("example")} multiline />
      <Button title={submitting ? "Saving..." : "Save Changes"} onPress={handleSubmit} disabled={submitting} />
    </FormModal>
  );
}
