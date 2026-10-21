import { useState, useMemo } from "react";
import { View, Text, Alert, StyleSheet } from "react-native";
import { useGoBack } from "../lib/useGoBack";
import { pad, dayOf, toDate, localToday, daysBetween } from "../lib/dates";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Screen, ScreenHeader, Card, EmptyState, Button, IconButton, Pill } from "../components/ui";
import AddCompanyEventModal from "../components/AddCompanyEventModal";
import EditCompanyEventModal from "../components/EditCompanyEventModal";
import AddPublicHolidayModal from "../components/AddPublicHolidayModal";

// Events, in the order of the canvas's MobileEvents.dc.html: the header, Add Event and Add Holiday
// (admins), the company events (the next one in its own card, then the rest: upcoming soonest
// first, then past ones most recent first, as the web's single list keeps them all), and the
// upcoming public holidays. Admins edit events (delete moved into the edit sheet, as the canvas
// shows only Edit on a row) and delete holidays, as they could on this screen and on Leaves before
// the redesign. Each holiday day is its own row: the app stores a multi-day holiday a row per day.

// An event this many days ahead or fewer is "soon": the window the banner announces it in (the
// web's Events page, EventBanner).
const SOON_DAYS = 7;

// "Today", "Tomorrow", "in 5 days", "Yesterday", "3 days ago".
function countdown(days) {
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

const notThisYear = (date) => date.getFullYear() !== new Date().getFullYear();
const month = (date) => date.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
const otherYear = (date) => (notThisYear(date) ? { year: "numeric" } : {});
// "Monday, October 26", with the year when it is another year's.
const fullDate = (date) => date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", ...otherYear(date) });
// A row's line under its title, beside the date tile: "Thursday", or "Thursday · 2027".
const rowDay = (date) => [date.toLocaleDateString("en-US", { weekday: "long" }), notThisYear(date) ? date.getFullYear() : null].filter(Boolean).join(" · ");
// A holiday's date, as the canvas: "Sun, Nov 15, 2026".
const holidayDate = (date) => date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });

function SectionHead({ title, meta, children }) {
  const t = useThemeColors();
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionHeadRow}>
        <Text accessibilityRole="header" style={[styles.sectionTitle, { color: t.text1 }]}>
          {title}
        </Text>
        {/* On the page, so text2 where the canvas has text3 (4.5:1 over the light aurora). */}
        {meta ? <Text style={[styles.headMono, { color: t.text2 }]}>{meta}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function EditEvent({ event, onEdit, style }) {
  return <IconButton icon="edit" tone="plain" size={44} onPress={() => onEdit(event)} accessibilityLabel={`Edit event ${event.title}`} style={style} />;
}

// The next event: a 56-wide cyan date tile, "Next up" and its countdown, the title and the full date.
function NextEvent({ event, days, canManage, onEdit }) {
  const t = useThemeColors();
  const date = toDate(dayOf(event.date));
  return (
    <Card style={[styles.next, { borderColor: t.cyanEdge, borderTopColor: t.cyanEdge }]}>
      <View style={[styles.nextTile, { borderColor: t.cyanEdge, backgroundColor: t.pbCyan }]}>
        <Text style={[styles.nextTileMonth, { color: t.cyanText }]}>{month(date)}</Text>
        <Text style={[styles.nextTileDay, { color: t.text1 }]}>{pad(date.getDate())}</Text>
        <Text style={[styles.nextTileDow, { color: t.text3 }]}>{date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</Text>
      </View>
      <View style={styles.nextText}>
        <View style={[styles.nextPill, { backgroundColor: t.pbCyan }]}>
          <View style={[styles.nextDot, { backgroundColor: t.cyan, boxShadow: t.glow }]} />
          <Text numberOfLines={1} style={[styles.nextPillText, { color: t.pfCyan }]}>
            Next up · {countdown(days)}
          </Text>
        </View>
        <Text accessibilityRole="header" style={[styles.nextTitle, { color: t.text1 }]}>
          {event.title}
        </Text>
        <Text style={[styles.mono, { color: t.text3 }]}>{fullDate(date)}</Text>
      </View>
      {canManage ? <EditEvent event={event} onEdit={onEdit} style={styles.nextEdit} /> : null}
    </Card>
  );
}

// Any other event: a 44-wide date tile, the title, the weekday and its countdown.
function EventRow({ event, days, first, canManage, onEdit }) {
  const t = useThemeColors();
  const date = toDate(dayOf(event.date));
  const soon = days >= 0 && days <= SOON_DAYS;
  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: t.line }]}>
      <View style={[styles.tile, { borderColor: t.lineStrong, backgroundColor: t.raised }]}>
        <Text style={[styles.tileMonth, { color: t.cyanText }]}>{month(date)}</Text>
        <Text style={[styles.tileDay, { color: t.text1 }]}>{pad(date.getDate())}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: t.text1 }]}>{event.title}</Text>
        <Text numberOfLines={1} style={[styles.mono, { color: t.text3 }]}>
          {rowDay(date)}
        </Text>
      </View>
      <Pill tone={soon ? "cyan" : "gray"}>{countdown(days)}</Pill>
      {canManage ? <EditEvent event={event} onEdit={onEdit} style={styles.rowAction} /> : null}
    </View>
  );
}

