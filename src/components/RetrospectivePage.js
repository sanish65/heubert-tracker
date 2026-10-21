"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import RetroTimer from "./RetroTimer";
import ShareQRModal from "@/components/ShareQRModal";
import SailboatScene from "@/components/SailboatScene";
import SpaceScene    from "@/components/SpaceScene";
import RetroActionItems from "@/components/RetroActionItems";
import RetroKudos from "@/components/RetroKudos";
import RetroThemeTools, { useThemeAutoPlacement } from "@/components/RetroThemeTools";
import Icon from "@/components/Icon";
import Avatar from "@/components/Avatar";
import { postRetro } from "@/lib/retroApi";
import { ACTION_ITEM_MAX, VOTE_EMOJI, reactionCounts, voteCount, totalReactions, byVotes, topVoted } from "@/lib/retroBoardRules";
import { arrangeColumn, THEME_NAME_MAX } from "@/lib/retroThemes";

const RETRO_TEMPLATES = {
  // Left to right: what we are taking forward, then what to fix, then what went well.
  // This is display order only — a card's column_type is its key, so reordering here
  // moves nothing in the database. Do NOT mirror this order into the TEMPLATES arrays in
  // src/app/api/retro/route.js: those map template keys onto the three DB column values
  // BY POSITION, and reordering them would file Focus cards as went_well.
  // `tone` is the pill colour (Retro.dc.html): each column takes the colour of the DB
  // column the route files it under — went_well green, improve amber, focus blue — so
  // every flavour reads in the same three colours. The same table lives in
  // src/app/retrospective/[sessionId]/page.js.
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

const FLAVOURS = [
  { key: "standard",   label: "Standard" },
  { key: "sailboat",   label: "Sailboat" },
  { key: "start_stop", label: "Start/Stop" },
];
const flavourLabel = (key) => FLAVOURS.find(f => f.key === key)?.label || key;

const DEFAULT_COLUMNS = RETRO_TEMPLATES.standard;
const REACTION_EMOJIS = ["👍", "❤️", "😂", "😮", "🎉", "💡"];
// The vote button is the 👍 reaction (VOTE_EMOJI): same data, shown on its own with a thumbs-up icon.

// The column's label chip: pill colours from the column's tone, a line icon, no emoji.
// `as="h3"` makes the chip the column's heading.
function ColumnChip({ col, as: Tag = "span" }) {
  return (
    <Tag className="retro-col-chip">
      <Icon name={col.icon} size={14} strokeWidth={2} />
      <span className="retro-col-chip-text">{col.label}</span>
    </Tag>
  );
}

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
    <div className="retro-mention-wrapper">
      <textarea
        ref={taRef}
        className={className}
        aria-label="Card text"
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
        <span className="retro-compose-char mono">{value.length}/{maxLength} · Ctrl+Enter to save</span>
        <div className="retro-compose-actions">
          <button className="btn btn-secondary btn-sm" type="button" onClick={onCancel}>Cancel</button>
          <button className="btn btn-primary btn-sm" type="button" onClick={onSave} disabled={!value.trim() || saving}>
            {saving ? <span className="retro-spinner" aria-hidden="true" /> : "Save"}
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
  const [cardReactions, setCardReactions] = useState([]); // [{card_id, participant_name, emoji}] — includes the 👍 "like" reaction
  const [actionItems, setActionItems] = useState({ carried: [], own: [] });
  const [members, setMembers]       = useState([]);
  const [kudos, setKudos]           = useState([]);
  const [kudosReactions, setKudosReactions] = useState([]);
  const [themes, setThemes]         = useState([]);
  const [themeCards, setThemeCards] = useState([]);
  const [selectedCardIds, setSelectedCardIds] = useState([]); // cards ticked for "New theme"
  const [renamingTheme, setRenamingTheme] = useState(null);   // { id, text } while a theme name is edited
  const [pickingCardIds, setPickingCardIds] = useState([]); // voted cards whose action-item tick is in flight
  const [reactionPickerFor, setReactionPickerFor] = useState(null);
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
  const [selectedProjectId, setSelectedProjectId] = useState("");   // project the new board belongs to
  // null until a project tab is picked — boards stay hidden rather than dumping every
  // board of every project on arrival. "all" | project id | "none" once chosen.
  const [projectFilter, setProjectFilter] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState("");
  const [recentSessions, setRecentSessions] = useState([]);
  const [isRestoring, setIsRestoring] = useState(true);

  // ── Edit card state ───────────────────────────────────────
  const [editingCardId, setEditingCardId] = useState(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [timerState, setTimerState] = useState(null);

  const { employees, currentEmployee, user, isAdmin, projects, animationsEnabled } = useApp();
  const { confirmDialog, promptDialog } = useDialog();
  // A retro belongs to the project the team ran it for. Archived projects drop out of
  // the create picker but keep their tab below for as long as they own boards.
  const activeProjects = useMemo(
    () => (projects || []).filter(p => p.status !== "archived"),
    [projects]
  );
  const employeeNames = employees.map(e => e.name);
  const loggedInName = currentEmployee?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const canEndSession = isHost || !!isAdmin;
  const canManageActions = isHost || !!isAdmin;

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
  const onBoardRef       = useRef(false); // guard against stale fetch responses after exit

  // ── Fetch board ──────────────────────────────────────────
  const fetchBoard = useCallback(async (sid) => {
    try {
      const res = await fetch(`/api/retro?sessionId=${encodeURIComponent(sid)}`);
      if (!res.ok || !onBoardRef.current) return;
      const data = await res.json();
      if (!onBoardRef.current) return; // check again after second await
      setSession(data.session);
      setCards(data.cards || []);
      setCardReactions(data.cardReactions || []);
      setActionItems(data.actionItems || { carried: [], own: [] });
      setMembers(data.members || []);
      setKudos(data.kudos || []);
      setKudosReactions(data.kudosReactions || []);
      setThemes(data.themes || []);
      setThemeCards(data.themeCards || []);
      if (data.session?.is_ended) { setSelectedCardIds([]); setRenamingTheme(null); } // themes freeze when the board ends
      setActivity(data.activity || []);
      setTimerState(data.timerState);
    } catch (_) {}
  }, []);

  const startPolling = useCallback((sid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    onBoardRef.current = true;
    pollRef.current = setInterval(() => fetchBoard(sid), 2500);
  }, [fetchBoard]);

  const resetToHome = useCallback(() => {
    onBoardRef.current = false;
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    if (typingTimeoutRef.current) { clearTimeout(typingTimeoutRef.current); typingTimeoutRef.current = null; }
    isTypingRef.current = false;
    setView("home");
    setSession(null);
    setCards([]);
    setCardReactions([]);
    setActionItems({ carried: [], own: [] });
    setMembers([]);
    setKudos([]);
    setKudosReactions([]);
    setThemes([]);
    setThemeCards([]);
    setSelectedCardIds([]);
    setRenamingTheme(null);
    setReactionPickerFor(null);
    setActivity([]);
    setError("");
    setIsHost(false);
    setShareUrl("");
    setCopied(false);
    setShowQR(false);
    setActiveCompose(null);
    setComposeText("");
    setDropCol(null);
    setDropText("");
    setEditingCardId(null);
    setEditText("");
    setTimerState(null);
    setDragType(null);
    setDragOver(null);
    setRejectedCol(null);
    localStorage.removeItem("heubert_retro_session_id");
  }, []);

  // ── Auto-restore session from localStorage ──────────────────
  useEffect(() => {
    const savedId = localStorage.getItem("heubert_retro_session_id");
    const savedName = localStorage.getItem("heubert_collab_name") || loggedInName;
    if (savedName) {
      setParticipantName(savedName);
      setJoinName(savedName);
      setCreatorName(savedName);
    }
    if (savedId) {
      setJoinSessionId(savedId);
      const autoJoin = async () => {
        try {
          const res = await fetch(`/api/retro?sessionId=${encodeURIComponent(savedId)}`);
          if (!res.ok) {
            localStorage.removeItem("heubert_retro_session_id");
            setIsRestoring(false);
            return;
          }
          const data = await res.json();
          setSession(data.session);
          setCards(data.cards || []);
          setCardReactions(data.cardReactions || []);
          setActionItems(data.actionItems || { carried: [], own: [] });
          setMembers(data.members || []);
          setKudos(data.kudos || []);
          setKudosReactions(data.kudosReactions || []);
          setThemes(data.themes || []);
          setThemeCards(data.themeCards || []);
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

  const fetchRecentSessions = useCallback(async (retriesLeft = 2) => {
    try {
      const res = await fetch("/api/retro");
      if (!res.ok) throw new Error(`Failed to load boards (${res.status})`);
      const data = await res.json();
      if (data.sessions) setRecentSessions(data.sessions);
    } catch (err) {
      if (retriesLeft > 0) {
        setTimeout(() => fetchRecentSessions(retriesLeft - 1), 800);
      } else {
        console.error("Failed to load retro boards:", err);
      }
    }
  }, []);

  useEffect(() => {
    if (view === "home") {
      fetchRecentSessions();
    }
  }, [view, fetchRecentSessions]);

  // Facilitators run retros for the same project sprint after sprint, so preselect the
  // one they used last — but only while it still exists and is not archived.
  useEffect(() => {
    if (selectedProjectId || !activeProjects.length) return;
    const remembered = localStorage.getItem("heubert_retro_project_id");
    if (remembered && activeProjects.some(p => String(p.id) === remembered)) {
      setSelectedProjectId(remembered);
    }
  }, [activeProjects, selectedProjectId]);

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
    if (!selectedProjectId) { setError("Please choose the project this retro is for."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch("/api/retro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          title: sessionTitle.trim(),
          createdBy: creatorName.trim(),
          template: selectedTemplate,
          projectId: selectedProjectId
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSession(data.session); setCards([]);
      setView("board"); setIsHost(true);
      setParticipantName(creatorName.trim());
      localStorage.setItem("heubert_retro_session_id", data.session.id);
      localStorage.setItem("heubert_collab_name", creatorName.trim());
      localStorage.setItem("heubert_retro_project_id", String(selectedProjectId));
      setShareUrl(`${window.location.origin}/retrospective/${data.session.id}`);
      startPolling(data.session.id);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  const handleJoin = async () => {
    if (!joinName.trim() || !joinSessionId.trim()) { setError("Please enter your name and the session ID."); return; }
    setLoading(true); setError("");
    try {
      const res = await fetch(`/api/retro?sessionId=${encodeURIComponent(joinSessionId.trim())}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Session not found");
      setSession(data.session); setCards(data.cards || []); setCardReactions(data.cardReactions || []);
      setActionItems(data.actionItems || { carried: [], own: [] }); setMembers(data.members || []); setKudos(data.kudos || []); setKudosReactions(data.kudosReactions || []);
      setThemes(data.themes || []); setThemeCards(data.themeCards || []);
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
    if (!session || !canEndSession) return;
    if (!(await confirmDialog("Are you sure you want to end this session? This will lock the board for everyone.", { danger: true, confirmText: "End Session" }))) return;
    try {
      await fetch("/api/retro", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "end_session", sessionId: session.id })
      });
    } catch (_) {}
    resetToHome();
  };

  // Before ending the retro the facilitator ticks the voted cards the team will act on.
  // A ticked card is an action item of this board (so later boards of the project carry
  // it); unticking removes it again. The board's own items say which cards are ticked.
  const actionItemForCard = (cardId) => actionItems.own.find(i => i.source_card_id === cardId);

  const handleToggleCardAction = async (card) => {
    if (!session || pickingCardIds.includes(card.id)) return;
    const existing = actionItemForCard(card.id);
    setPickingCardIds(prev => [...prev, card.id]);
    try {
      if (existing) {
        await postRetro({ action: "delete_action_item", sessionId: session.id, itemId: existing.id, actorName: participantName });
      } else {
        await postRetro({
          action: "add_action_item",
          sessionId: session.id,
          content: card.content.trim().slice(0, ACTION_ITEM_MAX),
          ownerEmployeeId: null,
          sourceCardId: card.id,
          actorName: participantName,
        });
      }
      await fetchBoard(session.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setPickingCardIds(prev => prev.filter(id => id !== card.id));
    }
  };

  const handleDelete = async (cardId) => {
    try { await fetch(`/api/retro?cardId=${encodeURIComponent(cardId)}`, { method: "DELETE" }); setCards(prev => prev.filter(c => c.id !== cardId)); } catch (_) {}
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

  // ── React on card (👍 "like" is just another reaction emoji) ──
  const handleReact = async (cardId, emoji) => {
    if (!participantName) return;
    const already = cardReactions.some(r => String(r.card_id) === String(cardId) && r.participant_name === participantName && r.emoji === emoji);
    if (already) {
      setCardReactions(prev => prev.filter(r => !(String(r.card_id) === String(cardId) && r.participant_name === participantName && r.emoji === emoji)));
    } else {
      setCardReactions(prev => [...prev, { card_id: cardId, participant_name: participantName, emoji }]);
    }
    await fetch("/api/retro", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: already ? "unreact_card" : "react_card", cardId, sessionId: session.id, participantName, emoji }) });
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

  const reactionCountsFor = (cardId) => reactionCounts(cardReactions, cardId);
  const hasReacted = (cardId, emoji) => cardReactions.some(r => String(r.card_id) === String(cardId) && r.participant_name === participantName && r.emoji === emoji);
  const voteCountFor = (cardId) => voteCount(cardReactions, cardId);
  // Theme totals count every emoji; voteCountFor above is the 👍 count that ranks cards.
  const totalReactionsFor = (cardId) => totalReactions(cardReactions, cardId);
  const cardsFor = (colKey) => cards.filter(c => c.column_type === colKey).sort(byVotes(cardReactions));

  // ── Themes (facilitator/admin while the board is open; the server checks again) ──
  const canManageThemes = canManageActions && !session?.is_ended;
  useThemeAutoPlacement({
    enabled: canManageThemes,
    session, cards, themes, themeCards, participantName,
    onChanged: () => fetchBoard(session.id),
    onError: setError,
  });
  const themeIdOfCard = new Map(themeCards.map(m => [String(m.card_id), String(m.theme_id)]));
  // Ticks on cards that have since been deleted are dropped, so the toolbar counts live cards.
  const liveSelectedIds = selectedCardIds.filter(id => cards.some(c => String(c.id) === id));
  const toggleSelected = (cardId) => {
    const id = String(cardId);
    setSelectedCardIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const handleMoveCard = async (cardId, themeId) => {
    try {
      await postRetro({ action: "move_card_to_theme", sessionId: session.id, actorName: participantName, cardId: String(cardId), themeId });
      fetchBoard(session.id);
    } catch (err) { setError(err.message); }
  };
  const handleRenameTheme = async (theme) => {
    const name = renamingTheme?.text.trim() || "";
    setRenamingTheme(null);
    if (!name || name === theme.name) return;
    try {
      await postRetro({ action: "rename_theme", sessionId: session.id, actorName: participantName, themeId: theme.id, name });
      fetchBoard(session.id);
    } catch (err) { setError(err.message); }
  };

  const handleCopy = () => { navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); };
  const isDragging = !!dragType;

  // ── All cards with votes sorted for Action Items view ────
  const allCardsSorted = topVoted(cards, cardReactions);
  // Vote tiers for the Top Voted list (Retro.dc.html): each label is a pill, no emoji.
  const priorityTier = (cardId) => {
    const v = voteCountFor(cardId);
    if (v >= 3) return { key: "high", label: "High priority", rule: "3 or more votes", pill: "pill-red" };
    if (v >= 1) return { key: "mid", label: "Worth discussing", rule: "1–2 votes", pill: "pill-amber" };
    return { key: "low", label: "Low priority", rule: "No votes yet", pill: "pill-gray" };
  };
  // The ranked cards grouped under their tier, in rank order; the rank number stays global.
  const tierGroups = [];
  allCardsSorted.forEach((card, idx) => {
    const tier = priorityTier(card.id);
    let group = tierGroups.find(g => g.key === tier.key);
    if (!group) { group = { ...tier, rows: [] }; tierGroups.push(group); }
    group.rows.push({ card, rank: idx + 1 });
  });
  const columnFor = (card) => currentColumns.find(c => c.key === card.column_type) || currentColumns[0];
  const animated = animationsEnabled !== false;

  return (
    <div className={`retro-page${isEnlarged ? " retro-page-enlarged" : ""}${animated ? " is-animated" : ""}`}>
      <div className="retro-toolbar">
        {view === "board" && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setView("actions")}>
            <Icon name="thumbs-up" size={16} strokeWidth={2} />
            Top Voted
            {allCardsSorted.length > 0 && <span className="pill pill-blue mono">{allCardsSorted.length}</span>}
          </button>
        )}
        {view === "actions" && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setView("board")}>
            <Icon name="arrow-left" size={16} />
            Back to Board
          </button>
        )}
        {isEnlarged && <span className="retro-toolbar-title">Retrospective</span>}
        <div className="retro-toolbar-end">
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
        <div className="retro-loading">
          <div className="spinner" />
          <p>Loading your session...</p>
        </div>
      )}

      {/* ── HOME ── */}
      {!isRestoring && view === "home" && (
        <div className="retro-home">
          <div className="retro-entry-grid">
            <section className="glass-card retro-entry" aria-labelledby="retro-create-title">
              <div className="retro-entry-head">
                <span className="modal-icon"><Icon name="plus" size={20} /></span>
                <div>
                  <h2 id="retro-create-title" className="section-title">Create Session</h2>
                  <p className="retro-entry-sub">Start a new retro board as the facilitator</p>
                </div>
              </div>
              <label className="retro-field">
                <span>Your Name</span>
                <input type="text" placeholder="e.g. Alice" value={creatorName} onChange={e => setCreatorName(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} />
              </label>
              <label className="retro-field">
                <span>Sprint</span>
                <input type="text" placeholder="e.g. Sprint 42" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} onKeyDown={e => e.key === "Enter" && handleCreate()} />
              </label>
              <div className="retro-field">
                <label htmlFor="retro-project">Project</label>
                <select
                  id="retro-project"
                  value={selectedProjectId}
                  onChange={e => setSelectedProjectId(e.target.value)}
                >
                  <option value="">Select a project…</option>
                  {activeProjects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {!activeProjects.length && (
                  <span className="retro-field-hint">No projects yet — add one on the Projects page first.</span>
                )}
              </div>
              <div className="retro-field">
                <span id="retro-flavour-label">Board Flavour</span>
                <div className="status-tabs retro-flavours" role="group" aria-labelledby="retro-flavour-label">
                  {FLAVOURS.map(f => (
                    <button
                      key={f.key}
                      type="button"
                      className={`tab${selectedTemplate === f.key ? " tab-active" : ""}`}
                      aria-pressed={selectedTemplate === f.key}
                      onClick={() => setSelectedTemplate(f.key)}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className="btn btn-primary retro-entry-btn" onClick={handleCreate} disabled={loading}>
                {loading ? <span className="retro-spinner" aria-hidden="true" /> : "Create Board"}
              </button>
            </section>

            <section className="glass-card retro-entry" aria-labelledby="retro-join-title">
              <div className="retro-entry-head">
                <span className="modal-icon"><Icon name="link" size={20} /></span>
                <div>
                  <h2 id="retro-join-title" className="section-title">Join Session</h2>
                  <p className="retro-entry-sub">Enter a session ID to join an existing board</p>
                </div>
              </div>
              <label className="retro-field">
                <span>Your Name</span>
                <input type="text" placeholder="e.g. Bob" value={joinName} onChange={e => setJoinName(e.target.value)} />
              </label>
              <label className="retro-field">
                <span>Session ID</span>
                <input type="text" className="mono" placeholder="Paste session ID" value={joinSessionId} onChange={e => setJoinSessionId(e.target.value)} onKeyDown={e => e.key === "Enter" && handleJoin()} />
              </label>
              <button type="button" className="btn btn-primary retro-entry-btn" onClick={handleJoin} disabled={loading}>
                {loading ? <span className="retro-spinner" aria-hidden="true" /> : "Join Board"}
              </button>
            </section>
          </div>

          {error && (
            <div className="form-error retro-error" role="alert">
              <Icon name="alert" size={16} />
              <span className="retro-error-text">{error}</span>
            </div>
          )}

          {recentSessions.length > 0 && (() => {
            // Boards are grouped by the project their team ran them for. A project only
            // earns a tab once it has boards, and "No project" only appears while a board
            // still predates the project migration.
            const countFor = (id) => recentSessions.filter(s => (s.project_id ?? null) === id).length;
            const projectTabs = (projects || [])
              .map(p => ({ id: String(p.id), label: p.name, count: countFor(p.id) }))
              .filter(t => t.count > 0);
            const unassignedCount = countFor(null);
            const tabs = [
              { id: "all", label: "All", count: recentSessions.length },
              ...projectTabs,
              ...(unassignedCount ? [{ id: "none", label: "No project", count: unassignedCount }] : []),
            ];

            const visible = projectFilter === null ? [] : recentSessions.filter(s => {
              if (projectFilter === "all")  return true;
              if (projectFilter === "none") return !s.project_id;
              return String(s.project_id) === projectFilter;
            });
            const active = visible.filter(s => !s.is_ended);
            const ended  = visible.filter(s => s.is_ended);

            const renderBoardRow = (s) => (
              <li key={s.id}>
                <button type="button" className={`retro-board-row${s.is_ended ? " is-ended" : ""}`} onClick={async () => {
                  const nameToUse = participantName || joinName || creatorName || loggedInName || await promptDialog("Enter your name to join this board:");
                  if (!nameToUse?.trim()) return;
                  setJoinSessionId(s.id);
                  setJoinName(nameToUse.trim());
                  setLoading(true);
                  fetch(`/api/retro?sessionId=${encodeURIComponent(s.id)}`)
                    .then(res => res.json())
                    .then(data => {
                      if (data.error) throw new Error(data.error);
                      setSession(data.session);
                      setCards(data.cards || []);
                      setCardReactions(data.cardReactions || []);
                      setActionItems(data.actionItems || { carried: [], own: [] });
                      setMembers(data.members || []);
                      setKudos(data.kudos || []);
                      setKudosReactions(data.kudosReactions || []);
                      setThemes(data.themes || []);
                      setThemeCards(data.themeCards || []);
                      setParticipantName(nameToUse.trim());
                      localStorage.setItem("heubert_retro_session_id", data.session.id);
                      localStorage.setItem("heubert_collab_name", nameToUse.trim());
                      setView("board");
                      startPolling(s.id);
                    })
                    .catch(e => setError(e.message))
                    .finally(() => setLoading(false));
                }}>
                  <span className="retro-board-main">
                    <span className="retro-board-name">{s.title}</span>
                    <span className="retro-board-by">
                      By {s.created_by} · <span className="mono">{new Date(s.created_at).toLocaleDateString()}</span>
                    </span>
                  </span>
                  <span className="retro-board-pills">
                    <span className={`pill ${s.project ? "pill-blue" : "pill-gray"} retro-board-project`}>
                      <Icon name="folder" size={12} strokeWidth={2} />
                      <span className="retro-board-project-name">{s.project?.name || "No project"}</span>
                    </span>
                    {s.template && <span className="pill pill-gray">{flavourLabel(s.template)}</span>}
                    {s.is_ended && <span className="pill pill-gray">Ended</span>}
                  </span>
                </button>
              </li>
            );

            return (
              <>
                <div className="glass retro-project-bar">
                  <div className="retro-project-tabs" role="group" aria-label="Filter boards by project">
                    {tabs.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        className={`retro-project-tab${projectFilter === t.id ? " is-active" : ""}`}
                        aria-pressed={projectFilter === t.id}
                        onClick={() => setProjectFilter(t.id)}
                      >
                        {t.label} <span className="retro-project-tab-count">{t.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
                {projectFilter === null ? (
                  <p className="empty-msg retro-empty">
                    Pick a project above to see its retro boards.
                  </p>
                ) : (
                  <>
                    {active.length > 0 && (
                      <section className="glass-card retro-boards" aria-labelledby="retro-active-title">
                        <h2 id="retro-active-title" className="section-title">Active Boards</h2>
                        <ul className="retro-board-list">{active.map(renderBoardRow)}</ul>
                      </section>
                    )}
                    {ended.length > 0 && (
                      <section className="glass-card retro-boards" aria-labelledby="retro-ended-title">
                        <h2 id="retro-ended-title" className="section-title">Completed Boards</h2>
                        <ul className="retro-board-list">{ended.map(renderBoardRow)}</ul>
                      </section>
                    )}
                    {visible.length === 0 && (
                      <p className="empty-msg retro-empty">No retro boards for this project yet — create the first one above.</p>
                    )}
                  </>
                )}
              </>
            );
          })()}
          <div className="retro-preview">
            {currentColumns.map(col => (
              <div key={col.key} className={`retro-preview-col retro-tone-${col.tone}`}>
                <ColumnChip col={col} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Themed backgrounds (persist across board + actions views), under all page content ── */}
      {(view === "board" || view === "actions") && (session?.template === "sailboat" || session?.template === "start_stop") && (
        <div className="retro-scene" aria-hidden="true">
          {session.template === "sailboat" ? <SailboatScene /> : <SpaceScene />}
        </div>
      )}

      {/* ── BOARD ── */}
      {view === "board" && session && (
        <div className="retro-board-view">
          {error && (
            <div className="form-error retro-error retro-toast" role="alert">
              <Icon name="alert" size={16} />
              <span className="retro-error-text">{error}</span>
              <button type="button" className="retro-icon-btn" onClick={() => setError("")} aria-label="Dismiss error" title="Dismiss">
                <Icon name="x" size={14} strokeWidth={2} />
              </button>
            </div>
          )}

          <div className="retro-board-head">
            <div className="retro-board-head-text">
              {session.template && <span className="page-eyebrow">{flavourLabel(session.template)} board</span>}
              <h2 className="retro-board-title">{session.title}</h2>
              <div className="retro-board-meta">
                {session.project?.name && (
                  <>
                    <span className="retro-head-project"><Icon name="folder" size={15} />{session.project.name}</span>
                    <span aria-hidden="true">·</span>
                  </>
                )}
                <span className={`pill ${isHost ? "pill-cyan" : "pill-gray"}`}>{isHost ? "Facilitator" : "Participant"}</span>
                <span aria-hidden="true">·</span>
                <span><span className="mono">{cards.length}</span> card{cards.length !== 1 ? "s" : ""}</span>
              </div>
            </div>
            <div className="retro-board-actions">
              <button type="button" className="btn btn-secondary" onClick={resetToHome}>
                <Icon name="arrow-left" size={16} strokeWidth={2} />
                Exit
              </button>
              {canEndSession && !session.is_ended && (
                <button type="button" className="btn btn-secondary retro-end-btn" onClick={handleEndSession}>
                  <Icon name="flag" size={16} strokeWidth={2} />
                  End Session
                </button>
              )}
            </div>
          </div>

          {/* Session strip (facilitator only): share link, QR, ID, timer */}
          {isHost && (
            <section className="glass retro-session-strip" aria-label="Session controls">
              {shareUrl && (
                <div className="retro-share">
                  <label className="poker-share-field">
                    <Icon name="link" size={15} strokeWidth={2} />
                    <span className="poker-share-text">Share</span>
                    <input readOnly aria-label="Share link" value={shareUrl} />
                  </label>
                  <button type="button" className={`btn poker-share-btn${copied ? " is-copied" : ""}`} onClick={handleCopy}>
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
                </div>
              )}
              <RetroTimer
                session={session}
                isHost={isHost}
                timerState={timerState}
                onUpdate={handleTimerAction}
              />
            </section>
          )}

          {canManageThemes && (
            <RetroThemeTools
              session={session}
              columns={currentColumns}
              cards={cards}
              themes={themes}
              participantName={participantName}
              selectedCardIds={liveSelectedIds}
              onClearSelection={() => setSelectedCardIds([])}
              onChanged={() => fetchBoard(session.id)}
              onError={setError}
            />
          )}

          {/* Card stacks — draggable */}
          {!session.is_ended && (
            <section className="glass retro-tray" aria-label="Add a card">
              <p className="retro-tray-label">
                {participantName ? <>Hi <strong>{participantName}</strong> — <span className="retro-drag-hint"><Icon name="grip" size={14} strokeWidth={2.4} />drag</span> a card to the matching column, or click to compose:</> : "Pick a card to add your thought:"}
              </p>
              <div className="retro-stacks">
                {currentColumns.map(col => (
                  <button key={col.key}
                    type="button"
                    draggable
                    onDragStart={e => handleDragStart(e, col.key)}
                    onDragEnd={handleDragEnd}
                    className={["retro-stack", `retro-tone-${col.tone}`, activeCompose === col.key ? "is-active" : "", isDragging && dragType === col.key ? "is-dragging" : ""].filter(Boolean).join(" ")}
                    onClick={() => { setDropCol(null); setDropText(""); setActiveCompose(col.key); setComposeText(""); }}
                  >
                    <ColumnChip col={col} />
                    <span className="retro-stack-hint"><Icon name="grip" size={12} strokeWidth={2.4} />Drag or Click</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Global compose panel */}
          {activeCompose && !session.is_ended && (() => {
            const col = currentColumns.find(c => c.key === activeCompose);
            return (
              <div className={`retro-compose retro-compose-panel retro-tone-${col.tone}`}>
                <ColumnChip col={col} />
                <textarea ref={composeRef} className="retro-compose-textarea" aria-label={`Write your thought for "${col.label}"`} placeholder={`Write your thought for "${col.label}"…`} value={composeText} onChange={e => setComposeText(e.target.value)} maxLength={280} rows={4} />
                <div className="retro-compose-footer">
                  <span className="retro-compose-char mono">{composeText.length}/280</span>
                  <div className="retro-compose-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setActiveCompose(null); setComposeText(""); }}>Cancel</button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => handlePin(col.key, composeText, () => { setActiveCompose(null); setComposeText(""); })} disabled={!composeText.trim() || pinning}>
                      {pinning ? <span className="retro-spinner" aria-hidden="true" /> : "Pin to Board"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Board columns: a row that scrolls sideways on narrow screens */}
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
                  const isMine = card.author === participantName;
                  const isTemp = card.id.toString().startsWith("temp_");
                  const counts = reactionCountsFor(card.id);
                  const votes = counts[VOTE_EMOJI] || 0;
                  const voted = hasReacted(card.id, VOTE_EMOJI);

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
                    <article key={card.id} className={`retro-card${animated ? " card-lift" : ""}`}>
                      <div className="retro-card-top">
                        {isEditing ? (
                          <MentionTextarea
                            value={editText}
                            onChange={setEditText}
                            employeeNames={employeeNames}
                            className="retro-compose-textarea"
                            maxLength={280}
                            rows={3}
                            onSave={() => handleEditCard(card.id)}
                            onCancel={() => { setEditingCardId(null); setEditText(""); }}
                            saving={savingEdit}
                          />
                        ) : (
                          <p className="retro-card-text">{renderContent(card.content)}</p>
                        )}
                        {canManageThemes && !isTemp && (
                          <input
                            type="checkbox"
                            className="retro-card-select"
                            aria-label="Select card for a theme"
                            title="Select for a new theme"
                            checked={selectedCardIds.includes(String(card.id))}
                            onChange={() => toggleSelected(card.id)}
                          />
                        )}
                      </div>

                      <div className="retro-card-by">
                        <Avatar name={card.author} isMe={isMine} className="avatar retro-card-avatar" aria-hidden="true" />
                        <span className="retro-card-author">{card.author}</span>
                        {!session.is_ended && !isEditing && (isMine || isHost) && (
                          <span className="retro-card-tools">
                            {isMine && !isTemp && (
                              <button type="button" className="retro-icon-btn" onClick={() => {
                                setEditingCardId(card.id);
                                setEditText(card.content);
                                setSavingEdit(false);
                              }} title="Edit" aria-label="Edit card">
                                <Icon name="edit" size={14} strokeWidth={2} />
                              </button>
                            )}
                            <button type="button" className="retro-icon-btn retro-icon-btn-danger" onClick={() => handleDelete(card.id)} title="Remove" aria-label="Remove card">
                              <Icon name="trash" size={14} strokeWidth={2} />
                            </button>
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
                          disabled={session.is_ended || isTemp}
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
                            onClick={() => !session.is_ended && handleReact(card.id, emoji)}
                            title={hasReacted(card.id, emoji) ? "Remove your reaction" : "React"}
                          >
                            <span className="retro-reaction-emoji">{emoji}</span>
                            <span className="mono">{count}</span>
                          </button>
                        ))}
                        {!session.is_ended && !isTemp && (
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

                      {canManageThemes && !isTemp && (() => {
                        const currentThemeId = themeIdOfCard.get(String(card.id));
                        // Only this column's themes: a card cannot change column by changing theme.
                        const targets = arranged.themes.filter(t => String(t.id) !== currentThemeId);
                        return targets.length > 0 && (
                          <select
                            className="retro-theme-move"
                            aria-label="Move to theme"
                            title="Move to theme"
                            value=""
                            onChange={e => handleMoveCard(card.id, e.target.value)}
                          >
                            <option value="" disabled>Move to…</option>
                            {targets.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                          </select>
                        );
                      })()}
                    </article>
                  );
                };
                return (
                  <section key={col.key}
                    aria-label={col.label}
                    className={["glass", "retro-column", `retro-tone-${col.tone}`, isOver && isMatch ? "retro-column-drop-valid" : "", isOver && !isMatch ? "retro-column-drop-invalid" : "", isReject ? "retro-column-rejected" : ""].filter(Boolean).join(" ")}
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
                        <textarea ref={dropComposeRef} className="retro-compose-textarea" aria-label={`Your thought for "${col.label}"`} placeholder={`Your thought for "${col.label}"…`} value={dropText} onChange={e => setDropText(e.target.value)} maxLength={280} rows={3} />
                        <div className="retro-compose-footer">
                          <span className="retro-compose-char mono">{dropText.length}/280</span>
                          <div className="retro-compose-actions">
                            <button type="button" className="btn btn-secondary btn-sm" onClick={() => { setDropCol(null); setDropText(""); }}>Cancel</button>
                            <button type="button" className="btn btn-primary btn-sm" onClick={() => handlePin(col.key, dropText, () => { setDropCol(null); setDropText(""); })} disabled={!dropText.trim() || pinning}>
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

                    {colCards.length === 0 && !hasDrop && activity.filter(a => a.column_type === col.key).length === 0 && (
                      <div className={`retro-column-empty${isDragging && isMatch ? " is-drop-target" : ""}`}>
                        {isDragging && isMatch ? "Drop here" : "No cards yet — pick a card above!"}
                      </div>
                    )}
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
                        {canManageThemes && renamingTheme?.id === theme.id ? (
                          <input
                            className="retro-theme-rename"
                            aria-label="Theme name"
                            autoFocus
                            maxLength={THEME_NAME_MAX}
                            value={renamingTheme.text}
                            onChange={e => setRenamingTheme({ id: theme.id, text: e.target.value })}
                            onKeyDown={e => {
                              if (e.key === "Enter") handleRenameTheme(theme);
                              if (e.key === "Escape") setRenamingTheme(null);
                            }}
                            onBlur={() => setRenamingTheme(null)}
                          />
                        ) : canManageThemes ? (
                          <button
                            type="button"
                            className="retro-theme-name retro-theme-name-btn"
                            title="Rename theme"
                            aria-label={`Rename theme ${theme.name}`}
                            onClick={() => setRenamingTheme({ id: theme.id, text: theme.name })}
                          >
                            <span className="retro-theme-name-text">{theme.name}</span>
                            <Icon name="edit" size={13} strokeWidth={2} />
                          </button>
                        ) : (
                          <span className="retro-theme-name">{theme.name}</span>
                        )}
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
            onChanged={() => fetchBoard(session.id)}
          />

          <RetroActionItems
            session={session}
            actionItems={actionItems}
            members={members}
            participantName={participantName}
            canManage={canManageActions}
            onChanged={() => fetchBoard(session.id)}
          />
        </div>
      )}

      {/* ── TOP VOTED ── */}
      {view === "actions" && session && (
        <div className="retro-actions-view">
          {error && (
            <div className="form-error retro-error" role="alert">
              <Icon name="alert" size={16} />
              <span className="retro-error-text">{error}</span>
              <button type="button" className="retro-icon-btn" onClick={() => setError("")} aria-label="Dismiss error" title="Dismiss">
                <Icon name="x" size={14} strokeWidth={2} />
              </button>
            </div>
          )}
          <section className="glass-card retro-top" aria-labelledby="retro-top-title">
            <div className="retro-top-head">
              <h2 id="retro-top-title" className="section-title">Top Voted — {session.title}</h2>
              <p className="retro-top-sub">
                Cards ranked by team votes. Highest voted = most important to act on.
                {canManageActions && !session.is_ended && " Tick the ones the team will act on — they carry into the project's next retros."}
              </p>
            </div>

            {allCardsSorted.length === 0 ? (
              <p className="empty-msg">No reactions yet — cards people react to will be ranked here.</p>
            ) : tierGroups.map(group => (
              <div key={group.key} className="retro-tier">
                <div className="retro-tier-head">
                  <span className={`pill ${group.pill}`}>
                    <span className="retro-tier-dot" aria-hidden="true" />
                    {group.label}
                  </span>
                  <span className="retro-tier-rule">{group.rule}</span>
                </div>
                <ol className="retro-tier-list">
                  {group.rows.map(({ card, rank }) => {
                    const votes    = voteCountFor(card.id);
                    const col      = columnFor(card);
                    const picked   = !!actionItemForCard(card.id);
                    const editable = canManageActions && !session.is_ended;
                    const busy     = pickingCardIds.includes(card.id);
                    return (
                      <li key={card.id} className="retro-rank-row">
                        <span className="retro-rank mono">#{rank}</span>
                        <span className="retro-rank-votes">
                          <span className="retro-rank-votes-num">{votes}</span>
                          <span className="retro-rank-votes-label">vote{votes !== 1 ? "s" : ""}</span>
                        </span>
                        <div className="retro-rank-body">
                          <div className="retro-rank-meta">
                            <span className={`pill pill-${col.tone}`}>{col.label}</span>
                            <span className="retro-rank-author">{card.author}</span>
                          </div>
                          <p className="retro-rank-text">{card.content}</p>
                        </div>
                        {(editable || picked) && (
                          <label
                            className={`retro-pick${picked ? " is-on" : ""}${!editable || busy ? " is-disabled" : ""}`}
                            title={editable ? (picked ? "Untick to remove it from the action items" : "Tick to carry this into the next retros") : undefined}
                          >
                            <input
                              type="checkbox"
                              checked={picked}
                              disabled={!editable || busy}
                              onChange={() => handleToggleCardAction(card)}
                            />
                            {picked ? "Action item" : "Mark as action item"}
                          </label>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </div>
            ))}
          </section>
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
