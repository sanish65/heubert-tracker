"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import Icon from "@/components/Icon";
import RetroTimer from "@/components/RetroTimer";
import SailboatScene from "@/components/SailboatScene";
import SpaceScene    from "@/components/SpaceScene";
import RetroActionItems from "@/components/RetroActionItems";
import RetroKudos from "@/components/RetroKudos";
import Avatar from "@/components/Avatar";
import { arrangeColumn } from "@/lib/retroThemes";
import { VOTE_EMOJI, reactionCounts, totalReactions, byVotes } from "@/lib/retroBoardRules";

const RETRO_TEMPLATES = {
  // Left to right: what we are taking forward, then what to fix, then what went well.
  // This is display order only — a card's column_type is its key, so reordering here
  // moves nothing in the database. Do NOT mirror this order into the TEMPLATES arrays in
  // src/app/api/retro/route.js: those map template keys onto the three DB column values
  // BY POSITION, and reordering them would file Focus cards as went_well.
  // `tone` is the pill colour: each column takes the colour of the DB column the route
  // files it under (went_well green, improve amber, focus blue). Same table as in
  // src/components/RetrospectivePage.js.
  standard: [
    { key: "focus",     label: "Focus More On",      icon: "eye",   tone: "blue"  },
    { key: "improve",   label: "Needs Improvement", icon: "alert", tone: "amber" },
    { key: "went_well", label: "What Went Well?",   icon: "check", tone: "green" },
  ],
  sailboat: [
    { key: "wind",    label: "Wind (Pushing us forward)", icon: "send",  tone: "green" },
    { key: "anchors", label: "Anchors (Holding us back)", icon: "lock",  tone: "amber" },
    { key: "rocks",   label: "Rocks (Risks ahead)",      icon: "alert", tone: "blue"  },
  ],
  start_stop: [
    { key: "start",    label: "Start Doing",    icon: "play",    tone: "green" },
    { key: "stop",     label: "Stop Doing",     icon: "pause",   tone: "amber" },
    { key: "continue", label: "Continue Doing", icon: "refresh", tone: "blue"  },
  ]
};

const FLAVOUR_LABELS = { standard: "Standard", sailboat: "Sailboat", start_stop: "Start/Stop" };

const DEFAULT_COLUMNS = RETRO_TEMPLATES.standard;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "🎉", "💡"];
// The vote button is the 👍 reaction (VOTE_EMOJI): same data, shown on its own with a thumbs-up icon.

// The column's label chip: pill colours from the column's tone, a line icon, no emoji.
function ColumnChip({ col, as: Tag = "span" }) {
  return (
    <Tag className="retro-col-chip">
      <Icon name={col.icon} size={14} strokeWidth={2} />
      <span className="retro-col-chip-text">{col.label}</span>
    </Tag>
  );
}

