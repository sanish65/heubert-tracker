"use client";

import { useState } from "react";
import { GROUPING_MIN_CARDS, buildThemes, nameFromTexts } from "@/lib/retroThemes";
import { loadGroupingModel, embedTexts } from "@/lib/retroEmbeddings";
import { postRetro } from "@/lib/retroApi";
import { useDialog } from "@/context/DialogContext";

const MODEL_ERROR = "Couldn't load the grouping model. You can still make themes by hand: tick cards, then New theme.";
const isTemporary = (card) => String(card.id).startsWith("temp_");

// Card vectors already worked out on this page, shared with the late-card placement.
// Keyed by id and text, so an edited card is embedded again. Bounded: the oldest
// entries go first once it holds VECTOR_CACHE_MAX vectors.
const VECTOR_CACHE_MAX = 1000;
const vectorCache = new Map();
const vectorKey = (card) => `${card.id}\u0000${card.content}`;

// cards → one vector per card, same order. Only cards not seen before are embedded, in
// a single embedTexts call. Throws when the model cannot load or run.
export async function vectorsFor(cards) {
  const found = new Map();
  const missing = new Map();
  for (const card of cards) {
    const key = vectorKey(card);
    const cached = vectorCache.get(key);
    if (cached) found.set(key, cached);
    else missing.set(key, String(card.content ?? ""));
  }
  if (missing.size) {
    const vectors = await embedTexts([...missing.values()]);
    [...missing.keys()].forEach((key, i) => {
      found.set(key, vectors[i]);
      vectorCache.set(key, vectors[i]);
    });
    for (const key of vectorCache.keys()) {
      if (vectorCache.size <= VECTOR_CACHE_MAX) break;
      vectorCache.delete(key);
    }
  }
  return cards.map((card) => found.get(vectorKey(card)));
}

// Facilitator/admin toolbar for themes on the web tab. The page mounts it only for
// those people and only while the board is open; the server checks both again.
export default function RetroThemeTools({
  session,
  columns,
  cards,
  themes,
  participantName,
  selectedCardIds,
  onClearSelection,
  onChanged,
  onError,
}) {
  const { confirmDialog, promptDialog } = useDialog();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const send = async (body) => {
    await postRetro({ ...body, sessionId: session.id, actorName: participantName });
    onChanged();
  };

  const handleGroup = async () => {
    if (busy) return;
    // A column below the minimum stays a plain list, so only the rest are embedded, and
    // with none to group the model is not downloaded at all.
    const perColumn = columns
      .map((col) => cards.filter((c) => c.column_type === col.key && !isTemporary(c)))
      .filter((colCards) => colCards.length >= GROUPING_MIN_CARDS);
    const tooFew = `Each column needs at least ${GROUPING_MIN_CARDS} cards to group.`;
    if (!perColumn.length) {
      onError(tooFew);
      return;
    }
    setBusy(true);
    setStatus("Loading the grouping model… (first time only, about 25 MB)");
    let found;
    try {
      await loadGroupingModel();
      setStatus("Grouping…");
      const vectors = await vectorsFor(perColumn.flat());
      let offset = 0;
      found = perColumn.flatMap((colCards) => {
        const colVectors = vectors.slice(offset, offset + colCards.length);
        offset += colCards.length;
        return buildThemes({ cards: colCards, vectors: colVectors });
      });
    } catch (_) {
      setBusy(false);
      setStatus("");
      onError(MODEL_ERROR);
      return;
    }
    setStatus("");
    try {
      if (!found.length) {
        onError(tooFew);
        return;
      }
      await send({ action: "group_cards", themes: found });
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleUngroup = async () => {
    if (busy) return;
    if (!(await confirmDialog("Ungroup every column? Themes will be discarded for everyone."))) return;
    setBusy(true);
    try {
      await send({ action: "ungroup_cards" });
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const selectedIds = new Set(selectedCardIds.map(String));
  const selectedCards = cards.filter((c) => selectedIds.has(String(c.id)));
  const spansColumns = new Set(selectedCards.map((c) => c.column_type)).size > 1;

  const handleNewTheme = async () => {
    if (busy || spansColumns || !selectedCards.length) return;
    const name = await promptDialog("Name the new theme", {
      defaultValue: nameFromTexts(selectedCards.map((c) => c.content)),
    });
    if (!name?.trim()) return;
    setBusy(true);
    try {
      await send({ action: "create_theme", name: name.trim(), cardIds: selectedCards.map((c) => String(c.id)) });
      onClearSelection();
    } catch (err) {
      onError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="retro-theme-tools">
      {themes.length === 0 && (
        <button type="button" className="retro-theme-tools-btn" onClick={handleGroup} disabled={busy}>
          ✨ Group similar cards
        </button>
      )}
      {themes.length > 0 && (
        <button type="button" className="retro-theme-tools-btn" onClick={handleUngroup} disabled={busy}>
          Ungroup all
        </button>
      )}
      {selectedCards.length > 0 && (
        <button
          type="button"
          className="retro-theme-tools-btn"
          onClick={handleNewTheme}
          disabled={busy || spansColumns}
          title={spansColumns ? "Selected cards must all be in one column" : undefined}
        >
          New theme from {selectedCards.length} selected
        </button>
      )}
      {status && <span className="retro-theme-tools-status" role="status">{status}</span>}
    </div>
  );
}
