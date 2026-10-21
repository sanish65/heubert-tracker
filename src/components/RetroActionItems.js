"use client";

import { useState } from "react";
import { postRetro } from "@/lib/retroApi";
import { ACTION_ITEM_MAX } from "@/lib/retroBoardRules";
import { useDialog } from "@/context/DialogContext";
import Icon from "@/components/Icon";

const formatDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "";

// The server rejects a non-integer owner id, so the select's string becomes a number or null.
const toOwnerId = (value) => (value === "" ? null : Number(value));

export default function RetroActionItems({ session, actionItems, members = [], participantName, canManage, onChanged }) {
  const { confirmDialog } = useDialog();
  const carried = actionItems?.carried || [];
  const own = actionItems?.own || [];
  const editable = !!canManage && !session?.is_ended;
  const openCount = [...carried, ...own].filter((item) => !item.done_at).length;

  const [newText, setNewText] = useState("");
  const [newOwner, setNewOwner] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editOwner, setEditOwner] = useState("");

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

  const handleAdd = async () => {
    const content = newText.trim();
    if (!content || saving) return;
    const ok = await send({ action: "add_action_item", content, ownerEmployeeId: toOwnerId(newOwner) });
    if (ok) setNewText("");
  };

  const handleToggle = (item) => send({ action: "set_action_item_done", itemId: item.id, done: !item.done_at });

  const startEdit = (item) => {
    setEditingId(item.id);
    setEditText(item.content);
    setEditOwner(item.owner_employee_id == null ? "" : String(item.owner_employee_id));
  };

  const cancelEdit = () => setEditingId(null);

  const handleSaveEdit = async (item) => {
    const content = editText.trim();
    if (!content || saving) return;
    const ok = await send({ action: "update_action_item", itemId: item.id, content, ownerEmployeeId: toOwnerId(editOwner) });
    if (ok) setEditingId(null);
  };

  const handleDelete = async (item) => {
    if (!(await confirmDialog("Delete this action item? It disappears from every retro board.", { danger: true, confirmText: "Delete" }))) return;
    await send({ action: "delete_action_item", itemId: item.id });
  };

  const ownerSelect = (value, onChange, label) =>
    members.length > 0 && (
      <select className="retro-todo-select" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label} disabled={saving}>
        <option value="">No owner</option>
        {members.map((m) => (
          <option key={m.id} value={String(m.id)}>{m.name}</option>
        ))}
      </select>
    );

  const renderItem = (item, isCarried) => {
    const done = !!item.done_at;

    if (editingId === item.id) {
      return (
        <li key={item.id} className="retro-todo is-editing">
          <input
            className="retro-todo-input"
            value={editText}
            maxLength={ACTION_ITEM_MAX}
            autoFocus
            aria-label="Action item text"
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSaveEdit(item);
              else if (e.key === "Escape") cancelEdit();
            }}
          />
          {ownerSelect(editOwner, setEditOwner, "Owner")}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleSaveEdit(item)} disabled={saving || !editText.trim()}>Save</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={cancelEdit}>Cancel</button>
        </li>
      );
    }

    const origin = isCarried && item.origin_title;
    const hasMeta = item.owner_name || item.source_card_id || origin || done;

    return (
      <li key={item.id} className={`retro-todo${done ? " is-done" : ""}`}>
        <input
          type="checkbox"
          className="retro-todo-check"
          checked={done}
          disabled={!canManage || saving}
          onChange={() => handleToggle(item)}
          aria-label={done ? "Mark action item as open" : "Mark action item as done"}
        />
        <div className="retro-todo-body">
          <span className="retro-todo-text">{item.content}</span>
          {hasMeta && (
            <div className="retro-todo-meta">
              {item.owner_name && (
                <span className="pill pill-gray">
                  <Icon name="user" size={12} strokeWidth={2} />
                  {item.owner_name}
                </span>
              )}
              {item.source_card_id && <span className="pill pill-violet">From votes</span>}
              {origin && (
                <span className="retro-todo-origin">
                  from {item.origin_title} · <span className="mono">{formatDate(item.origin_created_at)}</span>
                </span>
              )}
              {done && (
                <span className="retro-todo-origin">
                  <Icon name="check" size={12} strokeWidth={2.4} />
                  {item.done_by} · <span className="mono">{formatDate(item.done_at)}</span>
                </span>
              )}
            </div>
          )}
        </div>
        {editable && (
          <span className="retro-todo-tools">
            <button type="button" className="retro-icon-btn" onClick={() => startEdit(item)} disabled={saving} aria-label="Edit action item" title="Edit">
              <Icon name="edit" size={14} strokeWidth={2} />
            </button>
            <button type="button" className="retro-icon-btn retro-icon-btn-danger" onClick={() => handleDelete(item)} disabled={saving} aria-label="Delete action item" title="Delete">
              <Icon name="trash" size={14} strokeWidth={2} />
            </button>
          </span>
        )}
      </li>
    );
  };

  // Action items (Retro.dc.html): open count, earlier retros' items, this retro's, the add form.
  return (
    <section className="glass retro-actions-panel" aria-labelledby="retro-actions-title">
      <div className="retro-actions-head">
        <h2 id="retro-actions-title" className="retro-section-title">Action Items</h2>
        <span className="pill pill-blue"><span className="mono">{openCount}</span> open</span>
      </div>

      {error && (
        <div className="form-error retro-error" role="alert">
          <Icon name="alert" size={16} />
          <span className="retro-error-text">{error}</span>
        </div>
      )}

      {carried.length > 0 && (
        <div className="retro-todo-group">
          <h3 className="eyebrow retro-todo-group-title">From earlier retros</h3>
          <ul className="retro-todo-list">{carried.map((item) => renderItem(item, true))}</ul>
        </div>
      )}

      <div className="retro-todo-group">
        <h3 className="eyebrow retro-todo-group-title">New this retro</h3>
        {own.length === 0 ? (
          <p className="empty-msg">No action items yet.</p>
        ) : (
          <ul className="retro-todo-list">{own.map((item) => renderItem(item, false))}</ul>
        )}
      </div>

      {editable && (
        <div className="retro-todo-form">
          <label className="retro-todo-new">
            <span>New action item</span>
            <input
              className="retro-todo-input"
              value={newText}
              maxLength={ACTION_ITEM_MAX}
              placeholder="What will we do?"
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
          </label>
          {ownerSelect(newOwner, setNewOwner, "Owner for new action item")}
          <button type="button" className="btn btn-primary" onClick={handleAdd} disabled={saving || !newText.trim()}>Add</button>
        </div>
      )}
    </section>
  );
}
