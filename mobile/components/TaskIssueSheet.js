import { useState } from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { FormModal, TextField, Select, Button, Eyebrow } from "./ui";
import { FieldLabel, EmployeePicker } from "./SheetParts";
import DateField from "./DateField";
import Avatar from "./Avatar";
import { TypeIcon, StatusPill } from "./TaskBits";
import { useIssueDetail } from "../lib/useTasks";
import { ESTIMATE_OPTIONS, PRIORITIES, canDeleteTask, issueKey, issueType, sortByRank } from "../lib/taskBoard.js";
import { nextStatuses, statusMeta } from "../lib/taskWorkflow.js";
import { formatDuration, parseDuration, timeTracking } from "../lib/taskExtras.js";
import { localToday } from "../lib/dates";

// One issue, as the web's issue view (src/components/TaskIssueModal.js) laid out for a phone:
// the status (only where this workflow lets it go next), the people and planning fields, the
// description, sub-tasks, time and comments. Every field saves as it changes, as on the web;
// the title, description and labels save with their own button.

function when(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function Section({ title, children }) {
  return (
    <View style={styles.section}>
      <Eyebrow style={styles.sectionTitle}>{title}</Eyebrow>
      {children}
    </View>
  );
}

export default function TaskIssueSheet({ issue, project, board, employees, onClose, onOpenIssue, onMoved }) {
  const t = useThemeColors();
  const { isAdmin, user, currentEmployee, projects } = useApp();
  const detail = useIssueDetail(issue?.id ?? null);
  const [title, setTitle] = useState(issue?.title || "");
  const [description, setDescription] = useState(issue?.description || "");
  const [labels, setLabels] = useState((issue?.labels || []).join(", "));
  const [comment, setComment] = useState("");
  const [subtask, setSubtask] = useState("");
  const [logTime, setLogTime] = useState("");
  const [busy, setBusy] = useState(false);

  if (!issue) return null;

  const workflow = board.workflow;
  const key = issueKey(project, issue);
  const active = employees.filter((e) => e.status !== "resigned");
  const assignee = employees.find((e) => e.id === issue.assignee_id);
  const children = sortByRank(board.tasks.filter((x) => x.parent_id === issue.id && x.type === "subtask"));
  const time = timeTracking(issue);
  const canDelete = canDeleteTask({ task: issue, isAdmin, email: user?.email });

  const save = async (fields) => {
    setBusy(true);
    const { error } = await board.updateIssue(issue.id, fields);
    setBusy(false);
    if (error) Alert.alert("Couldn't save", error.message || "Check your connection and try again.");
    return !error;
  };

  // The statuses this one may move to, current first, as the web's status menu.
  const statusOptions = nextStatuses(issue.status, workflow).map((s) => ({ value: s.value, label: s.label }));
  if (!statusOptions.some((o) => o.value === issue.status)) {
    statusOptions.unshift({ value: issue.status, label: statusMeta(issue.status, workflow).label });
  }

  const sprintOptions = [
    { value: "backlog", label: "Backlog" },
    ...board.sprints.filter((s) => s.state !== "closed" || s.id === issue.sprint_id).map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const addSubtask = async () => {
    const text = subtask.trim();
    if (!text) return;
    setBusy(true);
    const { error } = await board.createIssue({ type: "subtask", title: text, parent_id: issue.id, sprint_id: issue.sprint_id ?? null });
    setBusy(false);
    if (error) Alert.alert("Couldn't add the sub-task", error.message || "");
    else setSubtask("");
  };

  const addComment = async () => {
    if (!comment.trim()) return;
    setBusy(true);
    const { error } = await detail.addComment(comment);
    setBusy(false);
    if (error) Alert.alert("Couldn't post the comment", error.message || "");
    else setComment("");
  };

  const addWorklog = async () => {
    const minutes = parseDuration(logTime);
    if (!minutes) {
      Alert.alert("Time spent", "Use a duration like 2h, 30m or 1d 4h.");
      return;
    }
    setBusy(true);
    const { error } = await detail.addWorklog({ minutes, work_date: localToday() });
    if (!error) await board.reload();
    setBusy(false);
    if (error) Alert.alert("Couldn't log the time", error.message || "");
    else setLogTime("");
  };

  // Jira's Move, as the web's Move dialog: the other open projects with a key.
  const moveTargets = (projects || []).filter((p) => p.id !== project.id && p.issue_key && p.status !== "archived");
  const confirmMove = (targetId) => {
    const target = moveTargets.find((p) => p.id === Number(targetId));
    if (!target) return;
    const subtasks = children.length ? ` Its ${children.length} sub-task${children.length === 1 ? " moves" : "s move"} with it.` : "";
    Alert.alert(
      `Move ${key} to ${target.name}?`,
      `It gets ${target.issue_key}'s next number (links to ${key} keep working), goes to the matching status, and leaves its sprint, epic and fix version.${subtasks}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Move",
          onPress: async () => {
            setBusy(true);
            const { data, error } = await board.moveToProject(issue.id, target.id);
            setBusy(false);
            if (error) Alert.alert(`Couldn't move ${key}`, error.message || "");
            else onMoved?.(data);
          },
        },
      ]
    );
  };

  const confirmDelete = () => {
    Alert.alert(`Delete ${key}?`, "Its sub-tasks, comments and history are deleted with it. This can't be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await board.deleteIssue(issue.id);
          if (error) Alert.alert("Couldn't delete", error.message || "");
          else onClose();
        },
      },
    ]);
  };

  const confirmDeleteComment = (c) => {
    Alert.alert("Delete this comment?", "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await detail.deleteComment(c.id);
          if (error) Alert.alert("Couldn't delete", error.message || "");
        },
      },
    ]);
  };

  const parent = issue.parent_id ? board.tasks.find((x) => x.id === issue.parent_id) : null;
  const titleDirty = title.trim() !== (issue.title || "") && title.trim().length > 0;
  const descriptionDirty = description.trim() !== (issue.description || "");
  const labelsDirty = labels !== (issue.labels || []).join(", ");

  return (
    <FormModal visible onClose={onClose} title={key}>
      <View style={styles.typeRow}>
        <TypeIcon type={issue.type} />
        <Text style={[styles.typeText, { color: t.text2 }]}>{issueType(issue.type).label}</Text>
        {parent ? (
          <Pressable onPress={() => onOpenIssue(parent.id)} accessibilityRole="button" accessibilityLabel={`Parent ${issueKey(project, parent)}`}>
            <Text style={[styles.parent, { color: t.cyanText }]}>in {issueKey(project, parent)}</Text>
          </Pressable>
        ) : null}
      </View>

      <TextField label="Summary" value={title} onChangeText={setTitle} />
      {titleDirty ? <Button small title="Save summary" onPress={() => save({ title })} disabled={busy} style={styles.inlineSave} /> : null}

      <Select label="Status" value={issue.status} options={statusOptions} onSelect={(status) => status !== issue.status && save({ status })} />

      <EmployeePicker
        label="Assignee"
        value={assignee?.name || ""}
        names={active.map((e) => e.name)}
        onChange={(name) => save({ assignee_id: employees.find((e) => e.name === name)?.id ?? null })}
      />
      {assignee ? (
        <View style={styles.unassignRow}>
          {currentEmployee && assignee.id !== currentEmployee.id ? (
            <Button small variant="ghost" title="Assign to me" onPress={() => save({ assignee_id: currentEmployee.id })} />
          ) : null}
          <Button small variant="ghost" title="Unassign" onPress={() => save({ assignee_id: null })} />
        </View>
      ) : currentEmployee ? (
        <Button small variant="ghost" title="Assign to me" onPress={() => save({ assignee_id: currentEmployee.id })} style={styles.inlineSave} />
      ) : null}

      <Select label="Priority" value={issue.priority} options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} onSelect={(priority) => save({ priority })} />

      {issue.type !== "epic" ? (
        <Select
          label="Story points"
          value={issue.estimate == null ? "none" : String(issue.estimate)}
          options={[{ value: "none", label: "None" }, ...ESTIMATE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))]}
          onSelect={(v) => save({ estimate: v === "none" ? null : Number(v) })}
        />
      ) : null}

      {/* A sub-task sits in its parent's sprint (the database keeps it there). */}
      {project.board_mode !== "kanban" && issue.type !== "subtask" && issue.type !== "epic" ? (
        <Select
          label="Sprint"
          value={issue.sprint_id == null ? "backlog" : String(issue.sprint_id)}
          options={sprintOptions}
          onSelect={(v) => save({ sprint_id: v === "backlog" ? null : Number(v) })}
        />
      ) : null}

      <DateField label="Due date" value={issue.due_date || ""} onChange={(due_date) => save({ due_date })} clearable />

      <TextField label="Labels" value={labels} onChangeText={setLabels} placeholder="ui, payments" />
      {labelsDirty ? <Button small title="Save labels" onPress={() => save({ labels })} disabled={busy} style={styles.inlineSave} /> : null}

      <TextField label="Description" value={description} onChangeText={setDescription} multiline placeholder="What needs doing, and why" />
      {descriptionDirty ? (
        <Button small title="Save description" onPress={() => save({ description })} disabled={busy} style={styles.inlineSave} />
      ) : null}

      {issue.type !== "subtask" && issue.type !== "epic" ? (
        <Section title={`Sub-tasks · ${children.length}`}>
          {children.map((c) => (
            <Pressable
              key={c.id}
              onPress={() => onOpenIssue(c.id)}
              accessibilityRole="button"
              accessibilityLabel={`${issueKey(project, c)}, ${c.title}`}
              style={({ pressed }) => [styles.child, { borderColor: t.line, backgroundColor: pressed ? t.pbGray : t.raised }]}
            >
              <Text style={[styles.childKey, { color: t.cyanText }]}>{issueKey(project, c)}</Text>
              <Text numberOfLines={1} style={[styles.childTitle, { color: t.text1 }]}>
                {c.title}
              </Text>
              <StatusPill status={c.status} workflow={workflow} />
            </Pressable>
          ))}
          <TextField value={subtask} onChangeText={setSubtask} placeholder="Add a sub-task" returnKeyType="done" onSubmitEditing={addSubtask} />
          {subtask.trim() ? <Button small title="Add sub-task" onPress={addSubtask} disabled={busy} style={styles.inlineSave} /> : null}
        </Section>
      ) : null}

      <Section title="Time tracking">
        <Text style={[styles.body, { color: t.text2 }]}>
          {time.hasAny
            ? `${formatDuration(time.spent) || "0m"} logged${time.remaining != null ? ` · ${formatDuration(time.remaining)} remaining` : ""}${
                time.original != null ? ` · ${formatDuration(time.original)} estimated` : ""
              }`
            : "No time logged yet."}
        </Text>
        <TextField label="Log time" value={logTime} onChangeText={setLogTime} placeholder="2h, 30m, 1d 4h" />
        {logTime.trim() ? <Button small title="Log time for today" onPress={addWorklog} disabled={busy} style={styles.inlineSave} /> : null}
        {detail.worklogs.slice(0, 5).map((w) => (
          <Text key={w.id} style={[styles.small, { color: t.text3 }]}>
            {w.work_date} · {formatDuration(w.minutes)}
            {w.author_email ? ` · ${w.author_email}` : ""}
            {w.note ? ` · ${w.note}` : ""}
          </Text>
        ))}
      </Section>

      <Section title={`Comments · ${detail.comments.length}`}>
        {detail.comments.map((c) => {
          const mine = c.author_email && user?.email && c.author_email.toLowerCase() === user.email.toLowerCase();
          return (
            <View key={c.id} style={[styles.comment, { borderColor: t.line, backgroundColor: t.raised }]}>
              <View style={styles.commentHead}>
                <Avatar name={c.author_name || c.author_email || "?"} size={24} />
                <Text numberOfLines={1} style={[styles.commentAuthor, { color: t.text1 }]}>
                  {c.author_name || c.author_email}
                </Text>
                <Text style={[styles.small, { color: t.text3 }]}>{when(c.created_at)}</Text>
              </View>
              <Text style={[styles.body, { color: t.text1 }]}>{c.body}</Text>
              {mine || isAdmin ? (
                <Pressable onPress={() => confirmDeleteComment(c)} accessibilityRole="button" accessibilityLabel="Delete comment" hitSlop={8}>
                  <Text style={[styles.small, { color: t.pfRed }]}>Delete</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <TextField value={comment} onChangeText={setComment} placeholder="Add a comment" multiline />
        {comment.trim() ? <Button small title="Post comment" icon="send" onPress={addComment} disabled={busy} style={styles.inlineSave} /> : null}
      </Section>

      {canDelete ? (
        <View style={styles.footer}>
          <FieldLabel>Danger zone</FieldLabel>
          {issue.type !== "subtask" && moveTargets.length ? (
            <Select
              label="Move to project"
              value=""
              options={moveTargets.map((p) => ({ value: String(p.id), label: `${p.issue_key} · ${p.name}` }))}
              onSelect={confirmMove}
            />
          ) : null}
          <Button variant="danger" icon="trash" title={`Delete ${key}`} onPress={confirmDelete} />
        </View>
      ) : null}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  typeRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: -8, marginBottom: 16 },
  typeText: { fontFamily: fonts.bodyMedium, fontSize: 14 },
  parent: { fontFamily: fonts.mono, fontSize: 13 },
  inlineSave: { alignSelf: "flex-start", marginTop: -6, marginBottom: 14 },
  unassignRow: { flexDirection: "row", gap: 8, marginTop: -10, marginBottom: 10 },
  section: { marginTop: 8, marginBottom: 12, gap: 8 },
  sectionTitle: { marginBottom: 2 },
  child: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: radius.sm },
  childKey: { fontFamily: fonts.mono, fontSize: 12 },
  childTitle: { flex: 1, fontFamily: fonts.body, fontSize: 14 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 12 },
  comment: { padding: 12, borderWidth: 1, borderRadius: radius.sm, gap: 6 },
  commentHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  commentAuthor: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 13 },
  footer: { marginTop: 12, gap: 4 },
});
