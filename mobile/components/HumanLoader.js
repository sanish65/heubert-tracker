import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Animated, Easing, ActivityIndicator, StyleSheet } from "react-native";
import Svg, { Rect, Line, Ellipse, Circle } from "react-native-svg";
import { useApp } from "../context/AppContext";
import { useThemeColors } from "../lib/theme";

const AVATAR_SIZE = 72;
// Web draws the avatar at 100px and positions every prop against that box; keep the
// offsets proportional so the flute and the emoji land in the same spot relative to it.
const WEB_AVATAR = 100;
const SCALE = AVATAR_SIZE / WEB_AVATAR;

const TRACK_WIDTH = 200;
const TRACK_HEIGHT = 4;

const greetings = ["Hi!", "Hello!", "Hey there!", "Welcome!", "Greetings!"];

const knownBoys = [
  "sanish", "jenish", "dinesh", "nikhil", "nitesh",
  "aashish", "bikesh", "pranay", "ankit", "bipin", "nikesh",
];
const knownGirls = ["pratisha", "merisha", "prativa", "nebula"];
const defaultNames = [...knownBoys, ...knownGirls];

// Mirrors the greeting cascade in the web app's src/components/HumanLoader.js.
const customGreetings = {
  dinesh: "Hello!",
  pratisha: "Lets register the marathon guys, hurry up!!",
  jenish: "Jerry is my game code",
  nitesh: "Hi, Its me Nitesh!",
  bikesh: "केही मीठो बात गर, रात त्यसै ढल्किँदै छ!",
  pranay: "प्रणाम from प्रणय!!!",
  sanish: "when it rains, its rainy!!",
  aashish: "Hi, Nice to meet you!!!!",
  nikhil: "सपनीमा मुसुक्क हाँसी, कहाँ गयौ तिमी ट्याक्सीमा?!",
  prativa: "Data is my game",
  merisha: "Merisha_breezy ForEver!!",
  amogh: "Am I audible!",
  ankit: "Bikesh dai is my favourite!",
  bipin: "Greetings!",
  nebula: "Hi!",
  nikesh: "Namastey!",
};

const wearsGlasses = [
  "sanish", "bikesh", "merisha", "jenish", "nikhil",
  "pratisha", "prativa", "amogh", "bipin", "nikesh", "nebula",
];
const hasBeard = ["sanish", "dinesh"];

// One decorative prop per person, matching the web app's per-name CSS keyframes. Durations
// are that animation's cycle length in ms. Sanish's is a drawn flute rather than an emoji.
const props = {
  aashish: { emoji: "🎸", duration: 300 },
  nikhil: { emoji: "🎤", duration: 500 },
  nitesh: { emoji: "🥁", duration: 300 },
  jenish: { emoji: "🏋️‍♂️", duration: 1000 },
  prativa: { emoji: "📈", duration: 1500 },
  dinesh: { emoji: "🥚", duration: 800 },
  pratisha: { emoji: "📋", duration: 1200 },
  bikesh: { emoji: "🚴", duration: 500 },
  pranay: { emoji: "🧘", duration: 2000 },
  sanish: { flute: true, duration: 600 },
};

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

