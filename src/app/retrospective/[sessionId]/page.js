"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import RetroTimer from "@/components/RetroTimer";
import SailboatScene from "@/components/SailboatScene";
import SpaceScene    from "@/components/SpaceScene";

const RETRO_TEMPLATES = {
  standard: [
    { key: "went_well", label: "What Went Well?",   emoji: "🎉", color: "green"  },
    { key: "improve",   label: "Needs Improvement", emoji: "🔧", color: "amber"  },
    { key: "focus",     label: "Focus More On",      emoji: "🎯", color: "indigo" },
  ],
  sailboat: [
    { key: "wind",    label: "Wind (Pushing us forward)", emoji: "⛵", color: "sky"    },
    { key: "anchors", label: "Anchors (Holding us back)", emoji: "⚓", color: "slate"  },
    { key: "rocks",   label: "Rocks (Risks ahead)",      emoji: "🪨", color: "rose"   },
  ],
  start_stop: [
    { key: "start",    label: "Start Doing",    emoji: "🚀", color: "emerald" },
    { key: "stop",     label: "Stop Doing",     emoji: "🛑", color: "crimson" },
    { key: "continue", label: "Continue Doing", emoji: "🔄", color: "violet"  },
  ]
};

const DEFAULT_COLUMNS = RETRO_TEMPLATES.standard;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "🎉", "💡"];

