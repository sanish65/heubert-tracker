import { useState } from "react";
import { View, Text, TextInput, Pressable, Alert, StyleSheet } from "react-native";
import { useThemeColors, radius, fonts } from "../lib/theme";
import { Button, IconButton, FormModal, EmptyState } from "./ui";
import Avatar from "./Avatar";
import Icon from "./Icon";
import { SHOUTOUT_MAX, postedAt } from "../lib/standupShoutouts";

// The pieces both shout-out boards share (StandupShoutouts on the Daily standup screen,
// ShoutoutsMeetingCard in Meeting mode), as the web's StandupShoutouts.js and MeetingShoutouts.js:
// the text box with its 280-character cap, the teammates it is for, one post with its edit and
// delete buttons, and the inline editor.

// The multi-line box, in TextField's look (ui.js) with the cap and a live count.
export function ShoutoutInput({ value, onChangeText, placeholder, label, autoFocus }) {
  const t = useThemeColors();
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.inputWrap}>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={t.text3}
        multiline
        maxLength={SHOUTOUT_MAX}
        autoFocus={autoFocus}
        accessibilityLabel={label}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={[styles.input, { backgroundColor: t.raised, color: t.text1, borderColor: focused ? t.cyan : t.lineStrong }]}
      />
      <Text style={[styles.count, { color: t.text3 }]}>{`${value.length}/${SHOUTOUT_MAX}`}</Text>
    </View>
  );
}

