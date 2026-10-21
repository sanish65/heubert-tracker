"use client";

import { useMemo, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import Modal from "@/components/Modal";
import Icon from "@/components/Icon";
import { useDialog } from "@/context/DialogContext";
import Avatar from "@/components/Avatar";

// Project statuses, each with its pill colour.
const STATUSES = [
  { value: "planning", label: "Planning", pill: "pill-blue" },
  { value: "active", label: "Active", pill: "pill-green" },
  { value: "on-hold", label: "On Hold", pill: "pill-amber" },
  { value: "completed", label: "Completed", pill: "pill-violet" },
  { value: "archived", label: "Archived", pill: "pill-gray" },
];

const STATUS_FILTERS = [{ value: "all", label: "All" }, ...STATUSES];

const LINK_CATEGORIES = [
  { value: "repo", label: "Repository", icon: "folder" },
  { value: "board", label: "Board / Tickets", icon: "kanban" },
  { value: "design", label: "Design", icon: "image" },
  { value: "docs", label: "Docs", icon: "book" },
  { value: "other", label: "Other", icon: "link" },
];

// Suggested environment names. Free text, so a project can add QA, UAT, demo, ...
const ENV_SUGGESTIONS = ["Development", "Staging", "Production", "QA", "UAT"];

// No status means active, as the status filter counts it.
const statusOf = (value) =>
  STATUSES.find((s) => s.value === (value || "active")) || { label: value, pill: "pill-gray" };

const categoryOf = (value) =>
  LINK_CATEGORIES.find((c) => c.value === value) || LINK_CATEGORIES[LINK_CATEGORIES.length - 1];

// An environment slug drives its pill colour: prod is the one you don't want to
// misread at a glance.
function envTone(name) {
  const n = (name || "").toLowerCase();
  if (n.startsWith("prod")) return "prod";
  if (n.startsWith("stag") || n.startsWith("uat") || n.startsWith("pre")) return "stage";
  if (n.startsWith("dev") || n.startsWith("local")) return "dev";
  return "other";
}

const ENV_TONE_PILL = { prod: "pill-red", stage: "pill-amber", dev: "pill-blue", other: "pill-gray" };

// Admins paste hosts as often as full URLs; keep the stored value clickable. Links are
// rendered through it too, so an href is only ever http(s).
function normalizeUrl(url) {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function prettyUrl(url) {
  return (url || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const techList = (stack) =>
  (stack || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

let rowKeySeed = 0;
const newRowKey = () => `row-${++rowKeySeed}`;

const emptyLinkRow = () => ({ _key: newRowKey(), label: "", url: "", category: "repo" });
const emptyEnvRow = (name = "") => ({ _key: newRowKey(), name, url: "", branch: "", notes: "" });

function initialFormFor(editing, links, environments, memberEmployeeIds) {
  if (!editing) {
    return {
      name: "",
      client: "",
      description: "",
      status: "active",
      techStack: "",
      startDate: "",
      endDate: "",
      // A new project starts with the three environments every project here has.
      environments: [emptyEnvRow("Development"), emptyEnvRow("Staging"), emptyEnvRow("Production")],
      links: [emptyLinkRow()],
      members: [],
    };
  }
  return {
    name: editing.name || "",
    client: editing.client || "",
    description: editing.description || "",
    status: editing.status || "active",
    techStack: editing.tech_stack || "",
    startDate: editing.start_date ? String(editing.start_date).split("T")[0] : "",
    endDate: editing.end_date ? String(editing.end_date).split("T")[0] : "",
    environments: environments.map((env) => ({
      _key: newRowKey(),
      id: env.id,
      name: env.name || "",
      url: env.url || "",
      branch: env.branch || "",
      notes: env.notes || "",
    })),
    links: links.map((link) => ({
      _key: newRowKey(),
      id: link.id,
      label: link.label || "",
      url: link.url || "",
      category: link.category || "other",
    })),
    members: memberEmployeeIds || [],
  };
}

function ProjectFormModal({ isOpen, onClose, editing, links, environments, memberEmployeeIds }) {
  const { addProject, updateProject, projects, employees } = useApp();
  const [form, setForm] = useState(() => initialFormFor(editing, links, environments, memberEmployeeIds));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const staffableEmployees = useMemo(
    () => employees.filter((e) => e.status !== "resigned"),
    [employees]
  );

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const toggleMember = (employeeId) =>
    setForm((prev) => ({
      ...prev,
      members: prev.members.includes(employeeId)
        ? prev.members.filter((id) => id !== employeeId)
        : [...prev.members, employeeId],
    }));

  const setRow = (collection, key, field, value) =>
    setForm((prev) => ({
      ...prev,
      [collection]: prev[collection].map((row) =>
        row._key === key ? { ...row, [field]: value } : row
      ),
    }));

  const addRow = (collection, row) =>
    setForm((prev) => ({ ...prev, [collection]: [...prev[collection], row] }));

  const removeRow = (collection, key) =>
    setForm((prev) => ({
      ...prev,
      [collection]: prev[collection].filter((row) => row._key !== key),
    }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) {
      setError("Please enter a project name");
      return;
    }
    const duplicate = projects.some(
      (p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== editing?.id
    );
    if (duplicate) {
      setError("A project with this name already exists");
      return;
    }
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      setError("End date cannot be before the start date");
      return;
    }

    // Blank rows are how an admin cancels a row they opened, so drop them instead
    // of failing the save. Half-filled rows are a mistake worth reporting.
    const envRows = form.environments.filter(
      (env) => env.name.trim() || env.url.trim() || env.branch.trim() || env.notes.trim()
    );
    if (envRows.some((env) => !env.name.trim())) {
      setError("Every environment needs a name (e.g. Production)");
      return;
    }
    const linkRows = form.links.filter((link) => link.label.trim() || link.url.trim());
    if (linkRows.some((link) => !link.label.trim() || !link.url.trim())) {
      setError("Every link needs both a label and a URL");
      return;
    }

    const payload = {
      ...form,
      name,
      environments: envRows.map((env) => ({ ...env, url: normalizeUrl(env.url) })),
      links: linkRows.map((link) => ({ ...link, url: normalizeUrl(link.url) })),
    };

    setIsSaving(true);
    try {
      const { error: dbError } = editing
        ? await updateProject(editing.id, payload)
        : await addProject(payload);
      if (dbError) {
        setError(dbError.message || "Something went wrong");
        return;
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="modal-content-wide">
      <div className="modal-header">
        <span className="modal-icon"><Icon name="folder" size={20} /></span>
        <h2>{editing ? "Edit project" : "New project"}</h2>
        <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="x" size={18} />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="premium-form project-form">
        <div className="project-form-grid">
          <div className="form-group-interactive">
            <label htmlFor="project-name">Project Name</label>
            <input
              id="project-name"
              type="text"
              placeholder="e.g. Acme Portal"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-group-interactive">
            <label htmlFor="project-client">Client</label>
            <input
              id="project-client"
              type="text"
              placeholder="e.g. Acme Inc."
              value={form.client}
              onChange={(e) => setField("client", e.target.value)}
            />
          </div>
          <div className="form-group-interactive">
            <label htmlFor="project-status">Status</label>
            <select id="project-status" value={form.status} onChange={(e) => setField("status", e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group-interactive">
            <label htmlFor="project-tech">Tech Stack</label>
            <input
              id="project-tech"
              type="text"
              placeholder="e.g. Next.js, Supabase, Expo"
              value={form.techStack}
              onChange={(e) => setField("techStack", e.target.value)}
            />
          </div>
          <div className="form-group-interactive">
            <label htmlFor="project-start">Start Date</label>
            <input
              id="project-start"
              type="date"
              value={form.startDate}
              onChange={(e) => setField("startDate", e.target.value)}
            />
          </div>
          <div className="form-group-interactive">
            <label htmlFor="project-end">Target End Date</label>
            <input
              id="project-end"
              type="date"
              value={form.endDate}
              onChange={(e) => setField("endDate", e.target.value)}
            />
          </div>
        </div>

        <div className="form-group-interactive">
          <label htmlFor="project-description">Description</label>
          <textarea
            id="project-description"
            rows={3}
            placeholder="What this project is, who it's for, anything the team should know."
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
          />
        </div>

        {/* Team Members */}
        <div className="project-form-section" role="group" aria-labelledby="project-members-title">
          <div className="project-form-section-head">
            <h3 id="project-members-title">Team Members</h3>
            <span className="project-form-count mono">{form.members.length} selected</span>
          </div>
          {staffableEmployees.length === 0 ? (
            <p className="empty-msg">No employees to add yet.</p>
          ) : (
            <div className="project-member-picker">
              {staffableEmployees.map((emp) => {
                const selected = form.members.includes(emp.id);
                return (
                  <label key={emp.id} className={`project-member-chip ${selected ? "active" : ""}`}>
                    <input type="checkbox" checked={selected} onChange={() => toggleMember(emp.id)} />
                    {selected ? (
                      <span className="project-member-mark" aria-hidden="true">
                        <Icon name="check" size={12} strokeWidth={2.6} />
                      </span>
                    ) : (
                      <Avatar name={emp.name} className="avatar project-chip-avatar" aria-hidden="true" />
                    )}
                    <span>{emp.name}</span>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Environments */}
        <div className="project-form-section">
          <div className="project-form-section-head">
            <h3>Environments</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm project-form-add"
              onClick={() => addRow("environments", emptyEnvRow())}
            >
              <Icon name="plus" size={14} strokeWidth={2.2} />
              Add Environment
            </button>
          </div>
          <datalist id="project-env-suggestions">
            {ENV_SUGGESTIONS.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          {form.environments.length === 0 ? (
            <p className="empty-msg">No environments yet.</p>
          ) : (
            form.environments.map((env) => (
              <div key={env._key} className="project-row-editor">
                <input
                  type="text"
                  className="project-row-input"
                  list="project-env-suggestions"
                  placeholder="Environment (Development)"
                  aria-label="Environment name"
                  value={env.name}
                  onChange={(e) => setRow("environments", env._key, "name", e.target.value)}
                />
                <input
                  type="text"
                  className="project-row-input project-row-input-wide mono"
                  placeholder="URL (stage.acme.com)"
                  aria-label="Environment URL"
                  value={env.url}
                  onChange={(e) => setRow("environments", env._key, "url", e.target.value)}
                />
                <input
                  type="text"
                  className="project-row-input project-row-input-sm mono"
                  placeholder="Branch"
                  aria-label="Branch"
                  value={env.branch}
                  onChange={(e) => setRow("environments", env._key, "branch", e.target.value)}
                />
                <input
                  type="text"
                  className="project-row-input"
                  placeholder="Notes (no credentials)"
                  aria-label="Notes"
                  value={env.notes}
                  onChange={(e) => setRow("environments", env._key, "notes", e.target.value)}
                />
                <button
                  type="button"
                  className="btn-icon btn-sm project-row-remove"
                  onClick={() => removeRow("environments", env._key)}
                  aria-label="Remove environment"
                  title="Remove environment"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))
          )}
          <p className="project-form-warning">
            <Icon name="alert" size={14} strokeWidth={2} />
            Environment rows are visible to everyone in the tracker — link the environment, never paste credentials.
          </p>
        </div>

        {/* Links */}
        <div className="project-form-section">
          <div className="project-form-section-head">
            <h3>Links</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm project-form-add"
              onClick={() => addRow("links", emptyLinkRow())}
            >
              <Icon name="plus" size={14} strokeWidth={2.2} />
              Add Link
            </button>
          </div>
          {form.links.length === 0 ? (
            <p className="empty-msg">No links yet.</p>
          ) : (
            form.links.map((link) => (
              <div key={link._key} className="project-row-editor">
                <select
                  className="project-row-input project-row-input-sm"
                  aria-label="Link category"
                  value={link.category}
                  onChange={(e) => setRow("links", link._key, "category", e.target.value)}
                >
                  {LINK_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  className="project-row-input"
                  placeholder="Label (GitHub repo)"
                  aria-label="Link label"
                  value={link.label}
                  onChange={(e) => setRow("links", link._key, "label", e.target.value)}
                />
                <input
                  type="text"
                  className="project-row-input project-row-input-wide mono"
                  placeholder="URL (github.com/heubert/acme)"
                  aria-label="Link URL"
                  value={link.url}
                  onChange={(e) => setRow("links", link._key, "url", e.target.value)}
                />
                <button
                  type="button"
                  className="btn-icon btn-sm project-row-remove"
                  onClick={() => removeRow("links", link._key)}
                  aria-label="Remove link"
                  title="Remove link"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))
          )}
        </div>

        {error && (
          <div className="form-error" role="alert">
            <Icon name="alert" size={16} />
            {error}
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            {isSaving ? "Saving..." : editing ? "Save Changes" : "Create Project"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// Compact card (Projects.dc.html). Clicking it shows its details in the panel beside
// the grid.
function ProjectCard({ project, links, environments, members, selected, lift, onSelect }) {
  const start = formatDate(project.start_date);
  const end = formatDate(project.end_date);
  const techs = techList(project.tech_stack);
  const status = statusOf(project.status);
  const shown = members.slice(0, 3);

  return (
    <article
      className={`project-card glass${lift ? " card-lift" : ""}${selected ? " is-selected" : ""}`}
      onClick={() => onSelect(project.id)}
    >
      <div className="project-card-head">
        <div className="project-card-title-group">
          <h2 className="project-card-name">
            {/* The card's click selects it; the button is its keyboard stop. */}
            <button
              type="button"
              className="project-card-open"
              aria-controls="project-detail"
              aria-current={selected ? "true" : undefined}
            >
              {project.name}
            </button>
          </h2>
          {project.client && <span className="project-card-client">{project.client}</span>}
        </div>
        <span className={`pill ${status.pill}`}>{status.label}</span>
      </div>

      {project.description && <p className="project-card-desc">{project.description}</p>}

      {(start || end) && (
        <span className="project-card-dates mono">
          <Icon name="calendar" size={14} strokeWidth={2} />
          {start || "—"} → {end || "ongoing"}
        </span>
      )}

      {techs.length > 0 && (
        <div className="project-tech-row">
          {techs.map((tech, i) => (
            <span key={`${i}-${tech}`} className="pill pill-gray mono project-tech-chip">{tech}</span>
          ))}
        </div>
      )}

      <div className="project-card-foot">
        {members.length === 0 ? (
          <span className="project-card-empty">No one staffed yet.</span>
        ) : (
          <span className="project-avatars" role="img" aria-label={`Team: ${members.map((m) => m.name).join(", ")}`}>
            {shown.map((emp) => (
              <Avatar key={emp.id} name={emp.name} className="avatar project-avatar" />
            ))}
            {members.length > shown.length && (
              <span className="avatar project-avatar project-avatar-more mono">+{members.length - shown.length}</span>
            )}
          </span>
        )}
        <span className="project-card-counts">
          <span className="project-card-count" title="Environments">
            <Icon name="layers" size={14} strokeWidth={2} />
            {plural(environments.length, "env")}
          </span>
          <span className="project-card-count" title="Links">
            <Icon name="link" size={14} strokeWidth={2} />
            {plural(links.length, "link")}
          </span>
        </span>
      </div>
    </article>
  );
}

// "Project details" (Projects.dc.html): what the card leaves out — dates, stack,
// environments, links and the team — with the admin edit and delete.
function ProjectDetail({ project, links, environments, members, isAdmin, onEdit, onDelete, panelRef }) {
  const start = formatDate(project.start_date);
  const end = formatDate(project.end_date);
  const techs = techList(project.tech_stack);
  const status = statusOf(project.status);

  return (
    <aside id="project-detail" ref={panelRef} className="project-detail glass" aria-labelledby="project-detail-name">
      <div className="project-detail-head">
        <span className="modal-icon" aria-hidden="true">
          <Icon name="folder" size={22} />
        </span>
        <div className="project-detail-heading">
          <span className="modal-eyebrow">Project details</span>
          <h2 id="project-detail-name" className="project-detail-name">{project.name}</h2>
          <div className="project-detail-meta">
            {project.client && <span>{project.client}</span>}
            <span className={`pill ${status.pill}`}>{status.label}</span>
          </div>
        </div>
        {isAdmin && (
          <div className="project-detail-actions">
            <button
              type="button"
              className="btn-icon"
              onClick={() => onEdit(project)}
              aria-label={`Edit ${project.name}`}
              title="Edit project"
            >
              <Icon name="edit" size={16} />
            </button>
            <button
              type="button"
              className="btn-icon project-delete"
              onClick={() => onDelete(project)}
              aria-label={`Delete ${project.name}`}
              title="Delete project"
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        )}
      </div>

      {project.description && <p className="project-detail-desc">{project.description}</p>}

      <dl className="project-facts">
        <div className="project-fact">
          <dt>Start Date</dt>
          <dd className="mono">{start || "—"}</dd>
        </div>
        <div className="project-fact">
          <dt>Target End Date</dt>
          <dd className="mono">{end || "—"}</dd>
        </div>
        {techs.length > 0 && (
          <div className="project-fact project-fact-wide">
            <dt>Tech Stack</dt>
            <dd className="project-tech-row">
              {techs.map((tech, i) => (
                <span key={`${i}-${tech}`} className="pill pill-gray mono project-tech-chip">{tech}</span>
              ))}
            </dd>
          </div>
        )}
      </dl>

      <section className="project-detail-section" aria-labelledby="project-detail-envs">
        <h3 id="project-detail-envs" className="project-detail-title">Environments</h3>
        {environments.length === 0 ? (
          <p className="project-empty">No environments recorded.</p>
        ) : (
          <ul className="project-env-list">
            {environments.map((env) => {
              const tone = envTone(env.name);
              return (
                <li key={env.id} className={`project-env tone-${tone}`}>
                  <div className="project-env-top">
                    <span className={`pill ${ENV_TONE_PILL[tone]}`}>{env.name}</span>
                    {env.url ? (
                      <a
                        className="project-env-url mono"
                        href={normalizeUrl(env.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {prettyUrl(env.url)}
                      </a>
                    ) : (
                      <span className="project-env-url is-missing">No URL yet</span>
                    )}
                    {env.branch && (
                      <span className="project-env-branch">
                        branch <span className="mono">{env.branch}</span>
                      </span>
                    )}
                  </div>
                  {env.notes && <p className="project-env-notes">{env.notes}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="project-detail-section" aria-labelledby="project-detail-links">
        <h3 id="project-detail-links" className="project-detail-title">Links</h3>
        {links.length === 0 ? (
          <p className="project-empty">No links recorded.</p>
        ) : (
          <ul className="project-link-list">
            {links.map((link) => {
              const category = categoryOf(link.category);
              return (
                <li key={link.id}>
                  <a className="project-link" href={normalizeUrl(link.url)} target="_blank" rel="noopener noreferrer">
                    <span className="project-link-icon" aria-hidden="true">
                      <Icon name={category.icon} size={16} />
                    </span>
                    <span className="project-link-text">
                      <span className="project-link-label">{link.label}</span>
                      <span className="project-link-url mono">{prettyUrl(link.url)}</span>
                    </span>
                    <span className="project-link-category">{category.label}</span>
                  </a>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="project-detail-section" aria-labelledby="project-detail-team">
        <div className="project-detail-title-row">
          <h3 id="project-detail-team" className="project-detail-title">Team Members</h3>
          <span className="project-detail-count mono">{members.length}</span>
        </div>
        {members.length === 0 ? (
          <p className="project-empty">No one staffed yet.</p>
        ) : (
          <div className="project-team">
            {members.map((emp) => (
              <span key={emp.id} className="project-team-chip">
                <Avatar name={emp.name} className="avatar project-chip-avatar" aria-hidden="true" />
                {emp.name}
              </span>
            ))}
          </div>
        )}
      </section>
    </aside>
  );
}

export default function ProjectsPage() {
  const {
    projects,
    projectLinks,
    projectEnvironments,
    projectMembers,
    employees,
    deleteProject,
    isAdmin,
    animationsEnabled,
  } = useApp();
  const { confirmDialog, alertDialog } = useDialog();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const detailRef = useRef(null);

  const linksByProject = useMemo(() => {
    const map = new Map();
    for (const link of projectLinks) {
      if (!map.has(link.project_id)) map.set(link.project_id, []);
      map.get(link.project_id).push(link);
    }
    return map;
  }, [projectLinks]);

  const envsByProject = useMemo(() => {
    const map = new Map();
    for (const env of projectEnvironments) {
      if (!map.has(env.project_id)) map.set(env.project_id, []);
      map.get(env.project_id).push(env);
    }
    return map;
  }, [projectEnvironments]);

  const employeesById = useMemo(() => {
    const map = new Map();
    for (const emp of employees) map.set(emp.id, emp);
    return map;
  }, [employees]);

  const membersByProject = useMemo(() => {
    const map = new Map();
    for (const row of projectMembers) {
      if (!map.has(row.project_id)) map.set(row.project_id, []);
      const emp = employeesById.get(row.employee_id);
      if (emp) map.get(row.project_id).push(emp);
    }
    return map;
  }, [projectMembers, employeesById]);

  const visibleProjects = useMemo(
    () =>
      statusFilter === "all"
        ? projects
        : projects.filter((p) => (p.status || "active") === statusFilter),
    [projects, statusFilter]
  );

  const statusCounts = useMemo(() => {
    const counts = { all: projects.length };
    for (const p of projects) {
      const status = p.status || "active";
      counts[status] = (counts[status] || 0) + 1;
    }
    return counts;
  }, [projects]);

  // The panel shows the chosen project, or the first card once that one is filtered out.
  const selected = visibleProjects.find((p) => p.id === selectedId) || visibleProjects[0] || null;

  const selectProject = (id) => {
    setSelectedId(id);
    // Beside the grid the panel is always in view. On narrow screens it sits under
    // every card, so bring it up.
    const panel = detailRef.current;
    if (panel && panel.getBoundingClientRect().top > window.innerHeight) {
      panel.scrollIntoView({ block: "start" });
    }
  };

  const openAdd = () => {
    setEditing(null);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const openEdit = (project) => {
    setEditing(project);
    setFormKey((k) => k + 1);
    setShowForm(true);
  };

  const handleDelete = async (project) => {
    if (
      !(await confirmDialog(
        `Delete project "${project.name}"? Its links, environments and all of its issues on the Tasks tab are deleted with it.`,
        { danger: true }
      ))
    ) {
      return;
    }
    const { error } = await deleteProject(project.id);
    if (error)
      await alertDialog(`Error deleting project: ${error.message || "Check connection"}`, {
        tone: "error",
      });
  };

  const editingLinks = editing ? linksByProject.get(editing.id) || [] : [];
  const editingEnvs = editing ? envsByProject.get(editing.id) || [] : [];
  const editingMemberIds = editing
    ? projectMembers.filter((m) => m.project_id === editing.id).map((m) => m.employee_id)
    : [];

  return (
    <section className="projects-page">
      <div className="projects-toolbar">
        <div className="project-filter-chips" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((s) => (
            <button
              key={s.value}
              type="button"
              className={`project-filter-chip ${statusFilter === s.value ? "active" : ""}`}
              aria-pressed={statusFilter === s.value}
              onClick={() => setStatusFilter(s.value)}
            >
              {s.label}
              <span className="project-filter-count mono">{statusCounts[s.value] || 0}</span>
            </button>
          ))}
        </div>
        {isAdmin && (
          <button type="button" className="btn btn-primary" onClick={openAdd}>
            <Icon name="plus" size={16} strokeWidth={2.2} /> New Project
          </button>
        )}
      </div>

      {visibleProjects.length === 0 ? (
        <p className="empty-msg">
          {projects.length === 0
            ? isAdmin
              ? "No projects yet — create the first one."
              : "No projects have been added yet."
            : "No projects with this status."}
        </p>
      ) : (
        <div className="projects-layout">
          <section className="projects-grid" aria-label="Project list">
            {visibleProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                links={linksByProject.get(project.id) || []}
                environments={envsByProject.get(project.id) || []}
                members={membersByProject.get(project.id) || []}
                selected={project.id === selected?.id}
                lift={animationsEnabled !== false}
                onSelect={selectProject}
              />
            ))}
          </section>
          {selected && (
            <ProjectDetail
              project={selected}
              links={linksByProject.get(selected.id) || []}
              environments={envsByProject.get(selected.id) || []}
              members={membersByProject.get(selected.id) || []}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={handleDelete}
              panelRef={detailRef}
            />
          )}
        </div>
      )}

      {isAdmin && (
        <ProjectFormModal
          key={formKey}
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          editing={editing}
          links={editingLinks}
          environments={editingEnvs}
          memberEmployeeIds={editingMemberIds}
        />
      )}
    </section>
  );
}
