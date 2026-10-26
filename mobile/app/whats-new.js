import { useCallback, useEffect, useState } from "react";
import { View, Text, Image, Modal, Pressable, ScrollView, StyleSheet } from "react-native";
import { useFocusEffect } from "expo-router";
import { useGoBack } from "../lib/useGoBack";
import { supabase, API_BASE_URL } from "../lib/supabase";
import { useThemeColors, fonts } from "../lib/theme";
import { Screen, ScreenHeader, Card, Chip, Pill, EmptyState } from "../components/ui";

// What's new, as the web's ReleaseUpdatesModal: the tracker on a desktop and a phone, feature by
// feature, and the release notes, from the deployed web app's GET /api/whats-new. The content ships
// with the web, so it is current without an app update; screenshot links are signed and expire.

const PLATFORM_LABEL = { web: "Web", mobile: "Mobile" };
// Captured sizes (scripts/capture-whats-new.mjs): web 1440×900, mobile 390×844.
const SHOT_RATIO = { web: 1440 / 900, mobile: 390 / 844 };

// How long the showcase stays on a feature before moving to the next.
const SHOWCASE_MS = 5000;
// The device frames are hardware: a dark bezel and screen in both themes, and a fixed grey for
// the note on an empty screen.
const BEZEL = "#0B0F1A";
const SCREEN = "#070A12";
const SCREEN_NOTE = "#8E98AC";

const eyebrowFor = (f) => (f.onWeb && f.onMobile ? "ON DESKTOP AND MOBILE" : f.onWeb ? "ONLY ON THE WEB" : "ONLY IN THE MOBILE APP");

// One device's screen: the feature's screenshot, or why there is none.
function DeviceScreen({ feature, platform, uri, onZoom, style }) {
  const shot = feature[platform];
  const available = platform === "web" ? feature.onWeb : feature.onMobile;
  const frame = [style, { borderColor: BEZEL, backgroundColor: SCREEN }];
  if (!shot) {
    return (
      <View style={[frame, styles.screenEmpty]}>
        <Text style={styles.screenNote}>{available ? "Screenshot coming soon" : `Not in the ${platform} app`}</Text>
      </View>
    );
  }
  return (
    <Pressable
      onPress={() => onZoom(feature, platform)}
      accessibilityRole="imagebutton"
      accessibilityLabel={`Enlarge ${feature.title} on ${platform === "web" ? "desktop" : "mobile"}`}
      style={frame}
    >
      <Image source={{ uri: uri(shot) }} style={styles.fill} resizeMode="cover" />
    </Pressable>
  );
}

// As the web's Showcase, and the whole Features tab: the tracker on a desktop monitor with a phone
// in front of it, the same feature on both, moving through every feature; a chip picks one, a tap
// on either screen enlarges it.
function Showcase({ features, uri, onZoom }) {
  const t = useThemeColors();
  const shown = features.filter((f) => f.web || f.mobile);
  const [index, setIndex] = useState(0);

  // A fresh SHOWCASE_MS after every change, so a picked feature gets its full time.
  useEffect(() => {
    if (shown.length < 2) return undefined;
    const timer = setTimeout(() => setIndex((i) => (i + 1) % shown.length), SHOWCASE_MS);
    return () => clearTimeout(timer);
  }, [index, shown.length]);

  if (shown.length === 0) return <EmptyState icon="gift" text="No screenshots yet." />;
  const current = shown[index % shown.length];

  return (
    <Card style={styles.showcase}>
      <View style={styles.devices}>
        <View style={styles.desktop}>
          <DeviceScreen feature={current} platform="web" uri={uri} onZoom={onZoom} style={styles.desktopScreen} />
          <View style={[styles.neck, { backgroundColor: BEZEL }]} />
          <View style={[styles.foot, { backgroundColor: BEZEL }]} />
        </View>
        <View style={styles.phone}>
          <DeviceScreen feature={current} platform="mobile" uri={uri} onZoom={onZoom} style={styles.phoneScreen} />
        </View>
      </View>
      <Text style={[styles.date, { color: t.cyanText }]}>{eyebrowFor(current)}</Text>
      <Text style={[styles.showcaseTitle, { color: t.text1 }]}>{current.title}</Text>
      <Text style={[styles.body, { color: t.text2 }]}>{current.summary}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.showcaseChips}>
        {shown.map((f, i) => (
          <Chip key={f.id} label={f.title} active={i === index % shown.length} onPress={() => setIndex(i)} />
        ))}
      </ScrollView>
    </Card>
  );
}

const releaseDate = (ymd) =>
  new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

