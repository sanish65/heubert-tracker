import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { issueKey, issueType, priorityInfo, childProgress, isOverdue } from "../lib/taskBoard.js";
import { statusMeta } from "../lib/taskWorkflow.js";
import { Pill } from "./ui";
import Icon from "./Icon";
import Avatar from "./Avatar";

// The small pieces the Tasks screens share, in the web's look (src/components/TaskBits.js):
// the issue type's icon tile, the status and priority pills and the issue row.

// The same icons as the web's TYPE_ICONS, on the type's pill colours.
const TYPE_LOOK = {
  epic: { icon: "sparkles", tone: ["pbViolet", "pfViolet"] },
  story: { icon: "book", tone: ["pbGreen", "pfGreen"] },
  task: { icon: "check", tone: ["pbBlue", "pfBlue"] },
  bug: { icon: "alert", tone: ["pbRed", "pfRed"] },
  subtask: { icon: "chevron-right", tone: ["pbCyan", "pfCyan"] },
};

// The web's status badge classes: the four built-in keys keep their own colour, a custom
// status takes its category's.
const STATUS_TONES = { todo: "blue", in_progress: "amber", review: "violet", done: "green" };

const PRIORITY_TONES = { highest: "red", high: "amber", medium: "blue", low: "gray", lowest: "gray" };

export function TypeIcon({ type, size = 22 }) {
  const t = useThemeColors();
  const look = TYPE_LOOK[type] || TYPE_LOOK.task;
  return (
    <View
      accessible
      accessibilityLabel={issueType(type).label}
      style={[styles.typeTile, { width: size, height: size, backgroundColor: t[look.tone[0]] }]}
    >
      <Icon name={look.icon} size={Math.round(size * 0.62)} strokeWidth={2.2} color={t[look.tone[1]]} />
    </View>
  );
}

export function StatusPill({ status, workflow }) {
  const meta = statusMeta(status, workflow);
  return (
    <Pill tone={STATUS_TONES[meta.cls] || "gray"} style={styles.selfStart}>
      {meta.label}
    </Pill>
  );
}

export function PriorityPill({ priority }) {
  return <Pill tone={PRIORITY_TONES[priority] || "blue"}>{priorityInfo(priority).label}</Pill>;
}

export function PointsBadge({ value }) {
  const t = useThemeColors();
  if (value == null) return null;
  return (
    <View accessible accessibilityLabel={`${value} points`} style={[styles.points, { borderColor: t.lineStrong }]}>
      <Text style={[styles.pointsText, { color: t.text1 }]}>{value}</Text>
    </View>
  );
}

// One issue: type, key, title, then status, points, sub-task progress and the assignee.
export function IssueRow({ task, project, tasks, workflow, employeesById, today, onPress, right, first = false }) {
  const t = useThemeColors();
  const assignee = employeesById.get(task.assignee_id);
  const progress = childProgress(task.id, tasks);
  const done = task.status_category === "done";
  const overdue = isOverdue(task, today);
  const key = issueKey(project, task);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${key}, ${task.title}`}
      style={({ pressed }) => [styles.row, { borderTopColor: first ? "transparent" : t.line }, pressed && { backgroundColor: t.pbGray }]}
    >
      <View style={styles.rowHead}>
        <TypeIcon type={task.type} />
        <Text style={[styles.key, { color: done ? t.text3 : t.cyanText, textDecorationLine: done ? "line-through" : "none" }]}>{key}</Text>
        {task.flagged ? <Icon name="flag" size={14} strokeWidth={2.2} color={t.pfRed} /> : null}
        <View style={styles.spacer} />
        {right}
      </View>
      <Text numberOfLines={2} style={[styles.title, { color: t.text1 }]}>
        {task.title}
      </Text>
      <View style={styles.rowMeta}>
        <StatusPill status={task.status} workflow={workflow} />
        <PointsBadge value={task.estimate} />
        {progress.total > 0 ? (
          <Text style={[styles.meta, { color: t.text3 }]}>
            {progress.done}/{progress.total} sub-tasks
          </Text>
        ) : null}
        {task.due_date ? <Text style={[styles.meta, { color: overdue ? t.pfRed : t.text3 }]}>Due {task.due_date}</Text> : null}
        <View style={styles.spacer} />
        {assignee ? <Avatar name={assignee.name} size={24} /> : <Text style={[styles.meta, { color: t.text3 }]}>Unassigned</Text>}
      </View>
    </Pressable>
  );
}

// The web's assignee avatars over the board (TaskFilterBar's AssigneeFilter): everyone with work
// in the project, overlapping, then an Unassigned disc. Each toggles; picking several shows any of
// their issues. On a phone the row scrolls sideways rather than folding into "+N".
export function AssigneeAvatars({ people, unassigned, picked, onToggle, meId }) {
  const t = useThemeColors();
  if (!people.length && !unassigned) return null;
  const ring = (on) => ({ borderColor: on ? t.primary : t.surfaceSolid });
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.avatarRow} accessibilityLabel="Filter by assignee">
      {people.map((e, i) => {
        const on = picked.includes(e.id);
        return (
          <Pressable
            key={e.id}
            onPress={() => onToggle(e.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={e.id === meId ? `${e.name} (you)` : e.name}
            hitSlop={4}
            style={[styles.avatarBtn, ring(on), i > 0 && styles.avatarOverlap, on && styles.avatarOn]}
          >
            <Avatar name={e.name} size={32} />
          </Pressable>
        );
      })}
      {unassigned ? (
        <Pressable
          onPress={() => onToggle(null)}
          accessibilityRole="button"
          accessibilityState={{ selected: picked.includes(null) }}
          accessibilityLabel="Unassigned"
          hitSlop={4}
          style={[styles.avatarBtn, ring(picked.includes(null)), people.length > 0 && styles.avatarOverlap, picked.includes(null) && styles.avatarOn]}
        >
          <View style={[styles.avatarNone, { backgroundColor: t.raised, borderColor: t.lineStrong }]}>
            <Text style={[styles.meta, { color: t.text3 }]}>?</Text>
          </View>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  avatarRow: { alignItems: "center", paddingVertical: 4, paddingHorizontal: 2 },
  // A 2px ring in the card's colour so the overlap reads; the primary colour when picked.
  avatarBtn: { borderRadius: radius.pill, borderWidth: 2 },
  avatarOverlap: { marginLeft: -8 },
  avatarOn: { zIndex: 1 },
  avatarNone: { width: 32, height: 32, borderRadius: radius.pill, borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  typeTile: { borderRadius: 6, alignItems: "center", justifyContent: "center" },
  selfStart: { alignSelf: "flex-start" },
  points: { minWidth: 24, height: 22, paddingHorizontal: 6, borderRadius: 6, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  pointsText: { fontFamily: fonts.monoMedium, fontSize: 12 },
  row: { paddingVertical: 12, borderTopWidth: 1, gap: 6, borderRadius: radius.sm },
  rowHead: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 24 },
  key: { fontFamily: fonts.mono, fontSize: 12 },
  spacer: { flex: 1 },
  title: { fontFamily: fonts.bodySemibold, fontSize: 15, lineHeight: 21 },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  meta: { fontFamily: fonts.body, fontSize: 12 },
});
