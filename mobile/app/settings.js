import { useEffect, useState } from "react";
import { View, Text, Switch, Alert, ActivityIndicator } from "react-native";
import { Stack, useRouter } from "expo-router";
import * as Location from "expo-location";
import { useApp } from "../context/AppContext";
import { useThemeColors } from "../lib/theme";
import { Screen, Card, SectionTitle, Button, TextField } from "../components/ui";

function OfficeSettingsCard() {
  const { officeSettings, updateOfficeSettings } = useApp();
  const t = useThemeColors();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radius, setRadius] = useState("");
  const [lateFineAmount, setLateFineAmount] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (officeSettings) {
      setLatitude(String(officeSettings.latitude));
      setLongitude(String(officeSettings.longitude));
      setRadius(String(officeSettings.radius_meters));
      setLateFineAmount(String(officeSettings.late_fine_amount));
    }
  }, [officeSettings]);

  const useCurrentLocation = async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") throw new Error("Location permission is required.");
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLatitude(String(position.coords.latitude));
      setLongitude(String(position.coords.longitude));
    } catch (err) {
      Alert.alert("Couldn't get location", err.message || "Something went wrong.");
    } finally {
      setLocating(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await updateOfficeSettings({
        latitude: Number(latitude),
        longitude: Number(longitude),
        radius_meters: Number(radius),
        late_fine_amount: Number(lateFineAmount),
      });
      if (error) throw error;
      Alert.alert("Saved", "Office location updated.");
    } catch (err) {
      Alert.alert("Save failed", err.message || "Something went wrong.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <SectionTitle>📍 Office Location</SectionTitle>
      <Text style={{ color: t.textMuted, fontSize: 12, marginBottom: 12 }}>
        Employees must be within this radius to check in or out from the mobile app.
      </Text>
      <TextField label="Latitude" value={latitude} onChangeText={setLatitude} keyboardType="numeric" />
      <TextField label="Longitude" value={longitude} onChangeText={setLongitude} keyboardType="numeric" />
      <TextField label="Radius (meters)" value={radius} onChangeText={setRadius} keyboardType="numeric" />
      <TextField label="Late fine amount (Rs.)" value={lateFineAmount} onChangeText={setLateFineAmount} keyboardType="numeric" />
      <Button
        title={locating ? "Locating…" : "Use My Current Location"}
        variant="ghost"
        disabled={locating}
        onPress={useCurrentLocation}
      />
      <View style={{ height: 10 }} />
      {saving ? <ActivityIndicator color={t.accentIndigo} /> : <Button title="Save" onPress={handleSave} />}
    </Card>
  );
}

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

      {isAdmin ? <OfficeSettingsCard /> : null}

      <Button title="Sign Out" variant="danger" onPress={handleSignOut} />
    </Screen>
  );
}
