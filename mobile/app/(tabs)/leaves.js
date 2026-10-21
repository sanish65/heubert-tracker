import { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, Alert, StyleSheet } from "react-native";
import { useApp } from "../../context/AppContext";
import { useThemeColors, radius, fonts } from "../../lib/theme";
import { Screen, Card, EmptyState, Button, IconButton, Pill, FormModal } from "../../components/ui";
import TopBar from "../../components/TopBar";
import Avatar from "../../components/Avatar";
import Icon from "../../components/Icon";
import LeaveCalendar from "../../components/LeaveCalendar";
import AddLeaveModal from "../../components/AddLeaveModal";
import EditLeaveModal from "../../components/EditLeaveModal";
import AddPublicHolidayModal from "../../components/AddPublicHolidayModal";
import AddLeaveSeasonModal from "../../components/AddLeaveSeasonModal";
import EditLeaveSeasonModal from "../../components/EditLeaveSeasonModal";
import { computeLeaveBalances, parseHalfDaySegment, stripHalfDaySegmentPrefix } from "../../lib/utils";
import { pad, dayOf, toDate, localToday, daysBetween } from "../../lib/dates";

// Leaves, in the order of the canvas's MobileLeaves.dc.html: the top bar with the employee filter,
// the seasons, the month calendar (with the BS dates, as the web Leaves), your balance, the upcoming
// leaves (all the season's records one tap away), the summary by employee, the public holidays, and
// Record Leave floating over them. Leave pills are cyan (amber for an unpaid type), holidays grey,
// as the web Leaves. Admins also add and edit seasons and add and delete holidays; anyone edits and
// deletes the leaves canManageLeave allows. The data and the actions are the ones this screen had
// before the redesign.

const TYPE_LABELS = { full: "Full Day", half: "Half Day", early: "Early Leave" };
const SEGMENT_LABELS = { first: "First Half", second: "Second Half" };
const PRE_SEASON = "pre-season";
const PRE_SEASON_LABEL = "Pre Fiscal Year Leaves";

// A leave type's meter turns amber from this share of its quota used, red once over (the web
// Leaves' meters, src/app/globals.css "LEAVE JARS").
const WARN_SHARE = 0.8;

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const notThisYear = (date) => date.getFullYear() !== new Date().getFullYear();

// "Oct 26", or "Mon, Oct 26" with the weekday; the year only when it is not this one (the web's).
function shortDate(day, withWeekday = false) {
  const d = toDate(day);
  return d.toLocaleDateString("en-US", {
    ...(withWeekday ? { weekday: "short" } : {}),
    month: "short",
    day: "numeric",
    ...(notThisYear(d) ? { year: "numeric" } : {}),
  });
}

// A leave's line under the name, as the canvas's rows: "Today · Mon, Oct 19", "Thu, Oct 29",
// "Oct 26 – 28 · 3 working days".
function leaveWhen(leave, days, today) {
  const end = leave.end_date || leave.start_date;
  const now = leave.start_date <= today && today <= end ? "Today · " : "";
  if (leave.start_date === end) return now + shortDate(leave.start_date, true);
  const a = toDate(leave.start_date);
  const b = toDate(end);
  const range =
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
      ? `${a.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${b.getDate()}${notThisYear(b) ? `, ${b.getFullYear()}` : ""}`
      : `${shortDate(leave.start_date)} – ${shortDate(end)}`;
  return `${now}${range} · ${plural(days, "working day")}`;
}

