"use client";

import { useApp } from "@/context/AppContext";
import Icon from "@/components/Icon";
import { navGroupsFor } from "@/lib/navigation";

// Left navigation. Tabs are state, not URLs, so every row is a button.
// At phone width it becomes a drawer: `open` slides it in over a scrim.
export default function Sidebar({ activeTab, onSelect, isAdmin, onShowUpdates, onSignOut, open, onClose }) {
  const { standupFines } = useApp();
  const pendingStandup = (standupFines || []).filter((f) => f.status === "unpaid").length;

  const select = (id) => {
    onSelect(id);
    onClose?.();
  };

  return (
    <>
      {open && <div className="app-sidebar-scrim" onClick={onClose} aria-hidden="true" />}
      <aside className={`app-sidebar glass${open ? " is-open" : ""}`}>
        <nav aria-label="Main" className="sidebar-nav">
          <div className="sidebar-brand">
            <img src="/logo.png" alt="" className="sidebar-logo" />
            <div className="sidebar-brand-text">
              <span className="sidebar-brand-name">Heubert Tracker</span>
              <span className="sidebar-brand-sub">team.heubert</span>
            </div>
          </div>

          {navGroupsFor({ isAdmin }).map((group) => (
            <div key={group.id} className="sidebar-group">
              <span className="sidebar-group-label">{group.label}</span>
              {group.items.map((item) => {
                const active = item.id === activeTab;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`sidebar-row${active ? " is-active" : ""}`}
                    aria-current={active ? "page" : undefined}
                    onClick={() => select(item.id)}
                  >
                    <Icon name={item.icon} />
                    <span className="sidebar-row-label">{item.label}</span>
                    {item.id === "standup" && pendingStandup > 0 && (
                      <span className="pill pill-red sidebar-count" aria-label={`${pendingStandup} pending`}>
                        {pendingStandup}
                      </span>
                    )}
                    {active && <span className="sidebar-dot" aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          ))}

          <div className="sidebar-foot">
            <button type="button" className="sidebar-row" onClick={() => select("memories")}>
              <Icon name="image" />
              <span className="sidebar-row-label">Memories</span>
            </button>
            <button
              type="button"
              className="sidebar-row"
              onClick={() => {
                onShowUpdates();
                onClose?.();
              }}
            >
              <Icon name="gift" />
              <span className="sidebar-row-label">What&apos;s new</span>
            </button>
            <button type="button" className="sidebar-row" onClick={onSignOut}>
              <Icon name="logout" />
              <span className="sidebar-row-label">Log Out</span>
            </button>
            <span className="sidebar-status">
              <span className="sidebar-status-dot" aria-hidden="true" />
              Cloud database connected
            </span>
          </div>
        </nav>
      </aside>
    </>
  );
}
