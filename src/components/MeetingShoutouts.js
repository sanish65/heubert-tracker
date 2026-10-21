"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import { isWorkingDay } from "@/lib/attendanceTime";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";

export const SHOUTOUT_MAX = 280;
// Colleagues post from their own laptops while the meeting screen is shared, so the list
// polls like the other live features (retro, planning poker) instead of loading once.
const POLL_MS = 3000;

// "09:20 AM" when a shoutout was posted, in office time like the standup submissions.
const POSTED_AT_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: "Asia/Kathmandu",
  hour: "2-digit",
  minute: "2-digit",
});

// Parse a YYYY-MM-DD day as local midnight: new Date("2026-10-08") is UTC midnight, which
// lands on the previous day anywhere west of UTC.
const localDay = (ymd) => new Date(`${ymd}T00:00:00`);
const shiftDay = (ymd, delta) => {
  const d = localDay(ymd);
  d.setDate(d.getDate() + delta);
  return d.toLocaleDateString("en-CA");
};

// The first working day after `ymd` (skipping weekends and public holidays) — the day of
// the next meeting. Bounded so a holiday list gone wrong can't spin forever.
const nextMeetingDay = (ymd, holidays) => {
  let day = shiftDay(ymd, 1);
  for (let i = 0; i < 14 && !isWorkingDay(day, holidays); i++) day = shiftDay(day, 1);
  return day;
};

const postedAt = (createdAt) => {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  return Number.isNaN(d.getTime()) ? "" : POSTED_AT_FORMAT.format(d);
};

// A person on the meeting page: their photo, else initials over their colour; the
// signed-in user is marked orange (the one place orange marks a person).
export function MeetingAvatar({ name, isMe = false }) {
  return <Avatar name={name} isMe={isMe} className="avatar meeting-avatar" aria-hidden="true" />;
}