// Working days from start to end, weekends and holidays skipped, halved for a half day (as before).
function calculateDays(start, end, type, holidaySet) {
  let diff = 0;
  const current = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (current <= last) {
    const dow = current.getDay();
    const day = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`;
    if (dow !== 0 && dow !== 6 && !holidaySet.has(day)) diff++;
    current.setDate(current.getDate() + 1);
  }
  return type === "half" ? diff * 0.5 : diff;
}

// Used against quota: within it, from WARN_SHARE, or over.
function meterState(used, quota) {
  if (used > quota) return "over";
  if (quota > 0 && used / quota >= WARN_SHARE) return "warn";
  return "ok";
}

// One leave type's balance: the canvas's "My balance" row (the figure left, the meter, the days
// used), or `compact` as the web's summary meters (the summary's open row).
function BalanceMeter({ balance: b, compact = false }) {
  const t = useThemeColors();
  const state = meterState(b.used, b.annual_days);
  const width = b.annual_days > 0 ? Math.min(100, (b.used / b.annual_days) * 100) : b.used > 0 ? 100 : 0;
  const fill = state === "over" ? t.red : state === "warn" ? t.unpaid : t.primary;
  const stateColor = state === "over" ? t.pfRed : state === "warn" ? t.pfAmber : null;
  const left = state === "over" ? `${b.used - b.annual_days} over` : `${b.remaining} left`;
  const track = (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${b.name} leave`}
      accessibilityValue={{ text: `${b.used} of ${b.annual_days} days used, ${left}` }}
      style={[styles.track, compact && styles.trackCompact, { backgroundColor: t.raised, borderColor: t.line }]}
    >
      <View style={[styles.trackFill, { width: `${width}%`, backgroundColor: fill }]} />
    </View>
  );

  if (compact) {
    return (
      <View style={styles.meterCompact}>
        <View style={styles.meterHead}>
          <Text numberOfLines={1} style={[styles.meterNameCompact, { color: t.text2 }]}>
            {b.name}
          </Text>
          <Text style={[styles.meterUsed, { color: t.text1 }]}>
            {b.used} / {b.annual_days}
          </Text>
          <Text style={[styles.meterLeftCompact, { color: stateColor || t.text3 }]}>{left}</Text>
        </View>
        {track}
      </View>
    );
  }

  return (
    <View style={styles.meter}>
      <View style={styles.meterHead}>
        <Text numberOfLines={1} style={[styles.meterName, { color: t.text1 }]}>
          {b.name}
        </Text>
        <Text style={[styles.meterFigure, { color: stateColor || t.text1 }]}>{state === "over" ? b.used - b.annual_days : b.remaining}</Text>
        <Text style={[styles.meterSuffix, { color: t.text3 }]}>{state === "over" ? "over" : "left"}</Text>
      </View>
      {track}
      <Text style={[styles.meterSub, { color: t.text3 }]}>
        {b.used} of {b.annual_days} days used
      </Text>
    </View>
  );
}

