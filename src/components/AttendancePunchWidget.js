"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { getNepalDateStr } from "@/lib/attendanceTime";
import { formatBs } from "@/lib/nepaliDate";
import Icon from "./Icon";

const NEPAL_TZ = "Asia/Kathmandu";

const clockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: NEPAL_TZ,
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});

function formatTime(isoStr) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleTimeString("en-US", {
    timeZone: NEPAL_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

// "11:42:08" and "AM", Nepal time.
function clockParts(date) {
  const parts = clockFormat.formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || "";
  return { time: `${get("hour")}:${get("minute")}:${get("second")}`, period: get("dayPeriod") };
}

// "Mon, Oct 19 2026 · 3 Kartik 2083" for a Nepal "YYYY-MM-DD".
function dateLine(dateStr) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  const fmt = (opts) => d.toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
  const ad = `${fmt({ weekday: "short" })}, ${fmt({ month: "short", day: "numeric" })} ${fmt({ year: "numeric" })}`;
  const bs = formatBs(dateStr);
  return bs ? `${ad} · ${bs}` : ad;
}

// "18:30" -> "6:30 PM".
function formatReminder(hhmm) {
  const [h, m] = String(hhmm || "").split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return "";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

// The punch's own geofence refusal (AppContext verifyWebOfficeGeofence) carries the
// distance: "You're 412m from the office — you must be within 200m."
const OUTSIDE_RADIUS = /^You're (\d+)m from the office/;

function formatDuration(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

function TimelineStep({ done, title, time, sub, last }) {
  return (
    <li className="attendance-step">
      <span className="attendance-step-rail">
        <span className={`attendance-step-dot ${done ? "is-done" : ""}`}>
          <Icon name={done ? "check" : "clock"} size={14} strokeWidth={done ? 2.4 : 2} />
        </span>
        {!last && <span className="attendance-step-line" aria-hidden="true" />}
      </span>
      <span className="attendance-step-text">
        <span className="attendance-step-title">
          {title} <span className={`mono ${done ? "" : "attendance-step-time-empty"}`}>{time}</span>
        </span>
        {sub && <span className="attendance-step-sub">{sub}</span>}
      </span>
    </li>
  );
}

export default function AttendancePunchWidget() {
  const { currentEmployee, attendance, officeSettings, punchIn, punchOut } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => new Date());
  // Geofence result of the last office-bound punch: null until a punch has run, then
  // checking, inside or outside. Nothing reads the location apart from the punch itself.
  const [geo, setGeo] = useState(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const todayStr = getNepalDateStr(now);
  const todayRecord = useMemo(
    () => attendance.find((a) => a.employee_name === currentEmployee?.name && a.date === todayStr),
    [attendance, currentEmployee, todayStr]
  );

  const hasCheckedIn = !!todayRecord?.check_in_at;
  const hasCheckedOut = !!todayRecord?.check_out_at;
  const officeBound = !!currentEmployee?.web_punch_office_bound;

  const runPunch = async (action, fallbackMessage) => {
    setError("");
    setLoading(true);
    if (officeBound) setGeo({ state: "checking" });
    try {
      await action();
      if (officeBound) setGeo({ state: "inside" });
    } catch (err) {
      setError(err.message || fallbackMessage);
      const outside = OUTSIDE_RADIUS.exec(err.message || "");
      if (!officeBound) return;
      setGeo(outside ? { state: "outside", distance: Number(outside[1]) } : null);
    } finally {
      setLoading(false);
    }
  };

  const handlePunchIn = () => runPunch(punchIn, "Failed to punch in.");
  const handlePunchOut = () => runPunch(punchOut, "Failed to punch out.");

  const { time, period } = clockParts(now);
  const radius = officeSettings?.radius_meters;

  // Shown only once the punch flow has a geofence result: green inside, red outside,
  // grey while the punch is checking.
  let geofence = null;
  if (officeBound && geo?.state === "checking") {
    geofence = (
      <span className="pill pill-gray">
        <Icon name="pin" size={13} strokeWidth={2.2} /> Checking location…
      </span>
    );
  } else if (officeBound && geo?.state === "inside") {
    geofence = (
      <span className="pill pill-green">
        <Icon name="pin" size={13} strokeWidth={2.2} /> Inside office radius
      </span>
    );
  } else if (officeBound && geo?.state === "outside") {
    geofence = (
      <>
        <span className="pill pill-red">
          <Icon name="pin" size={13} strokeWidth={2.2} /> Outside office radius
        </span>
        <span className="attendance-geofence-meta mono">
          {geo.distance} m away{radius != null ? ` · limit ${radius} m` : ""}
        </span>
      </>
    );
  }

  const checkoutReminder = formatReminder(officeSettings?.checkout_reminder_time);
  const checkinReminder = formatReminder(officeSettings?.checkin_reminder_time);
  const workedMs = hasCheckedIn
    ? new Date(todayRecord.check_out_at || now) - new Date(todayRecord.check_in_at)
    : null;

  return (
    <section className="attendance-punch glass-card" aria-label="Today's attendance">
      <div className="attendance-punch-clock">
        <span className="eyebrow">Today&apos;s attendance · Nepal time</span>
        <div className="attendance-clock">
          <span className="attendance-clock-time">{time}</span>
          <span className="attendance-clock-period">{period}</span>
        </div>
        <span className="attendance-clock-date mono">{dateLine(todayStr)}</span>
        {!hasCheckedOut && geofence && <span className="attendance-geofence">{geofence}</span>}
      </div>

      <ol className="attendance-timeline" aria-label="Today's punches">
        <TimelineStep
          done={hasCheckedIn}
          title={hasCheckedIn ? "Checked in" : "Check in"}
          time={formatTime(todayRecord?.check_in_at)}
          sub={
            hasCheckedIn
              ? todayRecord.is_late
                ? `${todayRecord.late_minutes} min late`
                : "On time"
              : checkinReminder && `Reminder email at ${checkinReminder} if missed`
          }
        />
        <TimelineStep
          done={hasCheckedOut}
          title={hasCheckedOut ? "Checked out" : "Check out"}
          time={formatTime(todayRecord?.check_out_at)}
          sub={!hasCheckedOut && checkoutReminder && `Reminder email at ${checkoutReminder} if missed`}
          last
        />
      </ol>

      <div className="attendance-punch-actions">
        {workedMs != null && (
          <div className="attendance-worked">
            <span className="attendance-worked-label">{hasCheckedOut ? "Worked today" : "Worked so far"}</span>
            <span className="attendance-worked-value">{formatDuration(workedMs)}</span>
          </div>
        )}

        {hasCheckedOut ? (
          <span className="attendance-punch-done">
            Checked in at {formatTime(todayRecord.check_in_at)} · Checked out at {formatTime(todayRecord.check_out_at)}
          </span>
        ) : (
          <div className="attendance-punch-btns">
            {hasCheckedIn ? (
              <button
                type="button"
                className="btn attendance-punch-off"
                disabled
                aria-label={`Check In, already checked in at ${formatTime(todayRecord.check_in_at)}`}
              >
                <Icon name="check" size={16} strokeWidth={2} /> Check In
              </button>
            ) : (
              <button type="button" className="btn btn-primary" onClick={handlePunchIn} disabled={loading}>
                <Icon name="check" size={16} strokeWidth={2} /> {loading ? "Checking in…" : "Check In"}
              </button>
            )}
            {hasCheckedIn ? (
              <button type="button" className="btn btn-primary" onClick={handlePunchOut} disabled={loading}>
                <Icon name="logout" size={16} strokeWidth={2} /> {loading ? "Checking out…" : "Check Out"}
              </button>
            ) : (
              <button type="button" className="btn attendance-punch-off" disabled>
                <Icon name="logout" size={16} strokeWidth={2} /> Check Out
              </button>
            )}
          </div>
        )}

        {error && (
          <span className="form-error" role="alert">
            <Icon name="alert" size={16} strokeWidth={2} /> {error}
          </span>
        )}
      </div>
    </section>
  );
}
