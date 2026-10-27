# Web ↔ mobile parity

Every feature the team uses lives in both apps: the web app (`src/`) and the Expo app
(`mobile/`). This file is the running list of where each feature lives on each side and what
is still missing. The `sync-mobile-web` skill (`.claude/skills/sync-mobile-web/SKILL.md`)
updates it with every feature change.

Status: **in sync**, **gap** (one side lacks it; listed under Open gaps), or **web only** /
**mobile only** (on purpose, with the reason).

| Feature | Web | Mobile | Status |
|---|---|---|---|
| Sign-in (Google), with the "What's inside" feature list | `src/app/login` | `app/login.js`, `lib/googleSignIn.js` | in sync (web shows the list in two columns, the phone in one) |
| Dashboard | `components/Dashboard.js` | `app/(tabs)/index.js` | in sync (the fines chart's paid/unpaid hover tip is web-only: no hover on a phone) |
| Late fines | `components/FineTable.js`, `AddFineModal.js` | `app/(tabs)/fines.js`, `components/AddFineModal.js` | in sync |
| Standup fines | `components/StandupFineTable.js` | `app/(tabs)/fines.js`, `components/AddStandupFineModal.js` | in sync |
| Leaves, leave settings | `components/LeavePage.js` | `app/(tabs)/leaves.js`, `app/leave-settings.js` | in sync (company events show on the month calendar: a violet bar on the web, a violet dot, day detail and strip on the phone) |
| Attendance | `components/AttendancePage.js` | `app/(tabs)/attendance.js` | in sync |
| Withdrawals | fines pages | `app/withdrawals.js` | in sync |
| Employees / directory | `components/EmployeeList.js`, `EmployeeDetailPanel.js`, `lib/employeeDirectory.js` | `app/(tabs)/team.js`, `components/EmployeeDetailModal.js`, `lib/employeeDirectory.js` (mirror, `mobileEmployeeDirectory.test.mjs`) | in sync (the web list's Leave left total counts only types with `counts_in_leave_left`, set per type in Leave settings on both apps; the phone list shows no total) |
| Projects | `components/ProjectsPage.js` | `app/projects.js` | in sync |
| Planning poker | `/planning-poker/[sessionId]` | `app/planning-poker.js` (API `/api/poker`) | in sync |
| Retrospective | `/retrospective/[sessionId]` | `app/retrospective.js` (API `/api/retro`) | in sync |
| Meeting mode (incl. Tracker / HeuBot source pill from `standup_responses.source`) | `/meeting`, `components/MeetingShoutouts.js` | `app/meeting.js`, `components/ShoutoutsMeetingCard.js` | in sync (bulleted answers, * - • or 1., show as lists on both; Enter carrying a bullet on is web only: a phone's multi-line text box doesn't reliably report Enter) |
| Words | `components/WordPage.js` | `app/words.js` | in sync |
| Events, public holidays | `components/EventsPage.js` | `app/events.js` | in sync (see note) |
| Memories | `components/MemoriesPage.js` | `app/memories.js` (API `/api/memories`) | in sync |
| Settings, theme, animations | `components/SettingsPage.js` | `app/settings.js` | in sync |
| Notifications (bell), standup reminders | `components/TopBar.js`, `lib/notifications.js`, `useTaskNotifications` in `lib/useTasks.js`, `lib/useStandupReminders.js`, `lib/notifyAlerts.js` (chime and desktop notifications), `components/NotificationPrefs.js` | `components/TopBar.js`, `lib/notifications.js` (mirror, `mobileNotifications.test.mjs`), `lib/useTaskNotifications.js`, `lib/useStandupReminders.js`; assignments and @mentions also as push (`/api/task-notifications`, with the phone's sound), a tap opens the issue (`app/_layout.js`) | gap: the standup reminders (17:00 the day before, 09:00 on the day) show in both bells, but the in-app chime is web only (see Open gaps) |
| Daily standup form + shout-outs | `components/StandupFormPage.js`, `StandupShoutouts.js`, `lib/useShoutouts.js`, `lib/standupJira.js` (Jira tickets via `api/standup-jira`), `lib/standupWindow.js`, `lib/standupProgress.js` | `app/standup.js`, `components/StandupShoutouts.js`, `ShoutoutParts.js`, `lib/useShoutouts.js`, `lib/standupWindow.js`, `lib/standupProgress.js`, `lib/standupShoutouts.js`, `lib/standupSave.js` (incl. `fetchStandupTickets`) (mirrors, `mobileStandup.test.mjs`) | in sync |
| Tasks: board, issues + JQL and saved filters, assignee avatar filter, issue detail, create (with a linked issue), move to another project (old keys redirect) | `components/Tasks*.js`, `lib/useTasks.js`, `lib/task*.js` | `app/tasks.js`, `components/TaskBits.js`, `TaskIssueSheet.js`, `TaskCreateSheet.js`, `lib/useTasks.js`, `lib/task*.js` (mirrors, `mobileTaskMirrors.test.mjs`) | in sync (the assignee avatars fold into "+N" on the web and scroll sideways on the phone); the rest under Open gaps |
| Tasks: board settings and workflow editor | `components/TaskBoardSettings.js`, `TaskWorkflowEditor.js` | — | web only: admin setup that needs the diagram canvas |
| Team calendar (Google) | `components/CalendarPage.js`, `lib/useTeamCalendar.js`, `lib/teamCalendar.js`, `/api/calendar` | `app/calendar.js`, `components/CalendarEventSheet.js`, `CalendarFindTime.js`, `lib/useTeamCalendar.js`, `lib/teamCalendar.js` (mirror, `mobileTeamCalendar.test.mjs`) | in sync (the week grid is a week strip and day agenda on the phone; company events show as a violet band on the day and under the date in the week, a violet dot in the phone's strip) |
| Emails (celebrations, fines, reminders) | `lib/emailTemplates.js`, API routes, crons | — | web only: sent by the server |
| What's new (features tour + release notes) | `components/ReleaseUpdatesModal.js`, `api/whats-new` (content from `whats-new/`, captured by `npm run whats-new:shots`) | `app/whats-new.js` (More → App) | in sync |
| OTA update banner | — | `components/UpdateBanner.js` | mobile only: Expo updates |

Notes:
- Events: the web list shows the latest date first (2026-10-22); mobile splits upcoming
  (soonest first) and past. Both are intended.
- Employees: mobile's Name A–Z keeps you first and people who resigned last; Joined date and
  Unpaid fines sort everyone, as on the web.
- Team calendar: without domain-wide delegation, `/api/calendar` reads calendars shared
  with the service account (busy blocks for free/busy sharing); both apps show the same
  "Showing calendars shared with the tracker" notice and "not shared" row status.
- Standup: mobile keeps a just-saved update in `lib/standupSave.js` until AppContext reloads,
  because the mobile AppContext has no standup write functions yet (the web's has
  `submitStandupResponse` / `updateStandupResponse`). Moving them there removes that.

## Open gaps

Largest first. Close one by building it with the skill, then move its row to "in sync".

1. **Standup reminders with sound on the phone**: the app's bell lists them, but nothing rings.
   Scheduling them as local notifications with `expo-notifications` (already installed) at
   17:00 and 09:00, cancelled once the standup is in, would ring even with the app closed. The
   web plays a chime (`lib/notifyAlerts.js`), which the app has no audio package for.
2. **Tasks sprint planning on mobile**: create, edit, start and complete sprints (RPCs
   `start_task_sprint`, `complete_task_sprint`; web `components/TaskSprintModals.js`). Mobile
   shows sprints and says these happen on the web.
3. **Tasks releases and reports on mobile**: `task_versions` with release and move-open-issues
   (web `TaskReleasesView.js`), burndown, velocity and flow (web `TaskReportsView.js`).
4. **Tasks extras on mobile**: attachments (needs a document-picker native module, so a new
   build, not an update), watchers, issue links, @mention suggestions, activity history, clone,
   bulk edit, Markdown in descriptions, and the unfiled first-board tasks.
