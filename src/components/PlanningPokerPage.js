"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import ShareQRModal from "@/components/ShareQRModal";
import Icon from "@/components/Icon";
import Avatar from "@/components/Avatar";

export const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?"];
// Hidden behind the "Others" card until someone asks for them.
const EXTRA_POINTS = [34, 55, 89];

const hasVoted = (v) => Boolean(v.vote) && v.vote !== "waiting";

// The average of the numeric votes ("?" and empty seats left out), the Fibonacci
// number nearest it, and how many votes each card got, in deck order.
export function summariseVotes(votes) {
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

  const counts = {};
  votes.filter(hasVoted).forEach((v) => { counts[v.vote] = (counts[v.vote] || 0) + 1; });
  const top = Math.max(0, ...Object.values(counts));
  const perCard = FIBONACCI.map(String)
    .filter((card) => counts[card])
    .map((card) => ({
      card,
      count: counts[card],
      width: Math.round((counts[card] / top) * 100),
      isTop: counts[card] === top,
    }));

  return { average, nearestFib, perCard };
}

function PokerSeat({ vote, revealed, isMe, isNearest, order }) {
  const name = vote.participant_name || "";
  const voted = hasVoted(vote);
  const state = voted
    ? (revealed ? `Voted ${vote.vote}` : "Ready")
    : (revealed ? "No vote" : "Thinking...");
  const label = `${name}${isMe ? " (you)" : ""}: ${
    voted ? (revealed ? `voted ${vote.vote}` : "has voted") : "has not voted"
  }`;

  return (
    <div role="listitem" aria-label={label} className="poker-seat">
      {voted && !revealed && (
        <div className="poker-seat-card poker-seat-back" aria-hidden="true">
          <span className="poker-seat-check"><Icon name="check" size={14} strokeWidth={2.6} /></span>
        </div>
      )}
      {voted && revealed && (
        <div
          className={`poker-seat-card poker-seat-face${isNearest ? " is-nearest" : ""}`}
          style={{ animationDelay: `${order * 60}ms` }}
          aria-hidden="true"
        >
          {vote.vote}
        </div>
      )}
      {!voted && (
        <div className="poker-seat-card poker-seat-empty" aria-hidden="true">
          {revealed ? "—" : "…"}
        </div>
      )}
      <div className="poker-seat-who">
        <Avatar name={name} isMe={isMe} className="avatar poker-seat-avatar" aria-hidden="true" />
        <span className="poker-seat-name" title={name}>{isMe ? "You" : name}</span>
      </div>
      <span className={`poker-seat-state${voted && !revealed ? " is-ready" : ""}${!voted && !revealed ? " is-thinking" : ""}`}>
        {state}
      </span>
    </div>
  );
}

// Everyone in the session seated around the table: their card face-down once they
// have voted, face-up after the reveal, and the "x / n voted" count in the middle.
export function PokerTable({ votes, revealed, me, nearestFib, statusLabel, emptyText, children }) {
  const votedCount = votes.filter((v) => v.vote !== "waiting").length;
  const pct = votes.length > 0 ? Math.round((votedCount / votes.length) * 100) : 0;
  const half = Math.ceil(votes.length / 2);

  const seatRow = (list, offset, label) =>
    list.length > 0 && (
      <div role="list" aria-label={label} className="poker-seats">
        {list.map((v, i) => (
          <PokerSeat
            key={v.id}
            vote={v}
            revealed={revealed}
            isMe={Boolean(me) && v.participant_name === me}
            isNearest={nearestFib !== null && String(v.vote) === String(nearestFib)}
            order={offset + i}
          />
        ))}
      </div>
    );

  return (
    <section className="glass-card poker-table" aria-label="Poker table">
      {seatRow(votes.slice(0, half), 0, "Participants, top of table")}
      <div className="poker-felt">
        <span className="eyebrow">{revealed ? statusLabel : "Votes are face-down"}</span>
        <div className="poker-felt-count">
          <span className="poker-felt-num">{votedCount} / {votes.length}</span>
          <span>voted</span>
        </div>
        <div
          role="progressbar"
          aria-label="Votes in"
          aria-valuemin={0}
          aria-valuemax={votes.length}
          aria-valuenow={votedCount}
          className="poker-progress"
        >
          <div className="poker-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        {votes.length === 0 && <p className="poker-felt-empty">{emptyText}</p>}
        {children}
      </div>
      {seatRow(votes.slice(half), half, "Participants, bottom of table")}
    </section>
  );
}

