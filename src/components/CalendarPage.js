"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import Avatar from "@/components/Avatar";
import Icon from "@/components/Icon";
import { getNepalDateStr } from "@/lib/attendanceTime";
import { useTeamCalendar } from "@/lib/useTeamCalendar";
import {
  DAY_START,
  DAY_END,
  EVENT_KINDS,
  addDays,
  workWeekOf,
  isWeekend,
  nepalParts,
  formatHour,
  leaveOn,
  leaveHours,
  dayBlocks,
  allDayOn,
  statusAt,
  dailySeries,
  weekCell,
  findFreeSlots,
  googleEventLink,
} from "@/lib/teamCalendar";

const VIEW_KEY = "heubert-calendar-view";
const BUSY_KEY = "heubert-calendar-busy-only";
const HOURS = Array.from({ length: DAY_END - DAY_START }, (_, i) => DAY_START + i);
const DURATIONS = [30, 45, 60];

function readStored(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

const nowHourNepal = () => nepalParts(new Date().toISOString())?.hour ?? 0;

// Weekends have no working hours to show, so a weekend lands on the next Monday.
function workingDayFrom(dateStr, direction = 1) {
  let d = dateStr;
  while (isWeekend(d)) d = addDays(d, direction);
  return d;
}

function formatDay(dateStr, opts = { weekday: "long", month: "short", day: "numeric" }) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

function timeAgo(iso) {
  if (!iso) return "";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} h ago`;
}

function inLabel(fromHour, nowHour) {
  const mins = Math.max(Math.round((fromHour - nowHour) * 60), 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `in ${h}h ${m}m` : `in ${m}m`;
}

function SetupNotice({ isAdmin, setupError }) {
  if (setupError) {
    return (
      <div className="cal-notice cal-notice-error" role="alert">
        <Icon name="alert" />
        <div>
          <strong>Google Calendar rejected the connection.</strong>
          <p>{setupError}</p>
          <p>Check the service account&apos;s domain-wide delegation and scope (docs/team-calendar/setup.md).</p>
        </div>
      </div>
    );
  }
  return (
    <div className="cal-notice" role="status">
      <Icon name="calendar" />
      <div>
        <strong>Google Calendar isn&apos;t connected yet.</strong>
        {isAdmin ? (
          <p>
            A Google Workspace admin grants the tracker read-only access once; then everyone&apos;s meetings appear here.
            The steps are in <code>docs/team-calendar/setup.md</code>. Until then this shows leaves and holidays only.
          </p>
        ) : (
          <p>Ask an admin to connect it. Until then this shows leaves and holidays only.</p>
        )}
      </div>
    </div>
  );
}

function Block({ block, label }) {
  const kind = EVENT_KINDS[block.kind] || EVENT_KINDS.team;
  const tone = label === "Busy" ? "gray" : kind.tone;
  return (
    <div
      className={`cal-block tone-${tone}`}
      style={{ left: `${block.leftPct}%`, width: `calc(${block.widthPct}% - 4px)` }}
      title={`${label} · ${block.timeLabel}`}
    >
      <span className="cal-block-title">{label}</span>
      <span className="cal-block-time">{block.timeLabel}</span>
    </div>
  );
}

export default function CalendarPage() {
  const { employees, leaves, publicHolidays, currentEmployee, isAdmin, projects, projectMembers } = useApp();
  const today = getNepalDateStr(new Date());

  const [view, setViewState] = useState(() => (readStored(VIEW_KEY, "day") === "week" ? "week" : "day"));
  const [busyOnly, setBusyOnly] = useState(() => readStored(BUSY_KEY, "false") === "true");
  const [date, setDate] = useState(() => workingDayFrom(today));
  const [team, setTeam] = useState("all");
  const [nowHour, setNowHour] = useState(nowHourNepal);
  const [picked, setPicked] = useState(() => (currentEmployee ? [currentEmployee.id] : []));
  const [duration, setDuration] = useState(30);

  // The "now" line and statuses move with the clock.
  useEffect(() => {
    const timer = setInterval(() => setNowHour(nowHourNepal()), 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  // One fetch per work week; the day view is a slice of it, and Find a time reads it too.
  const week = workWeekOf(date);
  const cal = useTeamCalendar(week[0], addDays(week[0], 7));

  const setView = (value) => {
    setViewState(value);
    writeStored(VIEW_KEY, value);
  };

  const toggleBusy = () => {
    setBusyOnly((prev) => {
      writeStored(BUSY_KEY, String(!prev));
      return !prev;
    });
  };

  const step = (direction) => {
    if (view === "week") setDate(addDays(week[0], direction * 7));
    else setDate(workingDayFrom(addDays(date, direction), direction));
  };

  const people = useMemo(() => {
    const active = employees.filter((e) => e.status === "active" && !e.leave_excluded);
    const memberIds = team === "all" ? null : new Set(projectMembers.filter((m) => m.project_id === team).map((m) => m.employee_id));
    return active
      .filter((e) => !memberIds || memberIds.has(e.id) || e.id === currentEmployee?.id)
      .sort((a, b) => {
        if (a.id === currentEmployee?.id) return -1;
        if (b.id === currentEmployee?.id) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [employees, projectMembers, team, currentEmployee]);

  const calById = useMemo(() => new Map(cal.people.map((p) => [p.employeeId, p])), [cal.people]);
  const eventsOf = (emp) => calById.get(emp.id)?.events || [];
  const holidayOn = (d) => publicHolidays.find((h) => String(h.date).slice(0, 10) === d) || null;
  const isMe = (emp) => emp.id === currentEmployee?.id;
  const connected = cal.configured && !cal.setupError;
  const okCount = cal.people.filter((p) => p.status === "ok").length;
  const reachable = cal.people.filter((p) => p.status !== "no-workspace-email").length;
  const teamProjects = projects.filter((p) => p.status !== "archived" && projectMembers.some((m) => m.project_id === p.id));

  const labelFor = (emp, block) => (block.title == null || (busyOnly && !isMe(emp)) ? "Busy" : block.title);

  // ── Up next (yours, today) ──
  const myBlocks = currentEmployee && date === today ? dayBlocks(eventsOf(currentEmployee), today) : [];
  const upNext = myBlocks.filter((b) => b.to > nowHour).slice(0, 3);

  // ── Find a time ──
  const pickedPeople = people.filter((p) => picked.includes(p.id));
  const searchDays = week.filter((d) => d >= today && !holidayOn(d));
  const slots = connected
    ? findFreeSlots(
        pickedPeople.map((p) => ({ events: eventsOf(p), leaveFor: (d) => leaveOn(leaves, p.name, d) })),
        searchDays,
        { durationMin: duration, today, nowHour, limit: 3 }
      )
    : [];
  const pickedEmails = pickedPeople.map((p) => p.work_email).filter(Boolean);

  const hiddenSeries = dailySeries(cal.people.map((p) => p.events), week);

  const holiday = holidayOn(date);
  const eyebrow = view === "week" ? `Week of ${formatDay(week[0], { month: "short", day: "numeric" })} – ${formatDay(week[4], { month: "short", day: "numeric" })}` : formatDay(date);
  const nowPct = ((nowHour - DAY_START) / (DAY_END - DAY_START)) * 100;
  const showNow = view === "day" && date === today && nowHour >= DAY_START && nowHour <= DAY_END;

  return (
    <section className="cal-page fade-in">
      {/* The tab's title and subtitle come from page.js (src/lib/pageMeta.js). */}
      <div className="cal-controls">
        <span className="page-eyebrow cal-date-label">{eyebrow}</span>
        <div className="status-tabs" role="group" aria-label="View">
          <button type="button" className={`tab ${view === "day" ? "tab-active" : ""}`} aria-pressed={view === "day"} onClick={() => setView("day")}>
            Day
          </button>
          <button type="button" className={`tab ${view === "week" ? "tab-active" : ""}`} aria-pressed={view === "week"} onClick={() => setView("week")}>
            Week
          </button>
        </div>
        <div className="cal-nav">
          <button type="button" className="btn-icon" aria-label={view === "week" ? "Previous week" : "Previous day"} onClick={() => step(-1)}>
            <Icon name="chevron-left" />
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => setDate(workingDayFrom(today))}>
            Today
          </button>
          <button type="button" className="btn-icon" aria-label={view === "week" ? "Next week" : "Next day"} onClick={() => step(1)}>
            <Icon name="chevron-right" />
          </button>
        </div>
      </div>

      {cal.configured === false || cal.setupError ? <SetupNotice isAdmin={isAdmin} setupError={cal.setupError} /> : null}
      {cal.error && (
        <div className="cal-notice cal-notice-error" role="alert">
          <Icon name="alert" />
          <div>
            <strong>Couldn&apos;t load calendars.</strong>
            <p>{cal.error}</p>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={cal.reload}>Retry</button>
        </div>
      )}

      <div className="glass-card cal-toolbar">
        {connected && (
          <span className="cal-sync">
            <span className="cal-live-dot" aria-hidden="true" />
            Synced from Google Calendar · {timeAgo(cal.fetchedAt)}
            <button type="button" className="btn-icon btn-sm" aria-label="Refresh calendars" onClick={cal.reload}>
              <Icon name="refresh" size={16} />
            </button>
          </span>
        )}
        {connected && reachable > 0 && (
          <span className={`pill ${okCount === reachable ? "pill-green" : "pill-amber"}`}>
            {okCount === reachable ? `All ${reachable} connected` : `${okCount} of ${reachable} connected`}
          </span>
        )}
        <label className="cal-filter">
          People
          <select value={team} onChange={(e) => setTeam(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">Everyone</option>
            {teamProjects.map((p) => (
              <option key={p.id} value={p.id}>{p.name} team</option>
            ))}
          </select>
        </label>
        <button type="button" role="switch" aria-checked={busyOnly} className="cal-switch" onClick={toggleBusy}>
          <span className={`cal-switch-track ${busyOnly ? "is-on" : ""}`} aria-hidden="true">
            <span className="cal-switch-knob" />
          </span>
          Busy blocks only
        </button>
        <div className="cal-legend">
          {Object.entries(EVENT_KINDS).map(([key, k]) => (
            <span key={key} className="cal-legend-item">
              <span className={`cal-swatch tone-${k.tone}`} aria-hidden="true" />
              {k.label}
            </span>
          ))}
          <span className="cal-legend-item">
            <span className="cal-swatch tone-leave" aria-hidden="true" />
            Leave
          </span>
        </div>
      </div>

      {view === "day" ? (
        <div className="glass-card cal-grid-card">
          <div className="cal-grid cal-day">
            <div className="cal-row cal-head-row">
              <div className="cal-person-head eyebrow">Teammate</div>
              <div className="cal-hours">
                {HOURS.map((h) => (
                  <span key={h} className="cal-hour mono">{formatHour(h)}</span>
                ))}
              </div>
            </div>

            {holiday && (
              <div className="cal-holiday-band">
                <Icon name="flag" size={16} /> Public holiday · {holiday.title}
              </div>
            )}

            {people.map((emp) => {
              const events = eventsOf(emp);
              const blocks = dayBlocks(events, date);
              const allDay = allDayOn(events, date);
              const leave = leaveOn(leaves, emp.name, date);
              const status = statusAt({ blocks, allDay, leave, nowHour, isToday: date === today });
              const calStatus = calById.get(emp.id)?.status;
              const ooo = allDay.find((e) => e.kind === "ooo");
              const partLeave = leave && leave.part !== "full" ? leaveHours(leave.part) : null;
              return (
                <div key={emp.id} className="cal-row">
                  <div className="cal-person">
                    <Avatar name={emp.name} isMe={isMe(emp)} />
                    <div className="cal-person-text">
                      <span className="cal-person-name">{emp.name}{isMe(emp) ? " (you)" : ""}</span>
                      <span className={`pill pill-${status.tone}`}>{status.text}</span>
                    </div>
                  </div>
                  <div className="cal-track">
                    {leave?.part === "full" ? (
                      <div className="cal-away">On leave</div>
                    ) : ooo ? (
                      <div className="cal-away">{ooo.title && !(busyOnly && !isMe(emp)) ? ooo.title : "Out of office"}</div>
                    ) : connected && calStatus && calStatus !== "ok" ? (
                      <div className="cal-missing">
                        {calStatus === "no-workspace-email" ? "No Workspace email on file" : "Calendar unavailable"}
                      </div>
                    ) : null}
                    {partLeave && (
                      <div
                        className="cal-block tone-leave"
                        style={{
                          left: `${((partLeave[0] - DAY_START) / (DAY_END - DAY_START)) * 100}%`,
                          width: `calc(${((partLeave[1] - partLeave[0]) / (DAY_END - DAY_START)) * 100}% - 4px)`,
                        }}
                      >
                        <span className="cal-block-title">{leave.part === "early" ? "Early leave" : "Half-day leave"}</span>
                        <span className="cal-block-time">{formatHour(partLeave[0])}–{formatHour(partLeave[1])}</span>
                      </div>
                    )}
                    {leave?.part !== "full" && !ooo && blocks.map((b) => <Block key={b.id + b.start} block={b} label={labelFor(emp, b)} />)}
                    {showNow && <div className="cal-now" style={{ left: `${nowPct}%` }} aria-hidden="true" />}
                  </div>
                </div>
              );
            })}
            {showNow && (
              <div className="cal-row cal-now-row" aria-hidden="true">
                <span />
                <div className="cal-now-label-track">
                  <span className="cal-now-label mono" style={{ left: `${nowPct}%` }}>Now {formatHour(nowHour)}</span>
                </div>
              </div>
            )}
            {people.length === 0 && <p className="empty-msg">No one in this team yet.</p>}
          </div>
        </div>
      ) : (
        <div className="glass-card cal-grid-card">
          <div className="cal-grid cal-week">
            <div className="cal-week-row cal-head-row">
              <div className="cal-person-head eyebrow">Teammate</div>
              {week.map((d) => {
                const h = holidayOn(d);
                return (
                  <div key={d} className={`cal-day-head ${d === today ? "is-today" : ""} ${h ? "is-holiday" : ""}`}>
                    <span className="eyebrow">{formatDay(d, { weekday: "short" })}</span>
                    <span className="cal-day-num">{Number(d.slice(8))}</span>
                    {h && <span className="cal-day-holiday">{h.title}</span>}
                  </div>
                );
              })}
            </div>
            {people.map((emp) => {
              const events = eventsOf(emp);
              return (
                <div key={emp.id} className="cal-week-row">
                  <div className="cal-person">
                    <Avatar name={emp.name} isMe={isMe(emp)} />
                    <span className="cal-person-name">{emp.name}{isMe(emp) ? " (you)" : ""}</span>
                  </div>
                  {week.map((d) => {
                    const leave = leaveOn(leaves, emp.name, d);
                    const cell = weekCell(events, d, hiddenSeries);
                    return (
                      <div key={d} className={`cal-week-cell ${d === today ? "is-today" : ""} ${holidayOn(d) ? "is-holiday" : ""}`}>
                        {leave && (
                          <div className="cal-chip tone-leave">
                            {leave.part === "full" ? "On leave" : leave.part === "early" ? "Early leave" : "Half-day leave"}
                          </div>
                        )}
                        {cell.shown.map((e) => {
                          const label = e.title == null || (busyOnly && !isMe(emp)) ? "Busy" : e.title;
                          const tone = label === "Busy" ? "gray" : (EVENT_KINDS[e.kind] || EVENT_KINDS.team).tone;
                          return (
                            <div key={e.id + e.start} className={`cal-chip tone-${tone}`} title={`${label} · ${e.timeLabel}`}>
                              <span className="mono">{e.timeLabel}</span> {label}
                            </div>
                          );
                        })}
                        {cell.more > 0 && <span className="cal-more">+{cell.more} more</span>}
                      </div>
                    );
                  })}
                </div>
              );
            })}
            {hiddenSeries.size > 0 && <p className="cal-footnote">Meetings that repeat every day (like the daily standup) are hidden in week view.</p>}
          </div>
        </div>
      )}

      <div className="cal-side-grid">
        <div className="glass-card cal-card">
          <div className="cal-card-head">
            <h2 className="section-title">Up next for you</h2>
            <span className="mono cal-card-date">{formatDay(today, { weekday: "short", month: "short", day: "numeric" })}</span>
          </div>
          {!connected ? (
            <p className="cal-muted">Your meetings appear here once Google Calendar is connected.</p>
          ) : date !== today ? (
            <p className="cal-muted">Go back to today to see what&apos;s next.</p>
          ) : upNext.length === 0 ? (
            <p className="cal-muted">Nothing else on your calendar today.</p>
          ) : (
            <ul className="cal-agenda">
              {upNext.map((b) => {
                const live = b.from <= nowHour && b.to > nowHour;
                return (
                  <li key={b.id + b.start} className="cal-agenda-row">
                    <span className="mono cal-agenda-time">{formatHour(b.from)}</span>
                    <div className="cal-agenda-text">
                      <span className="cal-agenda-title">{b.title || "Busy"}</span>
                      <span className="cal-muted">
                        {b.meet ? "Google Meet" : "No video link"}
                        {b.attendeeCount > 1 ? ` · ${b.attendeeCount} people` : ""}
                      </span>
                    </div>
                    {live && b.meet ? (
                      <a className="btn btn-primary btn-sm" href={b.meet} target="_blank" rel="noopener noreferrer">
                        <Icon name="video" size={16} /> Join Meet
                      </a>
                    ) : live ? (
                      <span className="pill pill-blue">Now</span>
                    ) : (
                      <span className="pill pill-gray">{inLabel(b.from, nowHour)}</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="glass-card cal-card">
          <div>
            <h2 className="section-title">Find a time</h2>
            <p className="cal-muted">Free slots everyone picked shares this week, inside working hours.</p>
          </div>
          <div className="cal-pick-row">
            {pickedPeople.map((p) => (
              <span key={p.id} className="cal-pick-chip">
                <Avatar name={p.name} isMe={isMe(p)} className="avatar avatar-sm" />
                {p.name.split(" ")[0]}
                <button type="button" className="cal-pick-remove" aria-label={`Remove ${p.name}`} onClick={() => setPicked((prev) => prev.filter((id) => id !== p.id))}>
                  <Icon name="x" size={12} strokeWidth={2.4} />
                </button>
              </span>
            ))}
            <select
              className="cal-pick-add"
              aria-label="Add person"
              value=""
              onChange={(e) => e.target.value && setPicked((prev) => [...prev, Number(e.target.value)])}
            >
              <option value="">+ Add person</option>
              {people.filter((p) => !picked.includes(p.id)).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <label className="cal-filter cal-duration">
              Length
              <select value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
                {DURATIONS.map((d) => (
                  <option key={d} value={d}>{d === 60 ? "1 hour" : `${d} min`}</option>
                ))}
              </select>
            </label>
          </div>
          {!connected ? (
            <p className="cal-muted">Needs Google Calendar connected.</p>
          ) : pickedPeople.length === 0 ? (
            <p className="cal-muted">Pick at least one person.</p>
          ) : slots.length === 0 ? (
            <p className="cal-muted">No shared free slot left this week. Try a shorter length or next week.</p>
          ) : (
            <ul className="cal-slots">
              {slots.map((s) => (
                <li key={`${s.date}-${s.from}`} className="cal-slot">
                  <span className="cal-slot-dot" aria-hidden="true" />
                  <div className="cal-slot-text">
                    <span className="mono">
                      {s.date === today ? "Today" : formatDay(s.date, { weekday: "short", month: "short", day: "numeric" })} · {formatHour(s.from)} – {formatHour(s.to)}
                    </span>
                    <span className="cal-muted">{pickedPeople.length === 1 ? "Free" : `All ${pickedPeople.length} free`}</span>
                  </div>
                  <a
                    className="btn btn-secondary btn-sm"
                    href={googleEventLink({ title: "Meeting", date: s.date, from: s.from, to: s.to, emails: pickedEmails })}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Book in Google Calendar
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
