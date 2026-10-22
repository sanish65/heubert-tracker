"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useApp } from "@/context/AppContext";
import { FestiveScene } from "@/components/DashainBanner";
import { isFestiveSeason } from "@/lib/festiveSeason";

const greetings = ["Hi!", "Hello!", "Hey there!", "Welcome!", "Greetings!"];

// Kites and fireworks for the full-screen loader, kept to the sides so the
// walking avatar in the middle stays clear.
const LOADER_KITES = [
  { left: "8%", top: "14%", size: 44, body: "#ef4444", stripe: "#facc15", delay: 0 },
  { left: "20%", top: "34%", size: 34, body: "#22c55e", stripe: "#f97316", delay: 1.1, wide: true },
  { left: "76%", top: "26%", size: 40, body: "#3b82f6", stripe: "#f472b6", delay: 0.5, wide: true },
  { left: "88%", top: "10%", size: 48, body: "#a855f7", stripe: "#fde047", delay: 1.7 },
];
const LOADER_FIREWORKS = [
  { left: "18%", top: "18%", color: "#fde047", delay: 0 },
  { left: "82%", top: "36%", color: "#f472b6", delay: 0.9 },
  { left: "70%", top: "12%", color: "#38bdf8", delay: 1.7 },
  { left: "30%", top: "10%", color: "#fb923c", delay: 2.4, wide: true },
];

// Children cheering in front of the rooftops, in festival clothes (see Kid in
// DashainBanner.js): `head` is the skin tone, `outfit` daura (with a topi), frock or
// kurta. Their lines take turns on a 9s cycle, so neighbours never talk over each other.
const LOADER_KIDS = [
  { left: "6%", pose: "kite", shirt: "#ef4444", head: "#e2ac7f", outfit: "daura", say: "दुई धार्के धागो छोड!", sayDelay: 0 },
  { left: "22%", pose: "jump", shirt: "#22c55e", head: "#c98e5e", outfit: "frock", say: "दशैं आयो!", sayDelay: 4.5, wide: true },
  { left: "36%", pose: "wave", shirt: "#3b82f6", head: "#d9a273", outfit: "daura", say: "मासु भात खाउँ!", sayDelay: 1.5, wide: true },
  { left: "52%", pose: "kite", shirt: "#a855f7", head: "#b97a4c", outfit: "kurta", say: "चेट!", sayDelay: 3 },
  { left: "64%", pose: "jump", shirt: "#f97316", head: "#e2ac7f", outfit: "daura", say: "नयाँ लुगा लगाएँ!", sayDelay: 6, wide: true },
  { left: "76%", pose: "wave", shirt: "#ec4899", head: "#c98e5e", outfit: "frock", say: "देउसी रे!", sayDelay: 7.5, wide: true },
];

// Known categorizations
const knownBoys = ["sanish", "jenish", "dinesh", "nikhil", "nitesh", "aashish", "bikesh", "pranay", "ankit", "bipin" , "nikesh"];
const knownGirls = ["pratisha", "merisha", "prativa" , "nebula"];

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

const defaultNames = [...knownBoys, ...knownGirls];

// A normal load settles well inside a second or two. Past these marks the splash stops
// pretending everything is fine and says what it is waiting on.
const SLOW_AFTER_MS = 6000;
const VERY_SLOW_AFTER_MS = 15000;

// How long the splash lingers, fading, after loading finishes. Keep in sync
// with the .loading-splash-exit animation in globals.css.
export const SPLASH_EXIT_MS = 700;

// Keeps the splash mounted for one fade once `booting` goes false, so the app
// cross-fades in from underneath instead of the backdrop cutting straight to
// the page colours. Returns the splash element, or null once it is done.
export function useSplashExit(booting) {
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (booting) {
      setGone(false);
      return;
    }
    if (gone) return;
    const timer = setTimeout(() => setGone(true), SPLASH_EXIT_MS);
    return () => clearTimeout(timer);
  }, [booting, gone]);

  if (gone) return null;
  return <HumanLoader key="splash" exiting={!booting} />;
}

