// The sidebar's sections, who sees them, and how a saved tab maps onto them.
// Pure, no imports, so it runs under `npm test`. Icon names are Icon.js names.

export const NAV_GROUPS = [
  { id: "overview", label: "Overview", items: [{ id: "dashboard", label: "Dashboard", icon: "dashboard" }] },
  {
    id: "records",
    label: "Records",
    items: [
      { id: "records", label: "Late Fines", icon: "wallet" },
      { id: "standup", label: "Standup Fines", icon: "clipboard" },
      { id: "leaves", label: "Leaves", icon: "calendar" },
      { id: "attendance", label: "Attendance", icon: "pin" },
    ],
  },
  {
    id: "team",
    label: "Team",
    items: [
      { id: "tasks", label: "Tasks", icon: "kanban" },
      { id: "calendar", label: "Calendar", icon: "clock" },
      { id: "poker", label: "Planning Poker", icon: "layers" },
      { id: "retro", label: "Retrospective", icon: "refresh" },
      { id: "words", label: "Words", icon: "book" },
      { id: "events", label: "Events", icon: "flag" },
    ],
  },
  {
    id: "admin",
    label: "Admin",
    items: [
      { id: "employees", label: "Employees", icon: "users" },
      { id: "projects", label: "Projects", icon: "folder", adminOnly: true },
      { id: "settings", label: "Settings", icon: "sliders", adminOnly: true },
    ],
  },
];

// Tabs opened another way: the standup form (floating button), Memories (sidebar foot),
// and Capacity (no entry today, kept so an old saved tab still opens).
const EXTRA_TABS = ["standup-form", "memories", "capacity"];

// The two admin settings tabs became one Settings section.
const RENAMED = { "leave-settings": "settings", "privilege-settings": "settings" };

const ADMIN_ONLY = NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.adminOnly).map((i) => i.id);

export const TAB_IDS = [...NAV_GROUPS.flatMap((g) => g.items.map((i) => i.id)), ...EXTRA_TABS];

export function navGroupsFor({ isAdmin = false } = {}) {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => isAdmin || !i.adminOnly) })).filter(
    (g) => g.items.length > 0
  );
}

export function normalizeTab(saved) {
  const tab = RENAMED[saved] || saved;
  return TAB_IDS.includes(tab) ? tab : "dashboard";
}

export function allowedTab(tab, { isAdmin = false } = {}) {
  return ADMIN_ONLY.includes(tab) && !isAdmin ? "dashboard" : tab;
}
