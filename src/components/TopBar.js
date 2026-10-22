"use client";

import { useState, useEffect, useMemo, useRef, useId, useSyncExternalStore } from "react";
import Link from "next/link";
import { useApp } from "@/context/AppContext";
import { supabase } from "@/lib/supabase";
import Icon from "@/components/Icon";
import ThemeToggle from "@/components/ThemeToggle";
import AnimationToggle from "@/components/AnimationToggle";
import { StatusLozenge } from "@/components/TaskBits";
import { TaskWorkflowProvider } from "@/components/TaskWorkflowContext";
import { employeeStatus } from "@/components/EmployeeDetailPanel";
import Avatar from "@/components/Avatar";
import { formatBs } from "@/lib/nepaliDate";
import { issueKey } from "@/lib/taskBoard";
import { normalizeQuery, matchPeople, matchFineRows, taskQuery, searchExamples, noMatchNote } from "@/lib/globalSearch";
import { NOTIFY_DAYS, myFineNotifications, unseenCount, taskNotificationItem, mergeNotifications } from "@/lib/notifications";
import { useTaskNotifications } from "@/lib/useTasks";

const SEARCH_DEBOUNCE_MS = 250;
const TASK_TIMEOUT_MS = 8000;
const TASK_LIMIT = 5;
const TASK_COLUMNS = "id, number, title, status, type, project_id, updated_at";
const QUERY_MAX_LENGTH = 100;
const SEEN_KEY = "heubert-notifications-seen";

// The platform never changes while the page is open, so there is nothing to subscribe
// to; the server snapshot is "not Apple", as Modal.js does for its portal.
const subscribeNever = () => () => {};
const isApplePlatform = () => /Mac|iPhone|iPad|iPod/.test(navigator.userAgent);
const onServer = () => false;

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// When the bell was last opened. Every read and write is guarded: without storage
// (private mode, blocked site data) the bell still works and forgets on reload.
function readSeenAt() {
  try {
    const value = localStorage.getItem(SEEN_KEY);
    return value && Number.isFinite(Date.parse(value)) ? value : null;
  } catch {
    return null;
  }
}

function writeSeenAt(value) {
  try {
    localStorage.setItem(SEEN_KEY, value);
  } catch {
    // Nothing to do: the dot still clears until the page reloads.
  }
}

