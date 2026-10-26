import { useState } from "react";
import { View, Text, Pressable, Linking, Alert, StyleSheet } from "react-native";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Card, SectionTitle, Chip, Button, FormModal } from "./ui";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { formatHour, googleEventLink } from "../lib/teamCalendar";

const DURATIONS = [30, 45, 60];

// The web Calendar tab's "Find a time": the first free slots everyone picked shares this week,
// inside working hours, each with a pre-filled Google Calendar link (booking happens in Google, so
// the tracker never writes to anyone's calendar). The slots come from findFreeSlots on the screen.
export default function CalendarFindTime({ connected, pending = false, people, picked, setPicked, duration, setDuration, slots, dayLabel, today, isMe }) {
  const t = useThemeColors();
  const [adding, setAdding] = useState(false);
  const pickedPeople = people.filter((p) => picked.includes(p.id));
  const emails = pickedPeople.map((p) => p.work_email).filter(Boolean);
  const rest = people.filter((p) => !picked.includes(p.id));

  const book = (slot) => {
    const url = googleEventLink({ title: "Meeting", date: slot.date, from: slot.from, to: slot.to, emails });
    Linking.openURL(url).catch(() => Alert.alert("Couldn't open Google Calendar"));
  };

  return (
    <Card>
      <SectionTitle style={styles.title}>Find a time</SectionTitle>
      <Text style={[styles.muted, { color: t.text3 }]}>Free slots everyone picked shares this week, inside working hours.</Text>

      <View style={styles.picks}>
        {pickedPeople.map((p) => (
          <View key={p.id} style={[styles.pick, { backgroundColor: t.raised, borderColor: t.line }]}>
            <Avatar name={p.name} size={24} isMe={isMe(p)} />
            <Text style={[styles.pickName, { color: t.text1 }]} numberOfLines={1}>
              {p.name.split(" ")[0]}
            </Text>
            <Pressable
              onPress={() => setPicked((prev) => prev.filter((id) => id !== p.id))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${p.name}`}
              style={styles.pickRemove}
            >
              <Icon name="x" size={14} strokeWidth={2.4} color={t.text3} />
            </Pressable>
          </View>
        ))}
        {rest.length > 0 ? <Button title="Add person" icon="plus" variant="secondary" small onPress={() => setAdding(true)} /> : null}
      </View>

      <View style={styles.durations}>
        {DURATIONS.map((d) => (
          <Chip key={d} label={d === 60 ? "1 hour" : `${d} min`} active={duration === d} onPress={() => setDuration(d)} />
        ))}
      </View>

      {pending ? (
        <Text style={[styles.muted, { color: t.text3 }]}>Checking everyone's calendars…</Text>
      ) : !connected ? (
        <Text style={[styles.muted, { color: t.text3 }]}>Needs Google Calendar connected.</Text>
      ) : pickedPeople.length === 0 ? (
        <Text style={[styles.muted, { color: t.text3 }]}>Pick at least one person.</Text>
      ) : slots.length === 0 ? (
        <Text style={[styles.muted, { color: t.text3 }]}>No shared free slot left this week. Try a shorter length or next week.</Text>
      ) : (
        slots.map((s, i) => (
          <View key={`${s.date}-${s.from}`} style={[styles.slot, i > 0 && { borderTopWidth: 1, borderTopColor: t.line }]}>
            <View style={[styles.slotDot, { backgroundColor: t.green }]} />
            <View style={styles.slotText}>
              <Text style={[styles.mono, { color: t.text1 }]}>
                {s.date === today ? "Today" : dayLabel(s.date)} · {formatHour(s.from)} – {formatHour(s.to)}
              </Text>
              <Text style={[styles.muted, { color: t.text3 }]}>{pickedPeople.length === 1 ? "Free" : `All ${pickedPeople.length} free`}</Text>
            </View>
            <Button title="Book" icon="external" variant="secondary" small onPress={() => book(s)} />
          </View>
        ))
      )}

      <FormModal visible={adding} onClose={() => setAdding(false)} title="Add person">
        {rest.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => {
              setPicked((prev) => [...prev, p.id]);
              setAdding(false);
            }}
            accessibilityRole="button"
            style={({ pressed }) => [styles.personRow, { borderBottomColor: t.line }, pressed && { backgroundColor: t.pbGray }]}
          >
            <Avatar name={p.name} size={32} isMe={isMe(p)} />
            <Text style={[styles.personName, { color: t.text1 }]} numberOfLines={1}>
              {p.name}
            </Text>
          </Pressable>
        ))}
      </FormModal>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 4 },
  muted: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  mono: { fontFamily: fonts.mono, fontSize: 13 },
  picks: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8, marginTop: 12, marginBottom: 10 },
  pick: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingLeft: 6, paddingRight: 4, borderWidth: 1, borderRadius: radius.pill },
  pickName: { fontFamily: fonts.bodyMedium, fontSize: 14, maxWidth: 110 },
  pickRemove: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  durations: { flexDirection: "row", flexWrap: "wrap", marginBottom: 4 },
  slot: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  slotDot: { width: 8, height: 8, borderRadius: 4 },
  slotText: { flex: 1, minWidth: 0, gap: 2 },
  personRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, paddingHorizontal: 4, borderBottomWidth: 1 },
  personName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15 },
});
