import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Pressable, Alert, Share, Clipboard, AccessibilityInfo, StyleSheet } from "react-native";
import { useGoBack } from "../lib/useGoBack";
import { formatStamp } from "../lib/dates";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useApp } from "../context/AppContext";
import { API_BASE_URL } from "../lib/supabase";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { FIBONACCI, hasVoted, summariseVotes, pointsLabel, estimateTitle } from "../lib/poker";
import { Screen, ScreenHeader, Card, SectionTitle, Eyebrow, EmptyState, Button, IconButton, TextField } from "../components/ui";
import { SheetNote } from "../components/SheetParts";
import { DetailCardSkeleton } from "../components/Skeleton";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";

// Planning poker, as the canvas's MobilePoker.dc.html: Back to More with Share, the session (its
// status, title, who hosts it and the ID to copy), the participants and who has voted, your
// estimate and the deck, the results once revealed, and the host's Publish Results / New Round
// pinned to the bottom. The hub before a session (create, join, the active sessions) has no artboard
// and keeps its parts in the same blocks. Every call is the one this screen made before the
// redesign, to the web app's /api/poker: create, join, vote, reveal, reset, end and the poll. The
// host (who created the session) reveals and starts new rounds; the host or an admin ends it.

const POLL_MS = 2000;
const COPIED_MS = 2000;
const SEATS_PER_ROW = 4;
const CARDS_PER_ROW = 4;
const JSON_HEADERS = { "Content-Type": "application/json" };

const pokerUrl = (sid) => `${API_BASE_URL}/api/poker?sessionId=${encodeURIComponent(sid)}`;

// The canvas's --glow, --shadow and --shadow-lift in the theme in use (tokens.js), one shadow
// each, so a card can stack two.
function useShadows() {
  const t = useThemeColors();
  return { glow: t.glow[0], card: t.shadowCard[0], lift: t.shadowLift[0] };
}

const DECORATIVE = { accessible: false, importantForAccessibility: "no-hide-descendants", accessibilityElementsHidden: true };

const firstName = (name) => name.trim().split(/\s+/)[0] || name;

// Splits a list into rows of `size`, for the four-across grids.
function rowsOf(list, size) {
  const rows = [];
  for (let i = 0; i < list.length; i += size) rows.push(list.slice(i, i + size));
  return rows;
}

// One of the active sessions on the hub: its title, who started it and when.
function RecentSession({ session, onPress }) {
  const t = useThemeColors();
  const date = formatStamp(session.created_at);
  const by = session.created_by ? `By ${session.created_by}` : "";
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[`Join ${session.title}`, by, date].filter(Boolean).join(", ")}
      style={({ pressed }) => [styles.recentRow, { borderTopColor: t.line }, pressed && styles.pressed]}
    >
      <View style={styles.recentText}>
        <Text numberOfLines={1} style={[styles.recentTitle, { color: t.text1 }]}>
          {session.title}
        </Text>
        <Text numberOfLines={1} style={[styles.recentMeta, { color: t.text3 }]}>
          {by}
          {by && date ? " · " : ""}
          {date ? <Text style={styles.mono}>{date}</Text> : null}
        </Text>
      </View>
      <Icon name="chevron-right" size={18} color={t.text3} />
    </Pressable>
  );
}

// The canvas's status pill with its dot: amber while voting, green once revealed.
function StatusPill({ revealed }) {
  const t = useThemeColors();
  const color = revealed ? t.pfGreen : t.pfAmber;
  return (
    <View style={[styles.status, { backgroundColor: revealed ? t.pbGreen : t.pbAmber }]}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{revealed ? "Revealed" : "In Progress"}</Text>
    </View>
  );
}

// The session being estimated: its status, its title, who hosts it and your part in it, the ID
// with its copy button.
function SessionCard({ session, role, copied, onCopy }) {
  const t = useThemeColors();
  return (
    <Card style={styles.story}>
      <StatusPill revealed={session.revealed} />
      <Text accessibilityRole="header" style={[styles.storyTitle, { color: t.text1 }]}>
        {session.title}
      </Text>
      <View style={[styles.storyFoot, { borderTopColor: t.line }]}>
        <View style={styles.storyMeta}>
          <Text numberOfLines={1} style={[styles.storyRole, { color: t.text2 }]}>
            {session.created_by ? `By ${session.created_by} · ${role}` : role}
          </Text>
          <Text numberOfLines={1} style={[styles.storyId, { color: t.text3 }]}>
            {`ID ${session.id}`}
          </Text>
        </View>
        <IconButton
          icon={copied ? "check" : "copy"}
          tone="raised"
          size={44}
          color={t.text2}
          onPress={onCopy}
          accessibilityLabel={copied ? "Session ID copied" : "Copy session ID"}
          style={[styles.copy, { borderColor: t.lineStrong }]}
        />
      </View>
    </Card>
  );
}

