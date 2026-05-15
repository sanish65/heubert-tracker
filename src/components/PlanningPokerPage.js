"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?"];


export default function PlanningPokerPage() {
  const [view, setView] = useState("home"); // home | host | join
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [sessionTitle, setSessionTitle] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinSessionId, setJoinSessionId] = useState("");
  const [session, setSession] = useState(null);
  const [votes, setVotes] = useState([]);
  const [myVote, setMyVote] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [participantName, setParticipantName] = useState("");
  const pollRef = useRef(null);
  const [shareUrl, setShareUrl] = useState("");

  const startPolling = useCallback((sid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/poker?sessionId=${sid}`);
        if (!res.ok) return;
        const data = await res.json();
        setSession(data.session);
        setVotes(data.votes || []);
      } catch (_) {}
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const buildShareUrl = (sid) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/planning-poker/${sid}`;
    }
    return "";
  };

  // ── Create session (host) ─────────────────────────────
  const handleCreateSession = async () => {
    if (!sessionTitle.trim() || !creatorName.trim()) {
      setError("Please fill in the session title and your name.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/poker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: sessionTitle.trim(),
          createdBy: creatorName.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session");
      setSession(data.session);
      setVotes([]);
      setIsHost(true);
      setParticipantName(creatorName.trim());
      const url = buildShareUrl(data.session.id);
      setShareUrl(url);
      setView("host");
      startPolling(data.session.id);

      // Also "join" the session so the host appears in the participant list
      await fetch("/api/poker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          sessionId: data.session.id,
          participantName: creatorName.trim(),
        }),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Join session (participant) ─────────────────────────
  const handleJoinSession = async () => {
    if (!joinName.trim() || !joinSessionId.trim()) {
      setError("Please enter your name and the session ID.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/poker?sessionId=${joinSessionId.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Session not found");
      setSession(data.session);
      setVotes(data.votes || []);
      setParticipantName(joinName.trim());
      setIsHost(false);
      const myExisting = (data.votes || []).find(
        (v) => v.participant_name === joinName.trim()
      );
      setMyVote(myExisting ? myExisting.vote : null);
      setView("host");
      startPolling(joinSessionId.trim());

      // Ensure we are in the participants list
      await fetch("/api/poker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          sessionId: joinSessionId.trim(),
          participantName: joinName.trim(),
        }),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // ── Cast vote ─────────────────────────────────────────
  const handleVote = async (value) => {
    if (!session) return;
    if (session.revealed) return;
    setMyVote(value);
    try {
      await fetch("/api/poker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vote",
          sessionId: session.id,
          participantName,
          vote: String(value),
        }),
      });
    } catch (_) {}
  };

  // ── Reveal results (host only) ─────────────────────────
  const handleReveal = async () => {
    if (!session) return;
    try {
      const res = await fetch("/api/poker", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reveal", sessionId: session.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSession(data.session);
      }
    } catch (_) {}
  };

  // ── Reset round (host only) ────────────────────────────
  const handleReset = async () => {
    if (!session) return;
    try {
      const res = await fetch("/api/poker", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", sessionId: session.id }),
      });
      const data = await res.json();
      if (res.ok) {
        setSession(data.session);
        setVotes([]);
        setMyVote(null);
      }
    } catch (_) {}
  };

  // ── Copy share link ────────────────────────────────────
  const handleCopy = () => {
    if (!shareUrl) return;
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Compute average ────────────────────────────────────
  const numericVotes = votes
    .map((v) => Number(v.vote))
    .filter((n) => !isNaN(n) && n > 0);
  const average =
    numericVotes.length > 0
      ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1)
      : null;

  const nearestFib =
    average !== null
      ? FIBONACCI.filter((f) => typeof f === "number").reduce((a, b) =>
          Math.abs(b - parseFloat(average)) < Math.abs(a - parseFloat(average)) ? b : a
        )
      : null;

  const myVoteInSession = votes.find((v) => v.participant_name === participantName);

  // ──────────────────────────────────────────────────────
  // Lock body scroll when enlarged
  useEffect(() => {
    document.body.style.overflow = isEnlarged ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isEnlarged]);

  return (
    <div className={`poker-page${isEnlarged ? " poker-page-enlarged" : ""}`}>
      {/* ── Enlarge toggle bar ── */}
      <div className="poker-topbar">
        {isEnlarged && (
          <span className="poker-topbar-title">🃏 Planning Poker</span>
        )}
        <button
          className="btn-enlarge poker-enlarge-btn"
          onClick={() => setIsEnlarged(e => !e)}
          title={isEnlarged ? "Exit fullscreen" : "Fullscreen"}
        >
          {isEnlarged ? "✕" : "⛶"}
        </button>
      </div>

      {/* ── HOME / ENTRY ── */}
      {view === "home" && (
        <div className="poker-home">
          <div className="poker-hero">
            <span className="poker-hero-icon">🃏</span>
            <h2 className="poker-hero-title">Planning Poker</h2>
            <p className="poker-hero-sub">
              Estimate story points collaboratively with your team using Fibonacci
              sequences. Create a session, share the link, and vote together.
            </p>
          </div>

          <div className="poker-entry-grid">
            {/* Create Session */}
            <div className="poker-entry-card">
              <div className="poker-entry-card-header">
                <span className="poker-entry-icon">🚀</span>
                <h3>Create Session</h3>
                <p>Start a new planning poker session as the host</p>
              </div>
              <div className="poker-form">
                <div className="poker-form-group">
                  <label>Your Name</label>
                  <input
                    className="poker-input"
                    type="text"
                    placeholder="e.g. Alice"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateSession()}
                  />
                </div>
                <div className="poker-form-group">
                  <label>Story / Ticket Title</label>
                  <input
                    className="poker-input"
                    type="text"
                    placeholder="e.g. Implement login page"
                    value={sessionTitle}
                    onChange={(e) => setSessionTitle(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleCreateSession()}
                  />
                </div>
                <button
                  className="btn-poker-primary"
                  onClick={handleCreateSession}
                  disabled={loading}
                >
                  {loading ? (
                    <span className="poker-spinner" />
                  ) : (
                    "🚀 Create Session"
                  )}
                </button>
              </div>
            </div>

            {/* Join Session */}
            <div className="poker-entry-card poker-entry-card-join">
              <div className="poker-entry-card-header">
                <span className="poker-entry-icon">🔗</span>
                <h3>Join Session</h3>
                <p>Enter a session ID shared by the host to join</p>
              </div>
              <div className="poker-form">
                <div className="poker-form-group">
                  <label>Your Name</label>
                  <input
                    className="poker-input"
                    type="text"
                    placeholder="e.g. Bob"
                    value={joinName}
                    onChange={(e) => setJoinName(e.target.value)}
                  />
                </div>
                <div className="poker-form-group">
                  <label>Session ID</label>
                  <input
                    className="poker-input"
                    type="text"
                    placeholder="Paste session ID here"
                    value={joinSessionId}
                    onChange={(e) => setJoinSessionId(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleJoinSession()}
                  />
                </div>
                <button
                  className="btn-poker-secondary"
                  onClick={handleJoinSession}
                  disabled={loading}
                >
                  {loading ? <span className="poker-spinner" /> : "🔗 Join Session"}
                </button>
              </div>
            </div>
          </div>

          {error && <div className="poker-error">{error}</div>}

          {/* How it works */}
          <div className="poker-howto">
            <h4 className="poker-howto-title">How it works</h4>
            <div className="poker-howto-steps">
              {[
                { icon: "1️⃣", text: "Host creates a session with the story title" },
                { icon: "2️⃣", text: "Share the generated link with participants" },
                { icon: "3️⃣", text: "Everyone picks a Fibonacci story point card" },
                { icon: "4️⃣", text: "Host reveals results — average shown instantly" },
              ].map((s, i) => (
                <div key={i} className="poker-step">
                  <span className="poker-step-icon">{s.icon}</span>
                  <span>{s.text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── SESSION VIEW ── */}
      {view === "host" && session && (
        <div className="poker-session">
          {/* Session Header */}
          <div className="poker-session-header">
            <div className="poker-session-meta">
              <button
                className="poker-back-btn"
                onClick={() => {
                  if (pollRef.current) clearInterval(pollRef.current);
                  setView("home");
                  setSession(null);
                  setVotes([]);
                  setMyVote(null);
                  setError("");
                }}
              >
                ← Back
              </button>
              <div>
                <h2 className="poker-session-title">{session.title}</h2>
                <span className="poker-session-badge">
                  {isHost ? "🎯 Host" : "👤 Participant"}
                </span>
              </div>
            </div>

            {/* Share Link */}
            {isHost && shareUrl && (
              <div className="poker-share-box">
                <span className="poker-share-label">🔗 Shareable Link</span>
                <div className="poker-share-row">
                  <input
                    className="poker-share-input"
                    readOnly
                    value={shareUrl}
                  />
                  <button
                    className={`poker-copy-btn ${copied ? "copied" : ""}`}
                    onClick={handleCopy}
                  >
                    {copied ? "✅ Copied!" : "📋 Copy"}
                  </button>
                </div>
                <div className="poker-session-id-row">
                  <span className="poker-session-id-label">Session ID:</span>
                  <code className="poker-session-id">{session.id}</code>
                </div>
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="poker-status-bar">
            <div className="poker-status-info">
              <span className="poker-vote-count">
                🗳️ {votes.length} vote{votes.length !== 1 ? "s" : ""} cast
              </span>
              <span
                className={`poker-reveal-badge ${
                  session.revealed ? "revealed" : "hidden"
                }`}
              >
                {session.revealed ? "🔓 Results Revealed" : "🔒 Voting in Progress"}
              </span>
            </div>
            {isHost && (
              <div className="poker-host-actions">
                {!session.revealed ? (
                  <button
                    className="btn-poker-reveal"
                    onClick={handleReveal}
                    disabled={votes.length === 0}
                  >
                    📢 Publish Results
                  </button>
                ) : (
                  <button className="btn-poker-reset" onClick={handleReset}>
                    🔄 New Round
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Results Panel (when revealed) */}
          {session.revealed && (
            <div className="poker-results-panel">
              <div className="poker-results-glow" />
              <div className="poker-results-content">
                <div className="poker-results-avg-wrapper">
                  <div className="poker-results-label">Average Story Points</div>
                  <div className="poker-results-avg">
                    {average !== null ? average : "—"}
                  </div>
                  {nearestFib !== null && (
                    <div className="poker-results-nearest">
                      Nearest Fibonacci: <strong>{nearestFib}</strong>
                    </div>
                  )}
                </div>
                <div className="poker-vote-breakdown">
                  {votes.map((v) => (
                    <div key={v.id} className="poker-vote-chip">
                      <span className="poker-vote-chip-name">{v.participant_name}</span>
                      <span className="poker-vote-chip-val">{v.vote}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Voting Grid */}
          {!session.revealed && (
            <div className="poker-vote-section">
              <h3 className="poker-vote-title">
                {myVoteInSession
                  ? `✅ You voted: ${myVoteInSession.vote} — Change your vote?`
                  : "Pick your story point estimate"}
              </h3>
              <div className="poker-cards-grid">
                {FIBONACCI.map((val) => (
                  <button
                    key={val}
                    className={`poker-card ${
                      myVote === val || myVoteInSession?.vote === String(val)
                        ? "poker-card-selected"
                        : ""
                    }`}
                    onClick={() => handleVote(val)}
                  >
                    <span className="poker-card-val">{val}</span>
                    {typeof val === "number" && (
                      <span className="poker-card-sub">pts</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Participants List */}
          <div className="poker-participants">
            <h4 className="poker-participants-title">
              👥 Participants ({votes.length})
            </h4>
            <div className="poker-participants-list">
              {votes.length === 0 && (
                <span className="poker-empty-participants">
                  Waiting for participants to vote…
                </span>
              )}
              {votes.map((v) => (
                <div key={v.id} className="poker-participant-chip">
                  <div className="poker-participant-avatar">
                    {v.participant_name[0].toUpperCase()}
                  </div>
                  <span className="poker-participant-name">{v.participant_name}</span>
                  {session.revealed ? (
                    <span className="poker-participant-vote revealed">
                      {v.vote === 'waiting' ? '—' : v.vote}
                    </span>
                  ) : (
                    <span className={`poker-participant-vote ${v.vote === 'waiting' ? 'waiting' : 'hidden'}`}>
                      {v.vote === 'waiting' ? '...' : '✓'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
