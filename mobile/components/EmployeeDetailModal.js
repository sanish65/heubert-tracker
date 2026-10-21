import { useMemo, useState } from "react";
import { View, Text, Pressable, Modal, Alert, Linking, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Screen, ScreenHeader, Card, SectionTitle, Eyebrow, EmptyState, Button, IconButton, Pill } from "./ui";
import Avatar from "./Avatar";
import Icon from "./Icon";
import EditEmployeeModal from "./EditEmployeeModal";
import { employeeStatus, LATE_FINE_STATUSES, STANDUP_FINE_STATUSES, LEAVE_TYPE_OPTIONS, SEGMENT_OPTIONS } from "../lib/options";
import { computeLeaveBalances, leaveDayCount, parseHalfDaySegment, toDateStr } from "../lib/utils";
import { dayOf, toDate } from "../lib/dates";
import { recordsPage, RECENT_RECORDS } from "../lib/paging";

// An employee's screen, in the order of the canvas's MobileEmployee.dc.html: Back and the email
// action, the profile (photo or initials, name, email, status, ID, joined and tenure), the details,
// the leave balances in the latest leave season, the late fines (paid against unpaid), the recent
// records, and for admins Edit and Delete. It still opens from a Team row as before, now filling
// the screen. Edit's sheet is drawn inside this modal: iOS shows a modal over the one it sits in,
// not over a sibling.

// The leave meters' fills in turn, as the canvas's: primary, cyan, violet. An unpaid type's is the
// unpaid amber, as on Leaves.
const JAR_COLORS = ["primary", "cyan", "pfViolet"];

// The pill colours by tone (ui.js's Pill), for the status pill with its dot.
const PILL_KEYS = {
  green: ["pbGreen", "pfGreen"],
  red: ["pbRed", "pfRed"],
  cyan: ["pbCyan", "pfCyan"],
  gray: ["pbGray", "pfGray"],
};

// Only a plain address opens the mail app: the row is text an admin typed, and a mailto link
// carries anything after a "?" or "," as more recipients, a subject or a body.
const EMAIL_ADDRESS = /^[A-Za-z0-9._+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

const TYPE_LABELS = Object.fromEntries(LEAVE_TYPE_OPTIONS.map((o) => [o.value, o.label]));
const SEGMENT_LABELS = Object.fromEntries(SEGMENT_OPTIONS.map((o) => [o.value, o.label]));

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const firstWord = (text) => String(text || "").trim().split(/\s+/)[0];

// Built once: the records list formats a date per row.
const fullDate = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });
const monthDay = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });

// "Mar 12, 2023", or "N/A", as the employee details have always written dates.
function formatDate(value) {
  const day = dayOf(value);
  return day ? fullDate.format(toDate(day)) : "N/A";
}

// "Oct 15", with the year when it is not this one.
function shortDate(day, thisYear) {
  const date = toDate(day);
  return date.getFullYear() === thisYear ? monthDay.format(date) : fullDate.format(date);
}

// "Oct 26", "Oct 26 – 30", "Oct 30 – Nov 2".
function dateRange(start, end, thisYear) {
  if (!end || end === start) return shortDate(start, thisYear);
  const a = toDate(start);
  const b = toDate(end);
  if (a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()) {
    return `${monthDay.format(a)} – ${b.getDate()}${b.getFullYear() === thisYear ? "" : `, ${b.getFullYear()}`}`;
  }
  return `${shortDate(start, thisYear)} – ${shortDate(end, thisYear)}`;
}

// Time with the company, as the canvas's "3 yrs 7 mos": whole months from the day they joined to
// the day they left, or to today while they are here. "N/A" without a joined date, or for someone
// who resigned with no left date (the end is unknown).
function tenure(employee, today) {
  const joined = dayOf(employee.joined_date);
  if (!joined) return "N/A";
  if (joined > today) return "Not started";
  const left = dayOf(employee.left_date);
  if (!left && employeeStatus(employee).value === "resigned") return "N/A";
  const end = left && left < today ? left : today;
  if (end < joined) return "N/A";
  const [y1, m1, d1] = joined.split("-").map(Number);
  const [y2, m2, d2] = end.split("-").map(Number);
  const months = (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0);
  if (months < 1) return "Under a month";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return [years ? plural(years, "yr") : "", rest ? plural(rest, "mo") : ""].filter(Boolean).join(" ");
}