// A person at the table: their avatar (yours ringed orange), a check once they have voted, the
// amber dots while they think, their card on the avatar once revealed.
function Seat({ vote, revealed, isMe }) {
  const t = useThemeColors();
  const name = vote.participant_name || "";
  const voted = hasVoted(vote);
  const label = `${name}${isMe ? " (you)" : ""}: ${voted ? (revealed ? `voted ${vote.vote}` : "has voted") : "has not voted"}`;
  return (
    <View accessible accessibilityLabel={label} style={styles.seat}>
      <View style={[styles.seatAvatar, isMe && { boxShadow: [{ offsetX: 0, offsetY: 0, blurRadius: 0, spreadDistance: 2, color: t.orangeSoft }] }]}>
        <Avatar name={name} size={46} isMe={isMe} />
        {voted && revealed ? (
          <View style={[styles.voteBadge, { backgroundColor: t.surfaceSolid, borderColor: t.cyan }]}>
            <Text numberOfLines={1} style={[styles.voteBadgeText, { color: t.text1 }]}>
              {vote.vote}
            </Text>
          </View>
        ) : (
          <View style={[styles.stateBadge, { backgroundColor: t.surfaceSolid, borderColor: t.lineStrong }]}>
            <Icon name={voted ? "check" : "more-horizontal"} size={12} strokeWidth={3} color={voted ? t.pfGreen : t.pfAmber} />
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={[styles.seatName, { color: voted ? t.text1 : t.text3 }]}>
        {isMe ? "You" : firstName(name)}
      </Text>
    </View>
  );
}

function Participants({ votes, revealed, me, votedCount }) {
  const t = useThemeColors();
  return (
    <Card style={styles.participants}>
      <View style={styles.head}>
        <SectionTitle style={styles.flushTitle}>Participants</SectionTitle>
        <Text style={[styles.headNote, { color: t.text2 }]}>{`${votedCount} of ${votes.length} voted`}</Text>
      </View>
      {votes.length === 0 ? (
        <EmptyState icon="users" text="Waiting for participants to vote…" />
      ) : (
        <View style={styles.seats}>
          {rowsOf(votes, SEATS_PER_ROW).map((row) => (
            <View key={row[0].id} style={styles.seatRow}>
              {row.map((v) => (
                <Seat key={v.id} vote={v} revealed={revealed} isMe={Boolean(me) && v.participant_name === me} />
              ))}
              {Array.from({ length: SEATS_PER_ROW - row.length }, (_, i) => (
                <View key={`empty-${i}`} style={styles.seat} />
              ))}
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}

// The card you hold, large, beside what it means and what happens next.
function Estimate({ card, revealed, isHost }) {
  const t = useThemeColors();
  const shadows = useShadows();
  const held = card !== null;
  const face = held ? card : "–";
  let hint = held ? "Hidden until the host reveals. Tap another card to change." : "Pick a card below. Nobody sees it until the reveal.";
  if (revealed) hint = isHost ? "Votes are revealed. Start a new round to vote again." : "Votes are revealed.";
  return (
    <Card style={styles.estimate}>
      <View
        {...DECORATIVE}
        style={[
          styles.preview,
          held
            ? { borderColor: t.cyan, backgroundColor: t.primarySoft, boxShadow: [shadows.glow, shadows.lift] }
            : { borderColor: t.lineStrong, backgroundColor: t.raised },
        ]}
      >
        <Text style={[styles.previewCorner, styles.previewCornerTop, { color: t.text3 }]}>{face}</Text>
        <Text style={[styles.previewValue, { color: t.text1 }]}>{face}</Text>
        <Text style={[styles.previewCorner, styles.previewCornerBottom, { color: t.text3 }]}>{face}</Text>
      </View>
      <View style={styles.estimateText}>
        <Eyebrow style={styles.estimateEyebrow}>Your estimate</Eyebrow>
        <Text style={[styles.estimateTitle, { color: t.text1 }]}>{estimateTitle(card)}</Text>
        <Text style={[styles.estimateHint, { color: t.text3 }]}>{hint}</Text>
      </View>
    </Card>
  );
}

// One card of the deck. The chosen one lifts, on a cyan edge with its glow; the others are glass
// with the canvas's inner top highlight.
function DeckCard({ value, chosen, onPress }) {
  const t = useThemeColors();
  const shadows = useShadows();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={pointsLabel(value)}
      accessibilityState={{ checked: chosen }}
      style={({ pressed }) => [
        styles.card,
        chosen
          ? { borderColor: t.cyan, backgroundColor: t.primarySoft, boxShadow: [shadows.glow, shadows.lift], transform: [{ translateY: -8 }] }
          : { borderColor: t.lineStrong, backgroundColor: t.surface, boxShadow: [shadows.card] },
        pressed && styles.pressed,
      ]}
    >
      {chosen ? null : <View style={[styles.cardHi, { backgroundColor: t.glassHi }]} />}
      {/* The card sits straight on the aurora, so the chosen corner takes the page's cyan. */}
      <Text style={[styles.cardCorner, { color: chosen ? t.pageEyebrow : t.text3 }]}>{String(value)}</Text>
      <Text style={[styles.cardValue, { color: t.text1 }]}>{String(value)}</Text>
    </Pressable>
  );
}

// "Pick a card": the Fibonacci deck four across, drawn on the page.
function Deck({ card, onVote }) {
  const t = useThemeColors();
  return (
    <View style={styles.deck}>
      <View style={styles.deckHead}>
        <SectionTitle style={styles.flushTitle}>Pick a card</SectionTitle>
        <Text style={[styles.deckNote, { color: t.text2 }]}>Fibonacci</Text>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel="Pick a card" style={styles.deckGrid}>
        {rowsOf(FIBONACCI, CARDS_PER_ROW).map((row) => (
          <View key={String(row[0])} style={styles.deckRow}>
            {row.map((value) => (
              <DeckCard key={String(value)} value={value} chosen={card === String(value)} onPress={() => onVote(value)} />
            ))}
            {Array.from({ length: CARDS_PER_ROW - row.length }, (_, i) => (
              <View key={`empty-${i}`} style={styles.cardSpacer} />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

// The revealed round, as the web's: the average, the card nearest it, the votes each card got.
function Results({ summary }) {
  const t = useThemeColors();
  const shadows = useShadows();
  const { average, nearestFib, perCard } = summary;
  const votesText = (n) => `${n} ${n === 1 ? "vote" : "votes"}`;
  return (
    <Card style={[styles.results, { borderColor: t.cyan, borderTopColor: t.cyan }]}>
      <SectionTitle style={styles.flushTitle}>Results</SectionTitle>
      <View
        accessible
        accessibilityLabel={`Average Story Points ${average ?? "none"}${nearestFib !== null ? `, nearest card ${nearestFib}` : ""}`}
        style={styles.average}
      >
        <Text style={[styles.averageValue, { color: t.text1 }]}>{average ?? "—"}</Text>
        <View style={styles.averageText}>
          <Text style={[styles.averageLabel, { color: t.text3 }]}>Average Story Points</Text>
          {nearestFib !== null ? (
            <Text style={[styles.averageLabel, { color: t.text2 }]}>
              {"Nearest card "}
              <Text style={[styles.mono, { color: t.cyanText }]}>{nearestFib}</Text>
            </Text>
          ) : null}
        </View>
      </View>
      {perCard.length > 0 ? (
        <View style={styles.dist}>
          {perCard.map((d) => (
            <View key={d.card} accessible accessibilityLabel={`${pointsLabel(d.card)}: ${votesText(d.count)}`} style={styles.distRow}>
              <View style={[styles.distCard, { borderColor: t.lineStrong, backgroundColor: t.raised }]}>
                <Text style={[styles.distCardText, { color: t.text1 }]}>{d.card}</Text>
              </View>
              <View style={[styles.distTrack, { backgroundColor: t.raised }]}>
                <View
                  style={[
                    styles.distFill,
                    { width: `${d.width}%`, backgroundColor: d.isTop ? t.cyan : t.primary },
                    d.isTop && { boxShadow: [shadows.glow] },
                  ]}
                />
              </View>
              <Text style={[styles.distCount, { color: t.text2 }]}>{votesText(d.count)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}

// The host's action, pinned to the bottom as the canvas draws it: the opaque bar fill over the ink,
// so nothing scrolling under it shows through.
function HostBar({ revealed, disabled, onPress }) {
  const t = useThemeColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { backgroundColor: t.ink }]}>
      <View style={[styles.barFill, { backgroundColor: t.surfaceStrong, borderTopColor: t.line, paddingBottom: Math.max(insets.bottom, 12) }]}>
        <Button
          title={revealed ? "New Round" : "Publish Results"}
          icon={revealed ? "refresh" : "eye"}
          onPress={onPress}
          disabled={disabled}
          style={[styles.barButton, !disabled && { boxShadow: t.glowPrimary }]}
        />
      </View>
    </View>
  );
}

export default function PlanningPokerScreen() {
  const { isAdmin, currentEmployee, user } = useApp();
  const t = useThemeColors();
  const goBack = useGoBack();
  const insets = useSafeAreaInsets();

  const [view, setView] = useState("home");
  const [sessionTitle, setSessionTitle] = useState("");
  const [creatorName, setCreatorName] = useState(currentEmployee?.name || user?.user_metadata?.full_name || "");
  const [joinName, setJoinName] = useState(currentEmployee?.name || "");
  const [joinSessionId, setJoinSessionId] = useState("");
  const [session, setSession] = useState(null);
  const [votes, setVotes] = useState([]);
  const [myVote, setMyVote] = useState(null);
  const [isHost, setIsHost] = useState(false);
  // Which hub form is working ("create" or "join"), and the last error with the form it belongs to.
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState(null);
  const [participantName, setParticipantName] = useState("");
  const [recentSessions, setRecentSessions] = useState([]);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);
  const copiedRef = useRef(null);
  const revealedRef = useRef(false);

  // Every session the API hands back comes through here. A round going from revealed back to
  // voting is a new round: the API deleted every vote, so the card you held goes too.
  const takeSession = useCallback((next) => {
    const revealed = Boolean(next?.revealed);
    if (revealedRef.current && !revealed) setMyVote(null);
    revealedRef.current = revealed;
    setSession(next);
  }, []);

  const startPolling = useCallback(
    (sid) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(pokerUrl(sid));
          if (!res.ok) return;
          const data = await res.json();
          takeSession(data.session);
          setVotes(data.votes || []);
        } catch (_) {}
      }, POLL_MS);
    },
    [takeSession]
  );

  useEffect(
    () => () => {
      if (pollRef.current) clearInterval(pollRef.current);
      clearTimeout(copiedRef.current);
    },
    []
  );

  useEffect(() => {
    if (view === "home") {
      fetch(`${API_BASE_URL}/api/poker`)
        .then((res) => res.json())
        .then((data) => data.sessions && setRecentSessions(data.sessions))
        .catch(() => {});
    }
  }, [view]);

  const handleCreateSession = async () => {
    if (!sessionTitle.trim() || !creatorName.trim()) return setError({ form: "create", message: "Please fill in the session title and your name." });
    setLoading("create");
    setError(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/poker`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "create", title: sessionTitle.trim(), createdBy: creatorName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session");
      takeSession(data.session);
      setVotes([]);
      setIsHost(true);
      setParticipantName(creatorName.trim());
      setView("session");
      startPolling(data.session.id);
      await fetch(`${API_BASE_URL}/api/poker`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "join", sessionId: data.session.id, participantName: creatorName.trim() }),
      });
    } catch (e) {
      setError({ form: "create", message: e.message });
    } finally {
      setLoading(null);
    }
  };

  const handleJoinSession = async (sid, name) => {
    const targetId = sid || joinSessionId.trim();
    const targetName = name || joinName.trim();
    if (!targetName || !targetId) return setError({ form: "join", message: "Please enter your name and the session ID." });
    setLoading("join");
    setError(null);
    try {
      const res = await fetch(pokerUrl(targetId));
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Session not found");
      takeSession(data.session);
      setVotes(data.votes || []);
      setParticipantName(targetName);
      setIsHost(data.session.created_by === targetName);
      const myExisting = (data.votes || []).find((v) => v.participant_name === targetName);
      setMyVote(myExisting && myExisting.vote !== "waiting" ? myExisting.vote : null);
      setView("session");
      startPolling(targetId);
      await fetch(`${API_BASE_URL}/api/poker`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "join", sessionId: targetId, participantName: targetName }),
      });
    } catch (e) {
      setError({ form: "join", message: e.message });
    } finally {
      setLoading(null);
    }
  };

  const handleVote = async (value) => {
    if (!session || session.revealed) return;
    setMyVote(value);
    try {
      await fetch(`${API_BASE_URL}/api/poker`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action: "vote", sessionId: session.id, participantName, vote: String(value) }),
      });
    } catch (_) {}
  };

  // A host action the server refused or that never reached it: an alert, so the host never takes a
  // dead button for a done one.
  const hostActionFailed = (title, message) => Alert.alert(title, message || "Check your connection and try again.");

  // A host action on the session: the server's answer, or null when it failed (already said).
  const patchSession = async (action, failedTitle) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/poker`, {
        method: "PATCH",
        headers: JSON_HEADERS,
        body: JSON.stringify({ action, sessionId: session.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        hostActionFailed(failedTitle, data.error || `The server refused (HTTP ${res.status}).`);
        return null;
      }
      return data;
    } catch (e) {
      hostActionFailed(failedTitle, e?.message);
      return null;
    }
  };

  const handleReveal = async () => {
    if (!session) return;
    const data = await patchSession("reveal", "Cards not revealed");
    if (data?.session) takeSession(data.session);
  };

  const handleReset = async () => {
    if (!session) return;
    const data = await patchSession("reset", "Round not reset");
    if (data?.session) {
      takeSession(data.session);
      setVotes([]);
      setMyVote(null);
    }
  };

  // Leaves the session for the hub; the poll stops and the round's state goes with it.
  const exitToHub = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setView("home");
    takeSession(null);
    setVotes([]);
    setMyVote(null);
  };

  const handleEndSession = () => {
    Alert.alert("End this session?", "This will lock the board for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Session",
        style: "destructive",
        onPress: async () => {
          // Back to the hub only once the server has ended it.
          if (await patchSession("end", "Session not ended")) exitToHub();
        },
      },
    ]);
  };

  // The ID to the clipboard, the button showing a check for a moment. React Native's own Clipboard:
  // the clipboard modules (expo-clipboard and the community one) are native and would change the
  // runtime fingerprint (intent.md, criterion 15).
  const copySessionId = () => {
    if (!session) return;
    Clipboard.setString(session.id);
    setCopied(true);
    AccessibilityInfo.announceForAccessibility("Session ID copied");
    clearTimeout(copiedRef.current);
    copiedRef.current = setTimeout(() => setCopied(false), COPIED_MS);
  };

  // The phone's share sheet: the session, the web app's link to it, and the ID to join with here.
  const shareSession = async () => {
    if (!session) return;
    const link = API_BASE_URL ? `${API_BASE_URL}/planning-poker/${encodeURIComponent(session.id)}` : "";
    try {
      await Share.share({ message: [session.title, link, `Session ID: ${session.id}`].filter(Boolean).join("\n") });
    } catch (_) {}
  };

  if (view === "home") {
    const activeSessions = recentSessions.filter((s) => !s.is_ended);
    return (
      <Screen>
        <ScreenHeader title="Planning poker" onBack={goBack} />

        <Card style={styles.panel}>
          <SectionTitle>Create Session</SectionTitle>
          <TextField label="Your Name" value={creatorName} onChangeText={setCreatorName} placeholder="e.g. Alice" />
          <TextField label="Sprint" value={sessionTitle} onChangeText={setSessionTitle} placeholder="e.g. Sprint 24" />
          {error?.form === "create" ? <SheetNote>{error.message}</SheetNote> : null}
          <Button title={loading === "create" ? "Creating..." : "Create Session"} icon="plus" onPress={handleCreateSession} disabled={loading !== null} />
        </Card>

        <Card style={styles.panel}>
          <SectionTitle>Join Session</SectionTitle>
          <TextField label="Your Name" value={joinName} onChangeText={setJoinName} placeholder="e.g. Bob" />
          <TextField label="Session ID" value={joinSessionId} onChangeText={setJoinSessionId} placeholder="Paste session ID here" style={styles.idInput} />
          {error?.form === "join" ? <SheetNote>{error.message}</SheetNote> : null}
          <Button
            title={loading === "join" ? "Joining..." : "Join Session"}
            variant="secondary"
            icon="link"
            onPress={() => handleJoinSession()}
            disabled={loading !== null}
          />
        </Card>

        {activeSessions.length > 0 ? (
          <Card style={[styles.panel, styles.recent]}>
            <SectionTitle>Active Sessions</SectionTitle>
            {activeSessions.map((s) => (
              <RecentSession key={s.id} session={s} onPress={() => joinName && handleJoinSession(s.id, joinName)} />
            ))}
          </Card>
        ) : null}
      </Screen>
    );
  }

  if (!session) {
    return (
      <Screen>
        <ScreenHeader title="Planning poker" onBack={goBack} />
        <DetailCardSkeleton />
      </Screen>
    );
  }

  const summary = summariseVotes(votes);
  const votedCount = votes.filter((v) => v.vote !== "waiting").length;
  const mine = votes.find((v) => v.participant_name === participantName);
  // Your card: the one you last tapped, else the vote the API holds for you.
  const myCard = myVote !== null && myVote !== undefined ? String(myVote) : mine && hasVoted(mine) ? mine.vote : null;
  const role = isHost ? "Host" : isAdmin ? "Admin" : "Participant";
  const canEnd = (isHost || isAdmin) && !session.is_ended;
  const hostBar = isHost && !session.is_ended;

  return (
    <View style={styles.page}>
      {/* The host: room under the last part for the bar (1 + 12 + 52 + its bottom inset, 16 clear). */}
      <Screen style={hostBar ? { paddingBottom: 81 + Math.max(insets.bottom, 12) } : undefined}>
        <ScreenHeader
          title="Planning poker"
          onBack={goBack}
          right={
            <>
              {canEnd ? (
                <IconButton icon="flag" tone="danger" size={44} iconSize={19} onPress={handleEndSession} accessibilityLabel="End session" style={styles.headerBtn} />
              ) : null}
              <IconButton icon="share" size={44} iconSize={19} color={t.text1} onPress={shareSession} accessibilityLabel="Share session link" style={styles.headerBtn} />
            </>
          }
        />

        <SessionCard session={session} role={role} copied={copied} onCopy={copySessionId} />

        <Participants votes={votes} revealed={session.revealed} me={participantName} votedCount={votedCount} />

        {!session.is_ended ? <Estimate card={myCard} revealed={session.revealed} isHost={isHost} /> : null}

        {!session.revealed && !session.is_ended ? <Deck card={myCard} onVote={handleVote} /> : null}

        {session.revealed ? <Results summary={summary} /> : null}

        <Button title="Exit to Hub" variant="ghost" icon="arrow-left" onPress={exitToHub} />
      </Screen>

      {hostBar ? (
        <HostBar
          revealed={session.revealed}
          disabled={!session.revealed && votedCount === 0}
          onPress={session.revealed ? handleReset : handleReveal}
        />
      ) : null}
    </View>
  );
}

// Sizes, gaps and type from MobilePoker.dc.html: 20-radius glass sections 14 apart; letter-spacing
// in em becomes pixels at the text's size (.06em at 12px is 0.72). The canvas's line-height 1 on the
// big figures is a little more here, so Android does not clip their tops.
const styles = StyleSheet.create({
  page: { flex: 1 },
  pressed: { opacity: 0.8 },
  headerBtn: { borderRadius: 14 },
  flushTitle: { flex: 1, marginBottom: 0 },
  mono: { fontFamily: fonts.mono },

  // The hub: 20-radius glass cards; the active sessions' rows 56 high on a hairline.
  panel: { borderRadius: radius.xl },
  idInput: { fontFamily: fonts.mono, fontSize: 13 },
  recent: { paddingBottom: 6 },
  recentRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8, borderTopWidth: 1 },
  recentText: { flex: 1, minWidth: 0, gap: 2 },
  recentTitle: { fontFamily: fonts.bodySemibold, fontSize: 15 },
  recentMeta: { fontFamily: fonts.body, fontSize: 13 },

  // The session: 10 between its parts; the foot on a hairline, 10 above.
  story: { borderRadius: radius.xl, gap: 10 },
  status: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 6, height: 22, paddingHorizontal: 8, borderRadius: radius.pill },
  statusDot: { width: 6, height: 6, borderRadius: radius.pill },
  statusText: { fontFamily: fonts.bodySemibold, fontSize: 12 },
  storyTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 26 },
  storyFoot: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: 1 },
  storyMeta: { flex: 1, minWidth: 0, gap: 2 },
  storyRole: { fontFamily: fonts.body, fontSize: 13 },
  storyId: { fontFamily: fonts.mono, fontSize: 12 },
  copy: { borderRadius: radius.md },

  // Participants: 14 under the head; four seats to a row, 14 by 8 apart; the avatars 46 across.
  participants: { borderRadius: radius.xl, gap: 14 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  headNote: { fontFamily: fonts.mono, fontSize: 12 },
  seats: { gap: 14 },
  seatRow: { flexDirection: "row", gap: 8 },
  seat: { flex: 1, minWidth: 0, alignItems: "center", gap: 6 },
  seatAvatar: { width: 46, height: 46, borderRadius: radius.pill },
  stateBadge: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  voteBadge: {
    position: "absolute",
    right: -6,
    bottom: -6,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 4,
    borderRadius: 7,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  voteBadgeText: { fontFamily: fonts.display, fontSize: 12 },
  seatName: { maxWidth: "100%", fontFamily: fonts.bodyMedium, fontSize: 13 },

  // Your estimate: 18 in and between the card and its words; the card 112 by 156.
  estimate: { borderRadius: radius.xl, paddingVertical: 18, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", gap: 18 },
  preview: { width: 112, height: 156, borderRadius: radius.lg, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  previewCorner: { position: "absolute", fontFamily: fonts.mono, fontSize: 12 },
  previewCornerTop: { top: 8, left: 10 },
  previewCornerBottom: { bottom: 8, right: 10, transform: [{ rotate: "180deg" }] },
  previewValue: { fontFamily: fonts.display, fontSize: 60, lineHeight: 66 },
  estimateText: { flex: 1, minWidth: 0, gap: 6 },
  estimateEyebrow: { letterSpacing: 0.72 },
  estimateTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 26 },
  estimateHint: { fontFamily: fonts.body, fontSize: 13, lineHeight: 19.5 },

  // The deck: 10 under its head, 10 of room for the lift; cards 76 by 104, rows 16 apart. A row
  // narrower than four cards shrinks them rather than spill.
  deck: { gap: 10, marginBottom: 14 },
  deckHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 2 },
  deckNote: { fontFamily: fonts.mono, fontSize: 12 },
  deckGrid: { paddingTop: 10, gap: 16 },
  deckRow: { flexDirection: "row", justifyContent: "space-between" },
  card: { flexBasis: 76, flexShrink: 1, height: 104, borderRadius: 14, borderWidth: 2, alignItems: "center", justifyContent: "center" },
  cardSpacer: { flexBasis: 76, flexShrink: 1 },
  // The canvas's inset 1px highlight, inside the 2px edge, between the corners.
  cardHi: { position: "absolute", top: 0, left: 12, right: 12, height: 1 },
  cardCorner: { position: "absolute", top: 6, left: 8, fontFamily: fonts.mono, fontSize: 12 },
  cardValue: { fontFamily: fonts.display, fontSize: 30, lineHeight: 33 },

  // Results: a cyan edge, 14 between its parts; the bars 10 high, 10 apart.
  results: { borderRadius: radius.xl, gap: 14 },
  average: { flexDirection: "row", alignItems: "flex-end", gap: 12 },
  averageValue: { fontFamily: fonts.display, fontSize: 44, lineHeight: 48, fontVariant: ["tabular-nums"] },
  averageText: { flexShrink: 1, gap: 2, paddingBottom: 4 },
  averageLabel: { fontFamily: fonts.body, fontSize: 13 },
  dist: { gap: 10 },
  distRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  distCard: { width: 34, height: 28, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  distCardText: { fontFamily: fonts.display, fontSize: 14 },
  distTrack: { flex: 1, height: 10, borderRadius: radius.pill, overflow: "hidden" },
  distFill: { height: "100%", borderRadius: radius.pill },
  distCount: { width: 62, fontFamily: fonts.mono, fontSize: 12, textAlign: "right" },

  // The host's bar: 12 above the button, 16 to the sides, the bottom inset (at least 12) under it.
  bar: { position: "absolute", left: 0, right: 0, bottom: 0 },
  barFill: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1 },
  barButton: { minHeight: 52, borderRadius: 14 },
});
