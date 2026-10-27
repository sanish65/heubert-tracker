"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import { useTasks, movedIssueOf } from "@/lib/useTasks";
import { getNepalDateStr } from "@/lib/attendanceTime";
import { issueKey, parseIssueKey, suggestProjectKey, validateProjectKey, activeSprintOf, boardIssues, filterIssues, assigneesOf } from "@/lib/taskBoard";
import { compileQuery } from "@/lib/taskQuery";
import TaskBoardView from "@/components/TaskBoardView";
import TaskIssuesView from "@/components/TaskIssuesView";
import TaskFilterBar from "@/components/TaskFilterBar";
import { TaskWorkflowProvider } from "@/components/TaskWorkflowContext";
import TaskBacklogView from "@/components/TaskBacklogView";
import TaskReportsView from "@/components/TaskReportsView";
import TaskReleasesView from "@/components/TaskReleasesView";
import TaskBoardSettings from "@/components/TaskBoardSettings";
import TaskIssueModal from "@/components/TaskIssueModal";
import TaskCreateModal from "@/components/TaskCreateModal";
import { SprintFormModal, CompleteSprintModal } from "@/components/TaskSprintModals";

const PROJECT_KEY = "heubert-tasks-project";
const VIEW_KEY = "heubert-tasks-view";
const VIEWS = [
  { value: "board", label: "Board" },
  { value: "backlog", label: "Backlog" },
  { value: "issues", label: "Issues" },
  { value: "releases", label: "Releases" },
  { value: "reports", label: "Reports" },
];
const FILTERS_WITH = new Set(["board", "backlog", "issues"]);

function readStored(key, fallback) {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {}
}

// "#issue=HTT-12" — the shareable form of an issue link.
function readHashIssueKey() {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(/^#issue=([A-Za-z0-9-]+)$/);
  return match ? parseIssueKey(match[1]) : null;
}

function setHashIssue(key) {
  const url = key ? `#issue=${key}` : `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, "", url);
}

function isTypingTarget(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

function ProjectKeySetup({ project, projects }) {
  const { isAdmin, setProjectIssueKey } = useApp();
  const taken = projects.filter((p) => p.id !== project.id && p.issue_key).map((p) => p.issue_key);
  const [value, setValue] = useState(() => suggestProjectKey(project.name, taken));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!isAdmin) {
    return (
      <div className="tasks-empty-state glass">
        <div className="tasks-empty-icon"><Icon name="key" size={22} /></div>
        <h3>{project.name} isn&apos;t set up for issues yet</h3>
        <p>An admin needs to give it an issue key (like HTT) before issues can be created.</p>
      </div>
    );
  }

  const save = async (e) => {
    e.preventDefault();
    const key = value.trim().toUpperCase();
    const problem = validateProjectKey(key, taken);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    const { error: dbError } = await setProjectIssueKey(project.id, key);
    setSaving(false);
    if (dbError) setError(dbError.message || "Something went wrong");
  };

  return (
    <form className="tasks-empty-state glass" onSubmit={save}>
      <div className="tasks-empty-icon"><Icon name="key" size={22} /></div>
      <h3>Choose an issue key for {project.name}</h3>
      <p>Every issue gets this prefix and a number, like <strong>{value || "KEY"}-1</strong>. Pick something short; it shows up everywhere.</p>
      <div className="tasks-key-row">
        <input
          className="tasks-key-input"
          value={value}
          maxLength={10}
          onChange={(e) => {
            setValue(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""));
            setError("");
          }}
          autoFocus
        />
        <button className="btn btn-primary" disabled={saving}>{saving ? "Saving..." : "Save key"}</button>
      </div>
      {error && <p className="form-error">{error}</p>}
    </form>
  );
}

// Tasks made on the first board had no project. They can't be edited until they have
// one (the database requires it), so they get their own small filing step.
function FileUnfiledModal({ task, projects, board, onClose }) {
  const { alertDialog } = useDialog();
  const keyed = projects.filter((p) => p.issue_key && p.status !== "archived");
  const [projectId, setProjectId] = useState(keyed[0]?.id ?? "");
  const [saving, setSaving] = useState(false);

  const file = async () => {
    if (!projectId) return;
    setSaving(true);
    const { error } = await board.updateIssue(task.id, { project_id: Number(projectId) });
    setSaving(false);
    if (error) {
      await alertDialog(`Couldn't file the task: ${error.message}`, { tone: "error" });
      return;
    }
    onClose();
  };

  return (
    <Modal isOpen onClose={onClose}>
      <div className="modal-header">
        <h2>File “{task.title}”</h2>
        <button className="modal-close" onClick={onClose} aria-label="Close"><Icon name="x" size={18} /></button>
      </div>
      <p className="sprint-modal-note">Pick the project this task belongs to. It gets that project&apos;s next issue number and lands in its backlog.</p>
      {keyed.length === 0 ? (
        <p className="form-error">No project has an issue key yet. Set one up first.</p>
      ) : (
        <div className="form-group-interactive">
          <label>Project</label>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {keyed.map((p) => (
              <option key={p.id} value={p.id}>{p.issue_key} · {p.name}</option>
            ))}
          </select>
        </div>
      )}
      <div className="modal-actions">
        <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={file} disabled={saving || !projectId}>{saving ? "Filing..." : "File task"}</button>
      </div>
    </Modal>
  );
}

