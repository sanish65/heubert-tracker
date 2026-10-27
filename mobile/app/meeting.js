import { useMemo, useState } from "react";
import { View, Text, Pressable, Alert, StyleSheet } from "react-native";
import { useGoBack } from "../lib/useGoBack";
import { useNow } from "../lib/useNow";
import Svg, { Defs, Ellipse, RadialGradient, Stop } from "react-native-svg";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Screen, ScreenHeader, Card, SectionTitle, Eyebrow, EmptyState, IconButton, Pill } from "../components/ui";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import AddFineModal from "../components/AddFineModal";
import EditFineModal from "../components/EditFineModal";
import AddStandupFineModal from "../components/AddStandupFineModal";
import EditStandupModal from "../components/EditStandupModal";
import AddLeaveModal from "../components/AddLeaveModal";
import EditLeaveModal from "../components/EditLeaveModal";
import AddWordModal from "../components/AddWordModal";
import EditWordModal from "../components/EditWordModal";
import ShoutoutsMeetingCard from "../components/ShoutoutsMeetingCard";
import StandupAnswer from "../components/StandupAnswer";
import { parseHalfDaySegment } from "../lib/utils";
import { formatBs } from "../lib/nepaliDate";
import { pad, localToday, parseTimestamp } from "../lib/dates";

// Meeting mode, as the canvas's MobileMeeting.dc.html: Back to More with the live mark, the clock,
// the quick actions, the day's standup submissions (who is in, who is missing, each person's
// answers), who is on leave, the shout-outs and kudos (as the web's Start Meeting board), today's
// late fines, then the app's own standup records and the word of the meeting. The data, the permissions and the actions are the ones this screen had before the
// redesign: fine admins (canManageFines) record late fines and standups and edit or delete them;
// anyone records a leave and edits or deletes the leaves canManageLeave allows; admins edit or
// delete the word; anyone sets it while there is none.

const MEETING_TYPE_LABELS = { full: "Full Day", half: "Half Day", early: "Early Leave" };
const MEETING_SEGMENT_LABELS = { first: "First Half", second: "Second Half" };

// Who never files a standup, so is never listed as missing.
const NON_STANDUP_EMAILS = new Set(["developers@heubert.com"]);
const NON_STANDUP_FIRST_NAMES = new Set(["sameer"]);

// Jira tickets in these states are left out of the meeting.
const HIDDEN_TICKET_STATUSES = ["on hold", "rejected", "backlog"];

// The clock card's corner glow: CSS radial-gradient(260px 160px at 100% 0%, orange .22, transparent
// 70%), drawn as Aurora.js draws its blobs (an ellipse of 0.7 x those radii, the colour fading out).
const CLOCK_GLOW = { rx: 260 * 0.7, ry: 160 * 0.7, alpha: 0.22 };

const CLOCK_TICK_MS = 1000;

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;

// Built once: Intl formatters are costly to make. "Monday, October 19, 2026", as the canvas's clock.
const clockDayFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
// When a standup came in: Nepal time, as the web's meeting page shows it, in 24 hours as the clock.
const submittedAtFormat = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Kathmandu", hour12: false, hour: "2-digit", minute: "2-digit" });

// "09:12", or "" when the time is missing or does not parse (lib/dates.js reads Supabase's
// six fraction digits, which Hermes may refuse).
function submittedAt(iso) {
  const parsed = iso ? parseTimestamp(iso) : null;
  if (!parsed) return "";
  const parts = submittedAtFormat.formatToParts(parsed);
  const part = (type) => parts.find((p) => p.type === type)?.value || "";
  // With hour12 off some engines write midnight as 24.
  return `${part("hour").replace(/^24$/, "00")}:${part("minute")}`;
}

function visibleTickets(submission) {
  return (submission.jira_tickets || []).filter((tk) => {
    const st = (tk && typeof tk === "object" ? tk.status : null)?.toLowerCase() ?? "";
    return !HIDDEN_TICKET_STATUSES.includes(st);
  });
}

const ticketLabel = (tk) => String((tk && typeof tk === "object" ? tk.key || tk.summary : tk) || "");

// The canvas's live mark beside the title: an orange pill with a glowing dot.
function LiveMark() {
  const t = useThemeColors();
  return (
    <View style={[styles.live, { backgroundColor: t.orangeSoft, borderColor: t.orangeEdge }]}>
      <View style={[styles.liveDot, { backgroundColor: t.orange, boxShadow: t.glowOrangeDot }]} />
      <Text style={[styles.liveText, { color: t.text1 }]}>Live</Text>
    </View>
  );
}

