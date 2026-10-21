import { useState } from "react";
import { Text, StyleSheet } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField } from "./ui";
import { ChoiceGroup, SheetNote, SheetActions } from "./SheetParts";
import { useThemeColors, fonts } from "../lib/theme";

// A new memory, in the record sheet's look (MobileRecordFine.dc.html): its kind, the media link or
// the message, and a caption.
const TYPE_OPTIONS = [
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "text", label: "Message" },
];

export default function AddMemoryModal({ isOpen, onClose }) {
  const { addMemory } = useApp();
  const t = useThemeColors();
  const [type, setType] = useState("image");
  const [content, setContent] = useState("");
  const [caption, setCaption] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (!content.trim()) return setError(type === "text" ? "Please write a message" : "Please provide a media URL");
    setIsSubmitting(true);
    setError("");
    try {
      await addMemory({ type, content, caption });
      setType("image");
      setContent("");
      setCaption("");
      onClose();
    } catch (err) {
      setError(err.message || "Failed to share memory");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <FormModal visible={isOpen} onClose={onClose} title="Share a Team Memory">
      <ChoiceGroup label="What kind of memory?" value={type} options={TYPE_OPTIONS} onChange={setType} />
      <TextField
        label={type === "text" ? "Your Message" : "Media URL"}
        value={content}
        onChangeText={setContent}
        placeholder={type === "text" ? "Share a funny moment, a quote, or a nice note..." : type === "image" ? "Direct image link or Google Drive link" : "Direct video link or Google Drive link"}
        multiline={type === "text"}
      />
      {type !== "text" ? (
        <Text style={[styles.tip, { color: t.text3 }]}>{"Drive tip: share the file as “Anyone with the link”."}</Text>
      ) : null}
      <TextField label="Caption (optional)" value={caption} onChangeText={setCaption} placeholder="What's the story behind this?" />
      {error ? <SheetNote>{error}</SheetNote> : null}
      <SheetActions title={isSubmitting ? "Sharing..." : "Post to Memories"} icon="send" onPress={handleSubmit} disabled={isSubmitting} onCancel={onClose} />
    </FormModal>
  );
}

const styles = StyleSheet.create({
  // Under the URL field: its 14 below the field taken back to 6, then the sheet's 16.
  tip: { marginTop: -8, marginBottom: 16, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
});