export function PokerDeck({ title, isSelected, onVote, showMore, onShowMore }) {
  return (
    <section className="glass-card poker-deck" aria-labelledby="poker-deck-title">
      <div className="poker-deck-head">
        <h2 id="poker-deck-title" className="section-title">{title}</h2>
        <span className="poker-deck-hint">Story points · Fibonacci</span>
      </div>
      <div role="group" aria-label="Your estimate" className="poker-deck-cards">
        {FIBONACCI.filter((val) => showMore || !EXTRA_POINTS.includes(val)).map((val) => {
          const selected = isSelected(val);
          return (
            <button
              key={val}
              type="button"
              aria-pressed={selected}
              aria-label={typeof val === "number" ? `${val} points` : "Not sure"}
              className={`poker-deck-card${selected ? " is-selected" : ""}`}
              onClick={() => onVote(val)}
            >
              <span className="poker-deck-card-val">{val}</span>
              {typeof val === "number" && <span className="poker-deck-card-sub">pts</span>}
            </button>
          );
        })}
        {!showMore && (
          <button
            type="button"
            className="poker-deck-card poker-deck-more"
            aria-label="Show more story points"
            onClick={onShowMore}
          >
            <span className="poker-deck-card-val">...</span>
            <span className="poker-deck-card-sub">Others</span>
          </button>
        )}
      </div>
    </section>
  );
}

