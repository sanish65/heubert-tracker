import { useMemo, useState } from "react";
import { View, Text, Image, Pressable, Modal, ScrollView, Alert, StyleSheet } from "react-native";
import { WebView } from "react-native-webview";
import { useGoBack } from "../lib/useGoBack";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path } from "react-native-svg";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { transformGoogleDriveLink, getGoogleDriveThumbnailUrl, getGoogleDriveEmbedUrl } from "../lib/utils";
import { Screen, ScreenHeader, Card, EmptyState, IconButton, TextField, FormModal } from "../components/ui";
import { SheetNote, SheetActions } from "../components/SheetParts";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";
import AddMemoryModal from "../components/AddMemoryModal";

// Team Memories, in the order of the canvas's MobileMemories.dc.html: the header, the filter chips
// (by the kinds of memory the app stores: photos, videos and messages; the canvas's year and event
// filters have no data behind them, intent.md Out of scope), then the memories in two columns, each
// card going under the shorter column, and Share floating over them. A card opens the memory full
// size; your own carry "Edit or delete". The data and the actions are the ones this screen had
// before the redesign.

const FILTERS = [
  { value: "all", label: "All", icon: "dashboard" },
  { value: "image", label: "Photos", icon: "photo" },
  { value: "video", label: "Videos", icon: "video" },
  { value: "text", label: "Messages", icon: "message-square" },
];

// The full-size view's backdrop, the same in both themes.
const VIEWER_SCRIM = "rgba(4, 6, 12, 0.85)";

// A photo keeps its own shape between these heights (a column is about 173 wide on a 390 phone),
// 200 until it has loaded; a video's frame is 180, as the canvas.
const PHOTO_SHAPE = { start: 173 / 200, tallest: 173 / 260, widest: 173 / 150 };
const VIDEO_HEIGHT = 180;

const plural = (n, word) => `${n} ${n === 1 ? word : `${word}s`}`;

function memoryDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// About how tall a card draws, to place each in the shorter column: the media (or the message's
// lines) and the footer.
function estimateHeight(memory) {
  const footer = 64 + (memory.caption ? 22 : 0);
  if (memory.type === "image") return 200 + footer;
  if (memory.type === "video") return VIDEO_HEIGHT + footer;
  const lines = Math.min(8, Math.ceil(String(memory.content || "").length / 20));
  return 44 + lines * 22 + footer;
}

// Two columns, in order: each memory goes under whichever column is shorter so far.
function intoColumns(memories) {
  const columns = [[], []];
  const heights = [0, 0];
  for (const memory of memories) {
    const i = heights[0] <= heights[1] ? 0 : 1;
    columns[i].push(memory);
    heights[i] += estimateHeight(memory) + 12;
  }
  return columns;
}

function FilterChip({ label, icon, count, active, onPress }) {
  const t = useThemeColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!active }}
      accessibilityLabel={`${label}, ${count}`}
      style={({ pressed }) => [
        styles.chip,
        active ? { backgroundColor: t.primarySoft, borderColor: t.primary } : { backgroundColor: pressed ? t.raised : t.surface, borderColor: t.lineStrong },
      ]}
    >
      <Icon name={icon} size={16} color={active ? t.text1 : t.text2} />
      <Text numberOfLines={1} style={[styles.chipText, { color: active ? t.text1 : t.text2, fontFamily: active ? fonts.bodySemibold : fonts.bodyMedium }]}>
        {label}
      </Text>
      {/* text3 holds on the glass chip; on the tinted chosen one, text2. */}
      <Text style={[styles.mono, { color: active ? t.text2 : t.text3 }]}>{count}</Text>
    </Pressable>
  );
}

// The canvas's play mark: a filled triangle.
function PlayMark({ color, size = 18 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth={1.8} strokeLinejoin="round">
      <Path d="m7 4 13 8-13 8z" />
    </Svg>
  );
}

