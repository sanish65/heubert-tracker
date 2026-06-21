"use client";

import { useState, useEffect, useRef } from "react";

/**
 * Simplified RetroTimer.
 * - Host (facilitator) controls the timer locally and sends updates.
 * - Participants only observe the timer via `timerState` prop.
 */
export default function RetroTimer({ session, isHost, timerState, onUpdate }) {
  const [selectedDuration, setSelectedDuration] = useState(300);
  const [timeLeft, setTimeLeft] = useState(300);
  const [isRunning, setIsRunning] = useState(false);

  const intervalRef = useRef(null);
  const audioCtxRef = useRef(null);

  const initAudio = () => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
  };

  const playTickSound = () => {
    try {
      initAudio();
      const ctx = audioCtxRef.current;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.value = 1200;
      gain.gain.setValueAtTime(0.05, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.07);
    } catch (_) {}
  };

  const clearTimerInterval = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    clearTimerInterval();
    if (!isHost || !isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        const next = prev - 1;
        if (next <= 0) { clearTimerInterval(); return 0; }
        if (next <= 10) playTickSound();
        return next;
      });
    }, 1000);

    return clearTimerInterval;
  }, [isHost, isRunning]);

  useEffect(() => {
    if (isHost) return;
    if (!timerState) return;

    const { endTime, status, duration: dbDur } = timerState;
    if (status === "running" && endTime) {
      const remaining = Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      setIsRunning(true);
    } else if (status === "stopped") {
      setIsRunning(false);
      if (typeof dbDur === "number") { setSelectedDuration(dbDur); setTimeLeft(dbDur); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerState, isHost]);

  const handleStart = () => {
    const endTime = new Date(Date.now() + selectedDuration * 1000).toISOString();
    setTimeLeft(selectedDuration);
    setIsRunning(true);
    onUpdate({ action: "upsert_timer", sessionId: session.id, timerState: { endTime, duration: selectedDuration, status: "running" } });
  };

  const handleStop = () => {
    clearTimerInterval();
    setIsRunning(false);
    onUpdate({ action: "upsert_timer", sessionId: session.id, timerState: { endTime: null, duration: timeLeft, status: "stopped" } });
  };

  const handleReset = () => {
    clearTimerInterval();
    setIsRunning(false);
    setTimeLeft(selectedDuration);
    onUpdate({ action: "upsert_timer", sessionId: session.id, timerState: { endTime: null, duration: selectedDuration, status: "stopped" } });
  };

  const handleDurationChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setSelectedDuration(val);
    if (!isRunning) setTimeLeft(val);
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const isPanic = isRunning && timeLeft > 0 && timeLeft <= 10;

  return (
    <div className={`retro-timer-pill${isPanic ? " retro-timer-pill--panic" : ""}${isRunning && !isPanic ? " retro-timer-pill--running" : ""}`}>
      {/* Countdown display */}
      <div className="retro-timer-clock">
        <span className="retro-timer-icon">⏱</span>
        <span className="retro-timer-digits">{fmt(timeLeft)}</span>
        {isRunning && (
          <span className={`retro-timer-live-dot${isPanic ? " retro-timer-live-dot--panic" : ""}`} />
        )}
      </div>

      {/* Host controls */}
      {isHost && (
        <div className="retro-timer-controls">
          {!isRunning ? (
            <>
              <select
                className="retro-timer-select"
                value={selectedDuration}
                onChange={handleDurationChange}
              >
                <option value={60}>1 min</option>
                <option value={120}>2 min</option>
                <option value={180}>3 min</option>
                <option value={300}>5 min</option>
                <option value={600}>10 min</option>
              </select>
              <button className="retro-timer-btn retro-timer-btn--start" onClick={handleStart}>▶ Start</button>
              <button className="retro-timer-btn retro-timer-btn--ghost" onClick={handleReset}>↺</button>
            </>
          ) : (
            <button className="retro-timer-btn retro-timer-btn--stop" onClick={handleStop}>⏸ Stop</button>
          )}
        </div>
      )}

      {/* Participant observer label */}
      {!isHost && isRunning && (
        <span className="retro-timer-observer">timing…</span>
      )}

      <style jsx>{`
        /* ── Pill wrapper ── */
        .retro-timer-pill {
          position: fixed;
          top: 20px;
          left: 50%;
          transform: translateX(-50%);
          z-index: 1000;

          display: flex;
          align-items: center;
          gap: 12px;

          padding: 8px 16px;
          border-radius: var(--radius-xl, 20px);
          border: 1px solid var(--border-color, rgba(255,255,255,0.08));
          background: var(--bg-card, rgba(17,24,39,0.9));
          backdrop-filter: blur(20px);
          box-shadow: var(--shadow-md, 0 4px 20px rgba(0,0,0,0.5));
          transition: border-color 0.3s, box-shadow 0.3s, background 0.3s;
          white-space: nowrap;
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .retro-timer-pill--running {
          border-color: rgba(99, 102, 241, 0.35);
          box-shadow: var(--shadow-md), 0 0 20px rgba(99,102,241,0.15);
        }

        .retro-timer-pill--panic {
          border-color: rgba(239, 68, 68, 0.5) !important;
          background: rgba(239, 68, 68, 0.12) !important;
          animation: retro-panic-pulse 1s ease-in-out infinite;
        }

        @keyframes retro-panic-pulse {
          0%, 100% { box-shadow: var(--shadow-md), 0 0 0 0 rgba(239,68,68,0.4); }
          50%       { box-shadow: var(--shadow-md), 0 0 0 6px rgba(239,68,68,0); }
        }

        /* ── Clock face ── */
        .retro-timer-clock {
          display: flex;
          align-items: center;
          gap: 7px;
        }

        .retro-timer-icon {
          font-size: 0.95rem;
          line-height: 1;
          opacity: 0.8;
        }

        .retro-timer-digits {
          font-size: 1.05rem;
          font-weight: 800;
          letter-spacing: 0.5px;
          min-width: 48px;
          color: var(--text-primary, #f3f4f6);
          font-variant-numeric: tabular-nums;
        }

        .retro-timer-pill--panic .retro-timer-digits {
          color: #f87171;
        }

        /* Live dot */
        .retro-timer-live-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          background: var(--accent-indigo, #6366f1);
          animation: retro-live-blink 1.2s ease-in-out infinite;
          flex-shrink: 0;
        }

        .retro-timer-live-dot--panic {
          background: var(--accent-red, #ef4444);
        }

        @keyframes retro-live-blink {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(0.75); }
        }

        /* ── Divider between clock and controls ── */
        .retro-timer-controls {
          display: flex;
          align-items: center;
          gap: 7px;
          padding-left: 12px;
          border-left: 1px solid var(--border-color, rgba(255,255,255,0.08));
        }

        /* ── Duration select ── */
        .retro-timer-select {
          background: #111827;
          border: 1px solid rgba(255,255,255,0.1);
          color: #cbd5e1;
          padding: 4px 8px;
          border-radius: var(--radius-sm, 8px);
          font-size: 0.78rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          outline: none;
          transition: border-color 0.2s, color 0.2s;
          color-scheme: dark;
        }

        .retro-timer-select:hover {
          border-color: rgba(255,255,255,0.2);
          color: #f1f5f9;
        }

        .retro-timer-select:focus {
          border-color: var(--accent-indigo, #6366f1);
          box-shadow: 0 0 0 2px rgba(99,102,241,0.15);
          color: #f1f5f9;
        }

        /* ── Buttons ── */
        .retro-timer-btn {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 5px 12px;
          border-radius: var(--radius-sm, 8px);
          font-size: 0.78rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          border: none;
          transition: transform 0.15s, opacity 0.15s, box-shadow 0.15s;
          line-height: 1;
        }

        .retro-timer-btn:hover {
          transform: translateY(-1px);
          opacity: 0.9;
        }

        .retro-timer-btn--start {
          background: linear-gradient(135deg, #22c55e, #16a34a);
          color: #fff;
          box-shadow: 0 0 12px rgba(34,197,94,0.3);
        }

        .retro-timer-btn--start:hover {
          box-shadow: 0 0 20px rgba(34,197,94,0.5);
        }

        .retro-timer-btn--stop {
          background: var(--accent-red-soft, rgba(239,68,68,0.15));
          color: var(--accent-red, #ef4444);
          border: 1px solid rgba(239,68,68,0.3);
        }

        .retro-timer-btn--stop:hover {
          background: rgba(239,68,68,0.25);
        }

        .retro-timer-btn--ghost {
          background: var(--bg-glass, rgba(255,255,255,0.04));
          color: var(--text-secondary, #9ca3af);
          border: 1px solid var(--border-color, rgba(255,255,255,0.08));
          padding: 5px 9px;
          font-size: 0.9rem;
        }

        .retro-timer-btn--ghost:hover {
          color: var(--text-primary, #f3f4f6);
          border-color: var(--border-hover, rgba(255,255,255,0.15));
        }

        /* ── Observer label ── */
        .retro-timer-observer {
          font-size: 0.72rem;
          color: var(--text-muted, #6b7280);
          font-style: italic;
          padding-left: 12px;
          border-left: 1px solid var(--border-color, rgba(255,255,255,0.08));
          letter-spacing: 0.02em;
        }
      `}</style>
    </div>
  );
}
