import { useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { useApp } from "../../context/AppContext";
import { API_BASE_URL } from "../../lib/supabase";
import { useThemeColors, radius, fonts } from "../../lib/theme";
import { Screen, Card, SectionTitle, Eyebrow, EmptyState, Chip, Button, Pill } from "../../components/ui";
import TopBar from "../../components/TopBar";
import Avatar from "../../components/Avatar";
import Icon from "../../components/Icon";
import EventBanner from "../../components/EventBanner";
import NewFiscalYearBanner from "../../components/NewFiscalYearBanner";
import { getNepalDateStr } from "../../lib/attendance";
import { formatBs } from "../../lib/nepaliDate";

// Home, in the order of the canvas's MobileDashboard.dc.html: the greeting, today's attendance,
// the announcements, the key figures, then pending standups, fines by employee, upcoming leaves,
// upcoming holidays and celebrations. The data and the actions are the ones Home had before the
// redesign; only the look changed.

// The key figures' dots, as the canvas draws them and the web tiles colour them
// (src/components/Dashboard.js): token names, all fixed in both themes. Employees, the app's fifth
// figure, is not on the canvas; it takes the web's colour for that tile.
const FIGURE_DOTS = {
  late: "primary",
  unpaid: "unpaid",
  collected: "green",
  standups: "red",
  employees: "cyanDot",
};

function formatNepalTime(isoStr) {
  if (!isoStr) return null;
  return new Date(isoStr).toLocaleTimeString("en-US", {
    timeZone: "Asia/Kathmandu",
    hour: "numeric",
    minute: "2-digit",
  });
}

// The header's eyebrow, "Mon · Oct 19 · 3 Kartik 2083": today in Nepal, as the web dashboard writes
// it (src/app/page.js), with the Bikram Sambat date the canvas adds (left off outside the table).
function todayLine() {
  const today = getNepalDateStr(new Date());
  const day = new Date(`${today}T00:00:00Z`);
  const weekday = day.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const monthDay = day.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
  return [weekday, monthDay, formatBs(today)].filter(Boolean).join(" · ");
}

const firstWord = (text) => String(text || "").trim().split(/\s+/)[0];

// Today's attendance, as the canvas card. The whole card opens Attendance, as before; the Check In
// or Check Out inside it says what Attendance offers next, it is not a button of its own.
function AttendanceCard() {
  const { attendance, currentEmployee, leaves, publicHolidays } = useApp();
  const t = useThemeColors();

  const todayStr = getNepalDateStr(new Date());
  const isWeekendToday = new Date().getDay() === 0 || new Date().getDay() === 6;
  const todaysHoliday = publicHolidays.find((h) => h.date === todayStr);
  const onLeaveToday = currentEmployee
    ? leaves.some((l) => l.employee_name === currentEmployee.name && todayStr >= l.start_date && todayStr <= l.end_date)
    : false;
  const today = currentEmployee
    ? attendance.find((a) => a.employee_name === currentEmployee.name && a.date === todayStr)
    : null;

  // The order this card has always checked: a day off, your leave, then your punches. A punch
  // shows its time large, as the canvas; the other days say what they are.
  let headline = "You haven't checked in yet today!";
  let time = null;
  let statusText = null;
  let action = { title: "Check In" };

  if (isWeekendToday || todaysHoliday) {
    headline = todaysHoliday ? `Relax, it's ${todaysHoliday.title}!` : "Relax, it's the weekend!";
    statusText = "No attendance needed today.";
    action = null;
  } else if (onLeaveToday) {
    headline = "You're on leave today";
    statusText = "Enjoy your time off!";
    action = null;
  } else if (today?.check_out_at) {
    time = formatNepalTime(today.check_out_at);
    statusText = "Checked out";
    action = null;
  } else if (today?.check_in_at) {
    time = formatNepalTime(today.check_in_at);
    statusText = "Checked in";
    action = { title: "Check Out", icon: "logout" };
  }

  // Once you have checked in: on time or late, in the words of Attendance's history.
  const punctuality = time
    ? today.is_late
      ? { tone: "amber", label: `Late ${today.late_minutes}m` }
      : { tone: "green", label: "On time" }
    : null;

  return (
    <Link href="/attendance" asChild>
      <Pressable>
        {({ pressed }) => (
          <Card style={[styles.attendance, pressed && styles.pressed]}>
            <View style={styles.attendanceHead}>
              <Eyebrow style={[styles.attendanceEyebrow, { color: t.text3 }]}>{"Today's Attendance"}</Eyebrow>
              {punctuality ? (
                <Pill tone={punctuality.tone} style={styles.attendancePill}>
                  {punctuality.label}
                </Pill>
              ) : null}
            </View>
            <View style={styles.attendanceBody}>
              <View style={styles.attendanceText}>
                <Text style={[time ? styles.attendanceTime : styles.attendanceHeadline, { color: t.text1 }]}>{time || headline}</Text>
                {statusText ? <Text style={[styles.attendanceStatus, { color: t.text3 }]}>{statusText}</Text> : null}
              </View>
              {action ? (
                <View style={[styles.attendanceAction, { backgroundColor: t.primary, boxShadow: t.glowPrimary }]}>
                  {action.icon ? <Icon name={action.icon} size={18} strokeWidth={2} color="#FFFFFF" /> : null}
                  <Text style={styles.attendanceActionText}>{action.title}</Text>
                </View>
              ) : null}
            </View>
          </Card>
        )}
      </Pressable>
    </Link>
  );
}

// One key figure, as the canvas tile: a mono label with its coloured dot, the number, a muted line.
function KeyFigure({ label, value, sub, dot }) {
  const t = useThemeColors();
  return (
    <Card style={styles.figure}>
      <View style={styles.figureHead}>
        <Eyebrow style={[styles.figureLabel, { color: t.text3 }]}>{label}</Eyebrow>
        <View style={[styles.figureDot, { backgroundColor: dot, boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 10, color: dot }] }]} />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.figureValue, { color: t.text1 }]}>
        {value}
      </Text>
      {sub ? <Text style={[styles.figureSub, { color: t.text3 }]}>{sub}</Text> : null}
    </Card>
  );
}

