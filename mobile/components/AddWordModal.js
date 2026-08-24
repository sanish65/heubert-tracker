import { useState } from "react";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Button } from "./ui";

export default function AddWordModal({ isOpen, onClose }) {
  const { addWord, wordSeasons } = useApp();

  // A new word always belongs to the season that is current NOW — never an earlier season
  // and never a null season, whichever season the screen happens to be browsing.
  // null only remains possible when no season exists at all.
  const currentSeasonId = (wordSeasons || []).length
    ? [...wordSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0].id
    : null;
  const [word, setWord] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [translation, setTranslation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!word || !definition) return;
    setSubmitting(true);
    try {
      await addWord({ seasonId: currentSeasonId, word, phonetic, definition, example, translation });
      setWord("");
      setPhonetic("");
      setDefinition("");
      setExample("");
      setTranslation("");
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="📖 Add New Word">
      <TextField label="Word" value={word} onChangeText={setWord} placeholder="e.g. Hyperbole" />
      <TextField label="Type / Phonetic" value={phonetic} onChangeText={setPhonetic} placeholder="e.g. noun, verb, idiom" />
      <TextField label="Translation (Optional)" value={translation} onChangeText={setTranslation} placeholder="Nepali or other language" />
      <TextField label="Definition" value={definition} onChangeText={setDefinition} placeholder="What does it mean?" multiline />
      <TextField label="Example Sentence" value={example} onChangeText={setExample} placeholder="Use it in a sentence..." multiline />
      <Button title={submitting ? "Saving..." : "Add Word"} onPress={handleSubmit} disabled={submitting} />
    </FormModal>
  );
}