export default function WhatsNewScreen() {
  const t = useThemeColors();
  const goBack = useGoBack();
  const [state, setState] = useState({ data: null, isLoading: true, error: "" });
  const [view, setView] = useState("features");
  const [zoomed, setZoomed] = useState(null); // { feature, platform } of the enlarged screenshot

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      (async () => {
        if (!API_BASE_URL) {
          setState({ data: null, isLoading: false, error: "The app has no web address set (EXPO_PUBLIC_API_BASE_URL)." });
          return;
        }
        try {
          const { data } = await supabase.auth.getSession();
          const token = data?.session?.access_token;
          const res = await fetch(`${API_BASE_URL}/api/whats-new`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
          if (!res.ok) throw new Error();
          const body = await res.json();
          if (!cancelled) setState({ data: body, isLoading: false, error: "" });
        } catch {
          if (!cancelled) setState((prev) => ({ ...prev, isLoading: false, error: "Couldn't load what's new. Try again in a moment." }));
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const features = state.data?.features || [];
  const releases = state.data?.releases || [];
  const uri = (path) => `${API_BASE_URL}${path}`;

  return (
    <Screen>
      <ScreenHeader title="What's new" subtitle="Everything the tracker does, on both apps" onBack={goBack} />

      <View style={styles.chips}>
        <Chip label="Features" active={view === "features"} onPress={() => setView("features")} />
        <Chip label="Updates" active={view === "updates"} onPress={() => setView("updates")} />
      </View>

      {state.isLoading ? (
        <EmptyState icon="gift" text="Loading what's new…" />
      ) : state.error ? (
        <EmptyState icon="gift" text={state.error} />
      ) : view === "features" ? (
        <Showcase features={features} uri={uri} onZoom={(feature, on) => setZoomed({ feature, platform: on })} />
      ) : releases.length === 0 ? (
        <EmptyState icon="gift" text="No release notes yet." />
      ) : (
        releases.map((r) => (
          <Card key={`${r.date}-${r.title}`} style={styles.card}>
            <View style={styles.releaseHead}>
              <Text style={[styles.date, { color: t.cyanText }]}>{releaseDate(r.date).toUpperCase()}</Text>
              <View style={styles.pills}>
                {(r.platforms || []).map((p) => (
                  <Pill key={p} tone={p === "mobile" ? "violet" : "blue"}>
                    {PLATFORM_LABEL[p] || p}
                  </Pill>
                ))}
              </View>
            </View>
            <Text style={[styles.title, { color: t.text1 }]}>{r.title}</Text>
            {(r.notes || []).map((n, i) => (
              <View key={i} style={styles.note}>
                <Text style={[styles.body, { color: t.text3 }]}>•</Text>
                <Text style={[styles.body, styles.noteText, { color: t.text2 }]}>{n}</Text>
              </View>
            ))}
          </Card>
        ))
      )}

      <Modal visible={!!zoomed} transparent animationType="fade" onRequestClose={() => setZoomed(null)}>
        <Pressable style={styles.zoom} onPress={() => setZoomed(null)} accessibilityLabel="Close">
          {zoomed?.feature[zoomed.platform] ? (
            <Image source={{ uri: uri(zoomed.feature[zoomed.platform]) }} style={[styles.zoomImg, { aspectRatio: SHOT_RATIO[zoomed.platform] }]} resizeMode="contain" />
          ) : null}
          <Text style={styles.zoomCaption}>{zoomed?.feature.title} · tap to close</Text>
        </Pressable>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  showcase: { marginBottom: 16, gap: 6 },
  // The phone sits over the monitor's bottom-right corner.
  devices: { paddingRight: "12%", paddingBottom: 8, marginBottom: 10 },
  desktop: { width: "100%" },
  desktopScreen: { aspectRatio: 16 / 10, borderWidth: 6, borderBottomWidth: 9, borderRadius: 10, overflow: "hidden" },
  neck: { alignSelf: "center", width: "14%", height: 12 },
  foot: { alignSelf: "center", width: "34%", height: 4, borderRadius: 3 },
  phone: { position: "absolute", right: 0, bottom: 0, width: "28%" },
  phoneScreen: { aspectRatio: 390 / 844, borderWidth: 4, borderRadius: 18, overflow: "hidden" },
  screenEmpty: { alignItems: "center", justifyContent: "center", padding: 8 },
  screenNote: { color: SCREEN_NOTE, fontFamily: fonts.body, fontSize: 11, textAlign: "center" },
  fill: { width: "100%", height: "100%" },
  showcaseTitle: { fontFamily: fonts.display, fontSize: 22 },
  showcaseChips: { gap: 6, paddingTop: 8 },
  chips: { flexDirection: "row", gap: 8, marginBottom: 12 },
  card: { marginBottom: 12, gap: 6 },
  title: { fontFamily: fonts.bodySemibold, fontSize: 16 },
  body: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  releaseHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  date: { fontFamily: fonts.mono, fontSize: 12, letterSpacing: 1 },
  pills: { flexDirection: "row", gap: 6 },
  note: { flexDirection: "row", gap: 8 },
  noteText: { flex: 1 },
  zoom: { flex: 1, backgroundColor: "rgba(4, 6, 12, 0.92)", alignItems: "center", justifyContent: "center", padding: 16, gap: 12 },
  zoomImg: { width: "100%", maxHeight: "88%" },
  // On the dark scrim in both themes, so a fixed light grey (the dark theme's text2), not a token.
  zoomCaption: { color: "#B6BFCF", fontFamily: fonts.body, fontSize: 13 },
});
