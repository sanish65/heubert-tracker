import { useState, useMemo } from "react";
import { View, Text, Pressable, ScrollView, TextInput, Alert, StyleSheet } from "react-native";
import { useGoBack } from "../lib/useGoBack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Screen, ScreenHeader, Card, Eyebrow, EmptyState, IconButton, FormModal, Pill } from "../components/ui";
import { SheetActions } from "../components/SheetParts";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import AddWordSeasonModal from "../components/AddWordSeasonModal";
import EditWordSeasonModal from "../components/EditWordSeasonModal";
import AddWordModal from "../components/AddWordModal";
import EditWordModal from "../components/EditWordModal";

// Word of the Day, in the order of the canvas's MobileWords.dc.html: the header with Manage seasons
// (admins), the season chips, the season's latest word as the word of the day, the search, the
// season's earlier words, and Add Word floating over them. An earlier word opens in place to show
// all it has (translation, example, who shared it) and, for admins, edit and delete. The data and
// the actions are the ones this screen had before the redesign; renaming and deleting a season moved
// into the Manage seasons sheet, as on Fines.

// The type / phonetic field's colour when it names a part of speech, as the canvas; anything else
// is blue, as its noun.
const POS_TONES = { noun: "blue", verb: "green", adjective: "violet" };
const POS_TEXT = { blue: "pfBlue", green: "pfGreen", violet: "pfViolet" };
const posTone = (phonetic) => POS_TONES[String(phonetic || "").trim().toLowerCase()] || "blue";

// The word card's corner light, the same in both themes: CSS radial-gradient(circle,
// rgba(45,212,239,.2), transparent 70%) on a 200px square: the circle reaches the far corner
// (141px), so the colour is gone 99px out. Its colour is the fixed canvas cyan (cyanDot).
const CORNER_LIGHT = { size: 200, r: 99, alpha: 0.2 };

const notThisYear = (date) => date.getFullYear() !== new Date().getFullYear();

