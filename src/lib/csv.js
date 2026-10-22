// Rows -> CSV text (RFC 4180): fields with commas, quotes or line breaks are quoted, and
// a field starting with = + - or @ gets a leading apostrophe so a spreadsheet opening
// the export never runs it as a formula. Pure, no imports.

function cell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header, rows) {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}
