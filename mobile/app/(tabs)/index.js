import { useState } from "react";
import { View, Text, Pressable, ActivityIndicator } from "react-native";
import { Link } from "expo-router";
import { useApp } from "../../context/AppContext";
import { API_BASE_URL } from "../../lib/supabase";
import { useThemeColors, radius } from "../../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Chip } from "../../components/ui";
import EventBanner from "../../components/EventBanner";
import NewFiscalYearBanner from "../../components/NewFiscalYearBanner";
import { getNepalDateStr } from "../../lib/attendance";

function formatNepalTime(isoStr) {
  if (!isoStr) return null;
  return new Date(isoStr).toLocaleTimeString("en-US", {
    timeZone: "Asia/Kathmandu",
    hour: "numeric",
    minute: "2-digit",
  });
}

function AttendanceCard() {
  const { attendance, currentEmployee, leaves, publicHolidays } = useApp();
  const t = useThemeColors();

  const todayStr = getNepalDateStr(new Date());
  const isWeekendToday = new Date().getDay() === 0 || new Date().getDay() === 6;
  const todaysHoliday = publicHolidays.find((h) => h.date === todayStr);
  const onLeaveToday = currentEmployee
    ? leaves.some((l) => l.employee_name === currentEmployee.name && todayStr >= l.start_date && todayStr <= l.end_date)
    : false;
  const today = currentEmployee
    ? attendance.find((a) => a.employee_name === currentEmployee.name && a.date === todayStr)
    : null;

  let icon = "⚠️";
  let title = "Attendance";
  let statusText = "You haven't checked in yet today!";
  let color = t.accentRed;

  if (isWeekendToday || todaysHoliday) {
    icon = "😌";
    title = todaysHoliday ? `Relax, it's ${todaysHoliday.title}!` : "Relax, it's the weekend!";
    statusText = "No attendance needed today.";
    color = t.accentSky;
  } else if (onLeaveToday) {
    icon = "🏖️";
    title = "You're on leave today";
    statusText = "Enjoy your time off!";
    color = t.accentSky;
  } else if (today?.check_out_at) {
    icon = "✅";
    statusText = `Checked out at ${formatNepalTime(today.check_out_at)}`;
    color = t.accentIndigo;
  } else if (today?.check_in_at) {
    icon = "🟢";
    statusText = `Checked in at ${formatNepalTime(today.check_in_at)}${today.is_late ? ` · Late by ${today.late_minutes}m` : ""}`;
    color = t.accentGreen;
  }

  return (
    <Link href="/attendance" asChild>
      <Pressable>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            backgroundColor: color + "22",
            borderWidth: 1,
            borderColor: color + "55",
            borderRadius: radius.lg,
            padding: 14,
            marginBottom: 12,
          }}
        >
          <Text style={{ fontSize: 22, marginRight: 12 }}>{icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.textPrimary, fontSize: 15, fontWeight: "700" }}>{title}</Text>
            <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 2 }}>{statusText}</Text>
          </View>
          <Text style={{ color: t.textMuted, fontSize: 16 }}>›</Text>
        </View>
      </Pressable>
    </Link>
  );
}

function StatCard({ icon, label, value, sub, color }) {
  const t = useThemeColors();
  return (
    <Card style={{ flexBasis: "48%", flexGrow: 1, borderTopWidth: 3, borderTopColor: color }}>
      <Text style={{ fontSize: 22 }}>{icon}</Text>
      <Text style={{ color: t.textMuted, fontSize: 11, fontWeight: "600", letterSpacing: 0.5, textTransform: "uppercase", marginTop: 6 }}>
        {label}
      </Text>
      <Text style={{ color: color, fontSize: 18, fontWeight: "800", letterSpacing: -0.3, marginTop: 2 }}>{value}</Text>
      {sub ? <Text style={{ color: t.textMuted, fontSize: 11, marginTop: 2 }}>{sub}</Text> : null}
    </Card>
  );
}