// "Mon · Oct 19" for the word of the day; "Oct 16" for an earlier one. Another year adds the year.
function wordDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.toLocaleDateString("en-US", { weekday: "short" })} · ${shortDay(value)}`;
}
function shortDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(notThisYear(date) ? { year: "numeric" } : {}) });
}

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

function SeasonChip({ label, count, active, onPress }) {
  const t = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={`${label}, ${plural(count, "word")}`}
      style={({ pressed }) => [
        styles.chip,
        active ? { backgroundColor: t.primarySoft, borderColor: t.primary } : { backgroundColor: pressed ? t.raised : t.surface, borderColor: t.lineStrong },
      ]}
    >
      <Text numberOfLines={1} style={[styles.chipText, { color: active ? t.text1 : t.text2, fontFamily: active ? fonts.bodySemibold : fonts.bodyMedium }]}>
        {label}
      </Text>
      {/* text3 holds on the glass chip; on the tinted chosen one, text2. */}
      <Text style={[styles.chipCount, { color: active ? t.text2 : t.text3 }]}>{count}</Text>
    </Pressable>
  );
}

// The word's own actions, as the canvas: 44 square, a hairline edge, delete in red.
function WordActions({ word, onEdit, onDelete }) {
  const t = useThemeColors();
  return (
    <>
      <IconButton icon="edit" tone="plain" size={44} color={t.text2} onPress={() => onEdit(word)} accessibilityLabel={`Edit word ${word.word}`} style={[styles.wordAction, { borderColor: t.line }]} />
      <IconButton icon="trash" tone="plain" size={44} color={t.pfRed} onPress={() => onDelete(word)} accessibilityLabel={`Delete word ${word.word}`} style={[styles.wordAction, { borderColor: t.line }]} />
    </>
  );
}

function Example({ text }) {
  const t = useThemeColors();
  return (
    <View style={[styles.example, { backgroundColor: t.raised, borderLeftColor: t.primary }]}>
      <Icon name="quote" size={18} color={t.primaryText} style={styles.exampleIcon} />
      <Text style={[styles.exampleText, { color: t.text2 }]}>{text}</Text>
    </View>
  );
}

function Translation({ text }) {
  const t = useThemeColors();
  return (
    <View style={[styles.translation, { borderColor: t.line }]}>
      <Icon name="languages" size={18} color={t.text3} />
      <Text style={[styles.translationLabel, { color: t.text3 }]}>Translation</Text>
      <Text style={[styles.translationText, { color: t.text1 }]}>{text}</Text>
    </View>
  );
}

function CornerLight() {
  const t = useThemeColors();
  const { size, r, alpha } = CORNER_LIGHT;
  const color = t.cyanDot;
  return (
    <Svg width={size} height={size} style={styles.cornerLight} pointerEvents="none">
      <Defs>
        <RadialGradient id="wotd-light" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={alpha} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={size / 2} cy={size / 2} r={r} fill="url(#wotd-light)" />
    </Svg>
  );
}

// The season's latest word: the word in Space Grotesk, its type, the meaning, the example, the
// translation, and who shared it.
function TodayCard({ word, myName, canManage, onEdit, onDelete }) {
  const t = useThemeColors();
  return (
    <Card style={styles.today}>
      <CornerLight />
      <View style={styles.todayHead}>
        <View style={[styles.liveDot, { backgroundColor: t.cyan, boxShadow: t.glow }]} />
        <Eyebrow>Word of the day</Eyebrow>
        <Text style={[styles.todayDate, { color: t.text3 }]}>{wordDay(word.created_at)}</Text>
      </View>
      <View style={styles.todayWord}>
        <Text accessibilityRole="header" style={[styles.bigWord, { color: t.text1 }]}>
          {word.word}
        </Text>
        {word.phonetic ? (
          <Pill tone={posTone(word.phonetic)} style={styles.posPill}>
            {word.phonetic}
          </Pill>
        ) : null}
      </View>
      <Text style={[styles.meaning, { color: t.text1 }]}>{word.definition}</Text>
      {word.example ? <Example text={word.example} /> : null}
      {word.translation ? <Translation text={word.translation} /> : null}
      <View style={[styles.author, { borderTopColor: t.line }]}>
        <Avatar name={word.created_by} size={32} isMe={!!myName && word.created_by === myName} />
        <View style={styles.authorText}>
          <Text style={[styles.authorLabel, { color: t.text3 }]}>Shared by</Text>
          <Text numberOfLines={1} style={[styles.authorName, { color: t.text1 }]}>
            {word.created_by}
          </Text>
        </View>
        {canManage ? <WordActions word={word} onEdit={onEdit} onDelete={onDelete} /> : null}
      </View>
    </Card>
  );
}

// An earlier word: the word, its type and the meaning on one line, who shared it and when. Tapped,
// it opens to the full meaning, the translation, the example and the admin actions.
function WordRow({ word, first, open, onToggle, myName, canManage, onEdit, onDelete }) {
  const t = useThemeColors();
  const tone = posTone(word.phonetic);
  return (
    <View style={[styles.wordRow, !first && { borderTopWidth: 1, borderTopColor: t.line }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.wordRowMain, pressed && styles.pressed]}
      >
        <View style={styles.wordRowText}>
          <View style={styles.wordRowTitle}>
            <Text style={[styles.rowWord, { color: t.text1 }]}>{word.word}</Text>
            {word.phonetic ? (
              <Text numberOfLines={1} style={[styles.rowPos, { color: t[POS_TEXT[tone]] }]}>
                {word.phonetic}
              </Text>
            ) : null}
          </View>
          <Text numberOfLines={open ? undefined : 1} style={[open ? styles.rowMeaningOpen : styles.rowMeaning, { color: open ? t.text2 : t.text3 }]}>
            {word.definition}
          </Text>
        </View>
        <View style={styles.wordRowSide}>
          <Avatar name={word.created_by} size={26} isMe={!!myName && word.created_by === myName} />
          <Text style={[styles.rowDate, { color: t.text3 }]}>{shortDay(word.created_at)}</Text>
        </View>
      </Pressable>
      {open ? (
        <View style={styles.wordMore}>
          {word.example ? <Example text={word.example} /> : null}
          {word.translation ? <Translation text={word.translation} /> : null}
          <View style={styles.wordMoreFoot}>
            <Text numberOfLines={1} style={[styles.sharedBy, { color: t.text3 }]}>
              Shared by {word.created_by}
            </Text>
            {canManage ? <WordActions word={word} onEdit={onEdit} onDelete={onDelete} /> : null}
          </View>
        </View>
      ) : null}
    </View>
  );
}

// Admins' seasons: each one opens its edit sheet (rename, delete); New Season adds one. The two
// sheets open over this one, so they live inside it.
function ManageSeasonsSheet({ visible, onClose, seasons, counts }) {
  const t = useThemeColors();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);
  return (
    <FormModal visible={visible} onClose={onClose} title="Seasons">
      {seasons.length === 0 ? (
        <EmptyState icon="folder" text="No seasons yet" />
      ) : (
        <View style={[styles.seasonList, { backgroundColor: t.raised, borderColor: t.lineStrong }]}>
          {seasons.map((s, i) => (
            <Pressable
              key={s.id}
              onPress={() => setEditing(s)}
              accessibilityRole="button"
              accessibilityLabel={`Edit season ${s.title}`}
              style={({ pressed }) => [styles.seasonRow, i > 0 && { borderTopWidth: 1, borderTopColor: t.line }, pressed && { backgroundColor: t.pbGray }]}
            >
              <Text numberOfLines={1} style={[styles.seasonName, { color: t.text1 }]}>
                {s.title}
              </Text>
              <Text style={[styles.seasonCount, { color: t.text3 }]}>{plural(counts.get(s.id) || 0, "word")}</Text>
              <Icon name="edit" size={16} color={t.text2} />
            </Pressable>
          ))}
        </View>
      )}
      <SheetActions title="New Season" icon="plus" onPress={() => setShowAdd(true)} onCancel={onClose} />
      <AddWordSeasonModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
      <EditWordSeasonModal isOpen={!!editing} onClose={() => setEditing(null)} season={editing} />
    </FormModal>
  );
}

export default function WordsScreen() {
  const { wordSeasons, words, deleteWord, isAdmin, currentEmployee } = useApp();
  const t = useThemeColors();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const myName = currentEmployee?.name;
  // The season you picked; null follows the latest, as on Fines and Leaves.
  const [pickedSeasonId, setPickedSeasonId] = useState(null);
  const [search, setSearch] = useState("");
  const [openWordId, setOpenWordId] = useState(null);
  const [showSeasons, setShowSeasons] = useState(false);
  const [showAddWord, setShowAddWord] = useState(false);
  const [editingWord, setEditingWord] = useState(null);

  const sortedSeasons = useMemo(() => [...wordSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)), [wordSeasons]);

  // A picked season since deleted falls back to the latest.
  const effectiveSeasonId = sortedSeasons.some((s) => s.id === pickedSeasonId) ? pickedSeasonId : sortedSeasons[0]?.id || null;

  const counts = useMemo(() => {
    const map = new Map();
    words.forEach((w) => map.set(w.season_id, (map.get(w.season_id) || 0) + 1));
    return map;
  }, [words]);

  // Newest first, as the words load and as a new one is added.
  const seasonWords = useMemo(() => words.filter((w) => w.season_id === effectiveSeasonId), [words, effectiveSeasonId]);

  const searching = search.trim().length > 0;
  const matches = useMemo(() => {
    if (!searching) return seasonWords;
    const q = search.trim().toLowerCase();
    return seasonWords.filter((w) => w.word.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q) || (w.translation && w.translation.toLowerCase().includes(q)));
  }, [seasonWords, search, searching]);

  // The latest word is the word of the day; a search lists every match instead.
  const todayWord = searching ? null : seasonWords[0];
  const listed = searching ? matches : seasonWords.slice(1);

  const confirmDeleteWord = (w) => {
    Alert.alert("Delete word?", w.word, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteWord(w.id) },
    ]);
  };

  const manageButton = isAdmin ? (
    <IconButton icon="folder-plus" size={44} iconSize={20} onPress={() => setShowSeasons(true)} accessibilityLabel="Manage seasons" style={styles.headerBtn} />
  ) : null;

  return (
    <View style={styles.page}>
      <Screen style={{ paddingBottom: 96 + insets.bottom }}>
        <ScreenHeader title="Word of the Day" onBack={goBack} right={manageButton} />

        {sortedSeasons.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.seasons} contentContainerStyle={styles.seasonsRow}>
            {sortedSeasons.map((s) => (
              <SeasonChip
                key={s.id}
                label={s.title}
                count={counts.get(s.id) || 0}
                active={effectiveSeasonId === s.id}
                onPress={() => {
                  setPickedSeasonId(s.id);
                  setOpenWordId(null);
                }}
              />
            ))}
          </ScrollView>
        ) : null}

        {sortedSeasons.length === 0 ? (
          <Card style={styles.panel}>
            <EmptyState icon="book" text="No seasons yet" />
          </Card>
        ) : seasonWords.length === 0 ? (
          <Card style={styles.panel}>
            <EmptyState icon="book" text="No words found in this season yet." />
          </Card>
        ) : (
          <>
            {todayWord ? <TodayCard word={todayWord} myName={myName} canManage={isAdmin} onEdit={setEditingWord} onDelete={confirmDeleteWord} /> : null}

            <View style={[styles.search, { backgroundColor: t.surface, borderColor: t.line, borderTopColor: t.glassHi }]}>
              <Icon name="search" size={18} color={t.text3} />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Search words..."
                placeholderTextColor={t.text3}
                accessibilityLabel="Search words"
                returnKeyType="search"
                style={[styles.searchInput, { color: t.text1 }]}
              />
              {searching ? <IconButton icon="x" tone="plain" size={40} onPress={() => setSearch("")} accessibilityLabel="Clear search" style={styles.searchClear} /> : null}
            </View>

            {listed.length > 0 || searching ? (
              <Card style={[styles.panel, styles.earlier]}>
                <View style={styles.earlierHead}>
                  <Text accessibilityRole="header" style={[styles.panelTitle, { color: t.text1 }]}>
                    {searching ? "Search results" : "Earlier this season"}
                  </Text>
                  <Text style={[styles.headMono, { color: t.text3 }]}>{plural(searching ? matches.length : seasonWords.length, "word")}</Text>
                </View>
                {listed.length === 0 ? (
                  <EmptyState icon="search" text="No words found in this season yet." />
                ) : (
                  listed.map((w, i) => (
                    <WordRow
                      key={w.id}
                      word={w}
                      first={i === 0}
                      open={openWordId === w.id}
                      onToggle={() => setOpenWordId(openWordId === w.id ? null : w.id)}
                      myName={myName}
                      canManage={isAdmin}
                      onEdit={setEditingWord}
                      onDelete={confirmDeleteWord}
                    />
                  ))
                )}
              </Card>
            ) : null}
          </>
        )}
      </Screen>

      {effectiveSeasonId ? (
        <Pressable
          onPress={() => setShowAddWord(true)}
          accessibilityRole="button"
          accessibilityLabel="Add Word"
          style={({ pressed }) => [styles.add, { bottom: 16 + insets.bottom, backgroundColor: pressed ? t.primaryHover : t.primary, boxShadow: t.glowPrimaryLg }]}
        >
          <Icon name="plus" size={24} strokeWidth={2} color="#FFFFFF" />
        </Pressable>
      ) : null}

      {isAdmin ? <ManageSeasonsSheet visible={showSeasons} onClose={() => setShowSeasons(false)} seasons={sortedSeasons} counts={counts} /> : null}
      <AddWordModal isOpen={showAddWord} onClose={() => setShowAddWord(false)} />
      <EditWordModal isOpen={!!editingWord} onClose={() => setEditingWord(null)} word={editingWord} />
    </View>
  );
}

// Sizes, gaps and type from MobileWords.dc.html; letter-spacing in em becomes pixels at the text's
// size.
const styles = StyleSheet.create({
  page: { flex: 1 },
  headerBtn: { borderRadius: 14 },
  pressed: { opacity: 0.7 },

  // Season chips: 44 high, 16 across, 8 apart, scrolling sideways edge to edge.
  seasons: { flexGrow: 0, marginHorizontal: -16, marginBottom: 14 },
  seasonsRow: { paddingHorizontal: 16, gap: 8 },
  chip: { height: 44, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: 14, maxWidth: 220 },
  chipCount: { fontFamily: fonts.mono, fontSize: 12 },

  panel: { borderRadius: radius.xl },

  // The word of the day: 20 round, 20/18/16 in, 14 between its parts.
  today: { borderRadius: radius.xl, paddingTop: 20, paddingBottom: 16, gap: 14, overflow: "hidden" },
  cornerLight: { position: "absolute", top: -70, right: -50 },
  todayHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  liveDot: { width: 7, height: 7, borderRadius: radius.pill },
  todayDate: { marginLeft: "auto", fontFamily: fonts.mono, fontSize: 12 },
  todayWord: { gap: 8 },
  bigWord: { fontFamily: fonts.display, fontSize: 32, lineHeight: 35, letterSpacing: -0.64 },
  posPill: { alignSelf: "flex-start", height: 24, paddingHorizontal: 10 },
  meaning: { fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  example: { flexDirection: "row", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderLeftWidth: 3, borderTopLeftRadius: 4, borderBottomLeftRadius: 4, borderTopRightRadius: radius.md, borderBottomRightRadius: radius.md },
  exampleIcon: { marginTop: 2 },
  exampleText: { flex: 1, fontFamily: fonts.body, fontSize: 15, lineHeight: 22.5 },
  translation: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderRadius: radius.md },
  // .04em at 12px.
  translationLabel: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.48, textTransform: "uppercase" },
  translationText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16 },
  author: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12, borderTopWidth: 1 },
  authorText: { flex: 1, minWidth: 0 },
  authorLabel: { fontFamily: fonts.body, fontSize: 13 },
  authorName: { fontFamily: fonts.bodySemibold, fontSize: 14 },
  wordAction: { borderRadius: radius.md },

  // Search: a 48-high glass field, 14 round.
  search: { flexDirection: "row", alignItems: "center", gap: 10, height: 48, paddingLeft: 14, paddingRight: 4, borderWidth: 1, borderRadius: 14, marginBottom: 14 },
  searchInput: { flex: 1, minWidth: 0, height: 44, fontFamily: fonts.body, fontSize: 15 },
  searchClear: { borderRadius: radius.md },

  // Earlier this season: 16/18/6 in; rows at least 66 high, a hairline between them.
  earlier: { paddingBottom: 6 },
  earlierHead: { flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 8 },
  panelTitle: { flex: 1, fontFamily: fonts.display, fontSize: 17 },
  headMono: { fontFamily: fonts.mono, fontSize: 12 },
  wordRow: {},
  wordRowMain: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 66, paddingVertical: 10 },
  wordRowText: { flex: 1, minWidth: 0, gap: 3 },
  wordRowTitle: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  rowWord: { flexShrink: 1, fontFamily: fonts.display, fontSize: 17 },
  rowPos: { flexShrink: 1, fontFamily: fonts.mono, fontSize: 12 },
  rowMeaning: { fontFamily: fonts.body, fontSize: 13 },
  rowMeaningOpen: { fontFamily: fonts.body, fontSize: 14, lineHeight: 21 },
  wordRowSide: { alignItems: "flex-end", gap: 4 },
  rowDate: { fontFamily: fonts.mono, fontSize: 12 },
  wordMore: { gap: 10, paddingBottom: 12 },
  wordMoreFoot: { flexDirection: "row", alignItems: "center", gap: 10 },
  sharedBy: { flex: 1, fontFamily: fonts.body, fontSize: 13 },

  // Add Word: 56 round, 16 from the edge.
  add: { position: "absolute", right: 16, width: 56, height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },

  // The seasons sheet: the rows in one raised list, as the sheet's employee list.
  seasonList: { borderWidth: 1, borderRadius: 14, overflow: "hidden", marginBottom: 16 },
  seasonRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52, paddingHorizontal: 14 },
  seasonName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15 },
  seasonCount: { fontFamily: fonts.mono, fontSize: 12 },
});
