import { useState, useMemo } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Alert, StyleSheet } from "react-native";
import { Link } from "expo-router";
import { useApp } from "../../context/AppContext";
import { useThemeColors, radius, fonts } from "../../lib/theme";
import { Screen, Card, Eyebrow, EmptyState, IconButton, Pill } from "../../components/ui";
import TopBar from "../../components/TopBar";
import Avatar from "../../components/Avatar";
import Icon from "../../components/Icon";
import AddFineModal from "../../components/AddFineModal";
import EditFineModal from "../../components/EditFineModal";
import AddStandupFineModal from "../../components/AddStandupFineModal";
import EditStandupModal from "../../components/EditStandupModal";
import AddFineSeasonModal from "../../components/AddFineSeasonModal";
import EditFineSeasonModal from "../../components/EditFineSeasonModal";

// Fines, in the order of the canvas's MobileFines.dc.html: the top bar, the fine type switch, the
// seasons, the season's summary, the link to Withdrawals, then the records with their search and
// status filter. Fine admins (canManageFines) also get Record, adding and editing seasons, and each
// record's paid toggle, edit and delete. The data and the actions are the ones this screen had
// before the redesign; Standup Fines has no seasons, as before.

const UNASSIGNED = "unassigned";

// The summary tiles' dots, as the canvas draws them: token names, all fixed in both themes.
const SUMMARY_DOTS = { total: "primary", paid: "green", unpaid: "unpaid", jar: "cyanDot" };

const FINE_TYPES = [
  { value: "late", label: "Late Fines", icon: "clock" },
  { value: "standup", label: "Standup Fines", icon: "clipboard" },
];

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "unpaid", label: "Unpaid" },
  { value: "paid", label: "Paid" },
];

// "Oct 16, 2026". Built once: the list formats every row's date again on each key in the search.
const dayFormat = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" });

// From the parts, so the day lands on local midnight; a value that is not a date shows as it is.
function formatDate(dateStr) {
  const [y, m, d] = String(dateStr || "").slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return String(dateStr || "");
  return dayFormat.format(new Date(y, m - 1, d));
}

const rs = (n) => `Rs. ${Number(n || 0).toLocaleString()}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// The canvas's fine type switch: the two types side by side on a glass track.
function FineTypeSwitch({ value, onChange }) {
  const t = useThemeColors();
  return (
    <Card style={styles.types}>
      <View accessibilityRole="tablist" accessibilityLabel="Fine type" style={styles.typesRow}>
        {FINE_TYPES.map((type) => {
          const selected = type.value === value;
          const color = selected ? t.primaryText : t.text3;
          return (
            <Pressable
              key={type.value}
              onPress={() => onChange(type.value)}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              style={({ pressed }) => [
                styles.type,
                selected ? { backgroundColor: t.primarySoft, borderColor: t.primaryEdge } : pressed && { backgroundColor: t.raised },
              ]}
            >
              <Icon name={type.icon} size={18} strokeWidth={1.9} color={color} />
              <Text numberOfLines={1} style={[styles.typeText, { color, fontFamily: selected ? fonts.bodySemibold : fonts.bodyMedium }]}>
                {type.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </Card>
  );
}

// One season in the canvas's season row: a glass pill, the one shown primary-soft on a primary edge
// with the cyan dot. Its label is text1 where the canvas has primary text: the row sits on the page,
// and primaryText over the light aurora is under 4.5:1. The chosen season carries the pencil that
// opens its edit sheet for fine admins (the app had one on every season; the canvas draws none).
function SeasonChip({ label, icon, active, onPress, onEdit }) {
  const t = useThemeColors();
  return (
    <View style={[styles.chip, { borderColor: active ? t.primary : t.lineStrong, backgroundColor: active ? t.primarySoft : t.surface }]}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityState={{ selected: !!active }}
        style={({ pressed }) => [styles.chipMain, onEdit && styles.chipMainWithEdit, pressed && !active && { backgroundColor: t.raised }]}
      >
        {active ? <View style={[styles.chipDot, { backgroundColor: t.cyan, boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 10, color: t.cyan }] }]} /> : null}
        {icon ? <Icon name={icon} size={16} color={active ? t.text1 : t.text2} /> : null}
        <Text numberOfLines={1} style={[styles.chipText, { color: active ? t.text1 : t.text2, fontFamily: active ? fonts.bodySemibold : fonts.bodyMedium }]}>
          {label}
        </Text>
      </Pressable>
      {onEdit ? (
        <Pressable onPress={onEdit} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Edit season ${label}`} style={styles.chipEdit}>
          <Icon name="edit" size={15} color={t.text1} />
        </Pressable>
      ) : null}
    </View>
  );
}

