import { View, Text, Linking, Alert, StyleSheet } from "react-native";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { FormModal, Button, Pill } from "./ui";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { EVENT_KINDS } from "../lib/teamCalendar";

// One meeting from the Team calendar, opened from the day agenda. It shows only what the web's
// Calendar tab shows on its blocks: a "Busy" one (private in Google, or "Busy blocks only" on for a
// teammate) keeps its time and nothing else. Join Meet appears only when the route sent a link,
// which it does only on the viewer's own events.
//
// event: { title, timeLabel, kind, attendeeCount, meet, busy, allDay }, person: { name, isMe }
export default function CalendarEventSheet({ event, person, dayLabel, onClose }) {
  const t = useThemeColors();
  if (!event) return null;
  const kind = EVENT_KINDS[event.kind] || EVENT_KINDS.team;
  const busy = event.busy;

  const join = () => {
    const url = event.meet;
    if (!url || !/^https:\/\//i.test(url)) return;
    Linking.openURL(url).catch(() => Alert.alert("Couldn't open Google Meet", url));
  };

  return (
    <FormModal visible onClose={onClose} title={busy ? "Busy" : event.title}>
      <View style={styles.row}>
        <Avatar name={person.name} size={32} isMe={person.isMe} />
        <Text style={[styles.person, { color: t.text1 }]} numberOfLines={1}>
          {person.name}
          {person.isMe ? " (you)" : ""}
        </Text>
      </View>

      <View style={[styles.box, { backgroundColor: t.raised, borderColor: t.line }]}>
        <View style={styles.line}>
          <Icon name="clock" size={16} color={t.text3} />
          <Text style={[styles.mono, { color: t.text1 }]}>
            {dayLabel} · {event.allDay ? "All day" : event.timeLabel}
          </Text>
        </View>
        {!busy ? (
          <>
            <View style={styles.line}>
              <Icon name="calendar" size={16} color={t.text3} />
              <Pill tone={kind.tone}>{kind.label}</Pill>
            </View>
            {event.attendeeCount > 1 ? (
              <View style={styles.line}>
                <Icon name="users" size={16} color={t.text3} />
                <Text style={[styles.text, { color: t.text2 }]}>{event.attendeeCount} people</Text>
              </View>
            ) : null}
          </>
        ) : (
          <Text style={[styles.text, { color: t.text3 }]}>
            {event.private ? "Marked private in Google Calendar: only the time is shared." : "Busy blocks only is on: titles are hidden."}
          </Text>
        )}
      </View>

      {!busy && event.meet ? (
        <Button title="Join Google Meet" icon="video" onPress={join} style={styles.join} />
      ) : !busy && person.isMe ? (
        <Text style={[styles.text, styles.note, { color: t.text3 }]}>No video link on this meeting.</Text>
      ) : null}
    </FormModal>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  person: { flex: 1, fontFamily: fonts.bodySemibold, fontSize: 15 },
  box: { borderWidth: 1, borderRadius: radius.md, padding: 14, gap: 12, marginBottom: 16 },
  line: { flexDirection: "row", alignItems: "center", gap: 10 },
  mono: { fontFamily: fonts.mono, fontSize: 14 },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  note: { marginBottom: 8 },
  join: { marginBottom: 8 },
});
