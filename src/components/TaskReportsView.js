"use client";

import { useMemo, useState } from "react";
import {
  activeSprintOf,
  boardIssues,
  burndownSeries,
  velocitySeries,
  sumPoints,
  countsTowardPoints,
  daysBetween,
} from "@/lib/taskBoard";
import { isDone, isInProgress } from "@/lib/taskWorkflow";
import { flowStats, formatDuration } from "@/lib/taskExtras";
import { formatShortDate } from "@/components/TaskBits";
import { getNepalDateStr } from "@/lib/attendanceTime";

const W = 640;
const H = 260;
const PAD = { l: 40, r: 84, t: 16, b: 32 };

function niceTicks(max, count = 4) {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) || raw;
  const ticks = [];
  for (let v = 0; v <= max + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return ticks;
}

// Bars grow from the baseline with a 4px rounded data end and a square foot.
function roundedTopBar(x, y, w, h, r = 4) {
  if (h <= 0) return "";
  const rr = Math.min(r, w / 2, h);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

function BurndownChart({ series, today }) {
  const [hover, setHover] = useState(null);
  const ticks = niceTicks(Math.max(1, ...series.map((d) => Math.max(d.ideal, d.remaining ?? 0))));
  const maxY = ticks[ticks.length - 1] || 1;
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const x = (i) => PAD.l + (series.length <= 1 ? innerW / 2 : (i * innerW) / (series.length - 1));
  const y = (v) => PAD.t + (1 - v / maxY) * innerH;

  const idealPath = series.map((d, i) => `${i ? "L" : "M"}${x(i)},${y(d.ideal)}`).join("");
  const actual = series.map((d, i) => ({ ...d, i })).filter((d) => d.remaining != null);
  const actualPath = actual.map((d, j) => `${j ? "L" : "M"}${x(d.i)},${y(d.remaining)}`).join("");
  const last = actual[actual.length - 1];
  const labelEvery = Math.max(1, Math.ceil(series.length / 6));
  const band = series.length > 1 ? innerW / (series.length - 1) : innerW;
  const hovered = hover != null ? series[hover] : null;

  return (
    <div className="viz-chart">
      <div className="viz-legend">
        <span className="viz-legend-item"><span className="viz-key viz-key-line series-1" /> Remaining points</span>
        <span className="viz-legend-item"><span className="viz-key viz-key-line viz-key-reference" /> Ideal</span>
      </div>
      <div className="viz-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Sprint burndown: remaining story points per day against the ideal line">
          {ticks.map((t) => (
            <g key={t}>
              <line className="viz-grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
              <text className="viz-axis-text" x={PAD.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">{t}</text>
            </g>
          ))}
          {series.map((d, i) =>
            i % labelEvery === 0 || i === series.length - 1 ? (
              <text key={d.date} className="viz-axis-text" x={x(i)} y={H - 10} textAnchor="middle">
                {formatShortDate(d.date)}
              </text>
            ) : null
          )}
          <path className="viz-line-reference" d={idealPath} />
          {actualPath && <path className="viz-line series-1" d={actualPath} />}
          {actual.map((d) => (
            <circle key={d.date} className="viz-dot series-1" cx={x(d.i)} cy={y(d.remaining)} r={4} />
          ))}
          {last && (
            <text className="viz-direct-label" x={x(last.i) + 10} y={y(last.remaining)} dominantBaseline="middle">
              {last.remaining} left
            </text>
          )}
          {series.length > 0 && (
            <text className="viz-direct-label viz-direct-label-muted" x={x(series.length - 1) + 10} y={y(0)} dominantBaseline="middle">
              Ideal
            </text>
          )}
          {hovered && <line className="viz-crosshair" x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={H - PAD.b} />}
          {series.map((d, i) => (
            <rect
              key={`hit-${d.date}`}
              className="viz-hit"
              x={x(i) - band / 2}
              y={PAD.t}
              width={band}
              height={innerH}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            />
          ))}
        </svg>
        {hovered && (
          <div className="viz-tooltip" style={{ left: `${(x(hover) / W) * 100}%` }}>
            <strong>{formatShortDate(hovered.date)}{hovered.date === today ? " (today)" : ""}</strong>
            <span><span className="viz-key viz-key-dot series-1" /> Remaining {hovered.remaining ?? "—"}</span>
            <span><span className="viz-key viz-key-dot viz-key-reference" /> Ideal {hovered.ideal}</span>
          </div>
        )}
      </div>
      <details className="viz-table-toggle">
        <summary>View as table</summary>
        <table className="data-table viz-table">
          <thead>
            <tr><th>Date</th><th>Remaining</th><th>Ideal</th></tr>
          </thead>
          <tbody>
            {series.map((d) => (
              <tr key={d.date}>
                <td>{formatShortDate(d.date)}</td>
                <td>{d.remaining ?? "—"}</td>
                <td>{d.ideal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function VelocityChart({ data }) {
  const [hover, setHover] = useState(null);
  const ticks = niceTicks(Math.max(1, ...data.flatMap((d) => [d.committed, d.completed])));
  const maxY = ticks[ticks.length - 1] || 1;
  const innerW = W - PAD.l - 24;
  const innerH = H - PAD.t - PAD.b;
  const slot = innerW / Math.max(data.length, 1);
  const barW = Math.min(24, (slot - 16) / 2);
  const y = (v) => PAD.t + (1 - v / maxY) * innerH;
  const groupX = (i) => PAD.l + i * slot + slot / 2;
  const hovered = hover != null ? data[hover] : null;

  return (
    <div className="viz-chart">
      <div className="viz-legend">
        <span className="viz-legend-item"><span className="viz-key viz-key-bar series-1" /> Committed</span>
        <span className="viz-legend-item"><span className="viz-key viz-key-bar series-2" /> Completed</span>
      </div>
      <div className="viz-plot">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Velocity: story points committed and completed per sprint">
          {ticks.map((t) => (
            <g key={t}>
              <line className="viz-grid" x1={PAD.l} x2={W - 24} y1={y(t)} y2={y(t)} />
              <text className="viz-axis-text" x={PAD.l - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">{t}</text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = groupX(i);
            // A 2px surface gap between the pair, so the two fills never touch.
            const committedX = cx - barW - 1;
            const completedX = cx + 1;
            return (
              <g key={d.id} className={hover != null && hover !== i ? "viz-dim" : ""}>
                <path className="viz-bar series-1" d={roundedTopBar(committedX, y(d.committed), barW, y(0) - y(d.committed))} />
                <path className="viz-bar series-2" d={roundedTopBar(completedX, y(d.completed), barW, y(0) - y(d.completed))} />
                <text className="viz-axis-text" x={cx} y={H - 10} textAnchor="middle">
                  {d.name.length > 14 ? `${d.name.slice(0, 13)}…` : d.name}
                </text>
                <rect
                  className="viz-hit"
                  x={cx - slot / 2}
                  y={PAD.t}
                  width={slot}
                  height={innerH + 4}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
          <line className="viz-baseline" x1={PAD.l} x2={W - 24} y1={y(0)} y2={y(0)} />
        </svg>
        {hovered && (
          <div className="viz-tooltip" style={{ left: `${(groupX(hover) / W) * 100}%` }}>
            <strong>{hovered.name}</strong>
            <span><span className="viz-key viz-key-dot series-1" /> Committed {hovered.committed}</span>
            <span><span className="viz-key viz-key-dot series-2" /> Completed {hovered.completed}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Kanban boards have no sprints, so their report is flow: how much finishes and how long
// it takes, over the last week and month, plus the time logged on the project.
function FlowReport({ tasks }) {
  // Read once per mount: "the last 7 days" doesn't need to tick while the report is open.
  const [now] = useState(() => Date.now());
  const week = flowStats(tasks, now, 7);
  const month = flowStats(tasks, now, 30);
  const inProgress = tasks.filter((t) => t.type !== "epic" && isInProgress(t)).length;
  const logged = tasks.reduce((sum, t) => sum + (Number(t.time_spent_min) || 0), 0);
  return (
    <section className="reports-card glass-card">
      <div className="reports-card-head">
        <h3 className="section-title">Flow</h3>
        <span className="reports-card-sub">Kanban board</span>
      </div>
      <div className="reports-stats">
        <div className="reports-stat"><strong>{week.throughput}</strong><span>done in the last 7 days</span></div>
        <div className="reports-stat"><strong>{month.throughput}</strong><span>done in the last 30 days</span></div>
        <div className="reports-stat">
          <strong>{month.avgCycleDays == null ? "—" : `${month.avgCycleDays} d`}</strong>
          <span>average time from created to done</span>
        </div>
        <div className="reports-stat"><strong>{inProgress}</strong><span>in progress or review now</span></div>
        <div className="reports-stat"><strong>{logged ? formatDuration(logged) : "—"}</strong><span>time logged on this project</span></div>
      </div>
    </section>
  );
}

export default function TaskReportsView({ tasks, sprints, today, boardMode = "scrum" }) {
  const sprint = activeSprintOf(sprints);
  const sprintIssues = useMemo(() => boardIssues(tasks, sprint?.id ?? null), [tasks, sprint]);
  // completed_at is a UTC timestamp; the chart's days are Nepal days, so work done
  // before 05:45 local time must not count as the day before.
  const series = useMemo(() => {
    if (!sprint) return [];
    const local = sprintIssues.map((t) => (t.completed_at ? { ...t, completed_at: getNepalDateStr(new Date(t.completed_at)) } : t));
    return burndownSeries(sprint, local, today);
  }, [sprint, sprintIssues, today]);
  const velocity = useMemo(() => velocitySeries(sprints), [sprints]);
  const closed = useMemo(
    () => sprints.filter((s) => s.state === "closed").sort((a, b) => Date.parse(b.completed_at || 0) - Date.parse(a.completed_at || 0)),
    [sprints]
  );

  const standard = sprintIssues.filter(countsTowardPoints);
  const totalPoints = sumPoints(standard);
  const donePoints = sumPoints(standard.filter((t) => isDone(t)));
  const doneCount = standard.filter((t) => isDone(t)).length;
  const daysLeft = sprint?.end_date ? daysBetween(today, sprint.end_date) : null;
  const averageVelocity = velocity.length ? Math.round(velocity.reduce((s, v) => s + v.completed, 0) / velocity.length) : null;

  if (boardMode === "kanban") {
    return (
      <div className="reports-view">
        <FlowReport tasks={tasks} />
      </div>
    );
  }

  return (
    <div className="reports-view">
      <section className="reports-card glass-card">
        <div className="reports-card-head">
          <h3 className="section-title">Sprint burndown</h3>
          {sprint && <span className="reports-card-sub">{sprint.name}</span>}
        </div>
        {sprint ? (
          <>
            <div className="reports-stats">
              <div className="reports-stat"><strong>{totalPoints}</strong><span>points in sprint</span></div>
              <div className="reports-stat"><strong>{donePoints}</strong><span>points done</span></div>
              <div className="reports-stat"><strong>{doneCount}/{standard.length}</strong><span>issues done</span></div>
              <div className="reports-stat">
                <strong>{daysLeft == null ? "—" : Math.max(daysLeft, 0)}</strong>
                <span>{daysLeft != null && daysLeft < 0 ? "days left (overdue)" : "days left"}</span>
              </div>
            </div>
            {totalPoints === 0 ? (
              <p className="tasks-muted-center">Add story points to this sprint&apos;s issues to see the burndown.</p>
            ) : (
              <BurndownChart series={series} today={today} />
            )}
          </>
        ) : (
          <p className="tasks-muted-center">No active sprint. Start one from the backlog.</p>
        )}
      </section>

      <section className="reports-card glass-card">
        <div className="reports-card-head">
          <h3 className="section-title">Velocity</h3>
          {averageVelocity != null && <span className="reports-card-sub">Average {averageVelocity} points per sprint</span>}
        </div>
        {velocity.length === 0 ? (
          <p className="tasks-muted-center">Velocity appears once the first sprint is completed.</p>
        ) : (
          <VelocityChart data={velocity} />
        )}
      </section>

      {closed.length > 0 && (
        <section className="reports-card glass-card">
          <div className="reports-card-head">
            <h3 className="section-title">Sprint reports</h3>
          </div>
          <table className="data-table viz-table">
            <thead>
              <tr>
                <th>Sprint</th>
                <th>Dates</th>
                <th>Committed</th>
                <th>Completed</th>
                <th>Done</th>
              </tr>
            </thead>
            <tbody>
              {closed.map((s) => {
                const committed = Number(s.committed_points) || 0;
                const completed = Number(s.completed_points) || 0;
                return (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{formatShortDate(s.start_date)} – {formatShortDate(s.end_date)}</td>
                    <td>{committed}</td>
                    <td>{completed}</td>
                    <td>{committed ? `${Math.round((completed / committed) * 100)}%` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
