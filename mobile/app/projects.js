import { useMemo, useState } from "react";
import { View, Text, Pressable, Linking, Alert } from "react-native";
import { Stack } from "expo-router";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius } from "../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Button, Chip } from "../components/ui";
import { SkeletonList } from "../components/Skeleton";
import ProjectFormModal from "../components/ProjectFormModal";

const STATUSES = [
  { value: "planning", label: "Planning" },
  { value: "active", label: "Active" },
  { value: "on-hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  { value: "archived", label: "Archived" },
];

const STATUS_COLOR = {
  planning: "accentSky",
  active: "accentGreen",
  "on-hold": "accentAmber",
  completed: "accentIndigo",
  archived: "textMuted",
};

const CATEGORY_ICON = { repo: "🧑‍💻", board: "🗂️", design: "🎨", docs: "📄", other: "🔗" };

function statusLabel(value) {
  return STATUSES.find((s) => s.value === value)?.label || value || "—";
}

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function prettyUrl(url) {
  return (url || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

function openUrl(url) {
  if (!url) return;
  Linking.openURL(url).catch(() => Alert.alert("Couldn't open link", url));
}

function ProjectCard({ project, links, environments, members, isAdmin, onEdit, onDelete }) {
  const t = useThemeColors();
  const statusColor = t[STATUS_COLOR[project.status] || "accentGreen"];
  const techs = (project.tech_stack || "").split(",").map((tc) => tc.trim()).filter(Boolean);
  const start = formatDate(project.start_date);
  const end = formatDate(project.end_date);

  return (
    <Card>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={{ color: t.textPrimary, fontSize: 16, fontWeight: "800" }}>{project.name}</Text>
          {project.client ? <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>{project.client}</Text> : null}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <View style={{ backgroundColor: statusColor + "22", borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 4, marginRight: isAdmin ? 10 : 0 }}>
            <Text style={{ color: statusColor, fontSize: 11, fontWeight: "700" }}>{statusLabel(project.status)}</Text>
          </View>
          {isAdmin && (
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable onPress={() => onEdit(project)}>
                <Text style={{ fontSize: 15 }}>✏️</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(project)}>
                <Text style={{ color: t.accentRed, fontSize: 17 }}>×</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>

      {project.description ? (
        <Text style={{ color: t.textSecondary, fontSize: 13, marginBottom: 8 }}>{project.description}</Text>
      ) : null}

      {(start || end) && (
        <Text style={{ color: t.textMuted, fontSize: 12, marginBottom: 8 }}>
          🗓️ {start || "—"} → {end || "ongoing"}
        </Text>
      )}

      {techs.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 8 }}>
          {techs.map((tech) => (
            <View key={tech} style={{ backgroundColor: t.bgElevated, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginBottom: 6 }}>
              <Text style={{ color: t.textSecondary, fontSize: 11 }}>{tech}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={{ color: t.textMuted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>TEAM</Text>
      {members.length === 0 ? (
        <Text style={{ color: t.textMuted, fontSize: 12, marginBottom: 10 }}>No one staffed yet.</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 10 }}>
          {members.map((emp) => (
            <View key={emp.id} style={{ backgroundColor: t.accentIndigo + "1a", borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3, marginRight: 6, marginBottom: 6 }}>
              <Text style={{ color: t.accentIndigo, fontSize: 11, fontWeight: "600" }}>{emp.name}</Text>
            </View>
          ))}
        </View>
      )}

      <Text style={{ color: t.textMuted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>ENVIRONMENTS</Text>
      {environments.length === 0 ? (
        <Text style={{ color: t.textMuted, fontSize: 12, marginBottom: 10 }}>No environments recorded.</Text>
      ) : (
        <View style={{ marginBottom: 10 }}>
          {environments.map((env) => (
            <View key={env.id} style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: 4 }}>
              <Text style={{ color: t.textPrimary, fontSize: 12, fontWeight: "700", marginRight: 6 }}>{env.name}</Text>
              {env.url ? (
                <Pressable onPress={() => openUrl(env.url)}>
                  <Text style={{ color: t.accentSky, fontSize: 12 }}>{prettyUrl(env.url)}</Text>
                </Pressable>
              ) : (
                <Text style={{ color: t.textMuted, fontSize: 12 }}>No URL yet</Text>
              )}
              {env.branch ? <Text style={{ color: t.textMuted, fontSize: 11, marginLeft: 6 }}>⌥ {env.branch}</Text> : null}
            </View>
          ))}
        </View>
      )}

      <Text style={{ color: t.textMuted, fontSize: 11, fontWeight: "700", marginBottom: 4 }}>LINKS</Text>
      {links.length === 0 ? (
        <Text style={{ color: t.textMuted, fontSize: 12 }}>No links recorded.</Text>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {links.map((link) => (
            <Pressable
              key={link.id}
              onPress={() => openUrl(link.url)}
              style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.bgElevated, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 5, marginRight: 6, marginBottom: 6 }}
            >
              <Text style={{ fontSize: 12, marginRight: 4 }}>{CATEGORY_ICON[link.category] || "🔗"}</Text>
              <Text style={{ color: t.textSecondary, fontSize: 12, fontWeight: "600" }}>{link.label}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </Card>
  );
}

export default function ProjectsScreen() {
  const { projects, projectLinks, projectEnvironments, projectMembers, employees, deleteProject, isAdmin, isLoaded } = useApp();
  const [statusFilter, setStatusFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formKey, setFormKey] = useState(0);

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
    () => (statusFilter === "all" ? projects : projects.filter((p) => (p.status || "active") === statusFilter)),
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

  const confirmDelete = (project) => {
    Alert.alert("Delete project?", `"${project.name}" — its links and environments are deleted with it.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteProject(project.id) },
    ]);
  };

  const editingLinks = editing ? linksByProject.get(editing.id) || [] : [];
  const editingEnvs = editing ? envsByProject.get(editing.id) || [] : [];
  const editingMemberIds = editing
    ? projectMembers.filter((m) => m.project_id === editing.id).map((m) => m.employee_id)
    : [];

  return (
    <Screen>
      <Stack.Screen options={{ title: "Projects" }} />
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <SectionTitle>🚀 Projects</SectionTitle>
          {isAdmin && <Button title="+ New" small onPress={openAdd} />}
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
          <Chip label="All" active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
          {STATUSES.map((s) => (
            <Chip key={s.value} label={s.label} active={statusFilter === s.value} onPress={() => setStatusFilter(s.value)} />
          ))}
        </View>
      </Card>

      {!isLoaded ? (
        <Card>
          <SkeletonList count={3} />
        </Card>
      ) : visibleProjects.length === 0 ? (
        <EmptyState icon="🚀" text={projects.length === 0 ? "No projects have been added yet." : "No projects with this status."} />
      ) : (
        visibleProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            links={linksByProject.get(project.id) || []}
            environments={envsByProject.get(project.id) || []}
            members={membersByProject.get(project.id) || []}
            isAdmin={isAdmin}
            onEdit={openEdit}
            onDelete={confirmDelete}
          />
        ))
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
    </Screen>
  );
}