// Shoutouts and kudos on the Start Meeting page. Anyone signed in can post one for today's
// meeting or the next one (written the evening before, shown when that meeting starts),
// optionally tagging the colleagues it is for; you edit and delete your own, admins can
// delete any. Row Level Security enforces the same (scripts/meeting-shoutouts-schema.sql).
// The previous-day arrow looks back at earlier days, read-only; the next-day arrow goes as
// far as the next meeting day.
export default function MeetingShoutouts({ today }) {
  const { employees, currentEmployee, isAdmin, publicHolidays } = useApp();
  const { confirmDialog } = useDialog();

  // null = follow today; set once someone steps back through the days.
  const [pickedDate, setPickedDate] = useState(null);
  const date = pickedDate || today;
  const isToday = date === today;
  const upcoming = useMemo(() => (today ? nextMeetingDay(today, publicHolidays) : ""), [today, publicHolidays]);
  const isUpcoming = !!upcoming && date === upcoming;
  // Past meetings stay as they were; today's and the next one are still open.
  const isOpen = isToday || isUpcoming;

  const [shoutouts, setShoutouts] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [text, setText] = useState("");
  const [tags, setTags] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editTags, setEditTags] = useState([]);

  const nameById = useMemo(() => new Map(employees.map(e => [e.id, e.name])), [employees]);
  const taggable = useMemo(
    () => employees.filter(e => e.status !== "resigned").sort((a, b) => a.name.localeCompare(b.name)),
    [employees]
  );

  // Resolves to what the list should show; state is set in the .then, so the polling
  // effect below only subscribes and never sets state synchronously.
  const loadShoutouts = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("meeting_shoutouts")
      .select("*")
      .eq("shoutout_date", date)
      .order("created_at", { ascending: true });
    if (!err) return { rows: data || [], message: "" };
    return {
      rows: null,
      message: /meeting_shoutouts/.test(err.message)
        ? "Shoutouts need scripts/meeting-shoutouts-schema.sql applied."
        : "Couldn't load shoutouts.",
    };
  }, [date]);

  const fetchShoutouts = useCallback(
    () => loadShoutouts().then(({ rows, message }) => {
      setLoadError(message);
      if (rows) setShoutouts(rows);
    }),
    [loadShoutouts]
  );

  useEffect(() => {
    if (!date) return;
    let live = true;
    const tick = () => loadShoutouts().then(({ rows, message }) => {
      if (!live) return;
      setLoadError(message);
      if (rows) setShoutouts(rows);
    });
    tick();
    const id = setInterval(tick, POLL_MS);
    return () => { live = false; clearInterval(id); };
  }, [date, loadShoutouts]);

  const isMine = (s) => currentEmployee && s.author_employee_id === currentEmployee.id;

  const handlePost = async () => {
    const content = text.trim();
    if (!content || saving || !currentEmployee) return;
    setSaving(true);
    setError("");
    const { error: err } = await supabase.from("meeting_shoutouts").insert({
      shoutout_date: date,
      content,
      author: currentEmployee.name,
      author_employee_id: currentEmployee.id,
      tagged_employee_ids: tags,
    });
    setSaving(false);
    if (err) { setError("Couldn't post your shoutout. Try again."); return; }
    setText("");
    setTags([]);
    fetchShoutouts();
  };

  const startEdit = (s) => {
    setEditingId(s.id);
    setEditText(s.content);
    setEditTags(s.tagged_employee_ids || []);
    setError("");
  };

  const handleSaveEdit = async () => {
    const content = editText.trim();
    if (!content || saving) return;
    setSaving(true);
    setError("");
    // .select() so a write RLS quietly refused (0 rows) shows up as an error, not a no-op.
    const { data, error: err } = await supabase
      .from("meeting_shoutouts")
      .update({ content, tagged_employee_ids: editTags })
      .eq("id", editingId)
      .select();
    setSaving(false);
    if (err || !data?.length) { setError("Couldn't save your changes."); return; }
    setEditingId(null);
    fetchShoutouts();
  };

  const handleDelete = async (s) => {
    if (!(await confirmDialog("Delete this shoutout?", { danger: true, confirmText: "Delete" }))) return;
    setError("");
    const { data, error: err } = await supabase.from("meeting_shoutouts").delete().eq("id", s.id).select();
    if (err || !data?.length) { setError("Couldn't delete that shoutout."); return; }
    setShoutouts(prev => prev.filter(x => x.id !== s.id));
  };

  return (
    <section className="glass meeting-panel shoutouts-card" aria-labelledby="meeting-shoutouts-title">
      <div className="shoutouts-head">
        <div className="shoutouts-head-text">
          <h2 id="meeting-shoutouts-title" className="meeting-panel-title">Shoutouts &amp; kudos</h2>
          <span className="shoutouts-sub">Thank a colleague or celebrate a win.</span>
        </div>
        {today && (
          <div className="meeting-date-nav" role="group" aria-label="Shoutout date">
            <button
              type="button"
              className="meeting-date-btn"
              onClick={() => { setEditingId(null); setPickedDate(shiftDay(date, -1)); }}
              aria-label="Previous day"
              title="Previous day"
            >
              <Icon name="chevron-left" size={16} strokeWidth={2} />
            </button>
            <span className="meeting-date-label">
              {isToday ? "Today" : localDay(date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              {isUpcoming && " · next meeting"}
            </span>
            <button
              type="button"
              className="meeting-date-btn"
              onClick={() => {
                setEditingId(null);
                if (isToday) { setPickedDate(upcoming); return; }
                const next = shiftDay(date, 1);
                setPickedDate(next >= today ? null : next);
              }}
              disabled={isUpcoming}
              aria-label="Next day"
              title="Next day"
            >
              <Icon name="chevron-right" size={16} strokeWidth={2} />
            </button>
          </div>
        )}
      </div>

      {loadError ? (
        <p className="empty-msg">{loadError}</p>
      ) : (
        <>
          {shoutouts.length === 0 ? (
            <p className="empty-msg">
              {isToday ? "No shoutouts yet today — be the first."
                : isUpcoming ? "Nothing queued for the next meeting yet. Add one now and it shows up when the meeting starts."
                : "No shoutouts on this day."}
            </p>
          ) : (
            <ul className="shoutouts-list">
              {shoutouts.map(s => {
                const tagged = (s.tagged_employee_ids || []).map(id => nameById.get(id)).filter(Boolean);
                const canEdit = isOpen && isMine(s);
                const canDelete = isOpen && (isMine(s) || isAdmin);
                if (editingId === s.id) {
                  return (
                    <li key={s.id} className="shoutout-item shoutout-item-editing">
                      <textarea
                        className="shoutouts-input"
                        aria-label="Edit shoutout"
                        value={editText}
                        maxLength={SHOUTOUT_MAX}
                        rows={2}
                        autoFocus
                        onChange={e => setEditText(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === "Escape") setEditingId(null);
                          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handleSaveEdit();
                        }}
                      />
                      <TagPicker value={editTags} onChange={setEditTags} options={taggable} nameById={nameById} />
                      <div className="shoutout-edit-actions">
                        <button type="button" className="btn btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
                        <button type="button" className="btn btn-primary" onClick={handleSaveEdit} disabled={!editText.trim() || saving}>Save</button>
                      </div>
                    </li>
                  );
                }
                const time = postedAt(s.created_at);
                return (
                  <li key={s.id} className="shoutout-item">
                    <MeetingAvatar name={s.author} isMe={!!isMine(s)} />
                    <div className="shoutout-body">
                      <div className="shoutout-meta">
                        <span className="shoutout-author">{s.author}</span>
                        {tagged.length > 0 && (
                          <>
                            <Icon name="chevron-right" size={14} strokeWidth={2} className="shoutout-arrow" />
                            {tagged.map((name, i) => (
                              <span key={`${s.id}-tag-${i}`} className="shoutout-tagged">{name}</span>
                            ))}
                          </>
                        )}
                        {time && <span className="shoutout-time">{time}</span>}
                        {(canEdit || canDelete) && (
                          <div className="meeting-actions shoutout-actions">
                            {canEdit && (
                              <button type="button" className="btn-icon btn-sm" onClick={() => startEdit(s)} aria-label="Edit shoutout" title="Edit">
                                <Icon name="edit" size={15} />
                              </button>
                            )}
                            {canDelete && (
                              <button type="button" className="btn-icon btn-sm meeting-delete" onClick={() => handleDelete(s)} aria-label="Delete shoutout" title="Delete">
                                <Icon name="trash" size={15} />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      <p className="shoutout-text">{s.content}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {error && <div className="form-error" role="alert"><Icon name="alert" size={16} />{error}</div>}

          {currentEmployee && isOpen && (
            <div className="shoutouts-compose">
              <label className="shoutouts-field">
                <span className="shoutouts-field-label">New shoutout</span>
                <textarea
                  className="shoutouts-input"
                  placeholder={isUpcoming
                    ? `Queue a shoutout for ${localDay(date).toLocaleDateString("en-US", { weekday: "long" })}'s meeting…`
                    : "Who deserves a shoutout, and for what?"}
                  value={text}
                  maxLength={SHOUTOUT_MAX}
                  rows={2}
                  onChange={e => setText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) handlePost(); }}
                />
              </label>
              <div className="shoutouts-compose-row">
                <TagPicker value={tags} onChange={setTags} options={taggable} nameById={nameById} />
                <button type="button" className="btn btn-orange" onClick={handlePost} disabled={!text.trim() || saving}>
                  {saving && !editingId ? "Posting…" : "Post"}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

// Tagged colleagues as removable chips, plus a picker for adding more.
function TagPicker({ value, onChange, options, nameById }) {
  const remaining = options.filter(e => !value.includes(e.id));
  return (
    <div className="shoutouts-tags">
      {value.map(id => {
        const name = nameById.get(id) || "Unknown";
        return (
          <span key={id} className="shoutouts-tag">
            {name}
            <button
              type="button"
              onClick={() => onChange(value.filter(v => v !== id))}
              aria-label={`Remove ${name}`}
              title="Remove"
            >
              <Icon name="x" size={12} strokeWidth={2} />
            </button>
          </span>
        );
      })}
      {remaining.length > 0 && (
        <select
          className="shoutouts-tag-select"
          aria-label="Tag a colleague"
          value=""
          onChange={e => { if (e.target.value) onChange([...value, Number(e.target.value)]); }}
        >
          <option value="">+ Tag a colleague</option>
          {remaining.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      )}
    </div>
  );
}
