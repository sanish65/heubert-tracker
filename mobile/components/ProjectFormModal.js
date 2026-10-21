import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Select, Button, IconButton } from "./ui";
import { SheetNote, SheetActions } from "./SheetParts";
import DateField from "./DateField";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { useThemeColors, radius, fonts } from "../lib/theme";

// A project's sheet, new or edited, in the record sheet's look (MobileRecordFine.dc.html): its
// details, the team (each person a chip with their face), its environments and its links (a raised
// block per row, removed with the bin), then the actions. The fields, the checks and the save are
// the ones this sheet had before the redesign.

const STATUSES = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on-hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const LINK_CATEGORIES = [
  { value: "repo", label: "Repo" },
  { value: "board", label: "Board" },
  { value: "design", label: "Design" },
  { value: "docs", label: "Docs" },
  { value: "other", label: "Other" },
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

// One environment or link being edited: a raised block, its name and the bin at the top.
function RowEditor({ title, removeLabel, children, onRemove }) {
  const t = useThemeColors();
  return (
    <View style={[styles.row, { backgroundColor: t.raised, borderColor: t.line }]}>
      <View style={styles.rowHead}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: t.text2 }]}>
          {title}
        </Text>
        <IconButton icon="trash" tone="plain" size={40} color={t.pfRed} onPress={onRemove} accessibilityLabel={removeLabel} style={styles.rowRemove} />
      </View>
      {children}
    </View>
  );
}

// A person to staff, picked or not: their face and name in a pill; picked is primary-soft on a
// primary edge with a check.
function MemberChip({ name, isMe, selected, onPress }) {
  const t = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityLabel={name}
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [
        styles.member,
        selected ? { backgroundColor: t.primarySoft, borderColor: t.primary } : { backgroundColor: pressed ? t.raised : t.surface, borderColor: t.lineStrong },
      ]}
    >
      <Avatar name={name} size={28} isMe={isMe} />
      <Text numberOfLines={1} style={[styles.memberName, { color: selected ? t.text1 : t.text2, fontFamily: selected ? fonts.bodySemibold : fonts.bodyMedium }]}>
        {name}
      </Text>
      {selected ? <Icon name="check" size={16} strokeWidth={2} color={t.primaryText} /> : null}
    </Pressable>
  );
}

export default function ProjectFormModal({ isOpen, onClose, editing, links, environments, memberEmployeeIds }) {
  const { addProject, updateProject, projects, employees, currentEmployee } = useApp();
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

  const listHead = (title, meta, action) => (
    <View style={styles.listHead}>
      <Text accessibilityRole="header" style={[styles.listTitle, { color: t.text1 }]}>
        {title}
      </Text>
      {meta ? <Text style={[styles.mono, { color: t.text3 }]}>{meta}</Text> : null}
      {action}
    </View>
  );

  return (
    <FormModal visible={isOpen} onClose={onClose} title={editing ? "Edit Project" : "New Project"}>
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

      <View style={[styles.section, { borderTopColor: t.line }]}>
        {listHead("Team Members", `${form.members.length} selected`)}
        {staffableEmployees.length === 0 ? (
          <Text style={[styles.empty, { color: t.text3 }]}>No employees to add yet.</Text>
        ) : (
          <View style={styles.members}>
            {staffableEmployees.map((emp) => (
              <MemberChip
                key={emp.id}
                name={emp.name}
                isMe={emp.id === currentEmployee?.id}
                selected={form.members.includes(emp.id)}
                onPress={() => toggleMember(emp.id)}
              />
            ))}
          </View>
        )}
      </View>

      <View style={[styles.section, { borderTopColor: t.line }]}>
        {listHead(
          "Environments",
          null,
          <Button title="Add environment" icon="plus" variant="secondary" small onPress={() => addRow("environments", emptyEnvRow())} />
        )}
        {form.environments.length === 0 ? (
          <Text style={[styles.empty, { color: t.text3 }]}>No environments yet.</Text>
        ) : (
          form.environments.map((env, i) => (
            <RowEditor key={env._key} title={env.name.trim() || `Environment ${i + 1}`} removeLabel={`Remove environment ${env.name.trim() || i + 1}`} onRemove={() => removeRow("environments", env._key)}>
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
        <Text style={[styles.hint, { color: t.text3 }]}>
          Environment rows are visible to everyone in the tracker — link the environment, never paste credentials.
        </Text>
      </View>

      <View style={[styles.section, { borderTopColor: t.line }]}>
        {listHead(
          "Links",
          null,
          <Button title="Add link" icon="plus" variant="secondary" small onPress={() => addRow("links", emptyLinkRow())} />
        )}
        {form.links.length === 0 ? (
          <Text style={[styles.empty, { color: t.text3 }]}>No links yet.</Text>
        ) : (
          form.links.map((link, i) => (
            <RowEditor key={link._key} title={link.label.trim() || `Link ${i + 1}`} removeLabel={`Remove link ${link.label.trim() || i + 1}`} onRemove={() => removeRow("links", link._key)}>
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
      </View>

      {error ? <SheetNote>{error}</SheetNote> : null}

      <SheetActions
        title={isSaving ? "Saving…" : editing ? "Save Changes" : "Create Project"}
        icon={editing ? "check" : "plus"}
        onPress={handleSubmit}
        disabled={isSaving}
        onCancel={onClose}
      />
    </FormModal>
  );
}

// Sizes and type from MobileRecordFine.dc.html: 16 between the sheet's parts; a list's head in the
// display face with its count in mono, a hairline above each list.
const styles = StyleSheet.create({
  mono: { fontFamily: fonts.mono, fontSize: 12 },
  section: { borderTopWidth: 1, paddingTop: 14, marginBottom: 16 },
  listHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  listTitle: { flex: 1, fontFamily: fonts.display, fontSize: 17 },
  empty: { fontFamily: fonts.body, fontSize: 13, marginBottom: 8 },
  hint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },

  members: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  member: { minHeight: 44, maxWidth: "100%", flexDirection: "row", alignItems: "center", gap: 8, paddingLeft: 8, paddingRight: 14, borderWidth: 1, borderRadius: radius.pill },
  memberName: { flexShrink: 1, fontSize: 14 },

  // A row being edited: 14 round, 12 in.
  row: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingBottom: 0, marginBottom: 10 },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44 },
  rowTitle: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14 },
  rowRemove: { marginRight: -8 },
});
