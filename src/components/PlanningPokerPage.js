"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import ShareQRModal from "@/components/ShareQRModal";

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
  const [showQR, setShowQR] = useState(false);
  const [participantName, setParticipantName] = useState("");
  const [showMorePoints, setShowMorePoints] = useState(false);
  const [recentSessions, setRecentSessions] = useState([]);
  const [isRestoring, setIsRestoring] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(() => localStorage.getItem("heubert_poker_sound") !== "off");
  const pollRef = useRef(null);
  const [shareUrl, setShareUrl] = useState("");
  const prevRevealedRef = useRef(false);

  const { isAdmin } = useApp();

  const playChime = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      [[523.25, 0], [659.25, 0.18], [783.99, 0.36], [1046.5, 0.54]].forEach(([freq, delay]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.28, t + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.7);
      });
      setTimeout(() => ctx.close(), 2000);
    } catch (_) {}
  };

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem("heubert_poker_sound", next ? "on" : "off");
      return next;
    });
  };

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

  useEffect(() => {
    const revealed = session?.revealed ?? false;
    if (revealed && !prevRevealedRef.current && soundEnabled) playChime();
    prevRevealedRef.current = revealed;
  }, [session?.revealed, soundEnabled]);

  useEffect(() => {
    if (view === "home") {
      fetch("/api/poker")
        .then(res => res.json())
        .then(data => { if (data.sessions) setRecentSessions(data.sessions); })
        .catch(() => {});
    }
  }, [view]);

  const buildShareUrl = (sid) => {
    if (typeof window !== "undefined") {
      return `${window.location.origin}/planning-poker/${sid}`;
    }
    return "";
  };

  // ── Auto-restore session from localStorage ──────────────────
  useEffect(() => {
    const savedId = localStorage.getItem("heubert_poker_session_id");
    const savedName = localStorage.getItem("heubert_collab_name");
    
    if (savedName) {
      setParticipantName(savedName);
      setJoinName(savedName);
      setCreatorName(savedName);
    }
    
    if (savedId) {
      setJoinSessionId(savedId);
      const autoJoin = async () => {
        try {
          const res = await fetch(`/api/poker?sessionId=${savedId}`);
          if (!res.ok) {
            localStorage.removeItem("heubert_poker_session_id");
            setIsRestoring(false);
            return;
          }
          const data = await res.json();
          setSession(data.session);
          setVotes(data.votes || []);
          
          if (savedName) {
            const isCreator = savedName === data.session.created_by;
            if (isCreator) {
              setIsHost(true);
              setShareUrl(buildShareUrl(savedId));
            }
            const myExisting = (data.votes || []).find((v) => v.participant_name === savedName);
            if (myExisting && myExisting.vote !== 'waiting') setMyVote(myExisting.vote);
          }
          
          setView("host");
          startPolling(savedId);
        } catch {
          localStorage.removeItem("heubert_poker_session_id");
        } finally {
          setIsRestoring(false);
        }
      };
      autoJoin();
    } else {
      setIsRestoring(false);
    }
  }, [startPolling]);

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
      localStorage.setItem("heubert_poker_session_id", data.session.id);
      localStorage.setItem("heubert_collab_name", creatorName.trim());
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
      setMyVote(myExisting && myExisting.vote !== 'waiting' ? myExisting.vote : null);
      localStorage.setItem("heubert_poker_session_id", joinSessionId.trim());
      localStorage.setItem("heubert_collab_name", joinName.trim());
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

  const handleEndSession = async () => {
    if (!session || (!isHost && !isAdmin)) return;
    if (!confirm("Are you sure you want to end this session? This will lock the board for everyone.")) return;
    try {
      await fetch("/api/poker", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end", sessionId: session.id }),
      });
      if (pollRef.current) clearInterval(pollRef.current);
      setView("home");
      setSession(null);
      setVotes([]);
      setMyVote(null);
      localStorage.removeItem("heubert_poker_session_id");
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

      {isRestoring && (
        <div className="retro-ended-overlay">
          <div className="retro-ended-message" style={{ background: 'transparent', boxShadow: 'none' }}>
            <span className="poker-spinner" style={{ width: '40px', height: '40px', borderTopColor: 'var(--accent-indigo)' }}></span>
            <h2 style={{ marginTop: '20px' }}>Loading your session...</h2>
          </div>
        </div>
      )}

      {/* ── HOME / ENTRY ── */}
      {!isRestoring && view === "home" && (
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
                  <label>Sprint</label>
                  <input
                    className="poker-input"
                    type="text"
                    placeholder="e.g. Sprint 24"
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

          {recentSessions.filter(s => !s.is_ended).length > 0 && (
            <div className="retro-recent-sessions">
              <div className="retro-recent-section">
                <h3 className="retro-recent-title">🌐 Active Sessions</h3>
                <div className="retro-recent-grid">
                  {recentSessions.filter(s => !s.is_ended).map(s => (
                    <button key={s.id} className="retro-recent-card" onClick={() => {
                      setJoinSessionId(s.id);
                      setJoinName(participantName || "");
                      if (participantName) {
                        setLoading(true);
                        fetch(`/api/poker?sessionId=${s.id}`)
                          .then(res => res.json())
                          .then(data => {
                            if (data.error) throw new Error(data.error);
                            setSession(data.session);
                            setVotes(data.votes || []);
                            setParticipantName(participantName);
                            localStorage.setItem("heubert_poker_session_id", data.session.id);
                            localStorage.setItem("heubert_collab_name", participantName);
                            setView("host");
                            startPolling(s.id);
                          })
                          .catch(e => setError(e.message))
                          .finally(() => setLoading(false));
                      }
                    }}>
                      <div className="retro-recent-card-top">
                        <span className="retro-recent-emoji">🗳️</span>
                        <div className="retro-recent-meta">
                          <h4>{s.title}</h4>
                          <span>By {s.created_by} · {new Date(s.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* How it works */}
          <div className="poker-howto">
            <h4 className="poker-howto-title">How it works</h4>
            <div className="poker-howto-steps">
              {[
                { icon: "1️⃣", text: "Host creates a session with the sprint title" },
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
            {/* Row 1: exit | title + badge | end/back action */}
            <div className="poker-session-toprow">
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
                    localStorage.removeItem("heubert_poker_session_id");
                  }}
                >
                  ← Exit
                </button>
                <div>
                  <h2 className="poker-session-title">{session.title}</h2>
                  <span className="poker-session-badge">
                    {isHost ? "🎯 Host" : isAdmin ? "🛡️ Admin" : "👤 Participant"}
                  </span>
                </div>
              </div>

              <div className="poker-session-actions">
                {(isHost || isAdmin) && !session.is_ended && (
                  <button className="retro-end-session-btn" onClick={handleEndSession}>
                    🏁 End Session
                  </button>
                )}
                {(isHost || isAdmin) && session.is_ended && (
                  <button className="btn-poker-primary" onClick={() => { setView("home"); setSession(null); }}>
                    ← Back to Hub
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: share strip (host only) */}
            {isHost && shareUrl && (
              <div className="poker-share-strip">
                <span className="poker-share-label">🔗 Share</span>
                <input className="poker-share-input" readOnly value={shareUrl} />
                <button className={`poker-copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy}>
                  {copied ? "✅ Copied!" : "📋 Copy"}
                </button>
                <button className="poker-qr-btn" onClick={() => setShowQR(true)} title="Show QR code">
                  📱 QR
                </button>
                <span className="poker-session-id-label">ID:</span>
                <code className="poker-session-id">{session.id}</code>
              </div>
            )}
          </div>



          {/* Status Bar */}
          <div className="poker-status-bar">
            <div className="poker-status-info">
              <span className="poker-vote-count">
                🗳️ {votes.filter(v => v.vote !== 'waiting').length} / {votes.length} voted
              </span>
              <span
                className={`poker-reveal-badge ${
                  session.revealed ? "revealed" : "hidden"
                }`}
              >
                {session.revealed ? "🔓 Results Revealed" : "🔒 Voting in Progress"}
              </span>
            </div>
            <div className="poker-host-actions">
              {isHost && !session.is_ended && (
                <>
                  {!session.revealed ? (
                    <button
                      className="btn-poker-reveal"
                      onClick={handleReveal}
                      disabled={votes.filter(v => v.vote !== 'waiting').length === 0}
                    >
                      📢 Publish Results
                    </button>
                  ) : (
                    <button className="btn-poker-reset" onClick={handleReset}>
                      🔄 New Round
                    </button>
                  )}
                </>
              )}
              <button
                className="poker-sound-toggle"
                onClick={toggleSound}
                title={soundEnabled ? "Mute reveal sound" : "Unmute reveal sound"}
              >
                {soundEnabled ? "🔔" : "🔕"}
              </button>
            </div>
          </div>

          {/* Active Participants Tracking (Before Reveal) */}
          {!session.revealed && votes.length > 0 && (
            <div className="poker-vote-breakdown poker-participants-tracking" style={{ marginBottom: 16 }}>
              {votes.map((v) => {
                const hasVoted = v.vote && v.vote !== 'waiting';
                return (
                  <div key={v.id} className={`poker-vote-chip ${hasVoted ? 'voted' : 'waiting'}`} style={{ opacity: hasVoted ? 1 : 0.65 }}>
                    <span className="poker-vote-chip-name">{v.participant_name}</span>
                    <span className="poker-vote-chip-val" style={{ fontSize: '0.8rem', color: hasVoted ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                      {hasVoted ? '✅ Ready' : <span className="pulse-opacity">🤔 Thinking...</span>}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

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
          {!session.revealed && !session.is_ended && (
            <div className="poker-vote-section">
              <h3 className="poker-vote-title">
                {myVoteInSession
                  ? `✅ You voted: ${myVoteInSession.vote} — Change your vote?`
                  : "Pick your story point estimate"}
              </h3>
              <div className="poker-cards-grid">
                {FIBONACCI.filter(val => showMorePoints || ![34, 55, 89].includes(val)).map((val) => (
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
                {!showMorePoints && (
                  <button
                    className="poker-card"
                    onClick={() => setShowMorePoints(true)}
                  >
                    <span className="poker-card-val">...</span>
                    <span className="poker-card-sub">Others</span>
                  </button>
                )}
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

      <ShareQRModal
        isOpen={showQR}
        onClose={() => setShowQR(false)}
        url={shareUrl}
        title={session?.title}
      />
    </div>
  );
}