// The canvas grid: two columns of equal tiles; an odd last tile keeps its column's width.
function KeyFigures({ figures }) {
  const rows = [];
  for (let i = 0; i < figures.length; i += 2) rows.push(figures.slice(i, i + 2));
  return (
    <View style={styles.figures}>
      {rows.map((row) => (
        <View key={row[0].key} style={styles.figureRow}>
          {row.map(({ key, ...figure }) => (
            <KeyFigure key={key} {...figure} />
          ))}
          {row.length === 1 ? <View style={styles.figureSpacer} /> : null}
        </View>
      ))}
    </View>
  );
}

export default function DashboardScreen() {
  const { fines, fineSeasons, standupFines, employees, leaves, withdrawals, publicHolidays, currentEmployee, user } = useApp();
  const t = useThemeColors();
  const [sendingWish, setSendingWish] = useState(null);
  const [selectedFineSeasonId, setSelectedFineSeasonId] = useState(null); // null = follow latest season

  const firstName = firstWord(currentEmployee?.name || user?.user_metadata?.full_name) || String(user?.email || "").split("@")[0];

  const totalAmount = fines.reduce((s, f) => s + f.amount, 0);
  const paidAmount = fines.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0);
  const unpaidAmount = fines.filter((f) => f.status === "unpaid").reduce((s, f) => s + f.amount, 0);
  const totalWithdrawn = withdrawals.reduce((s, w) => s + w.amount, 0);
  const remaining = paidAmount - totalWithdrawn;
  const standupUnpaid = standupFines.filter((f) => f.status === "unpaid");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const upcomingLeaves = leaves
    .filter((l) => l.end_date >= todayStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 5);

  const upcomingHolidays = publicHolidays
    .filter((h) => h.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const celebrations = employees
    .flatMap((emp) => {
      const list = [];
      const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const getCelebrationsForDate = (originalDate, type) => {
        const d = new Date(originalDate);
        const yearsToCheck = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];

        yearsToCheck.forEach((y) => {
          const occurrence = new Date(y, d.getMonth(), d.getDate());
          const diffDays = (occurrence - todayNoTime) / (1000 * 60 * 60 * 24);

          if (Math.abs(diffDays) <= 15) {
            const isToday = occurrence.toDateString() === today.toDateString();
            if (type === "birthday") {
              list.push({
                type: "birthday",
                date: occurrence,
                displayDate: `${occurrence.toLocaleString("default", { month: "short" })} ${occurrence.getDate()}`,
                name: "Birthday",
                email: emp.work_email || emp.personal_email,
                empName: emp.name,
                isToday,
              });
            } else {
              const years = y - d.getFullYear();
              if (years > 0) {
                list.push({
                  type: "anniversary",
                  date: occurrence,
                  displayDate: `${occurrence.toLocaleString("default", { month: "short" })} ${occurrence.getDate()}`,
                  name: `${years} Year${years > 1 ? "s" : ""} at Heubert!`,
                  email: emp.work_email || emp.personal_email,
                  empName: emp.name,
                  years,
                  isToday,
                });
              }
            }
          }
        });
      };

      if (emp.dob) getCelebrationsForDate(emp.dob, "birthday");
      if (emp.joined_date) getCelebrationsForDate(emp.joined_date, "anniversary");
      return list;
    })
    .sort((a, b) => a.date - b.date);

  // Fine seasons — the chart below is scoped to whichever season is selected,
  // defaulting to the latest one. The key figures are unaffected — they
  // always span every fine, regardless of season.
  const sortedFineSeasons = [...fineSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const latestFineSeasonId = sortedFineSeasons[0]?.id ?? null;
  const hasUnassignedFines = fines.some((f) => !f.season_id);
  const effectiveFineSeasonId =
    selectedFineSeasonId !== null ? selectedFineSeasonId : latestFineSeasonId ?? (hasUnassignedFines ? "unassigned" : null);
  const activeFineSeason = sortedFineSeasons.find((s) => s.id === effectiveFineSeasonId);

  const seasonFines = effectiveFineSeasonId === "unassigned" ? fines.filter((f) => !f.season_id) : fines.filter((f) => f.season_id === effectiveFineSeasonId);

  const empData = employees
    .filter((emp) => emp.status !== "resigned" && emp.name !== "Developers" && emp.name !== "Sameer")
    .map((emp) => {
      const empFines = seasonFines.filter((f) => f.employee_name === emp.name);
      return {
        name: emp.name,
        paid: empFines.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0),
        unpaid: empFines.filter((f) => f.status === "unpaid").reduce((s, f) => s + f.amount, 0),
      };
    })
    .filter((e) => e.paid + e.unpaid > 0)
    .sort((a, b) => b.paid + b.unpaid - (a.paid + a.unpaid));

  const maxTotal = Math.max(...empData.map((e) => e.paid + e.unpaid), 1);

  // The canvas's order (late fines, unpaid, collected, standups), then the app's own Employees.
  const figures = [
    { key: "late", label: "Late Fines", value: `Rs. ${totalAmount.toLocaleString()}`, sub: `${fines.length} records`, dot: t[FIGURE_DOTS.late] },
    {
      key: "unpaid",
      label: "Unpaid Fines",
      value: `Rs. ${unpaidAmount.toLocaleString()}`,
      sub: `${fines.filter((f) => f.status === "unpaid").length} late entries`,
      dot: t[FIGURE_DOTS.unpaid],
    },
    {
      key: "collected",
      label: "Collected & Withdrawn",
      value: `Rs. ${paidAmount.toLocaleString()}`,
      sub: `Rs. ${totalWithdrawn.toLocaleString()} withdrawn · Rs. ${remaining >= 0 ? remaining.toLocaleString() : 0} left`,
      dot: t[FIGURE_DOTS.collected],
    },
    { key: "standups", label: "Standup Records", value: standupFines.length, sub: `${standupUnpaid.length} pending`, dot: t[FIGURE_DOTS.standups] },
    { key: "employees", label: "Employees", value: employees.length, sub: "active", dot: t[FIGURE_DOTS.employees] },
  ];

  const handleWish = async (celebration) => {
    setSendingWish(celebration.empName);
    try {
      const res = await fetch(`${API_BASE_URL}/api/send-wish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: celebration.email,
          name: celebration.empName,
          type: celebration.type,
          years: celebration.years,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to send wish");
    } catch (err) {
      console.error("Send wish error:", err);
    } finally {
      setSendingWish(null);
    }
  };

  const rowLine = { borderTopColor: t.line };

  return (
    <Screen>
      <TopBar title={firstName ? `Hi, ${firstName}` : "Hi"} eyebrow={todayLine()} />

      <AttendanceCard />

      <EventBanner />
      <NewFiscalYearBanner />

      <KeyFigures figures={figures} />

      <Card style={styles.section}>
        <View style={styles.sectionHead}>
          <SectionTitle style={styles.flushTitle}>Pending standups</SectionTitle>
          {standupUnpaid.length > 0 ? <Pill tone="red">{standupUnpaid.length}</Pill> : null}
        </View>
        {standupUnpaid.length === 0 ? (
          <EmptyState icon="check" text="All caught up!" />
        ) : (
          <View style={styles.rows}>
            {standupUnpaid.slice(0, 5).map((f) => (
              <View key={f.id} style={[styles.row, rowLine]}>
                <Avatar name={f.employee_name} size={34} />
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={[styles.rowName, { color: t.text1 }]}>
                    {f.employee_name}
                  </Text>
                  <Text numberOfLines={1} style={[styles.rowMono, { color: t.text3 }]}>
                    {f.date}
                  </Text>
                </View>
                <Pill tone="amber">Pending</Pill>
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card style={[styles.section, styles.fines]}>
        <SectionTitle style={styles.flushTitle}>Fines by employee</SectionTitle>
        {(sortedFineSeasons.length > 0 || hasUnassignedFines) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
            {sortedFineSeasons.map((s) => (
              <Chip key={s.id} label={s.title} active={effectiveFineSeasonId === s.id} onPress={() => setSelectedFineSeasonId(s.id)} />
            ))}
            {hasUnassignedFines && (
              <Chip
                label="Pre Fiscal Year Fines"
                active={effectiveFineSeasonId === "unassigned"}
                onPress={() => setSelectedFineSeasonId("unassigned")}
              />
            )}
          </ScrollView>
        )}
        {empData.length === 0 ? (
          <EmptyState icon="wallet" text={`No fines recorded in ${activeFineSeason ? activeFineSeason.title : "this season"} yet.`} />
        ) : (
          empData.map((emp) => {
            const firstNameOfEmp = emp.name.split(" ")[0];
            const total = `Rs. ${(emp.paid + emp.unpaid).toLocaleString()}`;
            return (
              <View
                key={emp.name}
                accessible
                accessibilityLabel={`${firstNameOfEmp}, ${total}: Rs. ${emp.paid.toLocaleString()} paid, Rs. ${emp.unpaid.toLocaleString()} unpaid`}
                style={styles.bar}
              >
                <Text numberOfLines={1} style={[styles.barName, { color: t.text2 }]}>
                  {firstNameOfEmp}
                </Text>
                <View style={[styles.barTrack, { backgroundColor: t.raised }]}>
                  {emp.paid > 0 ? <View style={{ width: `${(emp.paid / maxTotal) * 100}%`, backgroundColor: t.primary }} /> : null}
                  {emp.unpaid > 0 ? <View style={{ width: `${(emp.unpaid / maxTotal) * 100}%`, backgroundColor: t.unpaid }} /> : null}
                </View>
                <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8} style={[styles.barTotal, { color: t.text1 }]}>
                  {total}
                </Text>
              </View>
            );
          })
        )}
        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: t.primary }]} />
            <Text style={[styles.legendText, { color: t.text3 }]}>Paid</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: t.unpaid }]} />
            <Text style={[styles.legendText, { color: t.text3 }]}>Unpaid</Text>
          </View>
        </View>
      </Card>

      <Card style={styles.section}>
        <SectionTitle>Upcoming leaves</SectionTitle>
        {upcomingLeaves.length === 0 ? (
          <EmptyState icon="calendar" text="No leaves planned soon." />
        ) : (
          <View style={styles.rows}>
            {upcomingLeaves.map((l) => (
              <View key={l.id} style={[styles.row, rowLine]}>
                <Avatar name={l.employee_name} size={34} />
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={[styles.rowName, { color: t.text1 }]}>
                    {l.employee_name}
                  </Text>
                  <Text numberOfLines={1} style={[styles.rowMeta, { color: t.text3 }]}>
                    {l.start_date === l.end_date ? l.start_date : `${l.start_date} to ${l.end_date}`}
                  </Text>
                </View>
                {l.type ? <Pill tone="cyan">{l.type}</Pill> : null}
              </View>
            ))}
          </View>
        )}
      </Card>

      <Card style={styles.section}>
        <SectionTitle>Upcoming holidays</SectionTitle>
        {upcomingHolidays.length === 0 ? (
          <EmptyState icon="calendar" text="No upcoming holidays." />
        ) : (
          <View style={styles.rows}>
            {upcomingHolidays.map((h) => {
              // One Date for the tile and the line under the title, so the two always agree.
              const day = new Date(h.date);
              return (
                <View key={h.id} style={[styles.row, styles.holidayRow, rowLine]}>
                  <View style={[styles.dateTile, { borderColor: t.lineStrong, backgroundColor: t.raised }]}>
                    <Text style={[styles.dateTileMonth, { color: t.cyanText }]}>{day.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</Text>
                    <Text style={[styles.dateTileDay, { color: t.text1 }]}>{String(day.getDate()).padStart(2, "0")}</Text>
                  </View>
                  <View style={styles.rowText}>
                    <Text numberOfLines={1} style={[styles.rowName, { color: t.text1 }]}>
                      {h.title}
                    </Text>
                    <Text numberOfLines={1} style={[styles.rowMeta, { color: t.text3 }]}>
                      {day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    </Text>
                  </View>
                  {h.date === tomorrowStr ? <Pill tone="cyan">Tomorrow</Pill> : null}
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <Card style={[styles.section, styles.celebrations]}>
        <SectionTitle style={styles.flushTitle}>Celebrations</SectionTitle>
        {celebrations.length === 0 ? (
          <EmptyState icon="cake" text="No celebrations within 15 days." />
        ) : (
          celebrations.map((c) =>
            c.isToday ? (
              <View
                key={`${c.type}-${c.empName}-${c.date.getTime()}`}
                style={[styles.celebrationToday, { backgroundColor: t.orangeSoft, borderColor: t.orangeEdge }]}
              >
                <View style={[styles.celebrationIcon, { backgroundColor: t.orange }]}>
                  <Icon name={c.type === "birthday" ? "cake" : "award"} size={18} strokeWidth={2} color="#0A0E17" />
                </View>
                <View style={styles.rowText}>
                  <Text numberOfLines={1} style={[styles.rowName, { color: t.text1 }]}>
                    {c.empName}
                  </Text>
                  <Text numberOfLines={1} style={[styles.rowMeta, { color: t.text2 }]}>
                    {c.name} · Today
                  </Text>
                </View>
                <Button
                  variant="orange"
                  small
                  title={sendingWish === c.empName ? "Sending..." : "Send Wish"}
                  onPress={() => !sendingWish && handleWish(c)}
                  disabled={!!sendingWish}
                />
              </View>
            ) : (
              <View key={`${c.type}-${c.empName}-${c.date.getTime()}`} style={styles.celebration}>
                <Text numberOfLines={1} style={[styles.celebrationLine, { color: t.text1 }]}>
                  {c.empName} · {c.name}
                </Text>
                <Text style={[styles.rowMono, { color: t.text3 }]}>{c.displayDate}</Text>
              </View>
            )
          )
        )}
      </Card>
    </Screen>
  );
}

// Sizes, gaps and type from MobileDashboard.dc.html; letter-spacing in em becomes pixels at the
// text's size (.06em at 12px is 0.72).
const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },

  // Today's attendance: a 20-radius glass card, 18 in, 14 between its two rows.
  attendance: { borderRadius: radius.xl, paddingVertical: 18, gap: 14 },
  attendanceHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  attendanceEyebrow: { flexShrink: 1, letterSpacing: 0.72 },
  attendancePill: { marginLeft: "auto", height: 24, paddingHorizontal: 10 },
  attendanceBody: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  attendanceText: { flex: 1, gap: 2 },
  attendanceTime: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33, fontVariant: ["tabular-nums"] },
  // A day without a punch says what it is in the cards' heading size.
  attendanceHeadline: { fontFamily: fonts.display, fontSize: 17, lineHeight: 22 },
  attendanceStatus: { fontFamily: fonts.body, fontSize: 14 },
  attendanceAction: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  attendanceActionText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: "#FFFFFF" },

  // Key figures: two columns 10 apart; each tile 18-radius glass, 14 by 16 in.
  figures: { gap: 10, marginBottom: 14 },
  figureRow: { flexDirection: "row", gap: 10 },
  figureSpacer: { flex: 1 },
  figure: { flex: 1, marginBottom: 0, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
  figureHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  figureLabel: { flexShrink: 1, letterSpacing: 0.48 },
  figureDot: { marginLeft: "auto", width: 7, height: 7, borderRadius: 2 },
  figureValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 24, fontVariant: ["tabular-nums"] },
  figureSub: { fontFamily: fonts.body, fontSize: 12 },

  // The list sections: 20-radius glass; rows 52 high on a hairline, 6 apart.
  section: { borderRadius: radius.xl },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  flushTitle: { flex: 1, marginBottom: 0 },
  rows: { gap: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderTopWidth: 1 },
  rowText: { flex: 1, minWidth: 0 },
  rowName: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  rowMeta: { fontFamily: fonts.body, fontSize: 13 },
  rowMono: { fontFamily: fonts.mono, fontSize: 12 },

  // Fines by employee: 14 between the title, the seasons, each bar and the legend.
  fines: { gap: 14 },
  // The chips' own bottom margin is taken back, so the gap below them is the section's 14.
  chipRow: { flexGrow: 0, marginBottom: -8 },
  bar: { flexDirection: "row", alignItems: "center", gap: 10 },
  barName: { width: 64, fontFamily: fonts.bodyMedium, fontSize: 13 },
  barTrack: { flex: 1, flexDirection: "row", gap: 2, height: 10, borderRadius: 4, overflow: "hidden" },
  barTotal: { width: 66, fontFamily: fonts.mono, fontSize: 12, textAlign: "right" },
  legend: { flexDirection: "row", gap: 14 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  swatch: { width: 9, height: 9, borderRadius: 3 },
  legendText: { fontFamily: fonts.body, fontSize: 12 },

  // Upcoming holidays: a 44-wide date tile, rows 56 high.
  holidayRow: { minHeight: 56 },
  dateTile: { width: 44, borderWidth: 1, borderRadius: radius.sm, alignItems: "center" },
  dateTileMonth: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.66, paddingTop: 3 },
  dateTileDay: { fontFamily: fonts.display, fontSize: 17, paddingBottom: 3 },

  // Celebrations: today's in an orange-soft panel with Send Wish; the rest one line with the date.
  celebrations: { gap: 10 },
  celebrationToday: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 14, borderWidth: 1 },
  celebrationIcon: { width: 38, height: 38, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  celebration: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 4, paddingHorizontal: 12 },
  celebrationLine: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14 },
});
