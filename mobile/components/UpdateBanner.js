import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Updates from "expo-updates";
import { useThemeColors, fonts } from "../lib/theme";
import Icon from "./Icon";
import { Button } from "./ui";

// A downloaded update waiting for a restart: a glass strip across the top with a primary Restart.
// It sits above every screen with nothing of the app behind it, so it takes the solid surface
// rather than a translucent one, with the canvas's hairline under it.
export default function UpdateBanner() {
  const t = useThemeColors();
  const [reloading, setReloading] = useState(false);
  const { isUpdatePending } = Updates.useUpdates();

  if (__DEV__ || !isUpdatePending || reloading) return null;

  const restart = () => {
    setReloading(true);
    Updates.reloadAsync();
  };

  return (
    <SafeAreaView edges={["top"]} style={[styles.strip, { backgroundColor: t.surfaceSolid, borderBottomColor: t.line }]}>
      <View accessibilityRole="alert" style={styles.row}>
        <Icon name="download" size={18} strokeWidth={2} color={t.primaryText} />
        <Text style={[styles.text, { color: t.text1 }]}>Update ready</Text>
        <Button title="Restart" icon="refresh" onPress={restart} small />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  strip: { borderBottomWidth: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, paddingHorizontal: 16 },
  text: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 14 },
});
