"use client";

import { useState, useEffect } from "react";
import Icon from "@/components/Icon";
import { supabase } from "@/lib/supabase";

// What's new: the tracker on a desktop and a phone, feature by feature, and the release notes.
// Content and screenshots come from /api/whats-new (whats-new/ in the repo, updated when web or
// mobile ships); screenshot links are signed and expire, so they load as plain <img>s for
// signed-in employees only.

const VIEWS = [
  { value: "features", label: "Features" },
  { value: "updates", label: "Updates" },
];
const PLATFORM_LABEL = { web: "Web", mobile: "Mobile" };

// How long the showcase stays on a feature before moving to the next.
const SHOWCASE_MS = 5000;

const eyebrowFor = (f) => (f.onWeb && f.onMobile ? "On desktop and mobile" : f.onWeb ? "Only on the web" : "Only in the mobile app");

// One device's screen: the feature's screenshot, or why there is none.
function DeviceScreen({ feature, platform, onZoom, className }) {
  const shot = feature[platform];
  const available = platform === "web" ? feature.onWeb : feature.onMobile;
  const device = platform === "web" ? "desktop" : "mobile";
  if (!shot) {
    return (
      <span className={`${className} whatsnew-screen-empty`}>
        {available ? "Screenshot coming soon" : `Not in the ${platform} app`}
      </span>
    );
  }
  return (
    <button type="button" className={`${className} whatsnew-screen-btn`} onClick={() => onZoom(feature, platform)} aria-label={`Enlarge ${feature.title} on ${device}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a signed, expiring link */}
      <img key={feature.id} src={shot} alt={`${feature.title} on ${device}`} />
    </button>
  );
}

// The Features tab: the tracker on a desktop monitor with a phone in front of it, the same
// feature on both, moving through every feature; hovering pauses it, a chip picks one, and a
// click on either screen enlarges it.
function Showcase({ features, onZoom }) {
  const shown = features.filter((f) => f.web || f.mobile);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  // A fresh SHOWCASE_MS after every change, so a picked feature gets its full time.
  useEffect(() => {
    if (paused || shown.length < 2) return;
    const t = setTimeout(() => setIndex((i) => (i + 1) % shown.length), SHOWCASE_MS);
    return () => clearTimeout(t);
  }, [paused, index, shown.length]);

  if (shown.length === 0) return <p className="changelog-state empty-msg">No screenshots yet.</p>;
  const current = shown[index % shown.length];

  return (
    <section className="whatsnew-showcase" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} aria-label="The tracker on desktop and mobile">
      <div className="whatsnew-devices">
        <div className="whatsnew-desktop">
          <DeviceScreen feature={current} platform="web" onZoom={onZoom} className="whatsnew-desktop-screen" />
          <span className="whatsnew-desktop-stand" aria-hidden="true" />
        </div>
        <div className="whatsnew-phone">
          <DeviceScreen feature={current} platform="mobile" onZoom={onZoom} className="whatsnew-phone-screen" />
        </div>
      </div>
      <div className="whatsnew-showcase-text">
        <span className="eyebrow">{eyebrowFor(current)}</span>
        <h3>{current.title}</h3>
        <p>{current.summary}</p>
        <div className="whatsnew-showcase-chips">
          {shown.map((f, i) => (
            <button
              key={f.id}
              type="button"
              className={`whatsnew-chip ${i === index % shown.length ? "is-active" : ""}`}
              aria-pressed={i === index % shown.length}
              onClick={() => setIndex(i)}
            >
              {f.title}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

const releaseDate = (ymd) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });

export default function ReleaseUpdatesModal({ isOpen, onClose }) {
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("features");
  const [zoomed, setZoomed] = useState(null); // { feature, platform } of the enlarged screenshot

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    (async () => {
      setIsLoading(true);
      setError("");
      try {
        const { data: auth } = await supabase.auth.getSession();
        const token = auth?.session?.access_token;
        const res = await fetch("/api/whats-new", { headers: token ? { Authorization: `Bearer ${token}` } : {} });
        if (!res.ok) throw new Error();
        const body = await res.json();
        if (!cancelled) setData(body);
      } catch {
        if (!cancelled) setError("Couldn't load what's new. Try again in a moment.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (zoomed) setZoomed(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, zoomed, onClose]);

  if (!isOpen) return null;

  const features = data?.features || [];
  const releases = data?.releases || [];

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 9999 }}>
      <div className="modal-content changelog-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="modal-icon"><Icon name="gift" size={20} /></span>
          <h2>What&apos;s new</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
        </div>

        <div className="whatsnew-toolbar">
          <div className="status-tabs" role="tablist">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                type="button"
                role="tab"
                aria-selected={view === v.value}
                className={`tab ${view === v.value ? "tab-active" : ""}`}
                onClick={() => setView(v.value)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="changelog-body">
          {isLoading ? (
            <div className="changelog-state empty-msg" role="status">
              <span className="spinner" aria-hidden="true" />
              Loading what&apos;s new…
            </div>
          ) : error ? (
            <p className="changelog-state empty-msg">{error}</p>
          ) : view === "features" ? (
            <Showcase features={features} onZoom={(feature, on) => setZoomed({ feature, platform: on })} />
          ) : releases.length === 0 ? (
            <p className="changelog-state empty-msg">No release notes yet.</p>
          ) : (
            <ol className="changelog-days">
              {releases.map((r) => (
                <li key={`${r.date}-${r.title}`} className="changelog-row">
                  <div className="changelog-row-head">
                    <span className="eyebrow">{releaseDate(r.date)}</span>
                    <span className="whatsnew-platforms">
                      {(r.platforms || []).map((p) => (
                        <span key={p} className={`pill ${p === "mobile" ? "pill-violet" : "pill-blue"}`}>
                          {PLATFORM_LABEL[p] || p}
                        </span>
                      ))}
                    </span>
                  </div>
                  <h4 className="changelog-subject">{r.title}</h4>
                  <ul className="whatsnew-notes">
                    {(r.notes || []).map((n, i) => (
                      <li key={i}>{n}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>

        {zoomed && zoomed.feature[zoomed.platform] && (
          <div className="whatsnew-zoom" onClick={() => setZoomed(null)} role="dialog" aria-label={zoomed.feature.title}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a signed, expiring link */}
            <img
              src={zoomed.feature[zoomed.platform]}
              alt={`${zoomed.feature.title} in the ${PLATFORM_LABEL[zoomed.platform].toLowerCase()} app`}
            />
            <span className="whatsnew-zoom-caption">{zoomed.feature.title} · click anywhere to close</span>
          </div>
        )}
      </div>
    </div>
  );
}
