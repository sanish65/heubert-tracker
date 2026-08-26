"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import Modal from "@/components/Modal";

const STATUSES = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on-hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const LINK_CATEGORIES = [
  { value: "repo", label: "Repository", icon: "🧑‍💻" },
  { value: "board", label: "Board / Tickets", icon: "🗂️" },
  { value: "design", label: "Design", icon: "🎨" },
  { value: "docs", label: "Docs", icon: "📄" },
  { value: "other", label: "Other", icon: "🔗" },
];

// Suggested environment names. Free text, so a project can add QA, UAT, demo, ...
const ENV_SUGGESTIONS = ["Development", "Staging", "Production", "QA", "UAT"];

const statusLabel = (value) =>
  STATUSES.find((s) => s.value === value)?.label || value || "—";

const categoryIcon = (value) =>
  LINK_CATEGORIES.find((c) => c.value === value)?.icon || "🔗";

// An environment slug drives its badge colour: prod is the one you don't want to
// misread at a glance.
function envTone(name) {
  const n = (name || "").toLowerCase();
  if (n.startsWith("prod")) return "prod";
  if (n.startsWith("stag") || n.startsWith("uat") || n.startsWith("pre")) return "stage";
  if (n.startsWith("dev") || n.startsWith("local")) return "dev";
  return "other";
}

// Admins paste hosts as often as full URLs; keep the stored value clickable.
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

let rowKeySeed = 0;
const newRowKey = () => `row-${++rowKeySeed}`;

const emptyLinkRow = () => ({ _key: newRowKey(), label: "", url: "", category: "repo" });
const emptyEnvRow = (name = "") => ({ _key: newRowKey(), name, url: "", branch: "", notes: "" });

function initialFormFor(editing, links, environments) {
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
  };
}

