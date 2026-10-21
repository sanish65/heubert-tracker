import { useEffect, useState } from "react";
import { View, Text, Switch, Pressable, Alert, ActivityIndicator, StyleSheet } from "react-native";
import { useGoBack } from "../lib/useGoBack";
import Constants from "expo-constants";
import * as Location from "expo-location";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Screen, ScreenHeader, Card, Eyebrow, Button, TextField, Pill } from "../components/ui";
import Avatar from "../components/Avatar";
import Icon from "../components/Icon";

// Settings, as the canvas's MobileSettings.dc.html: Back to More, your account with Sign Out, the
// theme and the animations, the office location (admins only, as before), then the app's version.
// Every action calls AppContext as before.

// The version in the app's config (app.config.js), as the build or update running on the phone has it.
const APP_VERSION = Constants.expoConfig?.version;

// The app's two themes. The canvas offers a third, System, which the app does not have.
const THEMES = [
  { value: "dark", label: "Dark", icon: "moon" },
  { value: "light", label: "Light", icon: "sun" },
];

// A card's mono caps title, as the canvas's, read out as a heading.
function CardTitle({ children, style }) {
  return (
    <View accessible accessibilityRole="header" style={style}>
      <Eyebrow style={styles.cardTitle}>{children}</Eyebrow>
    </View>
  );
}

