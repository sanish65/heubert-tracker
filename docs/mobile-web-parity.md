# Web ↔ mobile parity

Every feature the team uses lives in both apps: the web app (`src/`) and the Expo app
(`mobile/`). This file is the running list of where each feature lives on each side and what
is still missing. The `sync-mobile-web` skill (`.claude/skills/sync-mobile-web/SKILL.md`)
updates it with every feature change.

Status: **in sync**, **gap** (one side lacks it; listed under Open gaps), or **web only** /
**mobile only** (on purpose, with the reason).

| Feature | Web | Mobile | Status |
|---|---|---|---|
| Sign-in (Google) | `src/app/login` | `app/login.js`, `lib/googleSignIn.js` | in sync |
| Dashboard | `components/Dashboard.js` | `app/(tabs)/index.js` | in sync |
| Late fines | `components/FineTable.js`, `AddFineModal.js` | `app/(tabs)/fines.js`, `components/AddFineModal.js` | in sync |
| Standup fines | `components/StandupFineTable.js` | `app/(tabs)/fines.js`, `components/AddStandupFineModal.js` | in sync |
| Leaves, leave settings | `components/LeavePage.js` | `app/(tabs)/leaves.js`, `app/leave-settings.js` | in sync |
| Attendance | `components/AttendancePage.js` | `app/(tabs)/attendance.js` | in sync |
| Withdrawals | fines pages | `app/withdrawals.js` | in sync |
| Employees / directory | `components/EmployeeList.js`, `EmployeeDetailPanel.js`, `lib/employeeDirectory.js` | `app/(tabs)/team.js`, `components/EmployeeDetailModal.js`, `lib/employeeDirectory.js` (mirror, `mobileEmployeeDirectory.test.mjs`) | in sync |
| Projects | `components/ProjectsPage.js` | `app/projects.js` | in sync |
| Planning poker | `/planning-poker/[sessionId]` | `app/planning-poker.js` (API `/api/poker`) | in sync |
| Retrospective | `/retrospective/[sessionId]` | `app/retrospective.js` (API `/api/retro`) | in sync |
| Meeting mode | `/meeting`, `components/MeetingShoutouts.js` | `app/meeting.js`, `components/ShoutoutsMeetingCard.js` | in sync |
| Words | `components/WordPage.js` | `app/words.js` | in sync |
| Events, public holidays | `components/EventsPage.js` | `app/events.js` | in sync (see note) |
| Memories | `components/MemoriesPage.js` | `app/memories.js` (API `/api/memories`) | in sync |
| Settings, theme, animations | `components/SettingsPage.js` | `app/settings.js` | in sync |
| Notifications (bell) | `components/TopBar.js`, `lib/notifications.js`, `useTaskNotifications` in `lib/useTasks.js` | `components/TopBar.js`, `lib/notifications.js` (mirror, `mobileNotifications.test.mjs`), `lib/useTaskNotifications.js`; assignments and @mentions also as push (`/api/task-notifications`), a tap opens the issue (`app/_layout.js`) | in sync |
| Daily standup form + shout-outs | `components/StandupFormPage.js`, `StandupShoutouts.js`, `lib/useShoutouts.js`, `lib/standupWindow.js`, `lib/standupProgress.js` | `app/standup.js`, `components/StandupShoutouts.js`, `ShoutoutParts.js`, `lib/useShoutouts.js`, `lib/standupWindow.js`, `lib/standupProgress.js`, `lib/standupShoutouts.js`, `lib/standupSave.js` (mirrors, `mobileStandup.test.mjs`) | in sync |
| Tasks: board, issues + JQL and saved filters, issue detail, create | `components/Tasks*.js`, `lib/useTasks.js`, `lib/task*.js` | `app/tasks.js`, `components/TaskBits.js`, `TaskIssueSheet.js`, `TaskCreateSheet.js`, `lib/useTasks.js`, `lib/task*.js` (mirrors, `mobileTaskMirrors.test.mjs`) | in sync; the rest under Open gaps |
| Tasks: board settings and workflow editor | `components/TaskBoardSettings.js`, `TaskWorkflowEditor.js` | — | web only: admin setup that needs the diagram canvas |
| Team calendar (Google) | `components/CalendarPage.js`, `lib/useTeamCalendar.js`, `lib/teamCalendar.js`, `/api/calendar` | `app/calendar.js`, `components/CalendarEventSheet.js`, `CalendarFindTime.js`, `lib/useTeamCalendar.js`, `lib/teamCalendar.js` (mirror, `mobileTeamCalendar.test.mjs`) | in sync (the week grid is a week strip and day agenda on the phone) |
| Emails (celebrations, fines, reminders) | `lib/emailTemplates.js`, API routes, crons | — | web only: sent by the server |
| What's new (changelog) | `components/ReleaseUpdatesModal.js` | — | web only: reads git history (empty when deployed) |
| OTA update banner | — | `components/UpdateBanner.js` | mobile only: Expo updates |

Notes:
- Events: the web list shows the latest date first (2026-10-22); mobile splits upcoming
  (soonest first) and past. Both are intended.
- Employees: mobile's Name A–Z keeps you first and people who resigned last; Joined date and
  Unpaid fines sort everyone, as on the web.
- Standup: mobile keeps a just-saved update in `lib/standupSave.js` until AppContext reloads,
  because the mobile AppContext has no standup write functions yet (the web's has
  `submitStandupResponse` / `updateStandupResponse`). Moving them there removes that.

## Open gaps

Largest first. Close one by building it with the skill, then move its row to "in sync".

1. **Tasks sprint planning on mobile**: create, edit, start and complete sprints (RPCs
   `start_task_sprint`, `complete_task_sprint`; web `components/TaskSprintModals.js`). Mobile
   shows sprints and says these happen on the web.
2. **Tasks releases and reports on mobile**: `task_versions` with release and move-open-issues
   (web `TaskReleasesView.js`), burndown, velocity and flow (web `TaskReportsView.js`).
3. **Tasks extras on mobile**: attachments (needs a document-picker native module, so a new
   build, not an update), watchers, issue links, @mention suggestions, activity history, clone,
   bulk edit, Markdown in descriptions, and the unfiled first-board tasks.
