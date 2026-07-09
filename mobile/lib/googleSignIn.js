import { GoogleSignin } from "@react-native-google-signin/google-signin";

let configured = false;

// GoogleSignin needs the WEB client ID (not the Android/iOS one) — the
// idToken it returns is always issued for that audience, and it's the same
// client ID Supabase's Google provider + the Next.js web app already trust.
export function configureGoogleSignIn() {
  if (configured) return;
  GoogleSignin.configure({
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  });
  configured = true;
}
