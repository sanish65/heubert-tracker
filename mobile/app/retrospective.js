import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { View, Text, TextInput, Pressable, Alert, Share, KeyboardAvoidingView, Platform, StyleSheet } from "react-native";
import { useGoBack } from "../lib/useGoBack";
import { formatStamp } from "../lib/dates";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { API_BASE_URL } from "../lib/supabase";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { VOTE_EMOJI, reactionCounts, totalReactions, byVotes, arrangeColumn, boardPeople, timerSecondsLeft, formatClock } from "../lib/retro";
import { Screen, ScreenHeader, Card, SectionTitle, EmptyState, Button, IconButton, TextField, Select, FormModal, Pill } from "../components/ui";
import { SheetNote, SheetActions } from "../components/SheetParts";
import { DetailCardSkeleton } from "../components/Skeleton";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";

// The retrospective, as the canvas's MobileRetro.dc.html: Back to More with Share; the board (its
// title, project and template, ID, the timer the facilitator runs on the web, the people on it, End);
// the columns as tabs, the chosen one's cards most voted first and grouped into the board's themes;
// the action items; and the bar at the bottom that adds a card to the chosen column. The hub before
// a board (create, join) has no artboard and keeps its parts in the same blocks. Every call is the
// one this screen made before the redesign, to the web app's /api/retro: create, join, the poll,
// add, edit and delete a card, react and unreact, end. A vote is the 👍 reaction, counted as the web
// counts it (lib/retro.js). The timer, the themes and the action items are read from the same poll;
// running the timer, naming themes and ticking items stay on the web board.

const POLL_MS = 2500;
const JSON_HEADERS = { "Content-Type": "application/json" };
const PEOPLE_SHOWN = 4;

// Reactions people pick; 👍 is the vote and has its own button.
const REACTION_EMOJIS = ["❤️", "😂", "😮", "🎉", "💡"];

const RETRO_TEMPLATES = {
  // Display order only — see the note in src/components/RetrospectivePage.js. Kept in
  // step with the web board so the same retro reads the same on both. `tone` is the web's:
  // each column takes the colour of the DB column the route files it under.
  standard: [
    { key: "focus", label: "Focus More On", tone: "blue" },
    { key: "improve", label: "Needs Improvement", tone: "amber" },
    { key: "went_well", label: "What Went Well?", tone: "green" },
  ],
  sailboat: [
    { key: "wind", label: "Wind (Pushing us forward)", tone: "green" },
    { key: "anchors", label: "Anchors (Holding us back)", tone: "amber" },
    { key: "rocks", label: "Rocks (Risks ahead)", tone: "blue" },
  ],
  start_stop: [
    { key: "start", label: "Start Doing", tone: "green" },
    { key: "stop", label: "Stop Doing", tone: "amber" },
    { key: "continue", label: "Continue Doing", tone: "blue" },
  ],
};

const TEMPLATE_OPTIONS = [
  { value: "standard", label: "Standard" },
  { value: "sailboat", label: "Sailboat" },
  { value: "start_stop", label: "Start/Stop/Continue" },
];

// A column tone's tinted fill and its text, from the canvas pill set.
const TONES = {
  blue: { fill: "pbBlue", text: "pfBlue" },
  amber: { fill: "pbAmber", text: "pfAmber" },
  green: { fill: "pbGreen", text: "pfGreen" },
};

// The canvas's --glow and --shadow in the theme in use (tokens.js), one shadow each.
function useShadows() {
  const t = useThemeColors();
  return { glow: t.glow[0], card: t.shadowCard[0] };
}

const DECORATIVE = { accessible: false, importantForAccessibility: "no-hide-descendants", accessibilityElementsHidden: true };

const retroUrl = (sid) => `${API_BASE_URL}/api/retro?sessionId=${encodeURIComponent(sid)}`;
const sameName = (a, b) => (a || "").toLowerCase().trim() === (b || "").toLowerCase().trim();
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// "4 minutes 32 seconds", for the timer's spoken label.
function spokenClock(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return [m ? plural(m, "minute", "minutes") : null, plural(s, "second", "seconds")].filter(Boolean).join(" ");
}

