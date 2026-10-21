import { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { useThemeColors, fonts } from "../lib/theme";
import { announcementTone } from "../lib/announcement";
import Icon from "./Icon";
import { IconButton } from "./ui";

// The canvas's Announcement card (MobileDashboard.dc.html): a tinted glass panel on a tinted edge,
// a solid icon tile, a title and a line under it, with a line icon for its kind in place of the
// emoji it had. `kind` sets the tone (lib/announcement.js): orange for a celebration, a birthday or
// a work anniversary; cyan for an event, a holiday and the new fiscal year. Home places these in
// its Announcement slot. Nothing here moves, so it is the same with motion off.
export function AnnouncementCard({ icon, title, text, kind, onClose }) {
  const t = useThemeColors();
  const tone = announcementTone(t, kind);
  return (
    <View
      accessibilityRole="summary"
      style={[styles.card, { backgroundColor: tone.fill, borderColor: tone.edge, borderTopColor: t.glassHi }]}
    >
      <View style={[styles.tile, { backgroundColor: tone.tile }]}>
        <Icon name={icon} size={20} strokeWidth={2} color={tone.ink} />
      </View>
      <View style={styles.text}>
        <Text style={[styles.title, { color: tone.title }]}>{title}</Text>
        <Text style={[styles.line, { color: tone.text }]}>{text}</Text>
      </View>
      {onClose ? <IconButton icon="x" onPress={onClose} accessibilityLabel="Dismiss" tone="plain" color={t.text2} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 14,
  },
  tile: { width: 40, height: 40, flexShrink: 0, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  text: { flex: 1, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 15 },
  line: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
});

export default function EventBanner() {
  const { publicHolidays, companyEvents, employees } = useApp();
  const [closedBanners, setClosedBanners] = useState({});

  const activeBanners = useMemo(() => {
    const banners = [];
    const todayObj = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    const getDiffDays = (dateStr) => {
      const parts = dateStr.split("-");
      if (parts.length !== 3) return -1;
      const d = new Date(parts[0], parseInt(parts[1]) - 1, parts[2]);
      return Math.round((d - todayObj) / (1000 * 60 * 60 * 24));
    };

    companyEvents.forEach((ev) => {
      const diff = getDiffDays(ev.date);
      if (diff >= 0 && diff <= 7) {
        banners.push({ id: `ev-${ev.id}`, diff, type: "event", title: ev.title, icon: "calendar" });
      }
    });

    publicHolidays.forEach((h) => {
      const diff = getDiffDays(h.date);
      if (diff >= 0 && diff <= 7) {
        banners.push({ id: `hol-${h.id}`, diff, type: "holiday", title: h.title, icon: "flag" });
      }
    });

    employees.forEach((emp) => {
      const getCelebrationDiff = (originalDateStr, type) => {
        if (!originalDateStr) return;
        const d = new Date(originalDateStr);
        const yearsToCheck = [todayObj.getFullYear(), todayObj.getFullYear() + 1];

        yearsToCheck.forEach((y) => {
          const occurrence = new Date(y, d.getMonth(), d.getDate());
          const diff = Math.round((occurrence - todayObj) / (1000 * 60 * 60 * 24));

          if (diff === 0) {
            if (type === "birthday") {
              banners.push({ id: `bday-${emp.id}-${y}`, diff, type: "celebration", title: `${emp.name}'s Birthday`, icon: "cake" });
            } else {
              const years = y - d.getFullYear();
              if (years > 0) {
                banners.push({ id: `work-${emp.id}-${y}`, diff, type: "celebration", title: `${years} yr Anniversary of ${emp.name}`, icon: "award" });
              }
            }
          }
        });
      };

      getCelebrationDiff(emp.dob, "birthday");
      getCelebrationDiff(emp.joined_date, "anniversary");
    });

    banners.sort((a, b) => a.diff - b.diff);
    return banners.slice(0, 3);
  }, [publicHolidays, companyEvents, employees]);

  const visible = activeBanners.filter((b) => !closedBanners[b.id]);
  if (visible.length === 0) return null;

  return (
    <View>
      {visible.map((b) => {
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
          <AnnouncementCard
            key={b.id}
            icon={b.icon}
            kind={b.type}
            title={text}
            text={subtext}
            onClose={() => setClosedBanners((prev) => ({ ...prev, [b.id]: true }))}
          />
        );
      })}
    </View>
  );
}
