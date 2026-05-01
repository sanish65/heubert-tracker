"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { useApp } from "@/context/AppContext";
import Link from "next/link";
import EditFineModal from "@/components/EditFineModal";
import EditStandupModal from "@/components/EditStandupModal";
import EditWordModal from "@/components/EditWordModal";
import HumanLoader from "@/components/HumanLoader";

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
    standupSubmissions,
    standupQuestions
  } = useApp();
  const [viewDate, setViewDate] = useState("");
  const [isEnlarged, setIsEnlarged] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    const todayStr = new Date().toLocaleDateString('en-CA');
    setViewDate(todayStr);
  }, []);

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
  const tomorrowHoliday = useMemo(() => {
    if (!isClient) return null;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    return publicHolidays.find(h => h.date === tomorrowStr);
  }, [isClient, publicHolidays]);

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

    // 3. Combine: Missing ones first, then actual ones (sorted by responded_at)
    const sortedActual = [...actualSubmissions].sort((a, b) =>
      new Date(b.responded_at) - new Date(a.responded_at)
    );

    return [...missingSubmissions, ...sortedActual];
  }, [standupSubmissions, viewDate, employees, isClient]);

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

  if (!isClient || !isLoaded) {
    return <HumanLoader />;
  }

  return (
    <div className="meeting-layout">
      {tomorrowHoliday && (
        <div className="holiday-alert-banner pulse-entry">
          <span className="holiday-icon">🎉</span>
          <div className="holiday-text">
            <strong>Tomorrow is a Public Holiday!</strong>
            <span>Enjoy your day off for {tomorrowHoliday.title}</span>
          </div>
        </div>
      )}
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
            style={{
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 16px',
              height: '36px',
              backgroundColor: '#fff',
              color: '#3c4043',
              border: '1px solid #dadce0',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: '500',
              fontFamily: '"Google Sans", Roboto, Arial, sans-serif',
              boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3)',
              gap: '8px',
              transition: 'background-color 0.2s, box-shadow 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#f8f9fa'; e.currentTarget.style.boxShadow = '0 1px 3px 1px rgba(60,64,67,0.15), 0 1px 2px 0 rgba(60,64,67,0.3)'; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.boxShadow = '0 1px 2px 0 rgba(60,64,67,0.3)'; }}
            title="Join Google Meet"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Join Meet
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
                className="btn-enlarge" 
                onClick={() => setIsEnlarged(!isEnlarged)}
                title={isEnlarged ? "Minimize" : "Enlarge"}
              >
                {isEnlarged ? "✕" : "⛶"}
              </button>
            </div>
          </div>
          <div className="submissions-list">
            {allSubmissions.length > 0 ? (
              allSubmissions.map((s, index) => (
                <div key={`submission-row-${index}`} className={`submission-item ${s.isMissing ? 'missing' : ''}`}>
                  <div className="submission-header">
                    <span className="submission-user">
                      {s.name} {s.isMissing && <span className="missing-badge">NOT SUBMITTED</span>}
                    </span>
                    {!s.isMissing && s.responded_at && (
                      <span className="submission-time">
                        {new Date(s.responded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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
                                <div className="ans-text">
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
                              <div className="ans-text">
                                {typeof value === 'object' ? JSON.stringify(value) : formatText(String(value || ""))}
                              </div>
                            </div>
                          ))
                        )}
                        {s.jira_tickets && s.jira_tickets.length > 0 && (
                          <div className="jira-section">
                            <label className="qa-label">Jira Tickets</label>
                            <div className="jira-tags">
                                {s.jira_tickets.map((t, tIdx) => {
                                  const ticketLabel = typeof t === 'object' ? (t.key || t.summary || "Ticket") : t;
                                  return (
                                    <span key={`jira-${index}-${tIdx}`} className="jira-tag">
                                      {typeof t === 'object' && t.url ? (
                                        <a href={t.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>
                                          {ticketLabel}
                                        </a>
                                      ) : ticketLabel}
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
              ))
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

function QuickAddLeaveModal({ isOpen, onClose, addLeave, employees, today }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("Casual");
  
  const hSubmit = (e) => {
    e.preventDefault();
    if (!name) return;
    addLeave({ name, type, startDate: today, endDate: today, reason: "Meeting entry" });
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
            <label>Type</label>
            <select value={type} onChange={e => setType(e.target.value)}>
              <option>Casual</option>
              <option>Sick</option>
              <option>Project Holiday</option>
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
