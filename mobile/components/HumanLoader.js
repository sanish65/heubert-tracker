import { useEffect, useState } from "react";
import { View, Text, Image, Animated, Easing, StyleSheet } from "react-native";
import Svg, { Defs, LinearGradient, Stop, Rect, Line, Ellipse, Circle, Path } from "react-native-svg";
import { useApp } from "../context/AppContext";
import { useThemeColors, fonts, radius } from "../lib/theme";
import useMotionAllowed from "../lib/useMotionAllowed";
import Aurora from "./Aurora";

// The loader, as the web app's splash card (docs/mobile-ui-revamp/design/Splash.dc.html and
// src/components/HumanLoader.js), sized for a phone: one glass card over the ink and the aurora,
// holding the brand, the teammate walking through in a raised disc with a cyan ring, a
// blue-to-cyan progress strip and the "Loading your workspace" caption. With motion off (the
// Animations setting or the phone's reduce-motion) the card is still: no teammate, the strip
// resting at 40%, the dot steady.

// The web app's logo (public/logo.png); the same file as the Android adaptive icon's foreground.
const LOGO = require("../assets/android-icon-foreground.png");

const DISC = 120;
const FIGURE = 96;

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


const DECORATIVE = { accessible: false, importantForAccessibility: "no-hide-descendants", accessibilityElementsHidden: true };

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

const EASE_IN_OUT = Easing.inOut(Easing.ease);
const EASE_OUT = Easing.out(Easing.ease);

// One Animated.Value for the life of the component.
function useAnimatedValue() {
  const [value] = useState(() => new Animated.Value(0));
  return value;
}

