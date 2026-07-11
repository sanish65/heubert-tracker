import { useEffect, useRef, useState } from "react";
import { View, Text, Image, Animated, Easing, ActivityIndicator, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { useThemeColors } from "../lib/theme";

const AVATAR_SIZE = 72;

const greetings = ["Hi!", "Hello!", "Hey there!", "Welcome!", "Greetings!"];

const knownBoys = ["sanish", "jenish", "dinesh", "nikhil", "nitesh", "aashish", "bikesh", "pranay", "sairose"];
const knownGirls = ["isha", "pratisha", "merisha", "prativa"];
const defaultNames = [...knownBoys, ...knownGirls];

const customGreetings = {
  dinesh: "Mero ghar ma dell ko monitor cha!",
  jenish: "so guys, how's the prediction going?!",
  nitesh: "Hi, Its me Nitesh!",
  bikesh: "They call me Don! Biiku Don!",
  pranay: "Pranam from Pranay!",
  sanish: "Hey, are we the birds of same feather ?",
  aashish: "Netherland Firiri......",
  nikhil: "श्वानः मित्रं नित्यं विश्वस्तम्।",
  prativa: "Data is my game",
  pratisha: "काआ तरुवर पंच बिडाल,चंचल चित्त पइठो काल।",
  isha: "वक्रतुण्ड महाकाय सूर्यकोटि समप्रभ । निर्विघ्नं कुरु मे देव सर्वकार्येषु सर्वदा ॥",
  merisha: "Jindagi sarara scooter ma!",
  amogh: "sabailai namastey!",
};

// Decorative emoji + bounce shape per person, standing in for the web version's bespoke CSS keyframes.
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
  const spin = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    spin.setValue(0);
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 1000, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);

  const isGirl = knownGirls.includes(nameKey);
  const girlHair = "full,pixie";
  const boyHair = "fonze,mrT,dannyPhantom";
  const hairParam = isGirl ? girlHair : boyHair;
  const wearsGlasses = ["sanish", "bikesh", "merisha", "jenish", "nikhil", "pratisha", "prativa", "amogh"].includes(nameKey);
  const glassesParam = wearsGlasses ? "&glassesProbability=100" : "&glassesProbability=0";
  const hasBeard = nameKey === "sanish";
  const facialHairParam = hasBeard ? "&facialHair=beard,scruff&facialHairProbability=100" : "&facialHairProbability=0";
  const avatarUri = `https://api.dicebear.com/7.x/micah/png?seed=${nameKey}&hair=${hairParam}&hairProbability=100&mouth=smile,laughing${glassesParam}&baseColor=ffffff${facialHairParam}&size=${AVATAR_SIZE * 3}`;

  const displayGreeting = customGreetings[nameKey] || greetings[greetingIndex];

  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });

  if (animationsEnabled === false) {
    return (
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <Animated.View style={{ marginBottom: 24, transform: [{ rotate: spinDeg }] }}>
          <ActivityIndicator size="large" color={t.textPrimary} />
        </Animated.View>
        <Text style={[styles.title, { color: t.textPrimary }]}>Heubert Tracker</Text>
      </View>
    );
  }

  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -8] });
  const rotate = bounce.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "8deg"] });

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <Animated.View
        style={[
          styles.bubble,
          { backgroundColor: t.card, borderColor: t.border, opacity: bubbleOpacity },
        ]}
      >
        <Text style={[styles.bubbleText, { color: t.accentIndigo }]}>{displayGreeting}</Text>
      </Animated.View>

      <View style={styles.avatarWrap}>
        <Image source={{ uri: avatarUri }} style={styles.avatar} />
        {personProps && (
          <Animated.Text
            style={[styles.decoration, { transform: [{ translateY }, { rotate }] }]}
          >
            {personProps.emoji}
          </Animated.Text>
        )}
        <Text style={[styles.name, { color: t.textPrimary, backgroundColor: t.card }]}>{currentName}</Text>
      </View>

      <Text style={[styles.title, { color: t.textPrimary }]}>Heubert Tracker</Text>
      <View style={[styles.loaderTrack, { backgroundColor: t.border }]}>
        <LoaderBar color={t.accentIndigo} />
      </View>
    </View>
  );
}

function LoaderBar({ color }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(progress, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    );
    loop.start();
    return () => loop.stop();
  }, []);

  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [-120, 120] });

  return (
    <Animated.View
      style={{ width: 60, height: "100%", borderRadius: 3, backgroundColor: color, transform: [{ translateX }] }}
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
    alignItems: "center",
  },
  bubbleText: { fontWeight: "700", fontSize: 16, textAlign: "center" },
  avatarWrap: { alignItems: "center", marginBottom: 16 },
  avatar: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  decoration: { position: "absolute", bottom: 22, right: -14, fontSize: 22 },
  name: { marginTop: 8, fontSize: 15, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  title: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  loaderTrack: { width: 120, height: 6, borderRadius: 3, overflow: "hidden" },
});