// One season in the canvas's season row: a glass pill; the one shown filled primary with a check.
// The shown season carries the pencil that opens its edit sheet for admins (the app had one on every
// season; the canvas draws none), as on Fines.
function SeasonChip({ label, active, onPress, onEdit }) {
  const t = useThemeColors();
  return (
    <View style={[styles.chip, active ? { backgroundColor: t.primary, borderColor: t.primary, boxShadow: t.glowPrimary } : { backgroundColor: t.surface, borderColor: t.lineStrong }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: !!active }}
        style={({ pressed }) => [styles.chipMain, active && styles.chipMainActive, onEdit && styles.chipMainWithEdit, pressed && !active && { backgroundColor: t.raised }]}
      >
        {active ? <Icon name="check" size={16} strokeWidth={2.2} color="#FFFFFF" /> : null}
        <Text numberOfLines={1} style={[styles.chipText, { color: active ? "#FFFFFF" : t.text1, fontFamily: active ? fonts.bodySemibold : fonts.bodyMedium }]}>
          {label}
        </Text>
      </Pressable>
      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Edit season ${label}`} style={styles.chipEdit}>
          <Icon name="edit" size={15} color={active ? "#FFFFFF" : t.text1} />
        </Pressable>
      ) : null}
    </View>
  );
}

// The canvas's dashed "Season" chip that adds one. Its label is text1 where the canvas has primary
// text: the row sits on the page, and primaryText over the light aurora is under 4.5:1. The plus
// keeps the primary text, a graphic that passes 3:1 there.
function AddSeasonChip({ onPress }) {
  const t = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add leave season"
      style={({ pressed }) => [styles.chip, styles.addChip, { borderColor: t.lineStrong, backgroundColor: pressed ? t.raised : "transparent" }]}
    >
      <Icon name="plus" size={16} strokeWidth={2} color={t.primaryText} />
      <Text style={[styles.chipText, { color: t.text1, fontFamily: fonts.bodySemibold }]}>Season</Text>
    </Pressable>
  );
}

// The card head of the canvas: the title, then what the card counts.
function PanelHead({ title, children }) {
  const t = useThemeColors();
  return (
    <View style={styles.panelHead}>
      <Text accessibilityRole="header" style={[styles.panelTitle, { color: t.text1 }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

// One leave, as the canvas's upcoming rows: the person, when (in mono), the leave type pill and the
// kind of day; the reason under the date; edit and delete for those who may change it.
function LeaveRow({ leave, leaveType, days, today, isMe, canEdit, onEdit, onDelete }) {
  const t = useThemeColors();
  const segment = parseHalfDaySegment(leave);
  const reason = stripHalfDaySegmentPrefix(leave.reason);
  const when = leaveWhen(leave, days, today);
  const tone = !leaveType ? "gray" : leaveType.is_unpaid ? "amber" : "cyan";
  const label = `${leave.employee_name} on ${shortDate(leave.start_date)}`;
  return (
    <View style={[styles.row, { borderTopColor: t.line }]}>
      <Avatar name={leave.employee_name} size={36} isMe={isMe} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowName, { color: t.text1 }]}>
          {leave.employee_name}
        </Text>
        <Text style={[styles.rowMono, { color: t.text3 }]}>{when}</Text>
        {reason ? (
          <Text numberOfLines={2} style={[styles.rowReason, { color: t.text3 }]}>
            {reason}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowSide}>
        <Pill tone={tone}>{leaveType?.name || "Uncategorized"}</Pill>
        <Text style={[styles.rowKind, { color: t.text3 }]}>{segment ? SEGMENT_LABELS[segment] : TYPE_LABELS[leave.type]}</Text>
        {canEdit ? (
          <View style={styles.rowActions}>
            <IconButton icon="edit" tone="plain" onPress={() => onEdit(leave)} accessibilityLabel={`Edit leave for ${label}`} />
            <IconButton icon="trash" tone="danger" onPress={() => onDelete(leave)} accessibilityLabel={`Delete leave for ${label}`} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

// One person in the summary, as the canvas: avatar, name and records, the days. Tapping shows their
// leaves (the calendar and the list narrow to them, as the summary chips did) and opens the row on
// their balances; tapping again shows everyone.
function SummaryRow({ emp, isMe, open, balances, onPress }) {
  const t = useThemeColors();
  return (
    <View style={[styles.summaryItem, { borderTopColor: t.line }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${emp.name}, ${plural(emp.totalDays, "day")}, ${plural(emp.records, "record")}. ${open ? "Show everyone" : "Show leaves"}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.summaryRow, pressed && styles.pressed]}
      >
        <Avatar name={emp.name} size={34} isMe={isMe} />
        <View style={styles.rowText}>
          <Text numberOfLines={1} style={[styles.rowName, { color: t.text1 }]}>
            {emp.name}
          </Text>
          <Text style={[styles.summaryRecords, { color: t.text3 }]}>{plural(emp.records, "record")}</Text>
        </View>
        <Text style={[styles.summaryDays, { color: t.text1 }]}>{emp.totalDays}</Text>
        <Text style={[styles.summaryUnit, { color: t.text3 }]}>d</Text>
        <Icon name="chevron-down" size={18} strokeWidth={2} color={t.text3} style={open ? styles.flipped : null} />
      </Pressable>
      {open && balances.length > 0 ? (
        <View style={styles.summaryMeters}>
          {balances.map((b) => (
            <BalanceMeter key={b.id} balance={b} compact />
          ))}
        </View>
      ) : null}
    </View>
  );
}

// One public holiday: the canvas's date tile (cyan-soft when it is today or tomorrow, on the
// quieter hairline once past), the title, the day in mono; a pill for Today or Tomorrow (amber) and
// for a past one (grey), as the web Leaves. The web also dims a past row; that would take its text
// under 4.5:1, so the pill says it instead.
function HolidayRow({ holiday, today, canDelete, onDelete }) {
  const t = useThemeColors();
  const day = dayOf(holiday.date);
  const date = toDate(day);
  const ahead = daysBetween(today, day);
  const pill = ahead === 0 ? { tone: "amber", text: "Today" } : ahead === 1 ? { tone: "amber", text: "Tomorrow" } : ahead < 0 ? { tone: "gray", text: "Past" } : null;
  const near = ahead === 0 || ahead === 1;
  return (
    <View style={[styles.row, styles.holidayRow, { borderTopColor: t.line }]}>
      <View style={[styles.dateTile, { backgroundColor: near ? t.pbCyan : t.raised, borderColor: near ? t.cyanEdge : ahead < 0 ? t.line : t.lineStrong }]}>
        <Text style={[styles.dateTileMonth, { color: t.cyanText }]}>{date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</Text>
        <Text style={[styles.dateTileDay, { color: t.text1 }]}>{pad(date.getDate())}</Text>
      </View>
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowName, { color: t.text1 }]}>
          {holiday.title}
        </Text>
        <Text style={[styles.rowMono, { color: t.text3 }]}>{shortDate(day, true)}</Text>
      </View>
      {pill ? <Pill tone={pill.tone}>{pill.text}</Pill> : null}
      {canDelete ? (
        <IconButton icon="trash" tone="plain" size={44} onPress={() => onDelete(holiday)} accessibilityLabel={`Delete holiday ${holiday.title}`} style={styles.holidayDelete} />
      ) : null}
    </View>
  );
}

// The employee filter behind the header button: everyone, or one person with leaves in the season
// (the summary's chips did this before; the canvas moves it to the header).
function EmployeeFilterSheet({ visible, onClose, value, options, total, onChange }) {
  const t = useThemeColors();
  const { currentEmployee } = useApp();
  const choose = (name) => {
    onChange(name);
    onClose();
  };
  const option = (key, selected, leading, label, meta, name) => (
    <Pressable
      key={key}
      onPress={() => choose(name)}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      style={({ pressed }) => [styles.filterOption, (selected || pressed) && { backgroundColor: selected ? t.primarySoft : t.pbGray }]}
    >
      {leading}
      <Text numberOfLines={1} style={[styles.filterName, { color: t.text1 }]}>
        {label}
      </Text>
      <Text style={[styles.filterMeta, { color: t.text3 }]}>{meta}</Text>
      {selected ? <Icon name="check" size={18} strokeWidth={2} color={t.primaryText} /> : <View style={styles.filterCheck} />}
    </Pressable>
  );
  return (
    <FormModal visible={visible} onClose={onClose} title="Filter by employee">
      <View accessibilityRole="radiogroup" accessibilityLabel="Filter by employee" style={[styles.filterList, { backgroundColor: t.raised, borderColor: t.lineStrong }]}>
        {option(
          "all",
          !value,
          <View style={[styles.filterAll, { backgroundColor: t.pbGray }]}>
            <Icon name="users" size={16} color={t.text2} />
          </View>,
          "All employees",
          plural(total, "record"),
          ""
        )}
        {options.map((emp) =>
          option(emp.name, value === emp.name, <Avatar name={emp.name} size={28} isMe={emp.name === currentEmployee?.name} />, emp.name, `${emp.totalDays}d`, emp.name)
        )}
      </View>
    </FormModal>
  );
}

// The canvas's Record Leave, floating over the page above the tab bar.
function RecordButton({ onPress }) {
  const t = useThemeColors();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.record, { backgroundColor: pressed ? t.primaryHover : t.primary, boxShadow: t.glowPrimaryLg }]}>
      <Icon name="plus" size={20} strokeWidth={2.2} color="#FFFFFF" />
      <Text style={styles.recordText}>Record Leave</Text>
    </Pressable>
  );
}

export default function LeavesScreen() {
  const { leaves: allLeaves, leaveSeasons, employees, deleteLeave, isAdmin, canManageLeave, currentEmployee, publicHolidays, deletePublicHoliday, leaveTypes } = useApp();
  const leaves = useMemo(() => allLeaves.filter(l => l.employee_name !== "Developers"), [allLeaves]);
  const t = useThemeColors();
  const myName = currentEmployee?.name;
  const today = localToday();

  const [filterEmployee, setFilterEmployee] = useState("");
  const [showFilter, setShowFilter] = useState(false);
  const [showAllRecords, setShowAllRecords] = useState(false);
  const [editingLeave, setEditingLeave] = useState(null);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showAddHoliday, setShowAddHoliday] = useState(false);
  // The season you picked; null follows the latest, as on Fines.
  const [pickedSeasonId, setPickedSeasonId] = useState(null);
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [editingSeason, setEditingSeason] = useState(null);

  const leaveTypeById = useMemo(() => {
    const map = new Map();
    (leaveTypes || []).forEach((lt) => map.set(lt.id, lt));
    return map;
  }, [leaveTypes]);

  const holidaySet = useMemo(() => new Set((publicHolidays || []).map((h) => dayOf(h.date))), [publicHolidays]);

  const sortedLeaveSeasons = useMemo(
    () => [...leaveSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [leaveSeasons]
  );
  const latestSeasonId = sortedLeaveSeasons[0]?.id ?? null;

  const hasPreSeasonLeaves = useMemo(() => leaves.some((l) => !l.season_id), [leaves]);

  // The latest season until you pick one; a picked season since deleted (or an emptied Pre Fiscal
  // Year) falls back the same way. With no season at all, the leaves recorded before seasons.
  const pickedIsShown =
    pickedSeasonId === PRE_SEASON ? hasPreSeasonLeaves : sortedLeaveSeasons.some((s) => s.id === pickedSeasonId);
  const activeSeasonId = pickedIsShown ? pickedSeasonId : latestSeasonId ?? (hasPreSeasonLeaves ? PRE_SEASON : null);
  const activeSeason = activeSeasonId === PRE_SEASON ? null : sortedLeaveSeasons.find((s) => s.id === activeSeasonId);
  const effectiveSeasonId = activeSeasonId === PRE_SEASON ? null : activeSeasonId;
  const seasonLabel = activeSeason ? activeSeason.title : activeSeasonId === PRE_SEASON ? PRE_SEASON_LABEL : "";

  const seasonLeaves = useMemo(() => {
    if (activeSeasonId === PRE_SEASON) return leaves.filter((l) => !l.season_id);
    return leaves.filter((l) => l.season_id === activeSeasonId);
  }, [leaves, activeSeasonId]);

  const filtered = useMemo(() => {
    let list = [...seasonLeaves];
    if (filterEmployee) list = list.filter((l) => l.employee_name === filterEmployee);
    return list.sort((a, b) => (b.start_date > a.start_date ? -1 : 1)).reverse();
  }, [seasonLeaves, filterEmployee]);

  // Leaves not over yet, soonest first. With none (a past season), the list shows every record.
  const upcoming = useMemo(() => filtered.filter((l) => (l.end_date || l.start_date) >= today).reverse(), [filtered, today]);
  const showingAll = showAllRecords || upcoming.length === 0;
  const listed = showingAll ? filtered : upcoming;

  // Employee leave summary — scoped to the active season, so a new season starts at zero
  const empSummary = useMemo(() => {
    return employees
      .map((emp) => {
        const empLeaves = seasonLeaves.filter((l) => l.employee_name === emp.name);
        const totalDays = empLeaves.reduce((sum, l) => {
          const days = l.dates ? l.dates.length : calculateDays(l.start_date, l.end_date, l.type, holidaySet);
          return sum + (l.type === "half" ? days * 0.5 : days);
        }, 0);
        return { name: emp.name, records: empLeaves.length, totalDays };
      })
      .filter((e) => e.records > 0)
      .sort((a, b) => b.totalDays - a.totalDays);
  }, [employees, seasonLeaves, holidaySet]);
  const summaryDays = empSummary.reduce((sum, e) => sum + e.totalDays, 0);
  // Someone you filtered by keeps a row (and their balances) after switching to a season they have
  // no leave in, so the filter can still be lifted there.
  const filterHasRow = !filterEmployee || empSummary.some((e) => e.name === filterEmployee);
  const filterOnly = filterHasRow ? null : { name: filterEmployee, records: 0, totalDays: 0 };

  // Your balance for the season shown; the person you filter by, in their summary row.
  const myBalances = useMemo(
    () => (myName && myName !== "Developers" ? computeLeaveBalances(myName, leaves, leaveTypes, effectiveSeasonId, holidaySet) : []),
    [myName, leaves, leaveTypes, effectiveSeasonId, holidaySet]
  );
  const employeeBalances = useMemo(() => {
    if (!filterEmployee) return [];
    return computeLeaveBalances(filterEmployee, leaves, leaveTypes, effectiveSeasonId, holidaySet);
  }, [filterEmployee, leaves, leaveTypes, effectiveSeasonId, holidaySet]);

  // Upcoming first, soonest at the top, then past ones most recent first (as the web Leaves).
  const holidays = useMemo(() => {
    const sorted = [...(publicHolidays || [])].sort((a, b) => dayOf(a.date).localeCompare(dayOf(b.date)));
    const ahead = sorted.filter((h) => dayOf(h.date) >= today);
    const past = sorted.filter((h) => dayOf(h.date) < today).reverse();
    return [...ahead, ...past];
  }, [publicHolidays, today]);

  const toggleEmployee = (name) => setFilterEmployee(filterEmployee === name ? "" : name);

  const confirmDeleteLeave = (leave) => {
    Alert.alert("Delete leave?", `${leave.employee_name} · ${leave.start_date}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteLeave(leave.id) },
    ]);
  };

  const confirmDeleteHoliday = (holiday) => {
    Alert.alert("Delete holiday?", holiday.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deletePublicHoliday(holiday.id) },
    ]);
  };

  const filterButton = (
    <IconButton
      icon="sliders-vertical"
      size={44}
      iconSize={20}
      onPress={() => setShowFilter(true)}
      accessibilityLabel={filterEmployee ? `Filter by employee: ${filterEmployee}` : "Filter by employee"}
      color={filterEmployee ? t.primaryText : undefined}
      style={[styles.headerBtn, filterEmployee ? { backgroundColor: t.primarySoft, borderColor: t.primary, borderTopColor: t.primary } : null]}
    />
  );

  return (
    <View style={styles.page}>
      <Screen style={styles.roomForRecord}>
        <TopBar title="Leaves" eyebrow={seasonLabel ? `Leave tracker · ${seasonLabel}` : "Leave tracker"} right={filterButton} bell={false} />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasons} contentContainerStyle={styles.seasonsRow}>
          {sortedLeaveSeasons.map((s) => (
            <SeasonChip
              key={s.id}
              label={s.title}
              active={activeSeasonId === s.id}
              onPress={() => setPickedSeasonId(s.id)}
              onEdit={isAdmin && activeSeasonId === s.id ? () => setEditingSeason(s) : null}
            />
          ))}
          {hasPreSeasonLeaves ? (
            <SeasonChip label={PRE_SEASON_LABEL} active={activeSeasonId === PRE_SEASON} onPress={() => setPickedSeasonId(PRE_SEASON)} />
          ) : null}
          {sortedLeaveSeasons.length === 0 && !hasPreSeasonLeaves ? (
            <Text style={[styles.noSeasons, { color: t.text2 }]}>No leave seasons yet.</Text>
          ) : null}
          {isAdmin ? <AddSeasonChip onPress={() => setShowAddSeason(true)} /> : null}
        </ScrollView>

        <LeaveCalendar leaves={seasonLeaves} selectedEmployee={filterEmployee || null} publicHolidays={publicHolidays} onClearEmployee={() => setFilterEmployee("")} />

        {myBalances.length > 0 ? (
          <Card style={[styles.panel, styles.balancePanel]}>
            <View style={styles.balanceHead}>
              <Text accessibilityRole="header" style={[styles.panelTitle, { color: t.text1 }]}>
                My balance
              </Text>
              {seasonLabel ? <Text style={[styles.headMono, { color: t.text3 }]}>{seasonLabel}</Text> : null}
            </View>
            {myBalances.map((b) => (
              <BalanceMeter key={b.id} balance={b} />
            ))}
          </Card>
        ) : null}

        <Card style={styles.panel}>
          <PanelHead title={showingAll ? "Leave records" : "Upcoming leaves"}>
            <Pill tone="gray">{listed.length}</Pill>
          </PanelHead>
          {listed.length === 0 ? (
            <EmptyState icon="calendar" text="No leave records yet" />
          ) : (
            listed.map((leave) => {
              const dayCount = leave.type === "half" ? (leave.dates || []).length * 0.5 : (leave.dates || []).length;
              return (
                <LeaveRow
                  key={leave.id}
                  leave={leave}
                  leaveType={leaveTypeById.get(leave.leave_type_id)}
                  days={dayCount || calculateDays(leave.start_date, leave.end_date, leave.type, holidaySet)}
                  today={today}
                  isMe={!!myName && leave.employee_name === myName}
                  canEdit={canManageLeave(leave)}
                  onEdit={setEditingLeave}
                  onDelete={confirmDeleteLeave}
                />
              );
            })
          )}
          {upcoming.length > 0 && filtered.length > upcoming.length ? (
            <Pressable
              onPress={() => setShowAllRecords((v) => !v)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.more, { borderTopColor: t.line }, pressed && styles.pressed]}
            >
              <Text style={[styles.moreText, { color: t.primaryText }]}>
                {showAllRecords ? "Show upcoming only" : `All leave records (${filtered.length})`}
              </Text>
              {showAllRecords ? null : <Icon name="chevron-right" size={16} strokeWidth={2} color={t.primaryText} />}
            </Pressable>
          ) : null}
        </Card>

        <Card style={styles.panel}>
          <View style={styles.summaryHead}>
            <Text accessibilityRole="header" style={[styles.panelTitle, { color: t.text1 }]}>
              Leave summary by employee
            </Text>
            <Text style={[styles.headMono, { color: t.text3 }]}>
              {[seasonLabel, plural(empSummary.length, "person", "people"), plural(summaryDays, "day")].filter(Boolean).join(" · ")}
            </Text>
          </View>
          {empSummary.length === 0 ? <EmptyState icon="users" text="No leave records in this season yet." /> : null}
          {[...empSummary, ...(filterOnly ? [filterOnly] : [])].map((emp) => (
            <SummaryRow
              key={emp.name}
              emp={emp}
              isMe={!!myName && emp.name === myName}
              open={filterEmployee === emp.name}
              balances={employeeBalances}
              onPress={() => toggleEmployee(emp.name)}
            />
          ))}
        </Card>

        <Card style={styles.panel}>
          <PanelHead title="Public holidays">
            {isAdmin ? <Button title="Add" icon="plus" variant="secondary" small onPress={() => setShowAddHoliday(true)} style={[styles.addHoliday, { backgroundColor: t.raised }]} /> : null}
          </PanelHead>
          {holidays.length === 0 ? (
            <EmptyState icon="flag" text="No public holidays recorded." />
          ) : (
            holidays.map((holiday) => (
              <HolidayRow key={holiday.id} holiday={holiday} today={today} canDelete={isAdmin} onDelete={confirmDeleteHoliday} />
            ))
          )}
        </Card>
      </Screen>

      <RecordButton onPress={() => setShowAddLeave(true)} />

      <EmployeeFilterSheet
        visible={showFilter}
        onClose={() => setShowFilter(false)}
        value={filterEmployee}
        options={filterOnly ? [filterOnly, ...empSummary] : empSummary}
        total={seasonLeaves.length}
        onChange={setFilterEmployee}
      />
      <AddLeaveModal isOpen={showAddLeave} onClose={() => setShowAddLeave(false)} />
      <EditLeaveModal isOpen={!!editingLeave} onClose={() => setEditingLeave(null)} leave={editingLeave} />
      <AddPublicHolidayModal isOpen={showAddHoliday} onClose={() => setShowAddHoliday(false)} />
      <AddLeaveSeasonModal isOpen={showAddSeason} onClose={() => setShowAddSeason(false)} />
      <EditLeaveSeasonModal isOpen={!!editingSeason} onClose={() => setEditingSeason(null)} season={editingSeason} />
    </View>
  );
}

