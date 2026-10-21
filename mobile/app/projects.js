import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Linking, Alert, StyleSheet } from "react-native";
import { useGoBack } from "../lib/useGoBack";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Screen, ScreenHeader, Card, Eyebrow, EmptyState, Button, IconButton } from "../components/ui";
import { SkeletonList } from "../components/Skeleton";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import ProjectFormModal from "../components/ProjectFormModal";

// Projects, in the order of the canvas's MobileProjects.dc.html: the header with New Project
// (admins), the status filter chips with their counts, then a card per project. A card shows its
// name, client, status, tech stack and team, with its environment and link counts; it opens in
// place ("Expand <name>") to show the description, the dates, the environments and the links, and,
// for admins, Edit Project and delete. The data and the actions are the ones this screen had before
// the redesign.

const STATUSES = [
  { value: "planning", label: "Planning", tone: "cyan" },
  { value: "active", label: "Active", tone: "green" },
  { value: "on-hold", label: "On Hold", tone: "amber" },
  { value: "completed", label: "Completed", tone: "violet" },
  { value: "archived", label: "Archived", tone: "gray" },
];

const TONE_KEYS = {
  cyan: ["pbCyan", "pfCyan"],
  green: ["pbGreen", "pfGreen"],
  amber: ["pbAmber", "pfAmber"],
  violet: ["pbViolet", "pfViolet"],
  gray: ["pbGray", "pfGray"],
  blue: ["pbBlue", "pfBlue"],
};

// A link's category: its icon and tile colours, as the canvas (repo blue, board green, design
// violet, docs amber); "other" is grey with the link icon.
const CATEGORIES = {
  repo: { icon: "code", tone: "blue" },
  board: { icon: "board", tone: "green" },
  design: { icon: "pen-tool", tone: "violet" },
  docs: { icon: "file-text", tone: "amber" },
  other: { icon: "link", tone: "gray" },
};

// The team stack shows this many faces, then "+N".
const STACK_FACES = 4;

const projectStatus = (project) => project.status || "active";
const statusOf = (value) => STATUSES.find((s) => s.value === value) || { label: value || "—", tone: "gray" };
const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

