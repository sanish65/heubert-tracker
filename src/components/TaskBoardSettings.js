"use client";

import { useState } from "react";
import { useApp } from "@/context/AppContext";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import TaskWorkflowEditor from "@/components/TaskWorkflowEditor";
import { normalizeWipLimits } from "@/lib/taskExtras";
import { statusKeyFor, validateWorkflow } from "@/lib/taskWorkflow";

let rowSeed = 0;
const rowKey = () => `wf-${++rowSeed}`;

const TABS = [
  { value: "workflow", label: "Workflow" },
  { value: "board", label: "Board" },
];

// Admins set up a project's board: its workflow (the statuses that are its columns, each
// in a To Do, In Progress or Done category, and which status may move to which), a WIP
// limit for each column that isn't Done, and Scrum or Kanban.
export default function TaskBoardSettings({ project, workflow, tasks, board, onClose }) {
  const { setProjectBoardSettings } = useApp();
  const [tab, setTab] = useState("workflow");
  const [mode, setMode] = useState(project.board_mode === "kanban" ? "kanban" : "scrum");
  const [rows, setRows] = useState(() => workflow.map((s) => ({ ...s, _k: rowKey() })));
  const [selected, setSelected] = useState(null);
  const [moves, setMoves] = useState({});
  const [limits, setLimits] = useState(() => {
    const current = project.wip_limits || {};
    return Object.fromEntries(workflow.map((s) => [s.value, current[s.value] ? String(current[s.value]) : ""]));
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // Without the workflows migration there's no table to save statuses in yet.
  const ready = board.workflowReady !== false;

  const usage = (key) => tasks.filter((t) => t.status === key).length;
  const removed = workflow.filter((s) => !rows.some((r) => r.value === s.value && !r._new));
  const removedInUse = removed.filter((s) => usage(s.value) > 0);

  const edit = (fn) => {
    setRows(fn);
    setError("");
  };

  const editor = {
    updateRow: (k, patch) => edit((prev) => prev.map((r) => (r._k === k ? { ...r, ...patch } : r))),
    moveRow: (k, by) =>
      edit((prev) => {
        const i = prev.findIndex((r) => r._k === k);
        const j = i + by;
        if (j < 0 || j >= prev.length) return prev;
        const next = [...prev];
        [next[i], next[j]] = [next[j], next[i]];
        return next;
      }),
    removeRow: (k) => {
      edit((prev) => prev.filter((r) => r._k !== k));
      setSelected(null);
    },
    addRow: (label, category) => {
      const taken = [...workflow.map((s) => s.value), ...rows.map((r) => r.value)];
      const value = statusKeyFor(label, taken);
      const k = rowKey();
      edit((prev) => [...prev, { value, label, category, next: null, _k: k, _new: true }]);
      setLimits((prev) => ({ ...prev, [value]: "" }));
      return k;
    },
    // A status's `next`: null for "any status", else the keys its issues may move to.
    // The last target can't be removed, so no status becomes a dead end.
    toggleNext: (k, target) =>
      edit((prev) =>
        prev.map((r) => {
          if (r._k !== k || !r.next) return r;
          const live = r.next.filter((v) => prev.some((x) => x.value === v && x._k !== k));
          const next = live.includes(target) ? live.filter((v) => v !== target) : [...live, target];
          return next.length ? { ...r, next } : r;
        })
      ),
    setLimit: (key, value) => {
      setLimits((p) => ({ ...p, [key]: value }));
      setError("");
    },
  };

  const save = async (e) => {
    e.preventDefault();
    if (busy) return;
    const problem = validateWorkflow(rows);
    if (problem) {
      setTab("workflow");
      return setError(problem);
    }
    const openKeys = rows.filter((r) => r.category !== "done").map((r) => r.value);
    const bad = openKeys.find((k) => limits[k] && !(Number.isInteger(Number(limits[k])) && Number(limits[k]) > 0));
    if (bad) {
      setTab("workflow");
      setSelected({ kind: "status", key: rows.find((r) => r.value === bad)._k });
      return setError(`${rows.find((r) => r.value === bad).label}: a WIP limit is a whole number above 0, or empty for none`);
    }
    for (const s of removedInUse) {
      // The target has to stay in the workflow (it may have been deleted since).
      if (!rows.some((r) => r.value === moves[s.value])) {
        setTab("workflow");
        return setError(`Choose where the issues in "${s.label}" go`);
      }
    }

    const shape = (list) => JSON.stringify(list.map((r) => [r.value, r.label, r.category, r.next ?? null]));
    if (!ready && shape(rows) !== shape(workflow)) {
      return setError("Workflow changes need the database update first (see the note above). Undo them, or apply it and try again.");
    }

    setBusy(true);
    if (ready) {
      const { error: wfError } = await board.saveWorkflow(
        rows.map(({ _k, _new, ...r }) => r),
        Object.fromEntries(removedInUse.map((s) => [s.value, moves[s.value]]))
      );
      if (wfError) {
        setBusy(false);
        return setError(wfError.message || "Couldn't save the workflow");
      }
    }
    const { error: dbError } = await setProjectBoardSettings(project.id, {
      boardMode: mode,
      wipLimits: normalizeWipLimits(limits, openKeys),
    });
    setBusy(false);
    if (dbError) return setError(dbError.message || "Something went wrong");
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose} size="modal-content-workflow">
      <div className="modal-header">
        <h2>Board settings · {project.name}</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
      <form onSubmit={save} className="wf-form">
        <div className="status-tabs" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              className={`tab ${tab === t.value ? "tab-active" : ""}`}
              onClick={() => setTab(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "workflow" ? (
          <>
            {!ready && (
              <p className="wf-notice">
                Custom workflows need the latest database update. Run <code>npm run db:push</code> (or the &quot;Apply migrations to
                production&quot; step in Bitbucket); until then this board keeps the four standard statuses and only the Board tab saves.
              </p>
            )}
            <TaskWorkflowEditor rows={rows} limits={limits} usage={usage} editor={editor} selected={selected} onSelect={setSelected} />
            {removedInUse.map((s) => (
              <div key={s.value} className="workflow-move">
                <span>
                  Deleting <strong>{s.label}</strong>: move its {usage(s.value)} {usage(s.value) === 1 ? "issue" : "issues"} to
                </span>
                <select value={rows.some((r) => r.value === moves[s.value]) ? moves[s.value] : ""} onChange={(e) => setMoves((p) => ({ ...p, [s.value]: e.target.value }))}>
                  <option value="" disabled>Choose…</option>
                  {rows.map((r) => (
                    <option key={r._k} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </>
        ) : (
          <div className="form-group-interactive">
            <label>Board type</label>
            <div className="board-mode-choices" role="radiogroup" aria-label="Board type">
              {[
                { value: "scrum", title: "Scrum", text: "Plan work in sprints. The board shows the active sprint; reports show burndown and velocity." },
                { value: "kanban", title: "Kanban", text: "Continuous flow, no sprints. The board shows every open issue; reports show throughput and cycle time." },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === opt.value}
                  className={`board-mode-choice glass ${mode === opt.value ? "is-active" : ""}`}
                  onClick={() => setMode(opt.value)}
                >
                  <strong>{opt.title}</strong>
                  <span>{opt.text}</span>
                </button>
              ))}
            </div>
            {mode === "kanban" && project.board_mode !== "kanban" && (
              <p className="sprint-modal-note">Sprints stay saved. Switching back to Scrum brings them back as they were.</p>
            )}
            <p className="sprint-modal-note">Columns and their WIP limits come from the workflow: select a status in the Workflow tab.</p>
          </div>
        )}

        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Saving..." : "Save changes"}</button>
        </div>
      </form>
    </Modal>
  );
}
