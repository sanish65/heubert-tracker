import { View, Text, StyleSheet } from "react-native";
import { parseAnswer } from "../lib/standupText";

// One standup answer as typed, as the web's src/components/StandupAnswer.js: lines kept, and
// "*", "-", "•" or "1." lines as a list with their bullet or number in a column of its own.
// `style` is the answer's text style (font, size, colour).
export default function StandupAnswer({ text, style }) {
  const blocks = parseAnswer(text);
  return (
    <View style={styles.answer}>
      {blocks.map((block, i) =>
        block.type === "p" ? (
          <Text key={i} style={style}>
            {block.text}
          </Text>
        ) : (
          <View key={i} style={styles.list}>
            {block.items.map((item, j) => (
              <View key={j} style={styles.item}>
                <Text style={[style, styles.marker]} importantForAccessibility="no" accessibilityElementsHidden>
                  {block.type === "ol" ? `${block.start + j}.` : "•"}
                </Text>
                <Text style={[style, styles.itemText]}>{item}</Text>
              </View>
            ))}
          </View>
        )
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  answer: { gap: 6 },
  list: { gap: 2 },
  item: { flexDirection: "row", gap: 6 },
  marker: { minWidth: 14, textAlign: "right" },
  itemText: { flex: 1 },
});
