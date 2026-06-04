import { useApp } from "@/context/AppContext";
import { useEffect, useState } from "react";

export default function MemoriesPage({ onAddMemory }) {
  const { memories, animationsEnabled } = useApp();
  const [visibleItems, setVisibleItems] = useState([]);

  useEffect(() => {
    // Reset visible items when memories change
    setVisibleItems([]);
    
    if (memories.length > 0) {
      let current = 0;
      const interval = setInterval(() => {
        if (current < memories.length) {
          setVisibleItems(prev => [...prev, memories[current].id]);
          current++;
        } else {
          clearInterval(interval);
        }
      }, 150); // Sequential reveal speed
      return () => clearInterval(interval);
    }
  }, [memories.length]); // Only reset if the count changes

  return (
    <div className="memories-container">
      {/* Christmas Lights Decoration */}
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
        <button className="btn btn-primary btn-share-memory" onClick={onAddMemory}>
          <span>➕</span> Share a Memory
        </button>
      </div>

      <div className="memories-wall">
        {/* Hanging wires visualization */}
        <div className="memory-wires">
          <div className="wire"></div>
          <div className="wire"></div>
          <div className="wire"></div>
        </div>

        <div className="memories-grid">
          {memories.map((memory, index) => {
            const isVisible = visibleItems.includes(memory.id);
            
            return (
              <div 
                key={memory.id} 
                className={`memory-item type-${memory.type} ${isVisible ? 'appear' : ''}`}
                style={{ 
                  '--rotation': `${(index % 2 === 0 ? 1 : -1) * (Math.random() * 3 + 1)}deg`,
                  '--delay': `${index * 0.1}s`
                }}
              >
                {/* Pin/Clip element */}
                <div className="memory-pin"></div>

                <div className="memory-card">
                  {memory.type === 'image' && (
                    <div className="memory-media image-container">
                      <img src={memory.content} alt={memory.caption} loading="lazy" />
                    </div>
                  )}
                  {memory.type === 'video' && (
                    <div className="memory-media video-container">
                      <video src={memory.content} controls preload="metadata" />
                    </div>
                  )}
                  {memory.type === 'text' && (
                    <div className="memory-text-content">
                      <div className="quote-mark">“</div>
                      <p className="memory-message">{memory.content}</p>
                      <div className="quote-mark bottom">”</div>
                    </div>
                  )}
                  
                  <div className="memory-info">
                    {memory.caption && <h3 className="memory-caption">{memory.caption}</h3>}
                    <div className="memory-meta">
                      <span className="memory-author">Shared by {memory.author_name || 'Anonymous'}</span>
                      <span className="memory-date">{new Date(memory.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {memories.length === 0 && (
        <div className="memories-empty-state">
          <div className="empty-sparkles">✨🌟✨</div>
          <h3>No memories shared yet</h3>
          <p>Be the first one to pin a photo, video, or a nice message to our team wall!</p>
          <button className="btn btn-secondary btn-sm" onClick={onAddMemory} style={{ marginTop: '16px' }}>
            Start the Collection
          </button>
        </div>
      )}
    </div>
  );
}