export default function HumanLoader() {
  const { employees, animationsEnabled } = useApp() || { employees: [], animationsEnabled: true };
  const t = useThemeColors();
  const [index, setIndex] = useState(0);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [shuffledDefaults, setShuffledDefaults] = useState(defaultNames);

  const bubbleOpacity = useRef(new Animated.Value(0)).current;
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    setShuffledDefaults(shuffle(defaultNames));
  }, []);

  const names =
    employees && employees.length > 0
      ? employees
          .map((e) => e.name.split(" ")[0])
          .filter((n) => {
            const l = n.toLowerCase();
            return l !== "developer" && l !== "developers" && l !== "bhoomi" && l !== "sameer" && l !== "samir";
          })
      : shuffledDefaults;

  useEffect(() => {
    if (animationsEnabled === false) return;
    const cycleInterval = setInterval(() => setIndex((prev) => (prev + 1) % names.length), 1500);
    const greetInterval = setInterval(() => setGreetingIndex((prev) => (prev + 1) % greetings.length), 3000);
    return () => {
      clearInterval(cycleInterval);
      clearInterval(greetInterval);
    };
  }, [names.length, animationsEnabled]);

  useEffect(() => {
    bubbleOpacity.setValue(0);
    Animated.timing(bubbleOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
  }, [greetingIndex, index]);

  const currentName = names[index] || "Employee";
  const nameKey = currentName.toLowerCase();
  const personProps = props[nameKey];

  useEffect(() => {
    if (animationsEnabled === false || !personProps) return;
    bounce.setValue(0);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: personProps.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: personProps.duration, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [nameKey, animationsEnabled]);

  const isGirl = knownGirls.includes(nameKey);
  const hairParam = isGirl ? "full,pixie" : "fonze,mrT,dannyPhantom";
  const glassesParam = wearsGlasses.includes(nameKey) ? "&glassesProbability=100" : "&glassesProbability=0";
  const facialHairParam = hasBeard.includes(nameKey)
    ? "&facialHair=beard,scruff&facialHairProbability=100"
    : "&facialHairProbability=0";
  const avatarUri = `https://api.dicebear.com/7.x/micah/png?seed=${nameKey}&hair=${hairParam}&hairProbability=100&mouth=smile,laughing${glassesParam}&baseColor=ffffff${facialHairParam}&size=${AVATAR_SIZE * 3}`;

  const displayGreeting = customGreetings[nameKey] || greetings[greetingIndex];

  if (animationsEnabled === false) {
    return (
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <View style={{ marginBottom: 24, opacity: 0.7 }}>
          <ActivityIndicator size="large" color={t.textPrimary} />
        </View>
        <Text style={[styles.title, { color: t.textPrimary }]}>Heubert Tracker</Text>
        <View style={[styles.loaderTrack, { backgroundColor: t.border }]}>
          <LoaderBar color={t.accentIndigo} />
        </View>
      </View>
    );
  }

  // play-flute in the web app tilts 0deg -> 5deg and lifts 2px at a constant 1.1 scale;
  // every other prop uses the shared bounce-and-rock.
  const fluteRotate = bounce.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "5deg"] });
  const fluteLift = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -2] });
  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const rotate = bounce.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "8deg"] });

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Animated.View
        style={[
          styles.bubble,
          // Always white/teal regardless of theme, matching web's speech bubble — its
          // --bg-layer-2/--accent CSS vars are never defined, so it always falls back
          // to these literal colors rather than adapting to dark mode.
          { backgroundColor: "#ffffff", borderColor: t.border, opacity: bubbleOpacity },
        ]}
      >
        <Text style={[styles.bubbleText, { color: "#00796b" }]}>{displayGreeting}</Text>
      </Animated.View>

      <View style={styles.avatarWrap}>
        <Image source={{ uri: avatarUri }} style={styles.avatar} />

        {personProps?.flute ? (
          <Animated.View
            style={[
              styles.flute,
              { transform: [{ translateY: fluteLift }, { rotate: fluteRotate }, { scale: 1.1 }] },
            ]}
          >
            <Flute />
          </Animated.View>
        ) : personProps ? (
          <Animated.Text style={[styles.decoration, { transform: [{ translateY }, { rotate }] }]}>
            {personProps.emoji}
          </Animated.Text>
        ) : null}

        {/* Same fixed light tag as the bubble above — web's --text-main var is also undefined. */}
        <Text style={[styles.name, { color: "#333", backgroundColor: "rgba(255,255,255,0.7)" }]}>{currentName}</Text>
      </View>

      <Text style={[styles.title, { color: t.textPrimary }]}>Heubert Tracker</Text>
      <View style={[styles.loaderTrack, { backgroundColor: t.border }]}>
        <LoaderBar color={t.accentIndigo} />
      </View>
    </View>
  );
}

// The bansuri the web app hand-draws in SVG, at the same proportions.
function Flute() {
  return (
    <Svg viewBox="0 0 100 20" width={70 * SCALE} height={15 * SCALE} style={{ transform: [{ rotate: "-25deg" }] }}>
      <Rect x="0" y="2" width="100" height="12" rx="3" fill="#e6c280" stroke="#8b5a2b" strokeWidth="1" />
      <Line x1="20" y1="2" x2="20" y2="14" stroke="#8b5a2b" strokeWidth="1.5" />
      <Line x1="45" y1="2" x2="45" y2="14" stroke="#8b5a2b" strokeWidth="1.5" />
      <Line x1="85" y1="2" x2="85" y2="14" stroke="#8b5a2b" strokeWidth="1.5" />
      <Ellipse cx="25" cy="8" rx="2.5" ry="3.5" fill="#3e2723" />
      <Circle cx="50" cy="8" r="2" fill="#3e2723" />
      <Circle cx="60" cy="8" r="2" fill="#3e2723" />
      <Circle cx="70" cy="8" r="2" fill="#3e2723" />
      <Circle cx="80" cy="8" r="2" fill="#3e2723" />
    </Svg>
  );
}

// web's slide-load: the bar enters full width from the left, pinches to a tenth as it
// crosses, then leaves full width to the right.
function LoaderBar({ color }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateX = progress.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [-TRACK_WIDTH, 0, TRACK_WIDTH],
  });
  const scaleX = progress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.1, 1] });

  return (
    <Animated.View
      style={{
        width: TRACK_WIDTH,
        height: "100%",
        borderRadius: 10,
        backgroundColor: color,
        transform: [{ translateX }, { scaleX }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    minWidth: 100,
    maxWidth: "100%",
    alignItems: "center",
  },
  bubbleText: { fontWeight: "700", fontSize: 16, textAlign: "center" },
  avatarWrap: { alignItems: "center", marginBottom: 16 },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  decoration: { position: "absolute", bottom: 35 * SCALE, right: 0, fontSize: 22 },
  flute: { position: "absolute", bottom: 30 * SCALE, right: -20 * SCALE },
  name: { marginTop: 8, fontSize: 15, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  // web's .splash-text — uppercase, heavily tracked. The gradient fill it uses needs a
  // mask layer RN has no dependency for here, so it takes the theme's primary text color.
  title: { fontSize: 20, fontWeight: "800", letterSpacing: 2, textTransform: "uppercase", marginBottom: 12 },
  loaderTrack: { width: TRACK_WIDTH, height: TRACK_HEIGHT, borderRadius: 10, overflow: "hidden", marginTop: 12 },
});
