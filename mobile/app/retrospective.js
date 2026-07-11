import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { Stack } from "expo-router";
import { useApp } from "../context/AppContext";
import { API_BASE_URL } from "../lib/supabase";
import { useThemeColors } from "../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Button, TextField, Select } from "../components/ui";
import { DetailCardSkeleton } from "../components/Skeleton";

const REACTION_EMOJIS = ["❤️", "😂", "😮", "🎉", "💡"];

const RETRO_TEMPLATES = {
  standard: [
    { key: "went_well", label: "What Went Well?", emoji: "🎉" },
    { key: "improve", label: "Needs Improvement", emoji: "🔧" },
    { key: "focus", label: "Focus More On", emoji: "🎯" },
  ],
  sailboat: [
    { key: "wind", label: "Wind (Pushing us forward)", emoji: "⛵" },
    { key: "anchors", label: "Anchors (Holding us back)", emoji: "⚓" },
    { key: "rocks", label: "Rocks (Risks ahead)", emoji: "🪨" },
  ],
  start_stop: [
    { key: "start", label: "Start Doing", emoji: "🚀" },
    { key: "stop", label: "Stop Doing", emoji: "🛑" },
    { key: "continue", label: "Continue Doing", emoji: "🔄" },
  ],
};

export default function RetrospectiveScreen() {
  const { currentEmployee, user, isAdmin } = useApp();
  const t = useThemeColors();
  const loggedInName = currentEmployee?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

  const [view, setView] = useState("home");
  const [sessionTitle, setSessionTitle] = useState("");
  const [creatorName, setCreatorName] = useState(loggedInName);
  const [joinName, setJoinName] = useState(loggedInName);
  const [joinSessionId, setJoinSessionId] = useState("");
  const [template, setTemplate] = useState("standard");
  const [session, setSession] = useState(null);
  const [cards, setCards] = useState([]);
  const [cardReactions, setCardReactions] = useState([]);
  const [reactionPickerFor, setReactionPickerFor] = useState(null);
  const [participantName, setParticipantName] = useState("");
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [composeCol, setComposeCol] = useState(null);
  const [composeText, setComposeText] = useState("");
  const [editingCardId, setEditingCardId] = useState(null);
  const [editText, setEditText] = useState("");
  const pollRef = useRef(null);

  const canEndSession = isHost || !!isAdmin;
  const columns = RETRO_TEMPLATES[session?.template] || RETRO_TEMPLATES.standard;

  const fetchBoard = useCallback(async (sid) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/retro?sessionId=${sid}`);
      if (!res.ok) return;
      const data = await res.json();
      setSession(data.session);
      setCards(data.cards || []);
      setCardReactions(data.cardReactions || []);
    } catch (_) {}
  }, []);

  const startPolling = useCallback(
    (sid) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(() => fetchBoard(sid), 2500);
    },
    [fetchBoard]
  );

  useEffect(() => () => pollRef.current && clearInterval(pollRef.current), []);

  const handleCreate = async () => {
    if (!sessionTitle.trim() || !creatorName.trim()) return setError("Please enter your name and a session title.");
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/retro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: sessionTitle.trim(), createdBy: creatorName.trim(), template }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSession(data.session);
      setCards([]);
      setCardReactions([]);
      setView("board");
      setIsHost(true);
      setParticipantName(creatorName.trim());
      startPolling(data.session.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!joinName.trim() || !joinSessionId.trim()) return setError("Please enter your name and the session ID.");
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/retro?sessionId=${joinSessionId.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Session not found");
      setSession(data.session);
      setCards(data.cards || []);
      setCardReactions(data.cardReactions || []);
      setParticipantName(joinName.trim());
      setIsHost(data.session.created_by === joinName.trim());
      setView("board");
      startPolling(joinSessionId.trim());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePin = async (colKey) => {
    if (!composeText.trim() || !session) return;
    const text = composeText.trim();
    setComposeCol(null);
    setComposeText("");
    try {
      await fetch(`${API_BASE_URL}/api/retro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "add_card", sessionId: session.id, columnType: colKey, content: text, author: participantName }),
      });
      await fetchBoard(session.id);
    } catch (_) {}
  };

  const handleEditCard = async (cardId) => {
    if (!editText.trim()) return;
    try {
      const res = await fetch(`${API_BASE_URL}/api/retro`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "edit_card", cardId, content: editText, author: participantName }),
      });
      if (res.ok) {
        setCards((prev) => prev.map((c) => (c.id === cardId ? { ...c, content: editText.trim() } : c)));
        setEditingCardId(null);
        setEditText("");
      }
    } catch (_) {}
  };

  const handleDelete = async (cardId) => {
    try {
      await fetch(`${API_BASE_URL}/api/retro?cardId=${cardId}`, { method: "DELETE" });
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    } catch (_) {}
  };

  const handleReact = async (cardId, emoji) => {
    if (!participantName) return;
    const already = cardReactions.some((r) => String(r.card_id) === String(cardId) && r.participant_name === participantName && r.emoji === emoji);
    setCardReactions((prev) =>
      already
        ? prev.filter((r) => !(String(r.card_id) === String(cardId) && r.participant_name === participantName && r.emoji === emoji))
        : [...prev, { card_id: cardId, participant_name: participantName, emoji }]
    );
    await fetch(`${API_BASE_URL}/api/retro`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: already ? "unreact_card" : "react_card", cardId, sessionId: session.id, participantName, emoji }),
    });
  };

  const handleEndSession = () => {
    Alert.alert("End this session?", "This will lock the board for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Session",
        style: "destructive",
        onPress: async () => {
          await fetch(`${API_BASE_URL}/api/retro`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "end_session", sessionId: session.id }),
          });
          if (pollRef.current) clearInterval(pollRef.current);
          setView("home");
          setSession(null);
        },
      },
    ]);
  };

  if (view === "home") {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Retrospective" }} />
        <Card>
          <SectionTitle>🚀 Create Session</SectionTitle>
          <TextField label="Your Name" value={creatorName} onChangeText={setCreatorName} />
          <TextField label="Session Title" value={sessionTitle} onChangeText={setSessionTitle} placeholder="e.g. Sprint 24 Retro" />
          <Select
            label="Template"
            value={template}
            onSelect={setTemplate}
            options={[
              { value: "standard", label: "🎉 Standard" },
              { value: "sailboat", label: "⛵ Sailboat" },
              { value: "start_stop", label: "🚀 Start/Stop/Continue" },
            ]}
          />
          <Button title={loading ? "Creating..." : "🚀 Create Session"} onPress={handleCreate} disabled={loading} />
        </Card>

        <Card>
          <SectionTitle>🔗 Join Session</SectionTitle>
          <TextField label="Your Name" value={joinName} onChangeText={setJoinName} />
          <TextField label="Session ID" value={joinSessionId} onChangeText={setJoinSessionId} placeholder="Paste session ID here" />
          <Button title={loading ? "Joining..." : "🔗 Join Session"} variant="accent" onPress={handleJoin} disabled={loading} />
        </Card>

        {error ? <Text style={{ color: t.accentRed }}>{error}</Text> : null}
      </Screen>
    );
  }

  if (!session) return <Screen><DetailCardSkeleton /></Screen>;

  return (
    <Screen>
      <Stack.Screen options={{ title: session.title }} />
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <View>
          <Text style={{ color: t.textPrimary, fontSize: 18, fontWeight: "800" }}>{session.title}</Text>
          <Text style={{ color: t.textMuted, fontSize: 12 }}>ID: {session.id}</Text>
        </View>
        {canEndSession && !session.is_ended && <Button title="🏁 End" small variant="danger" onPress={handleEndSession} />}
      </View>

      {columns.map((col) => {
        const colCards = cards.filter((c) => c.column_type === col.key);
        return (
          <Card key={col.key}>
            <SectionTitle>{col.emoji} {col.label}</SectionTitle>
            {colCards.length === 0 ? (
              <EmptyState text="No cards yet." />
            ) : (
              colCards.map((c) => {
                const isOwner = (c.author || "").toLowerCase().trim() === participantName.toLowerCase().trim();
                const reactionCounts = {};
                cardReactions
                  .filter((r) => String(r.card_id) === String(c.id))
                  .forEach((r) => { reactionCounts[r.emoji] = (reactionCounts[r.emoji] || 0) + 1; });
                const isEditing = editingCardId === c.id;
                return (
                  <View key={c.id} style={{ backgroundColor: t.bgElevated, borderRadius: 10, padding: 10, marginBottom: 8 }}>
                    {isEditing ? (
                      <View>
                        <TextField value={editText} onChangeText={setEditText} multiline />
                        <View style={{ flexDirection: "row", gap: 8 }}>
                          <Button title="Save" small onPress={() => handleEditCard(c.id)} />
                          <Button title="Cancel" small variant="ghost" onPress={() => setEditingCardId(null)} />
                        </View>
                      </View>
                    ) : (
                      <>
                        <Text style={{ color: t.textPrimary, fontSize: 14 }}>{c.content}</Text>
                        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8, flexWrap: "wrap", gap: 8 }}>
                          <Text style={{ color: t.textMuted, fontSize: 11 }}>— {c.author || "Anonymous"}</Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            {Object.entries(reactionCounts).map(([emoji, count]) => (
                              <Pressable key={emoji} onPress={() => handleReact(c.id, emoji)} style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                                <Text style={{ fontSize: 13 }}>{emoji}</Text>
                                <Text style={{ color: t.textMuted, fontSize: 12 }}>{count}</Text>
                              </Pressable>
                            ))}
                            <Pressable onPress={() => setReactionPickerFor(reactionPickerFor === c.id ? null : c.id)}>
                              <Text style={{ fontSize: 13, color: t.textMuted }}>+😀</Text>
                            </Pressable>
                            {isOwner && (
                              <>
                                <Pressable onPress={() => { setEditingCardId(c.id); setEditText(c.content); }}>
                                  <Text style={{ fontSize: 13 }}>✏️</Text>
                                </Pressable>
                                <Pressable onPress={() => handleDelete(c.id)}>
                                  <Text style={{ fontSize: 13 }}>🗑</Text>
                                </Pressable>
                              </>
                            )}
                          </View>
                        </View>
                        {reactionPickerFor === c.id && (
                          <View style={{ flexDirection: "row", gap: 14, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: t.border }}>
                            {REACTION_EMOJIS.map((emoji) => (
                              <Pressable key={emoji} onPress={() => { handleReact(c.id, emoji); setReactionPickerFor(null); }}>
                                <Text style={{ fontSize: 18 }}>{emoji}</Text>
                              </Pressable>
                            ))}
                          </View>
                        )}
                      </>
                    )}
                  </View>
                );
              })
            )}

            {composeCol === col.key ? (
              <View>
                <TextField value={composeText} onChangeText={setComposeText} placeholder="Type a card..." multiline autoFocus />
                <View style={{ flexDirection: "row", gap: 8 }}>
                  <Button title="💾 Pin" small onPress={() => handlePin(col.key)} />
                  <Button title="Cancel" small variant="ghost" onPress={() => { setComposeCol(null); setComposeText(""); }} />
                </View>
              </View>
            ) : (
              !session.is_ended && <Button title={`+ Add to ${col.label}`} variant="ghost" small onPress={() => setComposeCol(col.key)} />
            )}
          </Card>
        );
      })}

      <Button title="← Exit to Hub" variant="ghost" onPress={() => { if (pollRef.current) clearInterval(pollRef.current); setView("home"); setSession(null); }} />
    </Screen>
  );
}