function ProjectFormModal({ isOpen, onClose, editing, links, environments }) {
  const { addProject, updateProject, projects } = useApp();
  const [form, setForm] = useState(() => initialFormFor(editing, links, environments));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const setField = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

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
        <h2>{editing ? "Edit Project" : "New Project"}</h2>
        <button className="close-btn" onClick={onClose}>&times;</button>
      </div>

      <form onSubmit={handleSubmit} className="premium-form project-form">
        <div className="project-form-grid">
          <div className="form-group-interactive">
            <label>Project Name</label>
            <input
              type="text"
              placeholder="e.g. Acme Portal"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
              autoFocus
              required
            />
          </div>
          <div className="form-group-interactive">
            <label>Client</label>
            <input
              type="text"
              placeholder="e.g. Acme Inc."
              value={form.client}
              onChange={(e) => setField("client", e.target.value)}
            />
          </div>
          <div className="form-group-interactive">
            <label>Status</label>
            <select value={form.status} onChange={(e) => setField("status", e.target.value)}>
              {STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="form-group-interactive">
            <label>Tech Stack</label>
            <input
              type="text"
              placeholder="e.g. Next.js, Supabase, Expo"
              value={form.techStack}
              onChange={(e) => setField("techStack", e.target.value)}
            />
          </div>
          <div className="form-group-interactive">
            <label>Start Date</label>
            <input
              type="date"
              value={form.startDate}
              onChange={(e) => setField("startDate", e.target.value)}
            />
          </div>
          <div className="form-group-interactive">
            <label>Target End Date</label>
            <input
              type="date"
              value={form.endDate}
              onChange={(e) => setField("endDate", e.target.value)}
            />
          </div>
        </div>

        <div className="form-group-interactive">
          <label>Description</label>
          <textarea
            rows={3}
            placeholder="What this project is, who it's for, anything the team should know."
            value={form.description}
            onChange={(e) => setField("description", e.target.value)}
          />
        </div>

        {/* Environments */}
        <div className="project-form-section">
          <div className="project-form-section-head">
            <h3>Environments</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => addRow("environments", emptyEnvRow())}
            >
              + Add Environment
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
                  value={env.name}
                  onChange={(e) => setRow("environments", env._key, "name", e.target.value)}
                />
                <input
                  type="text"
                  className="project-row-input project-row-input-wide"
                  placeholder="URL (stage.acme.com)"
                  value={env.url}
                  onChange={(e) => setRow("environments", env._key, "url", e.target.value)}
                />
                <input
                  type="text"
                  className="project-row-input project-row-input-sm"
                  placeholder="Branch"
                  value={env.branch}
                  onChange={(e) => setRow("environments", env._key, "branch", e.target.value)}
                />
                <input
                  type="text"
                  className="project-row-input"
                  placeholder="Notes (no credentials)"
                  value={env.notes}
                  onChange={(e) => setRow("environments", env._key, "notes", e.target.value)}
                />
                <button
                  type="button"
                  className="project-row-remove"
                  onClick={() => removeRow("environments", env._key)}
                  title="Remove environment"
                >
                  ✕
                </button>
              </div>
            ))
          )}
          <p className="project-form-hint">
            Environment rows are visible to everyone in the tracker — link the environment, never paste credentials.
          </p>
        </div>

        {/* Links */}
        <div className="project-form-section">
          <div className="project-form-section-head">
            <h3>Links</h3>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => addRow("links", emptyLinkRow())}
            >
              + Add Link
            </button>
          </div>
          {form.links.length === 0 ? (
            <p className="empty-msg">No links yet.</p>
          ) : (
            form.links.map((link) => (
              <div key={link._key} className="project-row-editor">
                <select
                  className="project-row-input project-row-input-sm"
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
                  value={link.label}
                  onChange={(e) => setRow("links", link._key, "label", e.target.value)}
                />
                <input
                  type="text"
                  className="project-row-input project-row-input-wide"
                  placeholder="URL (github.com/heubert/acme)"
                  value={link.url}
                  onChange={(e) => setRow("links", link._key, "url", e.target.value)}
                />
                <button
                  type="button"
                  className="project-row-remove"
                  onClick={() => removeRow("links", link._key)}
                  title="Remove link"
                >
                  ✕
                </button>
              </div>
            ))
          )}
        </div>

        {error && <span className="form-error">{error}</span>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={isSaving}>
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

function ProjectCard({ project, links, environments, isAdmin, onEdit, onDelete }) {
  const start = formatDate(project.start_date);
  const end = formatDate(project.end_date);
  const techs = (project.tech_stack || "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  return (
    <article className={`project-card status-${project.status || "active"}`}>
      <header className="project-card-head">
        <div className="project-card-title-group">
          <h3 className="project-card-name">{project.name}</h3>
          {project.client && <span className="project-card-client">{project.client}</span>}
        </div>
        <div className="project-card-head-right">
          <span className={`project-status-badge status-${project.status || "active"}`}>
            {statusLabel(project.status)}
          </span>
          {isAdmin && (
            <div className="project-card-actions">
              <button
                className="project-icon-btn"
                onClick={() => onEdit(project)}
                title="Edit project"
              >
                ✏️
              </button>
              <button
                className="project-icon-btn project-icon-btn-danger"
                onClick={() => onDelete(project)}
                title="Delete project"
              >
                ✕
              </button>
            </div>
          )}
        </div>
      </header>

      {project.description && <p className="project-card-desc">{project.description}</p>}

      {(start || end) && (
        <p className="project-card-dates">
          🗓️ {start || "—"} → {end || "ongoing"}
        </p>
      )}

      {techs.length > 0 && (
        <div className="project-tech-row">
          {techs.map((tech) => (
            <span key={tech} className="project-tech-chip">{tech}</span>
          ))}
        </div>
      )}

      <div className="project-card-block">
        <span className="project-block-label">Environments</span>
        {environments.length === 0 ? (
          <p className="project-block-empty">No environments recorded.</p>
        ) : (
          <ul className="project-env-list">
            {environments.map((env) => (
              <li key={env.id} className={`project-env-item env-${envTone(env.name)}`}>
                <span className={`project-env-badge env-${envTone(env.name)}`}>{env.name}</span>
                {env.url ? (
                  <a
                    className="project-env-url"
                    href={env.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {prettyUrl(env.url)}
                  </a>
                ) : (
                  <span className="project-env-url project-env-url-missing">No URL yet</span>
                )}
                {env.branch && <span className="project-env-branch">⌥ {env.branch}</span>}
                {env.notes && <span className="project-env-notes">{env.notes}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="project-card-block">
        <span className="project-block-label">Links</span>
        {links.length === 0 ? (
          <p className="project-block-empty">No links recorded.</p>
        ) : (
          <div className="project-link-row">
            {links.map((link) => (
              <a
                key={link.id}
                className="project-link-chip"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.url}
              >
                <span>{categoryIcon(link.category)}</span>
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}

export default function ProjectsPage() {
  const {
    projects,
    projectLinks,
    projectEnvironments,
    deleteProject,
    isAdmin,
  } = useApp();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formKey, setFormKey] = useState(0);
  const [statusFilter, setStatusFilter] = useState("all");

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

  const visibleProjects = useMemo(
    () =>
      statusFilter === "all"
        ? projects
        : projects.filter((p) => (p.status || "active") === statusFilter),
    [projects, statusFilter]
  );

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
      !confirm(
        `Delete project "${project.name}"? Its links and environments are deleted with it.`
      )
    ) {
      return;
    }
    const { error } = await deleteProject(project.id);
    if (error) alert(`Error deleting project: ${error.message || "Check connection"}`);
  };

  const editingLinks = editing ? linksByProject.get(editing.id) || [] : [];
  const editingEnvs = editing ? envsByProject.get(editing.id) || [] : [];

  return (
    <section className="projects-page fade-in">
      <div className="section-header">
        <div className="directory-title">
          <h2 className="section-title">🚀 Projects</h2>
          <span className="directory-count">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
        </div>
        {isAdmin && (
          <button className="btn btn-primary" onClick={openAdd}>
            <span>+</span> New Project
          </button>
        )}
      </div>

      <div className="project-filter-chips">
        <button
          className={`project-filter-chip ${statusFilter === "all" ? "active" : ""}`}
          onClick={() => setStatusFilter("all")}
        >
          All
        </button>
        {STATUSES.map((s) => {
          const count = projects.filter((p) => (p.status || "active") === s.value).length;
          return (
            <button
              key={s.value}
              className={`project-filter-chip ${statusFilter === s.value ? "active" : ""}`}
              onClick={() => setStatusFilter(s.value)}
            >
              {s.label}
              <span className="chip-badge">{count}</span>
            </button>
          );
        })}
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
        <div className="projects-grid">
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              links={linksByProject.get(project.id) || []}
              environments={envsByProject.get(project.id) || []}
              isAdmin={isAdmin}
              onEdit={openEdit}
              onDelete={handleDelete}
            />
          ))}
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
        />
      )}
    </section>
  );
}