// A holiday day: its date tile, the name and the date, the countdown, and delete for admins. Today
// and tomorrow take the cyan signal (tile and pill, as the web's holiday pill) where the canvas has
// orange: orange is kept for people moments (intent criterion 3).
function HolidayRow({ holiday, days, first, canDelete, onDelete }) {
  const t = useThemeColors();
  const date = toDate(dayOf(holiday.date));
  const near = days <= 1;
  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: t.line }]}>
      <View style={[styles.tile, near ? { borderColor: t.cyanEdge, backgroundColor: t.pbCyan } : { borderColor: t.lineStrong, backgroundColor: t.raised }]}>
        <Text style={[styles.tileMonth, { color: t.cyanText }]}>{month(date)}</Text>
        <Text style={[styles.tileDay, { color: t.text1 }]}>{pad(date.getDate())}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={[styles.rowTitle, { color: t.text1 }]}>{holiday.title}</Text>
        <Text numberOfLines={1} style={[styles.mono, { color: t.text2 }]}>
          {holidayDate(date)}
        </Text>
      </View>
      <Pill tone={near ? "cyan" : "gray"}>{countdown(days)}</Pill>
      {canDelete ? (
        <IconButton icon="trash" tone="plain" size={44} onPress={() => onDelete(holiday)} accessibilityLabel={`Delete holiday ${holiday.title}`} style={styles.rowAction} />
      ) : null}
    </View>
  );
}

export default function EventsScreen() {
  const { companyEvents, publicHolidays, deletePublicHoliday, isAdmin } = useApp();
  const t = useThemeColors();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const today = localToday();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  const [showAddHoliday, setShowAddHoliday] = useState(false);

  // Every event with its distance from today: upcoming soonest first, then past most recent first.
  const { upcoming, past } = useMemo(() => {
    const dated = (companyEvents || [])
      .map((event) => ({ event, day: dayOf(event.date) }))
      .sort((a, b) => a.day.localeCompare(b.day))
      .map(({ event, day }) => ({ event, days: daysBetween(today, day) }));
    return { upcoming: dated.filter((e) => e.days >= 0), past: dated.filter((e) => e.days < 0).reverse() };
  }, [companyEvents, today]);
  const next = upcoming[0];
  const rest = [...upcoming.slice(1), ...past];

  const holidays = useMemo(
    () =>
      (publicHolidays || [])
        .map((holiday) => ({ holiday, day: dayOf(holiday.date) }))
        .filter(({ day }) => day >= today)
        .sort((a, b) => a.day.localeCompare(b.day))
        .map(({ holiday, day }) => ({ holiday, days: daysBetween(today, day) })),
    [publicHolidays, today]
  );

  const confirmDeleteHoliday = (holiday) => {
    Alert.alert("Delete holiday?", holiday.title, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deletePublicHoliday(holiday.id) },
    ]);
  };

  return (
    <Screen style={{ paddingBottom: 32 + insets.bottom }}>
      <ScreenHeader title="Events" onBack={goBack} />

      {isAdmin ? (
        <View style={styles.adds}>
          <Button title="Add Event" icon="plus" onPress={() => setShowAdd(true)} style={[styles.addBtn, { boxShadow: t.glowPrimary }]} />
          <Button title="Add Holiday" icon="flag" variant="secondary" onPress={() => setShowAddHoliday(true)} style={[styles.addBtn, { borderTopColor: t.glassHi }]} />
        </View>
      ) : null}

      <SectionHead title="Company events" meta={`${upcoming.length} upcoming`} />
      {companyEvents.length === 0 ? (
        <Card style={styles.panel}>
          <EmptyState icon="calendar-days" text="No custom events recorded." />
        </Card>
      ) : null}
      {next ? <NextEvent event={next.event} days={next.days} canManage={isAdmin} onEdit={setEditing} /> : null}
      {rest.length > 0 ? (
        <Card style={[styles.panel, styles.list]}>
          {rest.map(({ event, days }, i) => (
            <EventRow key={event.id} event={event} days={days} first={i === 0} canManage={isAdmin} onEdit={setEditing} />
          ))}
        </Card>
      ) : null}

      <SectionHead title="Public holidays" meta={`${holidays.length} ${holidays.length === 1 ? "day" : "days"}`}>
        <Text style={[styles.sectionSub, { color: t.text2 }]}>Skipped when leave days are counted.</Text>
      </SectionHead>
      <Card style={[styles.panel, styles.list]}>
        {holidays.length === 0 ? (
          <EmptyState icon="flag" text="No upcoming holidays." />
        ) : (
          holidays.map(({ holiday, days }, i) => (
            <HolidayRow key={holiday.id} holiday={holiday} days={days} first={i === 0} canDelete={isAdmin} onDelete={confirmDeleteHoliday} />
          ))
        )}
      </Card>

      <AddCompanyEventModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
      <EditCompanyEventModal isOpen={!!editing} onClose={() => setEditing(null)} event={editing} />
      <AddPublicHolidayModal isOpen={showAddHoliday} onClose={() => setShowAddHoliday(false)} />
    </Screen>
  );
}

