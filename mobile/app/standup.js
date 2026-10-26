import { useMemo, useRef, useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { useGoBack } from "../lib/useGoBack";
import { useNow } from "../lib/useNow";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Screen, ScreenHeader, Card, Button, Pill, EmptyState } from "../components/ui";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import StandupShoutouts from "../components/StandupShoutouts";
import { formatBs } from "../lib/nepaliDate";
import { parseTimestamp } from "../lib/dates";
import { getNepalParts, findSubmissionFor, standupDays } from "../lib/standupWindow";
import { answerFor, answeredProgress, teamProgress, waitingLabel, recentStandups } from "../lib/standupProgress";
import { useStandupLog, fetchStandupTickets } from "../lib/standupSave";

// The Daily standup, as the web's Standup tab (src/components/StandupFormPage.js): your update for
// today or the next working day, the shout-outs for that day's meeting, who on the team is in, and
// your recent days. The rules are the web's, mirrored in lib/standupWindow.js and
// lib/standupProgress.js: today (on a working day) and the next working day are both open; from
// 10:00 the form opens on the next one; typing pins the day. Your update saves to the standup
// project's standup_responses (lib/standupSave.js), shout-outs to the main project (useShoutouts);
// the two cards save independently.

// The page only needs the date and whether it is past 10:00; the seconds tick in NepalClock alone.
const PAGE_TICK_MS = 30000;
// Avatars shown in "Team so far" before the rest fold into "+N".
const STACK_MAX = 6;

const utcDay = (dateStr) => new Date(`${dateStr}T00:00:00Z`);
const fmt = (dateStr, opts) => utcDay(dateStr).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
// "Wed · Oct 21"
const tabDate = (dateStr) => `${fmt(dateStr, { weekday: "short" })} · ${fmt(dateStr, { month: "short", day: "numeric" })}`;
// "Wednesday, Oct 21"
const longDate = (dateStr) => `${fmt(dateStr, { weekday: "long" })}, ${fmt(dateStr, { month: "short", day: "numeric" })}`;
// "Oct 20"
const shortDate = (dateStr) => fmt(dateStr, { month: "short", day: "numeric" });
const pad = (n) => String(n).padStart(2, "0");
const firstName = (name) => (name || "").trim().split(/\s+/)[0] || "";

// "6:12 PM", or "Oct 20, 6:12 PM" when it was sent on another day than the standup's own.
function sentAt(respondedAt, standupDate) {
  const sent = respondedAt ? parseTimestamp(respondedAt) : null;
  if (!sent) return "";
  const time = sent.toLocaleTimeString("en-US", { timeZone: "Asia/Kathmandu", hour: "numeric", minute: "2-digit" });
  const sentDate = getNepalParts(sent).dateStr;
  return sentDate === standupDate ? time : `${shortDate(sentDate)}, ${time}`;
}

const RECENT_PILL = {
  submitted: { label: "Submitted", tone: "green" },
  missed: { label: "Missed", tone: "red" },
  leave: { label: "On leave", tone: "gray" },
  pending: { label: "Not yet", tone: "gray" },
};

// The live Nepal clock, ticking on its own so the form doesn't re-render every second.
function NepalClock() {
  const t = useThemeColors();
  const now = useNow(1000);
  const p = getNepalParts(now);
  const time = `${pad(p.hour)}:${pad(p.minute)}:${pad(p.second)}`;
  return (
    <View accessible accessibilityRole="timer" accessibilityLabel={`Nepal time ${time}`} style={[styles.clock, { backgroundColor: t.surface, borderColor: t.line }]}>
      <Text style={[styles.clockTime, { color: t.text1 }]}>{time}</Text>
      <Text style={[styles.clockZone, { color: t.text3 }]}>Nepal time</Text>
    </View>
  );
}