// "3 Kartik 2083 · Oct 20" for a fine's date.
function fineDate(dateStr) {
  const day = String(dateStr || "").slice(0, 10);
  const parsed = new Date(`${day}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  const monthDay = parsed.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return [formatBs(day), monthDay].filter(Boolean).join(" · ");
}

// One small, capped query per search: tasks are not in AppContext (src/lib/useTasks.js).
// Only issues a link can open are asked for: a number, in a project that has a key and
// is not archived (the Tasks tab cannot open archived projects).
async function searchTasks(request, projects, signal) {
  const openable = projects.filter((p) => p.issue_key && p.status !== "archived");
  let query = supabase.from("tasks").select(TASK_COLUMNS);
  if (request.key) {
    const project = openable.find((p) => p.issue_key === request.key);
    if (!project) return [];
    query = query.eq("project_id", project.id).eq("number", request.number);
  } else {
    if (openable.length === 0) return [];
    query = query
      .in("project_id", openable.map((p) => p.id))
      .not("number", "is", null)
      .ilike("title", `%${request.title}%`)
      .order("updated_at", { ascending: false });
  }
  const { data, error } = await query.limit(TASK_LIMIT).abortSignal(signal);
  if (error) throw error;
  const tasks = data || [];
  // Each project names its own statuses (task_statuses); without them a custom status
  // would show as its raw key. A failed lookup just leaves the built-in names.
  if (tasks.length) {
    const { data: statuses } = await supabase
      .from("task_statuses")
      .select("project_id, key, name, category")
      .in("project_id", [...new Set(tasks.map((t) => t.project_id))])
      .in("key", [...new Set(tasks.map((t) => t.status))])
      .abortSignal(signal);
    for (const t of tasks) {
      const row = (statuses || []).find((r) => r.project_id === t.project_id && r.key === t.status);
      if (row) t.statusWorkflow = [{ value: row.key, label: row.name, category: row.category }];
    }
  }
  return tasks;
}

// An issue opens as a shared link does: page.js and the Tasks tab follow #issue=KEY.
function openIssueLink(key) {
  const hash = `#issue=${key}`;
  // Setting the hash the page already has fires no hashchange, so clear it first.
  if (window.location.hash === hash) {
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
  window.location.hash = hash;
}

// Closes a top-bar dropdown on a mousedown outside `ref`.
function useOutsideClose(ref, open, setOpen) {
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [ref, open, setOpen]);
}

// The bar above every tab: search, Start Meeting, the bell, the theme switch and the
// account menu. onNavigate({ tab: "employees", employeeId }) or
// onNavigate({ tab: "records" | "standup", employeeName, seasonId? }) is page.js's to carry
// out; a bell row about a late fine adds the fine's season (null: none).
export default function TopBar({ onOpenMenu, onNavigate }) {
  const { user, theme, toggleTheme, employees, fines, standupFines, projects, currentEmployee } = useApp();
  const [showPrefs, setShowPrefs] = useState(false);
  const accountRef = useRef(null);
  useOutsideClose(accountRef, showPrefs, setShowPrefs);

  const fullName = user?.user_metadata?.full_name || "";
  const firstName = fullName.split(" ")[0] || user?.email?.split("@")[0] || "";
  const isLight = theme === "light";
  const isApple = useSyncExternalStore(subscribeNever, isApplePlatform, onServer);

  // ── Search ────────────────────────────────────────────────────────────────
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [taskResult, setTaskResult] = useState({ key: "", tasks: [] });
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const listId = useId();

  const q = normalizeQuery(query);
  // Focus opens the panel: a guide to what the search finds while the field is empty,
  // the results once something is typed.
  const listOpen = searchOpen && q !== "";
  useOutsideClose(searchRef, searchOpen, setSearchOpen);

  const people = useMemo(() => matchPeople(employees, q), [employees, q]);
  const fineRows = useMemo(
    () => matchFineRows({ fines, standupFines, employees, query: q }),
    [fines, standupFines, employees, q]
  );
  const projectById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const examples = useMemo(
    () => searchExamples({ employees, fines, standupFines, projects }),
    [employees, fines, standupFines, projects]
  );
  const exampleKey = examples.find((e) => e.kind === "task")?.query || "HTT-12";

  // What the tasks table would be asked, as a string: the query below re-runs only when
  // that changes, so a trailing space costs nothing.
  const taskRequest = taskQuery(query);
  const taskKey = taskRequest ? JSON.stringify(taskRequest) : "";

  useEffect(() => {
    if (!taskKey) return;
    let live = true;
    let giveUp = null;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      giveUp = setTimeout(() => controller.abort(), TASK_TIMEOUT_MS);
      searchTasks(JSON.parse(taskKey), projects, controller.signal)
        // A failed or timed-out search shows no tasks group, never an error.
        .catch(() => [])
        .then((tasks) => {
          clearTimeout(giveUp);
          if (live) setTaskResult({ key: taskKey, tasks });
        });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
      clearTimeout(giveUp);
      controller.abort();
    };
  }, [taskKey, projects]);

  const tasksPending = taskKey !== "" && taskResult.key !== taskKey;
  const tasks = taskKey !== "" && taskResult.key === taskKey ? taskResult.tasks : [];

  // Every row in one list, so the arrow keys move through all of them; each group
  // remembers where its rows start.
  const groups = [];
  const options = [];
  const addGroup = (id, label, items) => {
    if (items.length === 0) return;
    groups.push({ id, label, start: options.length, items });
    options.push(...items);
  };
  addGroup("people", "People", people.map((employee) => ({ key: `person-${employee.id}`, type: "person", employee })));
  addGroup("fines", "Fines", fineRows.map((row) => ({ key: `${row.kind}-${row.name}`, type: "fine", row })));
  addGroup(
    "tasks",
    "Tasks",
    tasks
      .filter((task) => projectById.get(task.project_id)?.issue_key && task.number != null)
      .map((task) => ({ key: `task-${task.id}`, type: "task", task, issue: issueKey(projectById.get(task.project_id), task) }))
  );

  // The first row is highlighted until the arrows or the mouse pick another.
  const active = listOpen && options.length > 0 ? Math.min(Math.max(activeIndex, 0), options.length - 1) : -1;
  const optionId = (index) => `${listId}-option-${index}`;

  let note = "";
  if (tasksPending) note = "Searching tasks…";
  else if (options.length === 0) note = noMatchNote(query);
  const noMatches = listOpen && !tasksPending && options.length === 0;

  // An example fills the field and keeps focus there, so its results show at once.
  const tryExample = (text) => {
    setQuery(text);
    setActiveIndex(0);
    setSearchOpen(true);
    inputRef.current?.focus();
  };

  const choose = (option) => {
    setQuery("");
    setSearchOpen(false);
    setActiveIndex(0);
    inputRef.current?.blur();
    if (option.type === "person") {
      onNavigate?.({ tab: "employees", employeeId: option.employee.id });
    } else if (option.type === "fine") {
      onNavigate?.({ tab: option.row.kind === "late" ? "records" : "standup", employeeName: option.row.name });
    } else {
      openIssueLink(option.issue);
    }
  };

  const moveTo = (index) => {
    setActiveIndex(index);
    document.getElementById(optionId(index))?.scrollIntoView({ block: "nearest" });
  };

  const handleSearchKeyDown = (e) => {
    if (e.nativeEvent.isComposing) return;
    switch (e.key) {
      case "ArrowDown":
      case "ArrowUp": {
        if (!q) return;
        e.preventDefault();
        setSearchOpen(true);
        if (options.length === 0) return;
        const last = options.length - 1;
        if (!listOpen) moveTo(e.key === "ArrowDown" ? 0 : last);
        else if (e.key === "ArrowDown") moveTo(active >= last ? 0 : active + 1);
        else moveTo(active <= 0 ? last : active - 1);
        return;
      }
      case "Enter":
        if (active < 0) return;
        e.preventDefault();
        choose(options[active]);
        return;
      case "Escape":
        // Kept from the browser, which would clear a search field, and from page-wide
        // Escape handlers (the retro board's drops a card being written): the first
        // Escape closes the panel (results or guide), the second leaves the field.
        e.preventDefault();
        e.stopPropagation();
        if (searchOpen) setSearchOpen(false);
        else e.currentTarget.blur();
        return;
      default:
    }
  };

  // Focus leaving the field and its panel (Tab past an example, a click elsewhere)
  // closes the panel; moving between them keeps it open.
  const handleSearchBlur = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setSearchOpen(false);
  };

  const handlePanelKeyDown = (e) => {
    if (e.key !== "Escape") return;
    e.preventDefault();
    e.stopPropagation();
    setSearchOpen(false);
    inputRef.current?.focus();
  };

  const shortcut = isApple ? "⌘K" : "Ctrl K";

  // Ctrl+K (⌘K on Apple) focuses the search from anywhere in the app shell. Below 900px
  // the field is hidden, and an open dialog keeps the keyboard: then the browser keeps
  // its own shortcut.
  useEffect(() => {
    const handleShortcut = (e) => {
      if ((e.key || "").toLowerCase() !== "k" || e.altKey || e.shiftKey) return;
      if (!(isApple ? e.metaKey : e.ctrlKey)) return;
      const input = inputRef.current;
      if (!input || input.getClientRects().length === 0 || document.querySelector(".modal-overlay")) return;
      e.preventDefault();
      input.focus();
      input.select();
      setSearchOpen(true);
    };
    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, [isApple]);

  const renderOption = (option, index) => {
    const isActive = index === active;
    let body;
    if (option.type === "person") {
      const { employee } = option;
      const status = employeeStatus(employee);
      const email = employee.work_email || employee.personal_email;
      body = (
        <>
          <Avatar name={employee.name} className="avatar" aria-hidden="true" />
          <span className="topbar-row-text">
            <span className="topbar-row-title">{employee.name}</span>
            {email && <span className="topbar-row-sub mono">{email}</span>}
          </span>
          {status.id === "resigned" && <span className={`pill ${status.pill}`}>{status.label}</span>}
        </>
      );
    } else if (option.type === "fine") {
      const { row } = option;
      const late = row.kind === "late";
      body = (
        <>
          <span className="topbar-row-icon" aria-hidden="true">
            <Icon name={late ? "wallet" : "clipboard"} size={16} />
          </span>
          <span className="topbar-row-text">
            <span className="topbar-row-title">
              {late ? "Late fines" : "Standup fines"} · {row.name}
            </span>
            <span className="topbar-row-sub mono">
              {plural(row.count, "record")} · {late ? `${rs(row.unpaidAmount)} unpaid` : `${row.unpaidCount} pending`}
            </span>
          </span>
        </>
      );
    } else {
      body = (
        <>
          <span className="issue-key-text">{option.issue}</span>
          <span className="topbar-row-title">{option.task.title}</span>
          {option.task.statusWorkflow ? (
            <TaskWorkflowProvider value={option.task.statusWorkflow}>
              <StatusLozenge status={option.task.status} />
            </TaskWorkflowProvider>
          ) : (
            <StatusLozenge status={option.task.status} />
          )}
        </>
      );
    }
    return (
      <div
        key={option.key}
        id={optionId(index)}
        role="option"
        aria-selected={isActive}
        className={`topbar-row${isActive ? " is-active" : ""}`}
        onMouseEnter={() => setActiveIndex(index)}
        onClick={() => choose(option)}
      >
        {body}
      </div>
    );
  };

  // ── Bell ──────────────────────────────────────────────────────────────────
  const [notifyOpen, setNotifyOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(readSeenAt);
  // The seen time from before this opening, so rows that were new still say so.
  const [openedSeenAt, setOpenedSeenAt] = useState(null);
  const notifyRef = useRef(null);
  const bellRef = useRef(null);
  const notifyId = useId();
  useOutsideClose(notifyRef, notifyOpen, setNotifyOpen);

  // You, as AppContext finds you: by work or personal email, ignoring case.
  const me = useMemo(() => {
    if (currentEmployee) return currentEmployee;
    const email = user?.email?.toLowerCase();
    if (!email) return null;
    return (
      employees.find((e) => e.work_email?.toLowerCase() === email || e.personal_email?.toLowerCase() === email) || null
    );
  }, [currentEmployee, user, employees]);

  // Task notifications (assigned, mentioned, comments and status changes on issues you
  // watch) come from the database; fines are worked out from AppContext as before.
  const taskNotes = useTaskNotifications(Boolean(me));
  const notifications = useMemo(
    () =>
      mergeNotifications(
        myFineNotifications({
          fines,
          standupFines,
          name: me?.name,
          now: new Date(),
          lateExcluded: Boolean(me?.late_fine_excluded),
          standupExcluded: Boolean(me?.standup_fine_excluded),
        }),
        taskNotes.items
          .filter((n) => n.task && projectById.get(n.task.project_id)?.issue_key)
          .map((n) => taskNotificationItem(n, issueKey(projectById.get(n.task.project_id), n.task)))
      ),
    [fines, standupFines, me, taskNotes.items, projectById]
  );
  const unseen = unseenCount(notifications, seenAt);

  const toggleNotify = () => {
    if (notifyOpen) {
      setNotifyOpen(false);
      return;
    }
    const now = new Date().toISOString();
    setOpenedSeenAt(seenAt);
    setSeenAt(now);
    writeSeenAt(now);
    setNotifyOpen(true);
    setShowPrefs(false);
    // Seen once the bell is opened, as fines already are.
    taskNotes.markRead(notifications.filter((n) => n.kind === "task" && !n.read).map((n) => n.notificationId));
  };

  const openNotification = (item) => {
    setNotifyOpen(false);
    if (item.kind === "task") {
      openIssueLink(item.issueKey);
      return;
    }
    if (item.kind === "late") onNavigate?.({ tab: "records", employeeName: me?.name, seasonId: item.seasonId });
    else onNavigate?.({ tab: "standup", employeeName: me?.name });
  };

  const handleNotifyKeyDown = (e) => {
    if (e.key !== "Escape" || !notifyOpen) return;
    e.preventDefault();
    e.stopPropagation();
    setNotifyOpen(false);
    bellRef.current?.focus();
  };

  return (
    <header className="app-topbar glass">
      <button type="button" className="btn-icon topbar-menu" aria-label="Open menu" onClick={onOpenMenu}>
        <Icon name="menu" />
      </button>

      <div className="topbar-search" ref={searchRef} onBlur={handleSearchBlur}>
        <label className="topbar-search-field">
          <Icon name="search" size={16} strokeWidth={2} />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-label="Search"
            aria-expanded={listOpen}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? optionId(active) : undefined}
            aria-keyshortcuts={isApple ? "Meta+K" : "Control+K"}
            placeholder={`Search people, fines or tasks (name or ${exampleKey})`}
            autoComplete="off"
            spellCheck={false}
            maxLength={QUERY_MAX_LENGTH}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSearchOpen(true);
              setActiveIndex(0);
            }}
            onFocus={() => {
              setSearchOpen(true);
              setNotifyOpen(false);
              setShowPrefs(false);
            }}
            // A click in the field it already has focus in (after Escape) reopens it.
            onClick={() => setSearchOpen(true)}
            onKeyDown={handleSearchKeyDown}
          />
          <kbd>{shortcut}</kbd>
        </label>
        {/* mousedown keeps focus in the field, so a click on a row is not a blur first. */}
        <div
          className="topbar-panel topbar-results"
          hidden={!searchOpen}
          onMouseDown={(e) => e.preventDefault()}
          onKeyDown={handlePanelKeyDown}
        >
          {q === "" && (
            <div className="topbar-guide">
              <div className="topbar-results-label">Search finds</div>
              <ul className="topbar-guide-list">
                <li>
                  <span className="topbar-row-icon" aria-hidden="true">
                    <Icon name="user" size={16} />
                  </span>
                  <span className="topbar-row-text">
                    <span className="topbar-row-title">People</span>
                    <span className="topbar-guide-sub">By name or email · opens their details</span>
                  </span>
                </li>
                <li>
                  <span className="topbar-row-icon" aria-hidden="true">
                    <Icon name="wallet" size={16} />
                  </span>
                  <span className="topbar-row-text">
                    <span className="topbar-row-title">Fines</span>
                    <span className="topbar-guide-sub">By the person&apos;s name · opens their Late or Standup fines</span>
                  </span>
                </li>
                <li>
                  <span className="topbar-row-icon" aria-hidden="true">
                    <Icon name="kanban" size={16} />
                  </span>
                  <span className="topbar-row-text">
                    <span className="topbar-row-title">Tasks</span>
                    <span className="topbar-guide-sub">
                      By key like <span className="mono">{exampleKey}</span> or words from the title · opens the issue
                    </span>
                  </span>
                </li>
              </ul>
              {examples.length > 0 && (
                <div className="topbar-guide-try">
                  <span className="topbar-guide-try-label">Try</span>
                  {examples.map((example) => (
                    <button
                      key={example.kind}
                      type="button"
                      className="topbar-guide-chip"
                      onClick={() => tryExample(example.query)}
                    >
                      <span className={example.kind === "task" ? "mono" : undefined}>{example.query}</span>
                      <span className="topbar-guide-chip-kind">
                        {example.kind === "person" ? "person" : example.kind === "fine" ? "fines" : "issue"}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="topbar-guide-foot">
                <kbd>{shortcut}</kbd> searches from anywhere · <kbd>↑</kbd> <kbd>↓</kbd> to move · <kbd>Enter</kbd> to open
              </p>
            </div>
          )}
          <div id={listId} role="listbox" aria-label="Search results">
            {groups.map((group) => (
              <div key={group.id} role="group" aria-labelledby={`${listId}-${group.id}`}>
                <div id={`${listId}-${group.id}`} role="presentation" className="topbar-results-label">
                  {group.label}
                </div>
                {group.items.map((option, i) => renderOption(option, group.start + i))}
              </div>
            ))}
          </div>
          <p className="topbar-results-note" role="status">
            {listOpen ? note : ""}
          </p>
          {noMatches && (
            <p className="topbar-results-hint">
              Try a first name, an email, an issue key like <span className="mono">{exampleKey}</span> or a word from a task title.
            </p>
          )}
        </div>
      </div>

      <div className="topbar-right">
        <Link href="/meeting" className="btn btn-orange topbar-meeting" aria-label="Start Meeting">
          <Icon name="video" size={16} strokeWidth={2.2} />
          <span className="topbar-meeting-text">Start Meeting</span>
        </Link>

        <div className="topbar-notify" ref={notifyRef} onKeyDown={handleNotifyKeyDown}>
          <button
            ref={bellRef}
            type="button"
            className="btn-icon topbar-bell"
            aria-label={unseen > 0 ? `Notifications, ${unseen} new` : "Notifications"}
            aria-expanded={notifyOpen}
            aria-controls={notifyId}
            onClick={toggleNotify}
          >
            <Icon name="bell" />
            {unseen > 0 && <span className="topbar-bell-dot" aria-hidden="true" />}
          </button>
          <div
            id={notifyId}
            className="topbar-panel topbar-notify-panel"
            role="group"
            aria-labelledby={`${notifyId}-title`}
            hidden={!notifyOpen}
          >
            <div id={`${notifyId}-title`} className="settings-dropdown-title">
              Notifications
            </div>
            {notifications.length === 0 ? (
              <p className="topbar-notify-empty">
                Nothing new. Issues assigned to you, mentions, and fines from the last {NOTIFY_DAYS} days show here.
              </p>
            ) : (
              <ul className="topbar-notify-list">
                {notifications.map((item) => {
                  if (item.kind === "task") {
                    const icon = item.taskKind === "assigned" ? "user" : item.taskKind === "status" ? "refresh" : "message";
                    return (
                      <li key={item.id}>
                        <button type="button" className="topbar-row topbar-notify-row" onClick={() => openNotification(item)}>
                          <span className="topbar-row-icon" aria-hidden="true">
                            <Icon name={icon} size={16} />
                          </span>
                          <span className="topbar-row-text">
                            <span className="topbar-row-title">{item.text}</span>
                            <span className="topbar-row-sub">{item.sub}</span>
                          </span>
                          {unseenCount([item], openedSeenAt) > 0 && (
                            <span className="topbar-notify-new">
                              <span className="topbar-hidden-label">New</span>
                            </span>
                          )}
                          <span className="pill pill-blue mono">{item.issueKey}</span>
                        </button>
                      </li>
                    );
                  }
                  const late = item.kind === "late";
                  const paid = item.status === "paid";
                  return (
                    <li key={item.id}>
                      <button type="button" className="topbar-row topbar-notify-row" onClick={() => openNotification(item)}>
                        <span className="topbar-row-icon" aria-hidden="true">
                          <Icon name={late ? "wallet" : "clipboard"} size={16} />
                        </span>
                        <span className="topbar-row-text">
                          <span className="topbar-row-title">{late ? `Late fine · ${rs(item.amount)}` : "Standup contribution"}</span>
                          <span className="topbar-row-sub mono">{fineDate(item.date)}</span>
                        </span>
                        {unseenCount([item], openedSeenAt) > 0 && (
                          <span className="topbar-notify-new">
                            <span className="topbar-hidden-label">New</span>
                          </span>
                        )}
                        <span className={`pill ${paid ? "pill-green" : "pill-amber"}`}>
                          {late ? (paid ? "Paid" : "Unpaid") : paid ? "Complete" : "Pending"}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <button
          type="button"
          className="btn-icon"
          aria-label={isLight ? "Switch to dark theme" : "Switch to light theme"}
          onClick={toggleTheme}
        >
          <Icon name={isLight ? "moon" : "sun"} />
        </button>

        {user && (
          <div className="topbar-account" ref={accountRef}>
            <button
              type="button"
              className="topbar-account-btn"
              aria-label="Account and preferences"
              aria-expanded={showPrefs}
              onClick={() => setShowPrefs((s) => !s)}
            >
              <Avatar name={fullName || firstName} isMe className="avatar" />
              <span className="topbar-account-name">{firstName}</span>
              <Icon name="chevron-down" size={16} />
            </button>
            {showPrefs && (
              <div className="settings-dropdown">
                <div className="settings-dropdown-title">Preferences</div>
                <ThemeToggle />
                <AnimationToggle />
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