// The person's leaves, late fines and missing standups, newest first (so an upcoming leave leads,
// as on the canvas). One pass over each list.
function recordsOf(name, leaves, fines, standupFines) {
  const list = [];
  for (const item of leaves) if (item.employee_name === name) list.push({ kind: "leave", key: `leave-${item.id}`, day: dayOf(item.start_date), item });
  for (const item of fines) if (item.employee_name === name) list.push({ kind: "late", key: `late-${item.id}`, day: dayOf(item.date), item });
  for (const item of standupFines) if (item.employee_name === name) list.push({ kind: "standup", key: `standup-${item.id}`, day: dayOf(item.date), item });
  // "YYYY-MM-DD" sorts as text.
  return list.sort((a, b) => (a.day < b.day ? 1 : a.day > b.day ? -1 : 0));
}

// A record as its row shows it. A leave: its type and kind of day, when and how many working days,
// and whether it is ahead, under way or past. A fine: the date, the amount (standups have none) and
// its status in the words of its own sheet.
function describe({ kind, day, item }, { leaveTypeById, holidaySet, today, thisYear }) {
  if (kind === "leave") {
    const end = dayOf(item.end_date) || day;
    const days = leaveDayCount(item, holidaySet);
    const segment = parseHalfDaySegment(item);
    const dayKind = segment ? SEGMENT_LABELS[segment] : TYPE_LABELS[item.type];
    const pill = day > today ? { tone: "cyan", label: "Upcoming" } : end < today ? { tone: "gray", label: "Past" } : { tone: "cyan", label: "Today" };
    return {
      icon: "calendar",
      tileFill: "pbCyan",
      tileInk: "pfCyan",
      title: [leaveTypeById.get(item.leave_type_id)?.name || "Uncategorized", dayKind].filter(Boolean).join(" · "),
      meta: [day ? dateRange(day, end, thisYear) : "", plural(days, "day")].filter(Boolean).join(" · "),
      amount: `${days} d`,
      pill,
    };
  }
  const late = kind === "late";
  const statuses = late ? LATE_FINE_STATUSES : STANDUP_FINE_STATUSES;
  const status = statuses.find((s) => s.value === (item.status === "paid" ? "paid" : "unpaid"));
  return {
    icon: late ? "clock" : "message-square",
    tileFill: "pbBlue",
    tileInk: "pfBlue",
    title: late ? "Late fine" : "Missing standup",
    meta: day ? shortDate(day, thisYear) : "",
    amount: late && item.amount != null ? rs(item.amount) : null,
    pill: { tone: status.tone, label: status.label },
  };
}

// The canvas's status pill on the profile: 24 high, its dot in the text's colour.
function StatusPill({ status }) {
  const t = useThemeColors();
  const [fill, ink] = PILL_KEYS[status.tone] || PILL_KEYS.gray;
  return (
    <View style={[styles.statusPill, { backgroundColor: t[fill] }]}>
      <View style={[styles.statusDot, { backgroundColor: t[ink] }]} />
      <Text numberOfLines={1} style={[styles.statusText, { color: t[ink] }]}>
        {status.label}
      </Text>
    </View>
  );
}

function Profile({ employee, email, isMe, today }) {
  const t = useThemeColors();
  // The canvas rings the photo in the sheet's solid fill, then a hairline.
  const ring = [
    { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 4, color: t.surfaceSolid },
    { offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 5, color: t.lineStrong },
  ];
  return (
    <Card style={[styles.panel, styles.profile]}>
      <View style={[styles.avatarRing, { boxShadow: ring }]}>
        <Avatar name={employee.name} size={88} isMe={isMe} />
      </View>
      <View style={styles.identity}>
        <Text accessibilityRole="header" style={[styles.name, { color: t.text1 }]}>
          {employee.name}
        </Text>
        {email ? (
          <Text numberOfLines={1} style={[styles.email, { color: t.text2 }]}>
            {email}
          </Text>
        ) : null}
      </View>
      <View style={styles.pills}>
        <StatusPill status={employeeStatus(employee)} />
        <Pill tone="gray" style={styles.idPill}>
          <Text style={styles.idText}>{employee.emp_no || `EMP-${employee.id}`}</Text>
        </Pill>
      </View>
      <View style={[styles.stats, { borderTopColor: t.line }]}>
        <View accessible style={[styles.stat, styles.statDivided, { borderRightColor: t.line }]}>
          <Eyebrow style={[styles.statLabel, { color: t.text3 }]}>Joined</Eyebrow>
          <Text style={[styles.statValue, { color: t.text1 }]}>{formatDate(employee.joined_date)}</Text>
        </View>
        <View accessible style={styles.stat}>
          <Eyebrow style={[styles.statLabel, { color: t.text3 }]}>Tenure</Eyebrow>
          <Text style={[styles.statValue, { color: t.text1 }]}>{tenure(employee, today)}</Text>
        </View>
      </View>
    </Card>
  );
}

