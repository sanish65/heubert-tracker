"use client";

import { useState, useEffect, useCallback, useRef } from "react";

const COLUMNS = [
  { key: "went_well", label: "What Went Well?", emoji: "🎉", color: "green" },
  { key: "improve",   label: "Needs Improvement", emoji: "🔧", color: "amber" },
  { key: "focus",     label: "Focus More On",    emoji: "🎯", color: "indigo" },
];

export default function RetrospectivePage() {
  const [view, setView]               = useState("home");
  const [isEnlarged, setIsEnlarged]   = useState(false);
  const [session, setSession]         = useState(null);
  const [cards, setCards]             = useState([]);
  const [participantName, setParticipantName] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [joinName, setJoinName]       = useState("");
  const [joinSessionId, setJoinSessionId] = useState("");
  const [isHost, setIsHost]           = useState(false);
  const [shareUrl, setShareUrl]       = useState("");
  const [copied, setCopied]           = useState(false);
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  // compose state: which column is being written to
  const [activeCompose, setActiveCompose] = useState(null); // null | 'went_well' | 'improve' | 'focus'
  const [composeText, setComposeText] = useState("");
  const [pinning, setPinning]         = useState(false);
  const pollRef = useRef(null);
  const composeRef = useRef(null);

  // ── Polling ────────────────────────────────────────────
  const fetchBoard = useCallback(async (sid) => {
    try {
      const res = await fetch(`/api/retro?sessionId=${sid}`);
      if (!res.ok) return;
      const data = await res.json();
      setSession(data.session);
      setCards(data.cards || []);
    } catch (_) {}
  }, []);

  const startPolling = useCallback((sid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchBoard(sid), 2500);
  }, [fetchBoard]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  // Body scroll lock
  useEffect(() => {
    document.body.style.overflow = isEnlarged ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isEnlarged]);

  // Focus textarea when compose opens
  useEffect(() => {
    if (activeCompose && composeRef.current) composeRef.current.focus();
  }, [activeCompose]);

  // Close compose on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setActiveCompose(null); setComposeText(""); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Create session ─────────────────────────────────────
  const handleCreate = async () => {
    if (!sessionTitle.trim() || !creatorName.trim()) {
      setError("Please enter your name and a session title.");
      return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/retro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: sessionTitle.trim(), createdBy: creatorName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSession(data.session);
      setCards([]);
      setParticipantName(creatorName.trim());
      setIsHost(true);
      const url = `${window.location.origin}/retrospective/${data.session.id}`;
      setShareUrl(url);
      setView("board");
      startPolling(data.session.id);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // ── Join session ───────────────────────────────────────
  const handleJoin = async () => {
    if (!joinName.trim() || !joinSessionId.trim()) {
      setError("Please enter your name and the session ID.");
      return;
    }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/retro?sessionId=${joinSessionId.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Session not found");
      setSession(data.session);
      setCards(data.cards || []);
      setParticipantName(joinName.trim());
      setIsHost(false);
      setView("board");
      startPolling(joinSessionId.trim());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // ── Pin card ───────────────────────────────────────────
  const handlePin = async () => {
    if (!composeText.trim() || !activeCompose || !session) return;
    setPinning(true);
    try {
      await fetch("/api/retro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_card",
          sessionId: session.id,
          columnType: activeCompose,
          content: composeText.trim(),
          author: participantName,
        }),
      });
      await fetchBoard(session.id);
      setActiveCompose(null);
      setComposeText("");
    } catch (_) {}
    finally { setPinning(false); }
  };

  // ── Delete card ────────────────────────────────────────
  const handleDelete = async (cardId) => {
    try {
      await fetch(`/api/retro?cardId=${cardId}`, { method: "DELETE" });
      setCards(prev => prev.filter(c => c.id !== cardId));
    } catch (_) {}
  };

  // ── Copy link ──────────────────────────────────────────
  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const cardsFor = (colKey) => cards.filter(c => c.column_type === colKey);

  // ──────────────────────────────────────────────────────
  return (
    <div className={`retro-page${isEnlarged ? " retro-page-enlarged" : ""}`}>

      {/* Topbar */}
      <div className="retro-topbar">
        {isEnlarged && <span className="retro-topbar-title">🗂️ Retrospective</span>}
        <button
          className="btn-enlarge retro-enlarge-btn"
          onClick={() => setIsEnlarged(e => !e)}
          title={isEnlarged ? "Exit fullscreen" : "Fullscreen"}
        >
          {isEnlarged ? "✕" : "⛶"}
        </button>
      </div>

      {/* ── HOME ── */}
      {view === "home" && (
        <div className="retro-home">
          <div className="retro-hero">
            <span className="retro-hero-icon">🗂️</span>
            <h2 className="retro-hero-title">Sprint Retrospective</h2>
            <p className="retro-hero-sub">
              Collaboratively reflect on your sprint. Pick sticky cards and pin them
              to the board under <em>What Went Well</em>, <em>Needs Improvement</em>,
              or <em>Focus More On</em>.
            </p>
          </div>

          <div className="retro-entry-grid">
            {/* Create */}
            <div className="retro-entry-card">
              <div className="retro-entry-card-header">
                <span className="retro-entry-icon">🚀</span>
                <h3>Create Session</h3>
                <p>Start a new retro board as the facilitator</p>
              </div>
              <div className="poker-form">
                <div className="poker-form-group">
                  <label>Your Name</label>
                  <input className="poker-input" placeholder="e.g. Alice"
                    value={creatorName} onChange={e => setCreatorName(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleCreate()} />
                </div>
                <div className="poker-form-group">
                  <label>Sprint / Board Title</label>
                  <input className="poker-input" placeholder="e.g. Sprint 42 Retro"
                    value={sessionTitle} onChange={e => setSessionTitle(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleCreate()} />
                </div>
                <button className="btn-poker-primary" onClick={handleCreate} disabled={loading}>
                  {loading ? <span className="poker-spinner" /> : "🚀 Create Board"}
                </button>
              </div>
            </div>

            {/* Join */}
            <div className="retro-entry-card retro-entry-card-join">
              <div className="retro-entry-card-header">
                <span className="retro-entry-icon">🔗</span>
                <h3>Join Session</h3>
                <p>Enter a session ID to join an existing board</p>
              </div>
              <div className="poker-form">
                <div className="poker-form-group">
                  <label>Your Name</label>
                  <input className="poker-input" placeholder="e.g. Bob"
                    value={joinName} onChange={e => setJoinName(e.target.value)} />
                </div>
                <div className="poker-form-group">
                  <label>Session ID</label>
                  <input className="poker-input" placeholder="Paste session ID"
                    value={joinSessionId} onChange={e => setJoinSessionId(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleJoin()} />
                </div>
                <button className="btn-poker-secondary" onClick={handleJoin} disabled={loading}>
                  {loading ? <span className="poker-spinner" /> : "🔗 Join Board"}
                </button>
              </div>
            </div>
          </div>

          {error && <div className="poker-error">{error}</div>}

          {/* Column preview */}
          <div className="retro-preview">
            {COLUMNS.map(col => (
              <div key={col.key} className={`retro-preview-col retro-col-${col.color}`}>
                <span className="retro-preview-emoji">{col.emoji}</span>
                <span className="retro-preview-label">{col.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── BOARD ── */}
      {view === "board" && session && (
        <div className="retro-board-view">
          {/* Board header */}
          <div className="retro-board-header">
            <div className="retro-board-meta">
              <button className="poker-back-btn" onClick={() => {
                if (pollRef.current) clearInterval(pollRef.current);
                setView("home"); setSession(null); setCards([]); setError("");
              }}>← Back</button>
              <div>
                <h2 className="retro-board-title">{session.title}</h2>
                <span className="retro-board-badge">{isHost ? "🎯 Facilitator" : "👤 Participant"} · {cards.length} card{cards.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
            {isHost && shareUrl && (
              <div className="poker-share-box">
                <span className="poker-share-label">🔗 Shareable Link</span>
                <div className="poker-share-row">
                  <input className="poker-share-input" readOnly value={shareUrl} />
                  <button className={`poker-copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy}>
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

          {/* ── Card Stacks (pick a card) ── */}
          <div className="retro-stack-tray">
            <p className="retro-stack-tray-label">
              {participantName ? `Hi ${participantName} — pick a card to add your thought:` : "Pick a card to add your thought:"}
            </p>
            <div className="retro-stacks">
              {COLUMNS.map(col => (
                <button
                  key={col.key}
                  className={`retro-stack retro-stack-${col.color} ${activeCompose === col.key ? "retro-stack-active" : ""}`}
                  onClick={() => { setActiveCompose(col.key); setComposeText(""); }}
                >
                  <div className="retro-stack-card retro-stack-card-3" />
                  <div className="retro-stack-card retro-stack-card-2" />
                  <div className="retro-stack-card retro-stack-card-1">
                    <span className="retro-stack-emoji">{col.emoji}</span>
                    <span className="retro-stack-col-label">{col.label}</span>
                    <span className="retro-stack-hint">+ Pick</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* ── Compose Panel ── */}
          {activeCompose && (() => {
            const col = COLUMNS.find(c => c.key === activeCompose);
            return (
              <div className="retro-compose-panel">
                <div className={`retro-compose-card retro-compose-${col.color}`}>
                  <div className="retro-compose-pin">📌</div>
                  <textarea
                    ref={composeRef}
                    className="retro-compose-textarea"
                    placeholder={`Write your thought for "${col.label}"…`}
                    value={composeText}
                    onChange={e => setComposeText(e.target.value)}
                    maxLength={280}
                    rows={4}
                  />
                  <div className="retro-compose-footer">
                    <span className="retro-compose-char">{composeText.length}/280</span>
                    <div className="retro-compose-actions">
                      <button className="retro-btn-cancel" onClick={() => { setActiveCompose(null); setComposeText(""); }}>
                        Cancel
                      </button>
                      <button
                        className={`retro-btn-pin retro-btn-pin-${col.color}`}
                        onClick={handlePin}
                        disabled={!composeText.trim() || pinning}
                      >
                        {pinning ? <span className="poker-spinner" /> : "📌 Pin to Board"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Three-Column Board ── */}
          <div className="retro-columns">
            {COLUMNS.map(col => (
              <div key={col.key} className={`retro-column retro-column-${col.color}`}>
                <div className="retro-column-header">
                  <span className="retro-column-emoji">{col.emoji}</span>
                  <span className="retro-column-label">{col.label}</span>
                  <span className="retro-column-count">{cardsFor(col.key).length}</span>
                </div>
                <div className="retro-column-cards">
                  {cardsFor(col.key).length === 0 && (
                    <div className="retro-column-empty">
                      No cards yet — pick a {col.emoji} card above!
                    </div>
                  )}
                  {cardsFor(col.key).map((card, idx) => (
                    <div
                      key={card.id}
                      className={`retro-sticky retro-sticky-${col.color}`}
                      style={{ "--card-rotate": `${(idx % 2 === 0 ? 1 : -1) * (0.5 + (idx % 3) * 0.4)}deg` }}
                    >
                      <div className="retro-sticky-pin">📌</div>
                      <p className="retro-sticky-content">{card.content}</p>
                      <div className="retro-sticky-footer">
                        <span className="retro-sticky-author">— {card.author}</span>
                        {(card.author === participantName || isHost) && (
                          <button
                            className="retro-sticky-delete"
                            onClick={() => handleDelete(card.id)}
                            title="Remove card"
                          >✕</button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
