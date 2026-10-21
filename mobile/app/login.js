import { useEffect, useState } from "react";
import { View, Text, Image, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } from "@react-native-google-signin/google-signin";
import { supabase } from "../lib/supabase";
import { useApp } from "../context/AppContext";
import { useThemeColors, fonts, radius } from "../lib/theme";
import { Screen } from "../components/ui";
import Aurora from "../components/Aurora";
import Icon from "../components/Icon";

// The web app's logo (public/logo.png); the same file as the Android adaptive icon's foreground.
const LOGO = require("../assets/android-icon-foreground.png");

// Sign-in, as the canvas's MobileLogin.dc.html: the logo, the badge, the title and the line under
// it in the middle of the page; the error, the Google button and its footnote at the bottom. The
// sign-in itself (Google, then Supabase) and its messages are the ones the screen had before.
// The app's wording stays where the artboard renames it (the badge, the line under the title, the
// button); the footnote is the web's, and the "restricted" line the app had stays under it.
export default function LoginScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user, isAuthReady } = useApp();
  const t = useThemeColors();
  const insets = useSafeAreaInsets();
  const [signingIn, setSigningIn] = useState(false);
  const [errorMsg, setErrorMsg] = useState(
    params.error === "unauthorized" ? "You are unauthorized to access this app." : ""
  );

  useEffect(() => {
    if (isAuthReady && user) {
      router.replace("/");
    }
  }, [isAuthReady, user, router]);

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
      <View style={[styles.center, { backgroundColor: t.ink }]}>
        <Aurora />
        <ActivityIndicator size="large" color={t.primary} />
      </View>
    );
  }

  return (
    <Screen style={[styles.page, { paddingTop: insets.top, paddingBottom: 48 + insets.bottom }]}>
      <View style={styles.main}>
        <View style={[styles.logo, { boxShadow: t.glowPrimaryLg }]}>
          <Image source={LOGO} alt="Heubert Tracker logo" style={styles.logoImage} />
          <View pointerEvents="none" style={[styles.logoRing, { borderColor: t.lineStrong }]} />
        </View>

        <View style={[styles.badge, { backgroundColor: t.pbCyan }]}>
          <View style={[styles.badgeDot, { backgroundColor: t.cyan, boxShadow: t.glow }]} />
          <Text style={[styles.badgeText, { color: t.pfCyan }]}>Internal Portal</Text>
        </View>

        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.text1 }]}>
            Heubert Tracker
          </Text>
          <Text style={[styles.subtitle, { color: t.text2 }]}>
            Internal Team Accountability & Record System.{"\n"}Sign in with your Google account to continue.
          </Text>
        </View>
      </View>

      <View style={styles.signIn}>
        {errorMsg ? (
          <View accessibilityRole="alert" style={[styles.error, { backgroundColor: t.pbRed, borderColor: t.line }]}>
            <Icon name="alert" size={18} strokeWidth={2} color={t.pfRed} style={styles.errorIcon} />
            <Text style={[styles.errorText, { color: t.pfRed }]}>{errorMsg}</Text>
          </View>
        ) : null}

        {signingIn ? (
          <View accessibilityRole="progressbar" accessibilityLabel="Signing you in" style={styles.google}>
            <ActivityIndicator color={t.text2} />
            <Text style={[styles.signingInText, { color: t.text2 }]}>Signing you in…</Text>
          </View>
        ) : (
          <Pressable
            onPress={handleSignIn}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.google,
              styles.googleButton,
              { backgroundColor: pressed ? t.raised : t.surfaceSolid, borderColor: t.lineStrong, borderTopColor: t.glassHi },
            ]}
          >
            <Icon name="key-round" size={20} strokeWidth={1.9} color={t.text1} />
            <Text style={[styles.googleText, { color: t.text1 }]}>Sign in with Google</Text>
          </Pressable>
        )}

        <Text style={[styles.footnote, { color: t.text2 }]}>Use the Google account your team registered</Text>
        <Text style={[styles.restricted, { color: t.text2 }]}>Access restricted to Heubert team members only</Text>
      </View>
    </Screen>
  );
}

// Sizes, gaps and type from MobileLogin.dc.html. Text on the page keeps to text1 and text2 (over
// the light aurora, text3 falls under 4.5:1), so the mono footnote takes text2 where the artboard
// has text-3.
const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  page: { flexGrow: 1, paddingHorizontal: 24 },
  main: { flexGrow: 1, alignItems: "center", justifyContent: "center", gap: 18, paddingTop: 96 },
  logo: { width: 72, height: 72, borderRadius: 18 },
  logoImage: { width: 72, height: 72, borderRadius: 18 },
  // The artboard's `0 0 0 1px` ring: a hairline just outside the logo.
  logoRing: { position: "absolute", top: -1, left: -1, right: -1, bottom: -1, borderRadius: 19, borderWidth: 1 },
  badge: { height: 26, paddingHorizontal: 12, borderRadius: radius.pill, flexDirection: "row", alignItems: "center", gap: 6 },
  badgeDot: { width: 6, height: 6, borderRadius: radius.pill },
  // .08em at 12px.
  badgeText: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 0.96, textTransform: "uppercase" },
  heading: { alignItems: "center", gap: 10 },
  // -0.02em at 34px.
  title: { fontFamily: fonts.display, fontSize: 34, lineHeight: 37, letterSpacing: -0.68, textAlign: "center" },
  subtitle: { maxWidth: 300, fontFamily: fonts.body, fontSize: 16, lineHeight: 24, textAlign: "center" },
  signIn: { gap: 14, paddingTop: 24 },
  error: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  errorIcon: { marginTop: 1 },
  errorText: { flex: 1, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  google: { height: 56, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  googleButton: { borderWidth: 1, borderRadius: 14 },
  googleText: { fontFamily: fonts.bodySemibold, fontSize: 16 },
  signingInText: { fontFamily: fonts.body, fontSize: 14 },
  footnote: { fontFamily: fonts.mono, fontSize: 12, textAlign: "center" },
  restricted: { fontFamily: fonts.body, fontSize: 12, textAlign: "center" },
});
