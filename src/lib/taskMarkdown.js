// A small, safe Markdown subset for issue descriptions and comments: paragraphs, line
// breaks, **bold**, *italic*, `code`, ``` code blocks ```, - and 1. lists, > quotes,
// [links](https://…), bare URLs, issue keys (HTT-12) and @mentions. It returns a tree
// the page renders as React elements, so nothing typed is ever inserted as HTML.
// Pure, no imports, so it runs under `npm test`.

const URL_RE = /^https?:\/\/[^\s<>]*[^\s<>().,;:!?'"\]]/;
const BOUNDARY = /[\s([{"'.,;:!?\-/]/;

// ctx: { names: ["Alice Admin", …], keys: Set(["HTT", …]) }
export function parseInline(text, ctx = {}) {
  const names = [...(ctx.names || [])].sort((a, b) => b.length - a.length);
  const keys = ctx.keys || new Set();
  const out = [];
  let buf = "";
  const flush = () => {
    if (buf) out.push({ t: "text", v: buf });
    buf = "";
  };
  const str = String(text || "");
  let i = 0;
  while (i < str.length) {
    const rest = str.slice(i);
    const atBoundary = i === 0 || BOUNDARY.test(str[i - 1]);
    let m;
    if (rest[0] === "\n") {
      flush();
      out.push({ t: "br" });
      i += 1;
      continue;
    }
    if (rest[0] === "`" && (m = rest.match(/^`([^`\n]+)`/))) {
      flush();
      out.push({ t: "code", v: m[1] });
      i += m[0].length;
      continue;
    }
    if ((m = rest.match(/^\*\*([^*\n]+?)\*\*/))) {
      flush();
      out.push({ t: "b", children: parseInline(m[1], ctx) });
      i += m[0].length;
      continue;
    }
    if (atBoundary && ((m = rest.match(/^\*([^*\s][^*\n]*?)\*(?!\*)/)) || (m = rest.match(/^_([^_\s][^_\n]*?)_(?![\p{L}\d])/u)))) {
      flush();
      out.push({ t: "i", children: parseInline(m[1], ctx) });
      i += m[0].length;
      continue;
    }
    if (!ctx.noLinks && rest[0] === "[" && (m = rest.match(/^\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/))) {
      flush();
      // The label can't hold another link: <a> inside <a> is invalid.
      out.push({ t: "link", href: m[2], children: parseInline(m[1], { ...ctx, noLinks: true }) });
      i += m[0].length;
      continue;
    }
    if (!ctx.noLinks && atBoundary && (m = rest.match(URL_RE))) {
      flush();
      out.push({ t: "link", href: m[0], children: [{ t: "text", v: m[0] }] });
      i += m[0].length;
      continue;
    }
    if (!ctx.noLinks && atBoundary && (m = rest.match(/^([A-Z][A-Z0-9]{1,9})-(\d+)(?![\p{L}\d])/u)) && keys.has(m[1])) {
      flush();
      out.push({ t: "issue", key: m[0] });
      i += m[0].length;
      continue;
    }
    if (rest[0] === "@" && atBoundary) {
      const name = names.find((n) => rest.slice(1, 1 + n.length) === n && !/[\p{L}\d]/u.test(rest[1 + n.length] || ""));
      if (name) {
        flush();
        out.push({ t: "mention", name });
        i += 1 + name.length;
        continue;
      }
    }
    buf += rest[0];
    i += 1;
  }
  flush();
  return out;
}

const isFence = (line) => /^\s*```/.test(line);
const ulItem = (line) => line.match(/^\s*[-*]\s+(.*)$/);
const olItem = (line) => line.match(/^\s*\d+[.)]\s+(.*)$/);
const quoteLine = (line) => line.match(/^\s*>\s?(.*)$/);
const startsBlock = (line) => isFence(line) || ulItem(line) || olItem(line) || quoteLine(line);

export function parseMarkdown(text, ctx = {}) {
  const lines = String(text || "").replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }
    if (isFence(line)) {
      const body = [];
      i += 1;
      while (i < lines.length && !isFence(lines[i])) body.push(lines[i++]);
      i += 1; // the closing fence (or the end)
      blocks.push({ type: "code", text: body.join("\n") });
      continue;
    }
    const listMatch = ulItem(line) ? ulItem : olItem(line) ? olItem : null;
    if (listMatch) {
      const items = [];
      while (i < lines.length && listMatch(lines[i])) items.push(parseInline(listMatch(lines[i++])[1], ctx));
      blocks.push({ type: listMatch === ulItem ? "ul" : "ol", items });
      continue;
    }
    if (quoteLine(line)) {
      const body = [];
      while (i < lines.length && quoteLine(lines[i])) body.push(quoteLine(lines[i++])[1]);
      blocks.push({ type: "quote", inlines: parseInline(body.join("\n"), ctx) });
      continue;
    }
    const body = [];
    while (i < lines.length && lines[i].trim() && !startsBlock(lines[i])) body.push(lines[i++]);
    blocks.push({ type: "p", inlines: parseInline(body.join("\n"), ctx) });
  }
  return blocks;
}
