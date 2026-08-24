import { useState, useMemo } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { Stack } from "expo-router";
import { useApp } from "../context/AppContext";
import { useThemeColors } from "../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Button, TextField, Chip } from "../components/ui";
import AddWordSeasonModal from "../components/AddWordSeasonModal";
import EditWordSeasonModal from "../components/EditWordSeasonModal";
import AddWordModal from "../components/AddWordModal";
import EditWordModal from "../components/EditWordModal";

export default function WordsScreen() {
  const { wordSeasons, words, deleteWord, deleteWordSeason, isAdmin } = useApp();
  const t = useThemeColors();
  const [activeSeasonId, setActiveSeasonId] = useState(null);
  const [search, setSearch] = useState("");
  const [showAddSeason, setShowAddSeason] = useState(false);
  const [editingSeason, setEditingSeason] = useState(null);
  const [showAddWord, setShowAddWord] = useState(false);
  const [editingWord, setEditingWord] = useState(null);

  const sortedSeasons = useMemo(() => [...wordSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)), [wordSeasons]);

  const effectiveSeasonId = activeSeasonId || sortedSeasons[0]?.id || null;
  const activeSeason = wordSeasons.find((s) => s.id === effectiveSeasonId);

  const filteredWords = useMemo(() => {
    let list = words.filter((w) => w.season_id === effectiveSeasonId);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((w) => w.word.toLowerCase().includes(q) || w.definition.toLowerCase().includes(q) || (w.translation && w.translation.toLowerCase().includes(q)));
    }
    return list;
  }, [words, effectiveSeasonId, search]);

  const confirmDeleteWord = (w) => {
    Alert.alert("Delete word?", w.word, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteWord(w.id) },
    ]);
  };

  const confirmDeleteSeason = (s) => {
    Alert.alert("Delete season?", `"${s.title}" and all its words will be removed.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteWordSeason(s.id) },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Word of the Day" }} />

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <SectionTitle>📚 Seasons</SectionTitle>
          {isAdmin && <Button title="+ Add" small onPress={() => setShowAddSeason(true)} />}
        </View>
        {sortedSeasons.length === 0 ? (
          <EmptyState text="No seasons yet" />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {sortedSeasons.map((s) => (
              <View key={s.id} style={{ flexDirection: "row", alignItems: "center" }}>
                <Chip label={s.title} active={effectiveSeasonId === s.id} onPress={() => setActiveSeasonId(s.id)} />
                {isAdmin && (
                  <Pressable onPress={() => setEditingSeason(s)} style={{ marginRight: 8, marginTop: -8 }}>
                    <Text style={{ fontSize: 13 }}>✏️</Text>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        )}
        {isAdmin && activeSeason && (
          <Pressable onPress={() => confirmDeleteSeason(activeSeason)} style={{ marginTop: 4 }}>
            <Text style={{ color: t.accentRed, fontSize: 12 }}>Delete "{activeSeason.title}"</Text>
          </Pressable>
        )}
      </Card>

      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <View>
            <Text style={{ color: t.accentIndigo, fontSize: 11, fontWeight: "700", textTransform: "uppercase" }}>{activeSeason ? activeSeason.title : "Select a Season"}</Text>
            <Text style={{ color: t.textPrimary, fontSize: 16, fontWeight: "700" }}>{filteredWords.length} Words Shared</Text>
          </View>
          {effectiveSeasonId && <Button title="+ Add Word" small onPress={() => setShowAddWord(true)} />}
        </View>
        <TextField placeholder="Search words..." value={search} onChangeText={setSearch} />

        {filteredWords.length === 0 ? (
          <EmptyState icon="📖" text="No words found in this season yet." />
        ) : (
          filteredWords.map((w) => (
            <View key={w.id} style={{ backgroundColor: t.bgElevated, borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ color: t.textPrimary, fontSize: 17, fontWeight: "800" }}>{w.word}</Text>
                  {w.phonetic ? <Text style={{ color: t.textMuted, fontSize: 12 }}>({w.phonetic})</Text> : null}
                </View>
                {isAdmin && (
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <Pressable onPress={() => setEditingWord(w)}>
                      <Text style={{ fontSize: 15 }}>📝</Text>
                    </Pressable>
                    <Pressable onPress={() => confirmDeleteWord(w)}>
                      <Text style={{ fontSize: 15 }}>🗑</Text>
                    </Pressable>
                  </View>
                )}
              </View>
              {w.translation ? (
                <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 6 }}>
                  <Text style={{ fontWeight: "700" }}>Translation: </Text>
                  {w.translation}
                </Text>
              ) : null}
              <Text style={{ color: t.textSecondary, fontSize: 14, marginTop: 6 }}>{w.definition}</Text>
              {w.example ? (
                <View style={{ backgroundColor: t.border, borderRadius: 8, padding: 10, marginTop: 8 }}>
                  <Text style={{ color: t.textMuted, fontSize: 13, fontStyle: "italic" }}>"{w.example}"</Text>
                </View>
              ) : null}
              <Text style={{ color: t.textMuted, fontSize: 11, marginTop: 8 }}>
                Shared by {w.created_by} · {new Date(w.created_at).toLocaleDateString()}
              </Text>
            </View>
          ))
        )}
      </Card>

      <AddWordSeasonModal isOpen={showAddSeason} onClose={() => setShowAddSeason(false)} />
      <EditWordSeasonModal isOpen={!!editingSeason} onClose={() => setEditingSeason(null)} season={editingSeason} />
      <AddWordModal isOpen={showAddWord} onClose={() => setShowAddWord(false)} />
      <EditWordModal isOpen={!!editingWord} onClose={() => setEditingWord(null)} word={editingWord} />
    </Screen>
  );
}
