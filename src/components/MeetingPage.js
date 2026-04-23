"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import Link from "next/link";
import EditFineModal from "@/components/EditFineModal";
import EditStandupModal from "@/components/EditStandupModal";
import EditWordModal from "@/components/EditWordModal";

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
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local
  const [viewDate, setViewDate] = useState(today);
  const [isEnlarged, setIsEnlarged] = useState(false);

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
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];
  const tomorrowHoliday = publicHolidays.find(h => h.date === tomorrowStr);

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
      .map(emp => ({
        id: `missing-${emp.id}`,
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
  }, [standupSubmissions, viewDate, employees]);

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

  if (!isLoaded) {
    return (
      <div className="loading-splash">
        <div className="splash-logo">⏰</div>
        <div className="splash-text">Heubert Tracker</div>
        <div className="loader-bar-container">
          <div className="loader-bar"></div>
        </div>
      </div>
    );
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
          <h1 className="meeting-title">Daily Sync: {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</h1>
        </div>
        <div className="meeting-actions">
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
              todaysFines.map(f => (
                <div key={f.id} className="meeting-item group">
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
              todaysStandups.map(s => (
                <div key={s.id} className="meeting-item group">
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
              activeLeaves.map(l => (
                <div key={l.id} className="meeting-item">
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
                  {viewDate === today ? "Today" : new Date(viewDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
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
              allSubmissions.map((s) => (
                <div key={s.id} className={`submission-item ${s.isMissing ? 'missing' : ''}`}>
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
                          standupQuestions.map((q) => {
                            // Try mapping by prepending 'question_' to ID (as seen in user data), or raw ID, Question Text, Sort Order
                            const answers = s.answers || {};
                            const answer = answers[`question_${q.id}`] || 
                                         answers[q.id] || 
                                         answers[q.question] || 
                                         answers[q.sort_order] || 
                                         answers[q.sort_order.toString()];
                            
                            return (
                              <div key={q.id} className="submission-qa">
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
                          Object.entries(s.answers || {}).map(([key, value], idx) => (
                            <div key={idx} className="submission-qa">
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
                              {s.jira_tickets.map(t => <span key={t} className="jira-tag">{t}</span>)}
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
