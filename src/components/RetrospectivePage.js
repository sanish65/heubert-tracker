"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import RetroTimer from "./RetroTimer";
import ShareQRModal from "@/components/ShareQRModal";
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

// ── MentionTextarea ─────────────────────────────────────
function MentionTextarea({ value, onChange, employeeNames, className, maxLength, rows, onSave, onCancel, saving }) {
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionOpen, setMentionOpen] = useState(false);
  const [cursorPos, setCursorPos] = useState(0);
  const taRef = useRef(null);

  const filteredNames = mentionQuery
    ? employeeNames.filter(n => n.toLowerCase().startsWith(mentionQuery.toLowerCase())).slice(0, 5)
    : [];

  const handleChange = (e) => {
    const val = e.target.value;
    const pos = e.target.selectionStart;
    onChange(val);
    setCursorPos(pos);

    // Detect @mention trigger
    const textBefore = val.slice(0, pos);
    const match = textBefore.match(/@(\w[\w ]*)$/);
    if (match) {
      setMentionQuery(match[1]);
      setMentionOpen(true);
    } else {
      setMentionOpen(false);
      setMentionQuery("");
    }
  };

  const insertMention = (name) => {
    const textBefore = value.slice(0, cursorPos);
    const textAfter = value.slice(cursorPos);
    const lastAt = textBefore.lastIndexOf("@");
    const newText = textBefore.slice(0, lastAt) + `@${name} ` + textAfter;
    onChange(newText);
    setMentionOpen(false);
    setMentionQuery("");
    setTimeout(() => taRef.current?.focus(), 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Escape") { onCancel(); }
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onSave(); }
  };

  return (
    <div className="retro-mention-wrapper" style={{ position: "relative" }}>
      <textarea
        ref={taRef}
        className={className}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        maxLength={maxLength}
        rows={rows}
        autoFocus
      />
      {mentionOpen && filteredNames.length > 0 && (
        <ul className="retro-mention-dropdown">
          {filteredNames.map(name => (
            <li key={name} onMouseDown={(e) => { e.preventDefault(); insertMention(name); }}>
              @{name}
            </li>
          ))}
        </ul>
      )}
      <div className="retro-compose-footer">
        <span className="retro-compose-char">{value.length}/{maxLength} · Ctrl+Enter to save</span>
        <div className="retro-compose-actions">
          <button className="retro-btn-cancel" type="button" onClick={onCancel}>Cancel</button>
          <button className="retro-btn-pin retro-btn-pin-green" type="button" onClick={onSave} disabled={!value.trim() || saving}>
            {saving ? <span className="poker-spinner" /> : "💾 Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────
export default function RetrospectivePage() {
  const [view, setView]             = useState("home");   // home | board | actions
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [session, setSession]       = useState(null);
  const [cards, setCards]           = useState([]);
  const [cardVotes, setCardVotes]   = useState([]);
  const [activity, setActivity]     = useState([]); // [{participant_name, column_type}]
  const [participantName, setParticipantName] = useState("");
  const [creatorName, setCreatorName]   = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [joinName, setJoinName]         = useState("");
  const [joinSessionId, setJoinSessionId] = useState("");
  const [isHost, setIsHost]   = useState(false);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied]   = useState(false);
  const [showQR, setShowQR]   = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState("standard");
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [recentSessions, setRecentSessions] = useState([]);
  const [isRestoring, setIsRestoring] = useState(true);

  // ── Edit card state ───────────────────────────────────────
  const [editingCardId, setEditingCardId] = useState(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [timerState, setTimerState] = useState(null);

  const { employees } = useApp();
  const employeeNames = employees.map(e => e.name);

  // compose
  const [activeCompose, setActiveCompose] = useState(null);
  const [composeText, setComposeText]     = useState("");
  const [pinning, setPinning]             = useState(false);

  // drag & drop
  const [dragType, setDragType]       = useState(null);
  const [dragOver, setDragOver]       = useState(null);
  const [rejectedCol, setRejectedCol] = useState(null);
  const [dropCol, setDropCol]         = useState(null);
  const [dropText, setDropText]       = useState("");

  const pollRef        = useRef(null);
  const composeRef     = useRef(null);
  const dropComposeRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef      = useRef(false);

  // ── Fetch board ──────────────────────────────────────────
  const fetchBoard = useCallback(async (sid) => {
    try {
      const res = await fetch(`/api/retro?sessionId=${sid}`);
      if (!res.ok) return;
      const data = await res.json();
      setSession(data.session);
      setCards(data.cards || []);
      setCardVotes(data.cardVotes || []);
      setActivity(data.activity || []);
      setTimerState(data.timerState);
    } catch (_) {}
  }, []);

  const startPolling = useCallback((sid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => fetchBoard(sid), 2500);
  }, [fetchBoard]);

  // ── Auto-restore session from localStorage ──────────────────
  useEffect(() => {
    const savedId = localStorage.getItem("heubert_retro_session_id");
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
          const res = await fetch(`/api/retro?sessionId=${savedId}`);
          if (!res.ok) {
            localStorage.removeItem("heubert_retro_session_id");
            setIsRestoring(false);
            return;
          }
          const data = await res.json();
          setSession(data.session);
          setCards(data.cards || []);
          setCardVotes(data.cardVotes || []);
          const isCreator = savedName && savedName === data.session.created_by;
          if (isCreator) {
            setIsHost(true);
            setShareUrl(`${window.location.origin}/retrospective/${savedId}`);
          }
          setView("board");
          startPolling(savedId);
        } catch {
          localStorage.removeItem("heubert_retro_session_id");
        } finally {
          setIsRestoring(false);
        }
      };
      autoJoin();
    } else {
      setIsRestoring(false);
    }
  }, [startPolling]);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  useEffect(() => {
    if (view === "home") {
      fetch("/api/retro")
        .then(res => res.json())
        .then(data => { if (data.sessions) setRecentSessions(data.sessions); })
        .catch(() => {});
    }
  }, [view]);

  useEffect(() => { document.body.style.overflow = isEnlarged ? "hidden" : ""; return () => { document.body.style.overflow = ""; }; }, [isEnlarged]);
  useEffect(() => { if (activeCompose && composeRef.current) composeRef.current.focus(); }, [activeCompose]);
  useEffect(() => { if (dropCol && dropComposeRef.current) dropComposeRef.current.focus(); }, [dropCol]);
  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setActiveCompose(null); setComposeText(""); setDropCol(null); setDropText(""); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // ── Sync typing status ────────────────────────────────────
  useEffect(() => {
    if (!session || !participantName || view !== "board") {
      if (isTypingRef.current) {
        fetch("/api/retro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync_activity", sessionId: session?.id, participantName, isTyping: false })
        }).catch(() => {});
        isTypingRef.current = false;
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
      return;
    }

    if (!activeCompose && !dropCol) {
      if (isTypingRef.current) {
        fetch("/api/retro", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "sync_activity", sessionId: session.id, participantName, isTyping: false })
        }).catch(() => {});
        isTypingRef.current = false;
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = null;
        }
      }
      return;
    }

    const columnType = activeCompose || dropCol;
    
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      fetch("/api/retro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_activity",
          sessionId: session.id,
          participantName,
          columnType,
          isTyping: true
        })
      }).catch(() => {});
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false;
      fetch("/api/retro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "sync_activity", sessionId: session.id, participantName, isTyping: false })
      }).catch(() => {});
    }, 5000);

    return () => {
      // Allow the latest timeout to run its course. On full unmount or modal close, 
      // the first blockers in this useEffect will properly send isTyping: false and clear the timeout.
    };
  }, [activeCompose, dropCol, composeText, dropText, session, participantName, view]);

  // ── Create / Join ────────────────────────────────────────
  const handleCreate = async () => {
    if (!sessionTitle.trim() || !creatorName.trim()) { setError("Please enter your name and a session title."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/retro", { 
        method: "POST", 
        headers: { "Content-Type": "application/json" }, 
        body: JSON.stringify({ 
          action: "create", 
          title: sessionTitle.trim(), 
          createdBy: creatorName.trim(),
          template: selectedTemplate
        }) 
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSession(data.session); setCards([]); setCardVotes([]);
      setView("board"); setIsHost(true);
      setParticipantName(creatorName.trim());
      localStorage.setItem("heubert_retro_session_id", data.session.id);
      localStorage.setItem("heubert_collab_name", creatorName.trim());
      setShareUrl(`${window.location.origin}/retrospective/${data.session.id}`);
      startPolling(data.session.id);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (!joinName.trim() || !joinSessionId.trim()) { setError("Please enter your name and the session ID."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/retro?sessionId=${joinSessionId.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Session not found");
      setSession(data.session); setCards(data.cards || []); setCardVotes(data.cardVotes || []);
      setParticipantName(joinName.trim()); setIsHost(false);
      localStorage.setItem("heubert_retro_session_id", data.session.id);
      localStorage.setItem("heubert_collab_name", joinName.trim());
      setView("board"); startPolling(joinSessionId.trim());
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  // ── Pin card ─────────────────────────────────────────────
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
      const res = await fetch("/api/retro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add_card", sessionId: session.id, columnType: colKey, content: text.trim(), author: participantName || "" }) });
      const data = await res.json();
      if (!res.ok) {
        // Remove optimistic card and show error
        setCards(prev => prev.filter(c => c.id !== tempCard.id));
        setError(`Failed to pin card: ${data.error || res.statusText}`);
        return;
      }
      // Replace temp card with real one from server
      await fetchBoard(session.id);
    } catch (err) {
      setCards(prev => prev.filter(c => c.id !== tempCard.id));
      setError(`Network error: ${err.message}`);
    } finally {
      setPinning(false);
    }
  };

  const handleEndSession = async () => {
    if (!session || !isHost) return;
    if (!confirm("Are you sure you want to end this session? This will lock the board for everyone.")) return;
    try {
      await fetch("/api/retro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end_session", sessionId: session.id })
      });
      await fetchBoard(session.id);
    } catch (_) {}
  };

  const handleDelete = async (cardId) => {
    try { await fetch(`/api/retro?cardId=${cardId}`, { method: "DELETE" }); setCards(prev => prev.filter(c => c.id !== cardId)); } catch (_) {}
  };

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

  // ── Vote ─────────────────────────────────────────────────
  const handleVoteCard = async (cardId) => {
    if (!participantName) return;
    const hasVoted = cardVotes.some(v => String(v.card_id) === String(cardId) && v.participant_name === participantName);
    if (hasVoted) {
      setCardVotes(prev => prev.filter(v => !(String(v.card_id) === String(cardId) && v.participant_name === participantName)));
    } else {
      setCardVotes(prev => [...prev, { card_id: cardId, participant_name: participantName }]);
    }
    await fetch("/api/retro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: hasVoted ? "unvote_card" : "vote_card", cardId, sessionId: session.id, participantName }) });
  };

  const handleTimerAction = async (payload) => {
    try {
      const res = await fetch("/api/retro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        // Optimistically update or just wait for poll
        if (payload.timerState) setTimerState(payload.timerState);
      }
    } catch (_) {}
  };

  // ── Drag handlers ─────────────────────────────────────────
  const handleDragStart = (e, colKey) => { setDragType(colKey); e.dataTransfer.effectAllowed = "copy"; e.dataTransfer.setData("text/plain", colKey); };
  const handleDragEnd   = () => { setDragType(null); setDragOver(null); };
  const handleDragOver  = (e, colKey) => { e.preventDefault(); e.dataTransfer.dropEffect = dragType === colKey ? "copy" : "none"; setDragOver(colKey); };
  const handleDragLeave = (e) => { if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null); };
  const handleDrop = (e, colKey) => {
    e.preventDefault(); setDragOver(null);
    const droppedType = e.dataTransfer.getData("text/plain") || dragType;
    setDragType(null);
    if (droppedType !== colKey) { setRejectedCol(colKey); setTimeout(() => setRejectedCol(null), 600); return; }
    setActiveCompose(null); setComposeText("");
    setDropCol(colKey); setDropText("");
  };

  // ── Helpers ───────────────────────────────────────────────
  const currentColumns = (session?.template && RETRO_TEMPLATES[session.template]) 
    || (selectedTemplate && RETRO_TEMPLATES[selectedTemplate])
    || DEFAULT_COLUMNS;

  const voteCountFor = (cardId) => cardVotes.filter(v => String(v.card_id) === String(cardId)).length;
  const hasVotedFor  = (cardId) => cardVotes.some(v => String(v.card_id) === String(cardId) && v.participant_name === participantName);
  const cardsFor = (colKey) => cards.filter(c => c.column_type === colKey).sort((a, b) => {
    const diff = voteCountFor(b.id) - voteCountFor(a.id);
    if (diff !== 0) return diff;
    return String(a.id).localeCompare(String(b.id)); // Stable secondary sort
  });
  const handleCopy = () => { navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const isDragging = !!dragType;

  // ── All cards with votes sorted for Action Items view ────
  const allCardsSorted = cards
    .filter(c => voteCountFor(c.id) > 0)
    .sort((a, b) => {
      const diff = voteCountFor(b.id) - voteCountFor(a.id);
      if (diff !== 0) return diff;
      return String(a.id).localeCompare(String(b.id)); // Stable secondary sort
    });
  const priorityTier = (cardId) => {
    const v = voteCountFor(cardId);
    if (v >= 3) return { label: "🔴 High Priority", cls: "action-tier-high" };
    if (v >= 1) return { label: "🟡 Worth Discussing", cls: "action-tier-mid" };
    return { label: "⚪ Low Priority", cls: "action-tier-low" };
  };

  return (
    <div className={`retro-page${isEnlarged ? " retro-page-enlarged" : ""}`}>
      {/* Topbar */}
      <div className="retro-topbar">
        {isEnlarged && <span className="retro-topbar-title">🗂️ Retrospective</span>}
        {view === "board" && (
          <button className="retro-action-items-btn" onClick={() => setView("actions")}>
            📋 Action Items {allCardsSorted.length > 0 && <span className="retro-ai-badge">{allCardsSorted.length}</span>}
          </button>
        )}
        {view === "actions" && (
          <button className="poker-back-btn" onClick={() => setView("board")}>← Back to Board</button>
        )}
        <button className="btn-enlarge retro-enlarge-btn" onClick={() => setIsEnlarged(e => !e)} title={isEnlarged ? "Exit fullscreen" : "Fullscreen"}>
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

      {/* ── HOME ── */}
      {!isRestoring && view === "home" && (
        <div className="retro-home">
          <div className="retro-hero">
            <span className="retro-hero-icon">🗂️</span>
            <h2 className="retro-hero-title">Sprint Retrospective</h2>
            <p className="retro-hero-sub">Collaboratively reflect on your sprint. <em>Drag</em> sticky cards onto the matching column, then vote to surface action items.</p>
          </div>
          <div className="retro-entry-grid">
            <div className="retro-entry-card">
              <div className="retro-entry-card-header"><span className="retro-entry-icon">🚀</span><h3>Create Session</h3><p>Start a new retro board as the facilitator</p></div>
              <div className="poker-form">
                <div className="poker-form-group"><label>Your Name</label><input className="poker-input" placeholder="e.g. Alice" value={creatorName} onChange={e => setCreatorName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} /></div>
                <div className="poker-form-group"><label>Sprint</label><input className="poker-input" placeholder="e.g. Sprint 42" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} /></div>
                
                <div className="poker-form-group">
                  <label>Board Flavour</label>
                  <div className="poker-template-selector">
                    <button 
                      className={`poker-template-btn ${selectedTemplate === 'standard' ? 'active' : ''}`}
                      onClick={() => setSelectedTemplate('standard')}
                    >
                      🎉 Standard
                    </button>
                    <button 
                      className={`poker-template-btn ${selectedTemplate === 'sailboat' ? 'active' : ''}`}
                      onClick={() => setSelectedTemplate('sailboat')}
                    >
                      ⛵ Sailboat
                    </button>
                    <button 
                      className={`poker-template-btn ${selectedTemplate === 'start_stop' ? 'active' : ''}`}
                      onClick={() => setSelectedTemplate('start_stop')}
                    >
                      🚀 Start/Stop
                    </button>
                  </div>
                </div>

                <button className="btn-poker-primary" onClick={handleCreate} disabled={loading}>{loading ? <span className="poker-spinner" /> : "🚀 Create Board"}</button>
              </div>
            </div>
            <div className="retro-entry-card retro-entry-card-join">
              <div className="retro-entry-card-header"><span className="retro-entry-icon">🔗</span><h3>Join Session</h3><p>Enter a session ID to join an existing board</p></div>
              <div className="poker-form">
                <div className="poker-form-group"><label>Your Name</label><input className="poker-input" placeholder="e.g. Bob" value={joinName} onChange={e => setJoinName(e.target.value)} /></div>
                <div className="poker-form-group"><label>Session ID</label><input className="poker-input" placeholder="Paste session ID" value={joinSessionId} onChange={e => setJoinSessionId(e.target.value)} onKeyDown={e => e.key === "Enter" && handleJoin()} /></div>
                <button className="btn-poker-secondary" onClick={handleJoin} disabled={loading}>{loading ? <span className="poker-spinner" /> : "🔗 Join Board"}</button>
              </div>
            </div>
          </div>
          {error && <div className="poker-error">{error}</div>}

          {recentSessions.length > 0 && (() => {
            const active = recentSessions.filter(s => !s.is_ended);
            const ended  = recentSessions.filter(s => s.is_ended);
            
            const renderCard = (s) => (
              <button key={s.id} className={`retro-recent-card ${s.is_ended ? 'retro-recent-card-ended' : ''}`} onClick={() => {
                setJoinSessionId(s.id);
                setJoinName(participantName || "");
                if (participantName) {
                  setLoading(true);
                  fetch(`/api/retro?sessionId=${s.id}`)
                    .then(res => res.json())
                    .then(data => {
                      if (data.error) throw new Error(data.error);
                      setSession(data.session);
                      setCards(data.cards || []);
                      setCardVotes(data.cardVotes || []);
                      setParticipantName(participantName);
                      localStorage.setItem("heubert_retro_session_id", data.session.id);
                      localStorage.setItem("heubert_collab_name", participantName);
                      setView("board");
                      startPolling(s.id);
                    })
                    .catch(e => setError(e.message))
                    .finally(() => setLoading(false));
                } else {
                  document.querySelector('.retro-entry-card-join').scrollIntoView({ behavior: 'smooth' });
                }
              }}>
                <div className="retro-recent-card-top">
                  <span className="retro-recent-emoji">{RETRO_TEMPLATES[s.template]?.[0]?.emoji || "📋"}</span>
                  <div className="retro-recent-meta">
                    <h4>{s.title} {s.is_ended && <span className="retro-ended-tag">Ended</span>}</h4>
                    <span>By {s.created_by} · {new Date(s.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="retro-recent-badge">{s.template}</div>
              </button>
            );

            return (
              <div className="retro-recent-sessions">
                {active.length > 0 && (
                  <div className="retro-recent-section">
                    <h3 className="retro-recent-title">🌐 Active Boards</h3>
                    <div className="retro-recent-grid">{active.map(renderCard)}</div>
                  </div>
                )}
                {ended.length > 0 && (
                  <div className="retro-recent-section" style={{ marginTop: '40px' }}>
                    <h3 className="retro-recent-title">🏁 Completed Boards</h3>
                    <div className="retro-recent-grid">{ended.map(renderCard)}</div>
                  </div>
                )}
              </div>
            );
          })()}
          <div className="retro-preview">
            {currentColumns.map(col => (
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
          {session.template === "sailboat"    && <SailboatScene />}
          {session.template === "start_stop" && <SpaceScene />}
          {error && (
            <div className="poker-error" style={{ 
              position: 'fixed', 
              top: '20px', 
              left: '50%', 
              transform: 'translateX(-50%)', 
              zIndex: 9999,
              boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
              minWidth: '300px'
            }}>
              {error} 
              <button onClick={() => setError("")} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', float: 'right', marginLeft: '10px' }}>✕</button>
            </div>
          )}
          {/* Header */}
          <div className="retro-board-header">
            {/* Row 1: exit | title + badge | timer + end action */}
            <div className="retro-board-toprow">
              <div className="retro-board-meta">
                <button className="poker-back-btn" onClick={() => {
                  if (pollRef.current) clearInterval(pollRef.current);
                  setView("home");
                  setSession(null);
                  setCards([]);
                  setCardVotes([]);
                  setError("");
                  localStorage.removeItem("heubert_retro_session_id");
                }}>← Exit</button>
                <div>
                  <h2 className="retro-board-title">{session.title}</h2>
                  <span className="retro-board-badge">{isHost ? "🎯 Facilitator" : "👤 Participant"} · {cards.length} card{cards.length !== 1 ? "s" : ""}</span>
                </div>
              </div>
              <div className="poker-session-actions">
                {isHost && (
                  <RetroTimer
                    session={session}
                    isHost={isHost}
                    timerState={timerState}
                    onUpdate={handleTimerAction}
                  />
                )}
                {isHost && !session.is_ended && (
                  <button className="retro-end-session-btn" onClick={handleEndSession}>
                    🏁 End Session
                  </button>
                )}
                {isHost && session.is_ended && (
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
                <button className={`poker-copy-btn ${copied ? "copied" : ""}`} onClick={handleCopy}>{copied ? "✅ Copied!" : "📋 Copy"}</button>
                <button className="poker-qr-btn" onClick={() => setShowQR(true)} title="Show QR code">📱 QR</button>
                <span className="poker-session-id-label">ID:</span>
                <code className="poker-session-id">{session.id}</code>
              </div>
            )}
          </div>

          {/* Card Stacks — draggable */}
          {!session.is_ended && (
          <div className="retro-stack-tray">
            <p className="retro-stack-tray-label">
              {participantName ? <>Hi <strong>{participantName}</strong> — <span className="retro-drag-hint">↕ drag</span> a card to the matching column, or click to compose:</> : "Pick a card to add your thought:"}
            </p>
            <div className="retro-stacks">
              {currentColumns.map(col => (
                <button key={col.key}
                  draggable
                  onDragStart={e => handleDragStart(e, col.key)}
                  onDragEnd={handleDragEnd}
                  className={["retro-stack", `retro-stack-${col.color}`, activeCompose === col.key ? "retro-stack-active" : "", isDragging && dragType === col.key ? "retro-stack-dragging" : ""].join(" ")}
                  onClick={() => { setDropCol(null); setDropText(""); setActiveCompose(col.key); setComposeText(""); }}
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
          )}

          {/* Global compose panel */}
          {activeCompose && !session.is_ended && (() => {
            const col = currentColumns.find(c => c.key === activeCompose);
            return (
              <div className="retro-compose-panel">
                <div className={`retro-compose-card retro-compose-${col.color}`}>
                  <div className="retro-compose-pin">📌</div>
                  <textarea ref={composeRef} className="retro-compose-textarea" placeholder={`Write your thought for "${col.label}"…`} value={composeText} onChange={e => setComposeText(e.target.value)} maxLength={280} rows={4} />
                  <div className="retro-compose-footer">
                    <span className="retro-compose-char">{composeText.length}/280</span>
                    <div className="retro-compose-actions">
                      <button className="retro-btn-cancel" onClick={() => { setActiveCompose(null); setComposeText(""); }}>Cancel</button>
                      <button className={`retro-btn-pin retro-btn-pin-${col.color}`} onClick={() => handlePin(col.key, composeText, () => { setActiveCompose(null); setComposeText(""); })} disabled={!composeText.trim() || pinning}>
                        {pinning ? <span className="poker-spinner" /> : "📌 Pin to Board"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Board columns */}
          <div className={`retro-columns${isDragging ? " retro-columns-dragging" : ""}`}>
            {currentColumns.map(col => {
              const isOver   = dragOver === col.key;
              const isMatch  = dragType === col.key;
              const isReject = rejectedCol === col.key;
              const hasDrop  = dropCol === col.key;
              const colCards = cardsFor(col.key);
              return (
                <div key={col.key}
                  className={["retro-column", `retro-column-${col.color}`, isOver && isMatch ? "retro-column-drop-valid" : "", isOver && !isMatch ? "retro-column-drop-invalid" : "", isReject ? "retro-column-rejected" : ""].filter(Boolean).join(" ")}
                  onDragOver={e => handleDragOver(e, col.key)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, col.key)}
                >
                  {/* Fallback if column not found in current template */}
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
                        <textarea ref={dropComposeRef} className="retro-compose-textarea" placeholder={`Your thought for "${col.label}"…`} value={dropText} onChange={e => setDropText(e.target.value)} maxLength={280} rows={3} />
                        <div className="retro-compose-footer">
                          <span className="retro-compose-char">{dropText.length}/280</span>
                          <div className="retro-compose-actions">
                            <button className="retro-btn-cancel" onClick={() => { setDropCol(null); setDropText(""); }}>Cancel</button>
                            <button className={`retro-btn-pin retro-btn-pin-${col.color}`} onClick={() => handlePin(col.key, dropText, () => { setDropCol(null); setDropText(""); })} disabled={!dropText.trim() || pinning}>
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

                    {colCards.length === 0 && !hasDrop && activity.filter(a => a.column_type === col.key).length === 0 && (
                      <div className={`retro-column-empty${isDragging && isMatch ? " retro-column-empty-glow" : ""}`}>
                        {isDragging && isMatch ? "Drop here ↓" : `No cards yet — pick a ${col.emoji} card above!`}
                      </div>
                    )}
                    {colCards.map((card, idx) => {
                      const cardVoteCount  = voteCountFor(card.id);
                      const iVoted = hasVotedFor(card.id);
                      const isEditing = editingCardId === card.id;
                      const isMine = card.author === participantName;

                      // Render content with @mention highlights
                      const renderContent = (text) => {
                        const parts = text.split(/(@\w[\w\s]*?\b)/g);
                        return parts.map((part, i) =>
                          part.startsWith("@")
                            ? <span key={i} className="retro-mention">{part}</span>
                            : part
                        );
                      };

                      return (
                        <div key={card.id} className={`retro-sticky retro-sticky-${col.color}`} style={{ "--card-rotate": `${(idx % 2 === 0 ? 1 : -1) * (0.5 + (idx % 3) * 0.4)}deg` }}>
                          <div className="retro-sticky-pin">📌</div>

                          {isEditing ? (
                            <MentionTextarea
                              value={editText}
                              onChange={setEditText}
                              employeeNames={employeeNames}
                              className="retro-compose-textarea retro-edit-textarea"
                              maxLength={280}
                              rows={3}
                              onSave={() => handleEditCard(card.id)}
                              onCancel={() => { setEditingCardId(null); setEditText(""); }}
                              saving={savingEdit}
                            />
                          ) : (
                            <p className="retro-sticky-content">{renderContent(card.content)}</p>
                          )}

                          <div className="retro-sticky-footer">
                            <span className="retro-sticky-author">— {card.author}</span>
                            <div className="retro-sticky-actions">
                              <button className={`retro-vote-btn${iVoted ? " retro-vote-btn-active" : ""}`} onClick={() => !session.is_ended && handleVoteCard(card.id)} title={session.is_ended ? "" : (iVoted ? "Remove vote" : "Vote — mark as important")} disabled={session.is_ended}>
                                👍{cardVoteCount > 0 && <span className="retro-vote-count">{cardVoteCount}</span>}
                              </button>
                              {!session.is_ended && isMine && !card.id.toString().startsWith("temp_") && !isEditing && (
                                <button className="retro-sticky-edit" onClick={() => {
                                  setEditingCardId(card.id);
                                  setEditText(card.content);
                                  setSavingEdit(false);
                                }} title="Edit">✏️</button>
                              )}
                              {(card.author === participantName || isHost) && !session.is_ended && !isEditing && (
                                <button className="retro-sticky-delete" onClick={() => handleDelete(card.id)} title="Remove">✕</button>
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
        </div>
      )}

      {/* ── ACTION ITEMS BOARD ── */}
      {view === "actions" && session && (
        <div className="retro-actions-view">
          <div className="retro-actions-header">
            <h2 className="retro-actions-title">📋 Action Items — {session.title}</h2>
            <p className="retro-actions-sub">Cards ranked by team votes. Highest voted = most important to act on.</p>
          </div>

          {allCardsSorted.length === 0 ? (
            <div className="retro-actions-empty">No voted cards yet — top-voted cards will appear here as action items.</div>
          ) : (
            <div className="retro-actions-list">
              {allCardsSorted.map((card, idx) => {
                const votes  = voteCountFor(card.id);
                const col    = currentColumns.find(c => c.key === card.column_type) || currentColumns[0];
                const tier   = priorityTier(card.id);
                return (
                  <div key={card.id} className={`retro-action-item ${tier.cls}`}>
                    <div className="retro-action-rank">#{idx + 1}</div>
                    <div className="retro-action-votes">
                      <span className="retro-action-vote-num">{votes}</span>
                      <span className="retro-action-vote-label">vote{votes !== 1 ? "s" : ""}</span>
                    </div>
                    <div className="retro-action-body">
                      <div className="retro-action-meta">
                        <span className={`retro-action-col retro-action-col-${col.color}`}>{col.emoji} {col.label}</span>
                        <span className="retro-action-tier-badge">{tier.label}</span>
                      </div>
                      <p className="retro-action-content">{card.content}</p>
                      <span className="retro-action-author">— {card.author}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
