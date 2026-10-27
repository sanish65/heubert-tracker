// The counting behind the Daily standup screen: how far your form is, who on the team is in for a
// day, and your last few working days. Mirrors src/lib/standupProgress.js because the app cannot
// import from src/; src/lib/mobileStandup.test.mjs holds the two equal. Pure (only the sibling
// standupWindow.js).
import { findSubmissionFor, isStandupWorkingDay } from "./standupWindow.js";
import { plainFirstLine } from "./standupText.js";

// A stored answer is keyed `question_<id>`; older rows used the id or the question text.
export function answerFor(answers, question) {
  const a = answers || {};
  return a[`question_${question.id}`] || a[question.id] || a[question.question] || "";
}

// → { answered, total, pct } for the form's current answers, keyed by question id.
export function answeredProgress(questions, answers) {
  const total = (questions || []).length;
  const answered = (questions || []).filter((q) => String(answers?.[q.id] || "").trim()).length;
  return { answered, total, pct: total ? Math.round((answered / total) * 100) : 0 };
}

const firstNameOf = (name) => (name || "").trim().split(/\s+/)[0].toLowerCase();

// The same rule as the meeting page's missing list: by email first, then by first name.
function matchesEmployee(submission, emp) {
  const email = submission.email?.trim().toLowerCase();
  const work = emp.work_email?.trim().toLowerCase();
  const personal = emp.personal_email?.trim().toLowerCase();
  if (email && (email === work || email === personal)) return true;
  const first = firstNameOf(submission.name);
  return !!first && first === firstNameOf(emp.name);
}

// Who is expected to submit (as MeetingPage: active or no status, not standup-excluded)
// and who of them is in for `dateStr`.
// → { expected, inCount, submitted: employee[], waiting: employee[] }
export function teamProgress(employees, submissions, dateStr) {
  const expectedList = (employees || []).filter((e) => (!e.status || e.status === "active") && !e.standup_excluded);
  const forDay = (submissions || []).filter((s) => s.date === dateStr);
  const submitted = [];
  const waiting = [];
  for (const emp of expectedList) {
    (forDay.some((s) => matchesEmployee(s, emp)) ? submitted : waiting).push(emp);
  }
  return { expected: expectedList.length, inCount: submitted.length, submitted, waiting };
}

// "Waiting on Nikhil, Nebula and 9 more".
export function waitingLabel(names) {
  const list = names || [];
  if (list.length === 0) return "Everyone's in";
  if (list.length === 1) return `Waiting on ${list[0]}`;
  if (list.length === 2) return `Waiting on ${list[0]} and ${list[1]}`;
  return `Waiting on ${list[0]}, ${list[1]} and ${list.length - 2} more`;
}

// The first line of an answer, whitespace collapsed, cut to `max` characters.
export function shortNote(text, max = 48) {
  // A bulleted answer reads by its first item, without the "*".
  const line = plainFirstLine(text).replace(/\s+/g, " ").trim();
  return line.length > max ? `${line.slice(0, max - 1).trimEnd()}…` : line;
}

function previousDay(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

const ymd = (value) => String(value || "").slice(0, 10);

// A full-day leave of `name` on `dateStr`. Rows are matched as the Meeting page's
// "On leave" list matches them: by employee_name, by the `dates` list when the row has
// one, else by start_date..end_date. Half-day and early leave still expect a standup
// (nothing in the app excuses them; the meeting's missing list excuses no leave at all),
// so only full days count; a row with no type is a full day, as in teamCalendar.leaveOn.
export function onFullDayLeave(leaves, name, dateStr) {
  if (!name) return false;
  return (leaves || []).some((l) => {
    if (l.employee_name !== name) return false;
    if (l.type === "half" || l.type === "early") return false;
    if (Array.isArray(l.dates)) return l.dates.some((d) => ymd(d) === dateStr);
    return ymd(l.start_date) <= dateStr && dateStr <= ymd(l.end_date || l.start_date);
  });
}

// Your last `count` working days before `before` (the selected standup day), newest
// first: "submitted" when your row is there, "leave" for a day you were on full-day
// leave, "missed" for any other past day without one, and "pending" for today without
// one (today is still open, so it is not missed). Days after `today`, and days before
// your joined_date, are left out. The note is the start of your first answer.
// → [{ date, status, note }]
export function recentStandups(submissions, { before, today, holidayDates, employee, user, firstQuestion, leaves, count = 5 }) {
  const rows = [];
  const joined = ymd(employee?.joined_date);
  let day = before;
  // Bounded walk: a year back covers any run of holidays.
  for (let i = 0; i < 366 && rows.length < count; i += 1) {
    day = previousDay(day);
    if (joined && day < joined) break;
    if (day > today || !isStandupWorkingDay(day, holidayDates)) continue;
    const mine = findSubmissionFor(submissions, day, employee, user);
    if (mine) {
      rows.push({ date: day, status: "submitted", note: firstQuestion ? shortNote(answerFor(mine.answers, firstQuestion)) : "" });
    } else if (day === today) {
      rows.push({ date: day, status: "pending", note: "" });
    } else {
      rows.push({ date: day, status: onFullDayLeave(leaves, employee?.name, day) ? "leave" : "missed", note: "" });
    }
  }
  return rows;
}
