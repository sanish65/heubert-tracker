import { useMemo, useState } from "react";
import { View, Text, Pressable } from "react-native";
import { useApp } from "../context/AppContext";
import { useThemeColors } from "../lib/theme";

const BANNER_COLORS = {
  event: "#6366f1",
  holiday: "#22c55e",
  celebration: "#f59e0b",
};

export default function EventBanner() {
  const { publicHolidays, companyEvents, employees } = useApp();
  const t = useThemeColors();
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
        banners.push({ id: `ev-${ev.id}`, diff, type: "event", title: ev.title, icon: "📢" });
      }
    });

    publicHolidays.forEach((h) => {
      const diff = getDiffDays(h.date);
      if (diff >= 0 && diff <= 7) {
        banners.push({ id: `hol-${h.id}`, diff, type: "holiday", title: h.title, icon: "🎉" });
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
              banners.push({ id: `bday-${emp.id}-${y}`, diff, type: "celebration", title: `${emp.name}'s Birthday`, icon: "🎂" });
            } else {
              const years = y - d.getFullYear();
              if (years > 0) {
                banners.push({ id: `work-${emp.id}-${y}`, diff, type: "celebration", title: `${years} yr Anniversary of ${emp.name}`, icon: "🏆" });
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
    <View style={{ marginBottom: 12 }}>
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
        const color = BANNER_COLORS[b.type];

        return (
          <View
            key={b.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              backgroundColor: color + "22",
              borderWidth: 1,
              borderColor: color + "55",
              borderRadius: 12,
              padding: 12,
              marginBottom: 8,
            }}
          >
            <Text style={{ fontSize: 22, marginRight: 10 }}>{b.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.textPrimary, fontWeight: "700", fontSize: 14 }}>{text}</Text>
              <Text style={{ color: t.textMuted, fontSize: 12 }}>{subtext}</Text>
            </View>
            <Pressable onPress={() => setClosedBanners((prev) => ({ ...prev, [b.id]: true }))} hitSlop={10}>
              <Text style={{ color: t.textMuted, fontSize: 16, paddingHorizontal: 6 }}>✕</Text>
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}
