"use client";

import { useId, useState } from "react";
import Icon from "@/components/Icon";
import { CATEGORIES } from "@/lib/taskWorkflow";

// Canvas geometry: statuses sit in board order on one row; a transition to the right
// arcs above it, one back to the left arcs below, as in Jira's workflow diagram.
const NODE_W = 150;
const NODE_H = 52;
const STEP = 196;
const PAD_LEFT = 120;
const PAD_RIGHT = 40;
const CREATE_X = 44;

const arcHeight = (distance) => Math.min(30 + 26 * (distance - 1), 170);

function transitionsOf(rows) {
  const keys = new Set(rows.map((r) => r.value));
  const out = [];
  rows.forEach((r, i) => {
    if (!r.next) return;
    for (const to of r.next) {
      const j = rows.findIndex((x) => x.value === to);
      if (j >= 0 && j !== i && keys.has(to)) out.push({ from: r.value, to, i, j });
    }
  });
  return out;
}

function arcPath(x1, x2, yTop, yBottom, forward, height) {
  if (forward) {
    const sx = x1 + 12;
    const ex = x2 - 12;
    return `M ${sx} ${yTop} C ${sx} ${yTop - height}, ${ex} ${yTop - height}, ${ex} ${yTop - 2}`;
  }
  const sx = x1 - 12;
  const ex = x2 + 12;
  return `M ${sx} ${yBottom} C ${sx} ${yBottom + height}, ${ex} ${yBottom + height}, ${ex} ${yBottom + 2}`;
}

