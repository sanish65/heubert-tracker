"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";

export default function WordPage({ onAddSeason, onAddWord, onEditWord, onEditSeason }) {
  const { wordSeasons, words, deleteWord, deleteWordSeason, seedWordsTable, isAdmin } = useApp();
  const [activeSeasonId, setActiveSeasonId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Set initial active season
  useMemo(() => {
    if (!activeSeasonId && wordSeasons.length > 0) {
      const latestSeasonId = [...wordSeasons].sort((a, b) => 
        new Date(b.created_at || 0) - new Date(a.created_at || 0)
      )[0].id;
      setActiveSeasonId(latestSeasonId);
    }
  }, [wordSeasons, activeSeasonId]);

  const activeSeason = wordSeasons.find(s => s.id === activeSeasonId);

  const filteredWords = useMemo(() => {
    let list = words.filter(w => w.season_id === activeSeasonId);
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      list = list.filter(w => 
        w.word.toLowerCase().includes(q) || 
        w.definition.toLowerCase().includes(q) ||
        (w.translation && w.translation.toLowerCase().includes(q))
      );
    }
    return list;
  }, [words, activeSeasonId, searchTerm]);

  return (
    <div className="word-page-container">
      <aside className="word-sidebar">
        <div className="sidebar-header">
          <h3 className="sidebar-title">📚 Seasons</h3>
          {isAdmin && (
            <button className="btn-icon-add" onClick={onAddSeason} title="Add New Season">
              +
            </button>
          )}
        </div>
        <div className="season-list">
          {wordSeasons.length === 0 ? (
            <div className="sidebar-empty">
              <p className="empty-msg">No seasons yet</p>
              {isAdmin && (
                <button className="btn btn-secondary btn-sm" onClick={seedWordsTable} style={{ marginTop: "1rem", width: "100%" }}>
                  🌱 Seed Seasons 1 & 2
                </button>
              )}
            </div>
          ) : (
            [...wordSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)).map(s => (
              <div 
                key={s.id} 
                className={`season-item ${activeSeasonId === s.id ? 'active' : ''}`}
                onClick={() => setActiveSeasonId(s.id)}
                style={{ transition: 'box-shadow 0.2s', display: 'flex', alignItems: 'center' }}
                onMouseOver={(e) => e.currentTarget.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)'}
                onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
              >
                <span className="season-name">{s.title}</span>
                {isAdmin && (
                  <button
                    className="btn-edit-small action-icon"
                    style={{ background: 'transparent', border: 'none', cursor: 'pointer', marginLeft: 'auto', fontSize: '1rem' }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onEditSeason(s);
                    }}
                    title="Edit Season"
                  >
                    ✏️
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </aside>

      <main className="word-content">
        <header className="word-header">
          <div className="header-info" style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span 
              className="active-season-badge" 
              style={{
                fontSize: '0.75rem',
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: '1px',
                color: 'var(--accent, #00796b)',
                padding: '4px 8px',
                background: 'rgba(0, 121, 107, 0.1)',
                borderRadius: '12px',
                width: 'fit-content'
              }}
            >
              {activeSeason ? activeSeason.title : "Select a Season"}
            </span>
            <span className="word-count" style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--text-main, inherit)' }}>
              {filteredWords.length} Words Shared
            </span>
          </div>
          
          <div className="word-actions">
            <div className="search-box">
              <span className="search-icon">🔍</span>
              <input 
                type="text" 
                placeholder="Search words..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {activeSeasonId && (
              <button className="btn btn-primary" onClick={() => onAddWord(activeSeasonId)}>
                + Add Word
              </button>
            )}
          </div>
        </header>

        <div className="word-grid">
          {filteredWords.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📖</div>
              <p>No words found in this season yet.</p>
              <button className="btn btn-secondary" onClick={() => onAddWord(activeSeasonId)}>
                Be the first to share!
              </button>
            </div>
          ) : (
            filteredWords.map(w => (
              <div key={w.id} className="word-card">
                <div className="card-top">
                  <div className="word-meta">
                    <h3 className="word-text">{w.word}</h3>
                    {w.phonetic && <span className="phonetic">({w.phonetic})</span>}
                  </div>
                  {isAdmin && (
                    <div className="card-actions">
                      <button 
                        className="btn-edit-card" 
                        onClick={() => onEditWord(w)}
                        title="Edit word"
                      >
                        📝
                      </button>
                      <button 
                        className="btn-delete-card" 
                        onClick={() => {
                          if (confirm("Delete this word?")) deleteWord(w.id);
                        }}
                        title="Delete word"
                      >
                        🗑
                      </button>
                    </div>
                  )}
                </div>
                
                {w.translation && (
                  <div className="translation-box">
                    <span className="label">Translation:</span>
                    <span className="translation-text">{w.translation}</span>
                  </div>
                )}

                <p className="definition">{w.definition}</p>

                {w.example && (
                  <div className="example-box">
                    <p className="example-text">"{w.example}"</p>
                  </div>
                )}

                <div className="card-footer">
                  <span className="shared-by">Shared by {w.created_by}</span>
                  <span className="shared-at">{new Date(w.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </main>
    </div>
  );
}
