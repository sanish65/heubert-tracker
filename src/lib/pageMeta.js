// The page heading for each tab: eyebrow, title and subtitle.
// Pure, no imports, so it runs under `npm test`.

export const PAGE_META = {
  dashboard: { title: "Dashboard", subtitle: "Here's how the team is doing today." },
  records: { title: "Late fines", subtitle: "Late arrivals, fine seasons and the fine jar." },
  standup: { title: "Standup fines", subtitle: "Missed standup forms and their contributions." },
  "standup-form": { title: "Today's standup", subtitle: "What you did, what's next and what's in your way." },
  leaves: { title: "Leaves", subtitle: "Leave calendar, balances and public holidays." },
  attendance: { title: "Attendance", subtitle: "Check in, check out and monthly sheets." },
  tasks: { title: "Tasks", subtitle: "Plan, assign and track the team's work across projects." },
  calendar: { title: "Team calendar", subtitle: "Everyone's meetings from Google Calendar, with leaves and holidays from the tracker." },
  poker: { title: "Planning poker", subtitle: "Estimate stories together." },
  retro: { title: "Retrospective", subtitle: "Look back on the sprint together." },
  words: { title: "Word of the day", subtitle: "One new word for the team, every day." },
  events: { title: "Events", subtitle: "Company events for the whole team." },
  employees: { title: "Employees", subtitle: "Everyone on the team." },
  projects: { title: "Projects", subtitle: "Clients, environments, links and who is on each." },
  settings: { title: "Settings", subtitle: "Roles, list visibility, leave types and preferences." },
  memories: { title: "Memories", subtitle: "Photos, videos and moments from the team." },
  capacity: { title: "Capacity", subtitle: "Team capacity across projects." },
};

export function greetingFor(hour) {
  if (hour >= 5 && hour <= 11) return "Good morning";
  if (hour >= 12 && hour <= 16) return "Good afternoon";
  return "Good evening";
}

export function pageMetaFor(tabId, { firstName = "", hour, groupLabel } = {}) {
  const id = Object.hasOwn(PAGE_META, tabId) ? tabId : "dashboard";
  const { title, subtitle } = PAGE_META[id];
  const eyebrow = groupLabel || "";
  if (id !== "dashboard") return { eyebrow, title, subtitle };
  const greeting = greetingFor(hour);
  return { eyebrow, title: firstName ? `${greeting}, ${firstName}` : greeting, subtitle };
}