function DetailItem({ label, value, mono }) {
  const t = useThemeColors();
  return (
    <View accessible accessibilityLabel={`${label}, ${value}`} style={styles.cell}>
      <Eyebrow style={[styles.detailLabel, { color: t.text3 }]}>{label}</Eyebrow>
      <Text style={[styles.detailValue, { color: t.text1, fontFamily: mono ? fonts.monoMedium : fonts.bodySemibold }]}>{value}</Text>
    </View>
  );
}

// The canvas's two-column details; IDs, dates, the phone and the email in the mono font. The work
// email is the one under the name, and the joined date is in the profile.
function Details({ employee }) {
  const items = [
    { label: "Employee ID", value: employee.emp_no || `EMP-${employee.id}`, mono: true },
    { label: "Date of Birth", value: formatDate(employee.dob), mono: true },
    { label: "Phone", value: employee.phone || "N/A", mono: true },
    { label: "Personal Email", value: employee.personal_email || "N/A", mono: true },
    { label: "Address", value: employee.address || "N/A" },
    { label: "Left Date", value: formatDate(employee.left_date), mono: true },
  ];
  const rows = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return (
    <Card style={[styles.panel, styles.details]}>
      <SectionTitle style={styles.flushTitle}>Details</SectionTitle>
      <View style={styles.grid}>
        {rows.map((row) => (
          <View key={row[0].label} style={styles.gridRow}>
            {row.map((item) => (
              <DetailItem key={item.label} {...item} />
            ))}
          </View>
        ))}
      </View>
    </Card>
  );
}

// One leave type: its name, what is left of the quota, and the meter filled to what is left.
function LeaveMeter({ balance: b, color }) {
  const t = useThemeColors();
  const width = b.annual_days > 0 ? Math.max(0, Math.min(100, (b.remaining / b.annual_days) * 100)) : 0;
  return (
    <View style={styles.jar}>
      <View style={styles.jarHead}>
        <View style={styles.jarName}>
          <Text numberOfLines={1} style={[styles.jarNameText, { color: t.text1 }]}>
            {b.name}
          </Text>
          {b.is_unpaid ? <Pill tone="amber">Unpaid</Pill> : null}
        </View>
        <Text style={[styles.jarLeft, { color: t.text1 }]}>{b.remaining}</Text>
        <Text style={[styles.jarOf, { color: t.text3 }]}>/ {b.annual_days} left</Text>
      </View>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={`${b.name} leave`}
        accessibilityValue={{ text: `${b.remaining} of ${b.annual_days} days left` }}
        style={[styles.meter, { backgroundColor: t.raised, borderColor: t.line }]}
      >
        <View style={[styles.meterFill, { width: `${width}%`, backgroundColor: color }]} />
      </View>
    </View>
  );
}

// The latest leave season's balances, as before. The canvas's last row is an unpaid type with no
// limit; here an unpaid type has a quota like the rest, so it is a meter too, marked Unpaid and
// listed after the paid ones.
function LeaveBalances({ balances, season }) {
  const t = useThemeColors();
  const paid = balances.filter((b) => !b.is_unpaid);
  const unpaid = balances.filter((b) => b.is_unpaid);
  return (
    <Card style={[styles.panel, styles.balances]}>
      <View style={styles.panelHead}>
        <SectionTitle style={styles.panelTitle}>Leave balances</SectionTitle>
        {season ? <Text style={[styles.headMono, { color: t.text3 }]}>{season}</Text> : null}
      </View>
      {balances.length === 0 ? (
        <EmptyState icon="calendar" text="No active leave types configured yet." />
      ) : (
        <>
          {paid.map((b, i) => (
            <LeaveMeter key={b.id} balance={b} color={t[JAR_COLORS[i % JAR_COLORS.length]]} />
          ))}
          {unpaid.map((b) => (
            <LeaveMeter key={b.id} balance={b} color={t.unpaid} />
          ))}
        </>
      )}
    </Card>
  );
}