function PhotoMedia({ memory }) {
  const t = useThemeColors();
  const [shape, setShape] = useState(PHOTO_SHAPE.start);
  const onLoad = (e) => {
    const { width, height } = e.nativeEvent?.source || {};
    if (width > 0 && height > 0) setShape(Math.min(PHOTO_SHAPE.widest, Math.max(PHOTO_SHAPE.tallest, width / height)));
  };
  return (
    <Image
      source={{ uri: transformGoogleDriveLink(memory.content) }}
      alt=""
      onLoad={onLoad}
      resizeMode="cover"
      style={[styles.media, { aspectRatio: shape, backgroundColor: t.raised, borderBottomColor: t.line }]}
    />
  );
}

function VideoMedia({ memory }) {
  const t = useThemeColors();
  const thumbnail = getGoogleDriveThumbnailUrl(memory.content);
  return (
    <View style={[styles.media, styles.video, { backgroundColor: t.raised, borderBottomColor: t.line }]}>
      {thumbnail ? <Image source={{ uri: thumbnail }} alt="" resizeMode="cover" style={StyleSheet.absoluteFill} /> : null}
      <View style={[styles.play, { backgroundColor: t.surfaceStrong, borderColor: t.lineStrong }]}>
        <PlayMark color={t.text1} />
      </View>
      <View style={[styles.videoPill, { backgroundColor: t.pbViolet }]}>
        <Text style={[styles.videoPillText, { color: t.pfViolet }]}>Video</Text>
      </View>
    </View>
  );
}

function MemoryCard({ memory, isMine, onOpen, onEdit, onDelete }) {
  const t = useThemeColors();
  const author = memory.author_name || "Team";
  const subject = memory.caption || (memory.type === "text" ? memory.content : "this memory");

  const offerActions = () =>
    Alert.alert(
      subject,
      undefined,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: onDelete },
        { text: "Edit", onPress: onEdit },
      ],
      { cancelable: true }
    );

  return (
    <Card style={styles.card}>
      <Pressable
        onPress={onOpen}
        accessibilityRole="button"
        accessibilityLabel={`${memory.caption || (memory.type === "text" ? memory.content : memory.type === "video" ? "Video" : "Photo")}, by ${author}`}
        accessibilityHint="Opens the memory"
        style={({ pressed }) => pressed && styles.pressed}
      >
        {memory.type === "image" ? <PhotoMedia memory={memory} /> : null}
        {memory.type === "video" ? <VideoMedia memory={memory} /> : null}
        {memory.type === "text" ? (
          <View style={styles.message}>
            <Icon name="quote" size={22} strokeWidth={1.6} color={t.cyanText} />
            <Text numberOfLines={8} style={[styles.messageText, { color: t.text1 }]}>
              {memory.content}
            </Text>
          </View>
        ) : null}
        {memory.caption ? (
          <Text style={[styles.caption, { color: t.text1 }]}>{memory.caption}</Text>
        ) : null}
      </Pressable>
      <View style={[styles.byline, { marginTop: memory.caption ? 8 : 10 }]}>
        <Avatar name={author} size={26} isMe={isMine} />
        <View style={styles.bylineText}>
          <Text numberOfLines={1} style={[styles.author, { color: t.text2 }]}>
            {author}
          </Text>
          <Text style={[styles.mono, { color: t.text3 }]}>{memoryDate(memory.created_at)}</Text>
        </View>
        {isMine ? (
          <IconButton icon="more" tone="plain" size={44} color={t.text2} onPress={offerActions} accessibilityLabel={`Edit or delete "${subject}"`} style={styles.menu} />
        ) : null}
      </View>
    </Card>
  );
}