// The facilitator's timer, as the web's participants see it: a running one counts down each second
// with the cyan signal; a stopped one holds where it stopped. It ticks on its own so the rest of the
// board does not redraw every second.
function TimerPill({ timerState }) {
  const t = useThemeColors();
  const shadows = useShadows();
  const [now, setNow] = useState(() => Date.now());
  const running = timerState?.status === "running";
  const endTime = timerState?.endTime;

  useEffect(() => {
    if (!running) return undefined;
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const every = setInterval(tick, 1000);
    return () => {
      clearTimeout(first);
      clearInterval(every);
    };
  }, [running, endTime]);

  const seconds = timerSecondsLeft(timerState, now);
  if (seconds === null) return null;
  const live = running && seconds > 0;
  return (
    <View
      accessible
      accessibilityRole="timer"
      accessibilityLabel={`${live ? "Time left" : "Timer stopped at"} ${spokenClock(seconds)}`}
      style={[styles.timer, { borderColor: t.lineStrong, backgroundColor: t.raised }]}
    >
      <View style={[styles.timerDot, live ? { backgroundColor: t.cyan, boxShadow: [shadows.glow] } : { backgroundColor: t.text3 }]} />
      <Text style={[styles.timerText, { color: t.text1 }]}>{formatClock(seconds)}</Text>
    </View>
  );
}