// A looping 0 -> 1 value that runs only while `active`.
function useLoop(active, duration, easing = Easing.linear) {
  const value = useAnimatedValue();
  useEffect(() => {
    if (!active) return;
    value.setValue(0);
    const loop = Animated.loop(Animated.timing(value, { toValue: 1, duration, easing, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [value, active, duration, easing]);
  return value;
}

export default function HumanLoader() {
  const { employees } = useApp() || { employees: [] };
  const t = useThemeColors();
  const moving = useMotionAllowed();
  // The splash card's lift and the live dot's glow, as Splash.dc.html draws them (tokens.js).
  const shadows = { lift: t.shadowLift, card: t.shadowCard, glow: t.glow };

  return (
    <View style={[styles.page, { backgroundColor: t.ink }]}>
      <Aurora />
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel="Loading Heubert Tracker"
        style={[
          styles.card,
          { backgroundColor: t.surfaceStrong, borderColor: t.lineStrong, borderTopColor: t.glassHi, boxShadow: shadows.lift },
        ]}
      >
        <View style={styles.brand}>
          <Image source={LOGO} alt="" style={styles.logo} />
          <View>
            <Text style={[styles.brandName, { color: t.text1 }]}>Heubert Tracker</Text>
            <Text style={[styles.brandSub, { color: t.text3 }]}>team.heubert</Text>
          </View>
        </View>

        {moving ? <Teammate employees={employees} shadows={shadows} /> : null}

        <ProgressStrip moving={moving} />

        <View style={styles.caption}>
          <LiveDot moving={moving} glow={shadows.glow} />
          <Text style={[styles.captionText, { color: t.text3 }]}>Loading your workspace</Text>
        </View>
      </View>
    </View>
  );
}

// The teammate walking through: a greeting bubble, the avatar in its disc and ring, the name. Only
// mounted while motion is allowed, so its timers and loops never run in the still card.
function Teammate({ employees, shadows }) {
  const t = useThemeColors();
  const [index, setIndex] = useState(0);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [shuffledDefaults] = useState(() => shuffle(defaultNames));

  const bubbleIn = useAnimatedValue();
  const walk = useLoop(true, 2000, EASE_IN_OUT);
  const spin = useLoop(true, 1600);

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
    const cycleInterval = setInterval(() => setIndex((prev) => (prev + 1) % names.length), 1500);
    const greetInterval = setInterval(() => setGreetingIndex((prev) => (prev + 1) % greetings.length), 3000);
    return () => {
      clearInterval(cycleInterval);
      clearInterval(greetInterval);
    };
  }, [names.length]);

  const currentName = names[index % names.length] || "Employee";
  const nameKey = currentName.toLowerCase();
  const displayGreeting = customGreetings[nameKey] || greetings[greetingIndex];

  // The bubble's ht-in: 320ms from 4px low and 96% to in place, each time the line changes.
  useEffect(() => {
    bubbleIn.setValue(0);
    Animated.timing(bubbleIn, { toValue: 1, duration: 320, easing: EASE_OUT, useNativeDriver: true }).start();
  }, [bubbleIn, displayGreeting]);

  const isGirl = knownGirls.includes(nameKey);
  const hairParam = isGirl ? "full,pixie" : "fonze,mrT,dannyPhantom";
  const glassesParam = wearsGlasses.includes(nameKey) ? "&glassesProbability=100" : "&glassesProbability=0";
  const facialHairParam = hasBeard.includes(nameKey)
    ? "&facialHair=beard,scruff&facialHairProbability=100"
    : "&facialHairProbability=0";
  const avatarUri = `https://api.dicebear.com/7.x/micah/png?seed=${encodeURIComponent(nameKey)}&hair=${hairParam}&hairProbability=100&mouth=smile,laughing${glassesParam}&baseColor=ffffff${facialHairParam}&size=${FIGURE * 3}`;

  // ht-walk: rock -8deg to 8deg about the feet, lifting 6px on each step.
  const walkRotate = walk.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: ["-8deg", "0deg", "8deg", "0deg", "-8deg"],
  });
  const walkLift = walk.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, -6, 0, -6, 0] });
  const ringRotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const bubbleLift = bubbleIn.interpolate({ inputRange: [0, 1], outputRange: [4, 0] });
  const bubbleScale = bubbleIn.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] });

  return (
    <View style={[styles.stage, { borderTopColor: t.line }]}>
      <Animated.View
        style={[
          styles.bubble,
          {
            backgroundColor: t.surfaceSolid,
            borderColor: t.lineStrong,
            borderTopColor: t.glassHi,
            boxShadow: shadows.card,
            opacity: bubbleIn,
            transform: [{ translateY: bubbleLift }, { scale: bubbleScale }],
          },
        ]}
      >
        <Text style={[styles.bubbleText, { color: t.text1 }]}>{displayGreeting}</Text>
        <View {...DECORATIVE} style={[styles.bubbleTail, { backgroundColor: t.surfaceSolid, borderColor: t.lineStrong }]} />
      </Animated.View>

      <View style={[styles.disc, { backgroundColor: t.raised, borderColor: t.line }]}>
        <Animated.View {...DECORATIVE} style={[styles.ring, { transform: [{ rotate: ringRotate }] }]}>
          <Ring color={t.cyan} />
        </Animated.View>
        <Animated.View style={[styles.figure, { transform: [{ translateY: walkLift }, { rotate: walkRotate }] }]}>
          <Image source={{ uri: avatarUri }} alt={`${currentName}'s avatar`} style={styles.avatar} />
        </Animated.View>
        {nameKey === "sanish" ? (
          <View {...DECORATIVE} style={styles.flute}>
            <Flute />
          </View>
        ) : null}
      </View>

      <Text style={[styles.name, { color: t.text2 }]}>{currentName}</Text>
    </View>
  );
}

// The ring's conic sweep (transparent for the first 65% of the turn, then up to cyan), 2px wide,
// 4px outside the disc's inner edge as the artboard's `inset: -4px`. react-native-svg has no conic gradient, so the sweep is drawn as short
// arcs that grow more opaque towards its head.
const RING = DISC - 2 + 8;
const RING_RADIUS = RING / 2 - 1;
const SWEEP_START = 0.65;
const SWEEP_STEPS = 14;

function arcPath(from, to) {
  const point = (turn) => {
    const angle = turn * 2 * Math.PI - Math.PI / 2;
    return `${RING / 2 + RING_RADIUS * Math.cos(angle)} ${RING / 2 + RING_RADIUS * Math.sin(angle)}`;
  };
  return `M${point(from)} A${RING_RADIUS} ${RING_RADIUS} 0 0 1 ${point(to)}`;
}

function Ring({ color }) {
  const step = (1 - SWEEP_START) / SWEEP_STEPS;
  return (
    <Svg width={RING} height={RING}>
      {Array.from({ length: SWEEP_STEPS }, (_, i) => (
        <Path
          key={i}
          d={arcPath(SWEEP_START + i * step, SWEEP_START + (i + 1) * step)}
          stroke={color}
          strokeOpacity={(i + 1) / SWEEP_STEPS}
          strokeWidth={2}
          fill="none"
        />
      ))}
    </Svg>
  );
}

