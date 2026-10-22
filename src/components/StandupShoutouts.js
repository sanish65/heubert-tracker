"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import { useShoutouts, postedAt, SHOUTOUT_MAX } from "@/lib/useShoutouts";

// The standup page polls less often than the meeting board: nobody is presenting here,
// it only has to catch up with posts made elsewhere.
const POLL_MS = 15000;

// The Shout-outs card on the Daily standup page (Standup.dc.html): the board for the
// selected day's meeting, read and written through useShoutouts exactly as the Start
// Meeting page does. It saves to the main project's meeting_shoutouts, apart from the
// standup log, so either card failing leaves the other working.
export default function StandupShoutouts({ date, dayShort }) {
  const { currentEmployee } = useApp();
  const { confirmDialog } = useDialog();
  const {
    shoutouts, isLoading, loadError, error, setError, saving, post, saveEdit, remove, isMine, canDelete, taggable, nameById,
  } = useShoutouts(date, { pollMs: POLL_MS });

  // Drafts belong to a day: switching days starts a fresh one.
  const [draft, setDraft] = useState({ date, text: "", tags: [] });
  const text = draft.date === date ? draft.text : "";
  const tags = draft.date === date ? draft.tags : [];
  const setText = (value) => setDraft({ date, text: value, tags });
  const setTags = (value) => setDraft({ date, text, tags: value });

  const [editing, setEditing] = useState(null); // { id, text, tags }

  const handlePost = async () => {
    if (await post({ content: text, tags })) setDraft({ date, text: "", tags: [] });
  };

  const startEdit = (s) => {
    setEditing({ id: s.id, text: s.content, tags: s.tagged_employee_ids || [] });
    setError("");
  };

  const handleSaveEdit = async () => {
    if (await saveEdit(editing.id, { content: editing.text, tags: editing.tags })) setEditing(null);
  };

  const handleDelete = async (s) => {
    if (!(await confirmDialog("Delete this shout-out?", { danger: true, confirmText: "Delete" }))) return;
    remove(s.id);
  };

  const editingId = editing && shoutouts.some((s) => s.id === editing.id) ? editing.id : null;

  return (
    <section className="glass standup-card standup-shoutouts" aria-labelledby="standup-so-title">
      <div className="standup-card-head">
        <span className="standup-card-tile standup-card-tile-orange" aria-hidden="true">
          <Icon name="sparkles" size={20} />
        </span>
        <div className="standup-card-heading">
          <h2 id="standup-so-title" className="standup-card-title standup-card-title-lg">Shout-outs</h2>
          <span className="standup-card-sub">Shown at {dayShort}&apos;s meeting</span>
        </div>
        <span className="pill pill-gray mono standup-count" aria-label={`${shoutouts.length} shout-outs`}>
          {shoutouts.length}
        </span>
      </div>

      {currentEmployee && (
        <div className="standup-so-compose">
          <textarea
            className="standup-so-input"
            aria-label="Your shout-out"
            placeholder="Thank a teammate for something they did…"
            value={text}
            maxLength={SHOUTOUT_MAX}
            rows={2}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePost(); }}
          />
          <div className="standup-so-row">
            <TagChips value={tags} onChange={setTags} options={taggable} nameById={nameById} />
            <button
              type="button"
              className="btn btn-orange btn-sm standup-so-post"
              onClick={handlePost}
              disabled={!text.trim() || saving}
            >
              {saving && !editingId ? "Posting…" : "Post"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="form-error" role="alert"><Icon name="alert" size={16} />{error}</div>}

      {loadError ? (
        <p className="standup-card-empty">{loadError}</p>
      ) : isLoading ? (
        <p className="standup-card-empty">Loading shout-outs…</p>
      ) : shoutouts.length === 0 ? (
        <p className="standup-card-empty">No shout-outs for {dayShort} yet.</p>
      ) : (
        <ul className="standup-so-list">
          {shoutouts.map((s) => {
            const mine = isMine(s);
            const tagged = (s.tagged_employee_ids || []).map((id) => nameById.get(id)).filter(Boolean);
            if (editingId === s.id) {
              return (
                <li key={s.id} className="standup-so-item standup-so-item-editing">
                  <textarea
                    className="standup-so-input standup-so-input-boxed"
                    aria-label="Edit shout-out"
                    value={editing.text}
                    maxLength={SHOUTOUT_MAX}
                    rows={2}
                    autoFocus
                    onChange={(e) => setEditing({ ...editing, text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") setEditing(null);
                      if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveEdit();
                    }}
                  />
                  <TagChips
                    value={editing.tags}
                    onChange={(next) => setEditing({ ...editing, tags: next })}
                    options={taggable}
                    nameById={nameById}
                  />
                  <div className="standup-so-edit-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleSaveEdit} disabled={!editing.text.trim() || saving}>
                      Save
                    </button>
                  </div>
                </li>
              );
            }
            const time = postedAt(s.created_at);
            return (
              <li key={s.id} className="standup-so-item">
                <Avatar name={s.author} isMe={mine} className="avatar" aria-hidden="true" />
                <div className="standup-so-body">
                  <div className="standup-so-meta">
                    <span className="standup-so-author">{mine ? "You" : s.author}</span>
                    {tagged.length > 0 && <span className="standup-so-for">for {tagged.join(", ")}</span>}
                    {time && <span className="standup-so-time mono">{time}</span>}
                    {(mine || canDelete(s)) && (
                      <span className="standup-so-actions">
                        {mine && (
                          <button type="button" className="btn-icon btn-sm" onClick={() => startEdit(s)} aria-label="Edit shout-out" title="Edit">
                            <Icon name="edit" size={14} />
                          </button>
                        )}
                        {canDelete(s) && (
                          <button type="button" className="btn-icon btn-sm standup-so-delete" onClick={() => handleDelete(s)} aria-label="Delete shout-out" title="Delete">
                            <Icon name="trash" size={14} />
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                  <p className="standup-so-text">{s.content}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <span className="standup-card-foot mono">
        <Icon name="database" size={14} />
        Saved to the meeting board
      </span>
    </section>
  );
}

// "For" and the tagged teammates as avatar chips, then a picker of everyone else who
// hasn't resigned.
function TagChips({ value, onChange, options, nameById }) {
  const remaining = options.filter((e) => !value.includes(e.id));
  return (
    <div className="standup-so-tags">
      <span className="standup-so-for-label">For</span>
      {value.map((id) => {
        const name = nameById.get(id) || "Unknown";
        return (
          <span key={id} className="standup-so-chip">
            <Avatar name={name} className="avatar standup-so-chip-avatar" aria-hidden="true" />
            {name}
            <button type="button" onClick={() => onChange(value.filter((v) => v !== id))} aria-label={`Remove ${name}`} title="Remove">
              <Icon name="x" size={12} strokeWidth={2} />
            </button>
          </span>
        );
      })}
      {remaining.length > 0 && (
        <select
          className="standup-so-picker"
          aria-label="Tag a teammate"
          value=""
          onChange={(e) => { if (e.target.value) onChange([...value, Number(e.target.value)]); }}
        >
          <option value="">+ Tag teammate</option>
          {remaining.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      )}
    </div>
  );
}
