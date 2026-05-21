"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EditFineModal from "@/components/EditFineModal";
import EditStandupModal from "@/components/EditStandupModal";
import EditWordModal from "@/components/EditWordModal";
import HumanLoader from "@/components/HumanLoader";
import EventBanner from "@/components/EventBanner";

export default function MeetingPage() {
  const { 
    fines, 
    standupFines, 
    leaves, 
    words, 
    wordSeasons, 
    addFine, 
    addStandupFine,
    addWord, 
    addLeave,
    deleteFine,
    deleteStandupFine,
    deleteWord,
    updateFine,
    updateStandupFine,
    updateWord,
    employees,
    isAdmin,
    isLoaded,
    publicHolidays,
    companyEvents,
    standupSubmissions,
    standupQuestions,
    user,
    currentEmployee,
    isAuthReady
  } = useApp();
  const router = useRouter();
  const [viewDate, setViewDate] = useState("");
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [isClient, setIsClient] = useState(false);
  // Must be declared before the allSubmissions useMemo that depends on it
  const [sortNewestFirst, setSortNewestFirst] = useState(false);
  
  // Idle Animation State
  const [idleSubmissionId, setIdleSubmissionId] = useState(null);
  const idleTimerRef = useState(null);

  useEffect(() => {
    setIsClient(true);
    const todayStr = new Date().toLocaleDateString('en-CA');
    setViewDate(todayStr);
  }, []);

  const isAuthorized = user && currentEmployee && currentEmployee.status === "active";

  useEffect(() => {
    if (isLoaded && isAuthReady && !user) {
      router.replace("/login");
    }
  }, [isLoaded, isAuthReady, user, router]);

  // Handle Idle Nudge Logic in Enlarged mode
  useEffect(() => {
    if (!isEnlarged) {
      setIdleSubmissionId(null);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      return;
    }

    const startIdleTimer = () => {
      setIdleSubmissionId(null); // Hide immediately on activity
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      idleTimerRef.current = setTimeout(() => {
        // Find topmost fully visible submission
        const listEl = document.querySelector('.submissions-list');
        if (!listEl) return;
        
        const items = Array.from(listEl.querySelectorAll('.submission-item:not(.missing)'));
        const listRect = listEl.getBoundingClientRect();
        
        let topmostId = null;
        let minTopOffset = Infinity;

        for (const item of items) {
          const rect = item.getBoundingClientRect();
          // Check if item is within the visible bounds of the list
          if (rect.top >= listRect.top && rect.bottom <= listRect.bottom) {
            if (rect.top < minTopOffset) {
              minTopOffset = rect.top;
              topmostId = item.getAttribute('data-submission-id');
            }
          }
        }
        
        if (topmostId) {
          setIdleSubmissionId(topmostId);
        }
      }, 12000); // 5 seconds idle
    };

    // Attach listeners to reset timer
    const events = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'];
    events.forEach(e => window.addEventListener(e, startIdleTimer));
    
    // Initial start
    startIdleTimer();

    return () => {
      events.forEach(e => window.removeEventListener(e, startIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isEnlarged]);

  const today = useMemo(() => {
    if (!isClient) return "";
    return new Date().toLocaleDateString('en-CA');
  }, [isClient]);

  // Helper to format text with Jira links
  const formatText = (text) => {
    if (!text || typeof text !== 'string') return text;
    
    // Regex for Jira URLs (assumed structure)
    const jiraRegex = /(https?:\/\/[^\s]+?\/browse\/([A-Z]+-\d+))/g;
    
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = jiraRegex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      
      // Add the Jira link
      const url = match[1];
      const jiraId = match[2];
      parts.push(
        <a 
          key={match.index} 
          href={url} 
          target="_blank" 
          rel="noopener noreferrer" 
          className="jira-inline-link"
        >
          {jiraId}
        </a>
      );
      
      lastIndex = jiraRegex.lastIndex;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  };

  // Today's Data
  const todaysFines = useMemo(() => fines.filter(f => f.date === today), [fines, today]);
  const todaysStandups = useMemo(() => standupFines.filter(f => f.date === today), [standupFines, today]);
  const activeLeaves = useMemo(() => leaves.filter(l => today >= l.start_date && today <= l.end_date), [leaves, today]);
  // Shared/system emails — never expected to submit standups
  const nonStandupEmails = new Set([
    "developers@heubert.com",
  ]);

  // Employees (by first name, lowercase) who don't fill standups
  const nonStandupFirstNames = new Set([
    "sameer",
  ]);

  const allSubmissions = useMemo(() => {
    // 1. Get actual submissions for the date
    const actualSubmissions = standupSubmissions.filter(s => s.date === viewDate);

    const submittedEmails = new Set(
      actualSubmissions
        .filter(s => s.email)
        .map(s => s.email.trim().toLowerCase())
    );

    // Also build a set of first names from submissions for name-based fallback matching.
    // This handles cases like:
    //   "Pranay" (employee) ↔ "Pranay Lama Pakhrin" (standup)
    //   "Nitesh"  (employee) ↔ "Nitesh Tuladhar"    (standup)
    const submittedFirstNames = new Set(
      actualSubmissions
        .filter(s => s.name)
        .map(s => s.name.trim().split(/\s+/)[0].toLowerCase())
    );

    // 2. Find employees who have NOT submitted yet
    const missingSubmissions = (employees || [])
      .filter(emp => {
        // Skip inactive/resigned employees (e.g. Bhoomi)
        if (emp.status && emp.status !== "active") return false;

        const workEmail = emp.work_email?.trim().toLowerCase();
        const personalEmail = emp.personal_email?.trim().toLowerCase();
        const empFirstName = emp.name?.trim().split(/\s+/)[0].toLowerCase();

        // Skip shared accounts (e.g. developers@heubert.com)
        if (workEmail && nonStandupEmails.has(workEmail)) return false;
        if (personalEmail && nonStandupEmails.has(personalEmail)) return false;

        // Skip employees excluded by first name (e.g. Sameer)
        if (empFirstName && nonStandupFirstNames.has(empFirstName)) return false;

        // Primary match: by email
        if (submittedEmails.has(workEmail) || submittedEmails.has(personalEmail)) return false;

        // Fallback match: by first name (catches full-name vs. short-name discrepancies)
        if (empFirstName && submittedFirstNames.has(empFirstName)) return false;

        return true;
      })
      .map((emp, idx) => ({
        id: `missing-${emp.id || idx}`,
        name: emp.name,
        email: emp.work_email || emp.personal_email,
        date: viewDate,
        isMissing: true,
        answers: {},
        jira_tickets: []
      }));

    // 3. Combine: Missing ones first (always), then actual ones sorted by responded_at
    const sortedActual = [...actualSubmissions].sort((a, b) =>
      sortNewestFirst
        ? new Date(b.responded_at) - new Date(a.responded_at)   // newest first
        : new Date(a.responded_at) - new Date(b.responded_at)   // oldest first (default)
    );

    return [...missingSubmissions, ...sortedActual];
  }, [standupSubmissions, viewDate, employees, isClient, sortNewestFirst]);

  const stats = useMemo(() => {
    const total = allSubmissions.length;
    const submitted = allSubmissions.filter(s => !s.isMissing).length;
    return { total, submitted, missing: total - submitted };
  }, [allSubmissions]);

  const handlePrevDate = () => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() - 1);
    setViewDate(d.toLocaleDateString('en-CA'));
  };

  const handleNextDate = () => {
    const d = new Date(viewDate);
    d.setDate(d.getDate() + 1);
    setViewDate(d.toLocaleDateString('en-CA'));
  };
  
  // Word created TODAY specifically
  const todaysWord = useMemo(() => {
    return words.find(w => w.created_at?.startsWith(today));
  }, [words, today]);

  // Form States
  const [showAddFine, setShowAddFine] = useState(false);
  const [showAddStandup, setShowAddStandup] = useState(false);
  const [showAddWord, setShowAddWord] = useState(false);
  const [showAddLeave, setShowAddLeave] = useState(false);

  const [showEditFine, setShowEditFine] = useState(false);
  const [editingFine, setEditingFine] = useState(null);
  const [showEditStandup, setShowEditStandup] = useState(false);
  const [editingStandup, setEditingStandup] = useState(null);
  const [showEditWord, setShowEditWord] = useState(false);
  const [editingWord, setEditingWord] = useState(null);

  if (!isClient || !isLoaded || !isAuthReady || (user && !isAuthorized)) {
    return <HumanLoader />;
  }

  // Nudge phrases
  const nudgePhrases = [
    "There is so much work left today",
    "Gotta finish these tasks ASAP today",
    "Time to lock in and code! 💻",
    "Let's crush these tickets! 🚀",
    "Focus mode activated ⚡",
    "Still got a lot on my plate! 🍽️"
  ];

  return (
    <div className="meeting-layout">
      <EventBanner />
      <header className="meeting-header">
        <div className="meeting-title-group">
          <Link href="/" className="exit-link">← Exit Meeting</Link>
          <h1 className="meeting-title">
            Daily Sync: {isClient ? new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : "..."}
          </h1>
        </div>
        <div className="meeting-actions">
          <a
            href="https://meet.google.com/khg-nxbc-ayo"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-primary"
            title="Meeting Link"
          >
            Meeting Link
          </a>
          <button className="btn btn-primary" onClick={() => setShowAddFine(true)}>+ Late Fine</button>
          <button className="btn btn-warning" onClick={() => setShowAddStandup(true)}>+ Standup Fine</button>
          <button className="btn btn-accent" onClick={() => setShowAddLeave(true)}>+ Leave</button>
          {!todaysWord && (
             <button className="btn btn-secondary" onClick={() => setShowAddWord(true)}>+ Set Word</button>
          )}
        </div>
      </header>

      <div className="meeting-grid">
        {/* LATE FINES */}
        <section className="meeting-card fines-card">
          <h2 className="card-title">💰 Today's Late Fines</h2>
          <div className="meeting-list">
            {todaysFines.length === 0 ? (
              <p className="empty-msg">All on time today! ☀️</p>
            ) : (
              todaysFines.map((f, index) => (
                <div key={`fine-item-${index}`} className="meeting-item group">
                  <span className="item-name">{f.employee_name}</span>
                  <span className="item-value">Rs. {f.amount}</span>
                  <span className={`status-badge ${f.status}`}>{f.status}</span>
                  {isAdmin && (
                    <div className="item-actions">
                      <button onClick={() => { setEditingFine(f); setShowEditFine(true); }} title="Edit">✏️</button>
                      <button onClick={() => { if(confirm("Delete fine?")) deleteFine(f.id); }} title="Delete">🗑</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* STANDUP FINES */}
        <section className="meeting-card standup-card">
          <h2 className="card-title">📝 Standup Status</h2>
          <div className="meeting-list">
            {todaysStandups.length === 0 ? (
              <p className="empty-msg">No standup fines yet.</p>
            ) : (
              todaysStandups.map((s, index) => (
                <div key={`standup-item-${index}`} className="meeting-item group">
                  <span className="item-name">{s.employee_name}</span>
                  <span className={`status-badge ${s.status}`}>{s.status}</span>
                  {isAdmin && (
                    <div className="item-actions">
                      <button onClick={() => { setEditingStandup(s); setShowEditStandup(true); }} title="Edit">✏️</button>
                      <button onClick={() => { if(confirm("Delete record?")) deleteStandupFine(s.id); }} title="Delete">🗑</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* ACTIVE LEAVES */}
        <section className="meeting-card leaves-card">
          <h2 className="card-title">🏖️ On Leave Today</h2>
          <div className="meeting-list">
            {activeLeaves.length === 0 ? (
              <p className="empty-msg">Full strength today! 💪</p>
            ) : (
              activeLeaves.map((l, index) => (
                <div key={`leave-item-${index}`} className="meeting-item group">
                  <span className="item-name">{l.employee_name}</span>
                  <span className="leave-type-tag">{l.type}</span>
                </div>
              ))
            )}
          </div>
        </section>

        {/* STANDUP SUBMISSIONS (FROM SECONDARY DB) */}
        <section className={`meeting-card submissions-card ${isEnlarged ? 'enlarged' : ''}`}>
          <div className="card-header-with-actions">
            <h2 className="card-title">✅ Daily Submissions</h2>
            <div className="card-header-tools">
              <span className="standup-stats">
                {stats.submitted}/{stats.total} Submitted
              </span>
              <div className="date-navigator">
                <button className="btn-nav" onClick={handlePrevDate}>◀</button>
                <span className="view-date-label">
                  {viewDate === today ? "Today" : (viewDate ? new Date(viewDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : "...")}
                </span>
                <button className="btn-nav" onClick={handleNextDate} disabled={viewDate >= today}>▶</button>
              </div>
              <button
                className="btn-sort-toggle"
                onClick={() => setSortNewestFirst(p => !p)}
                title={sortNewestFirst ? "Showing: Last submitted first" : "Showing: First submitted first"}
              >
                {sortNewestFirst ? "↓ Latest" : "↑ Earliest"}
              </button>
              <button 
                className="btn-enlarge" 
                onClick={() => setIsEnlarged(!isEnlarged)}
                title={isEnlarged ? "Minimize" : "Enlarge"}
              >
                {isEnlarged ? "✕" : "⛶"}
              </button>
            </div>
          </div>
          <div className="submissions-list" onScroll={() => window.dispatchEvent(new Event('mousemove'))}>
            {allSubmissions.length > 0 ? (
              allSubmissions.map((s, index) => {
                const subId = s.id || `sub-${index}`;
                const isIdleTarget = idleSubmissionId === subId;
                
                return (
                  <div key={`submission-row-${index}`} data-submission-id={subId} className={`submission-item ${s.isMissing ? 'missing' : ''}`}>
                    {isIdleTarget && <IdleNudge phrases={nudgePhrases} />}
                    <div className="submission-header">
                      <span className="submission-user">
                        {s.name} {s.isMissing && <span className="missing-badge">NOT SUBMITTED</span>}
                      </span>
                      {!s.isMissing && s.responded_at && (
                        <span className="submission-time">
                          {new Date(s.responded_at).toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu", hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className="submission-content">
                      {s.isMissing ? (
                        <div className="missing-state-content">
                          <p className="ans-text italic text-muted">No standup update received for this date.</p>
                        </div>
                      ) : (
                        <>
                          {standupQuestions.length > 0 ? (
                            standupQuestions.map((q, qIndex) => {
                              const answers = s.answers || {};
                              const answer = answers[`question_${q.id}`] || 
                                           answers[q.id] || 
                                           answers[q.question] || 
                                           answers[q.sort_order] || 
                                           (q.sort_order ? answers[q.sort_order.toString()] : null);
                              
                              return (
                                <div key={`submission-${index}-q-${qIndex}`} className="submission-qa">
                                  <label className="qa-label">{q.question}</label>
                                  <div className="ans-text position-relative">
                                    {answer && String(answer).trim() ? (
                                      typeof answer === 'object' ? JSON.stringify(answer) : formatText(String(answer))
                                    ) : (
                                      <span className="text-muted italic">No answer provided</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })
                          ) : (
                            // If no questions fetched, show raw answers
                            Object.entries(s.answers || {}).map(([key, value], ansIdx) => (
                              <div key={`submission-${index}-ans-${ansIdx}`} className="submission-qa">
                                <label className="qa-label">{key}</label>
                                <div className="ans-text position-relative">
                                  {/* Idle Nudge removed from here */}
                                  {typeof value === 'object' ? JSON.stringify(value) : formatText(String(value || ""))}
                                </div>
                              </div>
                            ))
                          )}
                        {s.jira_tickets && s.jira_tickets.length > 0 && (
                          <div className="jira-section">
                            <label className="qa-label">Jira Tickets</label>
                            <div className="jira-tags">
                                {[...s.jira_tickets].sort((a, b) => {
                                  const priority = {
                                    'blocked':     0,
                                    'in progress': 1,
                                    'in review':   2,
                                    'to do':       3,
                                    'on hold':     4,
                                    'done':        5,
                                    'closed':      6,
                                  };
                                  const aStatus = (typeof a === 'object' ? a.status : null)?.toLowerCase() ?? '';
                                  const bStatus = (typeof b === 'object' ? b.status : null)?.toLowerCase() ?? '';
                                  return (priority[aStatus] ?? 99) - (priority[bStatus] ?? 99);
                                }).map((t, tIdx) => {
                                  const ticketKey = typeof t === 'object' ? (t.key || t.summary || "Ticket") : t;
                                  const ticketStatus = typeof t === 'object' ? (t.status || null) : null;
                                  const ticketUrl = typeof t === 'object' ? t.url : null;
                                  const statusClass = ticketStatus
                                    ? `jira-status jira-status--${ticketStatus.toLowerCase().replace(/\s+/g, '-')}`
                                    : null;
                                  return (
                                    <span key={`jira-${index}-${tIdx}`} className="jira-tag" title={typeof t === 'object' && t.summary ? t.summary : ticketKey}>
                                      {ticketUrl ? (
                                        <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="jira-tag-key">
                                          {ticketKey}
                                        </a>
                                      ) : (
                                        <span className="jira-tag-key">{ticketKey}</span>
                                      )}
                                      {typeof t === 'object' && t.summary && (
                                        <span className="jira-summary">{t.summary}</span>
                                      )}
                                      {ticketStatus && (
                                        <span className={statusClass}>{ticketStatus}</span>
                                      )}
                                    </span>
                                  );
                                })}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
                );
              })
            ) : (
              <p className="empty-msg">No submissions for this date. 📥</p>
            )}
          </div>
        </section>

        {/* WORD OF THE DAY */}
        <section className="meeting-card word-hero-card">
          <h2 className="card-title">📖 Word of the Meeting</h2>
          {todaysWord ? (
            <div className="meeting-word-display pulse-entry">
              <div className="word-main">
                <h3 className="word-text">{todaysWord.word}</h3>
                {todaysWord.phonetic && <span className="phonetic">({todaysWord.phonetic})</span>}
                {isAdmin && (
                  <div className="word-actions-inline">
                    <button onClick={() => { setEditingWord(todaysWord); setShowEditWord(true); }} title="Edit Word">✏️</button>
                    <button onClick={() => { if(confirm("Delete word?")) deleteWord(todaysWord.id); }} title="Delete Word">🗑</button>
                  </div>
                )}
              </div>
              {todaysWord.translation && (
                <p className="translation">Translation: <strong>{todaysWord.translation}</strong></p>
              )}
              <p className="definition">{todaysWord.definition}</p>
              {todaysWord.example && (
                <div className="example-box">
                  <p>"{todaysWord.example}"</p>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state-meeting manual-prompt">
              <div className="prompt-icon">📢</div>
              <p className="empty-msg">No word shared for this meeting yet.</p>
              <button className="btn btn-secondary" onClick={() => setShowAddWord(true)}>
                + Set Meeting Word
              </button>
            </div>
          )}
        </section>
      </div>

      {/* QUICK MODALS - REUSING LOGIC AND CLASSES */}
      {showAddFine && (
        <QuickAddFineModal 
          isOpen={showAddFine} 
          onClose={() => setShowAddFine(false)} 
          addFine={addFine} 
          employees={employees}
          today={today}
        />
      )}
      {showAddStandup && (
        <QuickAddStandupModal 
          isOpen={showAddStandup} 
          onClose={() => setShowAddStandup(false)} 
          addStandupFine={addStandupFine} 
          employees={employees}
          today={today}
        />
      )}

      <EditFineModal 
        isOpen={showEditFine} 
        onClose={() => { setShowEditFine(false); setEditingFine(null); }} 
        fine={editingFine}
      />

      <EditStandupModal
        isOpen={showEditStandup}
        onClose={() => { setShowEditStandup(false); setEditingStandup(null); }}
        record={editingStandup}
      />

      <EditWordModal
        isOpen={showEditWord}
        onClose={() => { setShowEditWord(false); setEditingWord(null); }}
        word={editingWord}
      />

      {showAddWord && (
        <QuickAddWordModal 
          isOpen={showAddWord} 
          onClose={() => setShowAddWord(false)} 
          addWord={addWord} 
          seasons={wordSeasons}
        />
      )}
      {showAddLeave && (
        <QuickAddLeaveModal 
          isOpen={showAddLeave} 
          onClose={() => setShowAddLeave(false)} 
          addLeave={addLeave} 
          employees={employees}
          today={today}
        />
      )}
    </div>
  );
}

// COMPACT INLINE MODALS FOR MEETING MODE
function QuickAddFineModal({ isOpen, onClose, addFine, employees, today }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(50);
  
  const hSubmit = (e) => {
    e.preventDefault();
    if (!name) return;
    addFine({ name, amount: parseFloat(amount), date: today, status: "unpaid" });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>⚡ Fast Fine</h3></div>
        <form onSubmit={hSubmit}>
          <div className="form-group-interactive">
            <label>Employee</label>
            <select value={name} onChange={e => setName(e.target.value)} required>
              <option value="">Select...</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-group-interactive">
            <label>Amount (Rs.)</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Fine</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function QuickAddWordModal({ isOpen, onClose, addWord, seasons }) {
  const [word, setWord] = useState("");
  const [def, setDef] = useState("");
  
  // Find latest season by ID (assuming higher ID is newer)
  const latestSeasonId = useMemo(() => {
    if (!seasons || seasons.length === 0) return "";
    return [...seasons].sort((a, b) => b.id - a.id)[0].id;
  }, [seasons]);

  const [seasonId, setSeasonId] = useState("");

  // Update seasonId when latestSeasonId is determined
  useMemo(() => {
    if (latestSeasonId && !seasonId) {
      setSeasonId(latestSeasonId);
    }
  }, [latestSeasonId]);

  const hSubmit = (e) => {
    e.preventDefault();
    if (!word || !def || !seasonId) return;
    addWord({ word, definition: def, seasonId });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>⚡ Fast Word</h3></div>
        <form onSubmit={hSubmit}>
          <div className="form-group-interactive">
            <label>Season</label>
            <select value={seasonId} onChange={e => setSeasonId(e.target.value)} required>
              <option value="">Select...</option>
              {seasons.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
          </div>
          <div className="form-group-interactive">
            <label>Word</label>
            <input type="text" value={word} onChange={e => setWord(e.target.value)} required />
          </div>
          <div className="form-group-interactive">
            <label>Definition</label>
            <textarea value={def} onChange={e => setDef(e.target.value)} required rows={2} />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Save Word</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function IdleNudge({ phrases }) {
  const [index, setIndex] = useState(0);
  const [bugType, setBugType] = useState('ladybug');

  useEffect(() => {
    // Randomize initial bug
    const bugs = ['ladybug', 'ant', 'spider'];
    setBugType(bugs[Math.floor(Math.random() * bugs.length)]);
    
    // Randomize initial text
    setIndex(Math.floor(Math.random() * phrases.length));
    
    // Change text every 5 seconds as it walks (so it's easily readable)
    const interval = setInterval(() => {
      setIndex(current => (current + 1) % phrases.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [phrases]);

  const renderLadybug = () => (
    <svg viewBox="0 0 50 30" className="bug-character" xmlns="http://www.w3.org/2000/svg">
      <g className="bug-leg-1" style={{ transformOrigin: '12px 20px' }}>
        <path d="M 12 20 Q 8 28 4 30" stroke="var(--text-primary)" fill="none" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="bug-leg-2" style={{ transformOrigin: '25px 22px' }}>
        <path d="M 25 22 Q 25 28 23 30" stroke="var(--text-primary)" fill="none" strokeWidth="2" strokeLinecap="round" />
      </g>
      <g className="bug-leg-3" style={{ transformOrigin: '38px 20px' }}>
        <path d="M 38 20 Q 44 28 48 30" stroke="var(--text-primary)" fill="none" strokeWidth="2" strokeLinecap="round" />
      </g>
      <circle cx="42" cy="18" r="5" fill="var(--text-primary)" />
      <path d="M 45 15 Q 48 10 50 12" stroke="var(--text-primary)" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 43 14 Q 45 8 48 9" stroke="var(--text-primary)" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M 5 22 C 5 8, 40 8, 40 22 Z" fill="#ef4444" />
      <path d="M 5 22 Q 22 20 40 22" stroke="#b91c1c" fill="none" strokeWidth="1" />
      <circle cx="15" cy="15" r="2.5" fill="#0f172a" />
      <circle cx="28" cy="12" r="3" fill="#0f172a" />
      <circle cx="22" cy="18" r="2" fill="#0f172a" />
      <circle cx="35" cy="17" r="2.5" fill="#0f172a" />
    </svg>
  );

  const renderAnt = () => (
    <svg viewBox="0 0 50 30" className="bug-character" xmlns="http://www.w3.org/2000/svg">
      <g className="bug-leg-1" style={{ transformOrigin: '15px 22px' }}>
        <path d="M 15 22 Q 10 28 8 30" stroke="#000000" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className="bug-leg-2" style={{ transformOrigin: '25px 22px' }}>
        <path d="M 25 22 Q 25 28 25 30" stroke="#000000" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className="bug-leg-3" style={{ transformOrigin: '35px 22px' }}>
        <path d="M 35 22 Q 40 28 42 30" stroke="#000000" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <ellipse cx="14" cy="18" rx="8" ry="5" fill="#000000" />
      <ellipse cx="27" cy="18" rx="5" ry="3" fill="#000000" />
      <circle cx="38" cy="16" r="4" fill="#000000" />
      <path d="M 40 14 Q 45 10 47 12" stroke="#000000" fill="none" strokeWidth="1" strokeLinecap="round" />
      <path d="M 39 13 Q 44 8 46 9" stroke="#000000" fill="none" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );

  const renderSpider = () => (
    <svg viewBox="0 0 50 30" className="bug-character" xmlns="http://www.w3.org/2000/svg">
      <g className="bug-leg-1" style={{ transformOrigin: '23px 20px' }}>
        <path d="M 23 20 Q 15 10 10 30" stroke="#6b7280" fill="none" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 25 20 Q 18 15 15 30" stroke="#6b7280" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <g className="bug-leg-3" style={{ transformOrigin: '31px 20px' }}>
        <path d="M 31 20 Q 38 10 45 30" stroke="#6b7280" fill="none" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M 29 20 Q 35 15 38 30" stroke="#6b7280" fill="none" strokeWidth="1.5" strokeLinecap="round" />
      </g>
      <circle cx="27" cy="20" r="7" fill="#6b7280" />
      <circle cx="34" cy="22" r="3" fill="#6b7280" />
    </svg>
  );

  return (
    <div className="walking-nudge-container">
      <div key={index} className="nudge-speech-bubble">{phrases[index]}</div>
      <div className="bug-figure-wrapper">
        {bugType === 'ladybug' && renderLadybug()}
        {bugType === 'ant' && renderAnt()}
        {bugType === 'spider' && renderSpider()}
      </div>
    </div>
  );
}

function QuickAddLeaveModal({ isOpen, onClose, addLeave, employees, today }) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("full");   // full | half | early
  const [category, setCategory] = useState("Casual"); // Casual | Sick | Project Holiday

  const DURATION_OPTS = [
    { value: "full",  label: "Full Day",     icon: "📅" },
    { value: "half",  label: "Half Day",     icon: "🌗" },
    { value: "early", label: "Early Leave",  icon: "🚪" },
  ];

  const hSubmit = (e) => {
    e.preventDefault();
    if (!name) return;
    addLeave({
      name,
      type: duration,          // "full" | "half" | "early" → stored in leaves.type
      startDate: today,
      endDate: today,
      reason: category,        // "Casual" | "Sick" | "Project Holiday" → stored in leaves.reason
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>⚡ Fast Leave (Today)</h3></div>
        <form onSubmit={hSubmit}>
          <div className="form-group-interactive">
            <label>Employee</label>
            <select value={name} onChange={e => setName(e.target.value)} required>
              <option value="">Select...</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>

          <div className="form-group-interactive">
            <label>Duration</label>
            <div className="leave-type-options">
              {DURATION_OPTS.map(opt => (
                <label
                  key={opt.value}
                  className={`leave-type-chip ${duration === opt.value ? "active" : ""}`}
                >
                  <input
                    type="radio"
                    name="quickLeaveDuration"
                    value={opt.value}
                    checked={duration === opt.value}
                    onChange={() => setDuration(opt.value)}
                  />
                  <span>{opt.icon} {opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="form-group-interactive">
            <label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option>Casual</option>
              <option>Sick</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-accent">Save Leave</button>
          </div>
        </form>
      </div>
    </div>
  );
}
function QuickAddStandupModal({ isOpen, onClose, addStandupFine, employees, today }) {
  const [name, setName] = useState("");
  
  const hSubmit = (e) => {
    e.preventDefault();
    if (!name) return;
    addStandupFine({ name, date: today, status: "unpaid" });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-content-small" onClick={e => e.stopPropagation()}>
        <div className="modal-header"><h3>⚡ Fast Standup Fine</h3></div>
        <form onSubmit={hSubmit}>
          <div className="form-group-interactive">
            <label>Employee</label>
            <select value={name} onChange={e => setName(e.target.value)} required>
              <option value="">Select...</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-warning">Save Standup Fine</button>
          </div>
        </form>
      </div>
    </div>
  );
}