// The canvas's dashed "Season" chip that adds one. Its label is text1 for the same reason as above;
// the plus keeps the primary text, a graphic that passes 3:1 there.
function AddSeasonChip({ onPress }) {
  const t = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Add season"
      style={({ pressed }) => [styles.chip, styles.addChip, { borderColor: t.lineStrong, backgroundColor: pressed ? t.raised : "transparent" }]}
    >
      <Icon name="plus" size={16} strokeWidth={2.2} color={t.primaryText} />
      <Text style={[styles.chipText, { color: t.text1, fontFamily: fonts.bodySemibold }]}>Season</Text>
    </Pressable>
  );
}

// One of the season summary tiles, as the canvas (and Home's key figures): the mono label with its
// dot, the figure, a muted line.
function SummaryTile({ label, value, sub, dot }) {
  const t = useThemeColors();
  return (
    <Card style={styles.tile}>
      <View style={styles.tileHead}>
        <Eyebrow style={[styles.tileLabel, { color: t.text3 }]}>{label}</Eyebrow>
        <View style={[styles.tileDot, { backgroundColor: dot, boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 10, color: dot }] }]} />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={[styles.tileValue, { color: t.text1 }]}>
        {value}
      </Text>
      <Text style={[styles.tileSub, { color: t.text3 }]}>{sub}</Text>
    </Card>
  );
}

// The card that opens Withdrawals, as the canvas: the banknote tile, the total and the count.
function WithdrawalsLink({ total, count }) {
  const t = useThemeColors();
  const summary = `${rs(total)} withdrawn · ${plural(count, "record")}`;
  return (
    <Link href="/withdrawals" asChild>
      <Pressable accessibilityLabel={`Withdrawals, ${summary}`}>
        {({ pressed }) => (
          <Card style={[styles.withdrawals, pressed && styles.pressed]}>
            <View style={[styles.withdrawalsIcon, { backgroundColor: t.pbViolet }]}>
              <Icon name="banknote" size={20} color={t.pfViolet} />
            </View>
            <View style={styles.withdrawalsText}>
              <Text style={[styles.withdrawalsTitle, { color: t.text1 }]}>Withdrawals</Text>
              <Text numberOfLines={1} style={[styles.withdrawalsSub, { color: t.text3 }]}>
                {summary}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} strokeWidth={2} color={t.text3} />
          </Card>
        )}
      </Pressable>
    </Link>
  );
}

// The canvas's search field: a glass bar with the search icon; cyan edge while typing.
function SearchField({ value, onChangeText }) {
  const t = useThemeColors();
  const [focused, setFocused] = useState(false);
  const edge = focused ? { borderColor: t.cyan, borderTopColor: t.cyan } : null;
  return (
    <Card style={[styles.search, edge]}>
      <Icon name="search" size={18} strokeWidth={2} color={t.text3} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder="Search by name, date..."
        placeholderTextColor={t.text3}
        accessibilityLabel="Search fines"
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.searchInput, { color: t.text1 }]}
      />
    </Card>
  );
}

