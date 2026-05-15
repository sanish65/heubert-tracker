"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";

const COLUMNS = [
  { key: "went_well", label: "What Went Well?",    emoji: "🎉", color: "green"  },
  { key: "improve",   label: "Needs Improvement",  emoji: "🔧", color: "amber"  },
  { key: "focus",     label: "Focus More On",       emoji: "🎯", color: "indigo" },
];

export default function RetroSessionPage() {
  const { sessionId } = useParams();
  const [session, setSession]         = useState(null);
  const [cards, setCards]             = useState([]);
  const [participantName, setParticipantName] = useState("");
  const [nameEntered, setNameEntered] = useState(false);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState("");
  const [activeCompose, setActiveCompose] = useState(null);
  const [composeText, setComposeText] = useState("");
  const [pinning, setPinning]         = useState(false);
  const pollRef  = useRef(null);
  const composeRef = useRef(null);

  const fetchBoard = useCallback(async () => {
    try {
      const res = await fetch(`/api/retro?sessionId=${sessionId}`);
      if (!res.ok) { setError("Session not found."); setLoading(false); return; }
      const data = await res.json();
      setSession(data.session); setCards(data.cards || []);
    } catch { setError("Unable to reach server."); }
    finally { setLoading(false); }
  }, [sessionId]);

  useEffect(() => {
    fetchBoard();
    pollRef.current = setInterval(fetchBoard, 2500);
    return () => clearInterval(pollRef.current);
  }, [fetchBoard]);

  useEffect(() => {
    if (activeCompose && composeRef.current) composeRef.current.focus();
  }, [activeCompose]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") { setActiveCompose(null); setComposeText(""); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handlePin = async () => {
    if (!composeText.trim() || !activeCompose || !session) return;
    setPinning(true);
    try {
      await fetch("/api/retro", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "add_card", sessionId, columnType: activeCompose,
          content: composeText.trim(), author: participantName,
        }),
      });
      await fetchBoard();
      setActiveCompose(null); setComposeText("");
    } catch (_) {}
    finally { setPinning(false); }
  };

  const handleDelete = async (cardId) => {
    await fetch(`/api/retro?cardId=${cardId}`, { method: "DELETE" });
    setCards(prev => prev.filter(c => c.id !== cardId));
  };

  const cardsFor = (colKey) => cards.filter(c => c.column_type === colKey);

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

  return (
    <div className="poker-standalone-shell">
      <header className="poker-standalone-header">
        <div className="poker-standalone-logo">
          <span>🗂️</span>
          <span className="poker-standalone-logo-text">Sprint Retrospective</span>
        </div>
        <span className="poker-pulse"><span className="pulse-dot" /> Live</span>
      </header>

      <main className="retro-standalone-main">
        <h2 className="retro-standalone-title">{session.title}</h2>

        {!nameEntered ? (
          <div className="retro-standalone-name">
            <label className="poker-form-label">Enter your name to participate</label>
            <div className="poker-standalone-name-row">
              <input className="poker-input" placeholder="Your name…"
                value={participantName} onChange={e => setParticipantName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && participantName.trim() && setNameEntered(true)}
                autoFocus />
              <button className="btn-poker-primary" disabled={!participantName.trim()}
                onClick={() => setNameEntered(true)}>Join →</button>
            </div>
          </div>
        ) : (
          <>
            {/* Card stacks */}
            <div className="retro-stack-tray">
              <p className="retro-stack-tray-label">Hi {participantName} — pick a card to add your thought:</p>
              <div className="retro-stacks">
                {COLUMNS.map(col => (
                  <button key={col.key}
                    className={`retro-stack retro-stack-${col.color} ${activeCompose === col.key ? "retro-stack-active" : ""}`}
                    onClick={() => { setActiveCompose(col.key); setComposeText(""); }}>
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

            {/* Compose panel */}
            {activeCompose && (() => {
              const col = COLUMNS.find(c => c.key === activeCompose);
              return (
                <div className="retro-compose-panel">
                  <div className={`retro-compose-card retro-compose-${col.color}`}>
                    <div className="retro-compose-pin">📌</div>
                    <textarea ref={composeRef} className="retro-compose-textarea"
                      placeholder={`Write your thought for "${col.label}"…`}
                      value={composeText} onChange={e => setComposeText(e.target.value)}
                      maxLength={280} rows={4} />
                    <div className="retro-compose-footer">
                      <span className="retro-compose-char">{composeText.length}/280</span>
                      <div className="retro-compose-actions">
                        <button className="retro-btn-cancel" onClick={() => { setActiveCompose(null); setComposeText(""); }}>Cancel</button>
                        <button className={`retro-btn-pin retro-btn-pin-${col.color}`}
                          onClick={handlePin} disabled={!composeText.trim() || pinning}>
                          {pinning ? <span className="poker-spinner" /> : "📌 Pin to Board"}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Board columns */}
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
                      <div className="retro-column-empty">No cards yet!</div>
                    )}
                    {cardsFor(col.key).map((card, idx) => (
                      <div key={card.id} className={`retro-sticky retro-sticky-${col.color}`}
                        style={{ "--card-rotate": `${(idx % 2 === 0 ? 1 : -1) * (0.5 + (idx % 3) * 0.4)}deg` }}>
                        <div className="retro-sticky-pin">📌</div>
                        <p className="retro-sticky-content">{card.content}</p>
                        <div className="retro-sticky-footer">
                          <span className="retro-sticky-author">— {card.author}</span>
                          {card.author === participantName && (
                            <button className="retro-sticky-delete" onClick={() => handleDelete(card.id)} title="Remove">✕</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
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
