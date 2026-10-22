import { useMemo, useState } from "react";
import { View, Text, Pressable, ScrollView, ActivityIndicator, Linking, StyleSheet } from "react-native";
import { useGoBack } from "../lib/useGoBack";
import { useNow } from "../lib/useNow";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Screen, ScreenHeader, Card, SectionTitle, Eyebrow, EmptyState, Chip, Button, IconButton, Pill } from "../components/ui";
import { SheetSwitch } from "../components/SheetParts";
import { SkeletonList } from "../components/Skeleton";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import CalendarEventSheet from "../components/CalendarEventSheet";
import CalendarFindTime from "../components/CalendarFindTime";
import { useTeamCalendar } from "../lib/useTeamCalendar";
import {
  DAY_END,
  EVENT_KINDS,
  addDays,
  workWeekOf,
  isWeekend,
  nepalParts,
  formatHour,
  leaveOn,
  leaveHours,
  dayBlocks,
  allDayOn,
  statusAt,
  findFreeSlots,
} from "../lib/teamCalendar";

// The Team calendar, the web's Calendar tab (src/components/CalendarPage.js) laid out for a phone:
// a week strip to pick a working day, the people filter and "Busy blocks only", what's next for
// you today, then the day as an agenda per teammate (their status now, their meetings and leave),
// and Find a time. Meetings come from the deployed /api/calendar route (useTeamCalendar), which
// blanks private titles and keeps the Meet link only on your own events; leaves and holidays come
// from the tracker. Tapping a meeting opens its details sheet. The web's week grid is the week
// strip here: a phone shows one day at a time.

// Weekends have no working hours to show, so a weekend lands on the next working day that way.
function workingDayFrom(dateStr, direction = 1) {
  let d = dateStr;
  while (isWeekend(d)) d = addDays(d, direction);
  return d;
}

function formatDay(dateStr, opts = { weekday: "long", month: "short", day: "numeric" }) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}
const shortDay = (d) => formatDay(d, { weekday: "short", month: "short", day: "numeric" });

