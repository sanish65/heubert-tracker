import { useEffect, useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useGoBack } from "../lib/useGoBack";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Screen, ScreenHeader, Card, Eyebrow, EmptyState, Button, IconButton, Chip, TextField, FormModal, Pill } from "../components/ui";
import { SheetSwitch, SheetActions, SheetNote, SheetSubtitle } from "../components/SheetParts";
import { SkeletonList } from "../components/Skeleton";
import { IssueRow } from "../components/TaskBits";
import TaskIssueSheet from "../components/TaskIssueSheet";
import TaskCreateSheet from "../components/TaskCreateSheet";
import { useTasks } from "../lib/useTasks";
import {
  activeSprintOf,
  backlogSections,
  boardIssues,
  filterIssues,
  groupByStatus,
  issueKey,
  orderAtBottom,
  parseIssueKey,
  sumPoints,
} from "../lib/taskBoard.js";
import { kanbanIssues, normalizeWipLimits, wipStatus } from "../lib/taskExtras.js";
import { nextStatuses } from "../lib/taskWorkflow.js";
import { BUILT_IN_FILTERS, compileQuery, sortIssues } from "../lib/taskQuery.js";
import { localToday } from "../lib/dates";

// Tasks, as the web's Tasks tab (src/components/TasksPage.js) for a phone: pick a project, then
// its Board (one workflow column at a time; "Move" offers only the statuses the workflow allows),
// its Backlog (open sprints, then the backlog) or Issues (search, JQL and saved filters). An
// issue opens in a sheet. Sprints, releases, reports and the workflow itself are managed on the
// web. Opened as /tasks?issue=POR-4 (the bell, a shared key) it picks that project and opens the
// issue; a new `issue` (or `at`) value while the screen is open opens that one.

const PROJECT_KEY = "heubert-tasks-project";
const VIEWS = [
  { value: "board", label: "Board" },
  { value: "backlog", label: "Backlog" },
  { value: "issues", label: "Issues" },
];

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function shortDate(value) {
  if (!value) return "";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Statuses an issue can move to from where it is, as the board's drop rules.
function MoveSheet({ issue, project, board, onClose }) {
  const t = useThemeColors();
  const options = nextStatuses(issue.status, board.workflow).filter((s) => s.value !== issue.status);
  const move = async (status) => {
    const column = board.tasks.filter((x) => x.status === status && (x.sprint_id ?? null) === (issue.sprint_id ?? null));
    const { error } = await board.updateIssue(issue.id, { status, sort_order: orderAtBottom(column) });
    if (error) Alert.alert("Couldn't move the issue", error.message || "");
    else onClose();
  };
  return (
    <FormModal visible onClose={onClose} title={`Move ${issueKey(project, issue)}`}>
      <SheetSubtitle>{issue.title}</SheetSubtitle>
      {options.length === 0 ? (
        <EmptyState icon="lock" text="This workflow doesn't let it move anywhere from here." />
      ) : (
        options.map((s) => (
          <Pressable
            key={s.value}
            onPress={() => move(s.value)}
            accessibilityRole="button"
            style={({ pressed }) => [styles.moveRow, { borderColor: t.lineStrong, backgroundColor: pressed ? t.pbGray : t.raised }]}
          >
            <Text style={[styles.moveText, { color: t.text1 }]}>{s.label}</Text>
            <Text style={[styles.small, { color: t.text3 }]}>{s.category === "done" ? "Done" : s.category === "progress" ? "In progress" : "To do"}</Text>
          </Pressable>
        ))
      )}
    </FormModal>
  );
}

function SaveFilterSheet({ query, board, onClose, onSaved }) {
  const [name, setName] = useState("");
  const [shared, setShared] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return setError("Give the filter a name.");
    setBusy(true);
    const { data, error: dbError } = await board.createFilter({ name: name.slice(0, 60), query: query.trim(), shared });
    setBusy(false);
    if (dbError) return setError(dbError.message || "Couldn't save the filter.");
    onSaved(data);
    onClose();
  };
  return (
    <FormModal visible onClose={onClose} title="Save filter">
      <TextField label="Name" value={name} onChangeText={(v) => { setName(v); setError(""); }} autoFocus />
      <SheetSwitch label="Share with the team" description="Everyone on this project can use it" value={shared} onValueChange={setShared} last />
      {error ? <SheetNote>{error}</SheetNote> : null}
      <SheetActions title={busy ? "Saving..." : "Save filter"} onPress={save} disabled={busy} onCancel={onClose} />
    </FormModal>
  );
}

