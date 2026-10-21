// What the top bar's search finds: people and fine rows from the data AppContext already
// holds, and what to ask the tasks table for (TopBar runs that one small query). Pure:
// only a relative import, so it runs under `npm test`.

import { parseIssueKey } from "./taskBoard.js";

// Characters a PostgREST like pattern reads as wildcards or escapes (it takes * for %).
const PATTERN_CHARS = /[%_\\*]/g;

export function normalizeQuery(text) {
  return String(text ?? "").trim().toLowerCase();
}

// 0 when a word of the name starts with the query, 1 when the name only contains it,
// -1 when it does not match. `q` is already normalised.
function nameTier(name, q) {
  const lower = String(name ?? "").toLowerCase();
  if (lower.startsWith(q) || lower.includes(` ${q}`)) return 0;
  return lower.includes(q) ? 1 : -1;
}

function emailMatches(employee, q) {
  return [employee.work_email, employee.personal_email].some((email) => String(email ?? "").toLowerCase().includes(q));
}

// Current people before resigned ones, then the better match, then by name.
function byRank(a, b) {
  return Number(a.resigned) - Number(b.resigned) || a.tier - b.tier || a.name.localeCompare(b.name);
}

export function matchPeople(employees, query, limit = 5) {
  const q = normalizeQuery(query);
  if (!q) return [];
  const ranked = [];
  for (const employee of employees || []) {
    let tier = nameTier(employee.name, q);
    if (tier < 0 && emailMatches(employee, q)) tier = 2;
    if (tier < 0) continue;
    ranked.push({ employee, tier, resigned: employee.status === "resigned", name: String(employee.name ?? "") });
  }
  return ranked.sort(byRank).slice(0, limit).map((r) => r.employee);
}

// One row per person and list (late, standup) with at least one fine there. The fine
// tables hide people excluded from them, so these rows do too.
export function matchFineRows({ fines, standupFines, employees, query, limit = 4 } = {}) {
  const q = normalizeQuery(query);
  if (!q) return [];
  const employeeByName = new Map((employees || []).map((e) => [e.name, e]));
  const tierByName = new Map();
  const people = new Map();

  const tally = (kind, fine) => {
    const name = fine.employee_name;
    if (!name) return;
    if (!tierByName.has(name)) tierByName.set(name, nameTier(name, q));
    const tier = tierByName.get(name);
    if (tier < 0) return;
    const employee = employeeByName.get(name);
    if (kind === "late" ? employee?.late_fine_excluded : employee?.standup_fine_excluded) return;
    let person = people.get(name);
    if (!person) {
      person = { name, tier, resigned: employee?.status === "resigned", late: null, standup: null };
      people.set(name, person);
    }
    const row = person[kind] || (person[kind] = { kind, name, count: 0, unpaidCount: 0, unpaidAmount: 0 });
    row.count += 1;
    if (fine.status === "unpaid") {
      row.unpaidCount += 1;
      if (kind === "late") row.unpaidAmount += Number(fine.amount) || 0;
    }
  };

  for (const fine of fines || []) tally("late", fine);
  for (const fine of standupFines || []) tally("standup", fine);

  return [...people.values()]
    .sort(byRank)
    .flatMap((person) => [person.late, person.standup].filter(Boolean))
    .slice(0, limit);
}

// An issue key ("htt-12") is looked up by key and number; anything else searches titles
// once at least two characters are left without the pattern characters.
export function taskQuery(text) {
  const key = parseIssueKey(text);
  if (key) return key;
  const title = String(text ?? "").replace(PATTERN_CHARS, "").trim();
  return title.length >= 2 ? { title } : null;
}
