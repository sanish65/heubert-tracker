import { useState } from "react";
import { useApp } from "@/context/AppContext";

export default function EventsPage({ onAddEvent, onEditEvent }) {
  const { companyEvents, deleteCompanyEvent, isAdmin } = useApp();

  return (
    <section className="dashboard glass-panel fade-in">
      <div className="section-header">
        <h2 className="section-title">📅 Custom Events</h2>
        {isAdmin && (
          <button className="btn btn-primary" onClick={onAddEvent}>
            + Add Event
          </button>
        )}
      </div>

      <div className="holiday-list-grid">
        {companyEvents.length === 0 ? (
          <p className="empty-msg">No custom events recorded.</p>
        ) : (
          companyEvents.map((event) => (
            <div key={event.id} className="holiday-list-item" style={{ borderLeftColor: 'var(--accent-purple)' }}>
              <div className="holiday-info">
                <span className="holiday-date">
                  {new Date(event.date).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  })}
                </span>
                <span className="holiday-title">{event.title}</span>
              </div>
              {isAdmin && (
                <div className="word-actions-inline" style={{ marginLeft: "auto" }}>
                  <button
                    className="btn-delete-holiday"
                    style={{ background: 'transparent', color: 'var(--text-primary)', border: 'none' }}
                    onClick={() => {
                      onEditEvent(event);
                    }}
                    title="Edit Event"
                  >
                    ✏️
                  </button>
                  <button
                    className="btn-delete-holiday"
                    onClick={() => {
                      if (confirm(`Delete event "${event.title}"?`)) {
                        deleteCompanyEvent(event.id);
                      }
                    }}
                    title="Remove Event"
                  >
                    ✕
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}
