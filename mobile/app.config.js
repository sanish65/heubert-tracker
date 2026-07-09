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
    ],
    extra: {
      eas: {
        projectId: "457aa50a-7fe6-4a33-a090-0230caf409b5",
      },
    },
  },
};
