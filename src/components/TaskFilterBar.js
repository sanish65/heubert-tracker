"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import PersonAvatar from "@/components/Avatar";
import { ISSUE_TYPES } from "@/lib/taskBoard";
import { BUILT_IN_FILTERS } from "@/lib/taskQuery";

const FILTER_TYPES = ISSUE_TYPES.filter((t) => t.value !== "epic");

// Avatars shown before the rest fold into "+N".
const AVATARS_SHOWN = 6;

// Jira's quick filter: an overlapping row of everyone with work in the project, and an
// Unassigned disc. Each one toggles; picking several shows any of their issues. "+N"
// opens the rest, and stays lit while one of the hidden avatars is picked.
function AssigneeFilter({ people, unassigned, picked, onToggle, meId }) {
  const [expanded, setExpanded] = useState(false);
  if (!people.length && !unassigned) return null;
  const shown = expanded ? people : people.slice(0, AVATARS_SHOWN);
  const hidden = people.length - shown.length;
  const hiddenPicked = people.slice(AVATARS_SHOWN).some((e) => picked.includes(e.id));

  return (
    <div className="assignee-filter" role="group" aria-label="Filter by assignee">
      {shown.map((e) => {
        const on = picked.includes(e.id);
        const label = e.id === meId ? `${e.name} (you)` : e.name;
        return (
          <button key={e.id} type="button" className={`assignee-filter-btn ${on ? "is-active" : ""}`} aria-pressed={on} aria-label={label} title={label} onClick={() => onToggle(e.id)}>
            <PersonAvatar name={e.name} className="avatar avatar-sm" aria-hidden="true" />
          </button>
        );
      })}
      {hidden > 0 && (
        <button type="button" className={`assignee-filter-btn assignee-filter-more ${hiddenPicked ? "is-active" : ""}`} aria-expanded={false} aria-label={`Show ${hidden} more`} title={`Show ${hidden} more`} onClick={() => setExpanded(true)}>
          <span className="avatar avatar-sm">+{hidden}</span>
        </button>
      )}
      {expanded && people.length > AVATARS_SHOWN && (
        <button type="button" className="assignee-filter-btn assignee-filter-more" aria-expanded aria-label="Show fewer" title="Show fewer" onClick={() => setExpanded(false)}>
          <span className="avatar avatar-sm"><Icon name="chevron-left" size={14} strokeWidth={2.2} /></span>
        </button>
      )}
      {unassigned && (
        <button type="button" className={`assignee-filter-btn ${picked.includes(null) ? "is-active" : ""}`} aria-pressed={picked.includes(null)} aria-label="Unassigned" title="Unassigned" onClick={() => onToggle(null)}>
          <span className="avatar avatar-sm issue-avatar-none" aria-hidden="true">?</span>
        </button>
      )}
    </div>
  );
}

function SaveFilterModal({ initialName = "", onSave, onClose }) {
  const [name, setName] = useState(initialName);
  const [shared, setShared] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return setError("Give the filter a name");
    setBusy(true);
    const { error: dbError } = await onSave({ name, shared });
    setBusy(false);
    if (dbError) return setError(dbError.message || "Couldn't save the filter");
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose}>
      <div className="modal-header">
        <h2>Save filter</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
      <form onSubmit={submit} className="premium-form">
        <div className="form-group-interactive">
          <label htmlFor="filter-name">Name</label>
          <input id="filter-name" value={name} maxLength={60} autoFocus onChange={(e) => { setName(e.target.value); setError(""); }} />
        </div>
        <label className="filter-share-option">
          <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
          Share with everyone on this project
        </label>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : "Save filter"}</button>
        </div>
      </form>
    </Modal>
  );
}

