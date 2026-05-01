"use client";

import { useState, useEffect } from "react";
import { useApp } from "@/context/AppContext";

const greetings = ["Hi!", "Hello!", "Hey there!", "Welcome!", "Greetings!"];

// Known categorizations
const knownBoys = ["sanish", "jenish", "dinesh", "nikhil", "nitesh", "aashish", "bikesh", "pranay", "sairose"];
const knownGirls = ["isha", "pratisha", "merisha", "prativa"];

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

const defaultNames = [...knownBoys, ...knownGirls];

export default function HumanLoader() {
  const { employees } = useApp() || { employees: [] };
  const [index, setIndex] = useState(0);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [shuffledDefaults, setShuffledDefaults] = useState([]);
  const [isMounted, setIsMounted] = useState(false);

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
      setIndex(prev => (prev + 1) % names.length);
    }, 1500); // Change person every 1.5s

    const greetInterval = setInterval(() => {
      setGreetingIndex(prev => (prev + 1) % greetings.length);
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

  const wearsGlasses = ["sanish", "bikesh", "merisha", "jenish", "nikhil", "pratisha", "prativa"].includes(nameKey);
  const glassesParam = wearsGlasses ? "&glassesProbability=100" : "&glassesProbability=0";
  
  const hasBeard = ["sanish"].includes(nameKey);
  const facialHairParamString = hasBeard ? "&facialHair=beard,scruff&facialHairProbability=100" : "&facialHairProbability=0";

  const mouthParam = "smile,laughing";
  const baseColorParam = "ffffff";

  let displayGreeting = greetings[greetingIndex];
  if (nameKey === "dinesh") displayGreeting = "One egg a day!";
  else if (nameKey === "jenish") displayGreeting = "Time to hit the gym!";
  else if (nameKey === "nitesh") displayGreeting = "Let's make some noise!";
  else if (nameKey === "bikesh") displayGreeting = "Riding my way!";
  else if (nameKey === "pranay") displayGreeting = "Inner peace...";
  else if (nameKey === "sanish") displayGreeting = "Listen to my flute!";
  else if (nameKey === "aashish") displayGreeting = "Time for a solo!";
  else if (nameKey === "nikhil") displayGreeting = "I want to break free 🎵";
  else if (nameKey === "prativa") displayGreeting = "Talk me about data!";
  else if (nameKey === "pratisha") displayGreeting = "Let's review the metrics!";
  else if (nameKey === "isha") displayGreeting = "testinggg... !!!";
  else if (nameKey === "merisha") displayGreeting = "Greetings from Ishaz!";

  if (!isMounted) {
    return (
      <div className="loading-splash">
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
          <div className="splash-text">Heubert Tracker</div>
          <div className="loader-bar-container" style={{ marginTop: '1rem' }}>
            <div className="loader-bar"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="loading-splash">
      <div 
        className="human-loader-container" 
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
        <div className="loader-bar-container" style={{ marginTop: '1rem' }}>
          <div className="loader-bar"></div>
        </div>
      </div>
    </div>
  );
}
