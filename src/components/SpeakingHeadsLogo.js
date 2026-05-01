"use client";

import { useState, useEffect } from "react";

/**
 * SpeakingHeadsLogo
 * Highly interactive loading logo with team members walking in a line.
 * Features 13 members with lip-sync animation and personalized phrases.
 */

const members = [
  { name: "Sanish", phrase: "I am Sanish", gender: "boy", color: "#7C3AED", avatar: "/avatars/boy.png" },
  { name: "Isha", phrase: "Hey its Isha", gender: "girl", color: "#DB2777", avatar: "/avatars/girl.png" },
  { name: "Bikesh", phrase: "Nice to meet you, I am Bikesh", gender: "boy", color: "#059669", avatar: "/avatars/boy.png" },
  { name: "Nikhil", phrase: "I am Nikhil", gender: "boy", color: "#2563EB", avatar: "/avatars/boy.png" },
  { name: "Merisha", phrase: "I am Merisha", gender: "girl", color: "#D97706", avatar: "/avatars/girl.png" },
  { name: "Pratisha", phrase: "I am Pratisha", gender: "girl", color: "#0891B2", avatar: "/avatars/girl.png" },
  { name: "Pranay", phrase: "I am Pranay", gender: "boy", color: "#4F46E5", avatar: "/avatars/boy.png" },
  { name: "Nitesh", phrase: "I am Nitesh", gender: "boy", color: "#F59E0B", avatar: "/avatars/boy.png" },
  { name: "Dinesh", phrase: "I am Dinesh", gender: "boy", color: "#DC2626", avatar: "/avatars/boy.png" },
  { name: "Jenish", phrase: "I am Jenish", gender: "boy", color: "#10B981", avatar: "/avatars/boy.png" },
  { name: "Aasish", phrase: "I am Aasish", gender: "boy", color: "#6366F1", avatar: "/avatars/boy.png" },
  { name: "Sairose", phrase: "I am Sairose", gender: "boy", color: "#8B5CF6", avatar: "/avatars/boy.png" },
  { name: "Prativa", phrase: "I am Prativa", gender: "girl", color: "#EC4899", avatar: "/avatars/girl.png" },
];

export default function SpeakingHeadsLogo() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [stage, setStage] = useState("walking-in"); // walking-in, speaking, walking-out

  useEffect(() => {
    let timer;
    if (stage === "walking-in") {
      timer = setTimeout(() => setStage("speaking"), 1000);
    } else if (stage === "speaking") {
      timer = setTimeout(() => setStage("walking-out"), 2500);
    } else if (stage === "walking-out") {
      timer = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % members.length);
        setStage("walking-in");
      }, 1000);
    }
    return () => clearTimeout(timer);
  }, [stage]);

  const currentMember = members[currentIndex];

  return (
    <div className="speaking-logo-container">
      <style>{`
        .speaking-logo-container {
          position: relative;
          width: 500px;
          height: 350px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }

        .walking-track {
          position: relative;
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .avatar-group {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          transition: transform 1s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.5s ease;
        }

        .avatar-group.walking-in {
          transform: translateX(250px);
          opacity: 0;
        }

        .avatar-group.speaking {
          transform: translateX(0);
          opacity: 1;
        }

        .avatar-group.walking-out {
          transform: translateX(-250px);
          opacity: 0;
        }

        .avatar-frame {
          position: relative;
          width: 150px;
          height: 150px;
          animation: walking-bob 0.5s ease-in-out infinite;
          animation-play-state: ${stage === 'speaking' ? 'paused' : 'running'};
        }

        @keyframes walking-bob {
          0%, 100% { transform: translateY(0) rotate(1deg); }
          50% { transform: translateY(-12px) rotate(-1deg); }
        }

        .avatar-circle {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          overflow: hidden;
          border: 4px solid var(--accent-indigo);
          box-shadow: 0 15px 35px rgba(0,0,0,0.4);
          background: #1f2937;
          position: relative;
        }

        .avatar-mouth {
          position: absolute;
          bottom: 35px;
          left: 50%;
          transform: translateX(-50%);
          width: 22px;
          height: 6px;
          background: #331111;
          border-radius: 10px;
          z-index: 10;
          opacity: 0;
          transition: opacity 0.3s ease;
        }

        .avatar-mouth.speaking {
          opacity: 1;
          animation: lip-sync 0.15s ease-in-out infinite alternate;
        }

        @keyframes lip-sync {
          from { height: 4px; transform: translateX(-50%) scaleX(0.85); }
          to { height: 16px; transform: translateX(-50%) scaleX(1.1); border-radius: 50%; }
        }

        .avatar-img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .speech-bubble {
          position: absolute;
          top: -65px;
          background: rgba(30, 41, 59, 0.9);
          backdrop-filter: blur(16px);
          padding: 12px 24px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          color: white;
          font-weight: 800;
          font-size: 1.1rem;
          box-shadow: 0 10px 25px rgba(0,0,0,0.5);
          opacity: 0;
          transform: translateY(20px) scale(0.7);
          transition: all 0.4s cubic-bezier(0.17, 0.84, 0.44, 1.3);
          white-space: nowrap;
          z-index: 30;
        }

        .speech-bubble.visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        .speech-bubble::after {
          content: '';
          position: absolute;
          bottom: -10px;
          left: 50%;
          transform: translateX(-50%);
          border-left: 10px solid transparent;
          border-right: 10px solid transparent;
          border-top: 10px solid rgba(30, 41, 59, 0.9);
        }

        .floor-shadow {
          position: absolute;
          bottom: 30px;
          width: 120px;
          height: 12px;
          background: rgba(0,0,0,0.3);
          border-radius: 50%;
          filter: blur(6px);
          transition: transform 1s ease, opacity 0.5s ease;
          opacity: ${stage === 'speaking' ? 1 : 0.6};
        }

        .dot-container {
          position: absolute;
          bottom: 15px;
          display: flex;
          gap: 6px;
        }

        .dot {
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: rgba(255,255,255,0.1);
          transition: all 0.4s ease;
        }

        .dot.active {
          background: var(--dot-color);
          transform: scale(1.4);
          box-shadow: 0 0 10px var(--dot-color);
        }
      `}</style>

      <div className="walking-track">
        <div className="floor-shadow" style={{ 
          transform: stage === 'speaking' ? 'translateX(0) scale(1.1)' : 
                     stage === 'walking-in' ? 'translateX(250px) scale(0.6)' : 'translateX(-250px) scale(0.6)' 
        }} />
        
        <div className={`avatar-group ${stage}`}>
          <div className={`speech-bubble ${stage === "speaking" ? "visible" : ""}`}>
            {currentMember.phrase}
          </div>

          <div className="avatar-frame">
            <div className="avatar-circle">
              <img 
                src={currentMember.avatar} 
                alt={currentMember.name} 
                className="avatar-img"
              />
              <div className={`avatar-mouth ${stage === "speaking" ? "speaking" : ""}`} />
            </div>
          </div>
        </div>
      </div>

      <div className="dot-container">
        {members.map((m, i) => (
          <div 
            key={i}
            className={`dot ${i === currentIndex ? "active" : ""}`}
            style={{ "--dot-color": currentMember.color }}
          />
        ))}
      </div>
    </div>
  );
}
