"use client";

import { useMemo, useState } from "react";
import { useApp } from "@/context/AppContext";
import VacationAnimation from "./VacationAnimation";
import Icon from "./Icon";

export default function EventBanner() {
  const { publicHolidays, companyEvents, employees, animationsEnabled } = useApp();
  const [closedBanners, setClosedBanners] = useState({});

  const activeBanners = useMemo(() => {
    const banners = [];
    const todayStr = new Date().toLocaleDateString('en-CA'); // 'YYYY-MM-DD' local 
    const todayObj = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    const getDiffDays = (dateStr) => {
      const parts = dateStr.split('-');
      if (parts.length !== 3) return -1;
      const d = new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
      return Math.round((d - todayObj) / (1000 * 60 * 60 * 24));
    };

    // 1. Process Company Events
    companyEvents.forEach((ev) => {
      const diff = getDiffDays(ev.date);
      if (diff >= 0 && diff <= 7) {
        banners.push({
          id: `ev-${ev.id}`,
          diff,
          type: "event",
          title: ev.title,
        });
      }
    });

    // 2. Process Public Holidays
    publicHolidays.forEach((h) => {
      const diff = getDiffDays(h.date);
      // Holidays announce themselves only in the last 2 days before (and on the day).
      if (diff >= 0 && diff <= 2) {
        banners.push({
          id: `hol-${h.id}`,
          diff,
          type: "holiday",
          title: h.title,
        });
      }
    });

    // 3. Process Celebrations
    employees.forEach(emp => {
      const getCelebrationDiff = (originalDateStr, type) => {
        if (!originalDateStr) return;
        const d = new Date(originalDateStr);
        // Only look at current year (or next year if it's late December)
        const yearsToCheck = [todayObj.getFullYear(), todayObj.getFullYear() + 1];
        
        yearsToCheck.forEach(y => {
          const occurrence = new Date(y, d.getMonth(), d.getDate());
          const diff = Math.round((occurrence - todayObj) / (1000 * 60 * 60 * 24));
          
          if (diff >= 0 && diff <= 7) {
            if (type === 'birthday') {
              if (diff === 0) {
                banners.push({
                  id: `bday-${emp.id}-${y}`,
                  diff,
                  type: "celebration",
                  title: `${emp.name}'s Birthday`,
                });
              }
            } else {
              const years = y - d.getFullYear();
              if (years > 0 && diff === 0) {
                banners.push({
                  id: `work-${emp.id}-${y}`,
                  diff,
                  type: "celebration",
                  title: `${years} yr Anniversary of ${emp.name}`,
                });
              }
            }
          }
        });
      };

      getCelebrationDiff(emp.dob, 'birthday');
      getCelebrationDiff(emp.joined_date, 'anniversary');
    });

    // Sort by most imminent
    banners.sort((a, b) => a.diff - b.diff);

    // A multi-day break (e.g. "Dashain Bida") is stored as one holiday per day; show it
    // once, counting down to its nearest day, rather than one banner per date.
    const seen = new Set();
    const unique = banners.filter((b) => {
      const key = `${b.type}:${b.title.trim().toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Limit to top 3 upcoming to avoid screen clutter
    return unique.slice(0, 3);
  }, [publicHolidays, companyEvents, employees]);

  const visibleBanners = activeBanners.filter((b) => !closedBanners[b.id]);
  if (visibleBanners.length === 0) return null;

  return (
    <div className="announce-stack">
      {visibleBanners.map((b) => {
        let text = "";
        let subtext = "";

        if (b.diff === 0) {
          text = `Today is ${b.title}!`;
          subtext = b.type === "celebration" ? "Time to celebrate!" : "Don't forget today's event!";
        } else if (b.diff === 1) {
          text = `Tomorrow is ${b.title}!`;
          subtext = b.type === "holiday" ? "Enjoy your day off!" : "Get ready for tomorrow's event!";
        } else {
          text = `${b.diff} days to go for ${b.title}!`;
          subtext = "Mark your calendar and get prepared!";
        }

        return (
          <section key={b.id} className="announce-card glass" aria-label="Announcement">
            <span className="announce-icon" aria-hidden="true">
              <Icon name="flag" size={20} strokeWidth={2} />
            </span>
            <div className="announce-text">
              <span className="announce-title">{text}</span>
              <span className="announce-sub">{subtext}</span>
            </div>
            <button
              type="button"
              className="announce-dismiss"
              onClick={() => setClosedBanners(prev => ({ ...prev, [b.id]: true }))}
              aria-label="Dismiss announcement"
            >
              <Icon name="x" size={16} strokeWidth={2} />
            </button>
            {animationsEnabled !== false && b.title.toLowerCase().includes("trip to rsr") && (
              <div className="announce-scene">
                <VacationAnimation />
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
