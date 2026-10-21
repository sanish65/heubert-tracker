import { useMemo, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useNow } from "../../lib/useNow";
import { useApp } from "../../context/AppContext";
import { useThemeColors, radius, fonts } from "../../lib/theme";
import { Screen, ScreenHeader, Card, SectionTitle, Eyebrow, EmptyState, Pill } from "../../components/ui";
import Icon from "../../components/Icon";
import { SkeletonList } from "../../components/Skeleton";
import { getNepalDateStr, haversineMeters } from "../../lib/attendance";
import { formatBs } from "../../lib/nepaliDate";

// Attendance, as the canvas's MobileAttendance.dc.html: Back to Home; today's card with the live
// clock, the office check of your check-in and the two punch buttons; the done card once you have
// checked out; then your history. Check In and Check Out call AppContext's checkIn / checkOut as
// before (the office geofence, then the device's fingerprint, face, PIN or pattern check), and a
// refusal shows the same alert with the same message.

const NEPAL_TZ = "Asia/Kathmandu";
const HISTORY_LIMIT = 14;
// The durations count whole minutes, so twice a minute is often enough; the clock has its own tick.
const DURATION_TICK_MS = 30 * 1000;
const CLOCK_TICK_MS = 1000;

// Built once: Intl formatters are costly to make, and the clock formats every second.
const clockFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: NEPAL_TZ,
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
});
const clockDateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: NEPAL_TZ,
  weekday: "long",
  month: "short",
  day: "numeric",
  year: "numeric",
});