function FineTile({ label, value, valueColor, unpaid = false }) {
  const t = useThemeColors();
  const ink = unpaid ? t.pfAmber : null;
  return (
    <View style={[styles.tile, unpaid ? { backgroundColor: t.pbAmber, borderColor: t.amberEdge } : { backgroundColor: t.raised, borderColor: t.line }]}>
      <Text style={[styles.tileLabel, { color: ink || t.text3 }]}>{label}</Text>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={[styles.tileValue, { color: ink || valueColor || t.text1 }]}>
        {value}
      </Text>
    </View>
  );
}

// Their late fines of all time (getEmployeeStats, as the Team rows showed): the three tiles, then
// the paid share against the unpaid one.
function Fines({ stats }) {
  const t = useThemeColors();
  const share = (amount) => (stats.total > 0 ? `${(amount / stats.total) * 100}%` : "0%");
  return (
    <Card style={[styles.panel, styles.fines]}>
      <View style={styles.panelHead}>
        <SectionTitle style={styles.panelTitle}>Fines</SectionTitle>
        <Text style={[styles.headMono, { color: t.text3 }]}>{`${plural(stats.records, "record")} · all time`}</Text>
      </View>
      <View style={styles.tiles}>
        <FineTile label="Total" value={rs(stats.total)} />
        <FineTile label="Paid" value={rs(stats.paid)} valueColor={t.primaryText} />
        <FineTile label="Unpaid" value={rs(stats.unpaid)} unpaid />
      </View>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${rs(stats.paid)} paid, ${rs(stats.unpaid)} unpaid`}
        style={[styles.split, { backgroundColor: t.raised }]}
      >
        {stats.paid > 0 ? <View style={{ width: share(stats.paid), backgroundColor: t.primary }} /> : null}
        {stats.unpaid > 0 ? <View style={{ width: share(stats.unpaid), backgroundColor: t.unpaid }} /> : null}
      </View>
    </Card>
  );
}

function RecordRow({ icon, tileFill, tileInk, title, meta, amount, pill }) {
  const t = useThemeColors();
  return (
    <View style={[styles.record, { borderTopColor: t.line }]}>
      <View style={[styles.recordIcon, { backgroundColor: t[tileFill] }]}>
        <Icon name={icon} size={18} strokeWidth={1.9} color={t[tileInk]} />
      </View>
      <View style={styles.recordText}>
        <Text numberOfLines={1} style={[styles.recordTitle, { color: t.text1 }]}>
          {title}
        </Text>
        {meta ? (
          <Text numberOfLines={1} style={[styles.recordMeta, { color: t.text3 }]}>
            {meta}
          </Text>
        ) : null}
      </View>
      <View style={styles.recordSide}>
        {amount ? <Text style={[styles.recordAmount, { color: t.text1 }]}>{amount}</Text> : null}
        <Pill tone={pill.tone}>{pill.label}</Pill>
      </View>
    </View>
  );
}

// A bounded page of the records (lib/paging.js): the recent few, a page more per tap, then back.
function RecentRecords({ records, context, shown, onShow }) {
  const t = useThemeColors();
  const page = recordsPage(records.length, shown);
  const listed = records.slice(0, page.visible);
  return (
    <Card style={[styles.panel, styles.recent]}>
      <SectionTitle style={styles.recentTitle}>Recent records</SectionTitle>
      {records.length === 0 ? (
        <EmptyState icon="clipboard" text="No leaves or fines recorded yet." />
      ) : (
        listed.map((record) => <RecordRow key={record.key} {...describe(record, context)} />)
      )}
      {page.next !== null ? (
        <Pressable
          onPress={() => onShow(page.next)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.more, { borderTopColor: t.line }, pressed && styles.pressed]}
        >
          <Text style={[styles.moreText, { color: t.primaryText }]}>
            {page.more > 0 ? `View ${page.more} more of ${records.length}` : "Show recent only"}
          </Text>
          {page.more > 0 ? <Icon name="chevron-right" size={16} strokeWidth={2} color={t.primaryText} /> : null}
        </Pressable>
      ) : null}
    </Card>
  );
}

// Admins only, as before: Edit and Delete side by side. The label and the note sit on the page, so
// they take text2 where the canvas has text3 (under 4.5:1 over the light aurora). The canvas's note
// says fines and leave history stay; here they do not (the database removes a deleted employee's
// fines, leaves, standup records and attendance with them), so the note says that.
function AdminActions({ name, onEdit, onDelete }) {
  const t = useThemeColors();
  return (
    <View style={styles.admin}>
      <Eyebrow style={[styles.adminLabel, { color: t.text2 }]}>Admin</Eyebrow>
      <View style={styles.adminRow}>
        <Button title="Edit" icon="edit" variant="secondary" onPress={onEdit} style={[styles.adminButton, { borderTopColor: t.glassHi }]} />
        <Button title="Delete" icon="trash" variant="danger" onPress={onDelete} style={styles.adminButton} />
      </View>
      <Text style={[styles.adminNote, { color: t.text2 }]}>
        {`Deleting removes ${firstWord(name) || name} from the directory, with their fines, leaves, standup records and attendance.`}
      </Text>
    </View>
  );
}

function EmployeeScreen({ employee, onClose }) {
  const t = useThemeColors();
  const insets = useSafeAreaInsets();
  const { leaves, leaveTypes, leaveSeasons, publicHolidays, fines, standupFines, getEmployeeStats, isAdmin, removeEmployee, currentEmployee } = useApp();
  // The record the edit sheet was opened on, held while it is open.
  const [editing, setEditing] = useState(null);
  // How many records the list shows (lib/paging.js).
  const [shownRecords, setShownRecords] = useState(RECENT_RECORDS);

  const holidaySet = useMemo(() => new Set((publicHolidays || []).map((h) => h.date?.split("T")[0])), [publicHolidays]);

  const latestLeaveSeason = useMemo(() => {
    if (!leaveSeasons || leaveSeasons.length === 0) return null;
    return [...leaveSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];
  }, [leaveSeasons]);

  const balances = useMemo(
    () => computeLeaveBalances(employee.name, leaves, leaveTypes, latestLeaveSeason?.id ?? null, holidaySet),
    [employee.name, leaves, leaveTypes, latestLeaveSeason, holidaySet]
  );

  const leaveTypeById = useMemo(() => new Map((leaveTypes || []).map((lt) => [lt.id, lt])), [leaveTypes]);

  const records = useMemo(() => recordsOf(employee.name, leaves, fines, standupFines), [employee.name, leaves, fines, standupFines]);

  const now = new Date();
  const today = toDateStr(now);
  const context = { leaveTypeById, holidaySet, today, thisYear: now.getFullYear() };

  const email = employee.work_email || employee.personal_email || "";
  const sendEmail = () => {
    Linking.openURL(`mailto:${email}`).catch(() => Alert.alert("Couldn't open email", email));
  };

  const confirmDelete = () => {
    Alert.alert("Delete employee?", `Are you sure you want to delete ${employee.name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          const { error } = (await removeEmployee(employee.id)) || {};
          if (error) Alert.alert("Error", error.message || "Check connection");
          else onClose();
        },
      },
    ]);
  };

  return (
    <>
      <Screen style={{ paddingBottom: 32 + insets.bottom }}>
        <ScreenHeader
          title="Employee"
          onBack={onClose}
          right={
            EMAIL_ADDRESS.test(email) ? (
              <IconButton icon="mail" size={44} iconSize={20} onPress={sendEmail} accessibilityLabel={`Email ${employee.name}`} style={styles.headerButton} />
            ) : null
          }
        />
        <Profile employee={employee} email={email} isMe={currentEmployee?.id === employee.id} today={today} />
        <Details employee={employee} />
        <LeaveBalances balances={balances} season={latestLeaveSeason?.title} />
        <Fines stats={getEmployeeStats(employee.name)} />
        <RecentRecords records={records} context={context} shown={shownRecords} onShow={setShownRecords} />
        {isAdmin ? <AdminActions name={employee.name} onEdit={() => setEditing(employee)} onDelete={confirmDelete} /> : null}
      </Screen>
      <EditEmployeeModal isOpen={!!editing} onClose={() => setEditing(null)} employee={editing} />
    </>
  );
}

