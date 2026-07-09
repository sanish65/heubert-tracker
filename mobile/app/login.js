import { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";

export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, isAuthReady } = useApp();
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState(
    params.error === "unauthorized" ? "You are unauthorized to access this app." : ""
  );

  useEffect(() => {
    if (isAuthReady && user) {
      router.replace("/");
    }
  }, [isAuthReady, user]);

  const handleSignIn = async () => {
    setErrorMsg("");
    setSigningIn(true);
    try {
      await GoogleSignin.hasPlayServices();
      const response = await GoogleSignin.signIn();
      if (!isSuccessResponse(response)) return; // user cancelled

      const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.data.idToken,
      });
      if (error) setErrorMsg(error.message);
    } catch (err) {
      if (isErrorWithCode(err)) {
        if (err.code === statusCodes.SIGN_IN_CANCELLED) {
          // no-op, user backed out
        } else if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
          setErrorMsg("Google Play Services is required to sign in.");
        } else {
          setErrorMsg(err.message || "Sign-in failed.");
        }
      } else {
        setErrorMsg(err.message || "Sign-in failed.");
      }
    } finally {
      setSigningIn(false);
    }
  };

  if (!isAuthReady) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <Text style={styles.logo}>⏰</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>Internal Portal</Text>
        </View>
        <Text style={styles.title}>Heubert Tracker</Text>
        <Text style={styles.subtitle}>
          Internal Team Accountability & Record System.{"\n"}Sign in with your Google account to continue.
        </Text>

        {errorMsg ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{errorMsg}</Text>
          </View>
        ) : null}

        {signingIn ? (
          <View style={styles.signingIn}>
            <ActivityIndicator color="#9ca3af" />
            <Text style={styles.signingInText}>Signing you in…</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [styles.googleBtn, pressed && styles.googleBtnPressed]}
            onPress={handleSignIn}
          >
            <Text style={styles.googleBtnText}>Sign in with Google</Text>
          </Pressable>
        )}

        <Text style={styles.footer}>Access restricted to Heubert team members only</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b0d14",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#0b0d14" },
  card: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "rgba(17,24,39,0.9)",
    borderRadius: 24,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    padding: 32,
    alignItems: "center",
  },
  logo: { fontSize: 40, marginBottom: 16 },
  badge: {
    backgroundColor: "rgba(34,197,94,0.1)",
    borderWidth: 1,
    borderColor: "rgba(34,197,94,0.2)",
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginBottom: 16,
  },
  badgeText: { color: "#22c55e", fontSize: 12, fontWeight: "600" },
  title: { color: "#fff", fontSize: 26, fontWeight: "800", marginBottom: 8 },
  subtitle: { color: "#9ca3af", fontSize: 14, textAlign: "center", marginBottom: 28, lineHeight: 20 },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.3)",
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
    width: "100%",
  },
  errorText: { color: "#fca5a5", fontSize: 14 },
  googleBtn: {
    backgroundColor: "#1f2430",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.15)",
    borderRadius: 999,
    paddingVertical: 12,
    paddingHorizontal: 28,
    width: "100%",
    alignItems: "center",
  },
  googleBtnPressed: { opacity: 0.7 },
  googleBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  signingIn: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 12 },
  signingInText: { color: "#9ca3af", fontSize: 14 },
  footer: { color: "#4b5563", fontSize: 12, marginTop: 28, textAlign: "center" },
});
