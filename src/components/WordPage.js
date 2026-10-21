"use client";

import { useState, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import Icon from "./Icon";
import Avatar from "./Avatar";

// Words.dc.html: the season rail and Top sharers on the left; the season's latest word
// as a hero card, then the rest of the season as a searchable, sortable grid. The page
// heading comes from page.js.

const PAGE_SIZE = 12; // word cards shown before "Show more"
const TOP_SHARERS = 5;

const SORTS = [
  { id: "newest", label: "Newest first" },
  { id: "oldest", label: "Oldest first" },
  { id: "az", label: "A to Z" },
];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Milliseconds since the epoch; 0 for a missing or unreadable date, so it sorts last.
const timeOf = (value) => new Date(value || 0).getTime() || 0;

function readDate(value) {
  const d = new Date(value || "");
  return Number.isNaN(d.getTime()) ? null : d;
}

// "Oct 16", or "Mon, Oct 19" with the weekday; the year only when it is not this year.
function shortDate(value, withWeekday = false) {
  const d = readDate(value);
  if (!d) return "";
  return d.toLocaleDateString("en-US", {
    ...(withWeekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
    ...(d.getFullYear() !== new Date().getFullYear() ? { year: "numeric" } : {}),
  });
}

function monthYear(value) {
  const d = readDate(value);
  return d ? d.toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "";
}

export default function WordPage({ onAddSeason, onAddWord, onEditWord, onEditSeason }) {
  const { wordSeasons, words, deleteWord, seedWordsTable, isAdmin, user, animationsEnabled } = useApp();
  const { confirmDialog } = useDialog();
  const [pickedSeasonId, setPickedSeasonId] = useState(null); // null = follow the latest season
  const [searchTerm, setSearchTerm] = useState("");
  const [sortId, setSortId] = useState("newest");

  // addWord records the sharer as the full name, else the email.
  const me = user?.user_metadata?.full_name || user?.email;
  const isMe = (name) => Boolean(me) && name === me;
  const animated = animationsEnabled !== false;

  const sortedSeasons = useMemo(
    () => [...wordSeasons].sort((a, b) => timeOf(b.created_at) - timeOf(a.created_at)),
    [wordSeasons]
  );
  const activeSeasonId = pickedSeasonId ?? sortedSeasons[0]?.id ?? null;
  const activeSeason = wordSeasons.find((s) => s.id === activeSeasonId);

  // Words per season in one pass, for the rail's meta lines.
  const seasonCounts = useMemo(() => {
    const counts = new Map();
    for (const w of words) counts.set(w.season_id, (counts.get(w.season_id) || 0) + 1);
    return counts;
  }, [words]);

  // The season's words, newest first: the newest is the hero, the rest fill the grid.
  const seasonWords = useMemo(
    () => words
      .filter((w) => w.season_id === activeSeasonId)
      .sort((a, b) => timeOf(b.created_at) - timeOf(a.created_at)),
    [words, activeSeasonId]
  );
  const hero = seasonWords[0];

  const earlier = useMemo(() => {
    let list = seasonWords.slice(1);
    const q = searchTerm.trim().toLowerCase();
    if (q) {
      list = list.filter((w) =>
        (w.word || "").toLowerCase().includes(q) ||
        (w.definition || "").toLowerCase().includes(q) ||
        (w.translation || "").toLowerCase().includes(q)
      );
    }
    if (sortId === "oldest") list.reverse();
    else if (sortId === "az") list.sort((a, b) => (a.word || "").localeCompare(b.word || "", undefined, { sensitivity: "base" }));
    return list;
  }, [seasonWords, searchTerm, sortId]);

  // The grid shows a page at a time; another season, search or sort starts from the first page.
  const listKey = `${activeSeasonId}|${searchTerm}|${sortId}`;
  const [shown, setShown] = useState({ key: listKey, count: PAGE_SIZE });
  const shownCount = shown.key === listKey ? shown.count : PAGE_SIZE;
  const visibleWords = earlier.slice(0, shownCount);
  const moreCount = Math.min(earlier.length - visibleWords.length, PAGE_SIZE);

  const sharers = useMemo(() => {
    const counts = new Map();
    for (const w of seasonWords) {
      if (w.created_by) counts.set(w.created_by, (counts.get(w.created_by) || 0) + 1);
    }
    return [...counts]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, TOP_SHARERS);
  }, [seasonWords]);
  const topCount = sharers[0]?.count || 1;

  // "18 words · since Sep 2026" for the current season. New words always go to the latest
  // season, so an older one ended when the season after it began.
  const seasonMeta = (season, index) => {
    const count = seasonCounts.get(season.id) || 0;
    const parts = [count ? plural(count, "word") : "No words yet"];
    const when = monthYear(index === 0 ? season.created_at : sortedSeasons[index - 1].created_at);
    if (when) parts.push(index === 0 ? `since ${when}` : `ended ${when}`);
    return parts.join(" · ");
  };

  const wordActions = (w, btnClass, iconSize) => (
    <>
      <button
        type="button"
        className={`btn-icon btn-sm ${btnClass}`}
        onClick={() => onEditWord(w)}
        aria-label={`Edit word ${w.word}`}
        title="Edit word"
      >
        <Icon name="edit" size={iconSize} strokeWidth={2} />
      </button>
      <button
        type="button"
        className={`btn-icon btn-sm ${btnClass} word-icon-delete`}
        onClick={async () => {
          if (await confirmDialog("Delete this word?", { danger: true })) deleteWord(w.id);
        }}
        aria-label={`Delete word ${w.word}`}
        title="Delete word"
      >
        <Icon name="trash" size={iconSize} strokeWidth={2} />
      </button>
    </>
  );

  const renderCard = (w) => {
    const date = shortDate(w.created_at);
    return (
      <article key={w.id} className={`word-card glass${animated ? " card-lift" : ""}`}>
        <div className="word-card-head">
          <h3 className="word-card-word">{w.word}</h3>
          {w.phonetic && <span className="word-card-phonetic mono">{w.phonetic}</span>}
        </div>
        {w.translation && <p className="word-card-tr">{w.translation}</p>}
        <p className="word-card-def">{w.definition}</p>
        {w.example && <p className="word-card-example">&ldquo;{w.example}&rdquo;</p>}
        <div className="word-card-foot">
          <Avatar name={w.created_by} isMe={isMe(w.created_by)} className="avatar avatar-sm" aria-hidden="true" />
          <span className="word-card-by">
            {w.created_by}
            {w.created_by && date ? " · " : ""}
            {date && <span className="mono">{date}</span>}
          </span>
          {isAdmin && wordActions(w, "word-card-btn", 14)}
        </div>
      </article>
    );
  };

  return (
    <div className="word-page">
      <aside className="word-aside">
        <nav className="word-rail glass" aria-label="Word seasons">
          <div className="word-rail-head">
            <h2 className="section-title">Seasons</h2>
            {isAdmin && (
              <button type="button" className="btn btn-secondary btn-sm" onClick={onAddSeason}>
                <Icon name="plus" size={14} strokeWidth={2.2} /> New season
              </button>
            )}
          </div>

          {sortedSeasons.length === 0 ? (
            <div className="word-rail-empty">
              <p className="empty-msg">No seasons yet</p>
              {isAdmin && (
                <button type="button" className="btn btn-secondary btn-sm" onClick={seedWordsTable}>
                  Seed Seasons 1 &amp; 2
                </button>
              )}
            </div>
          ) : (
            <div className="word-rail-list">
              {sortedSeasons.map((s, i) => {
                const isActive = s.id === activeSeasonId;
                return (
                  <div key={s.id} className={`word-season${isActive ? " is-active" : ""}`}>
                    <button
                      type="button"
                      className="word-season-btn"
                      aria-pressed={isActive}
                      onClick={() => setPickedSeasonId(s.id)}
                    >
                      <span className="word-season-icon"><Icon name="calendar" size={16} /></span>
                      <span className="word-season-text">
                        <span className="word-season-title">
                          <span className="word-season-name">{s.title}</span>
                          {i === 0 && <span className="pill pill-cyan">Current</span>}
                        </span>
                        <span className="word-season-meta mono">{seasonMeta(s, i)}</span>
                      </span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        className="btn-icon btn-sm word-season-edit"
                        onClick={() => onEditSeason(s)}
                        aria-label={`Edit season ${s.title}`}
                        title="Edit season"
                      >
                        <Icon name="edit" size={15} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </nav>

        {sharers.length > 0 && (
          <section className="word-sharers glass-card" aria-labelledby="word-sharers-title">
            <div className="word-heading">
              <h2 id="word-sharers-title" className="section-title">Top sharers</h2>
              <span className="word-sub">Words shared this season</span>
            </div>
            <ol className="word-sharer-list">
              {sharers.map((p) => (
                <li key={p.name} className="word-sharer">
                  <Avatar name={p.name} isMe={isMe(p.name)} className="avatar word-avatar" aria-hidden="true" />
                  <div className="word-sharer-text">
                    <span className="word-sharer-name">{p.name}</span>
                    <div className="word-sharer-track" aria-hidden="true">
                      <div className="word-sharer-fill" style={{ width: `${(p.count / topCount) * 100}%` }} />
                    </div>
                  </div>
                  <span className="word-sharer-count mono">{p.count}</span>
                </li>
              ))}
            </ol>
          </section>
        )}
      </aside>

      <div className="word-main">
        {!hero ? (
          <div className="word-empty glass-card">
            <span className="word-empty-icon" aria-hidden="true"><Icon name="book" size={22} /></span>
            <p className="empty-msg">No words found in this season yet.</p>
            <button type="button" className="btn btn-primary" onClick={() => onAddWord()}>
              <Icon name="plus" size={16} strokeWidth={2.2} /> Be the first to share!
            </button>
          </div>
        ) : (
          <>
            <section className="word-hero glass" aria-labelledby="word-hero-word">
              <div className="word-hero-strip" aria-hidden="true" />
              <div className="word-hero-body">
                <div className="word-hero-main">
                  <div className="word-hero-top">
                    <span className="eyebrow word-hero-eyebrow">
                      Word of the day{hero.created_at ? ` · ${shortDate(hero.created_at, true)}` : ""}
                    </span>
                    {isAdmin && <div className="word-hero-actions">{wordActions(hero, "word-hero-btn", 15)}</div>}
                  </div>
                  <div className="word-hero-heading">
                    <h2 id="word-hero-word" className="word-hero-word">{hero.word}</h2>
                    {hero.phonetic && <span className="word-hero-phonetic mono">{hero.phonetic}</span>}
                  </div>
                  <p className="word-hero-def">{hero.definition}</p>
                  {hero.example && <blockquote className="word-hero-example">&ldquo;{hero.example}&rdquo;</blockquote>}
                  <div className="word-hero-foot">
                    {hero.created_by && (
                      <>
                        <Avatar name={hero.created_by} isMe={isMe(hero.created_by)} className="avatar word-avatar" aria-hidden="true" />
                        <span className="word-hero-by">Shared by <strong>{hero.created_by}</strong></span>
                      </>
                    )}
                    <span className="word-hero-count mono">Word {seasonWords.length} this season</span>
                  </div>
                </div>
                {hero.translation && (
                  <div className="word-hero-tr">
                    <span className="eyebrow">Translation</span>
                    <span className="word-hero-tr-text">{hero.translation}</span>
                  </div>
                )}
              </div>
            </section>

            <section className="word-history" aria-labelledby="word-history-title">
              <div className="word-history-head">
                <div className="word-heading">
                  <h2 id="word-history-title" className="section-title">Earlier this season</h2>
                  <span className="word-sub">
                    {plural(seasonWords.length, "word")} shared{activeSeason ? ` in ${activeSeason.title}` : ""}
                  </span>
                </div>
                <label className="word-search">
                  <Icon name="search" size={16} strokeWidth={2} />
                  <input
                    type="search"
                    aria-label="Search words"
                    placeholder="Search words..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </label>
                <select
                  className="word-sort"
                  aria-label="Sort words"
                  value={sortId}
                  onChange={(e) => setSortId(e.target.value)}
                >
                  {SORTS.map((s) => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
                {activeSeasonId != null && (
                  <button type="button" className="btn btn-primary" onClick={() => onAddWord()}>
                    <Icon name="plus" size={16} strokeWidth={2.2} /> Add Word
                  </button>
                )}
              </div>

              {visibleWords.length === 0 ? (
                <p className="empty-msg">
                  {searchTerm.trim() ? "No words match your search." : "No earlier words in this season yet."}
                </p>
              ) : (
                <div className="word-grid">{visibleWords.map(renderCard)}</div>
              )}

              {moreCount > 0 && (
                <button
                  type="button"
                  className="btn btn-secondary word-more"
                  onClick={() => setShown({ key: listKey, count: shownCount + PAGE_SIZE })}
                >
                  Show {plural(moreCount, "more word")}
                </button>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
