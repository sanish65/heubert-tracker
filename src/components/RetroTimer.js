"use client";

import { useState, useEffect, useRef } from "react";
import Icon from "@/components/Icon";

const YT_VIDEO_ID = "zkMDpAgqElM";
const YT_ORIGIN   = "https://www.youtube.com";

export default function RetroTimer({ session, isHost, timerState, onUpdate }) {
  const [selectedDuration, setSelectedDuration] = useState(300);
  const [timeLeft, setTimeLeft]     = useState(300);
  const [isRunning, setIsRunning]   = useState(false);
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [volume, setVolume]             = useState(20);
  const [showVolume, setShowVolume]     = useState(false);

  const intervalRef      = useRef(null);
  const audioCtxRef      = useRef(null);
  const endTimeRef       = useRef(null);
  const iframeRef        = useRef(null);
  const isRunningRef     = useRef(false);
  const musicEnabledRef  = useRef(true);
  const volumeRef        = useRef(20);

  // Load stored preferences
  useEffect(() => {
    const storedMusic = localStorage.getItem("heubert_retro_music");
    if (storedMusic !== null) {
      const val = storedMusic === "true";
      setMusicEnabled(val);
      musicEnabledRef.current = val;
    }
    const storedVol = localStorage.getItem("heubert_retro_volume");
    if (storedVol !== null) {
      const val = parseInt(storedVol, 10);
      setVolume(val);
      volumeRef.current = val;
    }
  }, []);

  // Keep refs current so message-handler callbacks see live values
  useEffect(() => { isRunningRef.current = isRunning; },      [isRunning]);
  useEffect(() => { musicEnabledRef.current = musicEnabled; }, [musicEnabled]);
  useEffect(() => { volumeRef.current = volume; },            [volume]);

  // Send a postMessage command to the YouTube iframe
  const ytCmd = (fn, args = []) => {
    try {
      iframeRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: "command", func: fn, args }),
        YT_ORIGIN
      );
    } catch (_) {}
  };

  // Listen for YouTube player events (onReady → set volume; onStateChange:0 → loop)
  useEffect(() => {
    if (!isHost) return;
    const handler = (e) => {
      if (e.origin !== YT_ORIGIN) return;
      try {
        const data = JSON.parse(e.data);
        if (data.event === "onReady") {
          ytCmd("setVolume", [volumeRef.current]);
          if (isRunningRef.current && musicEnabledRef.current) ytCmd("playVideo");
        }
        // video ended before loop param kicks in — force replay
        if (data.event === "onStateChange" && data.info === 0) {
          if (isRunningRef.current && musicEnabledRef.current) ytCmd("playVideo");
        }
      } catch (_) {}
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [isHost]);

  // --- tick sound ---
  const initAudio = () => {
    if (!audioCtxRef.current)
      audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
  };
  const playTickSound = () => {
    try {
      initAudio();
      const ctx  = audioCtxRef.current;
      const osc  = ctx.createOscillator();
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
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  // Stop music and reset running state when timer naturally expires
  useEffect(() => {
    if (!isHost || timeLeft !== 0 || !isRunning) return;
    setIsRunning(false);
    ytCmd("pauseVideo");
  }, [timeLeft, isHost, isRunning]);

  // --- countdown interval ---
  useEffect(() => {
    clearTimerInterval();
    if (!isRunning) return;
    intervalRef.current = setInterval(() => {
      if (!isHost) {
        const et = endTimeRef.current;
        if (!et) { clearTimerInterval(); return; }
        const remaining = Math.max(0, Math.floor((new Date(et).getTime() - Date.now()) / 1000));
        setTimeLeft(remaining);
        if (remaining <= 0) { clearTimerInterval(); return; }
        if (remaining <= 10) playTickSound();
      } else {
        setTimeLeft(prev => {
          const next = prev - 1;
          if (next <= 0) { clearTimerInterval(); return 0; }
          if (next <= 10) playTickSound();
          return next;
        });
      }
    }, 1000);
    return clearTimerInterval;
  }, [isHost, isRunning]);

  // --- participant sync from DB ---
  useEffect(() => {
    if (isHost || !timerState) return;
    const { endTime, status, duration: dbDur } = timerState;
    if (status === "running" && endTime) {
      endTimeRef.current = endTime;
      const remaining = Math.max(0, Math.floor((new Date(endTime).getTime() - Date.now()) / 1000));
      setTimeLeft(remaining);
      setIsRunning(true);
    } else if (status === "stopped") {
      endTimeRef.current = null;
      setIsRunning(false);
      if (typeof dbDur === "number") { setSelectedDuration(dbDur); setTimeLeft(dbDur); }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timerState, isHost]);

  // --- host controls ---
  const handleStart = () => {
    const endTime = new Date(Date.now() + selectedDuration * 1000).toISOString();
    setTimeLeft(selectedDuration);
    setIsRunning(true);
    if (musicEnabled) ytCmd("playVideo"); // call directly in user-gesture context
    onUpdate({ action: "upsert_timer", sessionId: session.id, timerState: { endTime, duration: selectedDuration, status: "running" } });
  };

  const handleStop = () => {
    clearTimerInterval();
    setIsRunning(false);
    ytCmd("pauseVideo");
    onUpdate({ action: "upsert_timer", sessionId: session.id, timerState: { endTime: null, duration: timeLeft, status: "stopped" } });
  };

  const handleReset = () => {
    clearTimerInterval();
    setIsRunning(false);
    setTimeLeft(selectedDuration);
    ytCmd("pauseVideo");
    onUpdate({ action: "upsert_timer", sessionId: session.id, timerState: { endTime: null, duration: selectedDuration, status: "stopped" } });
  };

  const handleDurationChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setSelectedDuration(val);
    if (!isRunning) setTimeLeft(val);
  };

  const toggleMusic = () => {
    const next = !musicEnabled;
    setMusicEnabled(next);
    localStorage.setItem("heubert_retro_music", String(next));
    if (next && isRunning) ytCmd("playVideo");
    else ytCmd("pauseVideo");
  };

  const handleVolumeChange = (e) => {
    const val = parseInt(e.target.value, 10);
    setVolume(val);
    localStorage.setItem("heubert_retro_volume", String(val));
    ytCmd("setVolume", [val]);
  };

  const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const isPanic = isRunning && timeLeft > 0 && timeLeft <= 10;

  // Facilitator timer (Retro.dc.html): clock, mono digits, length, start / stop, music.
  // It sits in the board's session strip; its styles are in globals.css (RETROSPECTIVE).
  return (
    <div
      role="group"
      aria-label="Facilitator timer"
      className={`retro-timer${isRunning ? " is-running" : ""}${isPanic ? " is-panic" : ""}`}
    >

      {/* Hidden YouTube iframe — allow="autoplay" grants audio permission without gesture chain */}
      {isHost && (
        <iframe
          ref={iframeRef}
          src={`${YT_ORIGIN}/embed/${YT_VIDEO_ID}?enablejsapi=1&loop=1&playlist=${YT_VIDEO_ID}&controls=0&autoplay=0&origin=${encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "")}`}
          allow="autoplay; encrypted-media"
          className="retro-timer-yt"
          tabIndex={-1}
          aria-hidden="true"
          title="background-music"
        />
      )}

      {/* Countdown display */}
      <Icon name="clock" size={18} className="retro-timer-icon" />
      <span role="timer" aria-label="Time left" className="retro-timer-digits">{fmt(timeLeft)}</span>
      {isRunning && <span className="retro-timer-live" aria-hidden="true" />}

      {/* Host controls */}
      {isHost && (
        <div className="retro-timer-controls">
          {!isRunning ? (
            <>
              <select className="retro-timer-select" aria-label="Timer length" value={selectedDuration} onChange={handleDurationChange}>
                <option value={60}>1 min</option>
                <option value={120}>2 min</option>
                <option value={180}>3 min</option>
                <option value={300}>5 min</option>
                <option value={600}>10 min</option>
              </select>
              <button type="button" className="btn btn-primary btn-sm retro-timer-btn" onClick={handleStart}>
                <Icon name="play" size={14} strokeWidth={2} />
                Start
              </button>
              <button type="button" className="btn-icon btn-sm retro-timer-ghost" onClick={handleReset} aria-label="Reset timer" title="Reset">
                <Icon name="refresh" size={16} />
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-secondary btn-sm retro-timer-btn" onClick={handleStop}>
              <Icon name="pause" size={14} strokeWidth={2} />
              Stop
            </button>
          )}
          <div
            className="retro-music-wrap"
            onMouseEnter={() => setShowVolume(true)}
            onMouseLeave={() => setShowVolume(false)}
          >
            <button
              type="button"
              className={`btn-icon btn-sm retro-timer-ghost retro-music${musicEnabled ? "" : " is-off"}`}
              onClick={toggleMusic}
              aria-label={musicEnabled ? "Mute background music" : "Enable background music"}
              title={musicEnabled ? "Mute background music" : "Enable background music"}
            >
              <Icon name="bell" size={16} />
            </button>
            {showVolume && (
              <div className="retro-volume-popover">
                <span className="retro-volume-pct">{volume}%</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={handleVolumeChange}
                  aria-label="Music volume"
                  className="retro-volume-slider"
                  style={{ "--val": volume }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Participant observer label */}
      {!isHost && isRunning && (
        <span className="retro-timer-observer">timing…</span>
      )}
    </div>
  );
}