// Today and the next working day, as two tabs.
function DaySwitch({ options, value, onPick }) {
  const t = useThemeColors();
  return (
    <View accessibilityRole="tablist" style={[styles.days, { backgroundColor: t.surface, borderColor: t.line }]}>
      {options.map((o) => {
        const selected = o.date === value;
        return (
          <Pressable
            key={o.date}
            onPress={() => onPick(o.date)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`${o.label}, ${longDate(o.date)}`}
            style={({ pressed }) => [
              styles.day,
              selected ? { backgroundColor: t.primarySoft, borderColor: t.primary } : { borderColor: "transparent", backgroundColor: pressed ? t.raised : "transparent" },
            ]}
          >
            <Text style={[styles.dayLabel, { color: selected ? t.text1 : t.text2 }]}>{o.label}</Text>
            <Text style={[styles.dayDate, { color: selected ? t.primaryText : t.text3 }]}>{tabDate(o.date)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ProgressBar({ pct, color }) {
  const t = useThemeColors();
  return (
    <View style={[styles.bar, { backgroundColor: t.raised, borderColor: t.line }]}>
      <View style={[styles.barFill, { width: `${pct}%`, backgroundColor: color || t.primary }]} />
    </View>
  );
}

function QuestionField({ index, question, value, onChangeText }) {
  const t = useThemeColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.question}>
      <View style={styles.questionLabel}>
        <Text style={[styles.questionN, { color: t.cyanText }]}>{pad(index + 1)}</Text>
        <Text style={[styles.questionText, { color: t.text1 }]}>{question.question}</Text>
      </View>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Type your answer…"
        placeholderTextColor={t.text3}
        multiline
        accessibilityLabel={question.question}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.answer, { backgroundColor: t.raised, color: t.text1, borderColor: focused ? t.cyan : t.lineStrong }]}
      />
    </View>
  );
}

export default function StandupScreen() {
  const t = useThemeColors();
  const goBack = useGoBack();
  const { standupQuestions, publicHolidays, leaves, employees, currentEmployee, user } = useApp();
  const { submissions, submit, update } = useStandupLog();
  const now = useNow(PAGE_TICK_MS);

  const [picked, setPicked] = useState(null); // a date the user chose, else the default
  const [draft, setDraft] = useState({ key: null, values: {} }); // unsaved answers, per form
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [savedAction, setSavedAction] = useState(null); // "submitted" | "updated" | null
  const savedTimeoutRef = useRef(null);
  useEffect(() => () => clearTimeout(savedTimeoutRef.current), []);

  const holidayDates = useMemo(() => new Set((publicHolidays || []).map((h) => String(h.date).split("T")[0])), [publicHolidays]);

  const { todayStr, days } = useMemo(() => {
    const nepal = getNepalParts(now);
    return { todayStr: nepal.dateStr, days: standupDays(nepal, holidayDates) };
  }, [now, holidayDates]);
  const options = [...(days.today ? [{ date: days.today, label: "Today" }] : []), { date: days.next, label: "Next working day" }];
  // A pick that is no longer offered (the day rolled over) falls back to the default.
  const targetDate = picked && (picked === days.today || picked === days.next) ? picked : days.defaultDate;

  const targetSubmission = useMemo(() => findSubmissionFor(submissions, targetDate, currentEmployee, user), [submissions, targetDate, currentEmployee, user]);
  const sortedQuestions = useMemo(() => [...(standupQuestions || [])].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)), [standupQuestions]);

  const saved = useMemo(() => {
    const seeded = {};
    sortedQuestions.forEach((q) => {
      seeded[q.id] = targetSubmission ? answerFor(targetSubmission.answers, q) : "";
    });
    return seeded;
  }, [sortedQuestions, targetSubmission]);

  // The draft is keyed on the day and the submission's id, so saving our own edit never stomps on
  // what has been typed since; another day, or a first submission, shows that form's saved answers.
  const formKey = `${targetDate}|${targetSubmission?.id ?? "new"}`;
  const answers = draft.key === formKey ? draft.values : saved;
  const hasText = sortedQuestions.some((q) => (answers[q.id] || "").trim());

  const setAnswer = (id, value) => {
    // Typing pins the day, so the 10:00 switch can't move the form from under you.
    if (picked !== targetDate) setPicked(targetDate);
    setDraft({ key: formKey, values: { ...answers, [id]: value } });
  };

  // Empties every box, saved answers included; nothing is saved until you submit again.
  const clearAnswers = () => {
    if (picked !== targetDate) setPicked(targetDate);
    setDraft({ key: formKey, values: {} });
  };

  const progress = answeredProgress(sortedQuestions, answers);
  const allAnswered = progress.total > 0 && progress.answered === progress.total;
  const isEditing = Boolean(targetSubmission);

  const team = useMemo(() => teamProgress(employees, submissions, targetDate), [employees, submissions, targetDate]);
  const waitingNames = useMemo(() => team.waiting.map((e) => firstName(e.name)).filter(Boolean).sort((a, b) => a.localeCompare(b)), [team]);
  const firstQuestion = sortedQuestions[0];
  const recent = useMemo(
    () =>
      recentStandups(submissions, { before: targetDate, today: todayStr, holidayDates, employee: currentEmployee, user, firstQuestion, leaves, count: 5 }),
    [submissions, targetDate, todayStr, holidayDates, currentEmployee, user, firstQuestion, leaves]
  );

  const handleSubmit = async () => {
    if (!allAnswered || submitting) return;
    setSubmitting(true);
    setError("");
    const wasEditing = isEditing;
    const payload = {
      date: targetDate,
      email: currentEmployee?.work_email || currentEmployee?.personal_email || user?.email || "",
      name: currentEmployee?.name || user?.user_metadata?.full_name || user?.email || "",
      responded_at: new Date().toISOString(),
      answers: Object.fromEntries(sortedQuestions.map((q) => [`question_${q.id}`, (answers[q.id] || "").trim()])),
      source: "tracker", // the HeuBot Google Chat bot leaves it empty; the meeting labels each
    };
    const tickets = await fetchStandupTickets();
    if (tickets) payload.jira_tickets = tickets;
    const { error: dbError } = wasEditing ? await update(targetSubmission.id, payload) : await submit(payload);
    setSubmitting(false);
    if (dbError) {
      setError(dbError.message || "Failed to save. Please try again.");
      return;
    }
    setSavedAction(wasEditing ? "updated" : "submitted");
    clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = setTimeout(() => setSavedAction(null), 3000);
  };

  const pickDay = (date) => {
    setPicked(date);
    setError("");
  };

  const bs = formatBs(todayStr);
  const subtitle = [tabDate(todayStr), bs ? `${bs} BS` : ""].filter(Boolean).join(" · ");
  const dayShort = fmt(targetDate, { weekday: "long" });
  const stack = team.submitted.slice(0, STACK_MAX);
  const teamPct = team.expected ? Math.round((team.inCount / team.expected) * 100) : 0;

  return (
    <Screen>
      <ScreenHeader title="Daily standup" subtitle={subtitle} onBack={goBack} />

      <View style={styles.tools}>
        <DaySwitch options={options} value={targetDate} onPick={pickDay} />
        <NepalClock />
      </View>

      <Card style={styles.card}>
        <View style={styles.cardHead}>
          <View style={[styles.tile, { backgroundColor: t.primarySoft, borderColor: t.primary }]}>
            <Icon name="message" size={20} color={t.primaryText} />
          </View>
          <View style={styles.heading}>
            <Text accessibilityRole="header" style={[styles.title, { color: t.text1 }]}>
              Your update
            </Text>
            <Text style={[styles.sub, { color: t.text3 }]}>{`For ${longDate(targetDate)} · read out at that morning's meeting`}</Text>
          </View>
        </View>
        <Pill tone={isEditing ? "green" : "amber"} style={styles.status}>
          {isEditing ? `Submitted · ${sentAt(targetSubmission.responded_at, targetDate)}` : "Not submitted yet"}
        </Pill>

        {savedAction ? (
          <View accessibilityRole="alert" style={[styles.saved, { backgroundColor: t.pbGreen, borderColor: t.line }]}>
            <Icon name="check" size={16} strokeWidth={2.2} color={t.pfGreen} />
            <Text style={[styles.savedText, { color: t.pfGreen }]}>{`Standup ${savedAction}. You can edit it any time.`}</Text>
          </View>
        ) : null}

        {sortedQuestions.length === 0 ? (
          <EmptyState icon="message" text="No standup questions are configured yet." />
        ) : (
          <>
            <View style={styles.progress}>
              <View style={styles.progressText}>
                <Text style={[styles.progressLabel, { color: t.text2 }]}>{`${progress.answered} of ${progress.total} answered`}</Text>
                <Text style={[styles.progressPct, { color: t.text2 }]}>{`${progress.pct}%`}</Text>
              </View>
              <ProgressBar pct={progress.pct} />
            </View>
            {sortedQuestions.map((q, i) => (
              <QuestionField key={q.id} index={i} question={q} value={answers[q.id] || ""} onChangeText={(v) => setAnswer(q.id, v)} />
            ))}
          </>
        )}

        {error ? (
          <Text accessibilityRole="alert" style={[styles.error, { color: t.pfRed }]}>
            {error}
          </Text>
        ) : null}

        <View style={styles.actions}>
          <Button title="Clear" variant="secondary" onPress={clearAnswers} disabled={!hasText || submitting} style={styles.actionBtn} />
          <Button
            title={submitting ? "Saving…" : isEditing ? "Update standup" : "Submit standup"}
            icon="check"
            onPress={handleSubmit}
            disabled={!allAnswered || submitting}
            style={styles.actionMain}
          />
        </View>
        <View style={styles.foot}>
          <Icon name="clipboard" size={14} color={t.text3} />
          <Text style={[styles.footText, { color: t.text3 }]}>Saved to the standup log</Text>
        </View>
      </Card>

      <StandupShoutouts date={targetDate} dayShort={dayShort} />

      <Card style={styles.card}>
        <View style={styles.teamHead}>
          <Text accessibilityRole="header" style={[styles.cardTitle, { color: t.text1 }]}>
            Team so far
          </Text>
          <Text style={[styles.mono, { color: t.text2 }]}>{`${team.inCount} of ${team.expected} in`}</Text>
        </View>
        <ProgressBar pct={teamPct} color={t.cyan} />
        <View style={styles.teamRow}>
          {stack.length > 0 ? (
            <View accessible accessibilityLabel={`In: ${team.submitted.map((e) => e.name).join(", ")}`} style={styles.stack}>
              {stack.map((e, i) => (
                <View key={e.id} style={[styles.stackFace, i > 0 && styles.stackOverlap, { borderColor: t.surfaceSolid }]}>
                  <Avatar name={e.name} size={30} isMe={currentEmployee?.id === e.id} />
                </View>
              ))}
              {team.submitted.length > STACK_MAX ? (
                <View style={[styles.stackFace, styles.stackOverlap, styles.stackMore, { borderColor: t.surfaceSolid, backgroundColor: t.raised }]}>
                  <Text style={[styles.stackMoreText, { color: t.text1 }]}>{`+${team.submitted.length - STACK_MAX}`}</Text>
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={[styles.waiting, { color: t.text2 }]}>{team.expected === 0 ? "Nobody is expected to submit." : waitingLabel(waitingNames)}</Text>
        </View>
      </Card>

      <Card style={styles.card}>
        <Text accessibilityRole="header" style={[styles.cardTitle, { color: t.text1 }]}>
          Your recent updates
        </Text>
        {recent.length === 0 ? (
          <EmptyState icon="clock" text="Nothing yet." />
        ) : (
          recent.map((r, i) => (
            <View key={r.date} style={[styles.recent, { borderTopColor: i === 0 ? "transparent" : t.line }]}>
              <Text style={[styles.recentDate, { color: t.text2 }]}>{shortDate(r.date)}</Text>
              <Text numberOfLines={1} style={[styles.recentNote, { color: r.note ? t.text1 : t.text3 }]}>
                {r.note || "—"}
              </Text>
              <Pill tone={RECENT_PILL[r.status].tone}>{RECENT_PILL[r.status].label}</Pill>
            </View>
          ))
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  tools: { gap: 10, marginBottom: 14 },
  days: { flexDirection: "row", gap: 6, padding: 4, borderRadius: radius.md, borderWidth: 1 },
  day: { flex: 1, minHeight: 52, justifyContent: "center", paddingHorizontal: 10, borderRadius: radius.sm, borderWidth: 1, gap: 2 },
  dayLabel: { fontFamily: fonts.bodySemibold, fontSize: 14 },
  dayDate: { fontFamily: fonts.mono, fontSize: 12 },
  clock: { flexDirection: "row", alignItems: "baseline", justifyContent: "center", gap: 8, paddingVertical: 8, borderRadius: radius.md, borderWidth: 1 },
  clockTime: { fontFamily: fonts.monoMedium, fontSize: 20, fontVariant: ["tabular-nums"] },
  clockZone: { fontFamily: fonts.mono, fontSize: 12 },
  card: { borderRadius: radius.xl, gap: 12 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 12 },
  tile: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  heading: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 18 },
  sub: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  status: { alignSelf: "flex-start" },
  saved: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: radius.sm, borderWidth: 1 },
  savedText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13 },
  progress: { gap: 6 },
  progressText: { flexDirection: "row", justifyContent: "space-between" },
  progressLabel: { fontFamily: fonts.body, fontSize: 13 },
  progressPct: { fontFamily: fonts.mono, fontSize: 12 },
  bar: { height: 8, borderRadius: radius.pill, overflow: "hidden", borderWidth: 1 },
  barFill: { height: "100%", borderRadius: radius.pill },
  question: { gap: 8 },
  questionLabel: { flexDirection: "row", gap: 8 },
  questionN: { fontFamily: fonts.monoMedium, fontSize: 12, paddingTop: 2 },
  questionText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14, lineHeight: 20 },
  answer: {
    minHeight: 88,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: "top",
  },
  error: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  actions: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1 },
  actionMain: { flex: 2 },
  foot: { flexDirection: "row", alignItems: "center", gap: 6 },
  footText: { fontFamily: fonts.mono, fontSize: 12 },
  teamHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontFamily: fonts.display, fontSize: 17 },
  mono: { fontFamily: fonts.mono, fontSize: 12 },
  teamRow: { gap: 10 },
  stack: { flexDirection: "row", alignItems: "center" },
  stackFace: { borderWidth: 2, borderRadius: radius.pill },
  stackOverlap: { marginLeft: -8 },
  stackMore: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  stackMoreText: { fontFamily: fonts.bodySemibold, fontSize: 11 },
  waiting: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  recent: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, borderTopWidth: 1 },
  recentDate: { width: 52, fontFamily: fonts.mono, fontSize: 12 },
  recentNote: { flex: 1, fontFamily: fonts.body, fontSize: 14 },
});