// Full screen, sliding up as the sheet did. Each person's screen starts fresh: it is keyed by them.
export default function EmployeeDetailModal({ isOpen, onClose, employee }) {
  if (!employee) return null;
  return (
    <Modal visible={isOpen} animationType="slide" onRequestClose={onClose}>
      <EmployeeScreen key={employee.id} employee={employee} onClose={onClose} />
    </Modal>
  );
}

// Sizes, gaps and type from MobileEmployee.dc.html; letter-spacing in em becomes pixels at the
// text's size (.06em at 12px is 0.72).
const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  headerButton: { borderRadius: 14 },

  // The cards: 20 round, 16 by 18 in, 14 apart.
  panel: { borderRadius: radius.xl },
  panelHead: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  panelTitle: { flex: 1, marginBottom: 0 },
  flushTitle: { marginBottom: 0 },
  headMono: { fontFamily: fonts.mono, fontSize: 12 },

  // The profile: 22 in at the top, everything centred 12 apart; an 88 photo in its ring.
  profile: { paddingTop: 22, alignItems: "center", gap: 12 },
  avatarRing: { width: 88, height: 88, borderRadius: radius.pill },
  identity: { alignSelf: "stretch", alignItems: "center", gap: 4 },
  name: { fontFamily: fonts.display, fontSize: 24, letterSpacing: -0.24, textAlign: "center" },
  email: { fontFamily: fonts.mono, fontSize: 13, textAlign: "center" },
  pills: { flexDirection: "row", gap: 6 },
  statusPill: { flexDirection: "row", alignItems: "center", gap: 6, height: 24, paddingHorizontal: 10, borderRadius: radius.pill },
  statusDot: { width: 6, height: 6, borderRadius: radius.pill },
  statusText: { fontFamily: fonts.bodySemibold, fontSize: 12 },
  idPill: { height: 24, paddingHorizontal: 10 },
  idText: { fontFamily: fonts.mono },
  stats: { alignSelf: "stretch", flexDirection: "row", marginTop: 4, borderTopWidth: 1 },
  stat: { flex: 1, alignItems: "center", gap: 2, paddingTop: 12, paddingBottom: 2, paddingHorizontal: 6 },
  statDivided: { borderRightWidth: 1 },
  statLabel: { letterSpacing: 0.72 },
  statValue: { fontFamily: fonts.display, fontSize: 17, textAlign: "center" },

  // Details: two columns, 14 between rows and 12 between columns.
  details: { gap: 12 },
  grid: { gap: 14 },
  gridRow: { flexDirection: "row", gap: 12 },
  cell: { flex: 1, minWidth: 0, gap: 2 },
  detailLabel: { letterSpacing: 0.48 },
  detailValue: { fontSize: 14 },

  // Leave balances: each type's name and what is left, over a 10-high meter.
  balances: { gap: 14 },
  jar: { gap: 8 },
  jarHead: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  jarName: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 },
  jarNameText: { flexShrink: 1, fontFamily: fonts.bodySemibold, fontSize: 15 },
  jarLeft: { fontFamily: fonts.display, fontSize: 17, fontVariant: ["tabular-nums"] },
  jarOf: { fontFamily: fonts.mono, fontSize: 12 },
  meter: { height: 10, borderRadius: radius.pill, borderWidth: 1, overflow: "hidden" },
  meterFill: { height: "100%", borderRadius: radius.pill },

  // Fines: three tiles 8 apart, then the paid and unpaid split.
  fines: { gap: 14 },
  tiles: { flexDirection: "row", gap: 8 },
  tile: { flex: 1, minWidth: 0, gap: 4, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, borderWidth: 1 },
  tileLabel: { fontFamily: fonts.mono, fontSize: 12, textTransform: "uppercase" },
  tileValue: { fontFamily: fonts.display, fontSize: 17, fontVariant: ["tabular-nums"] },
  split: { flexDirection: "row", gap: 2, height: 10, borderRadius: 4, overflow: "hidden" },

  // Recent records: rows at least 60 high on a hairline, a 36 icon tile.
  recent: { paddingBottom: 8 },
  recentTitle: { marginBottom: 8 },
  record: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 8, borderTopWidth: 1 },
  recordIcon: { width: 36, height: 36, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  recordText: { flex: 1, minWidth: 0, gap: 1 },
  recordTitle: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  recordMeta: { fontFamily: fonts.mono, fontSize: 12 },
  recordSide: { alignItems: "flex-end", gap: 4 },
  recordAmount: { fontFamily: fonts.mono, fontSize: 13 },
  more: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, borderTopWidth: 1 },
  moreText: { fontFamily: fonts.bodySemibold, fontSize: 14 },

  // Admin: the label, then Edit and Delete side by side (52 high, 14 round), then the note.
  admin: { gap: 8, marginTop: 6 },
  adminLabel: { paddingHorizontal: 4 },
  adminRow: { flexDirection: "row", gap: 10 },
  adminButton: { flex: 1, minHeight: 52, borderRadius: 14 },
  adminNote: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, paddingHorizontal: 4 },
});