function ProjectWorkspace({ project, projects, view, setView, issueLink }) {
  const { employees, currentEmployee, isAdmin } = useApp();
  const board = useTasks(project.id);
  const { tasks, sprints, versions, unfiled, isLoading, loadError, hasLoaded } = board;
  const isKanban = project.board_mode === "kanban";
  const [showBoardSettings, setShowBoardSettings] = useState(false);
  const today = getNepalDateStr(new Date());
  const searchRef = useRef(null);

  const [search, setSearch] = useState("");
  const [onlyMine, setOnlyMine] = useState(false);
  const [recent, setRecent] = useState(false);
  const [types, setTypes] = useState([]);
  // The avatars picked over the board; null is Unassigned.
  const [assignees, setAssignees] = useState([]);
  const [searchMode, setSearchMode] = useState("basic");
  const [jqlText, setJqlText] = useState("");
  const [activeFilterId, setActiveFilterId] = useState(null);
  // Relative dates in a query ("updated >= -7d") count from when the project was opened.
  const [nowMs] = useState(() => Date.now());

  const [openIssueId, setOpenIssueId] = useState(null);
  const [pendingNumber, setPendingNumber] = useState(issueLink?.number ?? null);
  // A new link arriving while this project is already open (hashchange) re-arms it, even
  // one naming the issue it opened before: every arrival is a new { key, number } object.
  const [seenLink, setSeenLink] = useState(issueLink);
  if (issueLink !== seenLink) {
    setSeenLink(issueLink);
    if (issueLink) setPendingNumber(issueLink.number);
  }
  const [createDefaults, setCreateDefaults] = useState(null);
  const [createKey, setCreateKey] = useState(0);
  const [sprintModal, setSprintModal] = useState(null); // { mode, sprint, issueCount }
  const [completing, setCompleting] = useState(null);
  const [filing, setFiling] = useState(null);

  const employeesById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const tasksById = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);
  const keyOf = (t) => issueKey(project, t);
  const compiled = compileQuery(searchMode === "jql" ? jqlText : "", {
    me: currentEmployee?.id ?? null,
    employees,
    employeesById,
    sprints,
    versions,
    workflow: board.workflow,
    tasks,
    tasksById,
    keyOf,
    nowMs,
    todayStr: today,
  });
  // JQL replaces the basic search while it's on; a query that doesn't parse yet filters
  // nothing, so the board doesn't empty out mid-word.
  const filters =
    searchMode === "jql"
      ? { predicate: compiled.ok && !compiled.empty ? compiled.predicate : null }
      : { search, onlyMine, recent, types, assignees };

  // A link's number that isn't in this project: looked up among moved issues (below).
  const [movedNumber, setMovedNumber] = useState(null);

  // A shared link names an issue by number; open it once this project's issues arrive.
  // Resolved during render rather than in an effect, so there's no extra pass.
  if (pendingNumber != null && !isLoading) {
    const match = tasks.find((t) => t.number === pendingNumber);
    setPendingNumber(null);
    if (match) setOpenIssueId(match.id);
    else setMovedNumber(pendingNumber);
  }

  // Not here: the issue may have moved to another project since the link was shared. Its
  // old key then leads to its new one, as in Jira.
  useEffect(() => {
    if (movedNumber == null) return;
    let cancelled = false;
    movedIssueOf(project.id, movedNumber).then((moved) => {
      const home = moved && projects.find((p) => p.id === moved.project_id);
      if (!cancelled && home?.issue_key) window.location.hash = `issue=${issueKey(home, moved)}`;
    });
    return () => {
      cancelled = true;
    };
  }, [movedNumber, project.id, projects]);

  // `known` is the issue itself when the caller has it before this list does (a clone
  // that was just created), so the address bar still points at the right issue.
  const openIssue = (id, known) => {
    setOpenIssueId(id);
    const task = known || tasks.find((t) => t.id === id);
    if (task) setHashIssue(issueKey(project, task));
  };

  const closeIssue = () => {
    setOpenIssueId(null);
    setHashIssue(null);
  };

  const activeSprint = isKanban ? null : activeSprintOf(sprints);

  // From the board, new issues go into the active sprint; elsewhere, the backlog.
  const createDefaultsFor = () => ({ sprint_id: view === "board" ? activeSprint?.id ?? null : null });
  const openCreate = (defaults = createDefaultsFor()) => {
    setCreateDefaults(defaults);
    setCreateKey((k) => k + 1);
  };

  // The shortcut handler is registered once, so it reads the current defaults by ref.
  const createDefaultsRef = useRef(createDefaultsFor);
  useEffect(() => {
    createDefaultsRef.current = createDefaultsFor;
  });

  // Jira's shortcuts: c creates, / jumps to search. Ignored while typing or in a dialog.
  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return;
      if (document.querySelector(".modal-overlay")) return;
      if (e.key === "c") {
        e.preventDefault();
        setCreateDefaults(createDefaultsRef.current());
        setCreateKey((k) => k + 1);
      } else if (e.key === "/" && searchRef.current) {
        e.preventDefault();
        searchRef.current.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const toggleType = (value) => setTypes((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]));
  const toggleAssignee = (id) => setAssignees((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  const basic = {
    search, setSearch, onlyMine, setOnlyMine, recent, setRecent, types, toggleType,
    ...assigneesOf(tasks, employeesById, currentEmployee?.id ?? null), assignees, toggleAssignee,
    clear: () => {
      setSearch("");
      setOnlyMine(false);
      setRecent(false);
      setTypes([]);
      setAssignees([]);
    },
  };
  const jql = {
    mode: searchMode,
    setMode: setSearchMode,
    text: jqlText,
    setText: setJqlText,
    activeId: activeFilterId,
    setActiveId: setActiveFilterId,
  };
  const searched = filterIssues(tasks, filters, { currentEmployeeId: currentEmployee?.id ?? null, nowMs, keyOf });

  if (loadError && !hasLoaded) {
    const missing = /42P01|PGRST205|does not exist|Could not find/i.test(`${loadError.code || ""} ${loadError.message || ""}`);
    return (
      <div className="tasks-empty-state glass">
        <div className="tasks-empty-icon tasks-empty-icon-red"><Icon name="alert" size={22} /></div>
        {missing ? (
          <>
            <h3>The issue tracker isn&apos;t set up yet</h3>
            <p>Its database migration hasn&apos;t been applied. Run the &quot;Apply migrations to production&quot; step in Bitbucket Pipelines, or <code>npm run db:push</code>.</p>
          </>
        ) : (
          <>
            <h3>Couldn&apos;t load issues</h3>
            <p>{loadError.message || "Check your connection and try again."}</p>
            <button className="btn btn-secondary btn-sm" onClick={board.reload}>Retry</button>
          </>
        )}
      </div>
    );
  }

  return (
    <TaskWorkflowProvider value={board.workflow}>
      <div className="tasks-subnav">
        <div className="status-tabs" role="tablist">
          {VIEWS.map((v) => (
            <button
              key={v.value}
              role="tab"
              aria-selected={view === v.value}
              className={`tab ${view === v.value ? "tab-active" : ""}`}
              onClick={() => setView(v.value)}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="tasks-subnav-actions">
          {isAdmin && (
            <button className="btn btn-ghost btn-sm" onClick={() => setShowBoardSettings(true)} title="Scrum or Kanban, workflow and WIP limits">
              <Icon name="sliders" size={16} /> Board settings
            </button>
          )}
          <button className="btn btn-primary btn-sm" onClick={() => openCreate()} title="Create issue (c)">
            <Icon name="plus" size={16} strokeWidth={2.2} /> Create
          </button>
        </div>
      </div>

      {loadError && hasLoaded && (
        <div className="tasks-unfiled">Lost connection while refreshing issues. Showing the last copy; it will retry on its own.</div>
      )}

      {unfiled.length > 0 && (
        <div className="tasks-unfiled">
          <span>
            {unfiled.length} {unfiled.length === 1 ? "task" : "tasks"} from the first board {unfiled.length === 1 ? "has" : "have"} no project yet:
          </span>
          {unfiled.map((t) => (
            <button key={t.id} type="button" className="project-filter-chip" onClick={() => setFiling(t)}>
              {t.title}
            </button>
          ))}
        </div>
      )}

      {FILTERS_WITH.has(view) && (
        <TaskFilterBar
          project={project}
          board={board}
          basic={basic}
          jql={jql}
          compiled={compiled}
          matchCount={searched.length}
          searchRef={searchRef}
        />
      )}

      {isLoading ? (
        <p className="empty-msg">Loading issues…</p>
      ) : view === "board" ? (
        <TaskBoardView
          project={project}
          tasks={tasks}
          sprints={sprints}
          filters={filters}
          currentEmployeeId={currentEmployee?.id ?? null}
          employeesById={employeesById}
          tasksById={tasksById}
          today={today}
          board={board}
          onOpenIssue={openIssue}
          onCompleteSprint={setCompleting}
          onGoToBacklog={() => setView("backlog")}
        />
      ) : view === "backlog" ? (
        <TaskBacklogView
          project={project}
          tasks={tasks}
          sprints={sprints}
          versions={versions}
          filters={filters}
          currentEmployeeId={currentEmployee?.id ?? null}
          employeesById={employeesById}
          tasksById={tasksById}
          board={board}
          onOpenIssue={openIssue}
          onCreateSprint={() => setSprintModal({ mode: "create", sprint: null })}
          onEditSprint={(sprint) => setSprintModal({ mode: "edit", sprint })}
          onStartSprint={(sprint, issueCount) => setSprintModal({ mode: "start", sprint, issueCount })}
          onCompleteSprint={setCompleting}
        />
      ) : view === "issues" ? (
        <TaskIssuesView
          project={project}
          issues={searched}
          order={compiled.ok ? compiled.order : []}
          invalid={!compiled.ok}
          sprints={sprints}
          versions={versions}
          employeesById={employeesById}
          today={today}
          onOpenIssue={openIssue}
        />
      ) : view === "releases" ? (
        <TaskReleasesView
          project={project}
          tasks={tasks}
          versions={versions}
          employeesById={employeesById}
          board={board}
          today={today}
          onOpenIssue={openIssue}
        />
      ) : (
        <TaskReportsView tasks={tasks} sprints={sprints} today={today} boardMode={project.board_mode} />
      )}

      {openIssueId != null && (
        <TaskIssueModal
          key={openIssueId}
          issueId={openIssueId}
          onClose={closeIssue}
          onOpenIssue={openIssue}
          project={project}
          tasks={tasks}
          sprints={sprints}
          versions={versions}
          employees={employees}
          board={board}
          today={today}
        />
      )}

      {showBoardSettings && (
        <TaskBoardSettings project={project} workflow={board.workflow} tasks={tasks} board={board} onClose={() => setShowBoardSettings(false)} />
      )}

      {createDefaults && (
        <TaskCreateModal
          key={createKey}
          isOpen
          onClose={() => setCreateDefaults(null)}
          project={project}
          tasks={tasks}
          sprints={sprints}
          versions={versions}
          employees={employees}
          board={board}
          defaults={createDefaults}
        />
      )}

      {sprintModal && (
        <SprintFormModal
          isOpen
          onClose={() => setSprintModal(null)}
          mode={sprintModal.mode}
          sprint={sprintModal.sprint}
          issueCount={sprintModal.issueCount ?? 0}
          project={project}
          sprints={sprints}
          today={today}
          board={board}
        />
      )}

      {completing && (
        <CompleteSprintModal
          isOpen
          onClose={() => setCompleting(null)}
          sprint={completing}
          project={project}
          sprints={sprints}
          sprintIssues={boardIssues(tasks, completing.id)}
          board={board}
        />
      )}

      {filing && <FileUnfiledModal task={filing} projects={projects} board={board} onClose={() => setFiling(null)} />}
    </TaskWorkflowProvider>
  );
}

export default function TasksPage() {
  const { projects } = useApp();
  // A shared link (#issue=HTT-12), read on arrival and whenever a new one is opened
  // while the tab is up. Picking another project drops it.
  const [hashKey, setHashKey] = useState(readHashIssueKey);
  const [selectedId, setSelectedId] = useState(() => {
    const raw = Number(readStored(PROJECT_KEY, ""));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  });

  useEffect(() => {
    const onHash = () => {
      const next = readHashIssueKey();
      if (next) setHashKey(next);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const [view, setViewState] = useState(() => {
    const stored = readStored(VIEW_KEY, "board");
    return VIEWS.some((v) => v.value === stored) ? stored : "board";
  });

  const selectable = projects.filter((p) => p.status !== "archived");
  // Resolved on every render, so a link still works if the projects arrive late.
  const hashProject = hashKey ? selectable.find((p) => p.issue_key === hashKey.key) : null;
  // The linked project, else the chosen one, else the first ready for issues, else any.
  const effectiveProject =
    hashProject ||
    selectable.find((p) => p.id === selectedId) ||
    selectable.find((p) => p.issue_key) ||
    selectable[0] ||
    null;

  const chooseProject = (id) => {
    setSelectedId(id);
    setHashKey(null);
    writeStored(PROJECT_KEY, String(id));
    setHashIssue(null);
  };

  const setView = (value) => {
    setViewState(value);
    writeStored(VIEW_KEY, value);
  };

  if (selectable.length === 0) {
    return (
      <section className="tasks-page fade-in">
        <div className="tasks-empty-state glass">
          <div className="tasks-empty-icon"><Icon name="folder" size={22} /></div>
          <h3>No projects yet</h3>
          <p>Issues live inside projects. An admin can create one from the Projects page.</p>
        </div>
      </section>
    );
  }

  const issueLink = hashKey && effectiveProject.issue_key === hashKey.key ? hashKey : null;

  return (
    <section className="tasks-page fade-in">
      <div className="tasks-header">
        <div className="tasks-project-picker">
          <span className="tasks-project-avatar">{(effectiveProject.issue_key || effectiveProject.name).slice(0, 2)}</span>
          <div>
            <span className="eyebrow tasks-project-label">Project</span>
            <select aria-label="Project" value={effectiveProject.id} onChange={(e) => chooseProject(Number(e.target.value))}>
              {selectable.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.issue_key ? ` (${p.issue_key})` : ""}
                </option>
              ))}
            </select>
          </div>
        </div>
        {effectiveProject.issue_key && (
          <span className="tasks-shortcut-hint">
            <kbd>c</kbd> create · <kbd>/</kbd> search
          </span>
        )}
      </div>

      {effectiveProject.issue_key ? (
        <ProjectWorkspace
          key={effectiveProject.id}
          project={effectiveProject}
          projects={projects}
          view={view}
          setView={setView}
          issueLink={issueLink}
        />
      ) : (
        <ProjectKeySetup key={effectiveProject.id} project={effectiveProject} projects={projects} />
      )}
    </section>
  );
}
