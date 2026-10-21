"use client";

import { useState, useEffect, useEffectEvent, useRef } from "react";
import { GROUPING_MIN_CARDS, arrangeColumn, buildThemes, nameFromTexts, placeCard } from "@/lib/retroThemes";
import { loadGroupingModel, embedTexts } from "@/lib/retroEmbeddings";
import { postRetro } from "@/lib/retroApi";
import { useDialog } from "@/context/DialogContext";
import Icon from "@/components/Icon";

const MODEL_ERROR = "Couldn't load the grouping model. You can still make themes by hand: tick cards, then New theme.";
const LATE_MODEL_ERROR = "Couldn't load the grouping model, so new cards stay outside themes. Move them with Move to…";
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

// Cards added after grouping that this browser should place, per column: saved cards in
// no theme, in a column that already shows a theme (the test arrangeColumn applies), and
// not tried before. A column with no themes stays a plain list (AC 14); a card already in
// a theme is never a candidate, so links made by hand are left alone (AC 13).
function findLateCards({ cards, themes, themeCards, tried }) {
  const byColumn = new Map();
  for (const card of cards) {
    if (isTemporary(card)) continue;
    if (!byColumn.has(card.column_type)) byColumn.set(card.column_type, []);
    byColumn.get(card.column_type).push(card);
  }
  const columns = [];
  for (const colCards of byColumn.values()) {
    const { themes: shown, loose } = arrangeColumn({ cards: colCards, themes, themeCards });
    const late = loose.filter((card) => !tried.has(vectorKey(card)));
    if (shown.length && late.length) columns.push({ themes: shown, late });
  }
  return columns;
}

// Cards tried by this page (placed or failed), kept so the 2.5 s poll does not post the
// same card again. Bounded like the vector cache.
const TRIED_MAX = 1000;
const remember = (tried, card) => {
  tried.add(vectorKey(card));
  for (const key of tried) {
    if (tried.size <= TRIED_MAX) break;
    tried.delete(key);
  }
};

// Places cards added after grouping into the closest theme of their column, or a new
// theme of their own (AC 12). Runs only in a facilitator/admin browser (enabled), so a
// card added while none is open waits outside themes until one opens the board (AC 12a).
// Two facilitator/admin browsers may both place the same card: the second
// move_card_to_theme/create_theme just re-links it, and the route prunes any theme left
// empty, so the card still ends up in exactly one theme.
export function useThemeAutoPlacement({
  enabled,
  session,
  cards,
  themes,
  themeCards,
  participantName,
  onChanged,
  onError,
}) {
  const running = useRef(false);
  const modelFailed = useRef(false);
  const tried = useRef(new Set());

  const placeLateCards = useEffectEvent(async () => {
    if (!enabled || !session || running.current || modelFailed.current) return;
    const columns = findLateCards({ cards, themes, themeCards, tried: tried.current });
    if (!columns.length) return;
    running.current = true;
    try {
      const all = columns.flatMap((col) => [...col.late, ...col.themes.flatMap((t) => t.cards)]);
      let vectors;
      try {
        vectors = await vectorsFor(all);
      } catch (_) {
        // Once per page: the cards stay where the server put them, outside any theme (AC 16).
        modelFailed.current = true;
        onError(LATE_MODEL_ERROR);
        return;
      }
      const vectorOf = new Map(all.map((card, i) => [vectorKey(card), vectors[i]]));
      const send = (body) => postRetro({ ...body, sessionId: session.id, actorName: participantName });
      let posted = false;
      for (const col of columns) {
        const targets = col.themes.map((t) => ({ id: t.id, vectors: t.cards.map((c) => vectorOf.get(vectorKey(c))) }));
        // One card after another: a card joining a theme counts towards it for the next
        // card, and after a new theme the column's other cards wait for the next run, when
        // the board holds that theme and they can join it.
        for (const card of col.late) {
          const vector = vectorOf.get(vectorKey(card));
          const themeId = placeCard({ vector, themes: targets });
          remember(tried.current, card);
          posted = true;
          try {
            if (themeId !== null) {
              await send({ action: "move_card_to_theme", cardId: String(card.id), themeId });
              targets.find((t) => t.id === themeId).vectors.push(vector);
            } else {
              await send({ action: "create_theme", name: nameFromTexts([card.content]), cardIds: [String(card.id)] });
              break;
            }
          } catch (err) {
            onError(err.message);
          }
        }
      }
      if (posted) onChanged();
    } finally {
      running.current = false;
    }
  });

  useEffect(() => {
    placeLateCards();
  }, [enabled, cards, themes, themeCards]);
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

  // The AI theme bar (Retro.dc.html): what grouping does, its progress, then the actions.
  return (
    <section className="glass retro-theme-bar" aria-label="Theme grouping">
      <span className="retro-theme-bar-icon"><Icon name="sparkles" size={18} /></span>
      <div className="retro-theme-bar-text">
        <span className="retro-theme-bar-title">AI theme grouping</span>
        <span className="retro-theme-bar-sub">
          Clusters cards with similar meaning inside each column. Runs in your browser — tick cards to make a theme by hand.
        </span>
      </div>
      {status && <span className="retro-theme-bar-status" role="status">{status}</span>}
      <div className="retro-theme-bar-actions">
        {selectedCards.length > 0 && (
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleNewTheme}
            disabled={busy || spansColumns}
            title={spansColumns ? "Selected cards must all be in one column" : undefined}
          >
            New theme from {selectedCards.length} selected
          </button>
        )}
        {themes.length > 0 && (
          <button type="button" className="btn btn-secondary" onClick={handleUngroup} disabled={busy}>
            Ungroup all
          </button>
        )}
        {themes.length === 0 && (
          <button type="button" className="btn btn-primary" onClick={handleGroup} disabled={busy}>
            <Icon name="sparkles" size={15} strokeWidth={2} />
            Group similar cards
          </button>
        )}
      </div>
    </section>
  );
}
