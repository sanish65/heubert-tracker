"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";

export default function AddWordModal({ isOpen, onClose }) {
  const { addWord, wordSeasons } = useApp();
  const { alertDialog } = useDialog();

  // A new word always belongs to the season that is current NOW — never an earlier season
  // and never a null season, whichever season the page happens to be browsing. Anything else
  // drops the record out of the season-scoped views while it still shows up in totals.
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

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!word || !definition) return;

    setSubmitting(true);
    try {
      await addWord({
        seasonId: currentSeasonId,
        word,
        phonetic,
        definition,
        example,
        translation
      });
      setWord("");
      setPhonetic("");
      setDefinition("");
      setExample("");
      setTranslation("");
      onClose();
    } catch (err) {
      await alertDialog("Failed to add word.", { tone: "error" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>📖 Add New Word</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group-interactive full-width">
              <label>Word</label>
              <input
                type="text"
                placeholder="e.g. Hyperbole"
                value={word}
                onChange={(e) => setWord(e.target.value)}
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
              {submitting ? "Saving..." : "Add Word"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
