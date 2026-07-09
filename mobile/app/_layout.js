import { useEffect } from "react";
import { View, ActivityIndicator, StatusBar } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { AppProvider, useApp } from "../context/AppContext";
import { themes } from "../lib/theme";
import { configureGoogleSignIn } from "../lib/googleSignIn";

configureGoogleSignIn();

function AuthGate({ children }) {
  const { user, isAuthReady, isLoaded, currentEmployee, theme } = useApp();
  const router = useRouter();
  const segments = useSegments();

  const isAuthorized = user && currentEmployee && currentEmployee.status === "active";
  const onLoginScreen = segments[0] === "login";

  useEffect(() => {
    if (!isLoaded || !isAuthReady) return;
    if (!user && !onLoginScreen) {
      router.replace("/login");
    } else if (user && isAuthorized && onLoginScreen) {
      router.replace("/");
    }
  }, [isLoaded, isAuthReady, user, isAuthorized, onLoginScreen]);

  if (!isLoaded || !isAuthReady || (user && !isAuthorized && !onLoginScreen)) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: themes[theme].bg,
        }}
      >
        <ActivityIndicator size="large" color={themes[theme].accentIndigo} />
      </View>
    );
  }

  return children;
}

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar barStyle="light-content" />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
    </AppProvider>
  );
}
