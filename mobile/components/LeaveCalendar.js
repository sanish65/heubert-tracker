import { useState, useMemo } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { adToBs, bsMonthRange, formatBs, BS_MONTH_NAMES } from "../lib/nepaliDate";
import { pad, dayOf } from "../lib/dates";
import { dayCellTone, holidayStripTone } from "../lib/leaveCalendar";
import { Card, IconButton } from "./ui";
import Icon from "./Icon";
import Avatar from "./Avatar";

// The month calendar card of the canvas's MobileLeaves.dc.html: the month with its Bikram Sambat
// months under it (as the web Leaves calendar), previous and next, the month's leave records and
// days, Jump to Today, then the grid: each day with its BS day under it and a dot for each of the
// first two people off (full day blue, half day amber, early leave cyan), weekends dashed, holidays
// grey (orange is for people moments, intent AC3), today ringed cyan; lib/leaveCalendar.js picks
// the colours and its test holds every number to 4.5:1. Tapping a day lists who is off that day (the cells used to carry the
// first name; there is no room beside the BS day). The month's holidays and the legend close it.
// The leaves are the season's, narrowed to `selectedEmployee` when the screen filters by one.

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const TYPE_LABELS = { full: "Full Day", half: "Half Day", early: "Early Leave" };

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The working days of a leave stored without its `dates`: weekends and holidays skipped, as before.
function datesInRange(start, end, holidayDays) {
  const dates = [];
  const current = new Date(start + "T00:00:00");
  const last = new Date(end + "T00:00:00");
  while (current <= last) {
    const dow = current.getDay();
    const day = `${current.getFullYear()}-${pad(current.getMonth() + 1)}-${pad(current.getDate())}`;
    if (dow !== 0 && dow !== 6 && !holidayDays.has(day)) dates.push(day);
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

// The BS day under a date: the number, or "1 Kar" with the month on its first day (the canvas
// shortens the month to three letters to fit the cell).
function bsDay(day) {
  const bs = adToBs(day);
  if (!bs) return { text: "", first: false };
  return bs.day === 1 ? { text: `1 ${BS_MONTH_NAMES[bs.month - 1].slice(0, 3)}`, first: true } : { text: String(bs.day), first: false };
}

// "Mon, Oct 19 · 3 Kartik 2083" for the day you tapped.
function dayLine(day) {
  const date = new Date(day + "T00:00:00");
  const ad = date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  const bs = formatBs(day);
  return bs ? `${ad} · ${bs}` : ad;
}

function LegendItem({ label, swatch }) {
  const t = useThemeColors();
  return (
    <View style={styles.legendItem}>
      <View style={swatch} />
      <Text style={[styles.legendText, { color: t.text3 }]}>{label}</Text>
    </View>
  );
}

export default function LeaveCalendar({ leaves, selectedEmployee, publicHolidays = [], companyEvents = [], onClearEmployee }) {
  const t = useThemeColors();
  const { currentEmployee } = useApp();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  // The day you tapped, "YYYY-MM-DD", or null.
  const [picked, setPicked] = useState(null);

  // Company events (the Events screen) by day, as the web's Leaves calendar shows them.
  const eventsByDay = useMemo(() => {
    const map = new Map();
    (companyEvents || []).forEach((e) => {
      const day = String(e.date || "").slice(0, 10);
      if (!day || !e.title) return;
      if (!map.has(day)) map.set(day, []);
      map.get(day).push({ id: e.id, title: e.title });
    });
    return map;
  }, [companyEvents]);

  // Each holiday day's title (the first, if a day has two).
  const holidayTitles = useMemo(() => {
    const map = new Map();
    publicHolidays.forEach((h) => {
      const day = dayOf(h.date);
      if (day && !map.has(day)) map.set(day, h.title);
    });
    return map;
  }, [publicHolidays]);

  const kindColor = { full: t.primary, half: t.unpaid, early: t.cyan };

  const visibleLeaves = useMemo(
    () => (selectedEmployee ? leaves.filter((l) => l.employee_name === selectedEmployee) : leaves),
    [leaves, selectedEmployee]
  );

  // Each leave with the working days it covers, resolved once.
  const leaveDates = useMemo(
    () => visibleLeaves.map((leave) => ({ leave, dates: leave.dates || datesInRange(leave.start_date, leave.end_date, holidayTitles) })),
    [visibleLeaves, holidayTitles]
  );

  // day → [{ type, name, id }]
  const leaveDateMap = useMemo(() => {
    const map = {};
    leaveDates.forEach(({ leave, dates }) => {
      dates.forEach((d) => {
        if (!map[d]) map[d] = [];
        map[d].push({ type: leave.type, name: leave.employee_name, id: leave.id });
      });
    });
    return map;
  }, [leaveDates]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const monthPrefix = `${viewYear}-${pad(viewMonth + 1)}-`;

  // The month's records and working days off, as before.
  const { filteredLeavesCount, totalDays } = useMemo(() => {
    let count = 0;
    let days = 0;
    leaveDates.forEach(({ leave, dates }) => {
      const inMonth = dates.filter((d) => d.startsWith(monthPrefix)).length;
      if (inMonth > 0) {
        count++;
        days += leave.type === "half" ? inMonth * 0.5 : inMonth;
      }
    });
    return { filteredLeavesCount: count, totalDays: days };
  }, [leaveDates, monthPrefix]);

  const showMonth = (year, month) => {
    setViewYear(year);
    setViewMonth(month);
    setPicked(null);
  };
  const prevMonth = () => (viewMonth === 0 ? showMonth(viewYear - 1, 11) : showMonth(viewYear, viewMonth - 1));
  const nextMonth = () => (viewMonth === 11 ? showMonth(viewYear + 1, 0) : showMonth(viewYear, viewMonth + 1));
  const goToday = () => showMonth(now.getFullYear(), now.getMonth());

  // The weeks on screen: blanks before the 1st and after the last day keep the seven columns.
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = monthPrefix + pad(day);
    cells.push({
      day,
      dateStr,
      col: (firstDay + day - 1) % 7,
      dayLeaves: leaveDateMap[dateStr] || [],
      isToday: day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear(),
      holiday: holidayTitles.get(dateStr),
      events: eventsByDay.get(dateStr) || [],
      bs: bsDay(dateStr),
    });
  }
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

  // The month's holidays, consecutive days with the same title as one entry: "Dashain", Oct 20 – 24.
  const monthHolidays = [];
  cells.forEach((cell) => {
    if (!cell || cell.holiday === undefined) return;
    const last = monthHolidays[monthHolidays.length - 1];
    if (last && last.title === cell.holiday && last.end === cell.day - 1) last.end = cell.day;
    else monthHolidays.push({ title: cell.holiday, start: cell.day, end: cell.day });
  });
  const monthEvents = cells.flatMap((cell) => (cell ? cell.events.map((e) => ({ ...e, day: cell.day })) : []));
  const shortMonth = MONTHS[viewMonth].slice(0, 3);

  const pickedCell = picked ? cells.find((c) => c && c.dateStr === picked) : null;
  const strip = holidayStripTone(t);

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <IconButton icon="chevron-left" tone="raised" size={44} onPress={prevMonth} accessibilityLabel="Previous month" style={styles.navBtn} />
        <View style={styles.titles}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.text1 }]}>
            {MONTHS[viewMonth]} {viewYear}
          </Text>
          <Text style={[styles.titleAlt, { color: t.text3 }]}>{bsMonthRange(monthPrefix + "01", monthPrefix + pad(daysInMonth))}</Text>
        </View>
        <IconButton icon="chevron-right" tone="raised" size={44} onPress={nextMonth} accessibilityLabel="Next month" style={styles.navBtn} />
      </View>

      {selectedEmployee && onClearEmployee ? (
        <Pressable
          onPress={onClearEmployee}
          hitSlop={{ top: 8, bottom: 8 }}
          accessibilityRole="button"
          accessibilityLabel={`Clear filter: ${selectedEmployee}`}
          style={({ pressed }) => [styles.filterChip, { backgroundColor: t.pbBlue }, pressed && styles.pressed]}
        >
          <Text numberOfLines={1} style={[styles.filterChipText, { color: t.pfBlue }]}>
            {selectedEmployee}
          </Text>
          <Icon name="x" size={12} strokeWidth={2.4} color={t.pfBlue} />
        </Pressable>
      ) : null}

      <View style={styles.statsRow}>
        <Text style={[styles.stats, { color: t.text3 }]}>
          {plural(filteredLeavesCount, "leave record")} · {totalDays} total days
        </Text>
        <Pressable onPress={goToday} accessibilityRole="button" style={({ pressed }) => [styles.jump, pressed && styles.pressed]}>
          <Text style={[styles.jumpText, { color: t.primaryText }]}>Jump to Today</Text>
        </Pressable>
      </View>

      <View style={styles.week}>
        {DAYS.map((d) => (
          <Text key={d} style={[styles.weekHead, { color: t.text3 }]} importantForAccessibility="no" accessibilityElementsHidden>
            {d}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {weeks.map((week, w) => (
          <View key={w} style={styles.week}>
            {week.map((cell, i) => {
              if (!cell) return <View key={`blank-${w}-${i}`} style={styles.blank} />;
              const weekend = cell.col === 0 || cell.col === 6;
              const isHoliday = cell.holiday !== undefined;
              const selected = cell.dateStr === picked;
              const tone = dayCellTone(t, { weekend, holiday: isHoliday, today: cell.isToday, selected, bsFirst: cell.bs.first });
              const names = cell.dayLeaves.map((l) => l.name).join(", ");
              const label =
                `${WEEKDAYS[cell.col]}, ${MONTHS[viewMonth]} ${cell.day}` +
                (cell.isToday ? ", today" : "") +
                (isHoliday ? `, ${cell.holiday} holiday` : "") +
                cell.events.map((e) => `, ${e.title} event`).join("") +
                (names ? `, on leave: ${names}` : ", no leaves");
              return (
                <Pressable
                  key={cell.dateStr}
                  onPress={() => setPicked(selected ? null : cell.dateStr)}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityState={{ selected }}
                  style={[
                    styles.cell,
                    {
                      backgroundColor: tone.fill,
                      borderColor: tone.edge,
                      borderWidth: tone.edgeWidth,
                      borderStyle: tone.dashed ? "dashed" : "solid",
                    },
                    cell.isToday && { boxShadow: t.glowCyanSoft },
                  ]}
                >
                  <Text style={[styles.cellNum, { color: tone.num, fontFamily: cell.isToday ? fonts.display : fonts.displayMedium }]}>{cell.day}</Text>
                  <Text style={[styles.cellBs, { color: tone.bs }]}>{cell.bs.text}</Text>
                  <View style={styles.dots}>
                    {cell.events.length ? <View style={[styles.dot, { backgroundColor: t.pfViolet }]} /> : null}
                    {cell.dayLeaves.slice(0, 2).map((l, k) => (
                      <View key={k} style={[styles.dot, { backgroundColor: kindColor[l.type] || t.primary }]} />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>

      {pickedCell ? (
        <View style={[styles.detail, { backgroundColor: t.raised, borderColor: t.line }]}>
          <Text style={[styles.detailDate, { color: t.text2 }]}>{dayLine(pickedCell.dateStr)}</Text>
          {pickedCell.holiday !== undefined ? (
            <View style={styles.detailRow}>
              <Icon name="flag" size={16} strokeWidth={1.9} color={strip.flag} />
              <Text numberOfLines={1} style={[styles.detailName, { color: t.text1 }]}>
                {pickedCell.holiday}
              </Text>
            </View>
          ) : null}
          {pickedCell.events.map((e) => (
            <View key={`e-${e.id}`} style={styles.detailRow}>
              <Icon name="sparkles" size={16} strokeWidth={1.9} color={t.pfViolet} />
              <Text numberOfLines={1} style={[styles.detailName, { color: t.text1 }]}>
                {e.title}
              </Text>
              <Text style={[styles.detailKind, { color: t.text3 }]}>Event</Text>
            </View>
          ))}
          {pickedCell.dayLeaves.map((l) => (
            <View key={l.id} style={styles.detailRow}>
              <Avatar name={l.name} size={24} isMe={!!currentEmployee && l.name === currentEmployee.name} />
              <Text numberOfLines={1} style={[styles.detailName, { color: t.text1 }]}>
                {l.name}
              </Text>
              <Text style={[styles.detailKind, { color: t.text3 }]}>{TYPE_LABELS[l.type] || ""}</Text>
            </View>
          ))}
          {pickedCell.holiday === undefined && pickedCell.events.length === 0 && pickedCell.dayLeaves.length === 0 ? (
            <Text style={[styles.detailKind, { color: t.text3 }]}>No leaves</Text>
          ) : null}
        </View>
      ) : null}

      {monthHolidays.map((h) => (
        <View key={`${h.title}-${h.start}`} style={[styles.strip, { backgroundColor: strip.fill, borderColor: strip.edge }]}>
          <Icon name="flag" size={18} strokeWidth={1.9} color={strip.flag} />
          <Text numberOfLines={1} style={[styles.stripTitle, { color: strip.title }]}>
            {h.title}
          </Text>
          <Text style={[styles.stripDate, { color: strip.date }]}>
            {shortMonth} {h.start}
            {h.end > h.start ? ` – ${h.end}` : ""}
          </Text>
        </View>
      ))}

      {monthEvents.map((e) => (
        <View key={`e-${e.id}-${e.day}`} style={[styles.strip, { backgroundColor: t.pbViolet, borderColor: t.pfViolet }]}>
          <Icon name="sparkles" size={18} strokeWidth={1.9} color={t.pfViolet} />
          <Text numberOfLines={1} style={[styles.stripTitle, { color: t.text1 }]}>
            {e.title}
          </Text>
          <Text style={[styles.stripDate, { color: t.text2 }]}>
            {shortMonth} {e.day}
          </Text>
        </View>
      ))}

      <View style={styles.legend}>
        <LegendItem label="Full Day" swatch={[styles.swatchDot, { backgroundColor: t.primary }]} />
        <LegendItem label="Half Day" swatch={[styles.swatchDot, { backgroundColor: t.unpaid }]} />
        <LegendItem label="Early Leave" swatch={[styles.swatchDot, { backgroundColor: t.cyan }]} />
        <LegendItem label="Holiday" swatch={[styles.swatchSquare, styles.swatchHoliday, { backgroundColor: strip.fill, borderColor: strip.flag }]} />
        <LegendItem label="Event" swatch={[styles.swatchDot, { backgroundColor: t.pfViolet }]} />
        <LegendItem label="Today" swatch={[styles.swatchSquare, styles.swatchToday, { borderColor: t.cyan }]} />
      </View>
    </Card>
  );
}

// Sizes, gaps and type from MobileLeaves.dc.html: a 20-radius glass card 14 in, 10 between its
// parts; 54-high day cells 2 apart.
const styles = StyleSheet.create({
  pressed: { opacity: 0.8 },
  card: { paddingVertical: 14, paddingHorizontal: 14, borderRadius: radius.xl, gap: 10 },

  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  navBtn: { borderRadius: radius.md },
  titles: { flex: 1, alignItems: "center", gap: 1 },
  title: { fontFamily: fonts.display, fontSize: 18 },
  titleAlt: { fontFamily: fonts.mono, fontSize: 12 },

  filterChip: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", maxWidth: "100%", height: 28, paddingHorizontal: 10, borderRadius: radius.pill },
  filterChipText: { flexShrink: 1, fontFamily: fonts.bodySemibold, fontSize: 12 },

  statsRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 2 },
  stats: { flex: 1, fontFamily: fonts.mono, fontSize: 12 },
  jump: { minHeight: 44, paddingHorizontal: 4, justifyContent: "center" },
  jumpText: { fontFamily: fonts.bodySemibold, fontSize: 13 },

  grid: { gap: 2 },
  week: { flexDirection: "row", gap: 2 },
  weekHead: { flex: 1, textAlign: "center", fontFamily: fonts.mono, fontSize: 12 },
  blank: { flex: 1, height: 54 },
  cell: { flex: 1, height: 54, paddingTop: 5, borderRadius: radius.sm, alignItems: "center", gap: 1 },
  cellNum: { fontSize: 15, lineHeight: 17, fontVariant: ["tabular-nums"] },
  cellBs: { fontFamily: fonts.mono, fontSize: 11, lineHeight: 13 },
  dots: { position: "absolute", left: 0, right: 0, bottom: 6, flexDirection: "row", justifyContent: "center", gap: 3 },
  dot: { width: 5, height: 5, borderRadius: radius.pill },

  detail: { gap: 8, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1 },
  detailDate: { fontFamily: fonts.mono, fontSize: 12 },
  detailRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  detailName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 14 },
  detailKind: { fontFamily: fonts.body, fontSize: 12 },

  strip: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: radius.md, borderWidth: 1 },
  stripTitle: { flex: 1, fontFamily: fonts.body, fontSize: 13 },
  stripDate: { fontFamily: fonts.mono, fontSize: 12 },

  legend: { flexDirection: "row", flexWrap: "wrap", columnGap: 14, rowGap: 6, paddingHorizontal: 2 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  legendText: { fontFamily: fonts.body, fontSize: 12 },
  swatchDot: { width: 8, height: 8, borderRadius: radius.pill },
  swatchSquare: { width: 8, height: 8, borderRadius: 3 },
  swatchToday: { backgroundColor: "transparent", borderWidth: 1.5 },
  swatchHoliday: { borderWidth: 1 },
});
