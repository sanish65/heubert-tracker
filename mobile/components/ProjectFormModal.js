import { useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Select, Button, Chip } from "./ui";
import DateField from "./DateField";
import { useThemeColors, radius } from "../lib/theme";

const STATUSES = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on-hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const LINK_CATEGORIES = [
  { value: "repo", label: "🧑‍💻 Repo" },
  { value: "board", label: "🗂️ Board" },
  { value: "design", label: "🎨 Design" },
  { value: "docs", label: "📄 Docs" },
  { value: "other", label: "🔗 Other" },
];

let rowKeySeed = 0;
const newRowKey = () => `row-${++rowKeySeed}`;

const emptyLinkRow = () => ({ _key: newRowKey(), label: "", url: "", category: "repo" });
const emptyEnvRow = (name = "") => ({ _key: newRowKey(), name, url: "", branch: "", notes: "" });

function normalizeUrl(url) {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

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

function RowEditor({ children, onRemove }) {
  const t = useThemeColors();
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: t.border,
        borderRadius: radius.sm,
        padding: 10,
        marginBottom: 10,
      }}
    >
      {children}
      <Pressable onPress={onRemove} style={{ alignSelf: "flex-end", marginTop: 4 }}>
        <Text style={{ color: t.accentRed, fontSize: 13, fontWeight: "600" }}>✕ Remove</Text>
      </Pressable>
    </View>
  );
}