// The memory full size: the photo, the playing video or the whole message, then its caption and who
// shared it when.
function MemoryViewer({ memory, onClose }) {
  const t = useThemeColors();
  return (
    <Modal visible={!!memory} animationType="fade" transparent onRequestClose={onClose}>
      <Pressable style={[styles.viewerScrim, { backgroundColor: VIEWER_SCRIM }]} onPress={onClose}>
        {memory ? (
          <Pressable onPress={() => {}} accessible={false} style={[styles.viewer, { backgroundColor: t.surfaceSolid, borderColor: t.lineStrong, borderTopColor: t.glassHi }]}>
            <ScrollView>
              {memory.type === "image" ? (
                <Image source={{ uri: transformGoogleDriveLink(memory.content) }} alt={memory.caption || "Team memory photo"} style={[styles.viewerPhoto, { backgroundColor: t.raised }]} resizeMode="contain" />
              ) : null}
              {memory.type === "video" ? (
                <WebView source={{ uri: getGoogleDriveEmbedUrl(memory.content) || memory.content }} style={styles.viewerVideo} allowsFullscreenVideo />
              ) : null}
              {memory.type === "text" ? (
                <View style={styles.viewerMessage}>
                  <Icon name="quote" size={28} strokeWidth={1.6} color={t.cyanText} />
                  <Text style={[styles.viewerMessageText, { color: t.text1 }]}>{memory.content}</Text>
                </View>
              ) : null}
              <View style={styles.viewerFoot}>
                {memory.caption ? <Text style={[styles.viewerCaption, { color: t.text1 }]}>{memory.caption}</Text> : null}
                <Text style={[styles.viewerMeta, { color: t.text3 }]}>
                  Shared by {memory.author_name || "Team"} · <Text style={styles.mono}>{memoryDate(memory.created_at)}</Text>
                </Text>
              </View>
            </ScrollView>
            <IconButton icon="x" tone="raised" size={44} onPress={onClose} accessibilityLabel="Close" style={[styles.viewerClose, { backgroundColor: t.surfaceStrong }]} />
          </Pressable>
        ) : null}
      </Pressable>
    </Modal>
  );
}

function EditMemoryModal({ memory, onClose, onSave }) {
  const [content, setContent] = useState(memory.content);
  const [caption, setCaption] = useState(memory.caption || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleSave = async () => {
    if (!content.trim()) return setError(memory.type === "text" ? "Please write a message" : "Please provide a media URL");
    setSaving(true);
    setError("");
    try {
      await onSave(memory.id, { content, caption });
      onClose();
    } catch (err) {
      setError(err.message || "Update failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal visible={!!memory} onClose={onClose} title="Edit Memory">
      <TextField label={memory.type === "text" ? "Message" : "Media URL"} value={content} onChangeText={setContent} multiline={memory.type === "text"} />
      <TextField label="Caption (optional)" value={caption} onChangeText={setCaption} />
      {error ? <SheetNote>{error}</SheetNote> : null}
      <SheetActions title={saving ? "Saving..." : "Save Changes"} onPress={handleSave} disabled={saving} onCancel={onClose} />
    </FormModal>
  );
}

export default function MemoriesScreen() {
  const { memories, user, deleteMemory, updateMemory } = useApp();
  const t = useThemeColors();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const counts = useMemo(() => {
    const map = new Map();
    for (const m of memories) map.set(m.type, (map.get(m.type) || 0) + 1);
    return map;
  }, [memories]);

  const columns = useMemo(() => intoColumns(filter === "all" ? memories : memories.filter((m) => m.type === filter)), [memories, filter]);
  const shown = columns[0].length + columns[1].length;

  const confirmDelete = (memory) => {
    Alert.alert("Delete this memory?", "", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteMemory(memory.id);
          } catch (err) {
            Alert.alert("Delete failed", err.message || "Something went wrong");
          }
        },
      },
    ]);
  };

  const renderCard = (memory) => (
    <MemoryCard
      key={memory.id}
      memory={memory}
      isMine={!!user && memory.author_email === user.email}
      onOpen={() => setExpanded(memory)}
      onEdit={() => setEditing(memory)}
      onDelete={() => confirmDelete(memory)}
    />
  );

  return (
    <View style={styles.page}>
      <Screen style={{ paddingBottom: 96 + insets.bottom }}>
        <ScreenHeader title="Team Memories" subtitle={`${memories.length} pinned by the team`} onBack={goBack} />

        {memories.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={styles.filtersRow}>
            {FILTERS.map((f) => (
              <FilterChip
                key={f.value}
                label={f.label}
                icon={f.icon}
                count={f.value === "all" ? memories.length : counts.get(f.value) || 0}
                active={filter === f.value}
                onPress={() => setFilter(f.value)}
              />
            ))}
          </ScrollView>
        ) : null}

        {shown === 0 ? (
          <Card style={styles.panel}>
            <EmptyState icon="image" text={memories.length === 0 ? "No memories shared yet. Be the first to pin one!" : `No ${FILTERS.find((f) => f.value === filter).label.toLowerCase()} yet.`} />
          </Card>
        ) : (
          <View style={styles.grid}>
            <View style={styles.column}>{columns[0].map(renderCard)}</View>
            <View style={styles.column}>{columns[1].map(renderCard)}</View>
          </View>
        )}
      </Screen>

      <Pressable
        onPress={() => setShowAdd(true)}
        accessibilityRole="button"
        accessibilityLabel="Share a memory"
        style={({ pressed }) => [styles.add, { bottom: 16 + insets.bottom, backgroundColor: pressed ? t.primaryHover : t.primary, boxShadow: t.glowPrimaryLg }]}
      >
        <Icon name="plus" size={24} strokeWidth={2} color="#FFFFFF" />
      </Pressable>

      <MemoryViewer memory={expanded} onClose={() => setExpanded(null)} />
      {editing && <EditMemoryModal memory={editing} onClose={() => setEditing(null)} onSave={updateMemory} />}
      <AddMemoryModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
    </View>
  );
}