// The canvas's segmented control. The other theme flips to it (toggleTheme, which saves the choice
// as before); the chosen one does nothing.
function ThemeChoice() {
  const { theme, toggleTheme } = useApp();
  const t = useThemeColors();
  return (
    <View style={styles.theme}>
      <Text style={[styles.prefLabel, { color: t.text1 }]}>Theme</Text>
      <View accessibilityRole="radiogroup" accessibilityLabel="Theme" style={[styles.segment, { borderColor: t.line, backgroundColor: t.raised }]}>
        {THEMES.map((option) => {
          const chosen = option.value === theme;
          const color = chosen ? "#FFFFFF" : t.text2;
          return (
            <Pressable
              key={option.value}
              onPress={() => {
                if (!chosen) toggleTheme();
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: chosen }}
              style={({ pressed }) => [
                styles.segmentOption,
                chosen ? { backgroundColor: t.primary, boxShadow: t.glowPrimarySm } : pressed && { backgroundColor: t.pbGray },
              ]}
            >
              <Icon name={option.icon} size={16} color={color} />
              <Text style={[styles.segmentText, { color, fontFamily: chosen ? fonts.bodySemibold : fonts.bodyMedium }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

// A number field of the office card, the canvas's: mono, 48 high, with its unit drawn inside ("Rs."
// before the amount, "m" after the radius). TextField keeps 14 under itself, so the unit sits 14 up.
function OfficeField({ label, value, onChangeText, prefix, suffix }) {
  const t = useThemeColors();
  const unit = prefix || suffix;
  return (
    <View style={styles.officeField}>
      <TextField
        label={label}
        value={value}
        onChangeText={onChangeText}
        keyboardType="numeric"
        style={[styles.officeInput, prefix && styles.officeInputPrefix, suffix && styles.officeInputSuffix]}
      />
      {unit ? (
        <View style={[styles.unit, prefix ? styles.unitBefore : styles.unitAfter]}>
          <Text style={[styles.unitText, { color: t.text3 }]}>{unit}</Text>
        </View>
      ) : null}
    </View>
  );
}

function OfficeSettingsCard() {
  const { officeSettings, updateOfficeSettings } = useApp();
  const t = useThemeColors();
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [radiusMeters, setRadiusMeters] = useState("");
  const [lateFineAmount, setLateFineAmount] = useState("");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (officeSettings) {
      setLatitude(String(officeSettings.latitude));
      setLongitude(String(officeSettings.longitude));
      setRadiusMeters(String(officeSettings.radius_meters));
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
        radius_meters: Number(radiusMeters),
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
    <Card style={styles.office}>
      <View style={styles.officeHead}>
        <CardTitle style={styles.officeTitle}>Admin · Office location</CardTitle>
        <Pill tone="blue">Admin only</Pill>
      </View>
      <View style={styles.officeNote}>
        <Icon name="pin" size={18} color={t.text3} style={styles.officeNoteIcon} />
        <Text style={[styles.officeNoteText, { color: t.text3 }]}>
          Employees must be within this radius to check in or out from the mobile app.
        </Text>
      </View>
      {/* Two by two, as the canvas; a label that wraps keeps its field level with its neighbour. */}
      <View style={styles.fields}>
        <View style={[styles.fieldRow, styles.fieldRowFirst]}>
          <OfficeField label="Latitude" value={latitude} onChangeText={setLatitude} />
          <OfficeField label="Longitude" value={longitude} onChangeText={setLongitude} />
        </View>
        <View style={styles.fieldRow}>
          <OfficeField label="Radius (meters)" value={radiusMeters} onChangeText={setRadiusMeters} suffix="m" />
          <OfficeField label="Late fine amount (Rs.)" value={lateFineAmount} onChangeText={setLateFineAmount} prefix="Rs." />
        </View>
      </View>
      <Button
        title={locating ? "Locating…" : "Use My Current Location"}
        variant="secondary"
        icon="crosshair"
        disabled={locating}
        onPress={useCurrentLocation}
        style={styles.locate}
      />
      {saving ? (
        <View style={styles.saving}>
          <ActivityIndicator color={t.primary} />
        </View>
      ) : (
        <Button title="Save" icon="check" onPress={handleSave} style={[styles.save, { boxShadow: t.glowPrimary }]} />
      )}
    </Card>
  );
}

export default function SettingsScreen() {
  const { animationsEnabled, toggleAnimations, signOut, user, currentEmployee, isAdmin } = useApp();
  const t = useThemeColors();
  const goBack = useGoBack();
  // The name your avatar is drawn from, as the top bar's account button.
  const myName = currentEmployee?.name || user?.user_metadata?.full_name || user?.email || "";

  const handleSignOut = () => {
    Alert.alert("Sign out?", "You'll need to sign in again to continue.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: signOut },
    ]);
  };

  return (
    <Screen>
      <ScreenHeader title="Settings" onBack={goBack} />

      <Card style={styles.account}>
        <CardTitle>Account</CardTitle>
        <View style={styles.who}>
          <Avatar name={myName} size={56} isMe />
          <View style={styles.whoText}>
            <Text numberOfLines={1} style={[styles.name, { color: t.text1 }]}>
              {user?.user_metadata?.full_name || user?.email}
            </Text>
            <Text numberOfLines={1} style={[styles.email, { color: t.text3 }]}>
              {user?.email}
            </Text>
            {isAdmin ? (
              <View style={[styles.adminPill, { backgroundColor: t.pbBlue }]}>
                <Icon name="shield" size={12} strokeWidth={2} color={t.pfBlue} />
                <Text style={[styles.adminPillText, { color: t.pfBlue }]}>Admin</Text>
              </View>
            ) : null}
          </View>
        </View>
        <Button title="Sign Out" variant="danger" icon="logout" onPress={handleSignOut} style={[styles.signOut, { borderColor: t.lineStrong }]} />
      </Card>

      <Card style={styles.preferences}>
        <CardTitle style={styles.preferencesTitle}>Preferences</CardTitle>
        <ThemeChoice />
        <View style={[styles.switchRow, { borderTopColor: t.line }]}>
          <View style={[styles.switchIcon, { backgroundColor: t.pbViolet }]}>
            <Icon name="sparkle" size={17} color={t.pfViolet} />
          </View>
          <View style={styles.switchText}>
            <Text style={[styles.prefLabel, { color: t.text1 }]}>Animations</Text>
            <Text style={[styles.switchNote, { color: t.text3 }]}>Motion on cards and transitions</Text>
          </View>
          <Switch value={animationsEnabled} onValueChange={toggleAnimations} trackColor={{ true: t.primary }} accessibilityLabel="Animations" />
        </View>
      </Card>

      {isAdmin ? <OfficeSettingsCard /> : null}

      {APP_VERSION ? (
        <Card style={styles.about}>
          <CardTitle style={styles.aboutTitle}>About</CardTitle>
          <View style={[styles.aboutRow, { borderTopColor: t.line }]}>
            <Text style={[styles.aboutLabel, { color: t.text1 }]}>App version</Text>
            <Text style={[styles.aboutValue, { color: t.text2 }]}>v{APP_VERSION}</Text>
          </View>
        </Card>
      ) : null}
    </Screen>
  );
}

// Sizes, gaps and type from MobileSettings.dc.html: 20-radius glass cards 14 apart, 16 by 18 in.
const styles = StyleSheet.create({
  // The canvas's titles are the mono caps at 500.
  cardTitle: { fontFamily: fonts.monoMedium },

  // Account: 14 between the title, you and Sign Out.
  account: { borderRadius: radius.xl, gap: 14 },
  who: { flexDirection: "row", alignItems: "center", gap: 14 },
  whoText: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontFamily: fonts.display, fontSize: 18 },
  email: { fontFamily: fonts.mono, fontSize: 12 },
  adminPill: {
    alignSelf: "flex-start",
    marginTop: 3,
    height: 22,
    paddingHorizontal: 8,
    borderRadius: radius.pill,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  adminPillText: { fontFamily: fonts.bodySemibold, fontSize: 12 },
  signOut: { minHeight: 48, borderRadius: radius.md },

  // Preferences: 6 under the last row, which brings its own height.
  preferences: { borderRadius: radius.xl, paddingBottom: 6 },
  preferencesTitle: { marginBottom: 12 },
  prefLabel: { fontFamily: fonts.bodyMedium, fontSize: 15 },
  theme: { gap: 8, paddingBottom: 14 },
  segment: { flexDirection: "row", gap: 4, padding: 4, borderWidth: 1, borderRadius: 14 },
  segmentOption: { flex: 1, height: 44, borderRadius: radius.sm, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  segmentText: { fontSize: 14 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 56, paddingVertical: 8, borderTopWidth: 1 },
  switchIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: "center", justifyContent: "center" },
  switchText: { flex: 1, minWidth: 0 },
  switchNote: { fontFamily: fonts.body, fontSize: 13 },

  // Office location: 14 between its parts, 18 under Save.
  office: { borderRadius: radius.xl, paddingBottom: 18, gap: 14 },
  officeHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  officeTitle: { flex: 1 },
  officeNote: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  officeNoteIcon: { marginTop: 1 },
  officeNoteText: { flex: 1, fontFamily: fonts.body, fontSize: 13, lineHeight: 19.5 },
  // The fields 10 apart each way. Each TextField keeps 14 under itself: the first row takes 4 of it
  // back, the last all of it, so the card's own 14 follows.
  fields: { marginBottom: -14 },
  fieldRow: { flexDirection: "row", alignItems: "flex-end", gap: 10 },
  fieldRowFirst: { marginBottom: -4 },
  officeField: { flex: 1, minWidth: 0 },
  officeInput: { minHeight: 48, borderRadius: radius.md, fontFamily: fonts.mono, fontSize: 13 },
  officeInputPrefix: { paddingLeft: 44 },
  officeInputSuffix: { paddingRight: 34 },
  // Over the field but never in the way of a tap on it.
  unit: { position: "absolute", bottom: 14, height: 48, justifyContent: "center", pointerEvents: "none" },
  unitBefore: { left: 12 },
  unitAfter: { right: 12 },
  unitText: { fontFamily: fonts.mono, fontSize: 12 },
  locate: { minHeight: 48, borderRadius: radius.md },
  save: { minHeight: 50, borderRadius: radius.md },
  saving: { minHeight: 50, alignItems: "center", justifyContent: "center" },

  // About: the rows 52 high on a hairline, 14 under the last.
  about: { borderRadius: radius.xl, paddingBottom: 14 },
  aboutTitle: { marginBottom: 8 },
  aboutRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderTopWidth: 1 },
  aboutLabel: { flex: 1, fontFamily: fonts.body, fontSize: 15 },
  aboutValue: { fontFamily: fonts.mono, fontSize: 13 },
});
