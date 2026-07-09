import { useState, useEffect, useCallback, useRef } from "react";
import { View, Text, ScrollView, Pressable, ActivityIndicator, Alert } from "react-native";
import { Stack } from "expo-router";
import { useApp } from "../context/AppContext";
import { API_BASE_URL } from "../lib/supabase";
import { useThemeColors } from "../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Button, TextField } from "../components/ui";

const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, 34, 55, 89, "?"];

export default function PlanningPokerScreen() {
  const { isAdmin, currentEmployee, user } = useApp();
  const t = useThemeColors();

  const [view, setView] = useState("home");
  const [sessionTitle, setSessionTitle] = useState("");
  const [creatorName, setCreatorName] = useState(currentEmployee?.name || user?.user_metadata?.full_name || "");
  const [joinName, setJoinName] = useState(currentEmployee?.name || "");
  const [joinSessionId, setJoinSessionId] = useState("");
  const [session, setSession] = useState(null);
  const [votes, setVotes] = useState([]);
  const [myVote, setMyVote] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [participantName, setParticipantName] = useState("");
  const [recentSessions, setRecentSessions] = useState([]);
  const pollRef = useRef(null);

  const startPolling = useCallback((sid) => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/poker?sessionId=${sid}`);
        if (!res.ok) return;
        const data = await res.json();
        setSession(data.session);
        setVotes(data.votes || []);
      } catch (_) {}
    }, 2000);
  }, []);

  useEffect(() => () => pollRef.current && clearInterval(pollRef.current), []);

  useEffect(() => {
    if (view === "home") {
      fetch(`${API_BASE_URL}/api/poker`)
        .then((res) => res.json())
        .then((data) => data.sessions && setRecentSessions(data.sessions))
        .catch(() => {});
    }
  }, [view]);

  const handleCreateSession = async () => {
    if (!sessionTitle.trim() || !creatorName.trim()) return setError("Please fill in the session title and your name.");
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/poker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", title: sessionTitle.trim(), createdBy: creatorName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create session");
      setSession(data.session);
      setVotes([]);
      setIsHost(true);
      setParticipantName(creatorName.trim());
      setView("session");
      startPolling(data.session.id);
      await fetch(`${API_BASE_URL}/api/poker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", sessionId: data.session.id, participantName: creatorName.trim() }),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinSession = async (sid, name) => {
    const targetId = sid || joinSessionId.trim();
    const targetName = name || joinName.trim();
    if (!targetName || !targetId) return setError("Please enter your name and the session ID.");
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE_URL}/api/poker?sessionId=${targetId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Session not found");
      setSession(data.session);
      setVotes(data.votes || []);
      setParticipantName(targetName);
      setIsHost(data.session.created_by === targetName);
      const myExisting = (data.votes || []).find((v) => v.participant_name === targetName);
      setMyVote(myExisting && myExisting.vote !== "waiting" ? myExisting.vote : null);
      setView("session");
      startPolling(targetId);
      await fetch(`${API_BASE_URL}/api/poker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", sessionId: targetId, participantName: targetName }),
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = async (value) => {
    if (!session || session.revealed) return;
    setMyVote(value);
    try {
      await fetch(`${API_BASE_URL}/api/poker`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "vote", sessionId: session.id, participantName, vote: String(value) }),
      });
    } catch (_) {}
  };

  const handleReveal = async () => {
    if (!session) return;
    const res = await fetch(`${API_BASE_URL}/api/poker`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reveal", sessionId: session.id }),
    });
    const data = await res.json();
    if (res.ok) setSession(data.session);
  };

  const handleReset = async () => {
    if (!session) return;
    const res = await fetch(`${API_BASE_URL}/api/poker`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset", sessionId: session.id }),
    });
    const data = await res.json();
    if (res.ok) {
      setSession(data.session);
      setVotes([]);
      setMyVote(null);
    }
  };

  const handleEndSession = () => {
    Alert.alert("End this session?", "This will lock the board for everyone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "End Session",
        style: "destructive",
        onPress: async () => {
          await fetch(`${API_BASE_URL}/api/poker`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "end", sessionId: session.id }),
          });
          if (pollRef.current) clearInterval(pollRef.current);
          setView("home");
          setSession(null);
          setVotes([]);
        },
      },
    ]);
  };

  const numericVotes = votes.map((v) => Number(v.vote)).filter((n) => !isNaN(n) && n > 0);
  const average = numericVotes.length > 0 ? (numericVotes.reduce((a, b) => a + b, 0) / numericVotes.length).toFixed(1) : null;
  const myVoteInSession = votes.find((v) => v.participant_name === participantName);

  if (view === "home") {
    return (
      <Screen>
        <Stack.Screen options={{ title: "Planning Poker" }} />
        <Card>
          <SectionTitle>🚀 Create Session</SectionTitle>
          <TextField label="Your Name" value={creatorName} onChangeText={setCreatorName} placeholder="e.g. Alice" />
          <TextField label="Sprint" value={sessionTitle} onChangeText={setSessionTitle} placeholder="e.g. Sprint 24" />
          <Button title={loading ? "Creating..." : "🚀 Create Session"} onPress={handleCreateSession} disabled={loading} />
        </Card>

        <Card>
          <SectionTitle>🔗 Join Session</SectionTitle>
          <TextField label="Your Name" value={joinName} onChangeText={setJoinName} placeholder="e.g. Bob" />
          <TextField label="Session ID" value={joinSessionId} onChangeText={setJoinSessionId} placeholder="Paste session ID here" />
          <Button title={loading ? "Joining..." : "🔗 Join Session"} variant="accent" onPress={() => handleJoinSession()} disabled={loading} />
        </Card>

        {error ? <Text style={{ color: t.accentRed, marginBottom: 12 }}>{error}</Text> : null}

        {recentSessions.filter((s) => !s.is_ended).length > 0 && (
          <Card>
            <SectionTitle>🌐 Active Sessions</SectionTitle>
            {recentSessions
              .filter((s) => !s.is_ended)
              .map((s) => (
                <Pressable
                  key={s.id}
                  onPress={() => joinName && handleJoinSession(s.id, joinName)}
                  style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border }}
                >
                  <Text style={{ color: t.textPrimary, fontWeight: "700" }}>🗳️ {s.title}</Text>
                  <Text style={{ color: t.textMuted, fontSize: 12 }}>By {s.created_by} · {new Date(s.created_at).toLocaleDateString()}</Text>
                </Pressable>
              ))}
          </Card>
        )}
      </Screen>
    );
  }

  if (!session) return <Screen><ActivityIndicator color={t.accentIndigo} /></Screen>;

  return (
    <Screen>
      <Stack.Screen options={{ title: session.title }} />
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
          <View>
            <Text style={{ color: t.textPrimary, fontSize: 18, fontWeight: "800" }}>{session.title}</Text>
            <Text style={{ color: t.textMuted, fontSize: 12 }}>{isHost ? "🎯 Host" : isAdmin ? "🛡️ Admin" : "👤 Participant"} · ID: {session.id}</Text>
          </View>
          {(isHost || isAdmin) && !session.is_ended && <Button title="🏁 End" small variant="danger" onPress={handleEndSession} />}
        </View>

        <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 12 }}>
          <Text style={{ color: t.textMuted, fontSize: 13 }}>🗳️ {votes.filter((v) => v.vote !== "waiting").length}/{votes.length} voted</Text>
          <Text style={{ color: session.revealed ? t.accentGreen : t.accentAmber, fontSize: 13, fontWeight: "700" }}>{session.revealed ? "🔓 Revealed" : "🔒 In Progress"}</Text>
        </View>

        {session.revealed ? (
          <View style={{ backgroundColor: t.bgElevated, borderRadius: 12, padding: 16, alignItems: "center", marginBottom: 12 }}>
            <Text style={{ color: t.textMuted, fontSize: 12 }}>Average Story Points</Text>
            <Text style={{ color: t.accentIndigo, fontSize: 32, fontWeight: "800" }}>{average ?? "—"}</Text>
          </View>
        ) : (
          !session.is_ended && (
            <View style={{ marginBottom: 12 }}>
              <Text style={{ color: t.textSecondary, fontSize: 13, marginBottom: 8 }}>
                {myVoteInSession ? `✅ You voted: ${myVoteInSession.vote} — Change?` : "Pick your estimate"}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {FIBONACCI.map((val) => {
                  const selected = myVote === val || myVoteInSession?.vote === String(val);
                  return (
                    <Pressable
                      key={val}
                      onPress={() => handleVote(val)}
                      style={{ width: 56, height: 56, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: selected ? t.accentIndigo : t.bgElevated, borderWidth: 1, borderColor: selected ? t.accentIndigo : t.border }}
                    >
                      <Text style={{ color: selected ? "#fff" : t.textPrimary, fontWeight: "800" }}>{val}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          )
        )}

        {isHost && !session.is_ended && (
          <Button
            title={session.revealed ? "🔄 New Round" : "📢 Publish Results"}
            variant={session.revealed ? "warning" : "success"}
            onPress={session.revealed ? handleReset : handleReveal}
            disabled={!session.revealed && votes.filter((v) => v.vote !== "waiting").length === 0}
          />
        )}

        <SectionTitle>👥 Participants ({votes.length})</SectionTitle>
        {votes.length === 0 ? (
          <EmptyState text="Waiting for participants to vote…" />
        ) : (
          votes.map((v) => (
            <View key={v.id} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
              <Text style={{ color: t.textPrimary, fontSize: 14 }}>{v.participant_name}</Text>
              <Text style={{ color: t.textMuted, fontSize: 13 }}>{session.revealed ? (v.vote === "waiting" ? "—" : v.vote) : v.vote === "waiting" ? "…" : "✓"}</Text>
            </View>
          ))
        )}
      </Card>

      <Button title="← Exit to Hub" variant="ghost" onPress={() => { if (pollRef.current) clearInterval(pollRef.current); setView("home"); setSession(null); }} />
    </Screen>
  );
}