// Sizes, gaps and type from MobileMemories.dc.html.
const styles = StyleSheet.create({
  page: { flex: 1 },
  mono: { fontFamily: fonts.mono, fontSize: 12 },
  pressed: { opacity: 0.8 },

  // The header's count line, under the title (Back 44 + 12).

  // Filter chips: 44 high, 14 across, 8 apart, scrolling sideways edge to edge.
  filters: { flexGrow: 0, marginHorizontal: -16, marginBottom: 14 },
  filtersRow: { paddingHorizontal: 16, gap: 8 },
  chip: { height: 44, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1 },
  chipText: { fontSize: 14 },

  panel: { borderRadius: radius.xl },

  // Two columns 12 apart; cards 12 apart in each.
  grid: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  column: { flex: 1, minWidth: 0 },
  // A memory: 18 round, its media edge to edge.
  card: { paddingVertical: 0, paddingHorizontal: 0, borderRadius: 18, marginBottom: 12, overflow: "hidden" },
  media: { width: "100%", borderBottomWidth: 1 },
  video: { height: VIDEO_HEIGHT, alignItems: "center", justifyContent: "center" },
  play: { width: 46, height: 46, borderRadius: radius.pill, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  videoPill: { position: "absolute", top: 10, left: 10, height: 22, paddingHorizontal: 8, borderRadius: radius.pill, justifyContent: "center" },
  videoPillText: { fontFamily: fonts.bodySemibold, fontSize: 12 },
  message: { paddingTop: 14, paddingHorizontal: 14, paddingBottom: 4, gap: 8 },
  messageText: { fontFamily: fonts.displayMedium, fontSize: 15, lineHeight: 22 },
  caption: { paddingTop: 10, paddingHorizontal: 12, fontFamily: fonts.bodySemibold, fontSize: 14, lineHeight: 19 },
  // Who shared it: the 26 face, the name and the date, at least 44 high.
  byline: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 44, marginBottom: 10, paddingHorizontal: 12 },
  bylineText: { flex: 1, minWidth: 0 },
  author: { fontFamily: fonts.body, fontSize: 13 },
  menu: { marginRight: -8 },

  // Share: 56 round, 16 in from the edge, its glow.
  add: { position: "absolute", right: 16, width: 56, height: 56, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },

  viewerScrim: { flex: 1, justifyContent: "center", padding: 16 },
  viewer: { maxHeight: "85%", borderRadius: radius.xl, borderWidth: 1, overflow: "hidden" },
  viewerPhoto: { width: "100%", height: 320 },
  viewerVideo: { width: "100%", height: 260 },
  viewerMessage: { padding: 24, paddingTop: 64, gap: 10 },
  viewerMessageText: { fontFamily: fonts.displayMedium, fontSize: 18, lineHeight: 26 },
  viewerFoot: { padding: 16, gap: 4 },
  viewerCaption: { fontFamily: fonts.display, fontSize: 17 },
  viewerMeta: { fontFamily: fonts.body, fontSize: 13 },
  viewerClose: { position: "absolute", top: 10, right: 10, borderRadius: radius.pill },
});
