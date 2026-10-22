"use client";

import { Fragment, useMemo } from "react";
import { useApp } from "@/context/AppContext";
import { parseMarkdown } from "@/lib/taskMarkdown";

// Renders an issue description or comment from the safe Markdown subset in
// src/lib/taskMarkdown.js. Everything is a React element; nothing typed becomes HTML.
// Issue keys open the issue through its shareable link (#issue=KEY), which the Tasks
// tab follows even across projects; @mentions of teammates are highlighted.

function openIssueKey(e, key) {
  e.preventDefault();
  e.stopPropagation();
  const hash = `#issue=${key}`;
  // The same hash again fires no hashchange, so clear it first (as the top bar does).
  if (window.location.hash === hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
  window.location.hash = hash;
}

function Inline({ nodes }) {
  return nodes.map((n, i) => {
    switch (n.t) {
      case "text":
        return <Fragment key={i}>{n.v}</Fragment>;
      case "br":
        return <br key={i} />;
      case "b":
        return <strong key={i}><Inline nodes={n.children} /></strong>;
      case "i":
        return <em key={i}><Inline nodes={n.children} /></em>;
      case "code":
        return <code key={i} className="md-code">{n.v}</code>;
      case "link":
        return (
          <a key={i} href={n.href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            <Inline nodes={n.children} />
          </a>
        );
      case "issue":
        return (
          <a key={i} href={`#issue=${n.key}`} className="md-issue mono" onClick={(e) => openIssueKey(e, n.key)}>
            {n.key}
          </a>
        );
      case "mention":
        return <span key={i} className="md-mention">@{n.name}</span>;
      default:
        return null;
    }
  });
}

export default function TaskMarkdown({ text, className = "" }) {
  const { employees, projects } = useApp();
  const ctx = useMemo(
    () => ({
      names: employees.filter((e) => e.status === "active").map((e) => e.name),
      keys: new Set(projects.map((p) => p.issue_key).filter(Boolean)),
    }),
    [employees, projects]
  );
  const blocks = useMemo(() => parseMarkdown(text, ctx), [text, ctx]);

  return (
    <div className={`md ${className}`.trim()}>
      {blocks.map((b, i) => {
        if (b.type === "code") return <pre key={i} className="md-pre"><code>{b.text}</code></pre>;
        if (b.type === "ul" || b.type === "ol") {
          const List = b.type;
          return (
            <List key={i}>
              {b.items.map((item, j) => (
                <li key={j}><Inline nodes={item} /></li>
              ))}
            </List>
          );
        }
        if (b.type === "quote") return <blockquote key={i}><Inline nodes={b.inlines} /></blockquote>;
        return <p key={i}><Inline nodes={b.inlines} /></p>;
      })}
    </div>
  );
}
