import { useApp } from "@/context/AppContext";
import { useEffect, useState } from "react";
import Image from "next/image";
import { transformGoogleDriveLink, getGoogleDriveEmbedUrl, getGoogleDriveThumbnailUrl } from "@/lib/utils";
import { useDialog } from "@/context/DialogContext";
import HeubertAnime from "@/components/HeubertAnime";
import Icon from "@/components/Icon";
import PageHead from "@/components/PageHead";
import Avatar from "@/components/Avatar";

// Memories.dc.html. page.js renders this view outside the app shell, so it brings the
// standalone top bar of the poker route; then the page heading and a masonry of glass
// memory cards. The lightbox and the edit dialog render at the top level of the page,
// never inside a card: a card's backdrop blur and hover lift would trap them.

const formatDate = (value) =>
  new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function MemoriesPage({ onAddMemory, onBack }) {
  const { memories, animationsEnabled, deleteMemory, updateMemory, user } = useApp();
  const { confirmDialog, alertDialog } = useDialog();
  const [visibleItems, setVisibleItems] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null); // {id, type, content, caption}
  const [editForm, setEditForm] = useState({ content: "", caption: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  // Only cards that are new to the wall get staggered in. Clearing the whole list on
  // every `memories` change made a single delete blank the wall and rebuild it one
  // card at a time, which reads as the delete having gone wrong.
  useEffect(() => {
    const ids = memories.map(m => m.id);
    setVisibleItems(prev => prev.filter(id => ids.includes(id)));
    if (ids.length === 0) return;

    let current = 0;
    const interval = setInterval(() => {
      if (current >= ids.length) {
        clearInterval(interval);
        return;
      }
      const id = ids[current++];
      setVisibleItems(prev => (prev.includes(id) ? prev : [...prev, id]));
    }, 100);
    return () => clearInterval(interval);
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
    if (!(await confirmDialog(`Delete this memory?`, { danger: true }))) return;
    setDeletingId(memory.id);
    try {
      await deleteMemory(memory.id);
    } catch (err) {
      await alertDialog(`Failed to delete: ${err.message}`, { tone: 'error' });
    } finally {
      setDeletingId(null);
    }
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
      await alertDialog(`Failed to update: ${err.message}`, { tone: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const animated = animationsEnabled !== false;
  const count = memories.length;
  const isMine = (memory) => Boolean(user) && memory.author_email === user.email;

  return (
    <div className="poker-standalone-shell">
      <header className="glass poker-standalone-bar">
        <div className="poker-standalone-brand">
          <Image src="/logo.png" alt="" width={32} height={32} className="poker-bar-logo" />
          <span className="poker-standalone-name">Memories</span>
        </div>
        <div className="memories-bar-actions">
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            <Icon name="arrow-left" size={16} strokeWidth={2} />
            Back to Tracker
          </button>
          <button type="button" className="btn btn-primary" onClick={onAddMemory}>
            <Icon name="plus" size={16} strokeWidth={2.2} />
            Share a Memory
          </button>
        </div>
      </header>

      <main className="poker-standalone-main memories-main">
        <PageHead
          eyebrow={`Team wall · ${count} ${count === 1 ? "memory" : "memories"}`}
          title="Team Memories"
          subtitle="Capturing our journey, from standups to celebrations."
        />

        {count === 0 ? (
          <div className="glass-card memories-empty">
            <span className="modal-icon"><Icon name="image" size={20} /></span>
            <h2 className="section-title">No memories shared yet</h2>
            <p className="empty-msg">Be the first one to pin a photo or message to our wall!</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onAddMemory}>
              Start the Collection
            </button>
          </div>
        ) : (
          <section className="memories-masonry" aria-label="Memories">
            {memories.map((memory) => {
              const mine = isMine(memory);
              const author = memory.author_name || 'Team';
              const shown = !animated || visibleItems.includes(memory.id);
              return (
                <article
                  key={memory.id}
                  className={`glass memory-card${animated ? " card-lift" : ""}${shown ? " is-shown" : ""}`}
                  onClick={() => handleCardClick(memory)}
                >
                  {memory.type === 'image' && (
                    <button type="button" className="memory-media" aria-label={`Open ${memory.caption || "photo"}`}>
                      <img
                        src={transformGoogleDriveLink(memory.content)}
                        alt={memory.caption}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        onError={(e) => {
                          e.target.src = "https://placehold.co/600x400/111/fff?text=Media+not+accessible";
                        }}
                      />
                    </button>
                  )}
                  {memory.type === 'video' && (
                    <button type="button" className="memory-media is-video" aria-label={`Play ${memory.caption || "video"}`}>
                      <img
                        src={getGoogleDriveThumbnailUrl(memory.content) || 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'}
                        alt={memory.caption || 'Video'}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                      />
                      <span className="memory-play" aria-hidden="true"><Icon name="play" size={22} /></span>
                      <span className="pill pill-violet memory-media-tag">Video</span>
                    </button>
                  )}
                  {memory.type === 'text' && (
                    <div className="memory-quote-block">
                      <span className="memory-quote" aria-hidden="true">&ldquo;</span>
                      <p className="memory-message">{memory.content}</p>
                    </div>
                  )}

                  <div className="memory-info">
                    {memory.caption && <h2 className="memory-caption">{memory.caption}</h2>}
                    <div className="memory-meta">
                      <Avatar name={author} isMe={mine} className="avatar avatar-sm" aria-hidden="true" />
                      <span className="memory-author">By {author}</span>
                      <span className="memory-date mono">{formatDate(memory.created_at)}</span>
                    </div>

                    {/* Edit and delete: only for the uploader */}
                    {mine && (
                      <div className="memory-actions">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={(e) => openEdit(e, memory)}>
                          <Icon name="edit" size={14} />
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm memory-action-delete"
                          onClick={(e) => handleDelete(e, memory)}
                          disabled={deletingId === memory.id}
                        >
                          <Icon name="trash" size={14} />
                          {deletingId === memory.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </section>
        )}

        <HeubertAnime />
      </main>

      {/* =========  LIGHTBOX  ========= */}
      {expanded && (
        <div className="modal-overlay" onClick={closeExpanded}>
          <div
            className="modal-content memory-lightbox"
            role="dialog"
            aria-modal="true"
            aria-label={expanded.caption || 'Memory'}
            onClick={e => e.stopPropagation()}
          >
            <button type="button" className="modal-close memory-lightbox-close" onClick={closeExpanded} aria-label="Close">
              <Icon name="x" size={18} />
            </button>
            {expanded.type === 'image' && (
              <div className="memory-lightbox-media">
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
              <div className="memory-lightbox-media is-video">
                {getGoogleDriveEmbedUrl(expanded.content) ? (
                  <iframe
                    src={getGoogleDriveEmbedUrl(expanded.content)}
                    title={expanded.caption || 'Video'}
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
              <div className="memory-lightbox-text">
                <span className="memory-quote" aria-hidden="true">&ldquo;</span>
                <p>{expanded.content}</p>
              </div>
            )}
            <div className="memory-lightbox-info">
              {expanded.caption && <h3>{expanded.caption}</h3>}
              <div className="memory-meta">
                <Avatar name={expanded.author_name || 'Team'} isMe={isMine(expanded)} className="avatar avatar-sm" aria-hidden="true" />
                <span className="memory-author">Shared by {expanded.author_name || 'Team'}</span>
                <span className="memory-date mono">{formatDate(expanded.created_at)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========  EDIT DIALOG  ========= */}
      {editing && (
        <div className="modal-overlay" onClick={() => setEditing(null)}>
          <div
            className="modal-content"
            role="dialog"
            aria-modal="true"
            aria-labelledby="memory-edit-title"
            onClick={e => e.stopPropagation()}
          >
            <div className="modal-header">
              <span className="modal-icon"><Icon name="edit" size={20} /></span>
              <h2 id="memory-edit-title">Edit memory</h2>
              <button type="button" className="modal-close" onClick={() => setEditing(null)} aria-label="Close">
                <Icon name="x" size={18} />
              </button>
            </div>
            <div className="form-group-interactive">
              <label htmlFor="memory-edit-content">
                {editing.type === 'text' ? 'Message' : 'Media URL'}
              </label>
              {editing.type === 'text' ? (
                <textarea
                  id="memory-edit-content"
                  value={editForm.content}
                  onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                  rows={5}
                />
              ) : (
                <input
                  id="memory-edit-content"
                  type="url"
                  value={editForm.content}
                  onChange={e => setEditForm(f => ({ ...f, content: e.target.value }))}
                />
              )}
            </div>
            <div className="form-group-interactive">
              <label htmlFor="memory-edit-caption">Caption (optional)</label>
              <input
                id="memory-edit-caption"
                type="text"
                value={editForm.caption}
                onChange={e => setEditForm(f => ({ ...f, caption: e.target.value }))}
                placeholder="A short caption..."
              />
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
              <button type="button" className="btn btn-primary" onClick={handleEditSave} disabled={isSaving}>
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