// Sizes, gaps and type from MobileEvents.dc.html; letter-spacing in em becomes pixels at the text's
// size.
const styles = StyleSheet.create({
  // Add Event and Add Holiday: two columns 10 apart, 48 high and 14 round.
  adds: { flexDirection: "row", gap: 10, marginBottom: 14 },
  addBtn: { flex: 1, minHeight: 48, borderRadius: 14 },

  sectionHead: { gap: 2, paddingTop: 6, paddingHorizontal: 4, marginBottom: 14 },
  sectionHeadRow: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  sectionTitle: { flex: 1, fontFamily: fonts.display, fontSize: 17 },
  sectionSub: { fontFamily: fonts.body, fontSize: 13 },
  headMono: { fontFamily: fonts.mono, fontSize: 12 },
  mono: { fontFamily: fonts.mono, fontSize: 12 },

  panel: { borderRadius: radius.xl },
  list: { paddingVertical: 4, paddingHorizontal: 16 },

  // The next event: 16 in, 20 round, the 56-wide tile 14 from the text.
  next: { borderRadius: radius.xl, padding: 16, paddingHorizontal: 16, flexDirection: "row", alignItems: "flex-start", gap: 14 },
  nextTile: { width: 56, borderWidth: 1, borderRadius: 14, alignItems: "center" },
  // .06em at 12px.
  nextTileMonth: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.72, paddingTop: 5 },
  nextTileDay: { fontFamily: fonts.display, fontSize: 24, lineHeight: 26 },
  nextTileDow: { fontFamily: fonts.mono, fontSize: 11, paddingBottom: 5 },
  nextText: { flex: 1, minWidth: 0, gap: 6 },
  nextPill: { alignSelf: "flex-start", height: 22, paddingHorizontal: 8, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: 6 },
  nextDot: { width: 6, height: 6, borderRadius: radius.pill },
  nextPillText: { fontFamily: fonts.bodySemibold, fontSize: 12 },
  nextTitle: { fontFamily: fonts.display, fontSize: 18 },
  nextEdit: { marginTop: -6, marginRight: -6 },

  // A list row: at least 72 high, 12 between its parts, a hairline above.
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, paddingVertical: 8 },
  tile: { width: 44, borderWidth: 1, borderRadius: radius.sm, alignItems: "center" },
  // .06em at 11px.
  tileMonth: { fontFamily: fonts.mono, fontSize: 11, letterSpacing: 0.66, paddingTop: 3 },
  tileDay: { fontFamily: fonts.display, fontSize: 17, paddingBottom: 3 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowTitle: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  rowAction: { marginRight: -8 },
});
