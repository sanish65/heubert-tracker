import { useEffect } from "react";
import { StatusBar } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { AppProvider, useApp } from "../context/AppContext";
import { configureGoogleSignIn } from "../lib/googleSignIn";
import HumanLoader from "../components/HumanLoader";
import UpdateBanner from "../components/UpdateBanner";

configureGoogleSignIn();

function AuthGate({ children }) {
  const { user, isAuthReady, isLoaded, currentEmployee } = useApp();
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
    return <HumanLoader />;
  }

  return children;
}

export default function RootLayout() {
  return (
    <AppProvider>
      <StatusBar barStyle="light-content" />
      <UpdateBanner />
      <AuthGate>
        <Stack screenOptions={{ headerShown: false }} />
      </AuthGate>
    </AppProvider>
  );
}
