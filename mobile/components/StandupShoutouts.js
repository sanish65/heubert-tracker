import { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Card, EmptyState, Pill } from "./ui";
import Icon from "./Icon";
import { useShoutouts } from "../lib/useShoutouts";
import { ShoutoutComposer, ShoutoutRow, ShoutoutEditor, ShoutoutError } from "./ShoutoutParts";

// The standup screen polls less often than Meeting mode: nobody is presenting here, it only has to
// catch up with posts made elsewhere (the web's POLL_MS on the Daily standup page).
const POLL_MS = 15000;

// The Shout-outs card of the Daily standup screen, as the web's StandupShoutouts.js: the board for
// the selected day's meeting, read and written through useShoutouts as Meeting mode does. It saves
// to the main project's meeting_shoutouts, apart from the standup log, so either card failing
// leaves the other working.
export default function StandupShoutouts({ date, dayShort }) {
  const t = useThemeColors();
  const { currentEmployee } = useApp();
  const { shoutouts, isLoading, loadError, error, setError, saving, post, saveEdit, remove, isMine, canDelete, taggable, nameById } =
    useShoutouts(date, { pollMs: POLL_MS });

  // Drafts belong to a day: switching days starts a fresh one.
  const [draft, setDraft] = useState({ date, text: "", tags: [] });
  const text = draft.date === date ? draft.text : "";
  const tags = draft.date === date ? draft.tags : [];
  const setText = (value) => setDraft({ date, text: value, tags });
  const setTags = (value) => setDraft({ date, text, tags: value });

  const [editing, setEditing] = useState(null); // { id, text, tags }
  const editingId = editing && shoutouts.some((s) => s.id === editing.id) ? editing.id : null;

  const handlePost = async () => {
    if (await post({ content: text, tags })) setDraft({ date, text: "", tags: [] });
  };
  const startEdit = (s) => {
    setEditing({ id: s.id, text: s.content, tags: s.tagged_employee_ids || [] });
    setError("");
  };
  const handleSaveEdit = async () => {
    if (await saveEdit(editing.id, { content: editing.text, tags: editing.tags })) setEditing(null);
  };

  return (
    <Card style={styles.card}>
      <View style={styles.head}>
        <View style={[styles.tile, { backgroundColor: t.orangeSoft, borderColor: t.orangeEdge }]}>
          <Icon name="sparkles" size={20} color={t.orange} />
        </View>
        <View style={styles.heading}>
          <Text accessibilityRole="header" style={[styles.title, { color: t.text1 }]}>
            Shout-outs
          </Text>
          <Text style={[styles.sub, { color: t.text3 }]}>{`Shown at ${dayShort}'s meeting`}</Text>
        </View>
        <Pill tone="gray">{String(shoutouts.length)}</Pill>
      </View>

      {currentEmployee ? (
        <ShoutoutComposer
          text={text}
          setText={setText}
          tags={tags}
          setTags={setTags}
          taggable={taggable}
          nameById={nameById}
          saving={saving && !editingId}
          onPost={handlePost}
          placeholder="Thank a teammate for something they did…"
        />
      ) : null}

      <ShoutoutError message={error} />

      {loadError ? (
        <EmptyState icon="alert" text={loadError} />
      ) : isLoading ? (
        <EmptyState icon="sparkles" text="Loading shout-outs…" />
      ) : shoutouts.length === 0 ? (
        <EmptyState icon="sparkles" text={`No shout-outs for ${dayShort} yet.`} />
      ) : (
        <View>
          {shoutouts.map((s, i) =>
            editingId === s.id ? (
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
                canEdit={isMine(s)}
                canDelete={canDelete(s)}
                nameById={nameById}
                onEdit={() => startEdit(s)}
                onDelete={() => remove(s.id)}
                first={i === 0}
              />
            )
          )}
        </View>
      )}

      <View style={styles.foot}>
        <Icon name="message" size={14} color={t.text3} />
        <Text style={[styles.footText, { color: t.text3 }]}>Saved to the meeting board</Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  tile: { width: 40, height: 40, borderRadius: 12, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  heading: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontFamily: fonts.display, fontSize: 18 },
  sub: { fontFamily: fonts.body, fontSize: 13 },
  foot: { flexDirection: "row", alignItems: "center", gap: 6 },
  footText: { fontFamily: fonts.mono, fontSize: 12 },
});