// The search bar over the board, backlog and issue list. Basic: search text and chips.
// JQL: a query in Jira's language (src/lib/taskQuery.js), checked as it's typed. Either
// way, a saved filter (built in, yours, or one shared with the project) loads a query.
export default function TaskFilterBar({ project, board, basic, jql, compiled, matchCount, searchRef }) {
  const { currentEmployee, isAdmin } = useApp();
  const { alertDialog, confirmDialog } = useDialog();
  const [saving, setSaving] = useState(false);
  const { mode, setMode, text, setText, activeId, setActiveId } = jql;

  const saved = board.savedFilters || [];
  const mine = saved.filter((f) => f.owner_id === currentEmployee?.id);
  const shared = saved.filter((f) => f.shared && f.owner_id !== currentEmployee?.id);
  const active = activeId?.startsWith("s:") ? saved.find((f) => `s:${f.id}` === activeId) : null;
  const ownsActive = active && active.owner_id === currentEmployee?.id;
  const canDeleteActive = active && (ownsActive || (isAdmin && active.shared));
  const dirty = active && active.query.trim() !== text.trim();

  const pickFilter = (value) => {
    if (!value) {
      setActiveId(null);
      setText("");
      return;
    }
    const query = value.startsWith("b:")
      ? BUILT_IN_FILTERS.find((f) => `b:${f.id}` === value)?.query
      : saved.find((f) => `s:${f.id}` === value)?.query;
    if (query == null) return;
    setActiveId(value);
    setText(query);
    setMode("jql");
  };

  const saveChanges = async () => {
    const { error } = await board.updateFilter(active.id, { query: text.trim() });
    if (error) await alertDialog(`Couldn't save the filter: ${error.message}`, { tone: "error" });
  };

  const remove = async () => {
    if (!(await confirmDialog(`Delete the filter “${active.name}”?${active.shared ? " Everyone it's shared with loses it too." : ""}`, { danger: true }))) return;
    const { error } = await board.deleteFilter(active.id);
    if (error) await alertDialog(`Couldn't delete the filter: ${error.message}`, { tone: "error" });
    else setActiveId(null);
  };

  const basicOn = basic.search.trim() || basic.onlyMine || basic.recent || basic.types.length || basic.assignees.length;

  return (
    <div className="tasks-filter-area">
      <div className="tasks-filters">
        <div className="filter-mode" role="group" aria-label="Search mode">
          <button type="button" className={mode === "basic" ? "is-active" : ""} aria-pressed={mode === "basic"} onClick={() => {
              // A saved filter is a query: leaving JQL leaves it too.
              setMode("basic");
              setActiveId(null);
            }}>
            Basic
          </button>
          <button type="button" className={mode === "jql" ? "is-active" : ""} aria-pressed={mode === "jql"} onClick={() => setMode("jql")}>
            JQL
          </button>
        </div>

        {mode === "basic" ? (
          <>
            <label className="tasks-search">
              <Icon name="search" size={16} strokeWidth={2} />
              <input
                ref={searchRef}
                type="search"
                aria-label={`Search ${project.issue_key} issues`}
                placeholder="Search title, label or issue key…"
                value={basic.search}
                onChange={(e) => basic.setSearch(e.target.value)}
              />
            </label>
            <AssigneeFilter
              people={basic.people}
              unassigned={basic.unassigned}
              picked={basic.assignees}
              onToggle={basic.toggleAssignee}
              meId={currentEmployee?.id}
            />
            <button className={`project-filter-chip ${basic.onlyMine ? "active" : ""}`} onClick={() => basic.setOnlyMine((v) => !v)}>
              Only my issues
            </button>
            <button className={`project-filter-chip ${basic.recent ? "active" : ""}`} onClick={() => basic.setRecent((v) => !v)}>
              Recently updated
            </button>
            {FILTER_TYPES.map((t) => (
              <button key={t.value} className={`project-filter-chip ${basic.types.includes(t.value) ? "active" : ""}`} onClick={() => basic.toggleType(t.value)}>
                {t.label}
              </button>
            ))}
            {basicOn ? (
              <button className="btn btn-ghost btn-sm" onClick={basic.clear}>
                Clear filters
              </button>
            ) : null}
          </>
        ) : (
          <label className={`tasks-search jql-input ${compiled.ok ? "" : "is-invalid"}`}>
            <Icon name="filter" size={16} strokeWidth={2} />
            <input
              ref={searchRef}
              type="text"
              spellCheck={false}
              autoComplete="off"
              aria-label="JQL query"
              aria-invalid={!compiled.ok}
              aria-describedby="jql-hint"
              placeholder='e.g. assignee = currentUser() AND status = "In QA" ORDER BY priority DESC'
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>
        )}

        <select className="filter-saved-select" aria-label="Saved filters" value={activeId || ""} onChange={(e) => pickFilter(e.target.value)}>
          <option value="">{activeId ? "No filter" : "Filters…"}</option>
          <optgroup label="Built in">
            {BUILT_IN_FILTERS.map((f) => (
              <option key={f.id} value={`b:${f.id}`}>{f.name}</option>
            ))}
          </optgroup>
          {mine.length > 0 && (
            <optgroup label="My filters">
              {mine.map((f) => (
                <option key={f.id} value={`s:${f.id}`}>{f.name}{f.shared ? " (shared)" : ""}</option>
              ))}
            </optgroup>
          )}
          {shared.length > 0 && (
            <optgroup label="Shared with the team">
              {shared.map((f) => (
                <option key={f.id} value={`s:${f.id}`}>{f.name}</option>
              ))}
            </optgroup>
          )}
        </select>

        {mode === "jql" && (
          <div className="filter-actions">
            {ownsActive && dirty && compiled.ok && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={saveChanges}>Save changes</button>
            )}
            {text.trim() && compiled.ok && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSaving(true)}>Save as…</button>
            )}
            {canDeleteActive && (
              <button type="button" className="btn-icon btn-sm issue-delete-btn" aria-label={`Delete filter ${active.name}`} onClick={remove}>
                <Icon name="trash" size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {mode === "jql" && (
        <p id="jql-hint" className={`jql-hint ${compiled.ok ? "" : "is-error"}`} role={compiled.ok ? undefined : "alert"}>
          {!compiled.ok
            ? compiled.error
            : compiled.empty
              ? "Fields: assignee, reporter, status, statusCategory, priority, type, labels, sprint, fixVersion, epic, flagged, text, summary, key, created, updated, due, resolved, points."
              : `${matchCount} ${matchCount === 1 ? "issue matches" : "issues match"}`}
        </p>
      )}

      {saving && (
        <SaveFilterModal
          initialName={active && !ownsActive ? `${active.name.slice(0, 53)} (copy)` : ""}
          onClose={() => setSaving(false)}
          onSave={async ({ name, shared: isShared }) => {
            const result = await board.createFilter({ name, query: text.trim(), shared: isShared });
            if (!result.error && result.data) setActiveId(`s:${result.data.id}`);
            return result;
          }}
        />
      )}
    </div>
  );
}
