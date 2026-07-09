import { useState } from "react";
import { Text } from "react-native";
import { useApp } from "../context/AppContext";
import { FormModal, TextField, Select, Button } from "./ui";
import { useThemeColors } from "../lib/theme";

const TYPE_OPTIONS = [
  { value: "image", label: "🖼️ Image" },
  { value: "video", label: "🎥 Video" },
  { value: "text", label: "✍️ Message" },
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
    <FormModal visible={isOpen} onClose={onClose} title="✨ Share a Team Memory">
      <Select label="What kind of memory?" value={type} onSelect={setType} options={TYPE_OPTIONS} />
      <TextField
        label={type === "text" ? "Your Message" : "Media URL"}
        value={content}
        onChangeText={setContent}
        placeholder={type === "text" ? "Share a funny moment, a quote, or a nice note..." : type === "image" ? "Direct image link or Google Drive link" : "Direct video link or Google Drive link"}
        multiline={type === "text"}
      />
      {type !== "text" ? <Text style={{ color: t.textMuted, fontSize: 12, marginBottom: 14 }}>💡 Drive tip: share the file as "Anyone with the link".</Text> : null}
      <TextField label="Caption (optional)" value={caption} onChangeText={setCaption} placeholder="What's the story behind this?" />
      {error ? <Text style={{ color: t.accentRed, fontSize: 13, marginBottom: 12 }}>{error}</Text> : null}
      <Button title={isSubmitting ? "Sharing..." : "✨ Post to Memories"} onPress={handleSubmit} disabled={isSubmitting} />
    </FormModal>
  );
}