// "Mon, Oct 19, 2026".
function formatDate(dateStr) {
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatNepalTime(isoStr) {
  if (!isoStr) return null;
  return new Date(isoStr).toLocaleTimeString("en-US", {
    timeZone: NEPAL_TZ,
    hour: "numeric",
    minute: "2-digit",
  });
}

// "8h 52m", as the web's attendance widget writes it (src/components/AttendancePunchWidget.js).
function formatDuration(ms) {
  const minutes = Math.max(0, Math.floor(ms / 60000));
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

// How far from the office today's check-in was made, in whole metres, read from the place the
// punch stored: only a punch that passed the office check stores one (exempt staff and web punches
// without the office rule store none). Null before check-in, after check-out, and when the office
// has since moved so the stored place is no longer inside it.
function checkInDistance(record, office) {
  if (!record?.check_in_at || record.check_out_at || !office) return null;
  if (record.check_in_lat == null || record.check_in_lng == null) return null;
  const distance = haversineMeters(record.check_in_lat, record.check_in_lng, office.latitude, office.longitude);
  return Number.isFinite(distance) && distance <= office.radius_meters ? Math.round(distance) : null;
}

// The clock, Nepal time: "11:42" with the seconds quieter and the period smaller, then the date.
function LiveClock() {
  const t = useThemeColors();
  const now = useNow(CLOCK_TICK_MS);
  const parts = clockFormat.formatToParts(now);
  const part = (type) => parts.find((p) => p.type === type)?.value || "";
  const hoursMinutes = `${part("hour")}:${part("minute")}`;
  const seconds = part("second");
  const period = part("dayPeriod");
  // Today's Bikram Sambat date, worked out once a day rather than every tick.
  const todayStr = getNepalDateStr(now);
  const todayBs = useMemo(() => formatBs(todayStr), [todayStr]);
  return (
    <View style={styles.clock}>
      {/* The canvas sets line-height 1; at 46 that would clip the digits' tops (the mono's ascent
          is 1.02em), so the line keeps its natural height. */}
      <Text
        accessibilityRole="timer"
        accessibilityLabel={`Current time ${hoursMinutes}:${seconds} ${period}`.trim()}
        style={[styles.clockTime, { color: t.text1 }]}
      >
        {hoursMinutes}
        <Text style={{ color: t.text3 }}>{`:${seconds}`}</Text>
        {period ? " " : null}
        {period ? <Text style={[styles.clockPeriod, { color: t.text2 }]}>{period}</Text> : null}
      </Text>
      <Text style={[styles.clockDate, { color: t.text2 }]}>{clockDateFormat.format(now)}</Text>
      {todayBs ? <Text style={[styles.clockBs, { color: t.cyanText }]}>{`${todayBs} BS`}</Text> : null}
    </View>
  );
}

// One of the two punch buttons, 64 high: the next punch in primary blue, a punch already made as a
// raised tile with its time, and Check Out before check-in as the Foundations disabled control.
function PunchButton({ title, icon, state, time, busy, onPress }) {
  const t = useThemeColors();

  if (state === "done") {
    return (
      <View
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityLabel={`${title}, done at ${time}`}
        style={[styles.punch, styles.punchDone, { backgroundColor: t.raised, borderColor: t.line }]}
      >
        <View style={[styles.punchCheck, { backgroundColor: t.pbGreen }]}>
          <Icon name="check" size={18} strokeWidth={2.2} color={t.pfGreen} />
        </View>
        <View style={styles.punchDoneText}>
          <Text numberOfLines={1} style={[styles.punchDoneTitle, { color: t.text2 }]}>
            {title}
          </Text>
          <Text numberOfLines={1} style={[styles.punchDoneTime, { color: t.text3 }]}>
            Done · {time}
          </Text>
        </View>
      </View>
    );
  }

  if (state === "off") {
    return (
      <View
        accessible
        accessibilityRole="button"
        accessibilityState={{ disabled: true }}
        accessibilityLabel={title}
        style={[styles.punch, { backgroundColor: t.raised, borderColor: t.line }]}
      >
        <Icon name={icon} size={22} strokeWidth={2} color={t.text3} />
        <Text numberOfLines={1} style={[styles.punchLabel, { color: t.text3 }]}>
          {title}
        </Text>
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={busy}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: !!busy, busy: !!busy }}
      style={({ pressed }) => [
        styles.punch,
        styles.punchNext,
        { backgroundColor: pressed ? t.primaryHover : t.primary, boxShadow: t.glowPrimaryLg },
      ]}
    >
      {busy ? <ActivityIndicator color="#FFFFFF" /> : <Icon name={icon} size={22} strokeWidth={2} color="#FFFFFF" />}
      <Text numberOfLines={1} style={styles.punchNextLabel}>
        {title}
      </Text>
    </Pressable>
  );
}

// A day of your history, as the canvas: the date and its status, then its Bikram Sambat date, the
// punch times ("9:12 AM – 6:05 PM", the canvas's form: with "In" and "Out" the line no longer fits a
// phone) and the hours between them. A screen reader still hears "in" and "out". Today's open day
// is "In progress" and counts its hours up to now.
function HistoryRow({ record, todayStr, now }) {
  const t = useThemeColors();
  const checkInTime = formatNepalTime(record.check_in_at);
  const checkOutTime = formatNepalTime(record.check_out_at);
  const inProgress = record.date === todayStr && !!record.check_in_at && !record.check_out_at;

  let hours = null;
  if (record.check_in_at && record.check_out_at) {
    hours = formatDuration(new Date(record.check_out_at) - new Date(record.check_in_at));
  } else if (inProgress) {
    hours = formatDuration(now - new Date(record.check_in_at));
  }

  const status = inProgress
    ? { tone: "cyan", label: "In progress" }
    : record.is_late
      ? { tone: "amber", label: `Late ${record.late_minutes}m` }
      : { tone: "green", label: "On time" };

  const date = formatDate(record.date);
  const bs = formatBs(record.date);
  const label = [date, bs, status.label, `In ${checkInTime || "none"}`, `Out ${checkOutTime || "none"}`, hours].filter(Boolean).join(", ");

  return (
    <View accessible accessibilityLabel={label} style={[styles.historyRow, { borderTopColor: t.line }]}>
      <View style={styles.historyLine}>
        <Text numberOfLines={1} style={[styles.historyDate, { color: t.text1 }]}>
          {date}
        </Text>
        <Pill tone={status.tone}>{status.label}</Pill>
      </View>
      <View style={styles.historyLine}>
        <Text numberOfLines={1} style={[styles.historyBs, { color: t.text3 }]}>
          {bs}
        </Text>
        <Text numberOfLines={1} style={[styles.historyTimes, { color: t.text3 }]}>
          {checkInTime || "—"} – {checkOutTime || "—"}
        </Text>
        {hours ? <Text style={[styles.historyHours, { color: t.text1 }]}>{hours}</Text> : null}
      </View>
    </View>
  );
}

export default function AttendanceScreen() {
  const { attendance, currentEmployee, checkIn, checkOut, isLoaded, isAttendanceGeofenceExempt, officeSettings } = useApp();
  const t = useThemeColors();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const now = useNow(DURATION_TICK_MS);

  const myRecords = useMemo(
    () =>
      (currentEmployee ? attendance.filter((a) => a.employee_name === currentEmployee.name) : [])
        .sort((a, b) => b.date.localeCompare(a.date)),
    [attendance, currentEmployee]
  );

  const todayStr = getNepalDateStr(now);
  const today = myRecords.find((a) => a.date === todayStr);
  const checkedIn = !!today?.check_in_at;
  const checkedOut = !!today?.check_out_at;
  // As before: the day is done only with both punches; until then the next missing one is offered.
  const allDone = checkedIn && checkedOut;
  const checkInTime = formatNepalTime(today?.check_in_at);
  const checkOutTime = formatNepalTime(today?.check_out_at);
  const distance = checkInDistance(today, officeSettings);

  const handleCheckIn = async () => {
    setBusy(true);
    try {
      await checkIn();
    } catch (err) {
      Alert.alert("Check-in failed", err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  const handleCheckOut = async () => {
    setBusy(true);
    try {
      await checkOut();
    } catch (err) {
      Alert.alert("Check-out failed", err.message || "Something went wrong.");
    } finally {
      setBusy(false);
    }
  };

  // Once you have checked in: on time or late, in the words of the history below.
  const punctuality = checkedIn
    ? today.is_late
      ? { tone: "amber", label: `Late ${today.late_minutes}m` }
      : { tone: "green", label: "On time" }
    : null;

  // The punch time in mono on the brighter text, as the canvas; checked in adds the hours so far.
  const punchTime = [styles.statusMono, { color: t.text1 }];
  let status = "Not checked in yet";
  if (checkedOut) {
    status = (
      <>
        {"Checked out at "}
        <Text style={punchTime}>{checkOutTime}</Text>
      </>
    );
  } else if (checkedIn) {
    status = (
      <>
        {"Checked in at "}
        <Text style={punchTime}>{checkInTime}</Text>
        {" · "}
        <Text style={styles.statusMono}>{formatDuration(now - new Date(today.check_in_at))}</Text>
        {" so far"}
      </>
    );
  }

  return (
    <Screen>
      <ScreenHeader title="Attendance" onBack={() => router.navigate("/")} centered />

      <Card style={styles.today}>
        <View style={styles.todayHead}>
          <View accessible accessibilityRole="header" style={styles.todayTitle}>
            <Eyebrow style={styles.todayEyebrow}>{"Today's Attendance"}</Eyebrow>
          </View>
          {punctuality ? (
            <Pill tone={punctuality.tone} style={styles.todayPill}>
              {punctuality.label}
            </Pill>
          ) : null}
        </View>

        <LiveClock />

        {distance != null ? (
          <View style={[styles.geofence, { backgroundColor: t.pbGreen, borderColor: t.line }]}>
            <View style={[styles.geofenceIcon, { backgroundColor: t.raised }]}>
              <Icon name="pin" size={16} strokeWidth={2} color={t.pfGreen} />
            </View>
            <Text style={[styles.geofenceText, { color: t.pfGreen }]}>
              Inside office radius · <Text style={styles.geofenceDistance}>{distance} m</Text>
            </Text>
            <View
              style={[styles.geofenceDot, { backgroundColor: t.pfGreen, boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 10, color: t.pfGreen }] }]}
            />
          </View>
        ) : null}

        <Text style={[styles.status, { color: t.text2 }]}>{status}</Text>

        {!allDone ? (
          <View style={styles.punches}>
            {checkedIn ? (
              <PunchButton title="Check In" state="done" time={checkInTime} />
            ) : (
              <PunchButton title="Check In" icon="check" state="next" busy={busy} onPress={handleCheckIn} />
            )}
            {checkedIn ? (
              <PunchButton title="Check Out" icon="logout" state="next" busy={busy} onPress={handleCheckOut} />
            ) : (
              <PunchButton title="Check Out" icon="logout" state="off" />
            )}
          </View>
        ) : null}

        <View style={[styles.note, { borderTopColor: t.line }]}>
          <Icon name="shield-check" size={18} color={t.text3} style={styles.noteIcon} />
          <Text style={[styles.noteText, { color: t.text3 }]}>
            {isAttendanceGeofenceExempt
              ? "Requires you to verify with your device's fingerprint, face unlock, PIN, or pattern. You can check in from anywhere."
              : "Requires you to be at the office and to verify with your device's fingerprint, face unlock, PIN, or pattern."}
          </Text>
        </View>
      </Card>

      {allDone ? (
        <Card style={styles.done}>
          <View style={[styles.doneIcon, { backgroundColor: t.pbGreen }]}>
            <Icon name="check-circle" size={20} strokeWidth={2} color={t.pfGreen} />
          </View>
          <View style={styles.doneText}>
            <Text style={[styles.doneTitle, { color: t.text1 }]}>{"You're all done for today."}</Text>
            <Text style={[styles.doneMeta, { color: t.text3 }]}>
              {`In ${checkInTime} · Out ${checkOutTime} · ${formatDuration(new Date(today.check_out_at) - new Date(today.check_in_at))}`}
            </Text>
          </View>
        </Card>
      ) : null}

      <Card style={styles.history}>
        <SectionTitle>My History</SectionTitle>
        {!isLoaded ? (
          <SkeletonList count={5} rightWidth={54} />
        ) : myRecords.length === 0 ? (
          <EmptyState icon="pin" text="No attendance records yet." />
        ) : (
          myRecords.slice(0, HISTORY_LIMIT).map((r) => <HistoryRow key={r.id} record={r} todayStr={todayStr} now={now} />)
        )}
      </Card>
    </Screen>
  );
}

// Sizes, gaps and type from MobileAttendance.dc.html; letter-spacing in em becomes pixels at the
// text's size (-0.02em at 46px is -0.92).
const styles = StyleSheet.create({
  // Today: a 20-radius glass card, 18 in, 16 between its parts.
  today: { borderRadius: radius.xl, paddingVertical: 18, gap: 16 },
  todayHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  todayTitle: { flex: 1 },
  todayEyebrow: { fontFamily: fonts.monoMedium },
  todayPill: { height: 24, paddingHorizontal: 10 },

  clock: { alignItems: "center", gap: 6, paddingTop: 6, paddingBottom: 2 },
  clockTime: { fontFamily: fonts.monoMedium, fontSize: 46, letterSpacing: -0.92, fontVariant: ["tabular-nums"] },
  clockPeriod: { fontSize: 20 },
  clockDate: { fontFamily: fonts.mono, fontSize: 15 },
  clockBs: { fontFamily: fonts.mono, fontSize: 13 },

  // The office check: a green strip, 48 high, a pin in a round tile and a glowing dot.
  geofence: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  geofenceIcon: { width: 28, height: 28, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  geofenceText: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14 },
  geofenceDistance: { fontFamily: fonts.monoMedium },
  geofenceDot: { width: 8, height: 8, borderRadius: radius.pill },

  status: { fontFamily: fonts.body, fontSize: 14 },
  statusMono: { fontFamily: fonts.mono },

  // The punch buttons: two equal columns 10 apart, 64 high, 14 radius.
  punches: { flexDirection: "row", gap: 10 },
  punch: {
    flex: 1,
    height: 64,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  punchNext: { borderWidth: 0 },
  punchNextLabel: { flexShrink: 1, fontFamily: fonts.bodySemibold, fontSize: 17, color: "#FFFFFF" },
  punchLabel: { flexShrink: 1, fontFamily: fonts.bodySemibold, fontSize: 17 },
  punchDone: { justifyContent: "flex-start" },
  punchCheck: { width: 32, height: 32, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  punchDoneText: { flex: 1, gap: 2 },
  punchDoneTitle: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  punchDoneTime: { fontFamily: fonts.mono, fontSize: 12 },

  // The requirement under a hairline; 1.45 line height at 13.
  note: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingTop: 14, borderTopWidth: 1 },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19 },

  // After check-out: an 18-radius glass card, a 40 green tile and two lines.
  done: { flexDirection: "row", alignItems: "center", gap: 12, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16 },
  doneIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  doneText: { flex: 1, gap: 2 },
  doneTitle: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  doneMeta: { fontFamily: fonts.mono, fontSize: 12 },

  // History: a 20-radius glass card, 6 at the bottom under the last row; rows 52 high on a hairline.
  history: { borderRadius: radius.xl, paddingTop: 16, paddingBottom: 6 },
  historyRow: { gap: 6, minHeight: 52, paddingVertical: 12, borderTopWidth: 1 },
  historyLine: { flexDirection: "row", alignItems: "center", gap: 8 },
  historyDate: { flex: 1, fontFamily: fonts.monoMedium, fontSize: 15 },
  historyBs: { flex: 1, fontFamily: fonts.mono, fontSize: 12 },
  historyTimes: { flexShrink: 1, fontFamily: fonts.mono, fontSize: 12 },
  historyHours: { minWidth: 54, fontFamily: fonts.mono, fontSize: 12, textAlign: "right" },
});
