"use client";

import { useState, useEffect, useRef } from "react";
import { useApp } from "@/context/AppContext";
import { FestiveScene } from "@/components/DashainBanner";
import { isFestiveSeason } from "@/lib/festiveSeason";

const greetings = ["Hi!", "Hello!", "Hey there!", "Welcome!", "Greetings!"];
const festiveGreetings = [
  "शुभ दशैं! 🙏",
  "Happy Dashain! 🪁",
  "Tika & jamara time! 🌾",
  "Let's fly kites! 🪁",
  "शुभ दीपावली! 🪔",
  "Happy Tihar! 🎆",
];
// Divisible by both list lengths, so each list cycles through every entry.
const GREETING_CYCLE = 30;

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

// Children cheering in front of the rooftops. Their lines take turns on a 9s
// cycle, so neighbours never talk over each other.
const LOADER_KIDS = [
  { left: "6%", pose: "kite", shirt: "#ef4444", head: "#fcd34d", say: "दुई धार्के धागो छोड! 🪁", sayDelay: 0 },
  { left: "22%", pose: "jump", shirt: "#22c55e", head: "#fdba74", say: "दशैं आयो! 🎉", sayDelay: 4.5, wide: true },
  { left: "36%", pose: "wave", shirt: "#3b82f6", head: "#fcd34d", say: "मासु भात खाउँ! 🍖", sayDelay: 1.5, wide: true },
  { left: "52%", pose: "kite", shirt: "#a855f7", head: "#fdba74", say: "चेट! 🪁", sayDelay: 3 },
  { left: "64%", pose: "jump", shirt: "#f97316", head: "#fcd34d", say: "नयाँ लुगा लगाएँ! 👕", sayDelay: 6, wide: true },
  { left: "76%", pose: "wave", shirt: "#ec4899", head: "#fdba74", say: "देउसी रे! 🪔", sayDelay: 7.5, wide: true },
];

// People who already carry their own prop; everyone else gets a kite during the festival.
const hasOwnProp = ["aashish", "nikhil", "nitesh", "jenish", "prativa", "dinesh", "pratisha", "bikesh", "pranay", "sanish"];

// Known categorizations
const knownBoys = ["sanish", "jenish", "dinesh", "nikhil", "nitesh", "aashish", "bikesh", "pranay", "ankit", "bipin" , "nikesh"];
const knownGirls = ["pratisha", "merisha", "prativa" , "nebula"];

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

const defaultNames = [...knownBoys, ...knownGirls];

