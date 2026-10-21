"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import Icon from "@/components/Icon";
import { PokerTable, PokerDeck, PokerResults, summariseVotes } from "@/components/PlanningPokerPage";

// This route sits outside the app shell, so it brings its own slim top bar.
function StandaloneBar({ sessionId, live }) {
  return (
    <header className="glass poker-standalone-bar">
      <div className="poker-standalone-brand">
        <Image src="/logo.png" alt="" width={32} height={32} className="poker-bar-logo" />
        <h1 className="poker-standalone-name">Planning poker</h1>
        {live && (
          <span className="pill pill-cyan poker-live">
            <span className="poker-live-dot" aria-hidden="true" />
            Live
          </span>
        )}
      </div>
      {sessionId && <code className="poker-id-code poker-standalone-id">{sessionId}</code>}
      <Link href="/" className="btn btn-secondary poker-standalone-back">
        <Icon name="arrow-left" size={16} strokeWidth={2} />
        Back to Tracker
      </Link>
    </header>
  );
}

export default function PokerSessionPage() {
  const { sessionId } = useParams();
  const { user, currentEmployee, animationsEnabled } = useApp();
  const { confirmDialog } = useDialog();
  const [session, setSession] = useState(null);
  const [votes, setVotes] = useState([]);
  const [myVote, setMyVote] = useState(null);
  const [participantName, setParticipantName] = useState("");
  const [nameEntered, setNameEntered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [showMorePoints, setShowMorePoints] = useState(false);
  const pollRef = useRef(null);

  // ── Poll for session updates ───────────────────────────
  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/poker?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) {
        setError("Session not found or has expired.");
        setLoading(false);
        return;
      }
      const data = await res.json();
      setSession(data.session);
      setVotes(data.votes || []);

      if (participantName && data.session?.created_by === participantName) {
        setIsHost(true);
      }
    } catch {
      setError("Unable to reach the server.");
    } finally {
      setLoading(false);
    }
  }, [sessionId, participantName]);

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

  const handleEndSession = async () => {
    if (!(await confirmDialog("End this session for everyone?", { danger: true, confirmText: "End Session" }))) return;
    await fetch("/api/poker", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "end", sessionId: session.id }) });
    fetchSession();
  };

  const summary = summariseVotes(votes);
  const myVoteInSession = votes.find((v) => v.participant_name === participantName.trim());
  const myCurrentVote = myVoteInSession && myVoteInSession.vote && myVoteInSession.vote !== "waiting"
    ? myVoteInSession.vote
    : null;
  const shellClass = `poker-standalone-shell${animationsEnabled !== false ? " is-animated" : ""}`;

  // ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={shellClass}>
        <StandaloneBar sessionId={sessionId} />
        <div className="poker-standalone-state">
          <div className="spinner" />
          <span>Loading session…</span>
        </div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className={shellClass}>
        <StandaloneBar sessionId={sessionId} />
        <div className="poker-standalone-state">
          <span className="modal-icon modal-icon-red"><Icon name="alert" size={20} /></span>
          <h2 className="section-title">Session Not Found</h2>
          <p>{error || "This planning poker session does not exist or has expired."}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={shellClass}>
      <StandaloneBar sessionId={sessionId} live />

      <main className="poker-standalone-main">
        <div className="poker-board">
          <div className="poker-board-main">
            <section className="glass-card poker-story" aria-label="Story being estimated">
              <div className="poker-story-meta">
                <span className={`pill ${session.revealed ? "pill-green" : "pill-amber"}`}>
                  <span className="poker-status-dot" aria-hidden="true" />
                  {session.revealed ? "Results Published" : "Voting in Progress"}
                </span>
                {isHost && !session.is_ended && (
                  <button type="button" className="btn btn-secondary btn-sm poker-end-btn" onClick={handleEndSession}>
                    <Icon name="flag" size={16} strokeWidth={2} />
                    End Session
                  </button>
                )}
              </div>
              <h2 className="poker-story-title">{session.title}</h2>
              <p className="poker-story-sub">Story / Ticket being estimated</p>
            </section>

            {/* Name Entry */}
            {!nameEntered && (
              <section className="glass-card poker-name-card">
                <label htmlFor="poker-name" className="poker-field-label">Enter your name to participate</label>
                <div className="poker-name-row">
                  <input
                    id="poker-name"
                    placeholder="Your name…"
                    value={participantName}
                    onChange={(e) => setParticipantName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleJoin()}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleJoin}
                    disabled={!participantName.trim()}
                  >
                    Join
                    <Icon name="chevron-right" size={16} strokeWidth={2} />
                  </button>
                </div>
              </section>
            )}

            <PokerTable
              votes={votes}
              revealed={session.revealed}
              me={nameEntered ? participantName.trim() : ""}
              nearestFib={summary.nearestFib}
              statusLabel="Results Published"
              emptyText="No votes yet — be the first!"
            />

            {nameEntered && !session.revealed && (
              <PokerDeck
                title={
                  myCurrentVote !== null
                    ? `You voted: ${myCurrentVote} — Change your vote?`
                    : "Pick your story point estimate"
                }
                isSelected={(val) => myVote === val || myVoteInSession?.vote === String(val)}
                onVote={handleVote}
                showMore={showMorePoints}
                onShowMore={() => setShowMorePoints(true)}
              />
            )}

            {/* Waiting indicator when not revealed */}
            {nameEntered && !session.revealed && myVoteInSession && (
              <div className="poker-waiting">
                <div className="poker-waiting-dots" aria-hidden="true">
                  <span /><span /><span />
                </div>
                <p>Waiting for the host to reveal results…</p>
              </div>
            )}
          </div>

          {nameEntered && session.revealed && (
            <aside className="poker-board-side">
              <PokerResults votes={votes} summary={summary} />
            </aside>
          )}
        </div>
      </main>

      {session.is_ended && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="poker-ended-title">
          <div className="modal-content poker-ended">
            <span className="modal-icon"><Icon name="flag" size={20} /></span>
            <h2 id="poker-ended-title">This Poker Session has ended</h2>
            <p>The host has concluded this session. Thank you for voting!</p>
            <p className="poker-ended-sub">Please wait for the next sprint&apos;s session to begin.</p>
            <button type="button" className="btn btn-primary" onClick={() => { window.location.href = "/"; }}>
              Exit to Home
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