// Dates come back as a bare day or a full timestamp; read the day in local time, so a bare
// "YYYY-MM-DD" never shows as the day before.
function formatDate(value) {
  if (!value) return null;
  const [y, m, d] = String(value).split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function prettyUrl(url) {
  return (url || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

// Only web addresses open: the form saves every URL as http(s), and anything else in a row is not
// handed to the phone to launch.
function openUrl(url) {
  if (!url || !/^https?:\/\//i.test(url)) {
    Alert.alert("Couldn't open link", url || "");
    return;
  }
  Linking.openURL(url).catch(() => Alert.alert("Couldn't open link", url));
}

// The canvas's environment dots: Production green, Staging amber, anything else (Development) cyan.
function envDot(t, name) {
  const n = (name || "").toLowerCase();
  if (n.includes("prod")) return t.green;
  if (n.includes("stag")) return t.unpaid;
  return t.cyan;
}

function FilterChip({ label, count, active, onPress }) {
  const t = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={`${label}, ${plural(count, "project")}`}
      style={({ pressed }) => [
        styles.chip,
        active ? { backgroundColor: t.primarySoft, borderColor: t.primary } : { backgroundColor: pressed ? t.raised : t.surface, borderColor: t.lineStrong },
      ]}
    >
      <Text numberOfLines={1} style={[styles.chipText, { color: active ? t.text1 : t.text2, fontFamily: active ? fonts.bodySemibold : fonts.bodyMedium }]}>
        {label}
      </Text>
      {/* text3 holds on the glass chip; on the tinted chosen one, text2. */}
      <Text style={[styles.mono, { color: active ? t.text2 : t.text3 }]}>{count}</Text>
    </Pressable>
  );
}

function StatusPill({ status }) {
  const t = useThemeColors();
  const { label, tone } = statusOf(status);
  const [fill, text] = TONE_KEYS[tone];
  return (
    <View style={[styles.status, { backgroundColor: t[fill] }]}>
      <View style={[styles.statusDot, { backgroundColor: t[text] }]} />
      <Text numberOfLines={1} style={[styles.statusText, { color: t[text] }]}>
        {label}
      </Text>
    </View>
  );
}

// The team's faces overlapping, the first four and "+N" for the rest, on the solid surface's ring.
function TeamStack({ members }) {
  const t = useThemeColors();
  const { currentEmployee } = useApp();
  if (members.length === 0) {
    return <Text style={[styles.noTeam, { color: t.text3 }]}>No one staffed yet.</Text>;
  }
  const shown = members.slice(0, STACK_FACES);
  const more = members.length - shown.length;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`Team: ${members.map((m) => m.name).join(", ")}`} style={styles.stack}>
      {shown.map((emp, i) => (
        <View key={emp.id} style={[styles.face, { borderColor: t.surfaceSolid }, i > 0 && styles.faceOverlap]}>
          <Avatar name={emp.name} size={30} isMe={emp.id === currentEmployee?.id} />
        </View>
      ))}
      {more > 0 ? (
        <View style={[styles.face, styles.faceOverlap, styles.more, { borderColor: t.surfaceSolid, backgroundColor: t.raised }]}>
          <Text style={[styles.moreText, { color: t.text2 }]}>+{more}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Count({ icon, children }) {
  const t = useThemeColors();
  return (
    <View style={styles.count}>
      <Icon name={icon} size={14} color={t.text3} />
      <Text style={[styles.mono, { color: t.text3 }]}>{children}</Text>
    </View>
  );
}

function EnvironmentRow({ env }) {
  const t = useThemeColors();
  const content = (
    <>
      <View style={[styles.envDot, { backgroundColor: envDot(t, env.name) }]} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: t.text1 }]}>
          {env.name}
        </Text>
        {env.url ? (
          <Text numberOfLines={1} style={[styles.mono, { color: t.primaryText }]}>
            {prettyUrl(env.url)}
          </Text>
        ) : (
          <Text style={[styles.mono, { color: t.text3 }]}>No URL yet</Text>
        )}
      </View>
      {env.branch ? (
        <View style={[styles.branch, { backgroundColor: t.raised }]}>
          <Icon name="git-branch" size={12} strokeWidth={2} color={t.text3} />
          <Text numberOfLines={1} style={[styles.mono, styles.branchText, { color: t.text3 }]}>
            {env.branch}
          </Text>
        </View>
      ) : null}
      {env.url ? <Icon name="external" size={16} color={t.text3} /> : null}
    </>
  );
  const rowStyle = [styles.envRow, { borderBottomColor: t.line }];
  if (!env.url) return <View style={rowStyle}>{content}</View>;
  return (
    <Pressable
      onPress={() => openUrl(env.url)}
      accessibilityRole="link"
      accessibilityLabel={`${env.name}, ${prettyUrl(env.url)}${env.branch ? `, branch ${env.branch}` : ""}`}
      style={({ pressed }) => [rowStyle, pressed && styles.pressed]}
    >
      {content}
    </Pressable>
  );
}

function LinkRow({ link }) {
  const t = useThemeColors();
  const category = CATEGORIES[link.category] ? link.category : "other";
  const { icon, tone } = CATEGORIES[category];
  const [fill, text] = TONE_KEYS[tone];
  return (
    <Pressable
      onPress={() => openUrl(link.url)}
      accessibilityRole="link"
      accessibilityLabel={`${link.label}, ${category}`}
      style={({ pressed }) => [styles.linkRow, { borderBottomColor: t.line }, pressed && styles.pressed]}
    >
      <View style={[styles.linkTile, { backgroundColor: t[fill] }]}>
        <Icon name={icon} size={17} color={t[text]} />
      </View>
      <View style={styles.linkText}>
        <Text numberOfLines={1} style={[styles.rowTitle, { color: t.text1 }]}>
          {link.label}
        </Text>
        <Text style={[styles.mono, { color: t.text3 }]}>{category}</Text>
      </View>
      <Icon name="external" size={16} color={t.text3} />
    </Pressable>
  );
}

function ProjectCard({ project, links, environments, members, expanded, onToggle, isAdmin, onEdit, onDelete }) {
  const t = useThemeColors();
  const techs = (project.tech_stack || "").split(",").map((tc) => tc.trim()).filter(Boolean);
  const start = formatDate(project.start_date);
  const end = formatDate(project.end_date);

  return (
    <Card style={[styles.card, expanded && { backgroundColor: t.surfaceStrong, borderColor: t.lineStrong, borderTopColor: t.glassHi }]}>
      <View style={styles.cardHead}>
        <View style={styles.cardTitle}>
          <Text accessibilityRole="header" style={[styles.name, { color: t.text1 }]}>
            {project.name}
          </Text>
          {project.client ? <Text style={[styles.client, { color: t.text3 }]}>{project.client}</Text> : null}
        </View>
        <StatusPill status={projectStatus(project)} />
      </View>

      {expanded && project.description ? <Text style={[styles.description, { color: t.text2 }]}>{project.description}</Text> : null}

      {expanded && (start || end) ? (
        <View style={styles.dates}>
          <Icon name="calendar" size={15} color={t.text3} />
          <Text style={[styles.mono, { color: t.text3 }]}>
            {start || "—"} → {end || "ongoing"}
          </Text>
        </View>
      ) : null}

      {techs.length > 0 ? (
        <View style={styles.techs}>
          {techs.map((tech) => (
            <View key={tech} style={[styles.tech, { borderColor: t.line, backgroundColor: t.raised }]}>
              <Text style={[styles.mono, { color: t.text2 }]}>{tech}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.teamRow}>
        <TeamStack members={members} />
        <View style={styles.counts}>
          <Count icon="server">{environments.length} env</Count>
          <Count icon="link">{plural(links.length, "link")}</Count>
        </View>
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={`${expanded ? "Collapse" : "Expand"} ${project.name}`}
          accessibilityState={{ expanded }}
          style={({ pressed }) => [
            styles.toggle,
            { borderColor: t.line, backgroundColor: expanded ? t.primarySoft : pressed ? t.raised : "transparent" },
          ]}
        >
          <Icon name={expanded ? "chevron-up" : "chevron-down"} size={18} strokeWidth={2} color={expanded ? t.primaryText : t.text2} />
        </Pressable>
      </View>

      {expanded ? (
        <>
          <View style={[styles.section, { borderTopColor: t.line }]}>
            <Eyebrow style={styles.sectionHead}>Environments</Eyebrow>
            {environments.length === 0 ? (
              <Text style={[styles.empty, { color: t.text3 }]}>No environments recorded.</Text>
            ) : (
              environments.map((env) => <EnvironmentRow key={env.id} env={env} />)
            )}
            <Text style={[styles.note, { color: t.text3 }]}>Pointers only — never paste credentials here.</Text>
          </View>

          <View>
            <Eyebrow style={[styles.sectionHead, styles.linksHead]}>Links</Eyebrow>
            {links.length === 0 ? (
              <Text style={[styles.empty, { color: t.text3 }]}>No links recorded.</Text>
            ) : (
              links.map((link) => <LinkRow key={link.id} link={link} />)
            )}
          </View>

          {isAdmin ? (
            <View style={styles.actions}>
              <Button
                title="Edit Project"
                icon="edit"
                variant="secondary"
                onPress={() => onEdit(project)}
                style={[styles.editBtn, { backgroundColor: t.raised }]}
              />
              <IconButton
                icon="trash"
                tone="danger"
                size={48}
                onPress={() => onDelete(project)}
                accessibilityLabel={`Delete ${project.name}`}
                style={styles.deleteBtn}
              />
            </View>
          ) : null}
        </>
      ) : null}
    </Card>
  );
}

export default function ProjectsScreen() {
  const { projects, projectLinks, projectEnvironments, projectMembers, employees, deleteProject, isAdmin, isLoaded } = useApp();
  const t = useThemeColors();
  const goBack = useGoBack();
  const [statusFilter, setStatusFilter] = useState("all");
  const [expandedIds, setExpandedIds] = useState(() => new Set());
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

  // How many projects each status has, for the chips.
  const counts = useMemo(() => {
    const map = new Map();
    for (const p of projects) map.set(projectStatus(p), (map.get(projectStatus(p)) || 0) + 1);
    return map;
  }, [projects]);

  const visibleProjects = useMemo(
    () => (statusFilter === "all" ? projects : projects.filter((p) => projectStatus(p) === statusFilter)),
    [projects, statusFilter]
  );

  const toggle = (id) =>
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await deleteProject(project.id);
          if (error) Alert.alert("Couldn't delete project", error.message || "Something went wrong");
        },
      },
    ]);
  };

  const editingLinks = editing ? linksByProject.get(editing.id) || [] : [];
  const editingEnvs = editing ? envsByProject.get(editing.id) || [] : [];
  const editingMemberIds = editing
    ? projectMembers.filter((m) => m.project_id === editing.id).map((m) => m.employee_id)
    : [];

  const newButton = isAdmin ? <Button title="New Project" icon="plus" small onPress={openAdd} style={[styles.newBtn, { boxShadow: t.glowPrimary }]} /> : null;

  return (
    <Screen>
      <ScreenHeader
        title="Projects"
        subtitle={isLoaded ? `${plural(projects.length, "project")} · ${counts.get("active") || 0} active` : null}
        onBack={goBack}
        right={newButton}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersRow}>
        <FilterChip label="All" count={projects.length} active={statusFilter === "all"} onPress={() => setStatusFilter("all")} />
        {STATUSES.map((s) => (
          <FilterChip key={s.value} label={s.label} count={counts.get(s.value) || 0} active={statusFilter === s.value} onPress={() => setStatusFilter(s.value)} />
        ))}
      </ScrollView>

      {!isLoaded ? (
        <Card style={styles.card}>
          <SkeletonList count={3} />
        </Card>
      ) : visibleProjects.length === 0 ? (
        <Card style={styles.card}>
          <EmptyState icon="folder" text={projects.length === 0 ? "No projects have been added yet." : "No projects with this status."} />
        </Card>
      ) : (
        visibleProjects.map((project) => (
          <ProjectCard
            key={project.id}
            project={project}
            links={linksByProject.get(project.id) || []}
            environments={envsByProject.get(project.id) || []}
            members={membersByProject.get(project.id) || []}
            expanded={expandedIds.has(project.id)}
            onToggle={() => toggle(project.id)}
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

// Sizes, gaps and type from MobileProjects.dc.html; letter-spacing in em becomes pixels at the text's
// size.
const styles = StyleSheet.create({
  mono: { fontFamily: fonts.mono, fontSize: 12 },
  pressed: { opacity: 0.7 },

  // New Project: 44 high, 12 round, its glow.
  newBtn: { minHeight: 44, borderRadius: radius.md, paddingLeft: 12 },
  // The header's count line, under the title (Back 44 + 12).

  // Filter chips: 44 high, 14 across, 8 apart, scrolling sideways edge to edge.
  filters: { flexGrow: 0, marginHorizontal: -16, marginBottom: 14 },
  filtersRow: { paddingHorizontal: 16, gap: 8 },
  chip: { height: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: 14 },

  // A project: 20 round, 16 by 18 in, 12 between its parts and between cards.
  card: { borderRadius: radius.xl, marginBottom: 12, gap: 12 },
  cardHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  cardTitle: { flex: 1, minWidth: 0, gap: 2 },
  name: { fontFamily: fonts.display, fontSize: 18 },
  client: { fontFamily: fonts.body, fontSize: 13 },
  status: { height: 24, flexShrink: 0, paddingHorizontal: 10, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: 6 },
  statusDot: { width: 6, height: 6, borderRadius: radius.pill },
  statusText: { fontFamily: fonts.bodySemibold, fontSize: 12 },
  description: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  dates: { flexDirection: "row", alignItems: "center", gap: 8 },
  techs: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tech: { height: 26, paddingHorizontal: 9, borderWidth: 1, borderRadius: 8, justifyContent: "center" },

  // The team row: the faces, the counts pushed right, the 44 toggle.
  teamRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  stack: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  // A 30 face inside a 2px ring, 8 under the one before.
  face: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  faceOverlap: { marginLeft: -8 },
  more: { overflow: "hidden" },
  moreText: { fontFamily: fonts.mono, fontSize: 11 },
  noTeam: { flexShrink: 1, fontFamily: fonts.body, fontSize: 13 },
  counts: { marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 10 },
  count: { flexDirection: "row", alignItems: "center", gap: 5 },
  toggle: { width: 44, height: 44, flexShrink: 0, borderWidth: 1, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },

  // Environments: a hairline above, 12 in; rows at least 56 with a hairline under.
  section: { borderTopWidth: 1, paddingTop: 12 },
  sectionHead: { marginBottom: 4 },
  linksHead: { marginTop: 4 },
  envRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 10, borderBottomWidth: 1 },
  envDot: { width: 8, height: 8, flexShrink: 0, borderRadius: radius.pill },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: fonts.bodySemibold, fontSize: 14 },
  branch: { flexShrink: 0, maxWidth: 120, height: 24, paddingHorizontal: 8, borderRadius: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  branchText: { flexShrink: 1 },
  note: { marginTop: 8, fontFamily: fonts.body, fontSize: 13 },
  empty: { paddingVertical: 8, fontFamily: fonts.body, fontSize: 13 },

  // Links: rows at least 52, the 34 category tile 12 from the text.
  linkRow: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1 },
  linkTile: { width: 34, height: 34, flexShrink: 0, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  linkText: { flex: 1, minWidth: 0 },

  // Edit Project across the card, delete 48 square beside it.
  actions: { flexDirection: "row", gap: 10, paddingTop: 4 },
  editBtn: { flex: 1, minHeight: 48, borderRadius: radius.md },
  deleteBtn: { borderRadius: radius.md },
});