// This route sits outside the app shell, so it brings its own slim top bar: the same
// bar as /planning-poker/[sessionId] (its classes live in the PLANNING POKER section).
function StandaloneBar({ sessionId, live }) {
  return (
    <header className="glass poker-standalone-bar">
      <div className="poker-standalone-brand">
        <Image src="/logo.png" alt="" width={32} height={32} className="poker-bar-logo" />
        <h1 className="poker-standalone-name">Retrospective</h1>
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

export default function RetroSessionPage() {
  const { sessionId } = useParams();
  const { user, currentEmployee, isAdmin, animationsEnabled } = useApp();
  const { confirmDialog } = useDialog();

  // ── Core state ──────────────────────────────────────────
  const [session, setSession]       = useState(null);
  const [cards, setCards]           = useState([]);
  const [cardReactions, setCardReactions] = useState([]); // [{card_id, participant_name, emoji}] — includes the 👍 "like" reaction
  const [actionItems, setActionItems] = useState({ carried: [], own: [] });
  const [themes, setThemes]           = useState([]); // [{id, name, created_at}] — shown read-only here
  const [themeCards, setThemeCards]   = useState([]); // [{card_id, theme_id}]
  const [members, setMembers]       = useState([]);
  const [kudos, setKudos]           = useState([]);
  const [kudosReactions, setKudosReactions] = useState([]);
  const [activity, setActivity]     = useState([]); // [{participant_name, column_type}]
  const [participantName, setParticipantName] = useState("");
  const [nameEntered, setNameEntered] = useState(false);
  const [isHost, setIsHost]           = useState(false);
  const canManageActions = isHost || !!isAdmin;
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
      const res = await fetch(`/api/retro?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) { setError("Session not found."); setLoading(false); return; }
      const data = await res.json();
      setSession(data.session);
      setCards(data.cards || []);
      setCardReactions(data.cardReactions || []);
      setThemes(data.themes || []);
      setThemeCards(data.themeCards || []);
      setActionItems(data.actionItems || { carried: [], own: [] });
      setMembers(data.members || []);
      setKudos(data.kudos || []);
      setKudosReactions(data.kudosReactions || []);
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
    await fetch(`/api/retro?cardId=${encodeURIComponent(cardId)}`, { method: "DELETE" });
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

  const reactionCountsFor = (cardId) => reactionCounts(cardReactions, cardId);
  const hasReacted = (cardId, emoji) =>
    cardReactions.some(r => String(r.card_id) === String(cardId) && r.participant_name === participantName && r.emoji === emoji);
  // Theme totals count every emoji; the card sort counts only votes (👍).
  const totalReactionsFor = (cardId) => totalReactions(cardReactions, cardId);

  const cardsFor = (colKey) => cards.filter(c => c.column_type === colKey).sort(byVotes(cardReactions));

  const isDragging = !!dragType;

  const animated = animationsEnabled !== false;
  const shellClass = `poker-standalone-shell${animated ? " is-animated" : ""}`;

  // ── Loading / Error ──────────────────────────────────────
  if (loading) return (
    <div className={shellClass}>
      <StandaloneBar sessionId={sessionId} />
      <div className="poker-standalone-state">
        <div className="spinner" />
        <span>Loading board…</span>
      </div>
    </div>
  );
  if (error || !session) return (
    <div className={shellClass}>
      <StandaloneBar sessionId={sessionId} />
      <div className="poker-standalone-state">
        <span className="modal-icon modal-icon-red"><Icon name="alert" size={20} /></span>
        <h2 className="section-title">Board Not Found</h2>
        <p>{error || "This retro session does not exist or has expired."}</p>
      </div>
    </div>
  );

  // ── Render ───────────────────────────────────────────────
  return (
    <div className={shellClass}>
      {(session.template === "sailboat" || session.template === "start_stop") && (
        <div className="retro-scene" aria-hidden="true">
          {session.template === "sailboat" ? <SailboatScene /> : <SpaceScene />}
        </div>
      )}
      <StandaloneBar sessionId={sessionId} live />

      <main className="poker-standalone-main retro-standalone-main">
        <div className="retro-board-head">
          <div className="retro-board-head-text">
            {Object.hasOwn(FLAVOUR_LABELS, session.template ?? "") && (
              <span className="page-eyebrow">{FLAVOUR_LABELS[session.template]} board</span>
            )}
            <h2 className="retro-board-title">{session.title}</h2>
            {session.project?.name && (
              <div className="retro-board-meta">
                <span className="retro-head-project"><Icon name="folder" size={15} />{session.project.name}</span>
              </div>
            )}
          </div>
          {isHost && !session.is_ended && (
            <div className="retro-board-actions">
              <button type="button" className="btn btn-secondary retro-end-btn" onClick={handleEndSession}>
                <Icon name="flag" size={16} strokeWidth={2} />
                End Session
              </button>
            </div>
          )}
        </div>

        {isHost && (
          <section className="glass retro-session-strip" aria-label="Session controls">
            <RetroTimer
              session={session}
              isHost={isHost}
              timerState={timerState}
              onUpdate={handleTimerAction}
            />
          </section>
        )}

        {!nameEntered ? (
          <section className="glass-card poker-name-card">
            <label htmlFor="retro-name" className="poker-field-label">Enter your name to participate</label>
            <div className="poker-name-row">
              <input
                id="retro-name"
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
                type="button"
                className="btn btn-primary"
                disabled={!participantName.trim()}
                onClick={() => {
                  setNameEntered(true);
                  localStorage.setItem("heubert_collab_name", participantName.trim());
                }}
              >
                Join
                <Icon name="chevron-right" size={16} strokeWidth={2} />
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* ── Card Stacks tray (draggable) ── */}
            <section className="glass retro-tray" aria-label="Add a card">
              <p className="retro-tray-label">
                Hi <strong>{participantName}</strong> —{" "}
                <span className="retro-drag-hint"><Icon name="grip" size={14} strokeWidth={2.4} />drag</span> a card onto the matching column, or click to compose:
              </p>
              <div className="retro-stacks">
                {currentColumns.map(col => (
                  <button
                    key={col.key}
                    type="button"
                    draggable
                    onDragStart={e => handleDragStart(e, col.key)}
                    onDragEnd={handleDragEnd}
                    className={[
                      "retro-stack",
                      `retro-tone-${col.tone}`,
                      activeCompose === col.key ? "is-active" : "",
                      isDragging && dragType === col.key ? "is-dragging" : "",
                    ].filter(Boolean).join(" ")}
                    onClick={() => {
                      setDropCol(null); setDropText("");
                      setActiveCompose(col.key); setComposeText("");
                    }}
                  >
                    <ColumnChip col={col} />
                    <span className="retro-stack-hint"><Icon name="grip" size={12} strokeWidth={2.4} />Drag or Click</span>
                  </button>
                ))}
              </div>
            </section>

            {/* ── Global compose panel (click-to-open) ── */}
            {activeCompose && (() => {
              const col = currentColumns.find(c => c.key === activeCompose);
              return (
                <div className={`retro-compose retro-compose-panel retro-tone-${col.tone}`}>
                  <ColumnChip col={col} />
                  <textarea
                    ref={composeRef}
                    className="retro-compose-textarea"
                    aria-label={`Write your thought for "${col.label}"`}
                    placeholder={`Write your thought for "${col.label}"…`}
                    value={composeText}
                    onChange={e => setComposeText(e.target.value)}
                    maxLength={280} rows={4}
                  />
                  <div className="retro-compose-footer">
                    <span className="retro-compose-char mono">{composeText.length}/280</span>
                    <div className="retro-compose-actions">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setActiveCompose(null); setComposeText(""); }}>
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => handlePin(col.key, composeText, () => { setActiveCompose(null); setComposeText(""); })}
                        disabled={!composeText.trim() || pinning}
                      >
                        {pinning ? <span className="retro-spinner" aria-hidden="true" /> : "Pin to Board"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* ── Board columns with drop zones: a row that scrolls sideways on narrow screens ── */}
            <div className="retro-columns-scroll">
              <div className="retro-columns">
                {currentColumns.map(col => {
                  const isOver   = dragOver === col.key;
                  const isMatch  = dragType === col.key;
                  const isReject = rejectedCol === col.key;
                  const hasDrop  = dropCol === col.key;
                  const colCards = cardsFor(col.key);
                  const arranged = arrangeColumn({ cards: colCards, themes, themeCards, reactionsFor: totalReactionsFor });

                  const renderCard = (card) => {
                      const isEditing = editingCardId === card.id;
                      const isMine    = card.author === participantName;
                      const isTemp    = card.id.toString().startsWith("temp_");
                      const counts = reactionCountsFor(card.id);
                      const votes = counts[VOTE_EMOJI] || 0;
                      const voted = hasReacted(card.id, VOTE_EMOJI);
                      const canEdit = isMine && !isTemp && !isEditing;
                      const canDelete = card.author === participantName && !isEditing;

                      return (
                        <article key={card.id} className={`retro-card${animated ? " card-lift" : ""}`}>
                          <div className="retro-card-top">
                            {isEditing ? (
                              <div className="retro-mention-wrapper">
                                <textarea
                                  className="retro-compose-textarea"
                                  aria-label="Card text"
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
                                  <span className="retro-compose-char mono">{editText.length}/280 · Ctrl+Enter to save</span>
                                  <div className="retro-compose-actions">
                                    <button className="btn btn-secondary btn-sm" type="button" onClick={() => { setEditingCardId(null); setEditText(""); }}>Cancel</button>
                                    <button
                                      className="btn btn-primary btn-sm"
                                      type="button"
                                      onClick={() => handleEditCard(card.id)}
                                      disabled={!editText.trim() || savingEdit}
                                    >
                                      {savingEdit ? <span className="retro-spinner" aria-hidden="true" /> : "Save"}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <p className="retro-card-text">{card.content}</p>
                            )}
                          </div>

                          <div className="retro-card-by">
                            <Avatar name={card.author} isMe={isMine} className="avatar retro-card-avatar" aria-hidden="true" />
                            <span className="retro-card-author">{card.author}</span>
                            {(canEdit || canDelete) && (
                              <span className="retro-card-tools">
                                {canEdit && (
                                  <button
                                    type="button"
                                    className="retro-icon-btn"
                                    onClick={() => { setEditingCardId(card.id); setEditText(card.content); setSavingEdit(false); }}
                                    title="Edit"
                                    aria-label="Edit card"
                                  >
                                    <Icon name="edit" size={14} strokeWidth={2} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    className="retro-icon-btn retro-icon-btn-danger"
                                    onClick={() => handleDelete(card.id)}
                                    title="Remove"
                                    aria-label="Remove card"
                                  >
                                    <Icon name="trash" size={14} strokeWidth={2} />
                                  </button>
                                )}
                              </span>
                            )}
                          </div>

                          <div className="retro-reactions retro-reaction-picker-wrap">
                            <button
                              type="button"
                              className="btn-icon btn-sm retro-vote"
                              aria-pressed={voted}
                              aria-label={`${voted ? "Remove your vote" : "Vote for this card"}, ${votes} ${votes === 1 ? "vote" : "votes"}`}
                              title={voted ? "Remove your vote" : "Vote for this card"}
                              disabled={isTemp}
                              onClick={() => handleReact(card.id, VOTE_EMOJI)}
                            >
                              <Icon name="thumbs-up" size={14} strokeWidth={2} />
                              <span className="mono">{votes}</span>
                            </button>
                            {Object.entries(counts).filter(([emoji]) => emoji !== VOTE_EMOJI).map(([emoji, count]) => (
                              <button
                                key={emoji}
                                type="button"
                                className={`retro-reaction${hasReacted(card.id, emoji) ? " is-mine" : ""}`}
                                aria-pressed={hasReacted(card.id, emoji)}
                                onClick={() => handleReact(card.id, emoji)}
                                title={hasReacted(card.id, emoji) ? "Remove your reaction" : "React"}
                              >
                                <span className="retro-reaction-emoji">{emoji}</span>
                                <span className="mono">{count}</span>
                              </button>
                            ))}
                            {!isTemp && (
                              <button
                                type="button"
                                className="btn-icon btn-sm retro-react-add"
                                onClick={() => setReactionPickerFor(reactionPickerFor === card.id ? null : card.id)}
                                title="Add reaction"
                                aria-label="Add reaction"
                                aria-expanded={reactionPickerFor === card.id}
                              >
                                <Icon name="smile" size={16} />
                              </button>
                            )}
                            {reactionPickerFor === card.id && (
                              <div className="retro-reaction-popover" role="group" aria-label="Reactions">
                                {REACTION_EMOJIS.map(emoji => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    className={`retro-reaction-option${hasReacted(card.id, emoji) ? " is-mine" : ""}`}
                                    aria-pressed={hasReacted(card.id, emoji)}
                                    onClick={() => { handleReact(card.id, emoji); setReactionPickerFor(null); }}
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </article>
                      );
                  };

                  return (
                    <section
                      key={col.key}
                      aria-label={col.label}
                      className={[
                        "glass",
                        "retro-column",
                        `retro-tone-${col.tone}`,
                        isOver && isMatch   ? "retro-column-drop-valid"   : "",
                        isOver && !isMatch  ? "retro-column-drop-invalid" : "",
                        isReject            ? "retro-column-rejected"     : "",
                      ].filter(Boolean).join(" ")}
                      onDragOver={e => handleDragOver(e, col.key)}
                      onDragLeave={handleDragLeave}
                      onDrop={e => handleDrop(e, col.key)}
                    >
                      <div className="retro-column-head">
                        <ColumnChip col={col} as="h3" />
                        <span className="retro-column-count mono">{colCards.length}</span>
                      </div>

                      {/* Inline drop compose */}
                      {hasDrop && (
                        <div className="retro-compose">
                          <textarea
                            ref={dropComposeRef}
                            className="retro-compose-textarea"
                            aria-label={`Your thought for "${col.label}"`}
                            placeholder={`Your thought for "${col.label}"…`}
                            value={dropText}
                            onChange={e => setDropText(e.target.value)}
                            maxLength={280} rows={3}
                          />
                          <div className="retro-compose-footer">
                            <span className="retro-compose-char mono">{dropText.length}/280</span>
                            <div className="retro-compose-actions">
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => { setDropCol(null); setDropText(""); }}
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handlePin(col.key, dropText, () => { setDropCol(null); setDropText(""); })}
                                disabled={!dropText.trim() || pinning}
                              >
                                {pinning ? <span className="retro-spinner" aria-hidden="true" /> : "Pin"}
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Activity indicators (Others thinking) */}
                      {activity.filter(a => a.column_type === col.key && a.participant_name !== participantName).map((a) => (
                        <div key={`typing-${a.participant_name}`} className="retro-typing" role="status">
                          <span className="retro-typing-dots" aria-hidden="true"><span /><span /><span /></span>
                          <span>{a.participant_name} is thinking...</span>
                        </div>
                      ))}

                      {/* Empty state */}
                      {colCards.length === 0 && !hasDrop && activity.filter(a => a.column_type === col.key).length === 0 && (
                        <div className={`retro-column-empty${isDragging && isMatch ? " is-drop-target" : ""}`}>
                          {isDragging && isMatch ? "Drop here" : "No cards yet!"}
                        </div>
                      )}

                      {/* Themes, then the cards that are in none */}
                      {arranged.themes.map(theme => (
                        <section key={theme.id} className="retro-theme" aria-label={`Theme: ${theme.name}`}>
                          <div className="retro-theme-head">
                            <span className="eyebrow retro-theme-eyebrow">
                              <Icon name="sparkles" size={13} strokeWidth={2} />
                              Theme
                            </span>
                            <span className="retro-theme-meta mono">
                              {theme.cards.length} {theme.cards.length === 1 ? "card" : "cards"} · {theme.reactions} {theme.reactions === 1 ? "reaction" : "reactions"}
                            </span>
                          </div>
                          <span className="retro-theme-name">{theme.name}</span>
                          {theme.cards.map(renderCard)}
                        </section>
                      ))}
                      {arranged.themes.length > 0 && arranged.loose.length > 0 && (
                        <div className="eyebrow retro-theme-loose-label">Not in a theme</div>
                      )}
                      {arranged.loose.map(renderCard)}
                    </section>
                  );
                })}
              </div>
            </div>

            <RetroKudos
              session={session}
              kudos={kudos}
              kudosReactions={kudosReactions}
              members={members}
              participantName={participantName}
              isFacilitator={isHost}
              reactionEmojis={REACTION_EMOJIS}
              onChanged={fetchBoard}
            />

            <RetroActionItems
              session={session}
              actionItems={actionItems}
              members={members}
              participantName={participantName}
              canManage={canManageActions}
              onChanged={fetchBoard}
            />
          </>
        )}
      </main>

      {session.is_ended && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="retro-ended-title">
          <div className="modal-content poker-ended">
            <span className="modal-icon"><Icon name="flag" size={20} /></span>
            <h2 id="retro-ended-title">This Retrospective has ended</h2>
            <p>The facilitator has concluded this session. Thank you for your contributions!</p>
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
