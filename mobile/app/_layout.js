import { useEffect, useRef } from "react";
import { Platform, StatusBar } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { useFonts } from "expo-font";
import * as Notifications from "expo-notifications";
import { SpaceGrotesk_500Medium } from "@expo-google-fonts/space-grotesk/500Medium";
import { SpaceGrotesk_600SemiBold } from "@expo-google-fonts/space-grotesk/600SemiBold";
import { SpaceGrotesk_700Bold } from "@expo-google-fonts/space-grotesk/700Bold";
import { IBMPlexSans_400Regular } from "@expo-google-fonts/ibm-plex-sans/400Regular";
import { IBMPlexSans_400Regular_Italic } from "@expo-google-fonts/ibm-plex-sans/400Regular_Italic";
import { IBMPlexSans_500Medium } from "@expo-google-fonts/ibm-plex-sans/500Medium";
import { IBMPlexSans_600SemiBold } from "@expo-google-fonts/ibm-plex-sans/600SemiBold";
import { JetBrainsMono_400Regular } from "@expo-google-fonts/jetbrains-mono/400Regular";
import { JetBrainsMono_500Medium } from "@expo-google-fonts/jetbrains-mono/500Medium";
import { AppProvider, useApp } from "../context/AppContext";
import { configureGoogleSignIn } from "../lib/googleSignIn";
import HumanLoader from "../components/HumanLoader";
import UpdateBanner from "../components/UpdateBanner";

configureGoogleSignIn();

// The families lib/tokens.js names in `fonts`. Each import is a single weight's file (not the
// package index, which pulls in every weight), so the app ships exactly these nine fonts.
const FONT_FILES = {
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
  IBMPlexSans_400Regular,
  IBMPlexSans_400Regular_Italic,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
};

// Light text on the dark ink, dark text on the light ink.
function ThemedStatusBar() {
  const { theme } = useApp();
  return <StatusBar barStyle={theme === "light" ? "dark-content" : "light-content"} />;
}

// A tapped push notification opens what it's about. Task notifications (sent by the web's
// /api/task-notifications) carry { type: "task", issue: "POR-4" }; the others open the app as
// before. Also handles the tap that launched the app. Mounted only once someone is signed in.
function NotificationTaps() {
  const router = useRouter();
  const response = Notifications.useLastNotificationResponse();
  const handled = useRef(null);
  useEffect(() => {
    const id = response?.notification?.request?.identifier;
    const data = response?.notification?.request?.content?.data;
    if (!id || handled.current === id) return;
    handled.current = id;
    if (data?.type === "task" && typeof data.issue === "string") {
      router.push({ pathname: "/tasks", params: { issue: data.issue, at: String(Date.now()) } });
    }
  }, [response, router]);
  return null;
}

function AuthGate({ children, fontsReady }) {
  const { user, isAuthReady, isLoaded, currentEmployee } = useApp();
  const router = useRouter();
  const segments = useSegments();

  const isAuthorized = user && currentEmployee && currentEmployee.status === "active";
  const onLoginScreen = segments[0] === "login";

  useEffect(() => {
    // No navigating while the loader stands in for the Stack: the router has nothing mounted.
    if (!fontsReady || !isLoaded || !isAuthReady) return;
    if (!user && !onLoginScreen) {
      router.replace("/login");
    } else if (user && isAuthorized && onLoginScreen) {
      router.replace("/");
    }
  }, [fontsReady, isLoaded, isAuthReady, user, isAuthorized, onLoginScreen]);

  if (!fontsReady || !isLoaded || !isAuthReady || (user && !isAuthorized && !onLoginScreen)) {
    return <HumanLoader />;
  }

  return (
    <>
      {/* Not on web, where the What's new screenshots are taken: it has no notifications. */}
      {user && isAuthorized && Platform.OS !== "web" ? <NotificationTaps /> : null}
      {children}
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(FONT_FILES);
  // The loader stays until the fonts are in or have failed. A failure never blocks the app: text
  // falls back to the system font.
  const fontsReady = fontsLoaded || Boolean(fontError);

  return (
    <AppProvider>
      <ThemedStatusBar />
      <UpdateBanner />
      <AuthGate fontsReady={fontsReady}>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
    </AppProvider>
  );
}
