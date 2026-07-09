import { useMemo, useState } from "react";
import { View, Text } from "react-native";
import { Stack } from "expo-router";
import { useApp } from "../context/AppContext";
import { useThemeColors } from "../lib/theme";
import { Screen, Card, SectionTitle, EmptyState, Button } from "../components/ui";
import AddFineModal from "../components/AddFineModal";
import AddStandupFineModal from "../components/AddStandupFineModal";
import AddLeaveModal from "../components/AddLeaveModal";
import AddWordModal from "../components/AddWordModal";

export default function MeetingScreen() {
  const {
    fines,
    standupFines,
    leaves,
    words,
    wordSeasons,
    employees,
    publicHolidays,
    standupSubmissions,
    standupQuestions,
    isAdmin,
  } = useApp();
  const t = useThemeColors();

  const [showAddFine, setShowAddFine] = useState(false);
  const [showAddStandup, setShowAddStandup] = useState(false);
  const [showAddLeave, setShowAddLeave] = useState(false);
  const [showAddWord, setShowAddWord] = useState(false);

  const today = new Date().toLocaleDateString("en-CA");

  const todaysFines = useMemo(() => fines.filter((f) => f.date === today), [fines, today]);
  const todaysStandups = useMemo(() => standupFines.filter((f) => f.date === today), [standupFines, today]);

  const activeLeaves = useMemo(() => {
    const d = new Date();
    const dow = d.getDay();
    const dtStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = publicHolidays.some((h) => h.date.startsWith(dtStr));
    if (isWeekend || isHoliday) return [];
    return leaves.filter((l) => (l.dates && Array.isArray(l.dates) ? l.dates.includes(dtStr) : dtStr >= l.start_date && dtStr <= l.end_date));
  }, [leaves, publicHolidays]);

  const nonStandupEmails = new Set(["developers@heubert.com"]);
  const nonStandupFirstNames = new Set(["sameer"]);

  const allSubmissions = useMemo(() => {
    const actualSubmissions = standupSubmissions.filter((s) => s.date === today);
    const submittedEmails = new Set(actualSubmissions.filter((s) => s.email).map((s) => s.email.trim().toLowerCase()));
    const submittedFirstNames = new Set(actualSubmissions.filter((s) => s.name).map((s) => s.name.trim().split(/\s+/)[0].toLowerCase()));

    const missingSubmissions = (employees || [])
      .filter((emp) => {
        if (emp.status && emp.status !== "active") return false;
        const workEmail = emp.work_email?.trim().toLowerCase();
        const personalEmail = emp.personal_email?.trim().toLowerCase();
        const empFirstName = emp.name?.trim().split(/\s+/)[0].toLowerCase();
        if (workEmail && nonStandupEmails.has(workEmail)) return false;
        if (personalEmail && nonStandupEmails.has(personalEmail)) return false;
        if (empFirstName && nonStandupFirstNames.has(empFirstName)) return false;
        if (submittedEmails.has(workEmail) || submittedEmails.has(personalEmail)) return false;
        if (empFirstName && submittedFirstNames.has(empFirstName)) return false;
        return true;
      })
      .map((emp, idx) => ({ id: `missing-${emp.id || idx}`, name: emp.name, date: today, isMissing: true, answers: {}, jira_tickets: [] }));

    const sortedActual = [...actualSubmissions].sort((a, b) => new Date(a.responded_at) - new Date(b.responded_at));
    return [...missingSubmissions, ...sortedActual];
  }, [standupSubmissions, today, employees]);

  const todaysWord = useMemo(() => words.find((w) => w.created_at?.startsWith(today)), [words, today]);

  return (
    <Screen>
      <Stack.Screen options={{ title: "Meeting Mode" }} />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
        <Button title="+ Late Fine" small onPress={() => setShowAddFine(true)} />
        <Button title="+ Standup Fine" small variant="warning" onPress={() => setShowAddStandup(true)} />
        <Button title="+ Leave" small variant="accent" onPress={() => setShowAddLeave(true)} />
        {!todaysWord && <Button title="+ Set Word" small variant="ghost" onPress={() => setShowAddWord(true)} />}
      </View>

      <Card>
        <SectionTitle>💰 Today's Late Fines</SectionTitle>
        {todaysFines.length === 0 ? (
          <EmptyState icon="☀️" text="All on time today!" />
        ) : (
          todaysFines.map((f, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
              <Text style={{ color: t.textPrimary, fontSize: 14 }}>{f.employee_name}</Text>
              <Text style={{ color: t.textMuted, fontSize: 13 }}>Rs. {f.amount} · {f.status}</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>📝 Standup Status</SectionTitle>
        {todaysStandups.length === 0 ? (
          <EmptyState text="No standup fines yet." />
        ) : (
          todaysStandups.map((s, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
              <Text style={{ color: t.textPrimary, fontSize: 14 }}>{s.employee_name}</Text>
              <Text style={{ color: t.textMuted, fontSize: 13 }}>{s.status}</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>🏖️ On Leave Today</SectionTitle>
        {activeLeaves.length === 0 ? (
          <EmptyState icon="💪" text="Full strength today!" />
        ) : (
          activeLeaves.map((l, i) => (
            <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
              <Text style={{ color: t.textPrimary, fontSize: 14 }}>{l.employee_name}</Text>
              <Text style={{ color: t.textMuted, fontSize: 13 }}>{l.type}</Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <SectionTitle>✅ Daily Submissions ({allSubmissions.filter((s) => !s.isMissing).length}/{allSubmissions.length})</SectionTitle>
        {allSubmissions.length === 0 ? (
          <EmptyState icon="📥" text="No submissions for this date." />
        ) : (
          allSubmissions.map((s, i) => {
            const visibleTickets = (s.jira_tickets || []).filter((tk) => {
              const st = (typeof tk === "object" ? tk.status : null)?.toLowerCase() ?? "";
              return !["on hold", "rejected", "backlog"].includes(st);
            });
            return (
              <View key={i} style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: t.border, opacity: s.isMissing ? 0.6 : 1 }}>
                <Text style={{ color: t.textPrimary, fontSize: 14, fontWeight: "700" }}>
                  {s.name} {s.isMissing ? "· NOT SUBMITTED" : ""}
                </Text>
                {!s.isMissing &&
                  standupQuestions.map((q, qi) => {
                    const answers = s.answers || {};
                    const answer = answers[`question_${q.id}`] || answers[q.id] || answers[q.question] || answers[q.sort_order];
                    return (
                      <View key={qi} style={{ marginTop: 6 }}>
                        <Text style={{ color: t.textMuted, fontSize: 11, fontWeight: "600" }}>{q.question}</Text>
                        <Text style={{ color: t.textSecondary, fontSize: 13 }}>{answer && String(answer).trim() ? String(answer) : "No answer provided"}</Text>
                      </View>
                    );
                  })}
                {!s.isMissing && visibleTickets.length > 0 && (
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {visibleTickets.map((tk, ti) => (
                      <View key={ti} style={{ backgroundColor: t.border, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                        <Text style={{ color: t.textSecondary, fontSize: 11 }}>{typeof tk === "object" ? tk.key || tk.summary : tk}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );
          })
        )}
      </Card>

      <Card>
        <SectionTitle>📖 Word of the Meeting</SectionTitle>
        {todaysWord ? (
          <View>
            <Text style={{ color: t.textPrimary, fontSize: 18, fontWeight: "800" }}>{todaysWord.word}</Text>
            {todaysWord.phonetic ? <Text style={{ color: t.textMuted, fontSize: 12 }}>({todaysWord.phonetic})</Text> : null}
            {todaysWord.translation ? <Text style={{ color: t.textSecondary, fontSize: 13, marginTop: 6 }}>Translation: {todaysWord.translation}</Text> : null}
            <Text style={{ color: t.textSecondary, fontSize: 14, marginTop: 6 }}>{todaysWord.definition}</Text>
            {todaysWord.example ? <Text style={{ color: t.textMuted, fontSize: 13, fontStyle: "italic", marginTop: 6 }}>"{todaysWord.example}"</Text> : null}
          </View>
        ) : (
          <EmptyState icon="📢" text="No word shared for this meeting yet." />
        )}
      </Card>

      <AddFineModal isOpen={showAddFine} onClose={() => setShowAddFine(false)} />
      <AddStandupFineModal isOpen={showAddStandup} onClose={() => setShowAddStandup(false)} />
      <AddLeaveModal isOpen={showAddLeave} onClose={() => setShowAddLeave(false)} />
      <AddWordModal isOpen={showAddWord} onClose={() => setShowAddWord(false)} seasonId={wordSeasons[wordSeasons.length - 1]?.id} />
    </Screen>
  );
}