function ProjectWorkspace({ project, link }) {
  const t = useThemeColors();
  const { employees, currentEmployee } = useApp();
  const board = useTasks(project.id);
  const [view, setView] = useState("board");
  const [column, setColumn] = useState(null);
  const [onlyMine, setOnlyMine] = useState(false);
  const [search, setSearch] = useState("");
  const [jqlMode, setJqlMode] = useState(false);
  const [jql, setJql] = useState("");
  const [filterId, setFilterId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [moving, setMoving] = useState(null);
  const [creating, setCreating] = useState(false);
  const [savingFilter, setSavingFilter] = useState(false);
  const [nowMs] = useState(() => Date.now());
  const today = localToday();

  const kanban = project.board_mode === "kanban";
  const employeesById = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);
  const tasksById = useMemo(() => new Map(board.tasks.map((x) => [x.id, x])), [board.tasks]);
  const keyOf = (x) => issueKey(project, x);
  const sprint = kanban ? null : activeSprintOf(board.sprints);

  // A link to an issue in this project opens it once the issues are here. Each link is a new
  // object (TasksScreen), so the same key arriving again opens it again.
  const [handledLink, setHandledLink] = useState(null);
  const [missingKey, setMissingKey] = useState(null);
  if (link && link !== handledLink && !board.isLoading) {
    setHandledLink(link);
    const match = board.tasks.find((x) => x.number === link.number);
    if (match) {
      setOpenId(match.id);
      setMissingKey(null);
    } else {
      setMissingKey(`${project.issue_key}-${link.number}`);
    }
  }

  const rowProps = { project, tasks: board.tasks, workflow: board.workflow, employeesById, today };
  const openIssue = board.tasks.find((x) => x.id === openId) || null;

  // ── Board ──
  const boardList = kanban ? kanbanIssues(board.tasks, nowMs) : boardIssues(board.tasks, sprint?.id ?? null);
  const visibleBoard = onlyMine ? boardList.filter((x) => x.assignee_id === currentEmployee?.id) : boardList;
  const columns = groupByStatus(visibleBoard, board.workflow);
  const totals = groupByStatus(boardList, board.workflow);
  const wipLimits = normalizeWipLimits(project.wip_limits, board.workflow.filter((s) => s.category !== "done").map((s) => s.value));
  const shownColumn = board.workflow.some((s) => s.value === column) ? column : board.workflow[0]?.value;

  // ── Issues ──
  const compiled = compileQuery(jqlMode ? jql : "", {
    me: currentEmployee?.id ?? null,
    employees,
    employeesById,
    sprints: board.sprints,
    versions: board.versions,
    workflow: board.workflow,
    tasks: board.tasks,
    tasksById,
    keyOf,
    nowMs,
    todayStr: today,
  });
  const issueFilters = jqlMode ? { predicate: compiled.ok && !compiled.empty ? compiled.predicate : null } : { search, onlyMine };
  const searched = sortIssues(
    filterIssues(board.tasks, issueFilters, { currentEmployeeId: currentEmployee?.id ?? null, nowMs, keyOf }),
    jqlMode && compiled.ok ? compiled.order : [],
    { workflow: board.workflow, employeesById }
  );
  const mine = board.savedFilters.filter((f) => f.owner_id === currentEmployee?.id);
  const shared = board.savedFilters.filter((f) => f.shared && f.owner_id !== currentEmployee?.id);
  const activeSaved = filterId?.startsWith("s:") ? board.savedFilters.find((f) => `s:${f.id}` === filterId) : null;

  const pickFilter = (id, query) => {
    if (filterId === id) {
      setFilterId(null);
      setJql("");
      return;
    }
    setFilterId(id);
    setJql(query);
    setJqlMode(true);
  };

  const deleteSaved = () => {
    Alert.alert(`Delete "${activeSaved.name}"?`, activeSaved.shared ? "Everyone it's shared with loses it too." : "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = await board.deleteFilter(activeSaved.id);
          if (error) Alert.alert("Couldn't delete the filter", error.message || "");
          else pickFilter(filterId, "");
        },
      },
    ]);
  };

  if (board.loadError && !board.hasLoaded) {
    return (
      <Card>
        <EmptyState icon="alert" text={board.loadError.message || "Couldn't load issues. Check your connection."} />
        <Button title="Retry" variant="secondary" onPress={board.reload} />
      </Card>
    );
  }

  return (
    <>
      {missingKey ? (
        <SheetNote tone="warning">{missingKey} isn&apos;t in this project, or you can&apos;t see it.</SheetNote>
      ) : null}
      <View style={styles.viewRow}>
        {VIEWS.filter((v) => !(kanban && v.value === "backlog")).map((v) => (
          <Chip key={v.value} label={v.label} active={view === v.value} onPress={() => setView(v.value)} />
        ))}
        <View style={styles.flex} />
        <IconButton icon="plus" onPress={() => setCreating(true)} accessibilityLabel="Create issue" tone="glass" size={44} />
      </View>

      {board.isLoading ? (
        <Card>
          <SkeletonList count={5} />
        </Card>
      ) : view === "board" ? (
        <>
          <Card>
            <Eyebrow>{kanban ? "Kanban board" : sprint ? `${shortDate(sprint.start_date)} – ${shortDate(sprint.end_date)}` : "Scrum board"}</Eyebrow>
            <Text style={[styles.cardTitle, { color: t.text1 }]}>{kanban ? `${plural(boardList.length, "issue")} · Done shows 14 days` : sprint ? sprint.name : "No active sprint"}</Text>
            {!kanban && !sprint ? (
              <Text style={[styles.body, { color: t.text3 }]}>Plan and start a sprint from the Backlog on the web to see its work here.</Text>
            ) : sprint?.goal ? (
              <Text style={[styles.body, { color: t.text2 }]}>{sprint.goal}</Text>
            ) : null}
            <View style={styles.chipRow}>
              <Chip label="Only my issues" active={onlyMine} onPress={() => setOnlyMine((v) => !v)} />
            </View>
          </Card>

          {kanban || sprint ? (
            <>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.columnTabs}>
                {board.workflow.map((s) => {
                  const wip = wipStatus(totals[s.value].length, wipLimits[s.value]);
                  const label = wip ? `${s.label} ${totals[s.value].length}/${wip.limit}` : `${s.label} ${columns[s.value].length}`;
                  return <Chip key={s.value} label={label} active={shownColumn === s.value} onPress={() => setColumn(s.value)} />;
                })}
              </ScrollView>
              <Card>
                {(() => {
                  const list = columns[shownColumn] || [];
                  const wip = wipStatus((totals[shownColumn] || []).length, wipLimits[shownColumn]);
                  return (
                    <>
                      <View style={styles.columnHead}>
                        <Text style={[styles.cardTitle, styles.flex, { color: t.text1 }]}>
                          {board.workflow.find((s) => s.value === shownColumn)?.label}
                        </Text>
                        {sumPoints(list) > 0 ? <Text style={[styles.small, { color: t.text3 }]}>{sumPoints(list)} pts</Text> : null}
                        {wip?.over ? <Pill tone="red">Over limit</Pill> : null}
                      </View>
                      {list.length === 0 ? (
                        <EmptyState icon="kanban" text="Nothing in this column." />
                      ) : (
                        list.map((x, i) => (
                          <IssueRow
                            key={x.id}
                            task={x}
                            first={i === 0}
                            {...rowProps}
                            onPress={() => setOpenId(x.id)}
                            right={<Button small variant="secondary" title="Move" onPress={() => setMoving(x)} />}
                          />
                        ))
                      )}
                    </>
                  );
                })()}
              </Card>
            </>
          ) : null}
        </>
      ) : view === "backlog" ? (
        (() => {
          const { sprints: sections, backlog, hiddenDone } = backlogSections(board.tasks, board.sprints);
          return (
            <>
              <Text style={[styles.note, { color: t.text3 }]}>Create, start and complete sprints on the web. Open an issue to change its sprint.</Text>
              {sections.map(({ sprint: s, issues }) => (
                <Card key={s.id}>
                  <View style={styles.columnHead}>
                    <Text numberOfLines={1} style={[styles.cardTitle, styles.flex, { color: t.text1 }]}>
                      {s.name}
                    </Text>
                    <Pill tone={s.state === "active" ? "green" : "gray"}>{s.state === "active" ? "Active" : "Future"}</Pill>
                  </View>
                  <Text style={[styles.small, { color: t.text3 }]}>
                    {plural(issues.length, "issue")} · {sumPoints(issues)} pts
                    {s.start_date ? ` · ${shortDate(s.start_date)} – ${shortDate(s.end_date)}` : ""}
                  </Text>
                  {issues.length === 0 ? (
                    <EmptyState icon="layers" text="No issues in this sprint yet." />
                  ) : (
                    issues.map((x, i) => <IssueRow key={x.id} task={x} first={i === 0} {...rowProps} onPress={() => setOpenId(x.id)} />)
                  )}
                </Card>
              ))}
              <Card>
                <View style={styles.columnHead}>
                  <Text style={[styles.cardTitle, styles.flex, { color: t.text1 }]}>Backlog</Text>
                  <Text style={[styles.small, { color: t.text3 }]}>{plural(backlog.length, "issue")}</Text>
                </View>
                {backlog.length === 0 ? (
                  <EmptyState icon="check-circle" text="The backlog is empty." />
                ) : (
                  backlog.map((x, i) => <IssueRow key={x.id} task={x} first={i === 0} {...rowProps} onPress={() => setOpenId(x.id)} />)
                )}
                {hiddenDone ? <Text style={[styles.small, { color: t.text3 }]}>{plural(hiddenDone, "done issue")} hidden</Text> : null}
              </Card>
            </>
          );
        })()
      ) : (
        <>
          <Card>
            <View style={styles.chipRow}>
              <Chip label="Basic" active={!jqlMode} onPress={() => { setJqlMode(false); setFilterId(null); }} />
              <Chip label="JQL" active={jqlMode} onPress={() => setJqlMode(true)} />
            </View>
            {jqlMode ? (
              <>
                <TextField
                  value={jql}
                  onChangeText={setJql}
                  placeholder='assignee = currentUser() AND status = "In QA"'
                  style={[styles.mono, !compiled.ok && { borderColor: t.pfRed }]}
                />
                <Text accessibilityLiveRegion="polite" style={[styles.small, styles.hint, { color: compiled.ok ? t.text3 : t.pfRed }]}>
                  {!compiled.ok ? compiled.error : compiled.empty ? "Fields: assignee, status, priority, type, labels, sprint, due, updated…" : `${plural(searched.length, "issue")} match`}
                </Text>
                <View style={styles.chipRow}>
                  {jql.trim() && compiled.ok ? <Button small variant="secondary" title="Save as…" onPress={() => setSavingFilter(true)} /> : null}
                  {activeSaved && activeSaved.owner_id === currentEmployee?.id ? <Button small variant="danger" title="Delete filter" onPress={deleteSaved} /> : null}
                </View>
              </>
            ) : (
              <>
                <TextField value={search} onChangeText={setSearch} placeholder="Search title, label or issue key" />
                <View style={styles.chipRow}>
                  <Chip label="Only my issues" active={onlyMine} onPress={() => setOnlyMine((v) => !v)} />
                </View>
              </>
            )}
            <Eyebrow style={styles.filtersTitle}>Filters</Eyebrow>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {BUILT_IN_FILTERS.map((f) => (
                <Chip key={f.id} label={f.name} active={filterId === `b:${f.id}`} onPress={() => pickFilter(`b:${f.id}`, f.query)} />
              ))}
              {mine.map((f) => (
                <Chip key={f.id} label={f.shared ? `${f.name} (shared)` : f.name} active={filterId === `s:${f.id}`} onPress={() => pickFilter(`s:${f.id}`, f.query)} />
              ))}
              {shared.map((f) => (
                <Chip key={f.id} label={f.name} active={filterId === `s:${f.id}`} onPress={() => pickFilter(`s:${f.id}`, f.query)} />
              ))}
            </ScrollView>
          </Card>
          <Card>
            {!compiled.ok ? (
              <EmptyState icon="filter" text="Fix the query above to see its issues." />
            ) : searched.length === 0 ? (
              <EmptyState icon="search" text="No issues match this search." />
            ) : (
              searched.slice(0, 100).map((x, i) => <IssueRow key={x.id} task={x} first={i === 0} {...rowProps} onPress={() => setOpenId(x.id)} />)
            )}
            {searched.length > 100 && compiled.ok ? (
              <Text style={[styles.small, { color: t.text3 }]}>Showing 100 of {searched.length}. Narrow the search to see the rest.</Text>
            ) : null}
          </Card>
        </>
      )}

      {openIssue ? (
        <TaskIssueSheet
          key={openIssue.id}
          issue={openIssue}
          project={project}
          board={board}
          employees={employees}
          onClose={() => setOpenId(null)}
          onOpenIssue={setOpenId}
        />
      ) : null}
      {moving ? <MoveSheet issue={moving} project={project} board={board} onClose={() => setMoving(null)} /> : null}
      {creating ? (
        <TaskCreateSheet
          project={project}
          board={board}
          employees={employees}
          defaultSprintId={view === "board" ? sprint?.id ?? null : null}
          onClose={() => setCreating(false)}
          onCreated={(issue) => issue && setOpenId(issue.id)}
        />
      ) : null}
      {savingFilter ? (
        <SaveFilterSheet query={jql} board={board} onClose={() => setSavingFilter(false)} onSaved={(f) => f && setFilterId(`s:${f.id}`)} />
      ) : null}
    </>
  );
}