export default function HumanLoader({ exiting = false }) {
  const { employees, animationsEnabled, startupReach, isOffline } = useApp() || { employees: [], animationsEnabled: true };
  const [index, setIndex] = useState(0);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [shuffledDefaults, setShuffledDefaults] = useState([]);
  const [isMounted, setIsMounted] = useState(false);
  const isPausedRef = useRef(false);
  const festive = isFestiveSeason();
  const splashClass = [
    "loading-splash",
    festive && "loading-splash-festive",
    festive && animationsEnabled === false && "dashain-still",
    exiting && "loading-splash-exit",
    exiting && animationsEnabled === false && "loading-splash-exit-plain",
    // The splash sits outside .app-shell, so it can't use the app's .motion-off gate.
    animationsEnabled === false && "splash-still",
  ].filter(Boolean).join(" ");
  const festiveBackdrop = festive && (
    <FestiveScene kites={LOADER_KITES} fireworks={LOADER_FIREWORKS} diyas={24} swingSay="चा चा हुई!" kids={LOADER_KIDS} />
  );
  const festiveTagline = festive && <div className="splash-festive-tagline" lang="ne">शुभ दशैं तथा तिहार</div>;

  useEffect(() => {
    setShuffledDefaults(shuffle(defaultNames));
    setIsMounted(true);
  }, []);

  // Use actual employees if available (usually late in the load), otherwise fallback
  const names = employees && employees.length > 0 
    ? employees
        .map(e => e.name.split(' ')[0])
        // Opt out developer, bhoomi, sameer, samir
        .filter(n => {
          const l = n.toLowerCase();
          return l !== "developer" && l !== "developers" && l !== "bhoomi" && l !== "sameer" && l !== "samir";
        })
    : (shuffledDefaults.length > 0 ? shuffledDefaults : defaultNames);

  useEffect(() => {
    const cycleInterval = setInterval(() => {
      if (!isPausedRef.current) setIndex(prev => (prev + 1) % names.length);
    }, 1500); // Change person every 1.5s

    const greetInterval = setInterval(() => {
      if (!isPausedRef.current) setGreetingIndex(prev => (prev + 1) % greetings.length);
    }, 3000); // Change greeting every 3s

    return () => {
      clearInterval(cycleInterval);
      clearInterval(greetInterval);
    };
  }, [names.length]);

  // Ticks only while the splash is actually waiting; the exit fade freezes it so the
  // message cannot appear on the way out.
  const [waitedMs, setWaitedMs] = useState(0);
  useEffect(() => {
    if (exiting) return;
    const startedAt = Date.now();
    const tick = setInterval(() => setWaitedMs(Date.now() - startedAt), 1000);
    return () => clearInterval(tick);
  }, [exiting]);

  let statusMessage = null;
  // "error" when nothing can load at all, "warn" when it is only slow.
  let statusTone = "warn";
  if (!exiting) {
    if (isOffline) {
      statusMessage = "You're offline — waiting for a connection…";
      statusTone = "error";
    } else if (startupReach === "unreachable") {
      statusMessage = "Can't reach the server right now.";
      statusTone = "error";
    } else if (startupReach === "partial" && waitedMs >= SLOW_AFTER_MS) {
      statusMessage = "Some data is still on its way…";
    } else if (waitedMs >= VERY_SLOW_AFTER_MS) {
      statusMessage = "Still waiting on the server — this is unusually slow.";
    } else if (waitedMs >= SLOW_AFTER_MS) {
      statusMessage = "Your connection looks slow. Hang tight…";
    }
  }
  const statusNote = statusMessage && (
    <div className={`splash-status splash-status--${statusTone}`} role="status">{statusMessage}</div>
  );

  const currentName = names[index] || "Employee";
  const nameKey = currentName.toLowerCase();
  
  // Determine if girl to set hair styles (open-peeps neutral black/white outlines)
  // If not explicitly in knownGirls, we check knownBoys. 
  const isGirl = knownGirls.includes(nameKey);
  
  const girlHair = "full,pixie";
  // const boyHair = "fonze,mrT,dougFunny,dannyPhantom";
  const boyHair = "fonze,mrT,dannyPhantom";

  const hairParam = isGirl ? girlHair : boyHair;

  const wearsGlasses = ["sanish", "bikesh", "merisha", "jenish", "pratisha", "amogh" , "bipin" , "nikesh", "nebula"].includes(nameKey);
  const glassesParam = wearsGlasses ? "&glassesProbability=100" : "&glassesProbability=0";
  
  const hasBeard = ["sanish" , "dinesh"].includes(nameKey);
  const facialHairParamString = hasBeard ? "&facialHair=beard,scruff&facialHairProbability=100" : "&facialHairProbability=0";

  const mouthParam = "smile,laughing";
  const baseColorParam = "ffffff";

  let displayGreeting = greetings[greetingIndex % greetings.length];
  if (nameKey === "dinesh") displayGreeting = "Hello!";
  else if (nameKey === "pratisha") displayGreeting = "Lets register the marathon guys, hurry up!!";
  else if (nameKey === "jenish") displayGreeting = "Jerry is my game code";
  else if (nameKey === "nitesh") displayGreeting = "Hi, Its me Nitesh!";
  else if (nameKey === "bikesh") displayGreeting = "केही मीठो बात गर, रात त्यसै ढल्किँदै छ!";
  else if (nameKey === "pranay") displayGreeting = "प्रणाम from प्रणय!!!";
  else if (nameKey === "sanish") displayGreeting = "when it rains, its rainy!!";
  else if (nameKey === "aashish") displayGreeting = "Hi, Nice to meet you!!!!";
  else if (nameKey === "nikhil") displayGreeting = "सपनीमा मुसुक्क हाँसी, कहाँ गयौ तिमी ट्याक्सीमा?!";
  else if (nameKey === "prativa") displayGreeting = "Data is my game";
  else if (nameKey === "merisha") displayGreeting = "Merisha_breezy ForEver!!";
  else if (nameKey === "amogh") displayGreeting = "Am I audible!";
  else if (nameKey === "ankit") displayGreeting = "Namastey!";
  else if (nameKey === "bipin") displayGreeting = "Greetings!";
  else if (nameKey === "nebula") displayGreeting = "Hi!";
  else if (nameKey === "nikesh") displayGreeting = "Namastey!";



  // Revamp look (no canvas artboard; built from Login.dc.html and Foundations.dc.html):
  // the app's ink and aurora behind one frosted card holding the brand, the teammate
  // walking through, a blue-to-cyan progress strip and a live caption. On the first
  // paint (the name list is random) and with Animations off, the card stays still and
  // shows no teammate.
  const still = !isMounted || animationsEnabled === false;

  const stage = !still && (
    <div
      className="splash-stage"
      onMouseEnter={() => { isPausedRef.current = true; }}
      onMouseLeave={() => { isPausedRef.current = false; }}
    >
      <div className="splash-bubble" key={displayGreeting}>{displayGreeting}</div>
      <div className="splash-avatar">
        <span className="splash-avatar-ring" aria-hidden="true" />
        <div className="walking-figure splash-figure">
          <img
            src={`https://api.dicebear.com/7.x/micah/svg?seed=${nameKey}&hair=${hairParam}&hairProbability=100&mouth=${mouthParam}${glassesParam}&baseColor=${baseColorParam}${facialHairParamString}`}
            alt={`${currentName}'s avatar`}
            width="96"
            height="96"
            className="splash-avatar-img"
          />
          {/* Sanish walks out in his KAKA shirt, drawn over the avatar's shoulders. */}
          {nameKey === "sanish" && (
            <svg
              viewBox="0 0 120 60"
              width="84"
              height="42"
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: '-6px',
                left: '50%',
                transform: 'translateX(-50%)',
                zIndex: 5,
                pointerEvents: 'none',
                filter: 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))'
              }}
            >
              <defs>
                <clipPath id="kaka-jersey-clip">
                  <path d="M4 16 L34 6 C44 4 48 18 60 18 C72 18 76 4 86 6 L116 16 L108 34 L96 30 L98 60 L22 60 L24 30 L12 34 Z" />
                </clipPath>
              </defs>
              <g clipPath="url(#kaka-jersey-clip)">
                <rect x="0" y="0" width="120" height="60" fill="#c8102e" />
                <rect x="4" y="0" width="8" height="60" fill="#111111" />
                <rect x="20" y="0" width="8" height="60" fill="#111111" />
                <rect x="36" y="0" width="8" height="60" fill="#111111" />
                <rect x="52" y="0" width="8" height="60" fill="#111111" />
                <rect x="68" y="0" width="8" height="60" fill="#111111" />
                <rect x="84" y="0" width="8" height="60" fill="#111111" />
                <rect x="100" y="0" width="8" height="60" fill="#111111" />
              </g>
              <path
                d="M4 16 L34 6 C44 4 48 18 60 18 C72 18 76 4 86 6 L116 16 L108 34 L96 30 L98 60 L22 60 L24 30 L12 34 Z"
                fill="none"
                stroke="#000000"
                strokeWidth="3"
                strokeLinejoin="round"
              />
              <path d="M46 10 C50 20 70 20 74 10" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
              <text
                x="60"
                y="35"
                textAnchor="middle"
                fontSize="15"
                fontWeight="bold"
                letterSpacing="1.5"
                fill="#ffffff"
                stroke="#000000"
                strokeWidth="0.8"
                paintOrder="stroke"
                fontFamily="Arial, Helvetica, sans-serif"
              >
                KAKA
              </text>
              <text
                x="60"
                y="54"
                textAnchor="middle"
                fontSize="14"
                fontWeight="bold"
                fill="#ffffff"
                stroke="#000000"
                strokeWidth="0.8"
                paintOrder="stroke"
                fontFamily="Arial, Helvetica, sans-serif"
              >
                22
              </text>
            </svg>
          )}
        </div>
        {nameKey === "sanish" && (
          <div className="splash-flute" aria-hidden="true">
            <svg viewBox="0 0 100 20" width="70" height="15" style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))', transform: 'rotate(-25deg)' }}>
              <rect x="0" y="2" width="100" height="12" rx="3" fill="#e6c280" stroke="#8b5a2b" strokeWidth="1" />
              <line x1="20" y1="2" x2="20" y2="14" stroke="#8b5a2b" strokeWidth="1.5" />
              <line x1="45" y1="2" x2="45" y2="14" stroke="#8b5a2b" strokeWidth="1.5" />
              <line x1="85" y1="2" x2="85" y2="14" stroke="#8b5a2b" strokeWidth="1.5" />
              <ellipse cx="25" cy="8" rx="2.5" ry="3.5" fill="#3e2723" />
              <circle cx="50" cy="8" r="2" fill="#3e2723" />
              <circle cx="60" cy="8" r="2" fill="#3e2723" />
              <circle cx="70" cy="8" r="2" fill="#3e2723" />
              <circle cx="80" cy="8" r="2" fill="#3e2723" />
            </svg>
          </div>
        )}
      </div>
      <span className="splash-name">{currentName}</span>
    </div>
  );

  return (
    <div className={splashClass} aria-busy={!exiting}>
      {!festive && <div className="splash-aurora" aria-hidden="true" />}
      {festiveBackdrop}
      <div className="human-loader-container splash-card">
        <div className="splash-brand">
          <Image src="/logo.png" alt="" className="splash-logo" width={40} height={40} priority />
          <div className="splash-brand-text">
            <span className="splash-text">Heubert Tracker</span>
            <span className="splash-brand-sub">team.heubert</span>
          </div>
        </div>
        {stage}
        <div className="loader-bar-container" aria-hidden="true">
          <div className="loader-bar" />
        </div>
        {statusNote || (
          <div className="splash-caption">
            <span className="splash-live-dot" aria-hidden="true" />
            Loading your workspace
          </div>
        )}
      </div>
      {festiveTagline}
    </div>
  );
}
