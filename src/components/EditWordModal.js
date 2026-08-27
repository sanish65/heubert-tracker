"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";

export default function EditWordModal({ isOpen, onClose, word }) {
  const { updateWord } = useApp();
  const { alertDialog } = useDialog();
  const [wordText, setWordText] = useState("");
  const [phonetic, setPhonetic] = useState("");
  const [definition, setDefinition] = useState("");
  const [example, setExample] = useState("");
  const [translation, setTranslation] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Sync state with word prop when it changes or modal opens
  useEffect(() => {
    if (word) {
      setWordText(word.word || "");
      setPhonetic(word.phonetic || "");
      setDefinition(word.definition || "");
      setExample(word.example || "");
      setTranslation(word.translation || "");
    }
  }, [word, isOpen]);

  if (!isOpen || !word) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!wordText || !definition) return;

    setSubmitting(true);
    try {
      const { error } = await updateWord(word.id, {
        word: wordText,
        phonetic,
        definition,
        example,
        translation
      });
      
      if (!error) {
        onClose();
      } else {
        await alertDialog("Failed to update word.", { tone: "error" });
      }
    } catch (err) {
      console.error("Update error:", err);
      await alertDialog("Error updating word.", { tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📝 Edit Word</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group-interactive full-width">
              <label>Word</label>
              <input
                type="text"
                placeholder="e.g. Hyperbole"
                value={wordText}
                onChange={(e) => setWordText(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="form-group-interactive">
              <label>Type / Phonetic</label>
              <input
                type="text"
                placeholder="e.g. noun, verb, idiom"
                value={phonetic}
                onChange={(e) => setPhonetic(e.target.value)}
              />
            </div>
            <div className="form-group-interactive">
              <label>Translation (Optional)</label>
              <input
                type="text"
                placeholder="Nepali or other language"
                value={translation}
                onChange={(e) => setTranslation(e.target.value)}
              />
            </div>
            <div className="form-group-interactive full-width">
              <label>Definition</label>
              <textarea
                placeholder="What does it mean?"
                value={definition}
                onChange={(e) => setDefinition(e.target.value)}
                required
                rows={3}
              />
            </div>
            <div className="form-group-interactive full-width">
              <label>Example Sentence</label>
              <textarea
                placeholder="Use it in a sentence..."
                value={example}
                onChange={(e) => setExample(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? "Saving Changes..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
