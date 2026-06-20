"use client";

import { useState, useEffect } from "react";

export default function ReleaseUpdatesModal({ isOpen, onClose }) {
  const [releases, setReleases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isOpen) {
      setIsLoading(true);
      fetch("/api/changelog")
        .then(res => res.json())
        .then(data => {
          if (data.releases) {
            setReleases(data.releases);
          } else {
            setError("Could not parse version history.");
          }
        })
        .catch(err => {
          console.error(err);
           setError("Failed to load updates.");
        })
        .finally(() => {
          setIsLoading(false);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal-content changelog-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>🚀 Release Updates</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <div className="changelog-body">
          {isLoading ? (
            <div className="changelog-loading">
               <span className="pulse-dot"></span> Fetching latest commits...
            </div>
          ) : error ? (
            <div className="changelog-empty text-muted">
              {error}
            </div>
          ) : releases.length === 0 ? (
            <div className="changelog-empty text-muted">
              No recent updates found.
            </div>
          ) : (
            <div className="changelog-timeline">
              {releases.map(({ date, items }, rIdx) => (
                <div key={date} className="changelog-day-group">
                  <div className="changelog-date-sticky">
                    <span className="changelog-date">
                      {new Date(date).toLocaleDateString("en-US", {
                         weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' 
                      })}
                    </span>
                  </div>
                  <div className="changelog-items">
                    {items.map((commit, cIdx) => (
                      <div key={commit.hash + cIdx} className="changelog-item group">
                         <div className="changelog-item-header">
                            <span className={`changelog-badge cl-badge-${commit.type}`}>
                              {commit.typeLabel}
                            </span>
                            <span className="changelog-hash" title={commit.hash}>
                              {commit.hash.substring(0, 7)}
                            </span>
                         </div>
                         <div className="changelog-item-content">
                            <h4 className="changelog-subject">{commit.subject}</h4>
                            {commit.body && (
                              <pre className="changelog-body-text text-muted">{commit.body}</pre>
                            )}
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
