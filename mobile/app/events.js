import { useState } from "react";
import { View, Text, Pressable, Alert } from "react-native";
import { Stack } from "expo-router";
import { useApp } from "../context/AppContext";
import { useThemeColors } from "../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Button } from "../components/ui";
import AddCompanyEventModal from "../components/AddCompanyEventModal";
import EditCompanyEventModal from "../components/EditCompanyEventModal";

export default function EventsScreen() {
  const { companyEvents, deleteCompanyEvent, isAdmin } = useApp();
  const t = useThemeColors();
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState(null);

  const confirmDelete = (event) => {
    Alert.alert("Delete event?", `"${event.title}"`, [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => deleteCompanyEvent(event.id) },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Events" }} />
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <SectionTitle>📅 Custom Events</SectionTitle>
          {isAdmin && <Button title="+ Add" small onPress={() => setShowAdd(true)} />}
        </View>

        {companyEvents.length === 0 ? (
          <EmptyState text="No custom events recorded." />
        ) : (
          companyEvents.map((event) => (
            <View
              key={event.id}
              style={{ flexDirection: "row", alignItems: "center", borderLeftWidth: 3, borderLeftColor: "#8b5cf6", backgroundColor: t.bgElevated, borderRadius: 8, padding: 12, marginBottom: 8 }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.textPrimary, fontSize: 14, fontWeight: "700" }}>{event.title}</Text>
                <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>
                  {new Date(event.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
                </Text>
              </View>
              {isAdmin && (
                <View style={{ flexDirection: "row", gap: 14 }}>
                  <Pressable onPress={() => setEditing(event)}>
                    <Text style={{ fontSize: 16 }}>✏️</Text>
                  </Pressable>
                  <Pressable onPress={() => confirmDelete(event)}>
                    <Text style={{ color: t.accentRed, fontSize: 18 }}>×</Text>
                  </Pressable>
                </View>
              )}
            </View>
          ))
        )}
      </Card>

      <AddCompanyEventModal isOpen={showAdd} onClose={() => setShowAdd(false)} />
      <EditCompanyEventModal isOpen={!!editing} onClose={() => setEditing(null)} event={editing} />
    </Screen>
  );
}
