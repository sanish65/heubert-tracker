"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import Link from "next/link";

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
    employees,
    isAdmin,
    isLoaded
  } = useApp();

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

  const today = new Date().toISOString().split('T')[0];

  // Today's Data
  const todaysFines = useMemo(() => fines.filter(f => f.date === today), [fines, today]);
  const todaysStandups = useMemo(() => standupFines.filter(f => f.date === today), [standupFines, today]);
  const activeLeaves = useMemo(() => leaves.filter(l => today >= l.start_date && today <= l.end_date), [leaves, today]);
  
  // Word created TODAY specifically
  const todaysWord = useMemo(() => {
    return words.find(w => w.created_at?.startsWith(today));
  }, [words, today]);

  // Form States
  const [showAddFine, setShowAddFine] = useState(false);
  const [showAddStandup, setShowAddStandup] = useState(false);
  const [showAddWord, setShowAddWord] = useState(false);
  const [showAddLeave, setShowAddLeave] = useState(false);

  return (
    <div className="meeting-layout">
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
                <div key={f.id} className="meeting-item">
                  <span className="item-name">{f.employee_name}</span>
                  <span className="item-value">Rs. {f.amount}</span>
                  <span className={`status-badge ${f.status}`}>{f.status}</span>
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
                <div key={s.id} className="meeting-item">
                  <span className="item-name">{s.employee_name}</span>
                  <span className={`status-badge ${s.status}`}>{s.status}</span>
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

        {/* WORD OF THE DAY */}
        <section className="meeting-card word-hero-card">
          <h2 className="card-title">📖 Word of the Meeting</h2>
          {todaysWord ? (
            <div className="meeting-word-display pulse-entry">
              <div className="word-main">
                <span className="word-text">{todaysWord.word}</span>
                {todaysWord.phonetic && <span className="phonetic">({todaysWord.phonetic})</span>}
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