// The bansuri the web app hand-draws in SVG, at the same size, beside Sanish.
function Flute() {
  return (
    <Svg viewBox="0 0 100 20" width={70} height={15} style={{ transform: [{ rotate: "-25deg" }] }}>
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

// The blue-to-cyan strip. Moving, it is the web's ht-slide: in from the left at full width,
// pinched to a tenth at the start, out to the right at full width, every 1.5s. Still, it rests at
// the left at 40%.
function ProgressStrip({ moving }) {
  const t = useThemeColors();
  const [width, setWidth] = useState(0);
  const slide = useLoop(moving && width > 0, 1500, EASE_IN_OUT);

  // The bar is the track's width; scaled about its centre, so its centre is moved to where the
  // keyframe's left edge plus half its width puts it.
  const translateX = slide.interpolate({ inputRange: [0, 0.5, 1], outputRange: [-width, -0.45 * width, width] });
  const scaleX = slide.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.1, 1] });

  const bar = width > 0 ? <GradientBar width={moving ? width : width * 0.4} /> : null;

  return (
    <View {...DECORATIVE} onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={[styles.track, { backgroundColor: t.raised }]}>
      {moving ? <Animated.View style={[styles.bar, { transform: [{ translateX }, { scaleX }] }]}>{bar}</Animated.View> : <View style={styles.bar}>{bar}</View>}
    </View>
  );
}

function GradientBar({ width }) {
  const t = useThemeColors();
  return (
    <Svg width={width} height={4}>
      <Defs>
        <LinearGradient id="loader-strip" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor={t.primary} />
          <Stop offset="1" stopColor={t.cyan} />
        </LinearGradient>
      </Defs>
      <Rect width={width} height={4} rx={2} fill="url(#loader-strip)" />
    </Svg>
  );
}

// The caption's cyan dot: ht-pulse (full, a third, full every 1.4s) while moving, steady when still.
function LiveDot({ moving, glow }) {
  const t = useThemeColors();
  const pulse = useLoop(moving, 1400, EASE_IN_OUT);
  const opacity = moving ? pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 0.35, 1] }) : 1;
  return <Animated.View {...DECORATIVE} style={[styles.dot, { backgroundColor: t.cyan, boxShadow: glow, opacity }]} />;
}

// Sizes, gaps and type from Splash.dc.html; letter-spacing in px at the font size (.08em at 12px,
// -0.01em at 20px).
const styles = StyleSheet.create({
  page: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48, paddingHorizontal: 16 },
  card: {
    width: "100%",
    maxWidth: 400,
    paddingTop: 32,
    paddingHorizontal: 32,
    paddingBottom: 26,
    borderWidth: 1,
    borderRadius: radius.sheet,
    alignItems: "center",
    gap: 20,
  },
  brand: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 12 },
  logo: { width: 40, height: 40, borderRadius: radius.sm },
  brandName: { fontFamily: fonts.display, fontSize: 20, lineHeight: 24, letterSpacing: -0.2 },
  brandSub: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 15 },
  stage: { alignSelf: "stretch", alignItems: "center", gap: 10, paddingTop: 18, paddingBottom: 4, borderTopWidth: 1 },
  bubble: { maxWidth: "100%", paddingVertical: 6, paddingHorizontal: 14, borderWidth: 1, borderRadius: 14 },
  bubbleText: { fontFamily: fonts.bodySemibold, fontSize: 14, textAlign: "center" },
  bubbleTail: {
    position: "absolute",
    left: "50%",
    bottom: -6,
    width: 10,
    height: 10,
    marginLeft: -5,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    transform: [{ rotate: "45deg" }],
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  ring: { position: "absolute", top: -4, left: -4, width: RING, height: RING },
  figure: { width: FIGURE, height: FIGURE, transformOrigin: "center bottom" },
  avatar: { width: FIGURE, height: FIGURE },
  flute: { position: "absolute", bottom: 30, right: -20 },
  name: { fontFamily: fonts.monoMedium, fontSize: 12, letterSpacing: 0.96, textTransform: "uppercase" },
  track: { width: "100%", height: 4, borderRadius: radius.pill, overflow: "hidden" },
  bar: { position: "absolute", top: 0, left: 0, height: 4 },
  caption: { flexDirection: "row", alignItems: "center", gap: 8 },
  dot: { width: 7, height: 7, borderRadius: radius.pill },
  captionText: { fontFamily: fonts.monoMedium, fontSize: 12, letterSpacing: 0.96, textTransform: "uppercase" },
});