function CompactRow({ left, right, badge, badgeColor }) {
  const t = useThemeColors();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: t.border,
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.textPrimary, fontSize: 14, fontWeight: "600" }}>{left}</Text>
        {right ? <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>{right}</Text> : null}
      </View>
      {badge ? (
        <View style={{ backgroundColor: (badgeColor || t.accentIndigo) + "22", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
          <Text style={{ color: badgeColor || t.accentIndigo, fontSize: 11, fontWeight: "700" }}>{badge}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function DashboardScreen() {
  const { fines, fineSeasons, standupFines, employees, leaves, withdrawals, publicHolidays } = useApp();
  const t = useThemeColors();
  const [sendingWish, setSendingWish] = useState(null);
  const [selectedFineSeasonId, setSelectedFineSeasonId] = useState(null); // null = follow latest season

  const totalAmount = fines.reduce((s, f) => s + f.amount, 0);
  const paidAmount = fines.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0);
  const unpaidAmount = fines.filter((f) => f.status === "unpaid").reduce((s, f) => s + f.amount, 0);
  const totalWithdrawn = withdrawals.reduce((s, w) => s + w.amount, 0);
  const remaining = paidAmount - totalWithdrawn;
  const standupUnpaid = standupFines.filter((f) => f.status === "unpaid");

  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const upcomingLeaves = leaves
    .filter((l) => l.end_date >= todayStr)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .slice(0, 5);

  const upcomingHolidays = publicHolidays
    .filter((h) => h.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const celebrations = employees
    .flatMap((emp) => {
      const list = [];
      const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());

      const getCelebrationsForDate = (originalDate, type) => {
        const d = new Date(originalDate);
        const yearsToCheck = [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1];

        yearsToCheck.forEach((y) => {
          const occurrence = new Date(y, d.getMonth(), d.getDate());
          const diffDays = (occurrence - todayNoTime) / (1000 * 60 * 60 * 24);

          if (Math.abs(diffDays) <= 15) {
            const isToday = occurrence.toDateString() === today.toDateString();
            if (type === "birthday") {
              list.push({
                type: "birthday",
                date: occurrence,
                displayDate: `${occurrence.toLocaleString("default", { month: "short" })} ${occurrence.getDate()}`,
                name: "Birthday",
                email: emp.work_email || emp.personal_email,
                empName: emp.name,
                isToday,
              });
            } else {
              const years = y - d.getFullYear();
              if (years > 0) {
                list.push({
                  type: "anniversary",
                  date: occurrence,
                  displayDate: `${occurrence.toLocaleString("default", { month: "short" })} ${occurrence.getDate()}`,
                  name: `${years} Year${years > 1 ? "s" : ""} at Heubert!`,
                  email: emp.work_email || emp.personal_email,
                  empName: emp.name,
                  years,
                  isToday,
                });
              }
            }
          }
        });
      };

      if (emp.dob) getCelebrationsForDate(emp.dob, "birthday");
      if (emp.joined_date) getCelebrationsForDate(emp.joined_date, "anniversary");
      return list;
    })
    .sort((a, b) => a.date - b.date);

  // Fine seasons — the chart below is scoped to whichever season is selected,
  // defaulting to the latest one. Stat cards elsewhere are unaffected — they
  // always span every fine, regardless of season.
  const sortedFineSeasons = [...fineSeasons].sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  const latestFineSeasonId = sortedFineSeasons[0]?.id ?? null;
  const hasUnassignedFines = fines.some((f) => !f.season_id);
  const effectiveFineSeasonId =
    selectedFineSeasonId !== null ? selectedFineSeasonId : latestFineSeasonId ?? (hasUnassignedFines ? "unassigned" : null);
  const activeFineSeason = sortedFineSeasons.find((s) => s.id === effectiveFineSeasonId);

  const seasonFines = effectiveFineSeasonId === "unassigned" ? fines.filter((f) => !f.season_id) : fines.filter((f) => f.season_id === effectiveFineSeasonId);

  const empData = employees
    .filter((emp) => emp.status !== "resigned" && emp.name !== "Developers" && emp.name !== "Sameer")
    .map((emp) => {
      const empFines = seasonFines.filter((f) => f.employee_name === emp.name);
      return {
        name: emp.name,
        paid: empFines.filter((f) => f.status === "paid").reduce((s, f) => s + f.amount, 0),
        unpaid: empFines.filter((f) => f.status === "unpaid").reduce((s, f) => s + f.amount, 0),
      };
    })
    .filter((e) => e.paid + e.unpaid > 0)
    .sort((a, b) => b.paid + b.unpaid - (a.paid + a.unpaid));

  const maxTotal = Math.max(...empData.map((e) => e.paid + e.unpaid), 1);

  const handleWish = async (celebration) => {
    setSendingWish(celebration.empName);
    try {
      const res = await fetch(`${API_BASE_URL}/api/send-wish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: celebration.email,
          name: celebration.empName,
          type: celebration.type,
          years: celebration.years,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Failed to send wish");
    } catch (err) {
      console.error("Send wish error:", err);
    } finally {
      setSendingWish(null);
    }
  };

  return (
    <Screen>
      <EventBanner />
      <NewFiscalYearBanner />

      <AttendanceCard />

      <Card>
        <SectionTitle>🕒 Pending Standups</SectionTitle>
        {standupUnpaid.length === 0 ? (
          <EmptyState icon="🎉" text="All caught up!" />
        ) : (
          standupUnpaid.slice(0, 5).map((f) => <CompactRow key={f.id} left={f.employee_name} right={f.date} badge="Pending" badgeColor={t.accentRed} />)
        )}
      </Card>

      <Card>
        <SectionTitle>🏖️ Upcoming Leaves</SectionTitle>
        {upcomingLeaves.length === 0 ? (
          <EmptyState text="No leaves planned soon." />
        ) : (
          upcomingLeaves.map((l) => (
            <CompactRow
              key={l.id}
              left={l.employee_name}
              right={l.start_date === l.end_date ? l.start_date : `${l.start_date} to ${l.end_date}`}
              badge={l.type}
            />
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>🌴 Upcoming Holidays</SectionTitle>
        {upcomingHolidays.length === 0 ? (
          <EmptyState text="No upcoming holidays." />
        ) : (
          upcomingHolidays.map((h) => (
            <CompactRow
              key={h.id}
              left={h.title}
              right={new Date(h.date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
              badge={h.date === tomorrowStr ? "Tomorrow" : null}
              badgeColor={t.accentGreen}
            />
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>✨ Celebrations</SectionTitle>
        {celebrations.length === 0 ? (
          <EmptyState text="No celebrations within 15 days." />
        ) : (
          celebrations.map((c, idx) => (
            <View
              key={idx}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingVertical: 8,
                borderBottomWidth: 1,
                borderBottomColor: t.border,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.textPrimary, fontSize: 14, fontWeight: "600" }}>
                  {c.type === "birthday" ? "🎂" : "🏆"} {c.empName}
                </Text>
                <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>{c.name}</Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={{ color: t.textMuted, fontSize: 12, marginBottom: 4 }}>{c.displayDate}</Text>
                {c.isToday && (
                  <Pressable
                    onPress={() => !sendingWish && handleWish(c)}
                    disabled={!!sendingWish}
                    style={{ backgroundColor: t.accentIndigo, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 }}
                  >
                    {sendingWish === c.empName ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>Send Wish</Text>
                    )}
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>Fines by Employee</SectionTitle>
        {(sortedFineSeasons.length > 0 || hasUnassignedFines) && (
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 6 }}>
            {sortedFineSeasons.map((s) => (
              <Chip key={s.id} label={s.title} active={effectiveFineSeasonId === s.id} onPress={() => setSelectedFineSeasonId(s.id)} />
            ))}
            {hasUnassignedFines && (
              <Chip
                label="Pre Fiscal Year Fines"
                active={effectiveFineSeasonId === "unassigned"}
                onPress={() => setSelectedFineSeasonId("unassigned")}
              />
            )}
          </View>
        )}
        {empData.length === 0 ? (
          <EmptyState text={`No fines recorded in ${activeFineSeason ? activeFineSeason.title : "this season"} yet.`} />
        ) : (
          empData.map((emp) => (
            <View key={emp.name} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ color: t.textSecondary, fontSize: 12 }}>{emp.name.split(" ")[0]}</Text>
                <Text style={{ color: t.textMuted, fontSize: 12 }}>Rs. {emp.paid + emp.unpaid}</Text>
              </View>
              <View style={{ flexDirection: "row", height: 10, borderRadius: 6, overflow: "hidden", backgroundColor: t.border }}>
                <View style={{ width: `${(emp.paid / maxTotal) * 100}%`, backgroundColor: t.accentGreen }} />
                <View style={{ width: `${(emp.unpaid / maxTotal) * 100}%`, backgroundColor: t.accentRed }} />
              </View>
            </View>
          ))
        )}
        <View style={{ flexDirection: "row", gap: 16, marginTop: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.accentGreen }} />
            <Text style={{ color: t.textMuted, fontSize: 12 }}>Paid</Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: t.accentRed }} />
            <Text style={{ color: t.textMuted, fontSize: 12 }}>Unpaid</Text>
          </View>
        </View>
      </Card>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
        <StatCard icon="💰" label="Late Fines" value={`Rs. ${totalAmount.toLocaleString()}`} sub={`${fines.length} records`} color={t.accentIndigo} />
        <StatCard icon="📝" label="Standup Records" value={standupFines.length} sub={`${standupUnpaid.length} pending`} color="#f43f5e" />
        <StatCard icon="⏳" label="Unpaid Fines" value={`Rs. ${unpaidAmount.toLocaleString()}`} sub={`${fines.filter((f) => f.status === "unpaid").length} late entries`} color={t.accentRed} />
        <StatCard icon="👥" label="Employees" value={employees.length} sub="active" color={t.accentAmber} />
        <StatCard
          icon="💸"
          label="Collected & Withdrawn"
          value={`Rs. ${paidAmount.toLocaleString()}`}
          sub={`Rs. ${totalWithdrawn.toLocaleString()} withdrawn · Rs. ${remaining >= 0 ? remaining.toLocaleString() : 0} left`}
          color={t.accentGreen}
        />
      </View>
    </Screen>
  );
}
