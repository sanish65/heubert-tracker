import { useApp } from "@/context/AppContext";
import { useEffect, useState } from "react";
import { transformGoogleDriveLink, getGoogleDriveEmbedUrl, getGoogleDriveThumbnailUrl } from "@/lib/utils";

export default function MemoriesPage({ onAddMemory, onBack }) {
  const { memories, animationsEnabled, deleteMemory, updateMemory, user } = useApp();
  const [visibleItems, setVisibleItems] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null); // {id, type, content, caption}
  const [editForm, setEditForm] = useState({ content: "", caption: "" });
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setVisibleItems([]);
    if (memories.length > 0) {
      let current = 0;
      const interval = setInterval(() => {
        if (current < memories.length) {
          const item = memories[current];
          if (item) setVisibleItems(prev => [...prev, item.id]);
          current++;
        } else {
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [memories]);

  const handleCardClick = (memory) => {
    if (editing) return; // Don't open lightbox while editing
    setExpanded(memory);
  };

  const closeExpanded = () => setExpanded(null);

  const openEdit = (e, memory) => {
    e.stopPropagation();
    setEditing(memory);
    setEditForm({ content: memory.content, caption: memory.caption || "" });
  };

  const handleDelete = async (e, memory) => {
    e.stopPropagation();
    if (!confirm(`Delete this memory?`)) return;
    await deleteMemory(memory.id);
  };

  const handleEditSave = async () => {
    if (!editForm.content.trim()) return;
    setIsSaving(true);
    try {
      await updateMemory(editing.id, {
        content: editForm.content,
        caption: editForm.caption,
      });
      setEditing(null);
    } catch (err) {
      alert(`Failed to update: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="memories-container standalone-view">
      {animationsEnabled !== false && (
        <ul className="christmas-lights-strand">
          <li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li>
          <li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li><li></li>
          <li></li><li></li><li></li><li></li>
        </ul>
      )}

      <div className="memories-header">
        <div className="memories-title-group">
          <h2 className="memories-title">✨ Team Memories</h2>
          <p className="memories-subtitle">Capturing our journey, from standups to celebrations.</p>
        </div>
        <div className="memories-actions">
          <button className="btn btn-secondary btn-back-tracker" onClick={onBack}>
            <span>🔙</span> Back to Tracker
          </button>
          <button className="btn btn-primary btn-share-memory" onClick={onAddMemory}>
            <span>➕</span> Share a Memory
          </button>
        </div>
      </div>

      <div className="memories-wall-classic">
        <div className="memory-wires-classic">
          <div className="wire-classic"></div>
          <div className="wire-classic"></div>
          <div className="wire-classic"></div>
          <div className="wire-classic"></div>
        </div>

        <div className="memories-grid-classic">
          {memories.map((memory, index) => {
            const isVisible = visibleItems.includes(memory.id);
            return (
              <div 
                key={memory.id} 
                className={`memory-item-classic ${isVisible ? 'appear' : ''}`}
                style={{ 
                  '--rotation': `${(index % 2 === 0 ? 1 : -1) * (index % 4 + 1)}deg`,
                  '--delay': `${index * 0.1}s`
                }}
                onClick={() => handleCardClick(memory)}
              >
                <div className="memory-pin-classic"></div>

                {/* Action buttons — only for the uploader */}
                {user && memory.author_email === user.email && (
                  <div className="memory-card-actions">
                    <button
                      className="card-action-btn edit-btn-card"
                      onClick={(e) => openEdit(e, memory)}
                      title="Edit memory"
                    >✏️</button>
                    <button
                      className="card-action-btn delete-btn-card"
                      onClick={(e) => handleDelete(e, memory)}
                      title="Delete memory"
                    >🗑️</button>
                  </div>
                )}

                <div className="memory-card-classic">
                  {memory.type === 'image' && (
                    <div className="memory-media-classic image-container">
                      <img 
                        src={transformGoogleDriveLink(memory.content)} 
                        alt={memory.caption} 
                        loading="lazy" 
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.target.src = "https://placehold.co/600x400/111/fff?text=Media+not+accessible";
                        }}
                      />
                    </div>
                  )}
                  {memory.type === 'video' && (
                    <div className="memory-media-classic video-container">
                      <img
                        src={getGoogleDriveThumbnailUrl(memory.content) || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}
                        alt={memory.caption || 'Video'}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="video-thumb-img"
                      />
                      <div className="video-play-btn">▶</div>
                    </div>
                  )}
                  {memory.type === 'text' && (
                    <div className="memory-text-classic">
                      <div className="quote-mark-classic">"</div>
                      <p className="memory-message-classic">{memory.content}</p>
                    </div>
                  )}
                  <div className="memory-info-classic">
                    {memory.caption && <h4 className="memory-caption-classic">{memory.caption}</h4>}
                    <div className="memory-meta-classic">
                      <span className="memory-author-classic">By {memory.author_name || 'Team'}</span>
                      <span className="memory-date-classic">{new Date(memory.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =========  LIGHTBOX  ========= */}
      {expanded && (
        <div className="memory-lightbox-overlay" onClick={closeExpanded}>
          <div className="memory-lightbox-inner" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={closeExpanded}>✕</button>
            {expanded.type === 'image' && (
              <div className="lightbox-media">
                <img
                  src={transformGoogleDriveLink(expanded.content)}
                  alt={expanded.caption}
                  referrerPolicy="no-referrer"
                  onError={(e) => {
                    e.target.src = "https://placehold.co/800x600/111/fff?text=Media+not+accessible";
                  }}
                />
              </div>
            )}
            {expanded.type === 'video' && (
              <div className="lightbox-media lightbox-video">
                {getGoogleDriveEmbedUrl(expanded.content) ? (
                  <iframe
                    src={getGoogleDriveEmbedUrl(expanded.content)}
                    allow="autoplay"
                    allowFullScreen
                  />
                ) : (
                  <video
                    src={expanded.content}
                    controls
                    autoPlay
                  />
                )}
              </div>
            )}
            {expanded.type === 'text' && (
              <div className="lightbox-text">
                <div className="lightbox-quote">"</div>
                <p>{expanded.content}</p>
              </div>
            )}
            <div className="lightbox-info">
              {expanded.caption && <h3>{expanded.caption}</h3>}
              <div className="lightbox-meta">
                <span>Shared by {expanded.author_name || 'Team'}</span>
                <span>{new Date(expanded.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========  EDIT MODAL  ========= */}
      {editing && (
        <div className="memory-lightbox-overlay" onClick={() => setEditing(null)}>
          <div className="memory-lightbox-inner edit-modal-lux" onClick={e => e.stopPropagation()}>
            <button className="lightbox-close" onClick={() => setEditing(null)}>✕</button>
            <div className="edit-modal-header">
              <h3>✏️ Edit Memory</h3>
            </div>
            <div className="edit-modal-body">
              <label className="form-label-lux">
                {editing.type === 'text' ? 'Message' : 'Media URL'}
              </label>
              {editing.type === 'text' ? (
                <textarea
                  className="premium-textarea-lux"
                  value={editForm.content}
                  onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                  rows={5}
                />
              ) : (
                <input
                  type="url"
                  className="premium-input-lux"
                  value={editForm.content}
                  onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                />
              )}
              <label className="form-label-lux" style={{ marginTop: '16px' }}>Caption (optional)</label>
              <input
                type="text"
                className="premium-input-lux"
                value={editForm.caption}
                onChange={e => setEditForm(f => ({ ...f, caption: e.target.value }))}
                placeholder="A short caption..."
              />
            </div>
            <div className="modal-footer-lux" style={{ padding: '16px 24px', marginTop: 0 }}>
              <button className="btn-cancel-lux" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn-submit-lux" onClick={handleEditSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : '💾 Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {memories.length === 0 && (
        <div className="memories-empty-state">
          <div className="empty-sparkles">✨🌟✨</div>
          <h3>No memories shared yet</h3>
          <p>Be the first one to pin a photo or message to our wall!</p>
          <button className="btn btn-secondary btn-sm" onClick={onAddMemory} style={{ marginTop: '16px' }}>
            Start the Collection
          </button>
        </div>
      )}
    </div>
  );
}