// Decoration only: never touchable, never read out. Clipped by its own layer, not the card, so the
// card keeps its shadow on iOS.
function ClockGlow() {
  const t = useThemeColors();
  return (
    <View pointerEvents="none" style={styles.clockGlow} accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="meeting-clock-glow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={t.orange} stopOpacity={CLOCK_GLOW.alpha} />
            <Stop offset="1" stopColor={t.orange} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="100%" cy="0" rx={CLOCK_GLOW.rx} ry={CLOCK_GLOW.ry} fill="url(#meeting-clock-glow)" />
      </Svg>
    </View>
  );
}

// The ticking part of the clock, on its own so the rest of the screen does not re-render every
// second: the phone's time with the seconds quieter, the day, and the day in Bikram Sambat.
function ClockFace() {
  const t = useThemeColors();
  const now = useNow(CLOCK_TICK_MS);
  const ymd = localToday(now);
  const day = useMemo(() => clockDayFormat.format(new Date(`${ymd}T00:00:00`)), [ymd]);
  const bs = useMemo(() => formatBs(ymd), [ymd]);
  const hoursMinutes = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const seconds = pad(now.getSeconds());
  return (
    <>
      {/* The canvas sets line-height 1.05; at 46 that clips the digits' tops on Android, so the
          line keeps its natural height, as Attendance's clock. */}
      <Text accessibilityRole="timer" accessibilityLabel={`Current time ${hoursMinutes}:${seconds}`} style={[styles.clockTime, { color: t.text1 }]}>
        {hoursMinutes}
        <Text style={{ color: t.text3 }}>{`:${seconds}`}</Text>
      </Text>
      <View style={styles.clockDate}>
        <Text style={[styles.clockDay, { color: t.text1 }]}>{day}</Text>
        {bs ? <Text style={[styles.clockBs, { color: t.cyanText }]}>{`${bs} BS`}</Text> : null}
      </View>
    </>
  );
}

function MeetingClock() {
  const t = useThemeColors();
  return (
    <Card style={[styles.clock, { borderColor: t.orangeEdge }]}>
      <ClockGlow />
      <Eyebrow style={{ color: t.text3 }}>Daily standup</Eyebrow>
      <ClockFace />
    </Card>
  );
}

// The canvas's quick actions: Late Fine in primary blue with its glow, Standup Fine amber, Leave
// cyan, Set Word on glass. `pressed` is the hover colour where the canvas has one; the tinted ones dim.
function quickColors(t, tone) {
  switch (tone) {
    case "amber":
      return { bg: t.pbAmber, border: t.lineStrong, top: t.glassHi, text: t.pfAmber };
    case "cyan":
      return { bg: t.pbCyan, border: t.lineStrong, top: t.glassHi, text: t.pfCyan };
    case "glass":
      return { bg: t.surface, pressed: t.raised, border: t.lineStrong, top: t.glassHi, text: t.text1 };
    default:
      return { bg: t.primary, pressed: t.primaryHover, border: "transparent", text: "#FFFFFF", glow: t.glowPrimary };
  }
}

function QuickAction({ title, tone, onPress }) {
  const t = useThemeColors();
  const c = quickColors(t, tone);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.quick,
        {
          backgroundColor: pressed && c.pressed ? c.pressed : c.bg,
          borderColor: c.border,
          opacity: pressed && !c.pressed ? 0.8 : 1,
        },
        c.top && { borderTopColor: c.top },
        c.glow && { boxShadow: c.glow },
      ]}
    >
      <Icon name="plus" size={18} strokeWidth={2} color={c.text} />
      <Text numberOfLines={1} style={[styles.quickText, { color: c.text }]}>
        {title}
      </Text>
    </Pressable>
  );
}

// Two to a row, as the canvas's grid; an odd last action keeps its column's width.
function QuickActions({ actions }) {
  const rows = [];
  for (let i = 0; i < actions.length; i += 2) rows.push(actions.slice(i, i + 2));
  return (
    <View style={styles.quickGrid}>
      {rows.map((row) => (
        <View key={row[0].key} style={styles.quickRow}>
          {row.map(({ key, ...action }) => (
            <QuickAction key={key} {...action} />
          ))}
          {row.length === 1 ? <View style={styles.quickSpacer} /> : null}
        </View>
      ))}
    </View>
  );
}

