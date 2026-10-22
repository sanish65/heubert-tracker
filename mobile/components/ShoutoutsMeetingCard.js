import { useMemo, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Card, SectionTitle, EmptyState, IconButton } from "./ui";
import { useShoutouts } from "../lib/useShoutouts";
import { shiftDay, nextMeetingDay } from "../lib/standupShoutouts";
import { toDate } from "../lib/dates";
import { ShoutoutComposer, ShoutoutRow, ShoutoutEditor, ShoutoutError } from "./ShoutoutParts";

const dayLabel = (ymd) => toDate(ymd).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
const weekdayOf = (ymd) => toDate(ymd).toLocaleDateString("en-US", { weekday: "long" });

// Shout-outs and kudos in Meeting mode, as the web's MeetingShoutouts.js: anyone signed in posts one
// for today's meeting or the next one (written the evening before, shown when that meeting starts),
// optionally tagging the colleagues it is for; you edit and delete your own, admins delete any. The
// previous-day arrow looks back at earlier days, read-only; the next-day arrow goes as far as the
// next meeting day. Row Level Security enforces the same; the reads and writes are useShoutouts'.
export default function ShoutoutsMeetingCard({ today }) {
  const t = useThemeColors();
  const { currentEmployee, publicHolidays } = useApp();

  // null = follow today; set once someone steps through the days.
  const [pickedDate, setPickedDate] = useState(null);
  const date = pickedDate || today;
  const isToday = date === today;
  const upcoming = useMemo(() => (today ? nextMeetingDay(today, publicHolidays) : ""), [today, publicHolidays]);
  const isUpcoming = !!upcoming && date === upcoming;
  // Past meetings stay as they were; today's and the next one are still open.
  const isOpen = isToday || isUpcoming;

  const { shoutouts, loadError, error, setError, saving, post, saveEdit, remove, isMine, canDelete, taggable, nameById } = useShoutouts(date);

  const [text, setText] = useState("");
  const [tags, setTags] = useState([]);
  const [editing, setEditing] = useState(null); // { id, text, tags }

  const handlePost = async () => {
    if (!(await post({ content: text, tags }))) return;
    setText("");
    setTags([]);
  };
  const startEdit = (s) => {
    setEditing({ id: s.id, text: s.content, tags: s.tagged_employee_ids || [] });
    setError("");
  };
  const handleSaveEdit = async () => {
    if (await saveEdit(editing.id, { content: editing.text, tags: editing.tags })) setEditing(null);
  };

  const goBackDay = () => {
    setEditing(null);
    setPickedDate(shiftDay(date, -1));
  };
  const goForwardDay = () => {
    setEditing(null);
    if (isToday) {
      setPickedDate(upcoming);
      return;
    }
    const next = shiftDay(date, 1);
    setPickedDate(next >= today ? null : next);
  };

  const label = isToday ? "Today" : `${dayLabel(date)}${isUpcoming ? " · next meeting" : ""}`;
  const emptyText = isToday
    ? "No shout-outs yet today. Be the first."
    : isUpcoming
      ? "Nothing queued for the next meeting yet. Add one now and it shows up when the meeting starts."
      : "No shout-outs on this day.";

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={styles.heading}>
          <SectionTitle style={styles.title}>Shout-outs & kudos</SectionTitle>
          <Text style={[styles.sub, { color: t.text3 }]}>Thank a colleague or celebrate a win.</Text>
        </View>
      </View>

      {today ? (
        <View style={[styles.dayNav, { backgroundColor: t.raised, borderColor: t.line }]} accessibilityRole="toolbar" accessibilityLabel="Shout-out date">
          <IconButton icon="chevron-left" tone="plain" size={40} onPress={goBackDay} accessibilityLabel="Previous day" color={t.text1} />
          <Text style={[styles.dayLabel, { color: t.text1 }]}>{label}</Text>
          <IconButton icon="chevron-right" tone="plain" size={40} onPress={goForwardDay} disabled={isUpcoming} accessibilityLabel="Next day" color={t.text1} />
        </View>
      ) : null}

      {loadError ? (
        <EmptyState icon="alert" text={loadError} />
      ) : (
        <>
          {shoutouts.length === 0 ? (
            <EmptyState icon="sparkles" text={emptyText} />
          ) : (
            <View>
              {shoutouts.map((s, i) =>
                editing?.id === s.id ? (
                  <ShoutoutEditor
                    key={s.id}
                    editing={editing}
                    setEditing={setEditing}
                    taggable={taggable}
                    nameById={nameById}
                    saving={saving}
                    onSave={handleSaveEdit}
                    first={i === 0}
                  />
                ) : (
                  <ShoutoutRow
                    key={s.id}
                    shoutout={s}
                    mine={isMine(s)}
                    canEdit={isOpen && isMine(s)}
                    canDelete={isOpen && canDelete(s)}
                    nameById={nameById}
                    onEdit={() => startEdit(s)}
                    onDelete={() => remove(s.id)}
                    first={i === 0}
                  />
                )
              )}
            </View>
          )}

          <ShoutoutError message={error} />

          {currentEmployee && isOpen ? (
            <ShoutoutComposer
              text={text}
              setText={setText}
              tags={tags}
              setTags={setTags}
              taggable={taggable}
              nameById={nameById}
              saving={saving && !editing}
              onPost={handlePost}
              placeholder={isUpcoming ? `Queue a shout-out for ${weekdayOf(date)}'s meeting…` : "Who deserves a shout-out, and for what?"}
            />
          ) : null}
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  heading: { flex: 1, minWidth: 0, gap: 2 },
  title: { marginBottom: 0 },
  sub: { fontFamily: fonts.body, fontSize: 13 },
  dayNav: { flexDirection: "row", alignItems: "center", borderRadius: radius.md, borderWidth: 1, paddingHorizontal: 2 },
  dayLabel: { flex: 1, textAlign: "center", fontFamily: fonts.bodySemibold, fontSize: 14 },
});
