import { useState } from "react";
import { useApp } from "@/context/AppContext";

export default function AddMemoryModal({ isOpen, onClose }) {
  const { addMemory } = useApp();
  const [type, setType] = useState("image");
  const [content, setContent] = useState("");
  const [caption, setCaption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addMemory({ type, content, caption });
      setType("image");
      setContent("");
      setCaption("");
      onClose();
    } catch (err) {
      console.error("Error adding memory:", err);
      alert("Failed to add memory. Make sure you have created the memories table in Supabase.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-md">
        <div className="modal-header">
          <h2>✨ Add Team Memory</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Memory Type</label>
            <div className="amount-preset-options">
              <div 
                className={`amount-chip ${type === 'image' ? 'active' : ''}`}
                onClick={() => setType('image')}
              >
                🖼️ Image
              </div>
              <div 
                className={`amount-chip ${type === 'video' ? 'active' : ''}`}
                onClick={() => setType('video')}
              >
                🎥 Video
              </div>
              <div 
                className={`amount-chip ${type === 'text' ? 'active' : ''}`}
                onClick={() => setType('text')}
              >
                ✍️ Text
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>{type === 'text' ? 'Your Memory' : 'Media Link'}</label>
            {type === 'text' ? (
              <textarea 
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Share a funny moment, a quote, or a nice note..."
                required
                style={{ minHeight: '100px', width: '100%', padding: '10px', background: 'var(--bg-input)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)' }}
              />
            ) : (
              <input 
                type="url"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={type === 'image' ? "Direct image URL (e.g. from Google Drive or Unsplash)" : "Direct video URL (mp4)"}
                required
              />
            )}
            <p className="field-hint" style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              {type === 'text' ? 'This will appear as a pop-up message.' : `Paste a direct link to your ${type}.`}
            </p>
          </div>

          <div className="form-group">
            <label>Caption (Optional)</label>
            <input 
              type="text"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="Give this memory a title or short description..."
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Sharing...' : '✨ Share to Memories'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
