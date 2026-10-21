"use client";

import { useState } from "react";
import { postRetro } from "@/lib/retroApi";
import { KUDOS_MAX, canChangeKudos } from "@/lib/retroBoardRules";
import { useDialog } from "@/context/DialogContext";
import Icon from "@/components/Icon";

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
      <div className="retro-tags" role="group" aria-label="Tag teammates">
        {members.map((m) => {
          const on = ids.includes(m.id);
          return (
            <button
              key={m.id}
              type="button"
              className={`retro-tag${on ? " is-on" : ""}`}
              aria-pressed={on}
              disabled={saving}
              onClick={() => onToggle(m.id)}
            >
              {on && <Icon name="check" size={12} strokeWidth={2.4} />}
              {m.name}
            </button>
          );
        })}
      </div>
    );

  const renderItem = (item) => {
    if (editingId === item.id) {
      return (
        <article key={item.id} className="retro-kudo is-editing">
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
          <div className="retro-kudo-edit-actions">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(item)} disabled={saving || !editText.trim()}>Save</button>
            <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
          </div>
        </article>
      );
    }

    const tagged = Array.isArray(item.tagged_names) ? item.tagged_names : [];
    const counts = countsFor(item.id);
    const canReact = can("react", item);
    const canEdit = can("edit", item);
    const canDelete = can("delete", item);

    return (
      <article key={item.id} className="retro-kudo">
        {tagged.length > 0 && <span className="retro-kudo-for">For {tagged.join(", ")}</span>}
        <p className="retro-kudo-text">{item.content}</p>
        <div className="retro-kudo-foot">
          <span className="retro-kudo-from">From {item.author}</span>
          {(canEdit || canDelete) && (
            <span className="retro-kudo-tools">
              {canEdit && (
                <button type="button" className="retro-icon-btn" onClick={() => startEdit(item)} disabled={saving} aria-label="Edit kudos" title="Edit">
                  <Icon name="edit" size={14} strokeWidth={2} />
                </button>
              )}
              {canDelete && (
                <button type="button" className="retro-icon-btn retro-icon-btn-danger" onClick={() => handleDelete(item)} disabled={saving} aria-label="Delete kudos" title="Delete">
                  <Icon name="trash" size={14} strokeWidth={2} />
                </button>
              )}
            </span>
          )}
        </div>
        <div className="retro-reactions retro-reaction-picker-wrap">
          {Object.entries(counts).map(([emoji, count]) => (
            <button
              key={emoji}
              type="button"
              className={`retro-reaction${hasReacted(item.id, emoji) ? " is-mine" : ""}`}
              aria-pressed={hasReacted(item.id, emoji)}
              onClick={() => handleReact(item, emoji)}
              title={hasReacted(item.id, emoji) ? "Remove your reaction" : "React"}
            >
              <span className="retro-reaction-emoji">{emoji}</span>
              <span className="mono">{count}</span>
            </button>
          ))}
          {canReact && (
            <button
              type="button"
              className="btn-icon btn-sm retro-react-add"
              onClick={() => setPickerFor(pickerFor === item.id ? null : item.id)}
              title="Add reaction"
              aria-label="Add reaction"
              aria-expanded={pickerFor === item.id}
            >
              <Icon name="smile" size={16} />
            </button>
          )}
          {canReact && pickerFor === item.id && (
            <div className="retro-reaction-popover" role="group" aria-label="Reactions">
              {reactionEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`retro-reaction-option${hasReacted(item.id, emoji) ? " is-mine" : ""}`}
                  aria-pressed={hasReacted(item.id, emoji)}
                  onClick={() => { handleReact(item, emoji); setPickerFor(null); }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      </article>
    );
  };

  const canAdd = can("add");

  // Kudos strip (Retro.dc.html): orange-edged glass, one tile per kudos, the composer last.
  return (
    <section className="glass retro-kudos" aria-labelledby="retro-kudos-title">
      <div className="retro-kudos-head">
        <span className="retro-kudos-icon"><Icon name="award" size={18} strokeWidth={2} /></span>
        <div className="retro-kudos-head-text">
          <h2 id="retro-kudos-title" className="retro-section-title">Kudos</h2>
          <p className="retro-kudos-sub">Shout out a teammate or celebrate a win.</p>
        </div>
      </div>

      {error && (
        <div className="form-error retro-error" role="alert">
          <Icon name="alert" size={16} />
          <span className="retro-error-text">{error}</span>
        </div>
      )}

      {ordered.length === 0 && <p className="empty-msg">No kudos yet — be the first.</p>}

      {(ordered.length > 0 || canAdd) && (
        <div className="retro-kudos-grid">
          {ordered.map(renderItem)}
          {canAdd && (
            <div className="retro-kudos-compose">
              <label className="retro-kudos-compose-label">
                <span>New kudos</span>
                <textarea
                  className="retro-kudos-input"
                  value={text}
                  maxLength={KUDOS_MAX}
                  rows={3}
                  placeholder="Who deserves a shoutout, and for what?"
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleAdd(); }}
                />
              </label>
              {tagChips(tagIds, (id) => setTagIds((ids) => toggleId(ids, id)))}
              <button type="button" className="btn btn-orange btn-sm retro-kudos-send" onClick={handleAdd} disabled={saving || !text.trim()}>Send kudos</button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
