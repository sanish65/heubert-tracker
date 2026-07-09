import { useState } from "react";
import { View, Text, Image, Pressable, Modal, ScrollView, Alert } from "react-native";
import { WebView } from "react-native-webview";
import { Stack } from "expo-router";
import { useApp } from "../context/AppContext";
import { useThemeColors } from "../lib/theme";
import { transformGoogleDriveLink, getGoogleDriveThumbnailUrl, getGoogleDriveEmbedUrl } from "../lib/utils";
import { Screen, Card, SectionTitle, EmptyState, Button, TextField, FormModal } from "../components/ui";
import AddMemoryModal from "../components/AddMemoryModal";

function MemoryCard({ memory, onPress, onEdit, onDelete, canManage }) {
  const t = useThemeColors();
  return (
    <Pressable onPress={onPress} style={{ width: "48%", marginBottom: 14 }}>
      <View style={{ backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.border, overflow: "hidden" }}>
        {memory.type === "image" && (
          <Image
            source={{ uri: transformGoogleDriveLink(memory.content) }}
            style={{ width: "100%", height: 140, backgroundColor: t.border }}
            resizeMode="cover"
          />
        )}
        {memory.type === "video" && (
          <View style={{ width: "100%", height: 140, backgroundColor: t.border, alignItems: "center", justifyContent: "center" }}>
            <Image source={{ uri: getGoogleDriveThumbnailUrl(memory.content) || undefined }} style={{ width: "100%", height: 140, position: "absolute" }} resizeMode="cover" />
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: "#fff", fontSize: 16 }}>▶</Text>
            </View>
          </View>
        )}
        {memory.type === "text" && (
          <View style={{ padding: 14, minHeight: 100, justifyContent: "center" }}>
            <Text style={{ color: t.textMuted, fontSize: 22, marginBottom: 4 }}>"</Text>
            <Text numberOfLines={4} style={{ color: t.textSecondary, fontSize: 13, fontStyle: "italic" }}>
              {memory.content}
            </Text>
          </View>
        )}
        <View style={{ padding: 10 }}>
          {memory.caption ? <Text numberOfLines={1} style={{ color: t.textPrimary, fontSize: 13, fontWeight: "700" }}>{memory.caption}</Text> : null}
          <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
            <Text style={{ color: t.textMuted, fontSize: 11 }}>By {memory.author_name || "Team"}</Text>
            <Text style={{ color: t.textMuted, fontSize: 11 }}>{new Date(memory.created_at).toLocaleDateString()}</Text>
          </View>
          {canManage && (
            <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
              <Pressable onPress={onEdit}>
                <Text style={{ fontSize: 13 }}>✏️</Text>
              </Pressable>
              <Pressable onPress={onDelete}>
                <Text style={{ fontSize: 13 }}>🗑️</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
}

function EditMemoryModal({ memory, onClose, onSave }) {
  const [content, setContent] = useState(memory.content);
  const [caption, setCaption] = useState(memory.caption || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await onSave(memory.id, { content, caption });
      onClose();
    } catch (err) {
      Alert.alert("Update failed", err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModal visible={!!memory} onClose={onClose} title="✏️ Edit Memory">
      <TextField label={memory.type === "text" ? "Message" : "Media URL"} value={content} onChangeText={setContent} multiline={memory.type === "text"} />
      <TextField label="Caption (optional)" value={caption} onChangeText={setCaption} />
      <Button title={saving ? "Saving..." : "💾 Save Changes"} onPress={handleSave} disabled={saving} />
    </FormModal>
  );
}

export default function MemoriesScreen() {
  const { memories, user, deleteMemory, updateMemory } = useApp();
  const t = useThemeColors();
  const [expanded, setExpanded] = useState(null);
  const [editing, setEditing] = useState(null);
  const [showAdd, setShowAdd] = useState(false);

  const confirmDelete = (memory) => {
    Alert.alert("Delete this memory?", "", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteMemory(memory.id) },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Team Memories" }} />
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <SectionTitle>✨ Team Memories</SectionTitle>
          <Button title="+ Share" small onPress={() => setShowAdd(true)} />
        </View>

        {memories.length === 0 ? (
          <EmptyState icon="✨" text="No memories shared yet. Be the first to pin one!" />
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" }}>
            {memories.map((memory) => (
              <MemoryCard
                key={memory.id}
                memory={memory}
                onPress={() => setExpanded(memory)}
                canManage={user && memory.author_email === user.email}
                onEdit={() => setEditing(memory)}
                onDelete={() => confirmDelete(memory)}
              />
            ))}
          </View>
        )}
      </Card>

      <Modal visible={!!expanded} animationType="fade" transparent onRequestClose={() => setExpanded(null)}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)", justifyContent: "center", padding: 16 }} onPress={() => setExpanded(null)}>
          {expanded && (
            <Pressable onPress={() => {}} style={{ backgroundColor: t.bgElevated, borderRadius: 16, overflow: "hidden", maxHeight: "85%" }}>
              <ScrollView>
                {expanded.type === "image" && (
                  <Image source={{ uri: transformGoogleDriveLink(expanded.content) }} style={{ width: "100%", height: 320 }} resizeMode="contain" />
                )}
                {expanded.type === "video" &&
                  (getGoogleDriveEmbedUrl(expanded.content) ? (
                    <WebView source={{ uri: getGoogleDriveEmbedUrl(expanded.content) }} style={{ width: "100%", height: 260 }} allowsFullscreenVideo />
                  ) : (
                    <WebView source={{ uri: expanded.content }} style={{ width: "100%", height: 260 }} allowsFullscreenVideo />
                  ))}
                {expanded.type === "text" && (
                  <View style={{ padding: 24 }}>
                    <Text style={{ color: t.textMuted, fontSize: 30 }}>"</Text>
                    <Text style={{ color: t.textPrimary, fontSize: 16 }}>{expanded.content}</Text>
                  </View>
                )}
                <View style={{ padding: 16 }}>
                  {expanded.caption ? <Text style={{ color: t.textPrimary, fontSize: 16, fontWeight: "700", marginBottom: 4 }}>{expanded.caption}</Text> : null}
                  <Text style={{ color: t.textMuted, fontSize: 12 }}>
                    Shared by {expanded.author_name || "Team"} · {new Date(expanded.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </ScrollView>
              <Pressable onPress={() => setExpanded(null)} style={{ position: "absolute", top: 10, right: 10, backgroundColor: "rgba(0,0,0,0.5)", borderRadius: 16, width: 32, height: 32, alignItems: "center", justifyContent: "center" }}>
                <Text style={{ color: "#fff", fontSize: 16 }}>✕</Text>
              </Pressable>
            </Pressable>
          )}
        </Pressable>
      </Modal>

      {editing && <EditMemoryModal memory={editing} onClose={() => setEditing(null)} onSave={updateMemory} />}
      <AddMemoryModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
    </Screen>
  );
}
