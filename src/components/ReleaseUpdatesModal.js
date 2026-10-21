"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/Icon";

// The commit categories /api/changelog returns, in the canvas pill colours.
const TAG_PILLS = {
  feature: "pill-green",
  fix: "pill-red",
  removal: "pill-amber",
  refactor: "pill-violet",
  update: "pill-blue",
};

const tagPill = (type) => (Object.hasOwn(TAG_PILLS, type) ? TAG_PILLS[type] : "pill-gray");

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
          <span className="modal-icon"><Icon name="gift" size={20} /></span>
          <h2>Release updates</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>

        <div className="changelog-body">
          {isLoading ? (
            <div className="changelog-state empty-msg" role="status">
              <span className="spinner" aria-hidden="true" />
              Fetching latest commits...
            </div>
          ) : error ? (
            <p className="changelog-state empty-msg">{error}</p>
          ) : releases.length === 0 ? (
            <p className="changelog-state empty-msg">No recent updates found.</p>
          ) : (
            <ol className="changelog-days">
              {releases.map(({ date, items }) => (
                <li key={date} className="changelog-day">
                  <h3 className="eyebrow">
                    {new Date(date).toLocaleDateString("en-US", {
                      weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
                    })}
                  </h3>
                  <ul className="changelog-rows">
                    {items.map((commit, cIdx) => (
                      <li key={commit.hash + cIdx} className="changelog-row">
                        <div className="changelog-row-head">
                          <span className={`pill ${tagPill(commit.type)}`}>{commit.typeLabel}</span>
                          <code className="changelog-hash" title={commit.hash}>
                            {commit.hash.substring(0, 7)}
                          </code>
                        </div>
                        <h4 className="changelog-subject">{commit.subject}</h4>
                        {commit.body && (
                          <pre className="changelog-body-text">{commit.body}</pre>
                        )}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
