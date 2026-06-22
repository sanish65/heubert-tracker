"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useApp } from "@/context/AppContext";
import Link from "next/link";
import { useRouter } from "next/navigation";
import EditFineModal from "@/components/EditFineModal";
import EditStandupModal from "@/components/EditStandupModal";
import EditWordModal from "@/components/EditWordModal";
import EditLeaveModal from "@/components/EditLeaveModal";
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
    deleteLeave,
    updateFine,
    updateStandupFine,
    updateWord,
    updateLeave,
    employees,
    isAdmin,
    isLoaded,
    publicHolidays,
    companyEvents,
    standupSubmissions,
    standupQuestions,
    user,
    currentEmployee,
    isAuthReady,
    animationsEnabled
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

  // Confused Human idle overlay for enlarged view
  const [showEnlargedIdle, setShowEnlargedIdle] = useState(false);
  const enlargedIdleRef = useState(null);
  // Tracks if user has scrolled to the bottom of submissions (seen all entries)
  const hasScrolledToBottomRef = useRef(false);

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

  // Handle Idle Nudge Logic in Enlarged mode (bug walking on submission cards)
  useEffect(() => {
    if (!isEnlarged || !animationsEnabled) {
      setIdleSubmissionId(null);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      return;
    }

    const startIdleTimer = () => {
      setIdleSubmissionId(null);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      
      idleTimerRef.current = setTimeout(() => {
        const listEl = document.querySelector('.submissions-list');
        if (!listEl) return;
        const items = Array.from(listEl.querySelectorAll('.submission-item:not(.missing)'));
        const listRect = listEl.getBoundingClientRect();
        let topmostId = null;
        let minTopOffset = Infinity;
        for (const item of items) {
          const rect = item.getBoundingClientRect();
          if (rect.top >= listRect.top && rect.bottom <= listRect.bottom) {
            if (rect.top < minTopOffset) {
              minTopOffset = rect.top;
              topmostId = item.getAttribute('data-submission-id');
            }
          }
        }
        if (topmostId) setIdleSubmissionId(topmostId);
      }, 120000); // 2 minutes idle for bug
    };

    const events = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'];
    events.forEach(e => window.addEventListener(e, startIdleTimer));
    startIdleTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, startIdleTimer));
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    };
  }, [isEnlarged, animationsEnabled]);

  // Confused Human overlay — appears after 4 mins idle in enlarged view,
  // but ONLY if the user hasn't already scrolled through all submissions
  useEffect(() => {
    hasScrolledToBottomRef.current = false; // reset every time enlarged toggles

    if (!isEnlarged || !animationsEnabled) {
      setShowEnlargedIdle(false);
      if (enlargedIdleRef.current) clearTimeout(enlargedIdleRef.current);
      return;
    }

    // Check if the submissions list has been scrolled to the bottom
    const checkScrollBottom = () => {
      const listEl = document.querySelector('.submissions-list');
      if (!listEl) return;
      const { scrollTop, scrollHeight, clientHeight } = listEl;
      if (scrollTop + clientHeight >= scrollHeight - 16) {
        hasScrolledToBottomRef.current = true;
      }
    };

    const resetEnlargedIdle = () => {
      setShowEnlargedIdle(false);
      if (enlargedIdleRef.current) clearTimeout(enlargedIdleRef.current);
      enlargedIdleRef.current = setTimeout(() => {
        // Only nudge if user hasn't finished scrolling through submissions
        if (!hasScrolledToBottomRef.current) {
          setShowEnlargedIdle(true);
        }
      }, 240000); // 4 minutes idle for confused human
    };

    const windowEvents = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart'];
    windowEvents.forEach(e => window.addEventListener(e, resetEnlargedIdle));

    // Attach scroll listener to the submissions list (with a short delay for DOM render)
    let listEl = null;
    const attachScrollListener = () => {
      listEl = document.querySelector('.submissions-list');
      if (listEl) listEl.addEventListener('scroll', checkScrollBottom);
    };
    const attachTimer = setTimeout(attachScrollListener, 300);

    resetEnlargedIdle();

    return () => {
      windowEvents.forEach(e => window.removeEventListener(e, resetEnlargedIdle));
      if (enlargedIdleRef.current) clearTimeout(enlargedIdleRef.current);
      clearTimeout(attachTimer);
      if (listEl) listEl.removeEventListener('scroll', checkScrollBottom);
    };
  }, [isEnlarged, animationsEnabled]);

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
  const activeLeaves = useMemo(() => {
    const d = new Date();
    const dow = d.getDay();
    const dtStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = publicHolidays.some(h => h.date.startsWith(dtStr));

    if (isWeekend || isHoliday) return [];

    return leaves.filter(l => {
      if (l.dates && Array.isArray(l.dates)) {
        return l.dates.includes(dtStr);
      }
      // Legacy fallback
      return dtStr >= l.start_date && dtStr <= l.end_date;
    });
  }, [leaves, publicHolidays]);
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
  const [showEditLeave, setShowEditLeave] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);

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
                  {isAdmin && (
                    <div className="item-actions">
                      <button onClick={() => { setEditingLeave(l); setShowEditLeave(true); }} title="Edit">✏️</button>
                      <button onClick={() => { if(confirm("Delete leave?")) deleteLeave(l.id); }} title="Delete">🗑</button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        {/* STANDUP SUBMISSIONS (FROM SECONDARY DB) */}
        <section className={`meeting-card submissions-card ${isEnlarged ? 'enlarged' : ''}`}>
          {isEnlarged && showEnlargedIdle && (
            <ConfusedHuman onDismiss={() => setShowEnlargedIdle(false)} />
          )}
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
                                  {typeof value === 'object' ? JSON.stringify(value) : formatText(String(value || ""))}
                                </div>
                              </div>
                            ))
                          )}
                        </>
                      )}
                    </div>
                    {/* Jira tickets rendered OUTSIDE submission-content so they're never hidden by 250px scroll cap */}
                    {!s.isMissing && s.jira_tickets && s.jira_tickets.length > 0 && (
                      <div className="jira-section">
                        <label className="qa-label">Jira Tickets</label>
                        <div className={`jira-tags${s.jira_tickets.length > 5 ? ' jira-tags--multi-col' : ''}`}>
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
                              <span key={`jira-${index}-${tIdx}`} className="jira-tag">
                                <span className="jira-tag-row">
                                  {ticketUrl ? (
                                    <a href={ticketUrl} target="_blank" rel="noopener noreferrer" className="jira-tag-key">
                                      {ticketKey}
                                    </a>
                                  ) : (
                                    <span className="jira-tag-key">{ticketKey}</span>
                                  )}
                                  {ticketStatus && (
                                    <span className={statusClass}>{ticketStatus}</span>
                                  )}
                                </span>
                                {typeof t === 'object' && t.summary && (
                                  <span className="jira-summary">{t.summary}</span>
                                )}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
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
          fines={fines}
        />
      )}
      {showAddStandup && (
        <QuickAddStandupModal
          isOpen={showAddStandup}
          onClose={() => setShowAddStandup(false)}
          addStandupFine={addStandupFine}
          employees={employees}
          today={today}
          standupFines={standupFines}
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

      <EditLeaveModal
        isOpen={showEditLeave}
        onClose={() => { setShowEditLeave(false); setEditingLeave(null); }}
        leave={editingLeave}
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
          leaves={leaves}
        />
      )}
    </div>
  );
}

