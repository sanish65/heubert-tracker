import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { supabase } from "./supabase";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Requests permission, registers for an Expo push token, and upserts it
// against the signed-in employee so the server can target it later.
export async function registerForPushNotificationsAsync(employeeName) {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== "granted" || !employeeName) return null;

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: expoPushToken } = await Notifications.getExpoPushTokenAsync({ projectId });

    await supabase
      .from("push_tokens")
      .upsert(
        { employee_name: employeeName, expo_push_token: expoPushToken, platform: Platform.OS },
        { onConflict: "expo_push_token" }
      );

    return expoPushToken;
  } catch (err) {
    console.error("Push registration failed:", err);
    return null;
  }
}