export default function TasksScreen() {
  const t = useThemeColors();
  const goBack = useGoBack();
  const { projects } = useApp();
  const params = useLocalSearchParams();
  const [chosenId, setChosenId] = useState(null);
  const [link, setLink] = useState(null); // { key, number }
  const [seenLink, setSeenLink] = useState(null);

  // A new ?issue=KEY-N (with `at` to repeat the same one) re-arms the link.
  const linkSig = typeof params.issue === "string" ? `${params.issue}|${params.at ?? ""}` : null;
  if (linkSig !== seenLink) {
    setSeenLink(linkSig);
    const parsed = typeof params.issue === "string" ? parseIssueKey(params.issue) : null;
    if (parsed) setLink(parsed);
  }

  useEffect(() => {
    AsyncStorage.getItem(PROJECT_KEY)
      .then((v) => {
        const id = Number(v);
        if (Number.isFinite(id) && id > 0) setChosenId((cur) => cur ?? id);
      })
      .catch(() => {});
  }, []);

  const selectable = (projects || []).filter((p) => p.issue_key && p.status !== "archived");
  const linkProject = link ? selectable.find((p) => p.issue_key === link.key) : null;
  // The linked project becomes the chosen one, so it stays once the link is handled.
  if (linkProject && chosenId !== linkProject.id) setChosenId(linkProject.id);
  const project = linkProject || selectable.find((p) => p.id === chosenId) || selectable[0] || null;

  const choose = (id) => {
    setChosenId(id);
    setLink(null);
    AsyncStorage.setItem(PROJECT_KEY, String(id)).catch(() => {});
  };

  return (
    <Screen>
      <ScreenHeader title="Tasks" subtitle={project ? `${project.name} · ${project.issue_key}` : "Plan and track the team's work"} onBack={goBack} />
      {selectable.length === 0 ? (
        <Card>
          <EmptyState icon="folder" text="No project is set up for issues yet. An admin gives a project an issue key on the web." />
        </Card>
      ) : (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.projectRow}>
            {selectable.map((p) => (
              <Chip key={p.id} label={`${p.issue_key} · ${p.name}`} active={project?.id === p.id} onPress={() => choose(p.id)} />
            ))}
          </ScrollView>
          {link && !linkProject && projects?.length ? (
            <Text style={[styles.note, { color: t.text3 }]}>No open project uses the key {link.key}.</Text>
          ) : null}
          {project ? (
            <ProjectWorkspace
              key={project.id}
              project={project}
              link={linkProject && linkProject.id === project.id ? link : null}
            />
          ) : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  projectRow: { paddingBottom: 6 },
  viewRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", marginBottom: 6 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", marginTop: 10 },
  columnTabs: { paddingBottom: 8 },
  columnHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  cardTitle: { fontFamily: fonts.display, fontSize: 17, marginTop: 2 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, marginTop: 6 },
  small: { fontFamily: fonts.body, fontSize: 12 },
  note: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginBottom: 10 },
  mono: { fontFamily: fonts.mono, fontSize: 13 },
  hint: { marginTop: -8 },
  filtersTitle: { marginTop: 14, marginBottom: 8 },
  moveRow: { minHeight: 52, paddingHorizontal: 14, borderWidth: 1, borderRadius: radius.md, marginBottom: 8, justifyContent: "center", gap: 2 },
  moveText: { fontFamily: fonts.bodySemibold, fontSize: 15 },
});
