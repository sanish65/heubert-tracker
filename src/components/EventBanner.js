"use client";

import { useMemo } from "react";
import { useApp } from "@/context/AppContext";

export default function EventBanner() {
  const { publicHolidays, companyEvents, employees } = useApp();

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
          icon: "📅",
          className: "banner-event",
        });
      }
    });

    // 2. Process Public Holidays
    publicHolidays.forEach((h) => {
      const diff = getDiffDays(h.date);
      if (diff >= 0 && diff <= 7) {
        banners.push({
          id: `hol-${h.id}`,
          diff,
          type: "holiday",
          title: h.title,
          icon: "🎉",
          className: "banner-holiday",
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
              banners.push({
                id: `bday-${emp.id}-${y}`,
                diff,
                type: "celebration",
                title: `${emp.name}'s Birthday`,
                icon: "🎂",
                className: "banner-celebration",
              });
            } else {
              const years = y - d.getFullYear();
              if (years > 0) {
                banners.push({
                  id: `work-${emp.id}-${y}`,
                  diff,
                  type: "celebration",
                  title: `${years} yr Anniversary of ${emp.name}`,
                  icon: "🏆",
                  className: "banner-celebration",
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

    // Limit to top 3 upcoming to avoid screen clutter
    return banners.slice(0, 3);
  }, [publicHolidays, companyEvents, employees]);

  if (activeBanners.length === 0) return null;

  return (
    <div className="event-banners-container">
      {activeBanners.map((b) => {
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
          <div key={b.id} className={`holiday-alert-banner countdown-banner ${b.className} pulse-entry`}>
            <span className="holiday-icon">{b.icon}</span>
            <div className="holiday-text">
              <strong>{text}</strong>
              <span>{subtext}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