// The canvas's status filter: All, Unpaid, Paid. The ones not chosen sit straight on the page, so
// their labels are text2 where the canvas has text3 (under 4.5:1 over the light aurora).
function StatusFilter({ value, onChange }) {
  const t = useThemeColors();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel="Status filter" style={styles.filters}>
      {STATUS_FILTERS.map((f) => {
        const checked = f.value === value;
        return (
          <Pressable
            key={f.value}
            onPress={() => onChange(f.value)}
            accessibilityRole="radio"
            accessibilityState={{ checked }}
            style={({ pressed }) => [
              styles.filter,
              checked
                ? { borderColor: t.lineStrong, backgroundColor: t.surfaceStrong }
                : { borderColor: t.line, backgroundColor: pressed ? t.raised : "transparent" },
            ]}
          >
            <Text style={[styles.filterText, { color: checked ? t.text1 : t.text2, fontFamily: checked ? fonts.bodySemibold : fonts.bodyMedium }]}>
              {f.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// One record, as the canvas's row: avatar, name and date, the amount, the status pill. For fine
// admins the pill is the paid toggle (it asks first, as before) and edit and delete follow it; the
// amount then sits over the pill, so the name keeps room on a phone's width.
function RecordRow({ record, isMe, canManage, onToggle, onEdit, onDelete }) {
  const t = useThemeColors();
  const paid = record.status === "paid";
  const date = formatDate(record.date);
  const amount = record.amount != null ? rs(record.amount) : null;
  const pill = (
    <Pill tone={paid ? "green" : "amber"} style={styles.rowPill}>
      {paid ? "Paid" : "Unpaid"}
    </Pill>
  );

  return (
    <Card style={styles.row}>
      <Avatar name={record.employee_name} size={40} isMe={isMe} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[styles.rowName, { color: t.text1 }]}>
          {record.employee_name}
        </Text>
        <Text numberOfLines={1} style={[styles.rowDate, { color: t.text3 }]}>
          {date}
        </Text>
      </View>
      <View style={canManage ? styles.rowStatusStacked : styles.rowStatus}>
        {amount ? <Text style={[styles.rowAmount, { color: t.text1 }]}>{amount}</Text> : null}
        {canManage ? (
          <Pressable
            onPress={() => onToggle(record)}
            hitSlop={{ top: 9, bottom: 9, left: 6, right: 6 }}
            accessibilityRole="button"
            accessibilityLabel={`${paid ? "Mark as unpaid" : "Mark as paid"}: ${record.employee_name}, ${date}`}
            style={({ pressed }) => pressed && styles.pressed}
          >
            {pill}
          </Pressable>
        ) : (
          <View style={styles.rowPillSlot}>{pill}</View>
        )}
      </View>
      {canManage ? (
        <View style={styles.rowActions}>
          <IconButton icon="edit" tone="plain" onPress={() => onEdit(record)} accessibilityLabel={`Edit ${record.employee_name} fine on ${date}`} />
          <IconButton icon="trash" tone="danger" onPress={() => onDelete(record)} accessibilityLabel={`Delete ${record.employee_name} fine on ${date}`} />
        </View>
      ) : null}
    </Card>
  );
}

// The canvas's Record button, floating over the list above the tab bar.
function RecordButton({ onPress }) {
  const t = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.record, { backgroundColor: pressed ? t.primaryHover : t.primary, boxShadow: t.glowPrimaryLg }]}
    >
      <Icon name="plus" size={22} strokeWidth={2.2} color="#FFFFFF" />
      <Text style={styles.recordText}>Record</Text>
    </Pressable>
  );
}

export default function FinesScreen() {
  const { fines: allFines, fineSeasons, standupFines: allStandupFines, toggleFineStatus, deleteFine, toggleStandupFineStatus, deleteStandupFine, canManageFines, withdrawals, currentEmployee } = useApp();
  const fines = useMemo(() => allFines.filter(f => f.employee_name !== "Developers"), [allFines]);
  const standupFines = useMemo(() => allStandupFines.filter(f => f.employee_name !== "Developers"), [allStandupFines]);
  const t = useThemeColors();
  const canManage = canManageFines;
  const myName = currentEmployee?.name;

  const [tab, setTab] = useState("late");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [showAddFine, setShowAddFine] = useState(false);
  const [editingFine, setEditingFine] = useState(null);
  const [showAddStandup, setShowAddStandup] = useState(false);
  const [editingStandup, setEditingStandup] = useState(null);
  // The season you picked; null follows the latest, as the web's Late Fines and Home's chart do.
  const [pickedSeasonId, setPickedSeasonId] = useState(null);
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [editingSeason, setEditingSeason] = useState(null);

  const sortedSeasons = useMemo(
    () => [...fineSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)),
    [fineSeasons]
  );
  const latestSeasonId = sortedSeasons[0]?.id ?? null;

  const unassignedCount = useMemo(() => fines.filter((f) => !f.season_id).length, [fines]);

  // The latest season until you pick one; a picked season that has since been deleted (or an
  // emptied Pre Fiscal Year) falls back the same way. With no season at all, the fines without one.
  const pickedIsShown =
    pickedSeasonId === UNASSIGNED ? unassignedCount > 0 : sortedSeasons.some((s) => s.id === pickedSeasonId);
  const activeSeasonId = pickedIsShown ? pickedSeasonId : latestSeasonId ?? (unassignedCount > 0 ? UNASSIGNED : null);
  const activeSeasonLabel =
    activeSeasonId === UNASSIGNED ? "Pre Fiscal Year Fines" : sortedSeasons.find((s) => s.id === activeSeasonId)?.title;

  const seasonFines = useMemo(() => {
    if (activeSeasonId === UNASSIGNED) return fines.filter((f) => !f.season_id);
    return fines.filter((f) => f.season_id === activeSeasonId);
  }, [fines, activeSeasonId]);

  // The season's tiles, in one pass.
  const summary = useMemo(() => {
    const s = { total: 0, paid: 0, unpaid: 0, paidCount: 0, unpaidCount: 0 };
    for (const f of seasonFines) {
      s.total += f.amount;
      if (f.status === "paid") {
        s.paid += f.amount;
        s.paidCount += 1;
      } else if (f.status === "unpaid") {
        s.unpaid += f.amount;
        s.unpaidCount += 1;
      }
    }
    return s;
  }, [seasonFines]);

  // Accumulation always spans every fine ever recorded, regardless of season
  const accumulatedTotal = useMemo(() => fines.reduce((s, f) => s + f.amount, 0), [fines]);
  const accumulatedUnpaid = useMemo(() => fines.filter((f) => f.status === "unpaid").reduce((s, f) => s + f.amount, 0), [fines]);

  // The jar holds every paid fine, so it matches Home's collected and left (and the web's jar).
  const collected = useMemo(() => allFines.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0), [allFines]);
  const totalWithdrawn = withdrawals.reduce((s, w) => s + w.amount, 0);
  const inTheJar = Math.max(collected - totalWithdrawn, 0);

  const filteredFines = useMemo(() => {
    let list = [...seasonFines];
    if (statusFilter !== "all") list = list.filter((f) => f.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.employee_name.toLowerCase().includes(q) || f.date.includes(q) || String(f.amount).includes(q));
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [seasonFines, statusFilter, search]);

  const filteredStandups = useMemo(() => {
    let list = [...standupFines];
    if (statusFilter !== "all") list = list.filter((f) => f.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.employee_name.toLowerCase().includes(q) || f.date.includes(q));
    }
    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [standupFines, statusFilter, search]);

  const totalFiltered = filteredFines.reduce((s, f) => s + f.amount, 0);

  const confirmDeleteFine = (f) => {
    Alert.alert("Delete fine?", `${f.employee_name} · Rs. ${f.amount}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteFine(f.id) },
    ]);
  };
  const confirmDeleteStandup = (f) => {
    Alert.alert("Delete record?", `${f.employee_name} · ${f.date}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteStandupFine(f.id) },
    ]);
  };
  const confirmToggleFine = (f) => {
    const next = f.status === "paid" ? "unpaid" : "paid";
    Alert.alert(`Mark as ${next}?`, `${f.employee_name} · Rs. ${f.amount}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => toggleFineStatus(f.id) },
    ]);
  };
  const confirmToggleStandup = (f) => {
    const next = f.status === "paid" ? "unpaid" : "paid";
    Alert.alert(`Mark as ${next}?`, `${f.employee_name} · ${f.date}`, [
      { text: "Cancel", style: "cancel" },
      { text: "Confirm", onPress: () => toggleStandupFineStatus(f.id) },
    ]);
  };

  const late = tab === "late";
  const records = late ? filteredFines : filteredStandups;

  return (
    <View style={styles.page}>
      <Screen style={canManage ? styles.roomForRecord : undefined}>
        <TopBar title="Fines" eyebrow={late && activeSeasonLabel ? `Records · ${activeSeasonLabel}` : "Records"} />

        <FineTypeSwitch value={tab} onChange={setTab} />

        {late ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasons} contentContainerStyle={styles.seasonsRow}>
              {sortedSeasons.map((s) => (
                <SeasonChip
                  key={s.id}
                  label={s.title}
                  active={activeSeasonId === s.id}
                  onPress={() => setPickedSeasonId(s.id)}
                  onEdit={canManage && activeSeasonId === s.id ? () => setEditingSeason(s) : null}
                />
              ))}
              {unassignedCount > 0 ? (
                <SeasonChip
                  label="Pre Fiscal Year Fines"
                  icon="archive"
                  active={activeSeasonId === UNASSIGNED}
                  onPress={() => setPickedSeasonId(UNASSIGNED)}
                />
              ) : null}
              {sortedSeasons.length === 0 && unassignedCount === 0 ? (
                <Text style={[styles.noSeasons, { color: t.text2 }]}>No seasons yet</Text>
              ) : null}
              {canManage ? <AddSeasonChip onPress={() => setShowAddSeason(true)} /> : null}
            </ScrollView>

            <View style={styles.summary}>
              <View style={styles.tileRow}>
                <SummaryTile label="Total" value={rs(summary.total)} sub={plural(seasonFines.length, "fine")} dot={t[SUMMARY_DOTS.total]} />
                <SummaryTile label="Paid" value={rs(summary.paid)} sub={`${summary.paidCount} settled`} dot={t[SUMMARY_DOTS.paid]} />
              </View>
              <View style={styles.tileRow}>
                <SummaryTile label="Unpaid" value={rs(summary.unpaid)} sub={`${summary.unpaidCount} open`} dot={t[SUMMARY_DOTS.unpaid]} />
                <SummaryTile label="In the jar" value={rs(inTheJar)} sub="Paid minus withdrawn" dot={t[SUMMARY_DOTS.jar]} />
              </View>
              <Text style={[styles.accumulated, { color: t.text2 }]}>
                Accumulated total (all seasons): {rs(accumulatedTotal)} · {rs(accumulatedUnpaid)} unpaid
              </Text>
            </View>
          </>
        ) : null}

        <WithdrawalsLink total={totalWithdrawn} count={withdrawals.length} />

        <View style={styles.recordsHead}>
          <Text accessibilityRole="header" style={[styles.recordsTitle, { color: t.text1 }]}>
            {late ? "Fine Records" : "Missing Standup Records"}
          </Text>
          <Text style={[styles.recordsCount, { color: t.text2 }]}>
            {late ? `${plural(filteredFines.length, "record")} · ${rs(totalFiltered)}` : plural(filteredStandups.length, "instance")}
          </Text>
        </View>

        <SearchField value={search} onChangeText={setSearch} />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />

        {canManage ? (
          <View style={styles.hint}>
            <Icon name="arrow-left-right" size={14} strokeWidth={2} color={t.text2} />
            <Text style={[styles.hintText, { color: t.text2 }]}>Tap a status to toggle</Text>
          </View>
        ) : null}

        {records.length === 0 ? (
          <Card style={styles.empty}>
            <EmptyState icon={late ? "wallet" : "clipboard"} text={late ? "No records found" : "No standup records found"} />
          </Card>
        ) : (
          records.map((f) => (
            <RecordRow
              key={f.id}
              record={f}
              isMe={!!myName && f.employee_name === myName}
              canManage={canManage}
              onToggle={late ? confirmToggleFine : confirmToggleStandup}
              onEdit={late ? setEditingFine : setEditingStandup}
              onDelete={late ? confirmDeleteFine : confirmDeleteStandup}
            />
          ))
        )}
      </Screen>

      {canManage ? <RecordButton onPress={() => (late ? setShowAddFine(true) : setShowAddStandup(true))} /> : null}

      <AddFineModal isOpen={showAddFine} onClose={() => setShowAddFine(false)} />
      <EditFineModal isOpen={!!editingFine} onClose={() => setEditingFine(null)} fine={editingFine} />
      <AddStandupFineModal isOpen={showAddStandup} onClose={() => setShowAddStandup(false)} />
      <EditStandupModal isOpen={!!editingStandup} onClose={() => setEditingStandup(null)} record={editingStandup} />
      <AddFineSeasonModal isOpen={showAddSeason} onClose={() => setShowAddSeason(false)} />
      <EditFineSeasonModal isOpen={!!editingSeason} onClose={() => setEditingSeason(null)} season={editingSeason} />
    </View>
  );
}

// Sizes, gaps and type from MobileFines.dc.html; letter-spacing in em becomes pixels at the text's
// size (.04em at 12px is 0.48).
const styles = StyleSheet.create({
  page: { flex: 1 },
  pressed: { opacity: 0.8 },
  // Room under the last record for Record (56 high, 18 above the tab bar).
  roomForRecord: { paddingBottom: 96 },

  // The fine type switch: a 16-radius glass track, 4 in, two 44-high halves 4 apart.
  types: { paddingVertical: 4, paddingHorizontal: 4 },
  typesRow: { flexDirection: "row", gap: 4 },
  type: {
    flex: 1,
    height: 44,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: "transparent",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  typeText: { flexShrink: 1, fontSize: 15 },

  // The seasons scroll sideways from edge to edge, as the canvas's row; 8 between chips.
  seasons: { flexGrow: 0, marginHorizontal: -16, marginBottom: 14 },
  seasonsRow: { gap: 8, paddingHorizontal: 16, alignItems: "center" },
  chip: { flexDirection: "row", alignItems: "center", height: 44, borderRadius: radius.pill, borderWidth: 1 },
  chipMain: { flexDirection: "row", alignItems: "center", gap: 8, height: "100%", paddingHorizontal: 16, borderRadius: radius.pill },
  chipMainWithEdit: { paddingRight: 4 },
  chipEdit: { height: "100%", width: 36, paddingRight: 6, alignItems: "center", justifyContent: "center" },
  chipDot: { width: 6, height: 6, borderRadius: radius.pill },
  chipText: { fontSize: 14 },
  addChip: { gap: 6, paddingHorizontal: 16, borderStyle: "dashed" },
  noSeasons: { fontFamily: fonts.body, fontSize: 13 },

  // Season summary: two columns 10 apart; each tile 18-radius glass, 14 by 16 in.
  summary: { gap: 10, marginBottom: 14 },
  tileRow: { flexDirection: "row", gap: 10 },
  tile: { flex: 1, marginBottom: 0, borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16, gap: 8 },
  tileHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  tileLabel: { flexShrink: 1, letterSpacing: 0.48 },
  tileDot: { marginLeft: "auto", width: 7, height: 7, borderRadius: 2 },
  tileValue: { fontFamily: fonts.display, fontSize: 22, lineHeight: 24, fontVariant: ["tabular-nums"] },
  tileSub: { fontFamily: fonts.body, fontSize: 13 },
  accumulated: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 17, paddingHorizontal: 4 },

  // The link to Withdrawals: 64 high, an 18-radius glass row with a 40 icon tile.
  withdrawals: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 64, paddingVertical: 10, paddingLeft: 16, paddingRight: 14, borderRadius: 18 },
  withdrawalsIcon: { width: 40, height: 40, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  withdrawalsText: { flex: 1, gap: 2 },
  withdrawalsTitle: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  withdrawalsSub: { fontFamily: fonts.mono, fontSize: 12 },

  // The records: their heading 6 further down, then 10 between everything.
  recordsHead: { flexDirection: "row", alignItems: "baseline", gap: 8, paddingHorizontal: 4, marginTop: 6, marginBottom: 10 },
  recordsTitle: { flex: 1, fontFamily: fonts.display, fontSize: 19 },
  recordsCount: { fontFamily: fonts.mono, fontSize: 12 },
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingVertical: 0, paddingHorizontal: 14, borderRadius: 14, marginBottom: 10 },
  searchInput: { flex: 1, height: "100%", paddingVertical: 0, fontFamily: fonts.body, fontSize: 15 },
  filters: { flexDirection: "row", gap: 8, marginBottom: 10 },
  filter: { height: 44, paddingHorizontal: 18, borderRadius: radius.md, borderWidth: 1, justifyContent: "center" },
  filterText: { fontSize: 14 },
  hint: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 4, marginTop: 2, marginBottom: 10 },
  hintText: { fontFamily: fonts.mono, fontSize: 12 },
  empty: { marginBottom: 10 },

  // A record: 72 high, an 18-radius glass row, 14 in on the left and 6 on the right.
  row: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 72, paddingVertical: 8, paddingLeft: 14, paddingRight: 6, borderRadius: 18, marginBottom: 10 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  rowName: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  rowDate: { fontFamily: fonts.mono, fontSize: 12 },
  rowStatus: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowStatusStacked: { alignItems: "flex-end", gap: 4 },
  rowAmount: { fontFamily: fonts.monoMedium, fontSize: 15 },
  // The canvas's status button is 72 wide with the pill in its middle, so the amounts line up.
  rowPillSlot: { minWidth: 72, alignItems: "center" },
  rowPill: { height: 26, paddingHorizontal: 10 },
  rowActions: { flexDirection: "row", gap: 4 },

  // Record: 56 high, 18 round, 16 from the edge and 18 above the tab bar.
  record: {
    position: "absolute",
    right: 16,
    bottom: 18,
    height: 56,
    paddingLeft: 18,
    paddingRight: 22,
    borderRadius: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  recordText: { fontFamily: fonts.bodySemibold, fontSize: 16, color: "#FFFFFF" },
});