// Sizes, gaps and type from MobileLeaves.dc.html; letter-spacing in em becomes pixels at the text's
// size (.06em at 11px is 0.66).
const styles = StyleSheet.create({
  page: { flex: 1 },
  pressed: { opacity: 0.8 },
  flipped: { transform: [{ rotate: "180deg" }] },
  // Room under the last card for Record Leave (56 high, 16 above the tab bar).
  roomForRecord: { paddingBottom: 96 },
  headerBtn: { borderRadius: 14 },

  // The seasons scroll sideways from edge to edge; 8 between chips.
  seasons: { flexGrow: 0, marginHorizontal: -16, marginBottom: 16 },
  seasonsRow: { gap: 8, paddingHorizontal: 16, alignItems: "center" },
  chip: { flexDirection: "row", alignItems: "center", height: 44, borderRadius: radius.pill, borderWidth: 1 },
  chipMain: { flexDirection: "row", alignItems: "center", gap: 6, height: "100%", paddingHorizontal: 16, borderRadius: radius.pill },
  chipMainActive: { paddingLeft: 12 },
  chipMainWithEdit: { paddingRight: 4 },
  chipEdit: { height: "100%", width: 36, paddingRight: 6, alignItems: "center", justifyContent: "center" },
  chipText: { fontSize: 14 },
  addChip: { gap: 6, paddingLeft: 12, paddingRight: 16, borderStyle: "dashed" },
  noSeasons: { fontFamily: fonts.body, fontSize: 13 },

  // The cards: 20 round, 16 by 18 in.
  panel: { borderRadius: radius.xl, gap: 6 },
  balancePanel: { gap: 14 },
  panelHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  panelTitle: { flex: 1, fontFamily: fonts.display, fontSize: 17 },
  headMono: { fontFamily: fonts.mono, fontSize: 12 },
  balanceHead: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  summaryHead: { gap: 2, marginBottom: 4 },

  // My balance: the type, the figure left, an 8-high meter, the days used.
  meter: { gap: 8 },
  meterHead: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  meterName: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 15 },
  meterFigure: { fontFamily: fonts.display, fontSize: 17, fontVariant: ["tabular-nums"] },
  meterSuffix: { fontFamily: fonts.body, fontSize: 13 },
  meterSub: { fontFamily: fonts.mono, fontSize: 12 },
  track: { height: 8, borderRadius: radius.pill, borderWidth: 1, overflow: "hidden" },
  trackCompact: { height: 6 },
  trackFill: { height: "100%", borderRadius: radius.pill },
  // The summary's meters, as the web's: 12px type, a 6-high track.
  meterCompact: { gap: 4 },
  meterNameCompact: { flexShrink: 1, fontFamily: fonts.bodySemibold, fontSize: 12 },
  meterUsed: { fontFamily: fonts.mono, fontSize: 12 },
  meterLeftCompact: { marginLeft: "auto", fontFamily: fonts.body, fontSize: 12 },

  // A list row: at least 60 high, a hairline above.
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, paddingVertical: 10, borderTopWidth: 1 },
  rowText: { flex: 1, minWidth: 0, gap: 1 },
  rowName: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  rowMono: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 17 },
  rowReason: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, marginTop: 2 },
  rowSide: { alignItems: "flex-end", gap: 4, maxWidth: 132 },
  rowKind: { fontFamily: fonts.body, fontSize: 12 },
  rowActions: { flexDirection: "row", gap: 4, marginTop: 2 },
  more: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minHeight: 44, borderTopWidth: 1 },
  moreText: { fontFamily: fonts.bodySemibold, fontSize: 14 },

  // The summary: 56-high rows; the open one shows its meters under the name.
  summaryItem: { borderTopWidth: 1 },
  summaryRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56 },
  summaryRecords: { fontFamily: fonts.body, fontSize: 13 },
  summaryDays: { fontFamily: fonts.display, fontSize: 17, fontVariant: ["tabular-nums"] },
  summaryUnit: { fontFamily: fonts.body, fontSize: 13, marginLeft: -6 },
  summaryMeters: { gap: 9, paddingBottom: 12, paddingLeft: 46 },

  // Public holidays: a 44-wide date tile; delete 44 square.
  holidayRow: { paddingVertical: 8 },
  dateTile: { width: 44, borderWidth: 1, borderRadius: radius.sm, alignItems: "center", paddingVertical: 3 },
  dateTileMonth: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.66 },
  dateTileDay: { fontFamily: fonts.display, fontSize: 17 },
  holidayDelete: { marginRight: -6 },
  addHoliday: { minHeight: 44, borderRadius: radius.md },

  // The employee filter sheet's list, as the employee picker's.
  filterList: { paddingVertical: 4, borderWidth: 1, borderRadius: 14, overflow: "hidden", marginBottom: 12 },
  filterOption: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 48, paddingHorizontal: 12 },
  filterAll: { width: 28, height: 28, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  filterName: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  filterMeta: { fontFamily: fonts.mono, fontSize: 12 },
  filterCheck: { width: 18 },

  // Record Leave: 56 high and round, 16 from the edge and 16 above the tab bar.
  record: {
    position: "absolute",
    right: 16,
    bottom: 16,
    height: 56,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordText: { fontFamily: fonts.bodySemibold, fontSize: 15, color: "#FFFFFF" },
});
