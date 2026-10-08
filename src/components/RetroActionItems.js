"use client";

import { useState } from "react";
import { postRetro } from "@/lib/retroApi";
import { ACTION_ITEM_MAX } from "@/lib/retroBoardRules";
import { useDialog } from "@/context/DialogContext";

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
        <li key={item.id} className="retro-todo-item retro-todo-item-editing">
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
          <button type="button" className="retro-todo-btn retro-todo-btn-primary" onClick={() => handleSaveEdit(item)} disabled={saving || !editText.trim()}>Save</button>
          <button type="button" className="retro-todo-btn" onClick={cancelEdit}>Cancel</button>
        </li>
      );
    }

    return (
      <li key={item.id} className={`retro-todo-item${done ? " retro-todo-item-done" : ""}`}>
        <input
          type="checkbox"
          className="retro-todo-check"
          checked={done}
          disabled={!canManage || saving}
          onChange={() => handleToggle(item)}
          aria-label={done ? "Mark action item as open" : "Mark action item as done"}
        />
        <span className="retro-todo-text">{item.content}</span>
        {item.owner_name && <span className="retro-todo-owner">👤 {item.owner_name}</span>}
        {isCarried && item.origin_title && (
          <span className="retro-todo-origin">from {item.origin_title} · {formatDate(item.origin_created_at)}</span>
        )}
        {done && <span className="retro-todo-origin">✓ {item.done_by} · {formatDate(item.done_at)}</span>}
        {editable && (
          <span className="retro-todo-actions">
            <button type="button" className="retro-todo-icon-btn" onClick={() => startEdit(item)} disabled={saving} aria-label="Edit action item" title="Edit">✏️</button>
            <button type="button" className="retro-todo-icon-btn" onClick={() => handleDelete(item)} disabled={saving} aria-label="Delete action item" title="Delete">✕</button>
          </span>
        )}
      </li>
    );
  };

  return (
    <section className="retro-todo-panel">
      <h3 className="retro-todo-title">✅ Action Items <span className="retro-todo-count">{openCount}</span></h3>

      {error && <div className="retro-todo-error" role="alert">{error}</div>}

      {carried.length > 0 && (
        <div className="retro-todo-group">
          <div className="retro-todo-group-title">From earlier retros</div>
          <ul className="retro-todo-list">{carried.map((item) => renderItem(item, true))}</ul>
        </div>
      )}

      <div className="retro-todo-group">
        <div className="retro-todo-group-title">New this retro</div>
        {own.length === 0 ? (
          <div className="retro-todo-empty">No action items yet.</div>
        ) : (
          <ul className="retro-todo-list">{own.map((item) => renderItem(item, false))}</ul>
        )}
        {editable && (
          <div className="retro-todo-form">
            <input
              className="retro-todo-input"
              value={newText}
              maxLength={ACTION_ITEM_MAX}
              placeholder="What will we do?"
              aria-label="New action item"
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
            {ownerSelect(newOwner, setNewOwner, "Owner for new action item")}
            <button type="button" className="retro-todo-btn retro-todo-btn-primary" onClick={handleAdd} disabled={saving || !newText.trim()}>Add</button>
          </div>
        )}
      </div>
    </section>
  );
}