export default function ProjectFormModal({ isOpen, onClose, editing, links, environments, memberEmployeeIds }) {
  const { addProject, updateProject, projects, employees } = useApp();
  const t = useThemeColors();
  const [form, setForm] = useState(() => initialFormFor(editing, links, environments, memberEmployeeIds));
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const staffableEmployees = employees.filter((e) => e.status !== "resigned");

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
      [collection]: prev[collection].map((row) => (row._key === key ? { ...row, [field]: value } : row)),
    }));

  const addRow = (collection, row) => setForm((prev) => ({ ...prev, [collection]: [...prev[collection], row] }));

  const removeRow = (collection, key) =>
    setForm((prev) => ({ ...prev, [collection]: prev[collection].filter((row) => row._key !== key) }));

  const handleSubmit = async () => {
    const name = form.name.trim();
    if (!name) return setError("Please enter a project name");
    const duplicate = projects.some((p) => p.name.toLowerCase() === name.toLowerCase() && p.id !== editing?.id);
    if (duplicate) return setError("A project with this name already exists");
    if (form.startDate && form.endDate && form.endDate < form.startDate) {
      return setError("End date cannot be before the start date");
    }

    const envRows = form.environments.filter(
      (env) => env.name.trim() || env.url.trim() || env.branch.trim() || env.notes.trim()
    );
    if (envRows.some((env) => !env.name.trim())) return setError("Every environment needs a name (e.g. Production)");
    const linkRows = form.links.filter((link) => link.label.trim() || link.url.trim());
    if (linkRows.some((link) => !link.label.trim() || !link.url.trim())) {
      return setError("Every link needs both a label and a URL");
    }

    const payload = {
      ...form,
      name,
      environments: envRows.map((env) => ({ ...env, url: normalizeUrl(env.url) })),
      links: linkRows.map((link) => ({ ...link, url: normalizeUrl(link.url) })),
    };

    setIsSaving(true);
    try {
      const { error: dbError } = editing ? await updateProject(editing.id, payload) : await addProject(payload);
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
    <FormModal visible={isOpen} onClose={onClose} title={editing ? "✏️ Edit Project" : "🚀 New Project"}>
      <TextField label="Project Name" value={form.name} onChangeText={(v) => setField("name", v)} placeholder="e.g. Acme Portal" />
      <TextField label="Client" value={form.client} onChangeText={(v) => setField("client", v)} placeholder="e.g. Acme Inc." />
      <Select label="Status" value={form.status} onSelect={(v) => setField("status", v)} options={STATUSES} />
      <TextField
        label="Tech Stack"
        value={form.techStack}
        onChangeText={(v) => setField("techStack", v)}
        placeholder="e.g. Next.js, Supabase, Expo"
      />
      <DateField label="Start Date" value={form.startDate} onChange={(v) => setField("startDate", v)} />
      <DateField label="Target End Date" value={form.endDate} onChange={(v) => setField("endDate", v)} />
      <TextField
        label="Description"
        value={form.description}
        onChangeText={(v) => setField("description", v)}
        placeholder="What this project is, who it's for, anything the team should know."
        multiline
      />

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ color: t.textPrimary, fontSize: 15, fontWeight: "700" }}>Team Members</Text>
        <Text style={{ color: t.textMuted, fontSize: 12 }}>{form.members.length} selected</Text>
      </View>
      {staffableEmployees.length === 0 ? (
        <Text style={{ color: t.textMuted, fontSize: 13, marginBottom: 14 }}>No employees to add yet.</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
          {staffableEmployees.map((emp) => (
            <Chip
              key={emp.id}
              label={emp.name}
              active={form.members.includes(emp.id)}
              onPress={() => toggleMember(emp.id)}
            />
          ))}
        </View>
      )}

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ color: t.textPrimary, fontSize: 15, fontWeight: "700" }}>Environments</Text>
        <Pressable onPress={() => addRow("environments", emptyEnvRow())}>
          <Text style={{ color: t.accentIndigo, fontSize: 13, fontWeight: "700" }}>+ Add</Text>
        </Pressable>
      </View>
      {form.environments.length === 0 ? (
        <Text style={{ color: t.textMuted, fontSize: 13, marginBottom: 14 }}>No environments yet.</Text>
      ) : (
        form.environments.map((env) => (
          <RowEditor key={env._key} onRemove={() => removeRow("environments", env._key)}>
            <TextField
              label="Environment"
              value={env.name}
              onChangeText={(v) => setRow("environments", env._key, "name", v)}
              placeholder="Development"
            />
            <TextField
              label="URL"
              value={env.url}
              onChangeText={(v) => setRow("environments", env._key, "url", v)}
              placeholder="stage.acme.com"
            />
            <TextField
              label="Branch"
              value={env.branch}
              onChangeText={(v) => setRow("environments", env._key, "branch", v)}
              placeholder="main"
            />
            <TextField
              label="Notes"
              value={env.notes}
              onChangeText={(v) => setRow("environments", env._key, "notes", v)}
              placeholder="No credentials — pointer only"
            />
          </RowEditor>
        ))
      )}
      <Text style={{ color: t.textMuted, fontSize: 12, marginBottom: 14 }}>
        Environment rows are visible to everyone in the tracker — link the environment, never paste credentials.
      </Text>

      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <Text style={{ color: t.textPrimary, fontSize: 15, fontWeight: "700" }}>Links</Text>
        <Pressable onPress={() => addRow("links", emptyLinkRow())}>
          <Text style={{ color: t.accentIndigo, fontSize: 13, fontWeight: "700" }}>+ Add</Text>
        </Pressable>
      </View>
      {form.links.length === 0 ? (
        <Text style={{ color: t.textMuted, fontSize: 13, marginBottom: 14 }}>No links yet.</Text>
      ) : (
        form.links.map((link) => (
          <RowEditor key={link._key} onRemove={() => removeRow("links", link._key)}>
            <Select
              label="Category"
              value={link.category}
              onSelect={(v) => setRow("links", link._key, "category", v)}
              options={LINK_CATEGORIES}
            />
            <TextField
              label="Label"
              value={link.label}
              onChangeText={(v) => setRow("links", link._key, "label", v)}
              placeholder="GitHub repo"
            />
            <TextField
              label="URL"
              value={link.url}
              onChangeText={(v) => setRow("links", link._key, "url", v)}
              placeholder="github.com/heubert/acme"
            />
          </RowEditor>
        ))
      )}

      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}

      <Button title={isSaving ? "Saving…" : editing ? "Save Changes" : "Create Project"} onPress={handleSubmit} disabled={isSaving} />
    </FormModal>
  );
}
