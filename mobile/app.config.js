// Dynamic config (instead of app.json) so we can derive the iOS URL scheme
// that @react-native-google-signin/google-signin needs from the iOS OAuth
// client ID already sitting in .env, instead of hardcoding it twice.
const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
const iosUrlScheme = iosClientId
  ? `com.googleusercontent.apps.${iosClientId.replace(/\.apps\.googleusercontent\.com$/, "")}`
  : undefined;

module.exports = {
  expo: {
    name: "Heubert Tracker",
    slug: "heubert-tracker",
    scheme: "heuberttracker",
    version: "1.0.0",
    orientation: "portrait",
    // Derived from the native dependency set rather than the app version: adding a
    // native module now changes the runtime automatically, so JS updates stop being
    // delivered to binaries that cannot run them. Under the old "appVersion" policy the
    // date picker was added without touching version 1.0.0, and every update since kept
    // flowing to a build with no RNDateTimePicker compiled in.
    runtimeVersion: {
      policy: "fingerprint",
    },
    updates: {
      url: "https://u.expo.dev/457aa50a-7fe6-4a33-a090-0230caf409b5",
    },
    icon: "./assets/icon.png",
    userInterfaceStyle: "automatic",
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.heubert.tracker",
    },
    android: {
      package: "com.heubert.tracker",
      adaptiveIcon: {
        backgroundColor: "#E6F4FE",
        foregroundImage: "./assets/android-icon-foreground.png",
        backgroundImage: "./assets/android-icon-background.png",
        monochromeImage: "./assets/android-icon-monochrome.png",
      },
    },
    web: {
      favicon: "./assets/favicon.png",
      bundler: "metro",
    },
    plugins: [
      "expo-router",
      "expo-status-bar",
      "expo-updates",
      "@react-native-community/datetimepicker",
      [
        "expo-notifications",
        {
          color: "#6366f1",
        },
      ],
      [
        "expo-splash-screen",
        {
          image: "./assets/splash-icon.png",
          imageWidth: 200,
          resizeMode: "contain",
          backgroundColor: "#0b0d14",
        },
      ],
      iosUrlScheme
        ? ["@react-native-google-signin/google-signin", { iosUrlScheme }]
        : "@react-native-google-signin/google-signin",
      [
        "expo-location",
        {
          locationWhenInUsePermission:
            "Heubert Tracker uses your location to confirm you're at the office when you check in or out.",
        },
      ],
      [
        "expo-local-authentication",
        {
          faceIDPermission:
            "Heubert Tracker uses Face ID to confirm it's really you when you check in or out.",
        },
      ],
    ],
    extra: {
      eas: {
        projectId: "457aa50a-7fe6-4a33-a090-0230caf409b5",
      },
    },
  },
};