// "For" and the tagged teammates as removable chips, then "Tag a teammate", which opens a sheet of
// everyone else who hasn't resigned (the web's select).
export function TagPicker({ value, onChange, options, nameById }) {
  const t = useThemeColors();
  const [open, setOpen] = useState(false);
  const remaining = options.filter((e) => !value.includes(e.id));
  return (
    <View style={styles.tags}>
      <Text style={[styles.forLabel, { color: t.text3 }]}>For</Text>
      {value.map((id) => {
        const name = nameById.get(id) || "Unknown";
        return (
          <View key={id} style={[styles.tag, { backgroundColor: t.surface, borderColor: t.lineStrong }]}>
            <Avatar name={name} size={22} />
            <Text numberOfLines={1} style={[styles.tagText, { color: t.text1 }]}>
              {name}
            </Text>
            <Pressable
              onPress={() => onChange(value.filter((v) => v !== id))}
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${name}`}
              style={styles.tagRemove}
            >
              <Icon name="x" size={14} strokeWidth={2} color={t.text3} />
            </Pressable>
          </View>
        );
      })}
      {remaining.length > 0 ? (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Tag a teammate"
          style={({ pressed }) => [styles.addTag, { borderColor: t.lineStrong, backgroundColor: pressed ? t.raised : "transparent" }]}
        >
          <Icon name="plus" size={14} strokeWidth={2} color={t.text2} />
          <Text style={[styles.addTagText, { color: t.text2 }]}>Tag teammate</Text>
        </Pressable>
      ) : null}
      <FormModal visible={open} onClose={() => setOpen(false)} title="Tag a teammate">
        {remaining.length === 0 ? (
          <EmptyState icon="users" text="Everyone is tagged." />
        ) : (
          remaining.map((e, i) => (
            <Pressable
              key={e.id}
              onPress={() => {
                onChange([...value, e.id]);
                setOpen(false);
              }}
              accessibilityRole="button"
              accessibilityLabel={`Tag ${e.name}`}
              style={({ pressed }) => [styles.pickRow, { borderTopColor: i === 0 ? "transparent" : t.line }, pressed && { backgroundColor: t.pbGray }]}
            >
              <Avatar name={e.name} size={32} />
              <Text numberOfLines={1} style={[styles.pickName, { color: t.text1 }]}>
                {e.name}
              </Text>
            </Pressable>
          ))
        )}
      </FormModal>
    </View>
  );
}

// The composer: the box, who it is for, and Post (orange: shout-outs are a people moment).
export function ShoutoutComposer({ text, setText, tags, setTags, taggable, nameById, saving, onPost, placeholder }) {
  return (
    <View style={styles.compose}>
      <ShoutoutInput value={text} onChangeText={setText} placeholder={placeholder} label="Your shout-out" />
      <TagPicker value={tags} onChange={setTags} options={taggable} nameById={nameById} />
      <Button title={saving ? "Posting…" : "Post"} variant="orange" icon="send" small onPress={onPost} disabled={!text.trim() || saving} style={styles.post} />
    </View>
  );
}

// One post: the author (You for your own), who it is for, when, the text; Edit for your own and
// Delete for your own or, for admins, anyone's, when `editable` (past meetings are read-only).
export function ShoutoutRow({ shoutout, mine, canEdit, canDelete, nameById, onEdit, onDelete, first }) {
  const t = useThemeColors();
  const tagged = (shoutout.tagged_employee_ids || []).map((id) => nameById.get(id)).filter(Boolean);
  const time = postedAt(shoutout.created_at);
  const confirmDelete = () =>
    Alert.alert("Delete this shout-out?", shoutout.content.slice(0, 80), [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: onDelete },
    ]);
  return (
    <View style={[styles.row, { borderTopColor: first ? "transparent" : t.line }]}>
      <Avatar name={shoutout.author} size={34} isMe={mine} />
      <View style={styles.rowBody}>
        <View style={styles.meta}>
          <Text numberOfLines={1} style={[styles.author, { color: t.text1 }]}>
            {mine ? "You" : shoutout.author}
          </Text>
          {tagged.length > 0 ? (
            <Text numberOfLines={1} style={[styles.for, { color: t.text2 }]}>
              {`for ${tagged.join(", ")}`}
            </Text>
          ) : null}
          {time ? <Text style={[styles.time, { color: t.text3 }]}>{time}</Text> : null}
        </View>
        <Text style={[styles.text, { color: t.text1 }]}>{shoutout.content}</Text>
      </View>
      {canEdit || canDelete ? (
        <View style={styles.actions}>
          {canEdit ? <IconButton icon="edit" tone="plain" size={36} iconSize={16} onPress={onEdit} accessibilityLabel="Edit shout-out" /> : null}
          {canDelete ? <IconButton icon="trash" tone="plain" size={36} iconSize={16} color={t.pfRed} onPress={confirmDelete} accessibilityLabel="Delete shout-out" /> : null}
        </View>
      ) : null}
    </View>
  );
}

// A post being edited, in place of its row.
export function ShoutoutEditor({ editing, setEditing, taggable, nameById, saving, onSave, first }) {
  const t = useThemeColors();
  return (
    <View style={[styles.editor, { borderTopColor: first ? "transparent" : t.line }]}>
      <ShoutoutInput value={editing.text} onChangeText={(text) => setEditing({ ...editing, text })} label="Edit shout-out" autoFocus />
      <TagPicker value={editing.tags} onChange={(tags) => setEditing({ ...editing, tags })} options={taggable} nameById={nameById} />
      <View style={styles.editActions}>
        <Button title="Cancel" variant="secondary" small onPress={() => setEditing(null)} />
        <Button title="Save" small onPress={onSave} disabled={!editing.text.trim() || saving} />
      </View>
    </View>
  );
}

export function ShoutoutError({ message }) {
  const t = useThemeColors();
  if (!message) return null;
  return (
    <View accessibilityRole="alert" style={[styles.error, { backgroundColor: t.pbRed, borderColor: t.redEdge }]}>
      <Icon name="alert" size={16} color={t.pfRed} />
      <Text style={[styles.errorText, { color: t.pfRed }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: { gap: 4 },
  input: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 21,
    textAlignVertical: "top",
  },
  count: { alignSelf: "flex-end", fontFamily: fonts.mono, fontSize: 11 },
  tags: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 },
  forLabel: { fontFamily: fonts.bodySemibold, fontSize: 13 },
  tag: { maxWidth: "100%", height: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 4, paddingRight: 8, borderRadius: radius.pill, borderWidth: 1 },
  tagText: { flexShrink: 1, fontFamily: fonts.bodyMedium, fontSize: 13 },
  tagRemove: { width: 22, height: 22, alignItems: "center", justifyContent: "center" },
  addTag: { height: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderStyle: "dashed" },
  addTagText: { fontFamily: fonts.bodyMedium, fontSize: 13 },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, borderTopWidth: 1, paddingHorizontal: 4 },
  pickName: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 15 },
  compose: { gap: 10 },
  post: { alignSelf: "flex-end" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingVertical: 12, borderTopWidth: 1 },
  rowBody: { flex: 1, minWidth: 0, gap: 4 },
  meta: { flexDirection: "row", flexWrap: "wrap", alignItems: "baseline", columnGap: 8, rowGap: 2 },
  author: { fontFamily: fonts.bodySemibold, fontSize: 14 },
  for: { flexShrink: 1, fontFamily: fonts.body, fontSize: 13 },
  time: { fontFamily: fonts.mono, fontSize: 12 },
  text: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
  actions: { flexDirection: "row", marginRight: -8 },
  editor: { gap: 10, paddingVertical: 12, borderTopWidth: 1 },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  error: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: radius.sm, borderWidth: 1 },
  errorText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 13 },
});
