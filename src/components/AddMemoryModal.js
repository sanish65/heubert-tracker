import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import Icon from "@/components/Icon";

export default function AddMemoryModal({ isOpen, onClose }) {
  const { addMemory, user } = useApp();
  const { alertDialog } = useDialog();
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
        await alertDialog("Memory wall table not found! Please make sure to run the SQL provided in the implementation plan in your Supabase SQL Editor.");
      } else {
        await alertDialog(`Failed to share memory: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content modal-md">
        <div className="modal-header">
          <span className="modal-icon"><Icon name="image" size={20} /></span>
          <h2>Share a team memory</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group-interactive">
            <label>What kind of memory?</label>
            <div className="memory-type-selector">
              <button
                type="button"
                className={`type-option ${type === 'image' ? 'active' : ''}`}
                onClick={() => setType('image')}
              >
                <span className="type-icon"><Icon name="image" size={22} /></span>
                <span className="type-label">Image</span>
              </button>
              <button
                type="button"
                className={`type-option ${type === 'video' ? 'active' : ''}`}
                onClick={() => setType('video')}
              >
                <span className="type-icon"><Icon name="video" size={22} /></span>
                <span className="type-label">Video</span>
              </button>
              <button
                type="button"
                className={`type-option ${type === 'text' ? 'active' : ''}`}
                onClick={() => setType('text')}
              >
                <span className="type-icon"><Icon name="message" size={22} /></span>
                <span className="type-label">Message</span>
              </button>
            </div>
          </div>

          <div className="form-group-interactive">
            <label>
              {type === 'text' ? 'Your Message' : 'Media URL'}
            </label>
            {type === 'text' ? (
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="Share a funny moment, a quote, or a nice note..."
                required
                rows={5}
              />
            ) : (
              <input
                type="url"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder={type === 'image' ? "Direct image link or Google Drive link" : "Direct video link (MP4)"}
                required
              />
            )}
            {type !== 'text' && (
              <div className="url-tip-lux">
                <Icon name="alert" size={16} />
                <p className="tip-text">
                  <strong>Drive Tip:</strong> Ensure your file is shared as &quot;Anyone with the link&quot;.
                </p>
              </div>
            )}
          </div>

          <div className="form-group-interactive">
            <label>Add a Caption (optional)</label>
            <input
              type="text"
              value={caption}
              onChange={e => setCaption(e.target.value)}
              placeholder="What's the story behind this?"
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="submit-loading">
                  <span className="spinner-lux"></span>
                  <span>Sharing...</span>
                </span>
              ) : (
                <span>Post to Memories</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