// COMPACT INLINE MODALS FOR MEETING MODE
function QuickAddFineModal({ isOpen, onClose, addFine, employees, today, fines }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState(25);
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const hSubmit = (e) => {
    e.preventDefault();
    if (!name) return;

    const isDuplicate = fines.some(f =>
      f.employee_name === name &&
      f.date === today &&
      Number(f.amount) === Number(amount)
    );

    if (isDuplicate && !duplicateWarning) {
      setDuplicateWarning(true);
      return;
    }

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
            <select value={name} onChange={e => { setName(e.target.value); setDuplicateWarning(false); }} required>
              <option value="">Select...</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          <div className="form-group-interactive">
            <label>Amount (Rs.)</label>
            <div className="amount-preset-options">
              {[25, 50].map(val => (
                <label key={val} className={`amount-chip ${amount == val ? 'active' : ''}`}>
                  <input
                    type="radio"
                    name="fineAmount"
                    value={val}
                    checked={amount == val}
                    onChange={() => { setAmount(val); setDuplicateWarning(false); }}
                  />
                  <span>RS {val}</span>
                </label>
              ))}
            </div>
          </div>
          {duplicateWarning && (
            <div className="duplicate-warning">
              <span className="duplicate-warning-icon">⚠️</span>
              <div className="duplicate-warning-text">
                <strong>Duplicate entry detected</strong>
                <p>A RS {amount} fine for <strong>{name}</strong> today already exists. Add it anyway?</p>
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setDuplicateWarning(false); onClose(); }}>Cancel</button>
            {duplicateWarning ? (
              <button type="submit" className="btn btn-warning">Add Anyway</button>
            ) : (
              <button type="submit" className="btn btn-primary">Save Fine</button>
            )}
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
  const [bugType, setBugType] = useState('turtle');
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!isInitialized.current) {
      // Randomize initial bug
      const bugs = ['turtle', 'ant', 'spider'];
      setBugType(bugs[Math.floor(Math.random() * bugs.length)]);
      
      // Randomize initial text
      setIndex(Math.floor(Math.random() * phrases.length));
      isInitialized.current = true;
    }
    
    // Change text every 5 seconds as it walks (so it's easily readable)
    const interval = setInterval(() => {
      setIndex(current => (current + 1) % phrases.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [phrases.length]);

  const renderTurtle = () => (
    <svg viewBox="0 0 50 30" className="bug-character" xmlns="http://www.w3.org/2000/svg">
      {/* Back legs */}
      <g className="bug-leg-1" style={{ transformOrigin: '12px 22px' }}>
        <path d="M 12 22 Q 10 26 8 28" stroke="#166534" fill="none" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 8 28 L 5 28" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" />
      </g>
      
      {/* Front legs */}
      <g className="bug-leg-3" style={{ transformOrigin: '32px 22px' }}>
        <path d="M 32 22 Q 35 26 38 28" stroke="#166534" fill="none" strokeWidth="3.5" strokeLinecap="round" />
        <path d="M 38 28 L 41 28" stroke="#166534" strokeWidth="2.5" strokeLinecap="round" />
      </g>

      {/* Tail */}
      <path d="M 10 20 Q 5 18 3 20" stroke="#166534" fill="none" strokeWidth="2.5" strokeLinecap="round" />

      {/* Head */}
      <ellipse cx="40" cy="18" rx="6" ry="4" fill="#166534" />
      {/* Eye */}
      <circle cx="43" cy="17" r="1" fill="#fff" />
      
      {/* Shell Base (Plastron) */}
      <ellipse cx="22" cy="22" rx="15" ry="3" fill="#854d0e" />
      
      {/* Shell (Carapace) */}
      <path d="M 7 20 C 7 5, 37 5, 37 20 Z" fill="#22c55e" />
      <path d="M 7 20 C 7 5, 37 5, 37 20 Z" fill="url(#turtle-shell)" opacity="0.3" />
      
      {/* Shell outline & pattern lines */}
      <path d="M 7 20 C 7 5, 37 5, 37 20 Z" fill="none" stroke="#15803d" strokeWidth="1.5" />
      <path d="M 12 18 C 12 10, 32 10, 32 18 Z" fill="none" stroke="#15803d" strokeWidth="1.5" />
      <path d="M 22 8 L 22 18" stroke="#15803d" strokeWidth="1.5" />
      <path d="M 15 11 L 10 16" stroke="#15803d" strokeWidth="1.5" />
      <path d="M 29 11 L 34 16" stroke="#15803d" strokeWidth="1.5" />
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
        {bugType === 'turtle' && renderTurtle()}
        {bugType === 'ant' && renderAnt()}
        {bugType === 'spider' && renderSpider()}
      </div>
    </div>
  );
}

function QuickAddLeaveModal({ isOpen, onClose, addLeave, employees, today, leaves }) {
  const [name, setName] = useState("");
  const [duration, setDuration] = useState("full");   // full | half | early
  const [segment, setSegment] = useState("first");    // first | second
  const [category, setCategory] = useState("Casual"); // Casual | Sick | Project Holiday
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const DURATION_OPTS = [
    { value: "full",  label: "Full Day",     icon: "📅" },
    { value: "half",  label: "Half Day",     icon: "🌗" },
    { value: "early", label: "Early Leave",  icon: "🚪" },
  ];

  const hSubmit = (e) => {
    e.preventDefault();
    if (!name) return;

    const isDuplicate = leaves.some(l =>
      l.employee_name === name &&
      l.start_date === today
    );

    if (isDuplicate && !duplicateWarning) {
      setDuplicateWarning(true);
      return;
    }

    let finalReason = category;
    if (duration === "half") {
      finalReason = (segment === "first" ? "[First Half] " : "[Second Half] ") + finalReason;
    }

    addLeave({
      name,
      type: duration,
      startDate: today,
      endDate: today,
      reason: finalReason,
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
            <select value={name} onChange={e => { setName(e.target.value); setDuplicateWarning(false); }} required>
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

          {duration === "half" && (
            <div className="form-group-interactive" style={{ marginTop: "1rem" }}>
              <label>Half Day Segment</label>
              <div className="leave-type-options">
                {[
                  { value: "first", label: "First Half", icon: "🌅" },
                  { value: "second", label: "Second Half", icon: "🌇" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`leave-type-chip ${segment === opt.value ? "active" : ""}`}
                  >
                    <input
                      type="radio"
                      name="quickLeaveSegment"
                      value={opt.value}
                      checked={segment === opt.value}
                      onChange={() => setSegment(opt.value)}
                    />
                    <span>{opt.icon} {opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="form-group-interactive">
            <label>Category</label>
            <select value={category} onChange={e => setCategory(e.target.value)}>
              <option>Casual</option>
              <option>Sick</option>
            </select>
          </div>

          {duplicateWarning && (
            <div className="duplicate-warning">
              <span className="duplicate-warning-icon">⚠️</span>
              <div className="duplicate-warning-text">
                <strong>Duplicate entry detected</strong>
                <p>A leave for <strong>{name}</strong> today already exists. Add it anyway?</p>
              </div>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setDuplicateWarning(false); onClose(); }}>Cancel</button>
            {duplicateWarning ? (
              <button type="submit" className="btn btn-warning">Add Anyway</button>
            ) : (
              <button type="submit" className="btn btn-accent">Save Leave</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
function QuickAddStandupModal({ isOpen, onClose, addStandupFine, employees, today, standupFines }) {
  const [name, setName] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState(false);

  const hSubmit = (e) => {
    e.preventDefault();
    if (!name) return;

    const isDuplicate = standupFines.some(s =>
      s.employee_name === name &&
      s.date === today
    );

    if (isDuplicate && !duplicateWarning) {
      setDuplicateWarning(true);
      return;
    }

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
            <select value={name} onChange={e => { setName(e.target.value); setDuplicateWarning(false); }} required>
              <option value="">Select...</option>
              {employees.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
            </select>
          </div>
          {duplicateWarning && (
            <div className="duplicate-warning">
              <span className="duplicate-warning-icon">⚠️</span>
              <div className="duplicate-warning-text">
                <strong>Duplicate entry detected</strong>
                <p>A standup fine for <strong>{name}</strong> today already exists. Add it anyway?</p>
              </div>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={() => { setDuplicateWarning(false); onClose(); }}>Cancel</button>
            {duplicateWarning ? (
              <button type="submit" className="btn btn-warning">Add Anyway</button>
            ) : (
              <button type="submit" className="btn btn-primary">Save Standup Fine</button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

// Confused human overlay for enlarged idle state
function ConfusedHuman({ onDismiss }) {
  return (
    <div className="confused-human-overlay" onClick={onDismiss}>
      <div className="confused-human-wrap">
        {/* Speech bubble */}
        <div className="confused-bubble">
          Let&apos;s finish the sync first! 📋
        </div>
        <div className="confused-bubble-tail" />

        {/* SVG stick figure — confused pose */}
        <svg
          className="confused-figure"
          viewBox="0 0 120 180"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
        >
          {/* Floating question marks */}
          <text className="qmark qmark1" x="88" y="30" fontSize="18" fill="#facc15" fontWeight="900">?</text>
          <text className="qmark qmark2" x="20" y="45" fontSize="14" fill="#facc15" fontWeight="900">?</text>
          <text className="qmark qmark3" x="95" y="58" fontSize="11" fill="#facc15" fontWeight="900">?</text>

          {/* Head */}
          <circle cx="60" cy="36" r="18" stroke="var(--text-primary)" strokeWidth="3" fill="rgba(99,102,241,0.12)" />

          {/* Confused face — worried symmetric brows, wide eyes, open uncertain mouth */}
          {/* Eyes — slightly bigger for a wide "huh?" look */}
          <circle cx="53" cy="33" r="3" fill="var(--text-primary)" />
          <circle cx="67" cy="33" r="3" fill="var(--text-primary)" />
          {/* Tiny bright dot highlights in eyes */}
          <circle cx="55" cy="31" r="1" fill="rgba(255,255,255,0.7)" />
          <circle cx="69" cy="31" r="1" fill="rgba(255,255,255,0.7)" />
          {/* Both brows raised & arched inward — worried/confused, NOT stern */}
          <path d="M48 27 Q53 22 58 27" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" />
          <path d="M62 27 Q67 22 72 27" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" />
          {/* Mouth: small open oval — confused "uhh?" expression */}
          <ellipse cx="60" cy="44" rx="5" ry="3.5" fill="var(--text-primary)" opacity="0.8" />

          {/* Body */}
          <line x1="60" y1="54" x2="60" y2="110" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />

          {/* Left arm — raised and bent (scratching head) */}
          <path d="M60 65 Q40 55 38 38" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />
          {/* Hand scratching */}
          <circle cx="38" cy="36" r="4" stroke="var(--text-primary)" strokeWidth="2" fill="rgba(99,102,241,0.15)" />

          {/* Right arm — out to the side (shrug) */}
          <path d="M60 65 Q82 72 90 62" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />
          <path d="M90 62 Q96 58 94 65" stroke="var(--text-primary)" strokeWidth="2" strokeLinecap="round" />

          {/* Left leg */}
          <path d="M60 110 Q50 135 45 155" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />
          {/* Right leg */}
          <path d="M60 110 Q70 135 75 155" stroke="var(--text-primary)" strokeWidth="3" strokeLinecap="round" />

          {/* Feet */}
          <path d="M45 155 Q40 158 35 155" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
          <path d="M75 155 Q80 158 85 155" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
        </svg>

        <p className="confused-hint">click anywhere to dismiss</p>
      </div>
    </div>
  );
}

