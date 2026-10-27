import { parseAnswer } from "@/lib/standupText";

// One standup answer as typed: lines kept, and "*", "-", "•" or "1." lines as real lists
// (src/lib/standupText.js). `format` styles the text inside (the meeting's Jira links).
export default function StandupAnswer({ text, format = (t) => t }) {
  return parseAnswer(text).map((block, i) => {
    if (block.type === "p") {
      return (
        <span key={i} className="ans-p">
          {format(block.text)}
        </span>
      );
    }
    const List = block.type === "ol" ? "ol" : "ul";
    return (
      <List key={i} className="ans-list" start={block.type === "ol" && block.start !== 1 ? block.start : undefined}>
        {block.items.map((item, j) => (
          <li key={j}>{format(item)}</li>
        ))}
      </List>
    );
  });
}
