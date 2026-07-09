import { View, Text, Switch, Pressable, Alert } from "react-native";
import { Stack, useRouter } from "expo-router";
import { useApp } from "../context/AppContext";
import { useThemeColors } from "../lib/theme";
import { Screen, Card, SectionTitle, Button } from "../components/ui";

export default function SettingsScreen() {
  const { theme, toggleTheme, animationsEnabled, toggleAnimations, signOut, user, isAdmin } = useApp();
  const t = useThemeColors();
  const router = useRouter();

  const handleSignOut = () => {
    Alert.alert("Sign out?", "You'll need to sign in again to continue.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: "Settings" }} />

      <Card>
        <SectionTitle>Account</SectionTitle>
        <Text style={{ color: t.textPrimary, fontSize: 15, fontWeight: "600" }}>{user?.user_metadata?.full_name || user?.email}</Text>
        <Text style={{ color: t.textMuted, fontSize: 13, marginTop: 2 }}>{user?.email}</Text>
        {isAdmin ? <Text style={{ color: t.accentIndigo, fontSize: 12, marginTop: 6, fontWeight: "600" }}>🛡️ Admin</Text> : null}
      </Card>

      <Card>
        <SectionTitle>Preferences</SectionTitle>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <Text style={{ color: t.textPrimary, fontSize: 14 }}>Dark theme</Text>
          <Switch value={theme === "dark"} onValueChange={toggleTheme} trackColor={{ true: t.accentIndigo }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ color: t.textPrimary, fontSize: 14 }}>Animations</Text>
          <Switch value={animationsEnabled} onValueChange={toggleAnimations} trackColor={{ true: t.accentIndigo }} />
        </View>
      </Card>

      <Button title="Sign Out" variant="danger" onPress={handleSignOut} />
    </Screen>
  );
}