// The canvas's one control on a record, "Edit or delete …": it asks which in the app's own alert;
// Edit then opens the record's sheet and Delete asks to confirm, as the two buttons did before.
function EditOrDelete({ label, subject, onEdit, onDelete, color, style }) {
  const offer = () =>
    Alert.alert(
      subject,
      undefined,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
        { text: "Edit", onPress: onEdit },
      ],
      { cancelable: true }
    );
  return <IconButton icon="more-vertical" tone="plain" size={44} color={color} onPress={offer} accessibilityLabel={label} style={[styles.menu, style]} />;
}

// One submitted standup, as the canvas's row: the person, their tickets, when it came in; a tap
// shows their answers under it (the canvas draws the rows closed).
function SubmissionRow({ submission, questions, isMe, open, onToggle }) {
  const t = useThemeColors();
  const tickets = visibleTickets(submission).map(ticketLabel).filter(Boolean);
  const time = submittedAt(submission.responded_at);
  // Saved from the tracker's form, or by the HeuBot Google Chat bot (which leaves source empty).
  const fromTracker = submission.source === "tracker";
  const expandable = questions.length > 0;
  const label = [
    submission.name,
    fromTracker ? "from the tracker" : "from HeuBot",
    time && `submitted at ${time}`,
    tickets.length > 0 && `tickets ${tickets.join(", ")}`,
    expandable && (open ? "hide answers" : "show answers"),
  ]
    .filter(Boolean)
    .join(", ");

  const head = (
    <>
      <Avatar name={submission.name} size={34} isMe={isMe} />
      <View style={styles.submissionText}>
        <Text numberOfLines={1} style={[styles.rowName, { color: t.text1 }]}>
          {submission.name}
        </Text>
        {tickets.length > 0 ? (
          <View style={styles.tickets}>
            {tickets.map((key, i) => (
              <View key={`${key}-${i}`} style={[styles.ticket, { backgroundColor: t.pbGray }]}>
                <Text numberOfLines={1} style={[styles.ticketText, { color: t.pfGray }]}>
                  {key}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
      <Pill tone={fromTracker ? "violet" : "blue"}>{fromTracker ? "Tracker" : "HeuBot"}</Pill>
      {time ? <Text style={[styles.rowMono, { color: t.text3 }]}>{time}</Text> : null}
      {expandable ? <Icon name="chevron-down" size={18} strokeWidth={2} color={t.text3} style={open ? styles.flipped : null} /> : null}
    </>
  );

  return (
    <View style={[styles.submission, { borderTopColor: t.line }]}>
      {expandable ? (
        <Pressable
          onPress={onToggle}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityState={{ expanded: open }}
          style={({ pressed }) => [styles.submissionHead, pressed && styles.pressed]}
        >
          {head}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={label} style={styles.submissionHead}>
          {head}
        </View>
      )}
      {expandable && open ? (
        <View style={styles.answers}>
          {questions.map((q, qi) => {
            const answers = submission.answers || {};
            const answer = answers[`question_${q.id}`] || answers[q.id] || answers[q.question] || answers[q.sort_order];
            const given = answer && String(answer).trim() ? String(answer) : null;
            return (
              <View key={q.id ?? qi} style={styles.answer}>
                <Text style={[styles.question, { color: t.text3 }]}>{q.question}</Text>
                {given ? (
                  <StandupAnswer text={given} style={[styles.answerText, { color: t.text2 }]} />
                ) : (
                  <Text style={[styles.answerText, { color: t.text3 }]}>No answer provided</Text>
                )}
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// The canvas's "Standup status" card, under the app's name for it: how many are in, who is missing
// (and on leave), then each submission.
function SubmissionsCard({ submissions, questions, onLeaveNames, isMe }) {
  const t = useThemeColors();
  const [openKeys, setOpenKeys] = useState(() => new Set());

  const missing = submissions.filter((s) => s.isMissing);
  const submitted = submissions.filter((s) => !s.isMissing);
  const total = submissions.length;
  const keyOf = (s) => String(s.id ?? `${s.name}|${s.responded_at}`);
  const toggle = (key) =>
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <Card style={styles.standups}>
      <View style={styles.standupsHead}>
        <SectionTitle style={styles.flushTitle}>Daily submissions</SectionTitle>
      </View>
      {total === 0 ? (
        <EmptyState icon="message-square" text="No submissions for this date." />
      ) : (
        <>
          <View accessible accessibilityLabel={`${submitted.length} of ${total} submitted${missing.length > 0 ? `, ${missing.length} missing` : ""}`} style={styles.count}>
            <Text style={[styles.countValue, { color: t.text1 }]}>
              {submitted.length}
              <Text style={[styles.countTotal, { color: t.text3 }]}>{`/${total}`}</Text>
            </Text>
            <Text style={[styles.countLabel, { color: t.text2 }]}>submitted</Text>
            {missing.length > 0 ? (
              <Pill tone="amber" style={styles.countPill}>
                {`${missing.length} missing`}
              </Pill>
            ) : null}
          </View>
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel="Standups submitted"
            accessibilityValue={{ min: 0, max: total, now: submitted.length }}
            style={[styles.track, { backgroundColor: t.raised }]}
          >
            {submitted.length > 0 ? (
              <View style={[styles.trackFill, { width: `${(submitted.length / total) * 100}%`, backgroundColor: t.cyan, boxShadow: t.glow }]} />
            ) : null}
          </View>

          {missing.length > 0 ? (
            <View style={styles.block}>
              <Eyebrow style={[styles.blockLabel, { color: t.text3 }]}>Not submitted</Eyebrow>
              <View style={styles.chips}>
                {missing.map((s) => {
                  const away = onLeaveNames.has(s.name?.trim().toLowerCase());
                  return (
                    <View
                      key={s.id}
                      accessible
                      accessibilityLabel={away ? `${s.name}, on leave` : s.name}
                      style={[styles.missing, { borderColor: t.lineStrong, backgroundColor: t.raised }]}
                    >
                      <View style={styles.missingAvatar}>
                        <Avatar name={s.name} size={28} isMe={isMe(s.name)} />
                      </View>
                      <Text numberOfLines={1} style={[styles.missingName, { color: t.text1 }]}>
                        {s.name}
                      </Text>
                      {away ? <Text style={[styles.missingLeave, { color: t.pfCyan }]}>on leave</Text> : null}
                    </View>
                  );
                })}
              </View>
            </View>
          ) : null}

          {submitted.length > 0 ? (
            <View style={styles.submitted}>
              <Eyebrow style={[styles.blockLabel, styles.submittedLabel, { color: t.text3 }]}>Submitted</Eyebrow>
              {submitted.map((s) => {
                const key = keyOf(s);
                return (
                  <SubmissionRow
                    key={key}
                    submission={s}
                    questions={questions}
                    isMe={isMe(s.name, s.email)}
                    open={openKeys.has(key)}
                    onToggle={() => toggle(key)}
                  />
                );
              })}
            </View>
          ) : null}
        </>
      )}
    </Card>
  );
}

// One leave today, as the canvas's row: the person, the kind of day in a cyan pill, the leave type
// and the half; the edit-or-delete control for those who may change it.
function LeaveRow({ leave, typeName, isMe, canEdit, onEdit, onDelete }) {
  const t = useThemeColors();
  const name = leave.employee_name?.trim() ? leave.employee_name : "Unknown";
  const segment = parseHalfDaySegment(leave);
  const span = MEETING_TYPE_LABELS[leave.type];
  return (
    <View style={[styles.row, { borderTopColor: t.line }]}>
      <Avatar name={name} size={34} isMe={isMe} />
      <View style={[styles.rowText, styles.leaveText]}>
        <Text numberOfLines={1} style={[styles.rowName, { color: t.text1 }]}>
          {name}
        </Text>
        <View style={styles.leaveMeta}>
          {span ? <Pill tone="cyan">{span}</Pill> : null}
          <Text numberOfLines={1} style={[styles.rowMeta, { color: t.text3 }]}>
            {typeName}
            {segment ? ` · ${MEETING_SEGMENT_LABELS[segment]}` : ""}
          </Text>
        </View>
      </View>
      {canEdit ? (
        <EditOrDelete label={`Edit or delete leave for ${name}`} subject={`${leave.employee_name} · ${leave.start_date}`} onEdit={onEdit} onDelete={onDelete} />
      ) : null}
    </View>
  );
}

// One fine or standup record of today: the person, the amount (late fines), Paid or Unpaid; the
// edit-or-delete control for fine admins.
function RecordRow({ name, amount, paid, isMe, menu }) {
  const t = useThemeColors();
  return (
    <View style={[styles.row, { borderTopColor: t.line }]}>
      <Avatar name={name} size={34} isMe={isMe} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowName, { color: t.text1 }]}>
          {name}
        </Text>
      </View>
      <View style={styles.rowSide}>
        {amount != null ? <Text style={[styles.rowAmount, { color: t.text1 }]}>{rs(amount)}</Text> : null}
        <Pill tone={paid ? "green" : "amber"} style={styles.rowPill}>
          {paid ? "Paid" : "Unpaid"}
        </Pill>
      </View>
      {menu}
    </View>
  );
}

// The word of the meeting, as the canvas: an orange-soft panel (Meeting is a people moment), the
// book tile, the word large with its phonetic, then the translation, meaning, example and who
// shared it.
function WordCard({ word, canEdit, onEdit, onDelete }) {
  const t = useThemeColors();
  return (
    <Card style={[styles.word, { backgroundColor: t.orangeSoft, borderColor: t.orangeEdge }]}>
      <View style={styles.wordHead}>
        <View style={[styles.wordTile, { backgroundColor: t.orange }]}>
          <Icon name="book" size={18} strokeWidth={2} color="#0A0E17" />
        </View>
        <Text accessibilityRole="header" style={[styles.wordTitle, { color: t.text2 }]}>
          Word of the meeting
        </Text>
        {word && canEdit ? (
          <EditOrDelete label="Edit or delete the word" subject={word.word} color={t.text2} onEdit={onEdit} onDelete={onDelete} style={styles.wordMenu} />
        ) : null}
      </View>
      {word ? (
        <>
          <View style={styles.wordLine}>
            <Text style={[styles.wordText, { color: t.text1 }]}>{word.word}</Text>
            {word.phonetic ? <Text style={[styles.wordPhonetic, { color: t.text3 }]}>{`(${word.phonetic})`}</Text> : null}
          </View>
          {word.translation ? (
            <Text style={[styles.wordTranslation, { color: t.text2 }]}>
              {"Translation: "}
              <Text style={[styles.wordTranslationValue, { color: t.text1 }]}>{word.translation}</Text>
            </Text>
          ) : null}
          <Text style={[styles.wordDefinition, { color: t.text1 }]}>{word.definition}</Text>
          {word.example ? (
            <View style={[styles.wordExample, { borderLeftColor: t.orange }]}>
              <Text style={[styles.wordExampleText, { color: t.text2 }]}>{`"${word.example}"`}</Text>
            </View>
          ) : null}
          {word.created_by ? <Text style={[styles.wordBy, { color: t.text3 }]}>{`Shared by ${word.created_by}`}</Text> : null}
        </>
      ) : (
        <EmptyState icon="book" text="No word shared for this meeting yet." />
      )}
    </Card>
  );
}

export default function MeetingScreen() {
  const {
    fines: allFines,
    standupFines: allStandupFines,
    leaves,
    words,
    employees,
    publicHolidays,
    leaveTypes,
    standupSubmissions,
    standupQuestions,
    currentEmployee,
    isAdmin,
    canManageFines,
    canManageLeave,
    deleteFine,
    deleteStandupFine,
    deleteLeave,
    deleteWord,
  } = useApp();
  const fines = useMemo(() => allFines.filter(f => f.employee_name !== "Developers"), [allFines]);
  const standupFines = useMemo(() => allStandupFines.filter(f => f.employee_name !== "Developers"), [allStandupFines]);
  const t = useThemeColors();
  const goBack = useGoBack();

  const [showAddFine, setShowAddFine] = useState(false);
  const [showAddStandup, setShowAddStandup] = useState(false);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showAddWord, setShowAddWord] = useState(false);
  const [editingFine, setEditingFine] = useState(null);
  const [editingStandup, setEditingStandup] = useState(null);
  const [editingLeave, setEditingLeave] = useState(null);
  const [editingWord, setEditingWord] = useState(null);

  const confirmDeleteFine = (f) => {
    Alert.alert("Delete fine?", `${f.employee_name} · Rs. ${f.amount}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteFine(f.id) },
    ]);
  };
  const confirmDeleteStandup = (s) => {
    Alert.alert("Delete record?", `${s.employee_name} · ${s.date}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteStandupFine(s.id) },
    ]);
  };
  const confirmDeleteLeave = (l) => {
    Alert.alert("Delete leave?", `${l.employee_name} · ${l.start_date}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteLeave(l.id) },
    ]);
  };
  const confirmDeleteWord = (w) => {
    Alert.alert("Delete word?", w.word, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteWord(w.id) },
    ]);
  };

  const today = new Date().toLocaleDateString("en-CA");

  const todaysFines = useMemo(() => fines.filter((f) => f.date === today), [fines, today]);
  const todaysStandups = useMemo(() => standupFines.filter((f) => f.date === today), [standupFines, today]);

  const activeLeaves = useMemo(() => {
    const d = new Date();
    const dow = d.getDay();
    const dtStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = publicHolidays.some((h) => h.date.startsWith(dtStr));
    if (isWeekend || isHoliday) return [];
    return leaves.filter((l) => (l.dates && Array.isArray(l.dates) ? l.dates.includes(dtStr) : dtStr >= l.start_date && dtStr <= l.end_date));
  }, [leaves, publicHolidays]);

  const leaveTypeById = useMemo(() => {
    const map = new Map();
    (leaveTypes || []).forEach((lt) => map.set(lt.id, lt));
    return map;
  }, [leaveTypes]);

  const allSubmissions = useMemo(() => {
    const actualSubmissions = standupSubmissions.filter((s) => s.date === today);
    const submittedEmails = new Set(actualSubmissions.filter((s) => s.email).map((s) => s.email.trim().toLowerCase()));
    const submittedFirstNames = new Set(actualSubmissions.filter((s) => s.name).map((s) => s.name.trim().split(/\s+/)[0].toLowerCase()));

    const missingSubmissions = (employees || [])
      .filter((emp) => {
        if (emp.status && emp.status !== "active") return false;
        const workEmail = emp.work_email?.trim().toLowerCase();
        const personalEmail = emp.personal_email?.trim().toLowerCase();
        const empFirstName = emp.name?.trim().split(/\s+/)[0].toLowerCase();
        if (workEmail && NON_STANDUP_EMAILS.has(workEmail)) return false;
        if (personalEmail && NON_STANDUP_EMAILS.has(personalEmail)) return false;
        if (empFirstName && NON_STANDUP_FIRST_NAMES.has(empFirstName)) return false;
        if (submittedEmails.has(workEmail) || submittedEmails.has(personalEmail)) return false;
        if (empFirstName && submittedFirstNames.has(empFirstName)) return false;
        return true;
      })
      .map((emp, idx) => ({ id: `missing-${emp.id || idx}`, name: emp.name, date: today, isMissing: true, answers: {}, jira_tickets: [] }));

    const sortedActual = [...actualSubmissions].sort((a, b) => new Date(a.responded_at) - new Date(b.responded_at));
    return [...missingSubmissions, ...sortedActual];
  }, [standupSubmissions, today, employees]);

  const todaysWord = useMemo(() => words.find((w) => w.created_at?.startsWith(today)), [words, today]);

  // Who is away today, for the "on leave" beside a missing standup.
  const onLeaveNames = useMemo(() => new Set(activeLeaves.map((l) => l.employee_name?.trim().toLowerCase()).filter(Boolean)), [activeLeaves]);

  // Your avatar is the orange one: by your name, or a submission's email that is yours.
  const myName = currentEmployee?.name;
  const myEmails = useMemo(
    () => new Set([currentEmployee?.work_email, currentEmployee?.personal_email].filter(Boolean).map((e) => e.trim().toLowerCase())),
    [currentEmployee]
  );
  const isMe = (name, email) => (!!email && myEmails.has(email.trim().toLowerCase())) || (!!name && name === myName);

  const lateTotal = todaysFines.reduce((sum, f) => sum + (Number(f.amount) || 0), 0);

  // The quick actions this person has, in the canvas's order.
  const quickActions = [
    canManageFines && { key: "fine", title: "Late Fine", tone: "primary", onPress: () => setShowAddFine(true) },
    canManageFines && { key: "standup", title: "Standup Fine", tone: "amber", onPress: () => setShowAddStandup(true) },
    { key: "leave", title: "Leave", tone: "cyan", onPress: () => setShowAddLeave(true) },
    !todaysWord && { key: "word", title: "Set Word", tone: "glass", onPress: () => setShowAddWord(true) },
  ].filter(Boolean);

  return (
    <Screen>
      <ScreenHeader title="Meeting mode" onBack={goBack} right={<LiveMark />} />

      <MeetingClock />

      <QuickActions actions={quickActions} />

      <SubmissionsCard submissions={allSubmissions} questions={standupQuestions} onLeaveNames={onLeaveNames} isMe={isMe} />

      <Card style={styles.panel}>
        <View style={styles.panelHead}>
          <SectionTitle style={styles.flushTitle}>On leave today</SectionTitle>
          {activeLeaves.length > 0 ? <Pill tone="cyan">{activeLeaves.length}</Pill> : null}
        </View>
        {activeLeaves.length === 0 ? (
          <EmptyState icon="users" text="Full strength today!" />
        ) : (
          activeLeaves.map((l, i) => (
            <LeaveRow
              key={l.id ?? i}
              leave={l}
              typeName={leaveTypeById.get(l.leave_type_id)?.name || "Uncategorized"}
              isMe={isMe(l.employee_name)}
              canEdit={canManageLeave(l)}
              onEdit={() => setEditingLeave(l)}
              onDelete={() => confirmDeleteLeave(l)}
            />
          ))
        )}
      </Card>

      <ShoutoutsMeetingCard today={today} />

      <Card style={styles.panel}>
        <View style={styles.panelHead}>
          <SectionTitle style={styles.flushTitle}>{"Today's late fines"}</SectionTitle>
          {todaysFines.length > 0 ? <Text style={[styles.rowMono, { color: t.text1 }]}>{rs(lateTotal)}</Text> : null}
        </View>
        {todaysFines.length === 0 ? (
          <EmptyState icon="sun" text="All on time today!" />
        ) : (
          todaysFines.map((f, i) => (
            <RecordRow
              key={f.id ?? i}
              name={f.employee_name}
              amount={f.amount}
              paid={f.status === "paid"}
              isMe={isMe(f.employee_name)}
              menu={
                canManageFines ? (
                  <EditOrDelete
                    label={`Edit or delete fine for ${f.employee_name}`}
                    subject={`${f.employee_name} · Rs. ${f.amount}`}
                    onEdit={() => setEditingFine(f)}
                    onDelete={() => confirmDeleteFine(f)}
                    style={styles.rowMenu}
                  />
                ) : null
              }
            />
          ))
        )}
      </Card>

      <Card style={styles.panel}>
        <View style={styles.panelHead}>
          <SectionTitle style={styles.flushTitle}>Standup status</SectionTitle>
        </View>
        {todaysStandups.length === 0 ? (
          <EmptyState icon="check" text="No standup fines yet." />
        ) : (
          todaysStandups.map((s, i) => (
            <RecordRow
              key={s.id ?? i}
              name={s.employee_name}
              paid={s.status === "paid"}
              isMe={isMe(s.employee_name)}
              menu={
                canManageFines ? (
                  <EditOrDelete
                    label={`Edit or delete standup record for ${s.employee_name}`}
                    subject={`${s.employee_name} · ${s.date}`}
                    onEdit={() => setEditingStandup(s)}
                    onDelete={() => confirmDeleteStandup(s)}
                    style={styles.rowMenu}
                  />
                ) : null
              }
            />
          ))
        )}
      </Card>

      <WordCard word={todaysWord} canEdit={isAdmin} onEdit={() => setEditingWord(todaysWord)} onDelete={() => confirmDeleteWord(todaysWord)} />

      <AddFineModal isOpen={showAddFine} onClose={() => setShowAddFine(false)} />
      <EditFineModal isOpen={!!editingFine} onClose={() => setEditingFine(null)} fine={editingFine} />
      <AddStandupFineModal isOpen={showAddStandup} onClose={() => setShowAddStandup(false)} />
      <EditStandupModal isOpen={!!editingStandup} onClose={() => setEditingStandup(null)} record={editingStandup} />
      <AddLeaveModal isOpen={showAddLeave} onClose={() => setShowAddLeave(false)} />
      <EditLeaveModal isOpen={!!editingLeave} onClose={() => setEditingLeave(null)} leave={editingLeave} />
      <AddWordModal isOpen={showAddWord} onClose={() => setShowAddWord(false)} />
      <EditWordModal isOpen={!!editingWord} onClose={() => setEditingWord(null)} word={editingWord} />
    </Screen>
  );
}

// Sizes, gaps and type from MobileMeeting.dc.html; letter-spacing in em becomes pixels at the text's
// size (-0.02em at 46px is -0.92, .06em at 12px is 0.72, .08em at 12px is 0.96).
const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },

  // The live mark: 28 high, 10 in, the dot 7 across.
  live: { flexDirection: "row", alignItems: "center", gap: 6, height: 28, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1 },
  liveDot: { width: 7, height: 7, borderRadius: radius.pill },
  liveText: { fontFamily: fonts.monoMedium, fontSize: 12, textTransform: "uppercase" },

  // The clock: a 20-radius glass card on an orange edge, 20 by 18 in, 6 between its lines; the glow
  // layer sits inside the 1px edge.
  clock: { borderRadius: radius.xl, paddingVertical: 20, paddingHorizontal: 18, gap: 6 },
  clockGlow: { ...StyleSheet.absoluteFill, borderRadius: radius.xl - 1, overflow: "hidden" },
  clockTime: { fontFamily: fonts.monoMedium, fontSize: 46, letterSpacing: -0.92, fontVariant: ["tabular-nums"] },
  clockDate: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", rowGap: 8, columnGap: 12 },
  clockDay: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  clockBs: { fontFamily: fonts.mono, fontSize: 12 },

  // Quick actions: two columns 10 apart, 52 high and 14 round.
  quickGrid: { gap: 10, marginBottom: 14 },
  quickRow: { flexDirection: "row", gap: 10 },
  quickSpacer: { flex: 1 },
  quick: {
    flex: 1,
    height: 52,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  quickText: { flexShrink: 1, fontFamily: fonts.bodySemibold, fontSize: 15 },

  // The list cards: 20-radius glass, 16 by 18 in; the head 4 above the first row; rows 60 high on a
  // hairline, 6 apart.
  panel: { borderRadius: radius.xl, gap: 6 },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  flushTitle: { flex: 1, marginBottom: 0 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, borderTopWidth: 1 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  rowMeta: { flexShrink: 1, fontFamily: fonts.body, fontSize: 13 },
  rowMono: { fontFamily: fonts.mono, fontSize: 12 },
  rowSide: { alignItems: "flex-end", gap: 4 },
  rowAmount: { fontFamily: fonts.monoMedium, fontSize: 13 },
  rowPill: { height: 20, paddingHorizontal: 7 },
  menu: { borderRadius: radius.md },
  rowMenu: { marginRight: -10 },
  leaveText: { gap: 3 },
  leaveMeta: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },

  // Daily submissions: 12 between the parts.
  standups: { borderRadius: radius.xl, gap: 12 },
  standupsHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  // The count, "submitted" and the missing pill share a baseline (the canvas aligns their boxes'
  // bottoms with line-height 1, which React Native cannot draw without clipping the figure).
  count: { flexDirection: "row", alignItems: "baseline", gap: 10 },
  countValue: { fontFamily: fonts.display, fontSize: 34, lineHeight: 40, fontVariant: ["tabular-nums"] },
  countTotal: { fontSize: 20 },
  countLabel: { fontFamily: fonts.body, fontSize: 14 },
  countPill: { marginLeft: "auto", height: 24, paddingHorizontal: 10 },
  track: { height: 8, borderRadius: radius.pill, overflow: "hidden" },
  trackFill: { height: "100%", borderRadius: radius.pill },
  block: { gap: 8, paddingTop: 4 },
  blockLabel: { letterSpacing: 0.72 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  missing: {
    maxWidth: "100%",
    height: 36,
    paddingLeft: 4,
    paddingRight: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderStyle: "dashed",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  missingAvatar: { opacity: 0.75 },
  missingName: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 13 },
  missingLeave: { fontFamily: fonts.body, fontSize: 12 },
  submitted: { paddingTop: 4 },
  submittedLabel: { paddingBottom: 4 },
  submission: { borderTopWidth: 1 },
  submissionHead: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 8 },
  submissionText: { flex: 1, minWidth: 0, gap: 4 },
  tickets: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  ticket: { maxWidth: "100%", height: 20, paddingHorizontal: 6, borderRadius: 6, justifyContent: "center" },
  ticketText: { fontFamily: fonts.mono, fontSize: 12 },
  flipped: { transform: [{ rotate: "180deg" }] },
  // The answers line up under the name (the 34 avatar and its 12 gap).
  answers: { gap: 10, paddingLeft: 46, paddingBottom: 12 },
  answer: { gap: 2 },
  question: { fontFamily: fonts.bodySemibold, fontSize: 12 },
  answerText: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },

  // Word of the meeting: a 20-radius orange-soft panel, 18 in, 10 between its parts.
  word: { borderRadius: radius.xl, paddingVertical: 18, paddingHorizontal: 18, gap: 10 },
  wordHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  wordTile: { width: 36, height: 36, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  wordTitle: { flex: 1, fontFamily: fonts.monoMedium, fontSize: 12, letterSpacing: 0.96, textTransform: "uppercase" },
  wordMenu: { marginRight: -8 },
  wordLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", rowGap: 4, columnGap: 10 },
  wordText: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33 },
  wordPhonetic: { fontFamily: fonts.mono, fontSize: 13 },
  wordTranslation: { fontFamily: fonts.body, fontSize: 14 },
  wordTranslationValue: { fontFamily: fonts.bodySemibold },
  // 1.5 line height at 15 and at 14.
  wordDefinition: { fontFamily: fonts.body, fontSize: 15, lineHeight: 23 },
  wordExample: { paddingLeft: 12, borderLeftWidth: 2 },
  wordExampleText: { fontFamily: fonts.bodyItalic, fontSize: 14, lineHeight: 21 },
  wordBy: { fontFamily: fonts.body, fontSize: 13 },
});
