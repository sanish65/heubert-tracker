import { useState } from "react";
import { useApp } from "@/context/AppContext";

export default function AddMemoryModal({ isOpen, onClose }) {
  const { addMemory, user } = useApp();
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
      if (err.code === "PGRST116" || err.message?.includes("not found")) {
        alert("Memory wall table not found! Please make sure to run the SQL provided in the implementation plan in your Supabase SQL Editor.");
      } else {
        alert(`Failed to share memory: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-md premium-modal">
        <div className="modal-header-lux">
          <div className="header-title-wrapper">
            <span className="header-icon">✨</span>
            <h2>Share a Team Memory</h2>
          </div>
          <button className="close-btn-lux" onClick={onClose}>×</button>
        </div>
        
        <form onSubmit={handleSubmit} className="modal-body-lux">
          <div className="form-group mb-6">
            <label className="form-label-lux">What kind of memory?</label>
            <div className="memory-type-selector">
              <button 
                type="button"
                className={`type-option ${type === 'image' ? 'active' : ''}`}
                onClick={() => setType('image')}
              >
                <span className="type-icon">🖼️</span>
                <span className="type-label">Image</span>
                {type === 'image' && <div className="type-indicator"></div>}
              </button>
              <button 
                type="button"
                className={`type-option ${type === 'video' ? 'active' : ''}`}
                onClick={() => setType('video')}
              >
                <span className="type-icon">🎥</span>
                <span className="type-label">Video</span>
                {type === 'video' && <div className="type-indicator"></div>}
              </button>
              <button 
                type="button"
                className={`type-option ${type === 'text' ? 'active' : ''}`}
                onClick={() => setType('text')}
              >
                <span className="type-icon">✍️</span>
                <span className="type-label">Message</span>
                {type === 'text' && <div className="type-indicator"></div>}
              </button>
            </div>
          </div>

          <div className="form-group mb-6">
            <label className="form-label-lux">
              {type === 'text' ? 'Your Message' : 'Media URL'}
            </label>
            <div className="input-with-icon-lux">
              {type === 'text' ? (
                <textarea 
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder="Share a funny moment, a quote, or a nice note..."
                  required
                  className="premium-textarea-lux"
                />
              ) : (
                <input 
                  type="url"
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={type === 'image' ? "Direct image link or Google Drive link" : "Direct video link (MP4)"}
                  required
                  className="premium-input-lux"
                />
              )}
            </div>
            {type !== 'text' && (
              <div className="url-tip-lux">
                <span className="tip-icon">💡</span>
                <p className="tip-text">
                  <strong>Drive Tip:</strong> Ensure your file is shared as "Anyone with the link".
                </p>
              </div>
            )}
          </div>

          <div className="form-group mb-8">
            <label className="form-label-lux">Add a Caption (optional)</label>
            <input 
              type="text"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="What's the story behind this?"
              className="premium-input-lux"
            />
          </div>

          <div className="modal-footer-lux">
            <button type="button" className="btn-cancel-lux" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-submit-lux" disabled={isSubmitting}>
              {isSubmitting ? (
                <div className="submit-loading">
                  <div className="spinner-lux"></div>
                  <span>Sharing...</span>
                </div>
              ) : (
                <span>✨ Post to Memories</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
