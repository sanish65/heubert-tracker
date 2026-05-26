"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/context/AppContext";

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?"];

export default function PokerSessionPage() {
  const { sessionId } = useParams();
  const { user, currentEmployee } = useApp();
  const [session, setSession] = useState(null);
  const [votes, setVotes] = useState([]);
  const [myVote, setMyVote] = useState(null);
  const [participantName, setParticipantName] = useState("");
  const [nameEntered, setNameEntered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showMorePoints, setShowMorePoints] = useState(false);
  const pollRef = useRef(null);

  // ── Poll for session updates ───────────────────────────
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/poker?sessionId=${sessionId}`);
      if (!res.ok) {
        setError("Session not found or has expired.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSession(data.session);
      setVotes(data.votes || []);
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
    pollRef.current = setInterval(fetchSession, 2000);
    return () => clearInterval(pollRef.current);
  }, [fetchSession]);

  // Restore name from localStorage or Auth
  useEffect(() => {
    if (nameEntered) return;
    const savedName = localStorage.getItem("heubert_collab_name");
    if (savedName) {
      setParticipantName(savedName);
      setNameEntered(true);
      fetch("/api/poker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "join",
          sessionId,
          participantName: savedName,
        }),
      });
    } else if (user) {
      const authName = currentEmployee?.name || user?.user_metadata?.full_name || user?.email?.split('@')[0] || "";
      if (authName) {
        setParticipantName(authName);
      }
    }
  }, [user, currentEmployee, nameEntered, sessionId]);

  const handleJoin = () => {
    if (!participantName.trim()) return;
    const existing = votes.find((v) => v.participant_name === participantName.trim());
    if (existing) setMyVote(existing.vote);
    setNameEntered(true);
    localStorage.setItem("heubert_collab_name", participantName.trim());

    // Call join API to register the participant in the list immediately
    fetch("/api/poker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "join",
        sessionId,
        participantName: participantName.trim(),
      }),
    });
  };

  // ── Cast vote ─────────────────────────────────────────
  const handleVote = async (value) => {
    if (!session || session.revealed) return;
    
    // Toggle off if clicking the already selected vote
    const isCurrentlyVoted = myVote === value || myVoteInSession?.vote === String(value);
    const newVote = isCurrentlyVoted ? 'waiting' : String(value);
    
    setMyVote(isCurrentlyVoted ? null : value);
    
    try {
      await fetch("/api/poker", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vote",
          sessionId,
          participantName: participantName.trim(),
          vote: newVote,
        }),
      });
    } catch (_) {}
  };

  // ── Compute average ────────────────────────────────────
  const numericVotes = votes.map((v) => Number(v.vote)).filter((n) => !isNaN(n) && n > 0);
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

  const myVoteInSession = votes.find((v) => v.participant_name === participantName.trim());

  // ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="poker-standalone-shell">
        <div className="poker-standalone-loading">
          <div className="spinner" />
          <span>Loading session…</span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="poker-standalone-shell">
        <div className="poker-standalone-error">
          <span className="poker-error-icon">🃏</span>
          <h2>Session Not Found</h2>
          <p>{error || "This planning poker session does not exist or has expired."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="poker-standalone-shell">
      <header className="poker-standalone-header">
        <div className="poker-standalone-logo">
          <span>🃏</span>
          <span className="poker-standalone-logo-text">Planning Poker</span>
        </div>
        <span className="poker-standalone-status">
          {session.revealed ? "🔓 Results Published" : "🔒 Voting in Progress"}
        </span>
      </header>

      <main className="poker-standalone-main">
        <div className="poker-standalone-card">
          <h2 className="poker-standalone-story">{session.title}</h2>
          <p className="poker-standalone-story-sub">Story / Ticket being estimated</p>

          {/* Name Entry */}
          {!nameEntered ? (
            <div className="poker-standalone-name-form">
              <label className="poker-form-label">Enter your name to participate</label>
              <div className="poker-standalone-name-row">
                <input
                  className="poker-input"
                  placeholder="Your name…"
                  value={participantName}
                  onChange={(e) => setParticipantName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                  autoFocus
                />
                <button
                  className="btn-poker-primary"
                  onClick={handleJoin}
                  disabled={!participantName.trim()}
                >
                  Join →
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Active Participants Tracking (Before Reveal) */}
              {!session.revealed && votes.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                  <div className="poker-vote-count" style={{ marginBottom: 12 }}>
                    🗳️ {votes.filter(v => v.vote !== 'waiting').length} / {votes.length} voted
                  </div>
                  <div className="poker-vote-breakdown poker-participants-tracking">
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
                </div>
              )}

              {/* Revealed Results */}
              {session.revealed && (
                <div className="poker-results-panel" style={{ marginBottom: 24 }}>
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

              {/* Voting Cards */}
              {!session.revealed && (
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

              {/* Waiting indicator when not revealed */}
              {!session.revealed && myVoteInSession && (
                <div className="poker-waiting">
                  <div className="poker-waiting-dots">
                    <span /><span /><span />
                  </div>
                  <p>Waiting for the host to reveal results…</p>
                </div>
              )}
            </>
          )}

          {/* Participants */}
          <div className="poker-participants" style={{ marginTop: 24 }}>
            <h4 className="poker-participants-title">
              👥 Participants ({votes.length})
            </h4>
            <div className="poker-participants-list">
              {votes.length === 0 && (
                <span className="poker-empty-participants">
                  No votes yet — be the first!
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
      </main>

      <footer className="poker-standalone-footer">
        <span>Heubert Tracker — Planning Poker</span>
        <span className="poker-pulse">
          <span className="pulse-dot" /> Live
        </span>
      </footer>
    </div>
  );
}
