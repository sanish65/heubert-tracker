// The web's src/lib/standupText.js, for the app (mobileStandupText.test.mjs keeps them equal).

// Standup answers as people type them: plain lines, and bullet lists started with *, -, +,
// • or a number ("1." / "1)"). The meeting shows those as real lists, the form carries a
// bullet on when you press Enter, and the short "recent updates" line drops the marker.
// Pure, no imports, so it runs under `npm test`; mobile/lib/standupText.js is the same code.

// "* ", "- ", "+ " and "– " need the space (so *bold* or -5 stay text); "•" and "·" don't.
const BULLET_RE = /^(\s*)([*+\-–]\s+|[•·]\s*)(.*)$/;
const NUMBER_RE = /^(\s*)(\d{1,3})([.)])\s+(.*)$/;

// One line → { kind: "ul" | "ol" | "text", text, number?, indent, marker }.
export function readLine(line) {
  let m = NUMBER_RE.exec(line);
  if (m) return { kind: "ol", indent: m[1], number: Number(m[2]), marker: `${m[2]}${m[3]} `, sep: m[3], text: m[4] };
  m = BULLET_RE.exec(line);
  if (m) return { kind: "ul", indent: m[1], marker: m[2], text: m[3] };
  return { kind: "text", text: line };
}

// The answer as blocks to render: { type: "p", text } (lines kept), { type: "ul", items }
// or { type: "ol", start, items }. An indented line under an item carries on that item; a
// blank line ends a list.
export function parseAnswer(text) {
  const blocks = [];
  let current = null;
  for (const raw of String(text ?? "").replace(/\r\n?/g, "\n").split("\n")) {
    const line = readLine(raw);
    if (!raw.trim()) {
      current = null;
      continue;
    }
    if (line.kind === "text") {
      if (current && current.type !== "p" && /^\s/.test(raw)) {
        const items = current.items;
        items[items.length - 1] += `\n${raw.trim()}`;
      } else if (current?.type === "p") {
        current.text += `\n${raw}`;
      } else {
        current = { type: "p", text: raw };
        blocks.push(current);
      }
      continue;
    }
    if (current?.type !== line.kind) {
      current = line.kind === "ol" ? { type: "ol", start: line.number, items: [] } : { type: "ul", items: [] };
      blocks.push(current);
    }
    current.items.push(line.text);
  }
  return blocks;
}

// The first line without its bullet, for one-line summaries.
export function plainFirstLine(text) {
  const first = String(text ?? "").split(/\r?\n/).find((l) => l.trim()) || "";
  const line = readLine(first);
  return (line.kind === "text" ? first : line.text).trim();
}

// Enter pressed at `caret` in `value`: on a bullet line with text, the next line starts with
// the same bullet (a number counts on); on an empty bullet, the bullet is removed and the
// list ends. → { value, caret }, or null to let Enter be a plain new line.
export function continueList(value, caret) {
  const lineStart = value.lastIndexOf("\n", caret - 1) + 1;
  const lineEndAt = value.indexOf("\n", caret);
  const lineEnd = lineEndAt === -1 ? value.length : lineEndAt;
  const line = readLine(value.slice(lineStart, lineEnd));
  if (line.kind === "text") return null;
  const markerEnd = lineStart + line.indent.length + line.marker.length;
  if (caret < markerEnd) return null;
  if (!line.text.trim()) {
    const next = value.slice(0, lineStart) + value.slice(lineEnd);
    return { value: next, caret: lineStart };
  }
  const marker = line.kind === "ol" ? `${line.number + 1}${line.sep} ` : line.marker;
  const insert = `\n${line.indent}${marker}`;
  return { value: value.slice(0, caret) + insert + value.slice(caret), caret: caret + insert.length };
}