export default function RetroSessionPage() {
  const { sessionId } = useParams();
  const { user, currentEmployee } = useApp();
  const { confirmDialog } = useDialog();

  // ── Core state ──────────────────────────────────────────
  const [session, setSession]       = useState(null);
  const [cards, setCards]           = useState([]);
  const [cardReactions, setCardReactions] = useState([]); // [{card_id, participant_name, emoji}] — includes the 👍 "like" reaction
  const [activity, setActivity]     = useState([]); // [{participant_name, column_type}]
  const [participantName, setParticipantName] = useState("");
  const [nameEntered, setNameEntered] = useState(false);
  const [isHost, setIsHost]           = useState(false);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [timerState, setTimerState] = useState(null);

  // ── Edit card state ──────────────────────────────────────
  const [editingCardId, setEditingCardId] = useState(null);
  const [editText, setEditText]           = useState("");
  const [savingEdit, setSavingEdit]       = useState(false);

  // ── Reaction picker state ─────────────────────────────────
  const [reactionPickerFor, setReactionPickerFor] = useState(null);

  // ── Compose state (click-to-open panel) ─────────────────
  const [activeCompose, setActiveCompose] = useState(null);
  const [composeText, setComposeText]     = useState("");
  const [pinning, setPinning]             = useState(false);

  // ── Drag & drop state ────────────────────────────────────
  const [dragType, setDragType]       = useState(null); // column key being dragged
  const [dragOver, setDragOver]       = useState(null); // column key being hovered
  const [rejectedCol, setRejectedCol] = useState(null); // briefly set on mismatch
  const [dropCol, setDropCol]         = useState(null); // column with inline compose open
  const [dropText, setDropText]       = useState("");

  const pollRef        = useRef(null);
  const composeRef     = useRef(null);
  const dropComposeRef = useRef(null);

  // ── Fetch board ─────────────────────────────────────────
  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/retro?sessionId=${sessionId}`);
      if (!res.ok) { setError("Session not found."); setLoading(false); return; }
      const data = await res.json();
      setSession(data.session);
      setCards(data.cards || []);
      setCardReactions(data.cardReactions || []);
      setActivity(data.activity || []);
      setTimerState(data.timerState);

      if (participantName && data.session?.created_by === participantName) {
        setIsHost(true);
      }
    } catch { setError("Unable to reach server."); }
    finally { setLoading(false); }
  }, [sessionId, participantName]);

  useEffect(() => {
    fetchBoard();
    pollRef.current = setInterval(fetchBoard, 2500);
    return () => clearInterval(pollRef.current);
  }, [fetchBoard]);

  // ── Restore name from localStorage / Auth ───────────────
  useEffect(() => {
    if (nameEntered) return;
    const savedName = localStorage.getItem("heubert_collab_name");
    if (savedName) {
      setParticipantName(savedName);
      setNameEntered(true);
    } else if (user) {
      const authName =
        currentEmployee?.name ||
        user?.user_metadata?.full_name ||
        user?.email?.split("@")[0] || "";
      if (authName) setParticipantName(authName);
    }
  }, [user, currentEmployee, nameEntered]);

  // Focus compose textareas
  useEffect(() => { if (activeCompose && composeRef.current) composeRef.current.focus(); }, [activeCompose]);
  useEffect(() => { if (dropCol && dropComposeRef.current) dropComposeRef.current.focus(); }, [dropCol]);

  // Escape to close any open compose
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setActiveCompose(null); setComposeText("");
        setDropCol(null);      setDropText("");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Sync typing status ────────────────────────────────────
  useEffect(() => {
    if (!session || !participantName || !nameEntered) return;
    const isTyping = !!(activeCompose || dropCol);
    const columnType = activeCompose || dropCol;
    
    const sync = async () => {
      try {
        await fetch("/api/retro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync_activity",
            sessionId: session.id,
            participantName,
            columnType,
            isTyping
          })
        });
      } catch (_) {}
    };

    sync();
    return () => {
      if (isTyping) {
        fetch("/api/retro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "sync_activity",
            sessionId: session.id,
            participantName,
            isTyping: false
          })
        });
      }
    };
  }, [activeCompose, dropCol, session, participantName, nameEntered]);

  // ── Pin card ────────────────────────────────────────────
  const handlePin = async (colKey, text, onDone) => {
    if (!text.trim() || !session) return;
    setPinning(true);
    // Optimistic update — show card immediately
    const tempCard = {
      id: `temp_${Date.now()}`,
      session_id: session.id,
      column_type: colKey,
      content: text.trim(),
      author: participantName || "You",
      created_at: new Date().toISOString(),
    };
    setCards(prev => [...prev, tempCard]);
    onDone(); // clear compose immediately
    try {
      const res = await fetch("/api/retro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_card", sessionId,
          columnType: colKey, content: text.trim(), author: participantName || "",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCards(prev => prev.filter(c => c.id !== tempCard.id));
        setError(`Failed to pin card: ${data.error || res.statusText}`);
        return;
      }
      await fetchBoard();
    } catch (err) {
      setCards(prev => prev.filter(c => c.id !== tempCard.id));
      setError(`Network error: ${err.message}`);
    } finally {
      setPinning(false);
    }
  };
  const handleEndSession = async () => {
    if (!session || !isHost) return;
    if (!(await confirmDialog("Are you sure you want to end this session? This will lock the board for everyone.", { danger: true, confirmText: "End Session" }))) return;
    try {
      await fetch("/api/retro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end_session", sessionId: session.id })
      });
      await fetchBoard();
    } catch (_) {}
  };

  const handleTimerAction = async (payload) => {
    try {
      const res = await fetch("/api/retro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        if (payload.timerState) setTimerState(payload.timerState);
      }
    } catch (_) {}
  };

  // ── Delete card ─────────────────────────────────────────
  const handleDelete = async (cardId) => {
    await fetch(`/api/retro?cardId=${cardId}`, { method: "DELETE" });
    setCards(prev => prev.filter(c => c.id !== cardId));
  };

  // ── Edit card ───────────────────────────────────────────
  const handleEditCard = async (cardId) => {
    if (!editText.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/retro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit_card", cardId, content: editText, author: participantName })
      });
      if (res.ok) {
        setCards(prev => prev.map(c => c.id === cardId ? { ...c, content: editText.trim() } : c));
        setEditingCardId(null);
        setEditText("");
        setError("");
      } else {
        const data = await res.json();
        setError(`Failed to save edit: ${data.error || res.statusText}`);
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally { setSavingEdit(false); }
  };

  // ── React on card (👍 "like" is just another reaction emoji) ──
  const handleReact = async (cardId, emoji) => {
    if (!participantName) return;
    const already = cardReactions.some(
      r => String(r.card_id) === String(cardId) && r.participant_name === participantName && r.emoji === emoji
    );
    // Optimistic update
    if (already) {
      setCardReactions(prev =>
        prev.filter(r => !(String(r.card_id) === String(cardId) && r.participant_name === participantName && r.emoji === emoji))
      );
    } else {
      setCardReactions(prev => [...prev, { card_id: cardId, participant_name: participantName, emoji }]);
    }
    await fetch("/api/retro", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: already ? "unreact_card" : "react_card",
        cardId, sessionId, participantName, emoji,
      }),
    });
  };

  // ── Close reaction picker on outside click ───────────────
  useEffect(() => {
    if (!reactionPickerFor) return;
    const onDocClick = (e) => {
      if (!e.target.closest(".retro-reaction-picker-wrap")) setReactionPickerFor(null);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [reactionPickerFor]);

  // ── Drag handlers ────────────────────────────────────────
  const handleDragStart = (e, colKey) => {
    setDragType(colKey);
    e.dataTransfer.effectAllowed = "copy";
    e.dataTransfer.setData("text/plain", colKey);
  };
  const handleDragEnd = () => { setDragType(null); setDragOver(null); };

  const handleDragOver = (e, colKey) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = dragType === colKey ? "copy" : "none";
    setDragOver(colKey);
  };
  const handleDragLeave = (e) => {
    // Only clear if truly leaving the column (not a child element)
    if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
  };

  const handleDrop = (e, colKey) => {
    e.preventDefault();
    setDragOver(null);
    const droppedType = e.dataTransfer.getData("text/plain") || dragType;
    setDragType(null);

    if (droppedType !== colKey) {
      // Mismatch — shake the column
      setRejectedCol(colKey);
      setTimeout(() => setRejectedCol(null), 600);
      return;
    }
    // Match — open inline compose in this column
    setActiveCompose(null); setComposeText("");
    setDropCol(colKey);     setDropText("");
  };

  // ── Helpers ─────────────────────────────────────────────
  const currentColumns = (session?.template && RETRO_TEMPLATES[session.template]) || DEFAULT_COLUMNS;

  const reactionCountsFor = (cardId) => {
    const counts = {};
    cardReactions
      .filter(r => String(r.card_id) === String(cardId))
      .forEach(r => { counts[r.emoji] = (counts[r.emoji] || 0) + 1; });
    return counts;
  };
  const hasReacted = (cardId, emoji) =>
    cardReactions.some(r => String(r.card_id) === String(cardId) && r.participant_name === participantName && r.emoji === emoji);
  const voteCountFor = (cardId) => reactionCountsFor(cardId)["👍"] || 0;
  const hasVotedFor  = (cardId) => hasReacted(cardId, "👍");

  const cardsFor = (colKey) =>
    cards
      .filter(c => c.column_type === colKey)
      .sort((a, b) => {
        const diff = voteCountFor(b.id) - voteCountFor(a.id);
        if (diff !== 0) return diff;
        return String(a.id).localeCompare(String(b.id)); // Stable secondary sort
      });

  const isDragging = !!dragType;

  // ── Loading / Error ──────────────────────────────────────
  if (loading) return (
    <div className="poker-standalone-shell">
      <div className="poker-standalone-loading"><div className="spinner" /><span>Loading board…</span></div>
    </div>
  );
  if (error || !session) return (
    <div className="poker-standalone-shell">
      <div className="poker-standalone-error">
        <span className="poker-error-icon">🗂️</span>
        <h2>Board Not Found</h2>
        <p>{error || "This retro session does not exist or has expired."}</p>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="poker-standalone-shell">
      {session?.template === "sailboat"    && <SailboatScene />}
      {session?.template === "start_stop" && <SpaceScene />}
      <header className="poker-standalone-header">
        <div className="poker-standalone-logo">
          <span>🗂️</span>
          <span className="poker-standalone-logo-text">Sprint Retrospective</span>
        </div>
        <span className="poker-pulse"><span className="pulse-dot" /> Live</span>
      </header>

      <main className="retro-standalone-main">
        <div className="retro-standalone-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            <div>
              <h2 className="retro-standalone-title">{session.title}</h2>
              {session.project?.name && (
                <span className="retro-standalone-project">📁 {session.project.name}</span>
              )}
            </div>
            {isHost && (
              <RetroTimer
                session={session}
                isHost={isHost}
                timerState={timerState}
                onUpdate={handleTimerAction}
              />
            )}
          </div>
          {isHost && !session.is_ended && (
            <button className="retro-end-session-btn" onClick={handleEndSession}>
              🏁 End Session
            </button>
          )}
        </div>

        {session.is_ended && (
           <div className="retro-ended-overlay">
             <div className="retro-ended-message">
               <span className="retro-ended-icon">🏁</span>
               <h2>This Retrospective has ended</h2>
               <p>The facilitator has concluded this session. Thank you for your contributions!</p>
               <p className="retro-ended-sub">Please wait for the next sprint's session to begin.</p>
               <button className="btn-poker-primary" onClick={() => { window.location.href = "/"; }}>
                 Exit to Home
               </button>
             </div>
           </div>
        )}

        {!nameEntered ? (
          <div className="retro-standalone-name">
            <label className="poker-form-label">Enter your name to participate</label>
            <div className="poker-standalone-name-row">
              <input
                className="poker-input"
                placeholder="Your name…"
                value={participantName}
                onChange={e => setParticipantName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter" && participantName.trim()) {
                    setNameEntered(true);
                    localStorage.setItem("heubert_collab_name", participantName.trim());
                  }
                }}
                autoFocus
              />
              <button
                className="btn-poker-primary"
                disabled={!participantName.trim()}
                onClick={() => {
                  setNameEntered(true);
                  localStorage.setItem("heubert_collab_name", participantName.trim());
                }}
              >
                Join →
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* ── Card Stacks tray (draggable) ── */}
            <div className="retro-stack-tray">
              <p className="retro-stack-tray-label">
                Hi <strong>{participantName}</strong> —{" "}
                <span className="retro-drag-hint">↕ drag</span> a card onto the matching column, or click to compose:
              </p>
              <div className="retro-stacks">
                {currentColumns.map(col => (
                  <button
                    key={col.key}
                    draggable
                    onDragStart={e => handleDragStart(e, col.key)}
                    onDragEnd={handleDragEnd}
                    className={[
                      "retro-stack",
                      `retro-stack-${col.color}`,
                      activeCompose === col.key ? "retro-stack-active" : "",
                      isDragging && dragType === col.key ? "retro-stack-dragging" : "",
                    ].join(" ")}
                    onClick={() => {
                      setDropCol(null); setDropText("");
                      setActiveCompose(col.key); setComposeText("");
                    }}
                  >
                    <div className="retro-stack-card retro-stack-card-3" />
                    <div className="retro-stack-card retro-stack-card-2" />
                    <div className="retro-stack-card retro-stack-card-1">
                      <span className="retro-stack-emoji">{col.emoji}</span>
                      <span className="retro-stack-col-label">{col.label}</span>
                      <span className="retro-stack-hint">↕ Drag or Click</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Global compose panel (click-to-open) ── */}
            {activeCompose && (() => {
              const col = currentColumns.find(c => c.key === activeCompose);
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
                      maxLength={280} rows={4}
                    />
                    <div className="retro-compose-footer">
                      <span className="retro-compose-char">{composeText.length}/280</span>
                      <div className="retro-compose-actions">
                        <button className="retro-btn-cancel" onClick={() => { setActiveCompose(null); setComposeText(""); }}>
                          Cancel
                        </button>
                        <button
                          className={`retro-btn-pin retro-btn-pin-${col.color}`}
                          onClick={() => handlePin(col.key, composeText, () => { setActiveCompose(null); setComposeText(""); })}
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

            {/* ── Board columns with drop zones ── */}
            <div className={`retro-columns${isDragging ? " retro-columns-dragging" : ""}`}>
              {currentColumns.map(col => {
                const isOver   = dragOver === col.key;
                const isMatch  = dragType === col.key;
                const isReject = rejectedCol === col.key;
                const hasDrop  = dropCol === col.key;
                const colCards = cardsFor(col.key);

                return (
                  <div
                    key={col.key}
                    className={[
                      "retro-column",
                      `retro-column-${col.color}`,
                      isOver && isMatch   ? "retro-column-drop-valid"   : "",
                      isOver && !isMatch  ? "retro-column-drop-invalid" : "",
                      isReject            ? "retro-column-rejected"     : "",
                    ].filter(Boolean).join(" ")}
                    onDragOver={e => handleDragOver(e, col.key)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, col.key)}
                  >
                    {!col && <div style={{display:'none'}} />}
                    {col && (
                      <>
                    <div className="retro-column-header">
                      <span className="retro-column-emoji">{col.emoji}</span>
                      <span className="retro-column-label">{col.label}</span>
                      <span className="retro-column-count">{colCards.length}</span>
                    </div>

                    <div className="retro-column-cards">
                      {/* Inline drop compose */}
                      {hasDrop && (
                        <div className={`retro-inline-compose retro-inline-compose-${col.color}`}>
                          <div className="retro-compose-pin">📌</div>
                          <textarea
                            ref={dropComposeRef}
                            className="retro-compose-textarea"
                            placeholder={`Your thought for "${col.label}"…`}
                            value={dropText}
                            onChange={e => setDropText(e.target.value)}
                            maxLength={280} rows={3}
                          />
                          <div className="retro-compose-footer">
                            <span className="retro-compose-char">{dropText.length}/280</span>
                            <div className="retro-compose-actions">
                              <button
                                className="retro-btn-cancel"
                                onClick={() => { setDropCol(null); setDropText(""); }}
                              >
                                Cancel
                              </button>
                              <button
                                className={`retro-btn-pin retro-btn-pin-${col.color}`}
                                onClick={() => handlePin(col.key, dropText, () => { setDropCol(null); setDropText(""); })}
                                disabled={!dropText.trim() || pinning}
                              >
                                {pinning ? <span className="poker-spinner" /> : "📌 Pin"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Activity indicators (Others thinking) */}
                      {activity.filter(a => a.column_type === col.key && a.participant_name !== participantName).map((a) => (
                        <div key={`typing-${a.participant_name}`} className="retro-typing-indicator">
                          <div className="typing-dots">
                            <span></span><span></span><span></span>
                          </div>
                          <span className="typing-text">{a.participant_name} is thinking...</span>
                        </div>
                      ))}

                      {/* Empty state */}
                      {colCards.length === 0 && !hasDrop && activity.filter(a => a.column_type === col.key).length === 0 && (
                        <div className={`retro-column-empty${isDragging && isMatch ? " retro-column-empty-glow" : ""}`}>
                          {isDragging && isMatch ? `Drop here ↓` : "No cards yet!"}
                        </div>
                      )}

                      {/* Sticky cards sorted by votes */}
                      {colCards.map((card, idx) => {
                        const isEditing = editingCardId === card.id;
                        const isMine    = card.author === participantName;
                        const isTemp    = card.id.toString().startsWith("temp_");
                        const reactionCounts = reactionCountsFor(card.id);

                        return (
                          <div
                            key={card.id}
                            className={`retro-sticky retro-sticky-${col.color}`}
                            style={{ "--card-rotate": `${(idx % 2 === 0 ? 1 : -1) * (0.5 + (idx % 3) * 0.4)}deg` }}
                          >
                            <div className="retro-sticky-pin">📌</div>

                            {isEditing ? (
                              <div className="retro-mention-wrapper" style={{ position: "relative" }}>
                                <textarea
                                  className="retro-compose-textarea retro-edit-textarea"
                                  value={editText}
                                  onChange={e => setEditText(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === "Escape") { setEditingCardId(null); setEditText(""); }
                                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleEditCard(card.id); }
                                  }}
                                  maxLength={280}
                                  rows={3}
                                  autoFocus
                                />
                                <div className="retro-compose-footer">
                                  <span className="retro-compose-char">{editText.length}/280 · Ctrl+Enter to save</span>
                                  <div className="retro-compose-actions">
                                    <button className="retro-btn-cancel" type="button" onClick={() => { setEditingCardId(null); setEditText(""); }}>Cancel</button>
                                    <button
                                      className="retro-btn-pin retro-btn-pin-green"
                                      type="button"
                                      onClick={() => handleEditCard(card.id)}
                                      disabled={!editText.trim() || savingEdit}
                                    >
                                      {savingEdit ? <span className="poker-spinner" /> : "💾 Save"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="retro-sticky-content">{card.content}</p>
                            )}

                            <div className="retro-sticky-footer">
                              <span className="retro-sticky-author">— {card.author}</span>
                              <div className="retro-sticky-actions">
                                <div className="retro-reaction-picker-wrap">
                                  {Object.entries(reactionCounts).map(([emoji, count]) => (
                                    <button
                                      key={emoji}
                                      className={`retro-reaction-badge${hasReacted(card.id, emoji) ? " retro-reaction-badge-active" : ""}`}
                                      onClick={() => handleReact(card.id, emoji)}
                                      title={hasReacted(card.id, emoji) ? "Remove your reaction" : "React"}
                                    >
                                      {emoji}<span className="retro-reaction-count">{count}</span>
                                    </button>
                                  ))}
                                  {!isTemp && (
                                    <button
                                      className="retro-reaction-add-btn"
                                      onClick={() => setReactionPickerFor(reactionPickerFor === card.id ? null : card.id)}
                                      title="Add reaction"
                                    >
                                      +😀
                                    </button>
                                  )}
                                  {reactionPickerFor === card.id && (
                                    <div className="retro-reaction-popover">
                                      {REACTION_EMOJIS.map(emoji => (
                                        <button
                                          key={emoji}
                                          className={`retro-reaction-option${hasReacted(card.id, emoji) ? " retro-reaction-option-active" : ""}`}
                                          onClick={() => { handleReact(card.id, emoji); setReactionPickerFor(null); }}
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                {isMine && !isTemp && !isEditing && (
                                  <button
                                    className="retro-sticky-edit"
                                    onClick={() => { setEditingCardId(card.id); setEditText(card.content); setSavingEdit(false); }}
                                    title="Edit"
                                  >
                                    ✏️
                                  </button>
                                )}
                                {card.author === participantName && !isEditing && (
                                  <button
                                    className="retro-sticky-delete"
                                    onClick={() => handleDelete(card.id)}
                                    title="Remove"
                                  >
                                    ✕
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>

      <footer className="poker-standalone-footer">
        <span>Heubert Tracker — Retrospective</span>
        <span className="poker-pulse"><span className="pulse-dot" /> Live</span>
      </footer>
    </div>
  );
}
