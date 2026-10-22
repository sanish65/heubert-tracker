import { useState } from "react";
import { Alert } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Select } from "./ui";
import { SheetSubtitle, EmployeePicker, SheetActions, SheetNote } from "./SheetParts";
import { ESTIMATE_OPTIONS, PRIORITIES } from "../lib/taskBoard.js";

// Create issue, as the web's src/components/TaskCreateModal.js on a phone: type, summary,
// description, priority, assignee, points and where it lands. From the board it goes into the
// active sprint, elsewhere to the backlog, as on the web; sub-tasks are added from their
// parent's issue sheet.

const TYPES = [
  { value: "story", label: "Story" },
  { value: "task", label: "Task" },
  { value: "bug", label: "Bug" },
  { value: "epic", label: "Epic" },
];

export default function TaskCreateSheet({ project, board, employees, defaultSprintId = null, onClose, onCreated }) {
  const { currentEmployee } = useApp();
  const [type, setType] = useState("task");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assigneeName, setAssigneeName] = useState("");
  const [estimate, setEstimate] = useState("none");
  const [sprint, setSprint] = useState(defaultSprintId == null ? "backlog" : String(defaultSprintId));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const active = employees.filter((e) => e.status !== "resigned");
  const kanban = project.board_mode === "kanban";
  const sprintOptions = [
    { value: "backlog", label: "Backlog" },
    ...board.sprints.filter((s) => s.state !== "closed").map((s) => ({ value: String(s.id), label: s.name })),
  ];

  const submit = async () => {
    if (!title.trim()) {
      setError("Give the issue a summary.");
      return;
    }
    setBusy(true);
    const assignee = employees.find((e) => e.name === assigneeName);
    const { data, error: dbError } = await board.createIssue({
      type,
      title,
      description,
      priority,
      assignee_id: assignee?.id ?? null,
      estimate: type === "epic" || estimate === "none" ? null : Number(estimate),
      sprint_id: kanban || type === "epic" || sprint === "backlog" ? null : Number(sprint),
    });
    setBusy(false);
    if (dbError) {
      Alert.alert("Couldn't create the issue", dbError.message || "Check your connection and try again.");
      return;
    }
    onCreated?.(data);
    onClose();
  };

  return (
    <FormModal visible onClose={onClose} title="Create issue">
      <SheetSubtitle>
        In {project.name} ({project.issue_key})
      </SheetSubtitle>
      <Select label="Type" value={type} options={TYPES} onSelect={setType} />
      <TextField
        label="Summary"
        value={title}
        onChangeText={(v) => {
          setTitle(v);
          setError("");
        }}
        placeholder="What needs doing?"
        autoFocus
      />
      <TextField label="Description" value={description} onChangeText={setDescription} multiline />
      <Select label="Priority" value={priority} options={PRIORITIES.map((p) => ({ value: p.value, label: p.label }))} onSelect={setPriority} />
      <EmployeePicker label="Assignee" value={assigneeName} names={active.map((e) => e.name)} onChange={setAssigneeName} />
      {!assigneeName && currentEmployee ? (
        <Select label={null} value="" options={[{ value: "me", label: "Assign to me" }]} onSelect={() => setAssigneeName(currentEmployee.name)} />
      ) : null}
      {type !== "epic" ? (
        <Select
          label="Story points"
          value={estimate}
          options={[{ value: "none", label: "None" }, ...ESTIMATE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))]}
          onSelect={setEstimate}
        />
      ) : null}
      {!kanban && type !== "epic" ? <Select label="Sprint" value={sprint} options={sprintOptions} onSelect={setSprint} /> : null}
      {error ? <SheetNote>{error}</SheetNote> : null}
      <SheetActions title={busy ? "Creating..." : "Create issue"} icon="plus" onPress={submit} disabled={busy} onCancel={onClose} />
    </FormModal>
  );
}