export function PokerResults({ votes, summary }) {
  const { average, nearestFib, perCard } = summary;
  return (
    <section className="glass-card poker-results" aria-labelledby="poker-results-title">
      <h2 id="poker-results-title" className="section-title">Results</h2>
      <div className="poker-results-avg">
        <span className="poker-results-num">{average !== null ? average : "—"}</span>
        <span className="poker-results-label">Average Story Points</span>
      </div>
      {nearestFib !== null && (
        <div className="poker-results-tile">
          <span className="poker-results-label">Nearest Fibonacci</span>
          <span className="poker-results-nearest">{nearestFib}</span>
        </div>
      )}
      {perCard.length > 0 && (
        <div className="poker-dist">
          <span className="eyebrow">Votes per card</span>
          {perCard.map((d) => (
            <div key={d.card} className="poker-dist-row">
              <span className="poker-dist-card">{d.card}</span>
              <div className="poker-dist-track">
                <div className={`poker-dist-bar${d.isTop ? " is-top" : ""}`} style={{ width: `${d.width}%` }} />
              </div>
              <span className="poker-dist-count">{d.count} {d.count === 1 ? "vote" : "votes"}</span>
            </div>
          ))}
        </div>
      )}
      <div className="poker-who">
        {votes.map((v) => (
          <span key={v.id} className="pill pill-gray poker-who-pill">
            {v.participant_name}
            <span className="mono poker-who-vote">{hasVoted(v) ? v.vote : "—"}</span>
          </span>
        ))}
      </div>
    </section>
  );
}

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

  const { isAdmin, animationsEnabled, currentEmployee } = useApp();
  const { confirmDialog } = useDialog();

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
        const res = await fetch(`/api/poker?sessionId=${encodeURIComponent(sid)}`);
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
          const res = await fetch(`/api/poker?sessionId=${encodeURIComponent(savedId)}`);
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
            if (!data.session.is_ended) joinParticipants(savedId, savedName);
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

  // Puts `name` in the session's participant list, so everyone sees them before they vote.
  // The API leaves an existing row alone, so this is safe to repeat.
  const joinParticipants = (sid, name) =>
    fetch("/api/poker", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "join", sessionId: sid, participantName: name }),
    }).catch(() => {});

  // ── Join session (participant) ─────────────────────────
  const handleJoinSession = async () => {
    if (!joinName.trim() || !joinSessionId.trim()) {
      setError("Please enter your name and the session ID.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/poker?sessionId=${encodeURIComponent(joinSessionId.trim())}`);
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
      await joinParticipants(joinSessionId.trim(), joinName.trim());
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
    if (!(await confirmDialog("Are you sure you want to end this session? This will lock the board for everyone.", { danger: true, confirmText: "End Session" }))) return;
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

  const summary = summariseVotes(votes);
  const myVoteInSession = votes.find((v) => v.participant_name === participantName);
  const votedCount = votes.filter((v) => v.vote !== "waiting").length;

  const leaveSession = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setView("home");
    setSession(null);
    setVotes([]);
    setMyVote(null);
    setError("");
    localStorage.removeItem("heubert_poker_session_id");
  };

  // Join one of the active sessions listed on the home view, as the name you last used
  // here or, the first time, your own. Without a name it only fills in the Join form.
  const openRecentSession = (s) => {
    const name = participantName || currentEmployee?.name || "";
    setJoinSessionId(s.id);
    setJoinName(name);
    if (name) {
      setLoading(true);
      setError("");
      fetch(`/api/poker?sessionId=${encodeURIComponent(s.id)}`)
        .then(res => res.json())
        .then(async (data) => {
          if (data.error) throw new Error(data.error);
          setSession(data.session);
          setVotes(data.votes || []);
          setParticipantName(name);
          const host = data.session.created_by === name;
          setIsHost(host);
          setShareUrl(host ? buildShareUrl(s.id) : "");
          const myExisting = (data.votes || []).find((v) => v.participant_name === name);
          setMyVote(myExisting && myExisting.vote !== "waiting" ? myExisting.vote : null);
          localStorage.setItem("heubert_poker_session_id", data.session.id);
          localStorage.setItem("heubert_collab_name", name);
          setView("host");
          startPolling(s.id);
          // Without this you could watch the session but nobody saw you in it.
          await joinParticipants(s.id, name);
        })
        .catch(e => setError(e.message))
        .finally(() => setLoading(false));
    }
  };

  const role = isHost
    ? { label: "Host", pill: "pill-blue" }
    : isAdmin
      ? { label: "Admin", pill: "pill-violet" }
      : { label: "Participant", pill: "pill-gray" };

  const activeSessions = recentSessions.filter(s => !s.is_ended);
  const inSession = view === "host" && session;

  // ──────────────────────────────────────────────────────
  // Lock body scroll when enlarged
  useEffect(() => {
    document.body.style.overflow = isEnlarged ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isEnlarged]);

  return (
    <div className={`poker-page${isEnlarged ? " poker-page-enlarged" : ""}${animationsEnabled !== false ? " is-animated" : ""}`}>
      <div className="poker-toolbar">
        {inSession && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={leaveSession}>
            <Icon name="arrow-left" size={16} />
            Exit
          </button>
        )}
        {isEnlarged && <span className="poker-toolbar-title">Planning Poker</span>}
        <div className="poker-toolbar-actions">
          {inSession && (
            <button
              type="button"
              className={`btn-icon poker-sound${soundEnabled ? "" : " is-off"}`}
              onClick={toggleSound}
              aria-pressed={!soundEnabled}
              aria-label={soundEnabled ? "Mute reveal sound" : "Unmute reveal sound"}
              title={soundEnabled ? "Mute reveal sound" : "Unmute reveal sound"}
            >
              <Icon name="bell" />
            </button>
          )}
          {inSession && (isHost || isAdmin) && !session.is_ended && (
            <button type="button" className="btn btn-secondary poker-end-btn" onClick={handleEndSession}>
              <Icon name="flag" size={16} strokeWidth={2} />
              End Session
            </button>
          )}
          {inSession && (isHost || isAdmin) && session.is_ended && (
            <button type="button" className="btn btn-primary" onClick={() => { setView("home"); setSession(null); }}>
              <Icon name="arrow-left" size={16} />
              Back to Hub
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setIsEnlarged(e => !e)}
            title={isEnlarged ? "Exit fullscreen" : "Fullscreen"}
          >
            {isEnlarged && <Icon name="x" size={16} />}
            {isEnlarged ? "Exit fullscreen" : "Fullscreen"}
          </button>
        </div>
      </div>

      {isRestoring && (
        <div className="poker-loading">
          <div className="spinner" />
          <p>Loading your session...</p>
        </div>
      )}

      {/* ── HOME / ENTRY ── */}
      {!isRestoring && view === "home" && (
        <div className="poker-home">
          <div className="poker-entry-grid">
            {/* Create Session */}
            <section className="glass-card poker-entry" aria-labelledby="poker-create-title">
              <div className="poker-entry-head">
                <span className="modal-icon"><Icon name="plus" size={20} /></span>
                <div>
                  <h2 id="poker-create-title" className="section-title">Create Session</h2>
                  <p className="poker-entry-sub">Start a new planning poker session as the host</p>
                </div>
              </div>
              <label className="poker-field">
                <span>Your Name</span>
                <input
                  type="text"
                  placeholder="e.g. Alice"
                  value={creatorName}
                  onChange={(e) => setCreatorName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateSession()}
                />
              </label>
              <label className="poker-field">
                <span>Sprint</span>
                <input
                  type="text"
                  placeholder="e.g. Sprint 24"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateSession()}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary poker-entry-btn"
                onClick={handleCreateSession}
                disabled={loading}
              >
                {loading ? <span className="poker-spinner" /> : "Create Session"}
              </button>
            </section>

            {/* Join Session */}
            <section className="glass-card poker-entry" aria-labelledby="poker-join-title">
              <div className="poker-entry-head">
                <span className="modal-icon"><Icon name="link" size={20} /></span>
                <div>
                  <h2 id="poker-join-title" className="section-title">Join Session</h2>
                  <p className="poker-entry-sub">Enter a session ID shared by the host to join</p>
                </div>
              </div>
              <label className="poker-field">
                <span>Your Name</span>
                <input
                  type="text"
                  placeholder="e.g. Bob"
                  value={joinName}
                  onChange={(e) => setJoinName(e.target.value)}
                />
              </label>
              <label className="poker-field">
                <span>Session ID</span>
                <input
                  type="text"
                  className="mono"
                  placeholder="Paste session ID here"
                  value={joinSessionId}
                  onChange={(e) => setJoinSessionId(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleJoinSession()}
                />
              </label>
              <button
                type="button"
                className="btn btn-primary poker-entry-btn"
                onClick={handleJoinSession}
                disabled={loading}
              >
                {loading ? <span className="poker-spinner" /> : "Join Session"}
              </button>
            </section>
          </div>

          {error && (
            <div className="form-error" role="alert">
              <Icon name="alert" size={16} />
              {error}
            </div>
          )}

          {activeSessions.length > 0 && (
            <section className="glass-card poker-recent" aria-labelledby="poker-recent-title">
              <h2 id="poker-recent-title" className="section-title">Active Sessions</h2>
              <ul className="poker-recent-list">
                {activeSessions.map(s => (
                  <li key={s.id}>
                    <button type="button" className="poker-recent-row" onClick={() => openRecentSession(s)}>
                      <span className="poker-recent-main">
                        <span className="poker-recent-title">{s.title}</span>
                        <span className="poker-recent-meta">
                          By {s.created_by} · <span className="mono">{new Date(s.created_at).toLocaleDateString()}</span>
                        </span>
                      </span>
                      <code className="poker-recent-id">{s.id}</code>
                      <span className={`pill ${s.revealed ? "pill-green" : "pill-amber"}`}>
                        {s.revealed ? "Results Revealed" : "Voting in Progress"}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* How it works */}
          <section className="glass-card poker-howto" aria-labelledby="poker-howto-title">
            <h2 id="poker-howto-title" className="eyebrow">How it works</h2>
            <ol className="poker-howto-steps">
              {[
                "Host creates a session with the sprint title",
                "Share the generated link with participants",
                "Everyone picks a Fibonacci story point card",
                "Host reveals results — average shown instantly",
              ].map((text, i) => (
                <li key={i} className="poker-step">
                  <span className="poker-step-num" aria-hidden="true">{i + 1}</span>
                  <span>{text}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}

      {/* ── SESSION VIEW ── */}
      {inSession && (
        <div className="poker-session">
          {/* Share strip (host only) */}
          {isHost && shareUrl && (
            <section className="glass poker-share" aria-label="Share session">
              <label className="poker-share-field">
                <Icon name="link" size={15} strokeWidth={2} />
                <span className="poker-share-text">Share</span>
                <input readOnly aria-label="Share link" value={shareUrl} />
              </label>
              <button
                type="button"
                className={`btn poker-share-btn${copied ? " is-copied" : ""}`}
                onClick={handleCopy}
              >
                <Icon name={copied ? "check" : "copy"} size={15} strokeWidth={2} />
                {copied ? "Copied!" : "Copy"}
              </button>
              <button
                type="button"
                className="btn poker-share-btn"
                onClick={() => setShowQR(true)}
                aria-label="Show QR code"
                title="Show QR code"
              >
                <Icon name="qr" size={15} strokeWidth={2} />
                QR
              </button>
              <span className="poker-share-id">
                ID
                <code className="poker-id-code">{session.id}</code>
              </span>
            </section>
          )}

          <div className="poker-board">
            <div className="poker-board-main">
              <section className="glass-card poker-story" aria-label="Story being estimated">
                <div className="poker-story-meta">
                  <span className={`pill ${session.revealed ? "pill-green" : "pill-amber"}`}>
                    <span className="poker-status-dot" aria-hidden="true" />
                    {session.revealed ? "Results Revealed" : "Voting in Progress"}
                  </span>
                  <span className={`pill ${role.pill}`}>{role.label}</span>
                </div>
                <h2 className="poker-story-title">{session.title}</h2>
              </section>

              <PokerTable
                votes={votes}
                revealed={session.revealed}
                me={participantName}
                nearestFib={summary.nearestFib}
                statusLabel="Results Revealed"
                emptyText="Waiting for participants to vote…"
              >
                {isHost && !session.is_ended && (
                  !session.revealed ? (
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleReveal}
                      disabled={votedCount === 0}
                    >
                      <Icon name="eye" size={16} strokeWidth={2} />
                      Publish Results
                    </button>
                  ) : (
                    <button type="button" className="btn btn-secondary" onClick={handleReset}>
                      <Icon name="refresh" size={16} strokeWidth={2} />
                      New Round
                    </button>
                  )
                )}
              </PokerTable>

              {!session.revealed && !session.is_ended && (
                <PokerDeck
                  title={
                    myVoteInSession && hasVoted(myVoteInSession)
                      ? `You voted: ${myVoteInSession.vote} — Change your vote?`
                      : "Pick your story point estimate"
                  }
                  isSelected={(val) => myVote === val || myVoteInSession?.vote === String(val)}
                  onVote={handleVote}
                  showMore={showMorePoints}
                  onShowMore={() => setShowMorePoints(true)}
                />
              )}
            </div>

            {session.revealed && (
              <aside className="poker-board-side">
                <PokerResults votes={votes} summary={summary} />
              </aside>
            )}
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