function CategoryPicker({ value, onChange, name }) {
  return (
    <div className="wf-category-picker" role="radiogroup" aria-label="Status category">
      {CATEGORIES.map((c) => (
        <button
          key={c.value}
          type="button"
          role="radio"
          name={name}
          aria-checked={value === c.value}
          className={`wf-category wf-cat-${c.value} ${value === c.value ? "is-active" : ""}`}
          onClick={() => onChange(c.value)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

function Lozenge({ row }) {
  return <span className={`wf-lozenge wf-cat-${row.category}`}>{row.label || "Unnamed"}</span>;
}

function StatusPanel({ row, index, rows, usage, limit, startKey, editor }) {
  const others = rows.filter((r) => r._k !== row._k);
  const targets = (row.next || []).filter((v) => others.some((o) => o.value === v));
  const count = row._new ? 0 : usage(row.value);

  const restrict = () => {
    const neighbour = rows[index + 1] || rows[index - 1];
    editor.updateRow(row._k, { next: neighbour ? [neighbour.value] : null });
  };

  return (
    <div className="wf-panel-body">
      <div className="wf-panel-head">
        <span className="eyebrow">Status</span>
        <Lozenge row={row} />
      </div>

      <label className="wf-field">
        <span>Name</span>
        <input value={row.label} maxLength={40} onChange={(e) => editor.updateRow(row._k, { label: e.target.value })} />
      </label>

      <div className="wf-field">
        <span>Category</span>
        <CategoryPicker value={row.category} name={`cat-${row._k}`} onChange={(category) => editor.updateRow(row._k, { category })} />
        <small>
          {row.category === "todo" && "Not started yet. The first To Do status is where new issues land."}
          {row.category === "progress" && "Work has started. Counts toward cycle time."}
          {row.category === "done" && "Finished: counts for sprint points, burndown and releases."}
        </small>
      </div>

      <div className="wf-field">
        <span>Issues here can move to</span>
        <div className="wf-radio-row">
          <label>
            <input type="radio" checked={!row.next} onChange={() => editor.updateRow(row._k, { next: null })} /> Any status
          </label>
          <label>
            <input type="radio" checked={Boolean(row.next)} onChange={restrict} disabled={!others.length} /> Only these
          </label>
        </div>
        {row.next && (
          <div className="wf-targets">
            {others.map((o) => {
              const checked = targets.includes(o.value);
              const last = checked && targets.length === 1;
              return (
                <label key={o._k} className="wf-target" title={last ? "A status needs at least one way out" : undefined}>
                  <input type="checkbox" checked={checked} disabled={last} onChange={() => editor.toggleNext(row._k, o.value)} />
                  <Lozenge row={o} />
                </label>
              );
            })}
          </div>
        )}
      </div>

      {row.category !== "done" && (
        <label className="wf-field">
          <span>Column WIP limit</span>
          <input
            type="number"
            min="1"
            step="1"
            inputMode="numeric"
            placeholder="No limit"
            value={limit ?? ""}
            onChange={(e) => editor.setLimit(row.value, e.target.value)}
          />
        </label>
      )}

      <div className="wf-field">
        <span>Board position</span>
        <div className="wf-position">
          <button type="button" className="btn btn-secondary btn-sm" disabled={index === 0} onClick={() => editor.moveRow(row._k, -1)}>
            <Icon name="chevron-left" size={14} /> Left
          </button>
          <span className="mono">
            {index + 1} of {rows.length}
          </span>
          <button type="button" className="btn btn-secondary btn-sm" disabled={index === rows.length - 1} onClick={() => editor.moveRow(row._k, 1)}>
            Right <Icon name="chevron-right" size={14} />
          </button>
        </div>
      </div>

      <div className="wf-panel-foot">
        <span className="wf-usage">
          {row._new ? "New status" : `${count} ${count === 1 ? "issue" : "issues"}`}
          {row.value === startKey && " · new issues start here"}
        </span>
        <button type="button" className="btn btn-ghost btn-sm wf-delete" onClick={() => editor.removeRow(row._k)}>
          <Icon name="trash" size={14} /> Delete status
        </button>
      </div>
    </div>
  );
}

function TransitionPanel({ transition, rows, editor, onSelectStatus }) {
  const from = rows.find((r) => r.value === transition.from);
  const to = rows.find((r) => r.value === transition.to);
  if (!from || !to) return null;
  const ways = (from.next || []).filter((v) => rows.some((r) => r.value === v));
  const last = ways.length <= 1;
  return (
    <div className="wf-panel-body">
      <div className="wf-panel-head">
        <span className="eyebrow">Transition</span>
      </div>
      <div className="wf-transition-line">
        <button type="button" className="wf-link" onClick={() => onSelectStatus(from._k)}><Lozenge row={from} /></button>
        <Icon name="arrow-right" size={16} />
        <button type="button" className="wf-link" onClick={() => onSelectStatus(to._k)}><Lozenge row={to} /></button>
      </div>
      <p className="wf-panel-text">
        Issues in <strong>{from.label}</strong> can move to <strong>{to.label}</strong>, on the board and in the issue view.
      </p>
      <div className="wf-panel-foot">
        <span className="wf-usage">{last ? `The only way out of ${from.label}` : ""}</span>
        <button
          type="button"
          className="btn btn-ghost btn-sm wf-delete"
          disabled={last}
          title={last ? "Add another transition first, or allow any status" : undefined}
          onClick={() => {
            editor.toggleNext(from._k, to.value);
            onSelectStatus(from._k);
          }}
        >
          <Icon name="trash" size={14} /> Remove transition
        </button>
      </div>
    </div>
  );
}

// Jira's workflow editor, for one project: the diagram on the left, the selected status
// or transition on the right. The rows and their edits live in TaskBoardSettings.
export default function TaskWorkflowEditor({ rows, limits, usage, editor, selected, onSelect }) {
  const markerId = useId().replace(/:/g, "");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("progress");

  const transitions = transitionsOf(rows);
  const startIndex = Math.max(0, rows.findIndex((r) => r.category === "todo"));
  const startKey = rows[startIndex]?.value;

  const up = transitions.filter((t) => t.j > t.i);
  const down = transitions.filter((t) => t.j < t.i);
  const startArc = startIndex > 0 ? arcHeight(startIndex + 1) : 0;
  const maxUp = Math.max(startArc, ...up.map((t) => arcHeight(t.j - t.i)), 0);
  const maxDown = Math.max(...down.map((t) => arcHeight(t.i - t.j)), 0);
  const nodeTop = Math.max(maxUp * 0.78 + 28, 36);
  const nodeBottom = nodeTop + NODE_H;
  const height = nodeBottom + Math.max(maxDown * 0.78 + 28, 36);
  const width = PAD_LEFT + Math.max(rows.length - 1, 0) * STEP + NODE_W + PAD_RIGHT;
  const centerX = (i) => PAD_LEFT + i * STEP + NODE_W / 2;
  const midY = nodeTop + NODE_H / 2;

  const selectedRow = selected?.kind === "status" ? rows.find((r) => r._k === selected.key) : null;
  const selectedIndex = selectedRow ? rows.indexOf(selectedRow) : -1;
  const isSelectedTransition = (t) => selected?.kind === "transition" && selected.from === t.from && selected.to === t.to;

  const add = () => {
    const label = newName.trim();
    if (!label) return;
    const key = editor.addRow(label, newCategory);
    onSelect({ kind: "status", key });
    setNewName("");
    setAdding(false);
  };

  const outSummary = (r) => {
    if (!r.next) return "→ any status";
    const n = r.next.filter((v) => rows.some((x) => x.value === v)).length;
    return `→ ${n} ${n === 1 ? "status" : "statuses"}`;
  };

  const transitionProps = (t) => ({
    role: "button",
    tabIndex: 0,
    "aria-label": `Transition ${rows[t.i].label} to ${rows[t.j].label}`,
    onClick: (e) => {
      e.stopPropagation();
      onSelect({ kind: "transition", from: t.from, to: t.to });
    },
    onKeyDown: (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect({ kind: "transition", from: t.from, to: t.to });
      }
    },
  });

  return (
    <div className="wf-editor">
      <div className="wf-toolbar">
        {adding ? (
          <div className="wf-add">
            <input
              autoFocus
              placeholder="Status name, e.g. In QA"
              value={newName}
              maxLength={40}
              aria-label="New status name"
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add();
                } else if (e.key === "Escape") {
                  e.stopPropagation();
                  setAdding(false);
                }
              }}
            />
            <select aria-label="New status category" value={newCategory} onChange={(e) => setNewCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={!newName.trim()}>Add</button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)}>Cancel</button>
          </div>
        ) : (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
            <Icon name="plus" size={14} strokeWidth={2.2} /> Add status
          </button>
        )}
        <div className="wf-legend" aria-hidden="true">
          {CATEGORIES.map((c) => (
            <span key={c.value} className={`wf-legend-item wf-cat-${c.value}`}>{c.label}</span>
          ))}
        </div>
      </div>

      <div className="wf-body">
        <div className="wf-canvas" onClick={() => onSelect(null)}>
          <div className="wf-stage" style={{ width, height }}>
            <svg className="wf-arcs" width={width} height={height} aria-hidden={false} role="group" aria-label="Transitions">
              <defs>
                <marker id={`${markerId}-a`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" className="wf-arrowhead" />
                </marker>
                <marker id={`${markerId}-s`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M 0 0 L 10 5 L 0 10 z" className="wf-arrowhead is-selected" />
                </marker>
              </defs>

              {/* Create: where a new issue enters the workflow. */}
              <circle cx={CREATE_X} cy={midY} r="9" className="wf-create-dot" />
              <text x={CREATE_X} y={midY + 28} textAnchor="middle" className="wf-create-label">Create</text>
              {rows.length > 0 &&
                (startIndex === 0 ? (
                  <path d={`M ${CREATE_X + 11} ${midY} L ${PAD_LEFT - 4} ${midY}`} className="wf-arc wf-arc-start" markerEnd={`url(#${markerId}-a)`} />
                ) : (
                  <path
                    d={`M ${CREATE_X} ${midY - 11} C ${CREATE_X} ${nodeTop - startArc}, ${centerX(startIndex)} ${nodeTop - startArc}, ${centerX(startIndex)} ${nodeTop - 2}`}
                    className="wf-arc wf-arc-start"
                    markerEnd={`url(#${markerId}-a)`}
                  />
                ))}

              {transitions.map((t) => {
                const forward = t.j > t.i;
                const d = arcPath(centerX(t.i), centerX(t.j), nodeTop, nodeBottom, forward, arcHeight(Math.abs(t.j - t.i)));
                const active = isSelectedTransition(t);
                return (
                  <g key={`${t.from}>${t.to}`} className={`wf-transition ${active ? "is-selected" : ""}`} {...transitionProps(t)}>
                    <path d={d} className="wf-arc-hit" />
                    <path d={d} className="wf-arc" markerEnd={`url(#${markerId}-${active ? "s" : "a"})`} />
                  </g>
                );
              })}
            </svg>

            {rows.map((r, i) => (
              <button
                key={r._k}
                type="button"
                className={`wf-node wf-cat-${r.category} ${selected?.kind === "status" && selected.key === r._k ? "is-selected" : ""}`}
                style={{ left: PAD_LEFT + i * STEP, top: nodeTop, width: NODE_W, height: NODE_H }}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect({ kind: "status", key: r._k });
                }}
              >
                <span className="wf-node-name">{r.label || "Unnamed"}</span>
                <span className={`wf-node-out ${r.next ? "is-limited" : ""}`}>{outSummary(r)}</span>
              </button>
            ))}
          </div>
        </div>

        <aside className="wf-panel" aria-live="polite">
          {selectedRow ? (
            <StatusPanel
              key={selectedRow._k}
              row={selectedRow}
              index={selectedIndex}
              rows={rows}
              usage={usage}
              limit={limits[selectedRow.value]}
              startKey={startKey}
              editor={editor}
            />
          ) : selected?.kind === "transition" ? (
            <TransitionPanel transition={selected} rows={rows} editor={editor} onSelectStatus={(key) => onSelect({ kind: "status", key })} />
          ) : (
            <div className="wf-panel-empty">
              <Icon name="sliders" size={20} />
              <p>Select a status to rename it, change its category, or choose where its issues can go next.</p>
              <p>Select an arrow to see or remove a transition. Arrows above go forward on the board, arrows below go back.</p>
              <p className="wf-panel-hint">A status marked &ldquo;→ any status&rdquo; lets its issues move anywhere.</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
