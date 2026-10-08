"use client";

import { useState } from "react";
import { postRetro } from "@/lib/retroApi";
import { KUDOS_MAX, canChangeKudos } from "@/lib/retroBoardRules";
import { useDialog } from "@/context/DialogContext";

export default function RetroKudos({
  session,
  kudos = [],
  kudosReactions = [],
  members = [],
  participantName,
  isFacilitator,
  reactionEmojis = [],
  onChanged,
}) {
  const { confirmDialog } = useDialog();
  const isEnded = !!session?.is_ended;
  // The same rule the server applies, so no control shows that the API would refuse.
  const can = (op, item) =>
    canChangeKudos({ op, isEnded, kudos: item, actorName: participantName, isFacilitator });

  const [text, setText] = useState("");
  const [tagIds, setTagIds] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editTagIds, setEditTagIds] = useState([]);
  const [pickerFor, setPickerFor] = useState(null);

  const ordered = [...kudos].sort((a, b) => String(a.created_at).localeCompare(String(b.created_at)));

  // Runs one write, then asks the page to refetch. A failure shows inline and leaves the list alone.
  const send = async (body) => {
    setSaving(true);
    setError("");
    try {
      await postRetro({ ...body, sessionId: session.id, actorName: participantName });
      onChanged?.();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    } finally {
      setSaving(false);
    }
  };

  const toggleId = (ids, id) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]);

  const handleAdd = async () => {
    const content = text.trim();
    if (!content || saving) return;
    const ok = await send({ action: "add_kudos", content, taggedEmployeeIds: tagIds });
    if (ok) {
      setText("");
      setTagIds([]);
    }
  };

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditText(item.content);
    setEditTagIds(Array.isArray(item.tagged_employee_ids) ? item.tagged_employee_ids : []);
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = async (item) => {
    const content = editText.trim();
    if (!content || saving) return;
    const ok = await send({ action: "edit_kudos", kudosId: item.id, content, taggedEmployeeIds: editTagIds });
    if (ok) setEditingId(null);
  };

  const handleDelete = async (item) => {
    if (!(await confirmDialog("Delete this kudos?", { danger: true, confirmText: "Delete" }))) return;
    await send({ action: "delete_kudos", kudosId: item.id });
  };

  const reactionsFor = (kudosId) => kudosReactions.filter((r) => String(r.kudos_id) === String(kudosId));
  const countsFor = (kudosId) => {
    const counts = {};
    reactionsFor(kudosId).forEach((r) => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
    return counts;
  };
  const hasReacted = (kudosId, emoji) =>
    reactionsFor(kudosId).some((r) => r.participant_name === participantName && r.emoji === emoji);

  const handleReact = (item, emoji) => {
    if (!can("react", item) || saving) return;
    return send({ action: hasReacted(item.id, emoji) ? "unreact_kudos" : "react_kudos", kudosId: item.id, emoji });
  };

  const tagChips = (ids, onToggle) =>
    members.length > 0 && (
      <div className="retro-kudos-tags">
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`retro-kudos-tag${ids.includes(m.id) ? " retro-kudos-tag-on" : ""}`}
            aria-pressed={ids.includes(m.id)}
            disabled={saving}
            onClick={() => onToggle(m.id)}
          >
            {m.name}
          </button>
        ))}
      </div>
    );

  const renderItem = (item) => {
    if (editingId === item.id) {
      return (
        <li key={item.id} className="retro-kudos-item retro-kudos-item-editing">
          <textarea
            className="retro-kudos-input"
            value={editText}
            maxLength={KUDOS_MAX}
            rows={3}
            autoFocus
            aria-label="Kudos text"
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveEdit(item);
              else if (e.key === "Escape") cancelEdit();
            }}
          />
          {tagChips(editTagIds, (id) => setEditTagIds((ids) => toggleId(ids, id)))}
          <div className="retro-kudos-actions">
            <button type="button" className="retro-todo-btn retro-todo-btn-primary" onClick={() => handleSaveEdit(item)} disabled={saving || !editText.trim()}>Save</button>
            <button type="button" className="retro-todo-btn" onClick={cancelEdit}>Cancel</button>
          </div>
        </li>
      );
    }

    const tagged = Array.isArray(item.tagged_names) ? item.tagged_names : [];
    const counts = countsFor(item.id);
    const canReact = can("react", item);

    return (
      <li key={item.id} className="retro-kudos-item">
        <p className="retro-kudos-content">{item.content}</p>
        {tagged.length > 0 && <div className="retro-kudos-tagged">🙌 {tagged.join(", ")}</div>}
        <div className="retro-kudos-footer">
          <span className="retro-kudos-author">— {item.author}</span>
          <span className="retro-kudos-actions">
            {can("edit", item) && (
              <button type="button" className="retro-todo-icon-btn" onClick={() => startEdit(item)} disabled={saving} aria-label="Edit kudos" title="Edit">✏️</button>
            )}
            {can("delete", item) && (
              <button type="button" className="retro-todo-icon-btn" onClick={() => handleDelete(item)} disabled={saving} aria-label="Delete kudos" title="Delete">✕</button>
            )}
          </span>
        </div>
        <div className="retro-reaction-picker-wrap">
          {Object.entries(counts).map(([emoji, count]) => (
            <button
              key={emoji}
              type="button"
              className={`retro-reaction-badge${hasReacted(item.id, emoji) ? " retro-reaction-badge-active" : ""}`}
              onClick={() => handleReact(item, emoji)}
              title={hasReacted(item.id, emoji) ? "Remove your reaction" : "React"}
            >
              {emoji}<span className="retro-reaction-count">{count}</span>
            </button>
          ))}
          {canReact && (
            <button
              type="button"
              className="retro-reaction-add-btn"
              onClick={() => setPickerFor(pickerFor === item.id ? null : item.id)}
              title="Add reaction"
            >
              +😀
            </button>
          )}
          {canReact && pickerFor === item.id && (
            <div className="retro-reaction-popover">
              {reactionEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`retro-reaction-option${hasReacted(item.id, emoji) ? " retro-reaction-option-active" : ""}`}
                  onClick={() => { handleReact(item, emoji); setPickerFor(null); }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </li>
    );
  };

  return (
    <section className="retro-kudos-panel">
      <h3 className="retro-todo-title">🏆 Kudos</h3>
      <p className="retro-kudos-sub">Shout out a teammate or celebrate a win.</p>

      {error && <div className="retro-kudos-error" role="alert">{error}</div>}

      {can("add") && (
        <div className="retro-kudos-compose">
          <textarea
            className="retro-kudos-input"
            value={text}
            maxLength={KUDOS_MAX}
            rows={2}
            placeholder="Who deserves a shoutout, and for what?"
            aria-label="New kudos"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAdd(); }}
          />
          {tagChips(tagIds, (id) => setTagIds((ids) => toggleId(ids, id)))}
          <div>
            <button type="button" className="retro-todo-btn retro-todo-btn-primary" onClick={handleAdd} disabled={saving || !text.trim()}>🎉 Send kudos</button>
          </div>
        </div>
      )}

      {ordered.length === 0 ? (
        <div className="retro-todo-empty">No kudos yet — be the first.</div>
      ) : (
        <ul className="retro-kudos-list">{ordered.map(renderItem)}</ul>
      )}
    </section>
  );
}