function timeAgo(iso, nowMs) {
  if (!iso) return "";
  const min = Math.round((nowMs - Date.parse(iso)) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  return `${Math.round(min / 60)} h ago`;
}

function inLabel(fromHour, nowHour) {
  const mins = Math.max(Math.round((fromHour - nowHour) * 60), 0);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `in ${h}h ${m}m` : `in ${m}m`;
}

const leaveLabel = (part) => (part === "full" ? "On leave" : part === "early" ? "Early leave" : "Half-day leave");

const TONES = {
  blue: ["pbBlue", "pfBlue"],
  violet: ["pbViolet", "pfViolet"],
  gray: ["pbGray", "pfGray"],
  amber: ["pbAmber", "pfAmber"],
  cyan: ["pbCyan", "pfCyan"],
  green: ["pbGreen", "pfGreen"],
};

function Notice({ tone = "info", icon, title, children, action }) {
  const t = useThemeColors();
  const error = tone === "error";
  return (
    <View
      accessibilityRole={error ? "alert" : undefined}
      style={[styles.notice, { backgroundColor: error ? t.pbRed : t.surface, borderColor: error ? "transparent" : t.line }]}
    >
      <Icon name={icon} size={18} color={error ? t.pfRed : t.cyanText} style={styles.noticeIcon} />
      <View style={styles.noticeText}>
        <Text style={[styles.noticeTitle, { color: error ? t.pfRed : t.text1 }]}>{title}</Text>
        <Text style={[styles.body, { color: error ? t.text1 : t.text2 }]}>{children}</Text>
        {action}
      </View>
    </View>
  );
}

function WeekStrip({ week, date, today, holidayOn, onPick, onStep }) {
  const t = useThemeColors();
  return (
    <View style={styles.strip}>
      <IconButton icon="chevron-left" onPress={() => onStep(-1)} accessibilityLabel="Previous week" tone="plain" size={40} />
      {week.map((d) => {
        const selected = d === date;
        const isToday = d === today;
        const holiday = holidayOn(d);
        return (
          <Pressable
            key={d}
            onPress={() => onPick(d)}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            accessibilityLabel={`${formatDay(d)}${isToday ? ", today" : ""}${holiday ? `, ${holiday.title}` : ""}`}
            style={({ pressed }) => [
              styles.stripDay,
              {
                backgroundColor: selected ? t.primarySoft : pressed ? t.raised : t.surface,
                borderColor: selected ? t.primary : isToday ? t.cyan : t.line,
              },
            ]}
          >
            <Text style={[styles.stripWeekday, { color: selected ? t.text1 : t.text3 }]}>{formatDay(d, { weekday: "short" })}</Text>
            <Text style={[styles.stripNum, { color: t.text1 }]}>{Number(d.slice(8))}</Text>
            <View style={[styles.stripDot, { backgroundColor: holiday ? t.pfAmber : isToday ? t.cyan : "transparent" }]} />
          </Pressable>
        );
      })}
      <IconButton icon="chevron-right" onPress={() => onStep(1)} accessibilityLabel="Next week" tone="plain" size={40} />
    </View>
  );
}

function EventRow({ item, onPress, first }) {
  const t = useThemeColors();
  const [fill, ink] = TONES[item.tone] || TONES.gray;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${item.label}, ${item.time}`}
      style={({ pressed }) => [styles.event, !first && { borderTopWidth: 1, borderTopColor: t.line }, pressed && { backgroundColor: t.raised }]}
    >
      <Text style={[styles.eventTime, { color: t.text2 }]}>{item.time}</Text>
      <View style={[styles.eventBar, { backgroundColor: t[ink] }]} />
      <View style={[styles.eventChip, { backgroundColor: t[fill] }]}>
        <Text numberOfLines={1} style={[styles.eventTitle, { color: t[ink] }]}>
          {item.label}
        </Text>
      </View>
      {onPress ? <Icon name="chevron-right" size={16} color={t.text3} /> : null}
    </Pressable>
  );
}

export default function CalendarScreen() {
  const t = useThemeColors();
  const goBack = useGoBack();
  const { employees, leaves, publicHolidays, currentEmployee, isAdmin, projects, projectMembers } = useApp();
  const now = useNow(60 * 1000);
  const nepalNow = nepalParts(now.toISOString());
  const today = nepalNow?.date || now.toISOString().slice(0, 10);
  const nowHour = nepalNow?.hour ?? 0;

  const [date, setDate] = useState(() => workingDayFrom(today));
  const [team, setTeam] = useState("all");
  const [busyOnly, setBusyOnly] = useState(false);
  const [picked, setPicked] = useState(() => (currentEmployee ? [currentEmployee.id] : []));
  const [duration, setDuration] = useState(30);
  const [open, setOpen] = useState(null); // { event, person }

  // One fetch per work week; the day is a slice of it, and Find a time reads it too.
  const week = workWeekOf(date);
  const cal = useTeamCalendar(week[0], addDays(week[0], 7));

  const people = useMemo(() => {
    const active = (employees || []).filter((e) => e.status === "active" && !e.leave_excluded);
    const memberIds = team === "all" ? null : new Set((projectMembers || []).filter((m) => m.project_id === team).map((m) => m.employee_id));
    return active
      .filter((e) => !memberIds || memberIds.has(e.id) || e.id === currentEmployee?.id)
      .sort((a, b) => {
        if (a.id === currentEmployee?.id) return -1;
        if (b.id === currentEmployee?.id) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [employees, projectMembers, team, currentEmployee]);

  const calById = useMemo(() => new Map(cal.people.map((p) => [p.employeeId, p])), [cal.people]);
  const eventsOf = (emp) => calById.get(emp.id)?.events || [];
  const holidayOn = (d) => (publicHolidays || []).find((h) => String(h.date).slice(0, 10) === d) || null;
  const isMe = (emp) => emp.id === currentEmployee?.id;
  const connected = cal.configured && !cal.setupError;
  const okCount = cal.people.filter((p) => p.status === "ok").length;
  const reachable = cal.people.filter((p) => p.status !== "no-workspace-email").length;
  const teamProjects = (projects || []).filter((p) => p.status !== "archived" && (projectMembers || []).some((m) => m.project_id === p.id));
  const holiday = holidayOn(date);
  const isToday = date === today;

  // A private event (no title from the route), or a teammate's with "Busy blocks only" on, shows as
  // Busy, in grey, with nothing but its time: the web's rule.
  const busyFor = (emp, e) => e.title == null || (busyOnly && !isMe(emp));

  const step = (direction) => setDate(addDays(week[0], direction * 7));

  // Up next (yours, today).
  const myBlocks = currentEmployee && isToday ? dayBlocks(eventsOf(currentEmployee), today) : [];
  const upNext = myBlocks.filter((b) => b.to > nowHour).slice(0, 3);

  // Find a time, this week from today on, skipping holidays.
  const pickedPeople = people.filter((p) => picked.includes(p.id));
  const searchDays = week.filter((d) => d >= today && !holidayOn(d));
  const slots = connected
    ? findFreeSlots(
        pickedPeople.map((p) => ({ events: eventsOf(p), leaveFor: (d) => leaveOn(leaves, p.name, d) })),
        searchDays,
        { durationMin: duration, today, nowHour, limit: 3 }
      )
    : [];

  const openEvent = (emp, e) => {
    const busy = busyFor(emp, e);
    setOpen({
      person: { name: emp.name, isMe: isMe(emp) },
      event: { ...e, busy, private: e.title == null, meet: isMe(emp) ? e.meet : null },
    });
  };

  const joinMeet = (url) => {
    if (url && /^https:\/\//i.test(url)) Linking.openURL(url).catch(() => {});
  };

  const subtitle = connected
    ? `Synced from Google · ${timeAgo(cal.fetchedAt, now.getTime())}`
    : cal.configured === false || cal.setupError
      ? "Leaves and holidays only"
      : "Everyone's meetings, leaves and holidays";

  return (
    <Screen>
      <ScreenHeader
        title="Team calendar"
        subtitle={subtitle}
        onBack={goBack}
        right={
          cal.isLoading && cal.fetchedAt ? (
            <ActivityIndicator color={t.text2} style={styles.spinner} accessibilityLabel="Refreshing calendars" />
          ) : (
            <IconButton icon="refresh" onPress={cal.reload} accessibilityLabel="Refresh calendars" size={44} />
          )
        }
      />

      {cal.setupError ? (
        <Notice tone="error" icon="alert" title="Google Calendar rejected the connection.">
          {`${cal.setupError} Check the service account's domain-wide delegation and scope (docs/team-calendar/setup.md).`}
        </Notice>
      ) : cal.configured === false ? (
        <Notice icon="calendar" title="Google Calendar isn't connected yet.">
          {isAdmin
            ? "A Google Workspace admin grants the tracker read-only access once; then everyone's meetings appear here. The steps are in docs/team-calendar/setup.md. Until then this shows leaves and holidays only."
            : "Ask an admin to connect it. Until then this shows leaves and holidays only."}
        </Notice>
      ) : null}
      {cal.error ? (
        <Notice tone="error" icon="alert" title="Couldn't load calendars." action={<Button title="Retry" variant="secondary" small onPress={cal.reload} style={styles.retry} />}>
          {cal.error}
        </Notice>
      ) : null}

      <Card style={styles.weekCard}>
        <View style={styles.weekHead}>
          <Eyebrow>{formatDay(date)}</Eyebrow>
          {date !== workingDayFrom(today) ? (
            <Pressable onPress={() => setDate(workingDayFrom(today))} accessibilityRole="button" hitSlop={10}>
              <Text style={[styles.todayLink, { color: t.primaryText }]}>Today</Text>
            </Pressable>
          ) : null}
        </View>
        <WeekStrip week={week} date={date} today={today} holidayOn={holidayOn} onPick={setDate} onStep={step} />
        {connected && reachable > 0 ? (
          <Pill tone={okCount === reachable ? "green" : "amber"} style={styles.connected}>
            {okCount === reachable ? `All ${reachable} connected` : `${okCount} of ${reachable} connected`}
          </Pill>
        ) : null}
      </Card>

      {teamProjects.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.teams} accessibilityLabel="People">
          <Chip label="Everyone" active={team === "all"} onPress={() => setTeam("all")} />
          {teamProjects.map((p) => (
            <Chip key={p.id} label={`${p.name} team`} active={team === p.id} onPress={() => setTeam(p.id)} />
          ))}
        </ScrollView>
      ) : null}

      <Card style={styles.switchCard}>
        <SheetSwitch label="Busy blocks only" description="Hide your teammates' meeting titles" value={busyOnly} onValueChange={setBusyOnly} last />
      </Card>

      {isToday && connected ? (
        <Card>
          <View style={styles.cardHead}>
            <SectionTitle style={styles.noMargin}>Up next for you</SectionTitle>
            <Text style={[styles.mono, { color: t.text3 }]}>{shortDay(today)}</Text>
          </View>
          {upNext.length === 0 ? (
            <Text style={[styles.body, { color: t.text3 }]}>Nothing else on your calendar today.</Text>
          ) : (
            upNext.map((b, i) => {
              const live = b.from <= nowHour && b.to > nowHour;
              return (
                <View key={b.id + b.start} style={[styles.next, i > 0 && { borderTopWidth: 1, borderTopColor: t.line }]}>
                  <Text style={[styles.mono, styles.nextTime, { color: t.text1 }]}>{formatHour(b.from)}</Text>
                  <View style={styles.nextText}>
                    <Text numberOfLines={1} style={[styles.nextTitle, { color: t.text1 }]}>
                      {b.title || "Busy"}
                    </Text>
                    <Text style={[styles.small, { color: t.text3 }]}>
                      {b.meet ? "Google Meet" : "No video link"}
                      {b.attendeeCount > 1 ? ` · ${b.attendeeCount} people` : ""}
                    </Text>
                  </View>
                  {live && b.meet ? (
                    <Button title="Join" icon="video" small onPress={() => joinMeet(b.meet)} />
                  ) : live ? (
                    <Pill tone="blue">Now</Pill>
                  ) : (
                    <Pill tone="gray">{inLabel(b.from, nowHour)}</Pill>
                  )}
                </View>
              );
            })
          )}
        </Card>
      ) : null}

      {holiday ? (
        <View style={[styles.holiday, { backgroundColor: t.pbAmber, borderColor: t.amberEdge }]}>
          <Icon name="flag" size={16} color={t.pfAmber} />
          <Text style={[styles.holidayText, { color: t.text1 }]}>Public holiday · {holiday.title}</Text>
        </View>
      ) : null}

      {cal.isLoading && !cal.fetchedAt && cal.configured == null ? (
        <Card>
          <SkeletonList count={4} avatar />
        </Card>
      ) : people.length === 0 ? (
        <Card>
          <EmptyState icon="users" text="No one in this team yet." />
        </Card>
      ) : (
        people.map((emp) => {
          const events = eventsOf(emp);
          const blocks = dayBlocks(events, date);
          const allDay = allDayOn(events, date);
          const leave = leaveOn(leaves, emp.name, date);
          const status = statusAt({ blocks, allDay, leave, nowHour, isToday });
          const calStatus = calById.get(emp.id)?.status;
          const ooo = allDay.find((e) => e.kind === "ooo");
          const partLeave = leave && leave.part !== "full" ? leaveHours(leave.part) : null;

          const rows = [];
          if (leave?.part === "full") rows.push({ key: "leave", time: "All day", label: "On leave", tone: "cyan" });
          else if (ooo) rows.push({ key: "ooo", time: "All day", label: ooo.title && !busyFor(emp, ooo) ? ooo.title : "Out of office", tone: "cyan" });
          else {
            for (const e of allDay) {
              rows.push({ key: e.id + e.start, time: "All day", label: busyFor(emp, e) ? "Busy" : e.title, tone: busyFor(emp, e) ? "gray" : (EVENT_KINDS[e.kind] || EVENT_KINDS.team).tone, event: { ...e, timeLabel: "All day" } });
            }
            if (partLeave) {
              rows.push({ key: "part", from: partLeave[0], time: `${formatHour(partLeave[0])}–${formatHour(partLeave[1])}`, label: leaveLabel(leave.part), tone: "cyan" });
            }
            for (const b of blocks) {
              const busy = busyFor(emp, b);
              rows.push({ key: b.id + b.start, from: b.from, time: b.timeLabel, label: busy ? "Busy" : b.title, tone: busy ? "gray" : (EVENT_KINDS[b.kind] || EVENT_KINDS.team).tone, event: b });
            }
            rows.sort((a, b) => (a.from ?? -1) - (b.from ?? -1));
          }

          return (
            <Card key={emp.id} style={styles.person}>
              <View style={styles.personHead}>
                <Avatar name={emp.name} size={36} isMe={isMe(emp)} />
                <Text numberOfLines={1} style={[styles.personName, { color: t.text1 }]}>
                  {emp.name}
                  {isMe(emp) ? " (you)" : ""}
                </Text>
                <Pill tone={status.tone}>{status.text}</Pill>
              </View>
              {rows.length > 0 ? (
                <View style={[styles.events, { borderColor: t.line }]}>
                  {rows.map((r, i) => (
                    <EventRow key={r.key} item={r} first={i === 0} onPress={r.event ? () => openEvent(emp, r.event) : null} />
                  ))}
                </View>
              ) : connected && calStatus && calStatus !== "ok" ? (
                <Text style={[styles.small, styles.personNote, { color: t.text3 }]}>
                  {calStatus === "no-workspace-email" ? "No Workspace email on file" : "Calendar unavailable"}
                </Text>
              ) : connected && !holiday ? (
                <Text style={[styles.small, styles.personNote, { color: t.text3 }]}>
                  {isToday && nowHour >= DAY_END ? "Day over" : "No meetings"}
                </Text>
              ) : null}
            </Card>
          );
        })
      )}

      <CalendarFindTime
        connected={connected}
        people={people}
        picked={picked}
        setPicked={setPicked}
        duration={duration}
        setDuration={setDuration}
        slots={slots}
        dayLabel={shortDay}
        today={today}
        isMe={isMe}
      />

      <View style={styles.legend} accessible accessibilityLabel="Colours: team meeting blue, client call violet, focus time and busy grey, interview amber, out of office and leave cyan">
        {Object.entries(EVENT_KINDS).map(([key, k]) => {
          const [fill, ink] = TONES[k.tone] || TONES.gray;
          return (
            <View key={key} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: t[fill], borderColor: t[ink] }]} />
              <Text style={[styles.small, { color: t.text2 }]}>{k.label}</Text>
            </View>
          );
        })}
      </View>

      {open ? <CalendarEventSheet event={open.event} person={open.person} dayLabel={shortDay(date)} onClose={() => setOpen(null)} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  spinner: { width: 44, height: 44 },
  notice: { flexDirection: "row", gap: 10, borderWidth: 1, borderRadius: radius.lg, padding: 14, marginBottom: 14 },
  noticeIcon: { marginTop: 2 },
  noticeText: { flex: 1, minWidth: 0, gap: 4 },
  noticeTitle: { fontFamily: fonts.bodySemibold, fontSize: 14 },
  retry: { alignSelf: "flex-start", marginTop: 6 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  mono: { fontFamily: fonts.mono, fontSize: 12 },
  weekCard: { paddingHorizontal: 10 },
  weekHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8, marginBottom: 10 },
  todayLink: { fontFamily: fonts.bodySemibold, fontSize: 14 },
  strip: { flexDirection: "row", alignItems: "center", gap: 4 },
  stripDay: { flex: 1, minHeight: 64, alignItems: "center", justifyContent: "center", gap: 2, borderWidth: 1, borderRadius: radius.md },
  stripWeekday: { fontFamily: fonts.mono, fontSize: 11, textTransform: "uppercase" },
  stripNum: { fontFamily: fonts.display, fontSize: 18 },
  stripDot: { width: 6, height: 6, borderRadius: 3 },
  connected: { alignSelf: "flex-start", marginTop: 12, marginLeft: 8 },
  teams: { paddingBottom: 6 },
  switchCard: { paddingVertical: 4 },
  cardHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  noMargin: { marginBottom: 0 },
  next: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  nextTime: { width: 44 },
  nextText: { flex: 1, minWidth: 0, gap: 2 },
  nextTitle: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  holiday: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14 },
  holidayText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14 },
  person: { paddingVertical: 14 },
  personHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  personName: { flex: 1, minWidth: 0, fontFamily: fonts.bodySemibold, fontSize: 15 },
  personNote: { marginTop: 8, marginLeft: 46 },
  events: { marginTop: 12, borderWidth: 1, borderRadius: radius.md, overflow: "hidden" },
  event: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 12, paddingVertical: 8 },
  eventTime: { width: 92, fontFamily: fonts.mono, fontSize: 12 },
  eventBar: { width: 3, alignSelf: "stretch", borderRadius: 2 },
  eventChip: { flex: 1, minWidth: 0, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  eventTitle: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  legend: { flexDirection: "row", flexWrap: "wrap", gap: 12, paddingHorizontal: 4, marginTop: 4 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 12, height: 12, borderRadius: 3, borderWidth: 1 },
});