export default function HumanLoader() {
  const { employees, animationsEnabled } = useApp() || { employees: [], animationsEnabled: true };
  const [index, setIndex] = useState(0);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [shuffledDefaults, setShuffledDefaults] = useState([]);
  const [isMounted, setIsMounted] = useState(false);
  const isPausedRef = useRef(false);
  const festive = isFestiveSeason();
  const splashClass = `loading-splash${festive ? " loading-splash-festive" : ""}${festive && animationsEnabled === false ? " dashain-still" : ""}`;
  const festiveBackdrop = festive && (
    <FestiveScene kites={LOADER_KITES} fireworks={LOADER_FIREWORKS} diyas={24} swingSay="चा चा हुई! 🎉" kids={LOADER_KIDS} />
  );
  const festiveTagline = festive && <div className="splash-festive-tagline" lang="ne">🪔 शुभ दशैं तथा तिहार 🪁</div>;

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
      if (!isPausedRef.current) setGreetingIndex(prev => (prev + 1) % GREETING_CYCLE);
    }, 3000); // Change greeting every 3s

    return () => {
      clearInterval(cycleInterval);
      clearInterval(greetInterval);
    };
  }, [names.length]);

  const currentName = names[index] || "Employee";
  const nameKey = currentName.toLowerCase();
  
  // Determine if girl to set hair styles (open-peeps neutral black/white outlines)
  // If not explicitly in knownGirls, we check knownBoys. 
  const isGirl = knownGirls.includes(nameKey);
  
  const girlHair = "full,pixie";
  // const boyHair = "fonze,mrT,dougFunny,dannyPhantom";
  const boyHair = "fonze,mrT,dannyPhantom";

  const hairParam = isGirl ? girlHair : boyHair;

  const wearsGlasses = ["sanish", "bikesh", "merisha", "jenish", "nikhil", "pratisha", "prativa", "amogh" , "bipin" , "nikesh", "nebula"].includes(nameKey);
  const glassesParam = wearsGlasses ? "&glassesProbability=100" : "&glassesProbability=0";
  
  const hasBeard = ["sanish" , "dinesh"].includes(nameKey);
  const facialHairParamString = hasBeard ? "&facialHair=beard,scruff&facialHairProbability=100" : "&facialHairProbability=0";

  const mouthParam = "smile,laughing";
  const baseColorParam = "ffffff";

  let displayGreeting = greetings[greetingIndex % greetings.length];
  // During Dashain & Tihar everyone swaps their usual line for a festival greeting.
  if (festive) displayGreeting = festiveGreetings[greetingIndex % festiveGreetings.length];
  else if (nameKey === "dinesh") displayGreeting = "Hello!";
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
  else if (nameKey === "ankit") displayGreeting = "Bikesh dai is my favourite!";
  else if (nameKey === "bipin") displayGreeting = "Greetings!";
  else if (nameKey === "nebula") displayGreeting = "Hi!";
  else if (nameKey === "nikesh") displayGreeting = "Namastey!";



  if (!isMounted || animationsEnabled === false) {
    return (
      <div className={splashClass}>
        {festiveBackdrop}
        <div 
          className="human-loader-container" 
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            transform: 'scale(0.85)',
            transformOrigin: 'center center'
          }}
        >
          {animationsEnabled === false && (
            <div style={{ marginBottom: '1.5rem', opacity: 0.7 }}>
              <svg 
                className="basic-spinner" 
                viewBox="0 0 50 50" 
                style={{
                  width: '50px',
                  height: '50px',
                  animation: 'spin 1s linear infinite'
                }}
              >
                <circle 
                  cx="25" cy="25" r="20" 
                  fill="none" 
                  stroke="var(--text-primary)" 
                  strokeWidth="4"
                  strokeDasharray="90,150"
                  strokeLinecap="round"
                />
              </svg>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin { 100% { transform: rotate(360deg); } }
              `}} />
            </div>
          )}
          <div className="splash-text">Heubert Tracker</div>
        {festiveTagline}
          <div className="loader-bar-container" style={{ marginTop: '1rem' }}>
            <div className="loader-bar"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={splashClass}>
        {festiveBackdrop}
      <div
        className="human-loader-container"
        onMouseEnter={() => { isPausedRef.current = true; }}
        onMouseLeave={() => { isPausedRef.current = false; }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          transform: 'scale(0.85)', // scale down overall loader slightly
          transformOrigin: 'center center'
        }}
      >
        <div 
          className="speech-bubble pulse-entry" 
          style={{
            background: 'var(--bg-layer-2, #ffffff)',
            color: 'var(--accent, #00796b)',
            padding: '4px 16px',
            borderRadius: '16px',
            fontWeight: 'bold',
            fontSize: '1.2rem',
            marginBottom: '0.5rem',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            minWidth: '100px',
            textAlign: 'center',
            border: '1px solid var(--border)',
            transition: 'opacity 0.3s ease-in-out'
          }}
        >
          {displayGreeting}
        </div>
        
        <div 
          className="splash-avatar" 
          style={{ 
            marginBottom: '1rem',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.2))',
          }}
        >
          <div className="walking-figure">
            <img 
              src={`https://api.dicebear.com/7.x/micah/svg?seed=${nameKey}&hair=${hairParam}&hairProbability=100&mouth=${mouthParam}${glassesParam}&baseColor=${baseColorParam}${facialHairParamString}`}
              alt={`${currentName}'s avatar`}
              width="100"
              height="100"
              style={{ 
                background: 'transparent',
                filter: 'grayscale(100%) brightness(1.1) contrast(1.1)' 
              }}
            />
          </div>
          {nameKey === "aashish" && (
            <>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes rock-guitar {
                  0% { transform: rotate(0deg) scale(1.1); }
                  100% { transform: rotate(-25deg) scale(1.1) translateY(-5px); }
                }
              `}} />
              <span style={{
                position: 'absolute',
                bottom: '35px',
                right: '0px',
                fontSize: '2.5rem',
                animation: 'rock-guitar 0.3s infinite alternate ease-in-out',
                zIndex: 10,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                🎸
              </span>
            </>
          )}
          {nameKey === "nikhil" && (
            <>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes sing-mic {
                  0% { transform: translateY(0px) rotate(-10deg) scale(1.1); }
                  100% { transform: translateY(-5px) rotate(10deg) scale(1.1); }
                }
              `}} />
              <span style={{
                position: 'absolute',
                bottom: '35px',
                right: '0px',
                fontSize: '2.5rem',
                animation: 'sing-mic 0.5s infinite alternate ease-in-out',
                zIndex: 10,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                🎤
              </span>
            </>
          )}
          {nameKey === "nitesh" && (
            <>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes play-drum {
                  0% { transform: scale(1) translateY(0px) rotate(-10deg); }
                  50% { transform: scale(1.1) translateY(-5px) rotate(10deg); }
                  100% { transform: scale(1) translateY(0px) rotate(-10deg); }
                }
              `}} />
              <span style={{
                position: 'absolute',
                bottom: '35px',
                right: '0px',
                fontSize: '2.5rem',
                animation: 'play-drum 0.3s infinite ease-in-out',
                zIndex: 10,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                🥁
              </span>
            </>
          )}
          {nameKey === "jenish" && (
            <>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes pump-iron {
                  0% { transform: translateY(0px) scale(1) rotate(-5deg); }
                  50% { transform: translateY(-10px) scale(1.1) rotate(5deg); }
                  100% { transform: translateY(0px) scale(1) rotate(-5deg); }
                }
              `}} />
              <span style={{
                position: 'absolute',
                bottom: '35px',
                right: '0px',
                fontSize: '2.5rem',
                animation: 'pump-iron 1s infinite ease-in-out',
                zIndex: 10,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                🏋️‍♂️
              </span>
            </>
          )}          {nameKey === "prativa" && (
            <>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes data-analysis {
                  0% { transform: translateY(0px) scale(1); }
                  50% { transform: translateY(-5px) scale(1.1); }
                  100% { transform: translateY(0px) scale(1); }
                }
              `}} />
              <span style={{
                position: 'absolute',
                bottom: '35px',
                right: '0px',
                fontSize: '2.5rem',
                animation: 'data-analysis 1.5s infinite ease-in-out',
                zIndex: 10,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                📈
              </span>
            </>
          )}

          {nameKey === "dinesh" && (
            <>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes egg-bounce {
                  0% { transform: translateY(0px) scale(1); }
                  50% { transform: translateY(-8px) scale(1.1) rotate(10deg); }
                  100% { transform: translateY(0px) scale(1); }
                }
              `}} />
              <span style={{
                position: 'absolute',
                bottom: '35px',
                right: '0px',
                fontSize: '2.5rem',
                animation: 'egg-bounce 0.8s infinite ease-in-out',
                zIndex: 10,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                🥚
              </span>
            </>
          )}
          {nameKey === "pratisha" && (
            <>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes manager-chart {
                  0% { transform: translateY(0px) scale(1); }
                  50% { transform: translateY(-5px) scale(1.1); }
                  100% { transform: translateY(0px) scale(1); }
                }
              `}} />
              <span style={{
                position: 'absolute',
                bottom: '35px',
                right: '0px',
                fontSize: '2.5rem',
                animation: 'manager-chart 1.2s infinite ease-in-out',
                zIndex: 10,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                📋
              </span>
            </>
          )}

          {nameKey === "bikesh" && (
            <>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes cycle-ride {
                  0% { transform: translateX(0px) rotate(-5deg); }
                  50% { transform: translateX(5px) rotate(5deg) scale(1.05); }
                  100% { transform: translateX(0px) rotate(-5deg); }
                }
              `}} />
              <span style={{
                position: 'absolute',
                bottom: '35px',
                right: '0px',
                fontSize: '2.5rem',
                animation: 'cycle-ride 0.5s infinite ease-in-out',
                zIndex: 10,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                🚴
              </span>
            </>
          )}
          {nameKey === "pranay" && (
            <>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes yoga-float {
                  0% { transform: translateY(0px) scale(1); }
                  50% { transform: translateY(-8px) scale(1.05); }
                  100% { transform: translateY(0px) scale(1); }
                }
              `}} />
              <span style={{
                position: 'absolute',
                bottom: '35px',
                right: '0px',
                fontSize: '2.5rem',
                animation: 'yoga-float 2s infinite ease-in-out',
                zIndex: 10,
                textShadow: '0 2px 4px rgba(0,0,0,0.3)'
              }}>
                🧘
              </span>
            </>
          )}
          {nameKey === "sanish" && (
            <>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes play-flute {
                  0% { transform: rotate(0deg) scale(1.1); }
                  100% { transform: rotate(5deg) scale(1.1) translateY(-2px); }
                }
              `}} />
              <div style={{
                position: 'absolute',
                bottom: '30px',
                right: '-20px',
                animation: 'play-flute 0.6s infinite alternate ease-in-out',
                zIndex: 10,
                transformOrigin: 'left center'
              }}>
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
            </>
          )}
          {festive && !hasOwnProp.includes(nameKey) && (
            <span className="loader-festive-kite" aria-hidden="true">🪁</span>
          )}
          <span style={{ 
            marginTop: '8px', 
            fontSize: '1.2rem', 
            fontWeight: 'bold', 
            color: 'var(--text-main, #333)',
            background: 'rgba(255,255,255,0.7)',
            padding: '2px 8px',
            borderRadius: '4px'
          }}>
            {currentName}
          </span>
        </div>
        
        <div className="splash-text">Heubert Tracker</div>
        {festiveTagline}
        <div className="loader-bar-container" style={{ marginTop: '1rem' }}>
          <div className="loader-bar"></div>
        </div>
      </div>
    </div>
  );
}
