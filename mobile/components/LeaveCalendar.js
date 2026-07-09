import { useState, useMemo } from "react";
import { View, Text, Pressable } from "react-native";
import { useThemeColors } from "../lib/theme";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const TYPE_COLOR = { full: "#6366f1", half: "#f59e0b", early: "#0ea5e9" };

export default function LeaveCalendar({ leaves, selectedEmployee, publicHolidays = [] }) {
  const t = useThemeColors();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const getDatesInRange = (start, end) => {
    const dates = [];
    let current = new Date(start + "T00:00:00");
    const last = new Date(end + "T00:00:00");
    while (current <= last) {
      const dow = current.getDay();
      const y = current.getFullYear();
      const m = String(current.getMonth() + 1).padStart(2, "0");
      const d = String(current.getDate()).padStart(2, "0");
      const dtStr = `${y}-${m}-${d}`;
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = publicHolidays.some((h) => h.date === dtStr);
      if (!isWeekend && !isHoliday) dates.push(dtStr);
      current.setDate(current.getDate() + 1);
    }
    return dates;
  };

  const leaveDateMap = useMemo(() => {
    const map = {};
    const filtered = selectedEmployee ? leaves.filter((l) => l.employee_name === selectedEmployee) : leaves;
    filtered.forEach((leave) => {
      const dates = leave.dates || getDatesInRange(leave.start_date, leave.end_date);
      dates.forEach((d) => {
        if (!map[d]) map[d] = [];
        map[d].push({ type: leave.type, name: leave.employee_name, id: leave.id });
      });
    });
    return map;
  }, [leaves, selectedEmployee]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const { filteredLeavesCount, totalDays } = useMemo(() => {
    const filtered = selectedEmployee ? leaves.filter((l) => l.employee_name === selectedEmployee) : leaves;
    let count = 0;
    let days = 0;
    filtered.forEach((l) => {
      const dates = l.dates || getDatesInRange(l.start_date, l.end_date);
      const datesInThisMonth = dates.filter((d) => {
        const dt = new Date(d + "T00:00:00");
        return dt.getFullYear() === viewYear && dt.getMonth() === viewMonth;
      });
      if (datesInThisMonth.length > 0) {
        count++;
        days += l.type === "half" ? datesInThisMonth.length * 0.5 : datesInThisMonth.length;
      }
    });
    return { filteredLeavesCount: count, totalDays: days };
  }, [leaves, selectedEmployee, viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };
  const goToday = () => {
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const dayLeaves = leaveDateMap[dateStr] || [];
    const isToday = day === now.getDate() && viewMonth === now.getMonth() && viewYear === now.getFullYear();
    const isHoliday = publicHolidays.some((h) => h.date === dateStr);
    cells.push({ day, dateStr, dayLeaves, isToday, isHoliday });
  }

  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <Pressable onPress={prevMonth} hitSlop={8}>
          <Text style={{ color: t.textSecondary, fontSize: 20 }}>‹</Text>
        </Pressable>
        <Text style={{ color: t.textPrimary, fontSize: 16, fontWeight: "700" }}>
          {MONTHS[viewMonth]} {viewYear}
        </Text>
        <Pressable onPress={nextMonth} hitSlop={8}>
          <Text style={{ color: t.textSecondary, fontSize: 20 }}>›</Text>
        </Pressable>
      </View>
      <Pressable onPress={goToday} style={{ alignSelf: "center", marginBottom: 10 }}>
        <Text style={{ color: t.accentIndigo, fontSize: 12, fontWeight: "600" }}>Jump to Today</Text>
      </Pressable>

      <View style={{ flexDirection: "row", justifyContent: "space-around", marginBottom: 10 }}>
        <Text style={{ color: t.textMuted, fontSize: 12 }}>{filteredLeavesCount} leave records</Text>
        <Text style={{ color: t.textMuted, fontSize: 12 }}>{totalDays} total days</Text>
      </View>

      <View style={{ flexDirection: "row" }}>
        {DAYS.map((d) => (
          <View key={d} style={{ width: `${100 / 7}%`, alignItems: "center", paddingBottom: 6 }}>
            <Text style={{ color: t.textMuted, fontSize: 11, fontWeight: "600" }}>{d}</Text>
          </View>
        ))}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        {cells.map((cell, i) => {
          if (!cell) return <View key={`e-${i}`} style={{ width: `${100 / 7}%`, height: 52 }} />;
          const hasFull = cell.dayLeaves.some((l) => l.type === "full");
          const hasHalf = cell.dayLeaves.some((l) => l.type === "half");
          const hasEarly = cell.dayLeaves.some((l) => l.type === "early");
          const dotColor = hasFull ? TYPE_COLOR.full : hasHalf ? TYPE_COLOR.half : hasEarly ? TYPE_COLOR.early : null;

          return (
            <View
              key={cell.dateStr}
              style={{
                width: `${100 / 7}%`,
                height: 52,
                padding: 2,
                borderRadius: 8,
                backgroundColor: cell.isToday ? t.accentIndigo + "22" : cell.isHoliday ? "#f97316" + "18" : "transparent",
                borderWidth: cell.isToday ? 1 : 0,
                borderColor: t.accentIndigo,
                alignItems: "center",
              }}
            >
              <Text style={{ color: cell.isHoliday ? "#f97316" : t.textSecondary, fontSize: 12, fontWeight: cell.isToday ? "800" : "500" }}>
                {cell.day}
              </Text>
              {dotColor ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: dotColor, marginTop: 2 }} /> : null}
              {cell.dayLeaves.length > 0 && (
                <Text numberOfLines={1} style={{ color: t.textMuted, fontSize: 8, marginTop: 1 }}>
                  {cell.dayLeaves[0].name.split(" ")[0]}
                  {cell.dayLeaves.length > 1 ? ` +${cell.dayLeaves.length - 1}` : ""}
                </Text>
              )}
            </View>
          );
        })}
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 12 }}>
        {[
          ["Full Day", TYPE_COLOR.full],
          ["Half Day", TYPE_COLOR.half],
          ["Early Leave", TYPE_COLOR.early],
          ["Holiday", "#f97316"],
        ].map(([label, color]) => (
          <View key={label} style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
            <Text style={{ color: t.textMuted, fontSize: 11 }}>{label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
