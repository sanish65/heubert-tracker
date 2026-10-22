"use client";

// The issue view's second batch of Jira features, kept apart from TaskIssueModal so
// each piece reads on its own: @mention comments, time tracking and the work log,
// attachments and watching.

import { useRef, useState } from "react";
import Icon from "@/components/Icon";
import { useDialog } from "@/context/DialogContext";
import { ATTACHMENT_MAX_BYTES } from "@/lib/useTasks";
import {
  formatDuration,
  parseDuration,
  timeTracking,
  mentionQueryAt,
  mentionCandidates,
  insertMention,
} from "@/lib/taskExtras";
import { formatDateTime } from "@/components/TaskBits";

// ── @mention textarea ───────────────────────────────────────────────────────

// A textarea that offers teammates after "@". Picking one writes "@Full Name " and
// records their id, which goes with the comment so the database can notify them.
export function MentionTextarea({ value, onChange, mentions, onMentionsChange, employees, onSubmit, placeholder, rows = 2 }) {
  const ref = useRef(null);
  const [menu, setMenu] = useState(null);
  const [active, setActive] = useState(0);
  const candidates = menu ? mentionCandidates(employees, menu.query) : [];
  const open = candidates.length > 0;

  const track = (text, caret) => {
    onChange(text);
    setMenu(mentionQueryAt(text, caret));
    setActive(0);
  };

  // Replaces exactly the "@query" the menu was opened for, wherever the caret has gone.
  const pick = (emp) => {
    const el = ref.current;
    const next = insertMention(value, menu.start, menu.start + 1 + menu.query.length, emp.name);
    onChange(next.text);
    onMentionsChange([...mentions.filter((m) => m.id !== emp.id), { id: emp.id, name: emp.name }]);
    setMenu(null);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(next.caret, next.caret);
    });
  };

  const onKeyDown = (e) => {
    if (open) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => (i + 1) % candidates.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => (i - 1 + candidates.length) % candidates.length);
        return;
      }
      // A plain Enter or Tab picks; Ctrl/Cmd+Enter still posts, and Enter that ends an
      // IME composition belongs to the input method.
      if ((e.key === "Enter" || e.key === "Tab") && !e.ctrlKey && !e.metaKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        pick(candidates[active]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        setMenu(null);
        return;
      }
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit?.();
  };

  return (
    <div className="mention-wrap">
      <textarea
        ref={ref}
        rows={rows}
        placeholder={placeholder}
        value={value}
        onChange={(e) => track(e.target.value, e.target.selectionStart)}
        // Arrow keys and clicks move the caret too: the menu follows what's before it.
        onSelect={(e) => setMenu(mentionQueryAt(e.target.value, e.target.selectionStart))}
        onKeyDown={onKeyDown}
        onBlur={() => setTimeout(() => setMenu(null), 150)}
      />
      {open && (
        <ul className="mention-menu glass" role="listbox" aria-label="Mention a teammate">
          {candidates.map((emp, i) => (
            <li key={emp.id} role="option" aria-selected={i === active}>
              <button
                type="button"
                className={`mention-option ${i === active ? "is-active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(emp);
                }}
              >
                {emp.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Time tracking ───────────────────────────────────────────────────────────

function DurationInput({ label, minutes, onSave, placeholder, allowZero = false }) {
  const [draft, setDraft] = useState(null);
  const [error, setError] = useState("");
  const shown = draft ?? (minutes == null ? "" : formatDuration(minutes));
  return (
    <div className="issue-field issue-field-compact">
      <label>{label}</label>
      <input
        type="text"
        className={error ? "is-overdue" : ""}
        placeholder={placeholder}
        value={shown}
        onChange={(e) => {
          setDraft(e.target.value);
          setError("");
        }}
        onBlur={async () => {
          if (draft == null) return;
          const text = draft.trim();
          const parsed = text ? parseDuration(text, { allowZero }) : null;
          if (text && parsed == null) {
            setError("Use e.g. 2h 30m, 1d or 45m");
            return;
          }
          setDraft(null);
          if (parsed !== minutes) await onSave(parsed);
        }}
        title={error || "w = week (5d), d = day (8h), h, m"}
      />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

// The sidebar panel: Jira's time-tracking bar, the two estimates and "Log work".
export function TimeTrackingPanel({ issue, detail, save, today, onLogged }) {
  const { alertDialog } = useDialog();
  const t = timeTracking(issue);
  const [logging, setLogging] = useState(false);
  const [spent, setSpent] = useState("");
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const minutes = parseDuration(spent);
    if (!minutes) {
      setError("Enter the time spent, e.g. 1h 30m");
      return;
    }
    if (minutes > 24 * 60) {
      setError("At most 24h in one entry");
      return;
    }
    setBusy(true);
    const { error: dbError } = await detail.addWorklog({ minutes, work_date: date, note });
    setBusy(false);
    if (dbError) {
      await alertDialog(`Couldn't log work: ${dbError.message}`, { tone: "error" });
      return;
    }
    setSpent("");
    setNote("");
    setLogging(false);
    onLogged?.();
  };

  return (
    <div className="issue-time">
      <span className="issue-time-label">Time tracking</span>
      <div className="issue-time-bar" role="img" aria-label={`${formatDuration(t.spent)} logged, ${t.remaining == null ? "no estimate" : `${formatDuration(t.remaining)} remaining`}`}>
        <span style={{ width: `${t.spentPct}%` }} className={t.overMinutes ? "is-over" : ""} />
      </div>
      <div className="issue-time-figures mono">
        <span>{formatDuration(t.spent)} logged</span>
        <span>{t.remaining == null ? "No estimate" : `${formatDuration(t.remaining)} remaining`}</span>
      </div>
      {t.overMinutes > 0 && <span className="issue-time-over">{formatDuration(t.overMinutes)} over the original estimate</span>}
      <div className="issue-time-inputs">
        <DurationInput
          label="Original estimate"
          minutes={issue.original_estimate_min}
          placeholder="e.g. 1d"
          // A first estimate also sets what's remaining, as Jira does.
          onSave={(m) => save(issue.remaining_estimate_min == null ? { original_estimate_min: m, remaining_estimate_min: m } : { original_estimate_min: m })}
        />
        <DurationInput label="Remaining" minutes={issue.remaining_estimate_min} placeholder="e.g. 4h" allowZero onSave={(m) => save({ remaining_estimate_min: m })} />
      </div>
      {logging ? (
        <form className="issue-log-form" onSubmit={submit}>
          <div className="issue-field issue-field-compact">
            <label>Time spent</label>
            <input type="text" autoFocus placeholder="e.g. 1h 30m" value={spent} onChange={(e) => { setSpent(e.target.value); setError(""); }} />
          </div>
          <div className="issue-field issue-field-compact">
            <label>Date</label>
            <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="issue-field issue-field-compact">
            <label>What did you work on?</label>
            <input type="text" placeholder="Optional" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          {error && <span className="form-error">{error}</span>}
          <div className="issue-edit-actions">
            <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Saving..." : "Log"}</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setLogging(false)}>Cancel</button>
          </div>
        </form>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm issue-log-btn" onClick={() => setLogging(true)}>
          <Icon name="clock" size={16} /> Log work
        </button>
      )}
    </div>
  );
}

export function WorklogList({ worklogs, myEmail, isAdmin, onDelete }) {
  if (!worklogs.length) return <li className="issue-muted">No work logged yet.</li>;
  return worklogs.map((w) => {
    const mine = (w.author_email || "").toLowerCase() === myEmail;
    return (
      <li key={`w-${w.id}`} className="issue-worklog">
        <span className="issue-worklog-time mono">{formatDuration(w.minutes)}</span>
        <div className="issue-worklog-text">
          <span>
            <strong>{w.author_name || w.author_email}</strong> · <span className="mono">{w.work_date}</span>
          </span>
          {w.note && <span className="issue-muted">{w.note}</span>}
        </div>
        {(mine || isAdmin) && (
          <button type="button" className="issue-comment-delete" aria-label="Delete work log" title="Delete work log" onClick={() => onDelete(w)}>
            <Icon name="x" size={16} />
          </button>
        )}
      </li>
    );
  });
}

// ── Attachments ─────────────────────────────────────────────────────────────

function formatBytes(n) {
  if (!n && n !== 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsSection({ detail, myEmail, isAdmin }) {
  const { alertDialog, confirmDialog } = useDialog();
  const inputRef = useRef(null);
  const [uploading, setUploading] = useState(0);
  const [dragging, setDragging] = useState(false);

  const upload = async (files) => {
    const list = [...files];
    const tooBig = list.filter((f) => f.size > ATTACHMENT_MAX_BYTES);
    if (tooBig.length) await alertDialog(`${tooBig.map((f) => f.name).join(", ")}: files can be up to 10 MB.`, { tone: "error" });
    for (const file of list.filter((f) => f.size <= ATTACHMENT_MAX_BYTES)) {
      setUploading((n) => n + 1);
      const { error } = await detail.uploadAttachment(file);
      setUploading((n) => n - 1);
      if (error) await alertDialog(`Couldn't upload ${file.name}: ${error.message}`, { tone: "error" });
    }
  };

  // The tab opens on the click itself, then gets the signed link: opening it after the
  // await would count as a popup without a user gesture, which Safari blocks.
  const open = async (att) => {
    const tab = window.open("", "_blank");
    const { url, error } = await detail.attachmentUrl(att);
    if (error || !url) {
      tab?.close();
      await alertDialog(`Couldn't open ${att.name}: ${error?.message || "no link"}`, { tone: "error" });
      return;
    }
    if (tab) {
      tab.opener = null;
      tab.location.href = url;
    } else {
      window.location.assign(url);
    }
  };

  const remove = async (att) => {
    if (!(await confirmDialog(`Delete ${att.name}?`, { danger: true }))) return;
    const { error } = await detail.deleteAttachment(att);
    if (error) await alertDialog(`Couldn't delete: ${error.message}`, { tone: "error" });
  };

  return (
    <section
      className={`issue-section issue-attachments ${dragging ? "is-dragging" : ""}`}
      onDragOver={(e) => {
        if (e.dataTransfer?.types?.includes("Files")) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!e.dataTransfer?.files?.length) return;
        e.preventDefault();
        setDragging(false);
        upload(e.dataTransfer.files);
      }}
    >
      <div className="issue-section-head">
        <h3 className="eyebrow issue-section-title">Attachments{detail.attachments.length ? ` (${detail.attachments.length})` : ""}</h3>
        <button type="button" className="issue-inline-add" onClick={() => inputRef.current?.click()}>
          <Icon name="plus" size={16} strokeWidth={2.2} /> {uploading ? `Uploading ${uploading}…` : "Add file"}
        </button>
        <input
          ref={inputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            upload(e.target.files || []);
            e.target.value = "";
          }}
        />
      </div>
      {detail.attachments.length === 0 ? (
        <p className="issue-muted">Drop files here or use Add file. Up to 10 MB each.</p>
      ) : (
        <ul className="issue-attachment-list">
          {detail.attachments.map((att) => {
            const mine = (att.uploaded_by || "").toLowerCase() === myEmail;
            return (
              <li key={att.id} className="issue-attachment">
                <button type="button" className="issue-attachment-open" onClick={() => open(att)}>
                  <Icon name={String(att.mime_type || "").startsWith("image/") ? "image" : "download"} size={16} />
                  <span className="issue-attachment-name">{att.name}</span>
                </button>
                <span className="issue-muted mono">{formatBytes(att.size_bytes)} · {formatDateTime(att.created_at)}</span>
                {(mine || isAdmin) && (
                  <button type="button" className="issue-comment-delete" aria-label={`Delete ${att.name}`} title="Delete" onClick={() => remove(att)}>
                    <Icon name="x" size={16} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ── Watching ────────────────────────────────────────────────────────────────

export function WatchButton({ detail, currentEmployee, employeesById }) {
  const { alertDialog } = useDialog();
  const watching = Boolean(currentEmployee && detail.watchers.some((w) => w.employee_id === currentEmployee.id));
  const names = detail.watchers.map((w) => employeesById.get(w.employee_id)?.name).filter(Boolean);
  const toggle = async () => {
    const { error } = watching ? await detail.unwatch() : await detail.watch();
    if (error) await alertDialog(`Couldn't change watching: ${error.message}`, { tone: "error" });
  };
  return (
    <button
      type="button"
      className={`btn btn-ghost btn-sm ${watching ? "is-watching" : ""}`}
      onClick={toggle}
      aria-pressed={watching}
      title={names.length ? `Watching: ${names.join(", ")}` : "Nobody is watching yet"}
    >
      <Icon name="eye" size={16} /> {watching ? "Watching" : "Watch"} <span className="mono">{detail.watchers.length}</span>
    </button>
  );
}
