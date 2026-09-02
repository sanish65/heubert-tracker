"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import { getNepalDateStr } from "@/lib/attendanceTime";

function formatTime(isoStr) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleTimeString("en-US", {
    timeZone: "Asia/Kathmandu",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function AttendancePunchWidget() {
  const { currentEmployee, attendance, punchIn, punchOut } = useApp();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const todayStr = getNepalDateStr(new Date());
  const todayRecord = useMemo(
    () => attendance.find((a) => a.employee_name === currentEmployee?.name && a.date === todayStr),
    [attendance, currentEmployee, todayStr]
  );

  const handlePunchIn = async () => {
    setError("");
    setLoading(true);
    try {
      await punchIn();
    } catch (err) {
      setError(err.message || "Failed to punch in.");
    } finally {
      setLoading(false);
    }
  };

  const handlePunchOut = async () => {
    setError("");
    setLoading(true);
    try {
      await punchOut();
    } catch (err) {
      setError(err.message || "Failed to punch out.");
    } finally {
      setLoading(false);
    }
  };

  const hasCheckedIn = !!todayRecord?.check_in_at;
  const hasCheckedOut = !!todayRecord?.check_out_at;

  return (
    <div className="attendance-card">
      <h3 className="section-title">🕒 Today's Attendance</h3>

      {hasCheckedOut ? (
        <span className="fine-count">
          Checked in at {formatTime(todayRecord.check_in_at)} · Checked out at {formatTime(todayRecord.check_out_at)}
        </span>
      ) : hasCheckedIn ? (
        <span className="fine-count">
          Checked in at {formatTime(todayRecord.check_in_at)}
          {todayRecord.is_late ? ` (${todayRecord.late_minutes} min late)` : ""}
        </span>
      ) : (
        <span className="fine-count">You haven't punched in today.</span>
      )}

      {!hasCheckedIn && (
        <button className="btn btn-primary" onClick={handlePunchIn} disabled={loading}>
          {loading ? "Punching in…" : "Punch In"}
        </button>
      )}
      {hasCheckedIn && !hasCheckedOut && (
        <button className="btn btn-primary" onClick={handlePunchOut} disabled={loading}>
          {loading ? "Punching out…" : "Punch Out"}
        </button>
      )}

      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
