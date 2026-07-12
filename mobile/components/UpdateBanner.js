import { useState } from "react";
import { Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Updates from "expo-updates";
import { useThemeColors } from "../lib/theme";

export default function UpdateBanner() {
  const t = useThemeColors();
  const [reloading, setReloading] = useState(false);
  const { isUpdatePending } = Updates.useUpdates();

  if (__DEV__ || !isUpdatePending || reloading) return null;

  return (
    <SafeAreaView edges={["top"]} style={{ backgroundColor: t.accentIndigo }}>
      <Pressable
        onPress={() => {
          setReloading(true);
          Updates.reloadAsync();
        }}
        style={({ pressed }) => ({
          paddingVertical: 10,
          paddingHorizontal: 16,
          alignItems: "center",
          opacity: pressed ? 0.8 : 1,
        })}
      >
        <Text style={{ color: "#fff", fontWeight: "700", fontSize: 13 }}>
          Update ready — tap to restart
        </Text>
      </Pressable>
    </SafeAreaView>
  );
}
