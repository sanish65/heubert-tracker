function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function buildWorkingDates(startStr, endStr) {
  const dates = [];
  let d = new Date(startStr + "T00:00:00");
  const end = new Date(endStr + "T00:00:00");
  while (d <= end) {
    const dow = d.getDay();
    const ds = toDateStr(d);
    if (dow !== 0 && dow !== 6) {
      dates.push(ds);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

console.log(buildWorkingDates("2026-06-19", "2026-06-26"));

function parseDate(str) {
  const [y, m, d] = str.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function buildWorkingDatesFix(startStr, endStr) {
  const dates = [];
  let d = parseDate(startStr);
  const end = parseDate(endStr);
  while (d <= end) {
    const dow = d.getDay();
    const ds = toDateStr(d);
    if (dow !== 0 && dow !== 6) {
      dates.push(ds);
    }
    d.setDate(d.getDate() + 1);
  }
  return dates;
}

console.log(buildWorkingDatesFix("2026-06-19", "2026-06-26"));