// Who is on the board: up to four faces, overlapping on the panel's solid ring, then "+N".
function People({ names, me }) {
  const t = useThemeColors();
  if (names.length === 0) return null;
  const shown = names.slice(0, PEOPLE_SHOWN);
  const more = names.length - shown.length;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${plural(names.length, "person", "people")} on the board`} style={styles.people}>
      {shown.map((name, i) => (
        <View key={name} style={[styles.face, { borderColor: t.surfaceSolid }, i > 0 && styles.faceOverlap]}>
          <Avatar name={name} size={30} isMe={sameName(name, me)} />
        </View>
      ))}
      {more > 0 ? (
        <View style={[styles.face, styles.faceOverlap, { borderColor: t.surfaceSolid }]}>
          <View style={[styles.more, { backgroundColor: t.raised }]}>
            <Text style={[styles.moreText, { color: t.text2 }]}>{`+${more}`}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

// The board: its title, project and template, the ID; the timer (or Ended); who is on it, your
// part, and End for the host or an admin.
function BoardCard({ session, timerState, people, me, isHost, canEnd, onEnd }) {
  const t = useThemeColors();
  const template = TEMPLATE_OPTIONS.find((o) => o.value === session.template)?.label || "Standard";
  const meta = [session.project?.name, `${template} template`].filter(Boolean).join(" · ");
  const role = isHost ? "You are the host" : session.created_by ? `Hosted by ${session.created_by}` : "";
  return (
    <Card style={styles.board}>
      <View style={styles.boardTop}>
        <View style={styles.boardText}>
          <Text accessibilityRole="header" style={[styles.boardTitle, { color: t.text1 }]}>
            {session.title}
          </Text>
          <View style={styles.boardMeta}>
            <Icon name="folder" size={15} color={t.text2} />
            <Text style={[styles.boardMetaText, { color: t.text2 }]}>{meta}</Text>
          </View>
          <Text selectable style={[styles.boardId, { color: t.text3 }]}>{`ID ${session.id}`}</Text>
        </View>
        {session.is_ended ? <Pill tone="gray">Ended</Pill> : <TimerPill timerState={timerState} />}
      </View>
      <View style={[styles.boardFoot, { borderTopColor: t.line }]}>
        <People names={people} me={me} />
        <Text numberOfLines={1} style={[styles.role, { color: t.text3 }]}>
          {role}
        </Text>
        {canEnd ? (
          <Button title="End" icon="flag" variant="danger" small onPress={onEnd} style={[styles.end, { borderColor: t.lineStrong }]} />
        ) : null}
      </View>
    </Card>
  );
}

// The columns as tabs: each with its card count, the chosen one raised with its tone on the count.
function ColumnTabs({ columns, counts, active, onPick }) {
  const t = useThemeColors();
  const shadows = useShadows();
  return (
    <View accessibilityRole="tablist" accessibilityLabel="Columns" style={[styles.tabs, { borderColor: t.line, borderTopColor: t.glassHi, backgroundColor: t.surface }]}>
      {columns.map((col) => {
        const on = col.key === active;
        const tone = TONES[col.tone];
        return (
          <Pressable
            key={col.key}
            onPress={() => onPick(col.key)}
            accessibilityRole="tab"
            accessibilityLabel={`${col.label}, ${plural(counts[col.key], "card", "cards")}`}
            accessibilityState={{ selected: on }}
            style={({ pressed }) => [
              styles.tab,
              on
                ? { backgroundColor: t.surfaceSolid, borderColor: t.lineStrong, boxShadow: [shadows.card] }
                : { backgroundColor: pressed ? t.raised : "transparent", borderColor: "transparent" },
            ]}
          >
            <Text style={[styles.tabLabel, { color: on ? t.text1 : t.text3 }]}>{col.label}</Text>
            <View style={[styles.tabCount, { backgroundColor: on ? t[tone.fill] : t.raised }]}>
              <Text style={[styles.tabCountText, { color: on ? t[tone.text] : t.text3 }]}>{counts[col.key]}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

// One card: its author, its text, the reactions people picked (each with its emoji and count, yours
// marked), "Add a reaction" and the 👍 vote. Your own card has Edit or delete.
function RetroCard({ card, isMine, counts, mine, pickerOpen, onReact, onTogglePicker, onMenu }) {
  const t = useThemeColors();
  const author = card.author || "Anonymous";
  const votes = counts[VOTE_EMOJI] || 0;
  const voted = mine.has(VOTE_EMOJI);
  const reactions = Object.entries(counts).filter(([emoji]) => emoji !== VOTE_EMOJI);
  return (
    <Card style={styles.card}>
      <View style={styles.cardBy}>
        <Avatar name={author} size={24} isMe={isMine} />
        <Text numberOfLines={1} style={[styles.cardAuthor, { color: t.text2 }]}>
          {author}
        </Text>
        {isMine ? (
          <IconButton icon="more-horizontal" tone="plain" size={44} iconSize={17} onPress={onMenu} accessibilityLabel="Edit or delete your card" style={styles.cardMenu} />
        ) : null}
      </View>
      <Text style={[styles.cardText, { color: t.text1 }]}>{card.content}</Text>
      <View style={styles.cardActions}>
        <View style={styles.reactions}>
          {reactions.map(([emoji, count]) => {
            const picked = mine.has(emoji);
            return (
              <Pressable
                key={emoji}
                onPress={() => onReact(emoji)}
                accessibilityRole="button"
                accessibilityLabel={`${emoji} ${count}, ${picked ? "remove your reaction" : "react"}`}
                accessibilityState={{ selected: picked }}
                style={({ pressed }) => [
                  styles.reaction,
                  { borderColor: picked ? t.primary : t.line, backgroundColor: picked ? t.primarySoft : t.raised },
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text style={[styles.reactionCount, { color: t.text2 }]}>{count}</Text>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onTogglePicker}
            accessibilityRole="button"
            accessibilityLabel="Add a reaction"
            accessibilityState={{ expanded: pickerOpen }}
            style={({ pressed }) => [styles.addReaction, { borderColor: t.lineStrong }, pressed && { backgroundColor: t.raised }]}
          >
            <Icon name="smile-plus" size={17} color={t.text3} />
          </Pressable>
        </View>
        <Pressable
          onPress={() => onReact(VOTE_EMOJI)}
          accessibilityRole="button"
          accessibilityLabel={`${voted ? "Remove your vote" : "Vote for this card"}, ${plural(votes, "vote", "votes")}`}
          accessibilityState={{ selected: voted }}
          style={({ pressed }) => [
            styles.vote,
            voted ? { borderColor: t.primary, backgroundColor: t.primarySoft } : { borderColor: t.lineStrong, backgroundColor: "transparent" },
            pressed && styles.pressed,
          ]}
        >
          <Icon name="thumbs-up" size={16} strokeWidth={2} color={voted ? t.primaryText : t.text2} />
          <Text style={[styles.voteCount, { color: voted ? t.primaryText : t.text2 }]}>{votes}</Text>
        </Pressable>
      </View>
      {pickerOpen ? (
        <View accessibilityLabel="Reactions" style={[styles.picker, { borderTopColor: t.line }]}>
          {REACTION_EMOJIS.map((emoji) => {
            const picked = mine.has(emoji);
            return (
              <Pressable
                key={emoji}
                onPress={() => onReact(emoji, true)}
                accessibilityRole="button"
                accessibilityLabel={`${emoji}, ${picked ? "remove your reaction" : "react"}`}
                accessibilityState={{ selected: picked }}
                style={({ pressed }) => [styles.pickerOption, picked && { backgroundColor: t.primarySoft }, pressed && { backgroundColor: t.raised }]}
              >
                <Text style={styles.pickerEmoji}>{emoji}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </Card>
  );
}

// A theme the facilitator made on the web: its name, how many cards and reactions it holds, its
// cards; on the raised fill with the column's tone down its edge.
function ThemeGroup({ theme, toneColor, children }) {
  const t = useThemeColors();
  return (
    <View accessibilityLabel={`Theme: ${theme.name}`} style={[styles.theme, { borderColor: t.lineStrong, borderLeftColor: toneColor, backgroundColor: t.raised }]}>
      <View style={styles.themeHead}>
        <View {...DECORATIVE} style={[styles.themeIcon, { backgroundColor: t.pbViolet }]}>
          <Icon name="layers" size={17} strokeWidth={1.9} color={t.pfViolet} />
        </View>
        <View style={styles.themeText}>
          <Text style={[styles.themeName, { color: t.text1 }]}>{theme.name}</Text>
          <Text style={[styles.themeMeta, { color: t.text3 }]}>
            {`${plural(theme.cards.length, "card", "cards")} · ${plural(theme.reactions, "reaction", "reactions")}`}
          </Text>
        </View>
      </View>
      {children}
    </View>
  );
}

// The action items the web board keeps for this retro (its own and those carried from the
// project's earlier boards), done ones struck through. Read here; the facilitator ticks them on the
// web.
function ActionItems({ items }) {
  const t = useThemeColors();
  const done = items.filter((i) => i.done_at).length;
  return (
    <Card style={styles.actionsCard}>
      <View style={styles.actionsHead}>
        <SectionTitle style={styles.flushTitle}>Action items</SectionTitle>
        {items.length > 0 ? <Text style={[styles.actionsCount, { color: t.text3 }]}>{`${done} of ${items.length} done`}</Text> : null}
      </View>
      {items.length === 0 ? (
        <EmptyState icon="check-circle" text="No action items yet." />
      ) : (
        items.map((item) => {
          const isDone = Boolean(item.done_at);
          const date = isDone ? formatStamp(item.done_at) : "";
          const meta = [item.owner_name, item.origin_title ? `from ${item.origin_title}` : null].filter(Boolean).join(" · ");
          return (
            <View
              key={item.id}
              accessible
              accessibilityLabel={[item.content, isDone ? "done" : "open", meta, date ? `done ${date}` : null].filter(Boolean).join(", ")}
              style={[styles.item, { borderTopColor: t.line }]}
            >
              <View style={[styles.itemMark, isDone ? { backgroundColor: t.primary, borderColor: t.primary } : { borderColor: t.lineStrong }]}>
                {isDone ? <Icon name="check" size={14} strokeWidth={3} color="#FFFFFF" /> : null}
              </View>
              <View style={styles.itemText}>
                <Text style={[styles.itemContent, isDone ? { color: t.text3, textDecorationLine: "line-through" } : { color: t.text1 }]}>{item.content}</Text>
                {meta || date ? (
                  <Text style={[styles.itemMeta, { color: t.text3 }]}>
                    {meta}
                    {meta && date ? " · " : ""}
                    {date ? <Text style={styles.itemDate}>{`Done ${date}`}</Text> : null}
                  </Text>
                ) : null}
              </View>
            </View>
          );
        })
      )}
    </Card>
  );
}

// The bar at the bottom that adds a card to the chosen column, on the opaque bar fill over the ink.
function Composer({ column, value, onChange, onAdd }) {
  const t = useThemeColors();
  const insets = useSafeAreaInsets();
  const tone = TONES[column.tone];
  const empty = !value.trim();
  return (
    <View style={{ backgroundColor: t.ink }}>
      <View style={[styles.composer, { backgroundColor: t.surfaceStrong, borderTopColor: t.line, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.composerLabel}>
          <View {...DECORATIVE} style={[styles.composerDot, { backgroundColor: t[tone.text] }]} />
          <Text numberOfLines={1} style={[styles.composerLabelText, { color: t.text3 }]}>{`Adding to · ${column.label}`}</Text>
        </View>
        <View style={styles.composerRow}>
          <TextInput
            value={value}
            onChangeText={onChange}
            placeholder="Add a card…"
            placeholderTextColor={t.text3}
            accessibilityLabel={`Add a card to ${column.label}`}
            returnKeyType="send"
            onSubmitEditing={onAdd}
            style={[styles.composerInput, { borderColor: t.lineStrong, backgroundColor: t.raised, color: t.text1 }]}
          />
          <Pressable
            onPress={onAdd}
            disabled={empty}
            accessibilityRole="button"
            accessibilityLabel="Add card"
            accessibilityState={{ disabled: empty }}
            style={({ pressed }) => [
              styles.send,
              { backgroundColor: pressed ? t.primaryHover : t.primary, opacity: empty ? 0.45 : 1 },
              !empty && { boxShadow: t.glowPrimary },
            ]}
          >
            <Icon name="send" size={19} strokeWidth={2} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const EMPTY_ITEMS = { carried: [], own: [] };

export default function RetrospectiveScreen() {
  const { currentEmployee, user, isAdmin, projects: allProjects } = useApp();
  const t = useThemeColors();
  const goBack = useGoBack();
  const loggedInName = currentEmployee?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
  const projects = allProjects.filter((p) => p.status !== "archived");

  const [view, setView] = useState("home");
  const [sessionTitle, setSessionTitle] = useState("");
  const [creatorName, setCreatorName] = useState(loggedInName);
  const [joinName, setJoinName] = useState(loggedInName);
  const [joinSessionId, setJoinSessionId] = useState("");
  const [template, setTemplate] = useState("standard");
  const [projectId, setProjectId] = useState(null);
  const [session, setSession] = useState(null);
  const [cards, setCards] = useState([]);
  const [cardReactions, setCardReactions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [timerState, setTimerState] = useState(null);
  const [actionItems, setActionItems] = useState(EMPTY_ITEMS);
  const [themes, setThemes] = useState([]);
  const [themeCards, setThemeCards] = useState([]);
  const [reactionPickerFor, setReactionPickerFor] = useState(null);
  const [participantName, setParticipantName] = useState("");
  const [isHost, setIsHost] = useState(false);
  // Which hub form is working ("create" or "join"), and the last error with the form it belongs to.
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [activeCol, setActiveCol] = useState(null);
  const [composeText, setComposeText] = useState("");
  const [editingCardId, setEditingCardId] = useState(null);
  const [editText, setEditText] = useState("");
  const pollRef = useRef(null);

  const canEndSession = isHost || !!isAdmin;

  // Everything one read of the board hands back. A create starts from an empty board.
  const takeBoard = useCallback((data) => {
    setSession(data.session);
    setCards(data.cards || []);
    setCardReactions(data.cardReactions || []);
    setActivity(data.activity || []);
    setTimerState(data.timerState || null);
    setActionItems(data.actionItems || EMPTY_ITEMS);
    setThemes(data.themes || []);
    setThemeCards(data.themeCards || []);
  }, []);

  const fetchBoard = useCallback(
    async (sid) => {
      try {
        const res = await fetch(retroUrl(sid));
        if (!res.ok) return;
        takeBoard(await res.json());
      } catch (_) {}
    },
    [takeBoard]
  );

  const startPolling = useCallback(
    (sid) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => fetchBoard(sid), POLL_MS);
    },
    [fetchBoard]
  );

  useEffect(() => () => pollRef.current && clearInterval(pollRef.current), []);

  // One pass over the board's reactions, by card, for the counts every card shows.
  const reactionsByCard = useMemo(() => {
    const byCard = new Map();
    for (const r of cardReactions) {
      const key = String(r.card_id);
      if (!byCard.has(key)) byCard.set(key, []);
      byCard.get(key).push(r);
    }
    return byCard;
  }, [cardReactions]);

  const handleCreate = async () => {
    if (!sessionTitle.trim() || !creatorName.trim()) return setError({ form: "create", message: "Please enter your name and a session title." });
    if (!projectId) return setError({ form: "create", message: "Please choose the project this retro is for." });
    setLoading("create");
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/retro`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "create", title: sessionTitle.trim(), createdBy: creatorName.trim(), template, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      takeBoard({ session: data.session });
      setView("board");
      setIsHost(true);
      setParticipantName(creatorName.trim());
      startPolling(data.session.id);
    } catch (e) {
      setError({ form: "create", message: e.message });
    } finally {
      setLoading(null);
    }
  };

  const handleJoin = async () => {
    if (!joinName.trim() || !joinSessionId.trim()) return setError({ form: "join", message: "Please enter your name and the session ID." });
    setLoading("join");
    setError(null);
    try {
      const res = await fetch(retroUrl(joinSessionId.trim()));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Session not found");
      takeBoard(data);
      setParticipantName(joinName.trim());
      setIsHost(data.session.created_by === joinName.trim());
      setView("board");
      startPolling(joinSessionId.trim());
    } catch (e) {
      setError({ form: "join", message: e.message });
    } finally {
      setLoading(null);
    }
  };

  const handlePin = async (colKey) => {
    if (!composeText.trim() || !session) return;
    const text = composeText.trim();
    setComposeText("");
    try {
      await fetch(`${API_BASE_URL}/api/retro`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "add_card", sessionId: session.id, columnType: colKey, content: text, author: participantName }),
      });
      await fetchBoard(session.id);
    } catch (_) {}
  };

  const closeEdit = () => {
    setEditingCardId(null);
    setEditText("");
  };

  const handleEditCard = async (cardId) => {
    if (!editText.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/retro`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "edit_card", cardId, content: editText, author: participantName }),
      });
      if (res.ok) {
        setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, content: editText.trim() } : c)));
        closeEdit();
      }
    } catch (_) {}
  };

  const handleDelete = async (cardId) => {
    try {
      await fetch(`${API_BASE_URL}/api/retro?cardId=${encodeURIComponent(cardId)}`, { method: "DELETE" });
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    } catch (_) {}
  };

  const hasReacted = (cardId, emoji) =>
    cardReactions.some((r) => String(r.card_id) === String(cardId) && r.participant_name === participantName && r.emoji === emoji);

  const handleReact = async (cardId, emoji) => {
    if (!participantName) return;
    const already = hasReacted(cardId, emoji);
    setCardReactions((prev) =>
      already
        ? prev.filter((r) => !(String(r.card_id) === String(cardId) && r.participant_name === participantName && r.emoji === emoji))
        : [...prev, { card_id: cardId, participant_name: participantName, emoji }]
    );
    try {
      await fetch(`${API_BASE_URL}/api/retro`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: already ? "unreact_card" : "react_card", cardId, sessionId: session.id, participantName, emoji }),
      });
    } catch (_) {}
  };

  // Leaves the board for the hub; the poll stops, and the board's state goes with it: a draft, the
  // open column, an edit or a reaction picker never carries over to the next board.
  const exitToHub = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setView("home");
    takeBoard({ session: null });
    setComposeText("");
    setActiveCol(null);
    setEditingCardId(null);
    setEditText("");
    setReactionPickerFor(null);
  };

  const handleEndSession = () => {
    Alert.alert("End this session?", "This will lock the board for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Session",
        style: "destructive",
        onPress: async () => {
          // Back to the hub only once the server has ended it; a refusal or no connection says so.
          try {
            const res = await fetch(`${API_BASE_URL}/api/retro`, {
              method: "POST",
              headers: JSON_HEADERS,
              body: JSON.stringify({ action: "end_session", sessionId: session.id }),
            });
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              Alert.alert("Session not ended", data.error || `The server refused (HTTP ${res.status}).`);
              return;
            }
            exitToHub();
          } catch (e) {
            Alert.alert("Session not ended", e?.message || "Check your connection and try again.");
          }
        },
      },
    ]);
  };

  // The canvas's one control on your card: Edit opens the card's sheet, Delete removes it.
  const offerCardMenu = (card) =>
    Alert.alert("Your card", card.content, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => handleDelete(card.id) },
      {
        text: "Edit",
        onPress: () => {
          setEditingCardId(card.id);
          setEditText(card.content);
        },
      },
    ]);

  // The phone's share sheet: the board, the web app's link to it, and the ID to join with here.
  const shareBoard = async () => {
    if (!session) return;
    const link = API_BASE_URL ? `${API_BASE_URL}/retrospective/${encodeURIComponent(session.id)}` : "";
    try {
      await Share.share({ message: [session.title, link, `Session ID: ${session.id}`].filter(Boolean).join("\n") });
    } catch (_) {}
  };

  if (view === "home") {
    return (
      <Screen>
        <ScreenHeader title="Retrospective" onBack={goBack} />

        <Card style={styles.panel}>
          <SectionTitle>Create Session</SectionTitle>
          <TextField label="Your Name" value={creatorName} onChangeText={setCreatorName} />
          <TextField label="Session Title" value={sessionTitle} onChangeText={setSessionTitle} placeholder="e.g. Sprint 24 Retro" />
          <Select label="Project" value={projectId} onSelect={setProjectId} options={projects.map((p) => ({ value: p.id, label: p.name }))} />
          <Select label="Template" value={template} onSelect={setTemplate} options={TEMPLATE_OPTIONS} />
          {error?.form === "create" ? <SheetNote>{error.message}</SheetNote> : null}
          <Button title={loading === "create" ? "Creating..." : "Create Session"} icon="plus" onPress={handleCreate} disabled={loading !== null} />
        </Card>

        <Card style={styles.panel}>
          <SectionTitle>Join Session</SectionTitle>
          <TextField label="Your Name" value={joinName} onChangeText={setJoinName} />
          <TextField label="Session ID" value={joinSessionId} onChangeText={setJoinSessionId} placeholder="Paste session ID here" style={styles.idInput} />
          {error?.form === "join" ? <SheetNote>{error.message}</SheetNote> : null}
          <Button title={loading === "join" ? "Joining..." : "Join Session"} variant="secondary" icon="link" onPress={handleJoin} disabled={loading !== null} />
        </Card>
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <ScreenHeader title="Retrospective" onBack={goBack} />
        <DetailCardSkeleton />
      </Screen>
    );
  }

  const columns = RETRO_TEMPLATES[session.template] || RETRO_TEMPLATES.standard;
  const column = columns.find((c) => c.key === activeCol) || columns[0];
  const toneColor = t[TONES[column.tone].text];
  const counts = Object.fromEntries(columns.map((c) => [c.key, cards.filter((card) => card.column_type === c.key).length]));
  const colCards = cards.filter((c) => c.column_type === column.key).sort(byVotes(cardReactions));
  const arranged = arrangeColumn({ cards: colCards, themes, themeCards, reactionsFor: (id) => totalReactions(cardReactions, id) });
  const typing = activity.filter((a) => a.column_type === column.key && a.participant_name !== participantName);
  const people = boardPeople({ me: participantName, cards, reactions: cardReactions, activity });
  const items = [...(actionItems.carried || []), ...(actionItems.own || [])];

  const renderCard = (card) => {
    const own = reactionsByCard.get(String(card.id)) || [];
    const mine = new Set(own.filter((r) => r.participant_name === participantName).map((r) => r.emoji));
    return (
      <RetroCard
        key={card.id}
        card={card}
        isMine={sameName(card.author, participantName)}
        counts={reactionCounts(own, card.id)}
        mine={mine}
        pickerOpen={reactionPickerFor === card.id}
        onReact={(emoji, fromPicker) => {
          handleReact(card.id, emoji);
          if (fromPicker) setReactionPickerFor(null);
        }}
        onTogglePicker={() => setReactionPickerFor(reactionPickerFor === card.id ? null : card.id)}
        onMenu={() => offerCardMenu(card)}
      />
    );
  };

  return (
    <KeyboardAvoidingView style={styles.page} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <Screen>
        <ScreenHeader
          title="Retrospective"
          onBack={goBack}
          right={<IconButton icon="share" size={44} iconSize={19} color={t.text1} onPress={shareBoard} accessibilityLabel="Share board link" style={styles.headerBtn} />}
        />

        <BoardCard
          session={session}
          timerState={timerState}
          people={people}
          me={participantName}
          isHost={isHost}
          canEnd={canEndSession && !session.is_ended}
          onEnd={handleEndSession}
        />

        <ColumnTabs columns={columns} counts={counts} active={column.key} onPick={setActiveCol} />

        <View accessibilityLabel={column.label} style={styles.column}>
          <View style={styles.columnHead}>
            <View {...DECORATIVE} style={[styles.columnDot, { backgroundColor: toneColor }]} />
            <Text accessibilityRole="header" style={[styles.columnTitle, { color: t.text1 }]}>
              {column.label}
            </Text>
            <Text style={[styles.columnNote, { color: t.text2 }]}>Most voted</Text>
          </View>

          {arranged.themes.map((theme) => (
            <ThemeGroup key={theme.id} theme={theme} toneColor={toneColor}>
              {theme.cards.map(renderCard)}
            </ThemeGroup>
          ))}

          {arranged.themes.length > 0 && arranged.loose.length > 0 ? (
            <Text style={[styles.looseLabel, { color: t.text2 }]}>Not grouped yet</Text>
          ) : null}

          {arranged.loose.map(renderCard)}

          {typing.map((a) => (
            <View key={`typing-${a.participant_name}`} accessibilityLiveRegion="polite" style={[styles.typing, { borderColor: t.lineStrong }]}>
              <Icon name="more-horizontal" size={16} strokeWidth={2.4} color={t.pageEyebrow} />
              <Text style={[styles.typingText, { color: t.text2 }]}>{`${a.participant_name} is writing a card…`}</Text>
            </View>
          ))}

          {colCards.length === 0 && typing.length === 0 ? (
            <Card style={styles.emptyColumn}>
              <EmptyState icon="message-square" text="No cards yet." />
            </Card>
          ) : null}
        </View>

        <ActionItems items={items} />

        <Button title="Exit to Hub" variant="ghost" icon="arrow-left" onPress={exitToHub} />
      </Screen>

      {!session.is_ended ? <Composer column={column} value={composeText} onChange={setComposeText} onAdd={() => handlePin(column.key)} /> : null}

      <FormModal visible={editingCardId !== null} onClose={closeEdit} title="Edit card">
        <TextField label="Card" value={editText} onChangeText={setEditText} multiline autoFocus />
        <SheetActions title="Save" onPress={() => handleEditCard(editingCardId)} disabled={!editText.trim()} onCancel={closeEdit} />
      </FormModal>
    </KeyboardAvoidingView>
  );
}

// Sizes, gaps and type from MobileRetro.dc.html: 20-radius glass sections 14 apart; cards 16 round,
// 10 apart; every control 44 to the finger. letter-spacing in em becomes pixels at the text's size
// (.06em at 12px is 0.72).
const styles = StyleSheet.create({
  page: { flex: 1 },
  pressed: { opacity: 0.8 },
  headerBtn: { borderRadius: 14 },
  flushTitle: { flex: 1, marginBottom: 0 },

  // The hub.
  panel: { borderRadius: radius.xl },
  idInput: { fontFamily: fonts.mono, fontSize: 13 },

  // The board: 12 between its top and its foot; the foot on a hairline, 12 above.
  board: { borderRadius: radius.xl, gap: 12 },
  boardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  boardText: { flex: 1, minWidth: 0, gap: 4 },
  boardTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26.4 },
  boardMeta: { flexDirection: "row", alignItems: "center", gap: 6 },
  boardMetaText: { flexShrink: 1, fontFamily: fonts.body, fontSize: 13 },
  boardId: { fontFamily: fonts.mono, fontSize: 12 },
  timer: { flexDirection: "row", alignItems: "center", gap: 7, height: 32, paddingHorizontal: 10, borderRadius: radius.pill, borderWidth: 1 },
  timerDot: { width: 7, height: 7, borderRadius: radius.pill },
  timerText: { fontFamily: fonts.monoMedium, fontSize: 13, fontVariant: ["tabular-nums"] },
  boardFoot: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 12, borderTopWidth: 1 },
  people: { flexDirection: "row", alignItems: "center" },
  face: { borderWidth: 2, borderRadius: radius.pill },
  faceOverlap: { marginLeft: -8 },
  more: { width: 30, height: 30, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  moreText: { fontFamily: fonts.mono, fontSize: 12 },
  role: { flex: 1, fontFamily: fonts.body, fontSize: 13 },
  end: { minHeight: 44, borderRadius: radius.md },

  // The column tabs: a glass track 4 in, tabs 60 high and 12 round, 4 apart.
  tabs: { flexDirection: "row", gap: 4, padding: 4, marginBottom: 14, borderWidth: 1, borderRadius: radius.lg },
  tab: { flex: 1, minWidth: 0, minHeight: 60, padding: 6, gap: 4, borderWidth: 1, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  tabLabel: { fontFamily: fonts.bodySemibold, fontSize: 13, lineHeight: 15.6, textAlign: "center" },
  tabCount: { minWidth: 22, height: 20, paddingHorizontal: 6, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  tabCountText: { fontFamily: fonts.monoMedium, fontSize: 12 },

  // The chosen column: its head on the page, then its themes, cards and who is writing, 10 apart.
  column: { gap: 10, marginBottom: 14 },
  columnHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  columnDot: { width: 8, height: 8, borderRadius: 3 },
  columnTitle: { flex: 1, fontFamily: fonts.display, fontSize: 17 },
  columnNote: { fontFamily: fonts.mono, fontSize: 12 },
  looseLabel: { paddingTop: 4, paddingHorizontal: 2, fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.72, textTransform: "uppercase" },
  emptyColumn: { marginBottom: 0 },

  theme: { gap: 10, padding: 12, borderWidth: 1, borderLeftWidth: 3, borderRadius: 18 },
  themeHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  themeIcon: { width: 32, height: 32, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  themeText: { flex: 1, minWidth: 0, gap: 1 },
  themeName: { fontFamily: fonts.display, fontSize: 16 },
  themeMeta: { fontFamily: fonts.mono, fontSize: 12 },

  // A card: 12 by 14 in, 8 between its rows.
  card: { borderRadius: radius.lg, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 0, gap: 8 },
  cardBy: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 26 },
  cardAuthor: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13 },
  cardMenu: { marginVertical: -10, marginRight: -10, borderRadius: radius.md },
  cardText: { fontFamily: fonts.body, fontSize: 15, lineHeight: 21.75 },
  cardActions: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  reactions: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reaction: { flexDirection: "row", alignItems: "center", gap: 5, height: 44, paddingHorizontal: 10, borderWidth: 1, borderRadius: radius.pill },
  reactionEmoji: { fontSize: 15 },
  reactionCount: { fontFamily: fonts.mono, fontSize: 12 },
  addReaction: { width: 44, height: 44, borderWidth: 1, borderStyle: "dashed", borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  vote: { flexDirection: "row", alignItems: "center", gap: 6, height: 44, paddingHorizontal: 12, borderWidth: 1, borderRadius: radius.md },
  voteCount: { fontFamily: fonts.monoMedium, fontSize: 13 },
  picker: { flexDirection: "row", flexWrap: "wrap", gap: 4, paddingTop: 8, borderTopWidth: 1 },
  pickerOption: { width: 44, height: 44, borderRadius: radius.pill, alignItems: "center", justifyContent: "center" },
  pickerEmoji: { fontSize: 20 },

  typing: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderStyle: "dashed", borderRadius: radius.lg },
  typingText: { flex: 1, fontFamily: fonts.body, fontSize: 13 },

  // Action items: rows 60 high on a hairline.
  actionsCard: { borderRadius: radius.xl, gap: 6 },
  actionsHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 },
  actionsCount: { fontFamily: fonts.mono, fontSize: 12 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 60, borderTopWidth: 1 },
  itemMark: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  itemText: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 8 },
  itemContent: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  itemMeta: { fontFamily: fonts.body, fontSize: 13 },
  itemDate: { fontFamily: fonts.mono, fontSize: 12 },

  // The bar: 12 above, 16 to the sides, the bottom inset (at least 12) under it; 8 between its rows.
  composer: { paddingTop: 12, paddingHorizontal: 16, gap: 8, borderTopWidth: 1 },
  composerLabel: { flexDirection: "row", alignItems: "center", gap: 6 },
  composerDot: { width: 7, height: 7, borderRadius: 2 },
  composerLabelText: { flexShrink: 1, fontFamily: fonts.mono, fontSize: 12 },
  composerRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  composerInput: { flex: 1, minWidth: 0, height: 48, paddingHorizontal: 14, borderWidth: 1, borderRadius: 14, fontFamily: fonts.body, fontSize: 15 },
  send: { width: 48, height: 48, borderRadius: 14, alignItems: "center", justifyContent: "center" },
});
