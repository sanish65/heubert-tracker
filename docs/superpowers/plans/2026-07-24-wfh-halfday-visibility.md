# WFH & Half-Day Leave Visibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface leave category (including "Work From Home") and half-day segment (First Half / Second Half) clearly in the Leaves tab and the Meeting page's "On Leave Today" list, on both web and mobile.

**Architecture:** Add two small pure-function helpers (`parseHalfDaySegment`, `stripHalfDaySegmentPrefix`) to each platform's `lib/utils.js`, then update four display components to use them plus a `leaveTypeById` lookup that already exists (or is trivially added) on each page. No schema change, no change to balance math, no change to any Add/Edit/Quick-add form.

**Tech Stack:** Next.js (App Router, plain JS, client components) for web in `src/`; Expo/React Native (plain JS) for mobile in `mobile/`. No test framework is configured in either package (`package.json` has no `jest`/`vitest`/testing-library) — verification is via a throwaway `node -e` sanity check for the pure functions and manual walkthroughs for UI, per the project's existing convention (see "Testing" in the spec).

## Global Constraints

- Display-only change: do not modify `AddLeaveModal.js`, `EditLeaveModal.js`, `QuickAddLeaveModal` (inside `MeetingPage.js`), `computeLeaveBalances`, `leaveDayCount`, or any `.sql` schema file.
- Half-day segment stays encoded as the existing `[First Half]` / `[Second Half]` prefix inside `leaves.reason` — no new DB column.
- Segment icons/labels: `first` → `🌅 First Half`, `second` → `🌇 Second Half` (matches the icons already used in `AddLeaveModal.js` / `QuickAddLeaveModal`).
- Follow the existing per-file local-constant convention for `TYPE_ICONS`/`TYPE_LABELS`/`SEGMENT_ICONS`/`SEGMENT_LABELS` — do not centralize these into a shared constants file (only the parsing *logic* is shared, via `lib/utils.js`).
- Web changes go in `src/components/*.js` and `src/lib/utils.js`; mobile changes go in the matching files under `mobile/`. Keep the two platforms' logic in sync but as separate edits (the codebase has no shared package between them).

---

### Task 1: Shared half-day segment helpers (web)

**Files:**
- Modify: `src/lib/utils.js` (append after `computeLeaveBalances`, currently the last export in the file)

**Interfaces:**
- Produces: `parseHalfDaySegment(leave: {type: string, reason: string|null}) => "first" | "second" | null`
- Produces: `stripHalfDaySegmentPrefix(reason: string|null|undefined) => string`

- [ ] **Step 1: Append the two helper functions to `src/lib/utils.js`**

Add this to the end of the file, after the closing brace of `computeLeaveBalances`:

```js

const HALF_DAY_SEGMENT_PREFIXES = { first: "[First Half]", second: "[Second Half]" };

/**
 * Which half of the day a half-day leave falls in, parsed from the bracketed
 * prefix convention stored in `reason` (e.g. "[First Half] dentist"). Returns
 * null for full-day/early leaves, or half-day leaves with no recognized prefix.
 */
export function parseHalfDaySegment(leave) {
  if (!leave || leave.type !== "half") return null;
  const reason = leave.reason || "";
  if (reason.startsWith(HALF_DAY_SEGMENT_PREFIXES.first)) return "first";
  if (reason.startsWith(HALF_DAY_SEGMENT_PREFIXES.second)) return "second";
  return null;
}

/**
 * Reason text with the half-day segment prefix (if any) removed, for clean display.
 */
export function stripHalfDaySegmentPrefix(reason) {
  if (!reason) return "";
  if (reason.startsWith(HALF_DAY_SEGMENT_PREFIXES.first)) {
    return reason.replace(HALF_DAY_SEGMENT_PREFIXES.first, "").trim();
  }
  if (reason.startsWith(HALF_DAY_SEGMENT_PREFIXES.second)) {
    return reason.replace(HALF_DAY_SEGMENT_PREFIXES.second, "").trim();
  }
  return reason;
}
```

- [ ] **Step 2: Sanity-check the helpers with a throwaway Node script**

`src/lib/utils.js` uses `export function`/`export const` (ESM syntax) with no build step available to plain `node`, so `require()`/`import` of the real file won't work from a bare `node -e` invocation. Instead, paste the exact same function bodies inline to check the logic before/after adding them to the file:

```bash
node -e '
const HALF_DAY_SEGMENT_PREFIXES = { first: "[First Half]", second: "[Second Half]" };
function parseHalfDaySegment(leave) {
  if (!leave || leave.type !== "half") return null;
  const reason = leave.reason || "";
  if (reason.startsWith(HALF_DAY_SEGMENT_PREFIXES.first)) return "first";
  if (reason.startsWith(HALF_DAY_SEGMENT_PREFIXES.second)) return "second";
  return null;
}
function stripHalfDaySegmentPrefix(reason) {
  if (!reason) return "";
  if (reason.startsWith(HALF_DAY_SEGMENT_PREFIXES.first)) {
    return reason.replace(HALF_DAY_SEGMENT_PREFIXES.first, "").trim();
  }
  if (reason.startsWith(HALF_DAY_SEGMENT_PREFIXES.second)) {
    return reason.replace(HALF_DAY_SEGMENT_PREFIXES.second, "").trim();
  }
  return reason;
}
console.assert(parseHalfDaySegment({ type: "half", reason: "[First Half] dentist" }) === "first", "first failed");
console.assert(parseHalfDaySegment({ type: "half", reason: "[Second Half]" }) === "second", "second failed");
console.assert(parseHalfDaySegment({ type: "half", reason: "no prefix" }) === null, "no-prefix failed");
console.assert(parseHalfDaySegment({ type: "full", reason: "[First Half]" }) === null, "full-type failed");
console.assert(stripHalfDaySegmentPrefix("[First Half] dentist") === "dentist", "strip-first failed");
console.assert(stripHalfDaySegmentPrefix("[Second Half]") === "", "strip-second failed");
console.assert(stripHalfDaySegmentPrefix(null) === "", "strip-null failed");
console.log("OK");
'
```

Expected output: `OK` (with no `console.assert` failure lines printed above it). This has been run and verified to print `OK` during planning.

- [ ] **Step 3: Commit**

```bash
git add src/lib/utils.js
git commit -m "feat: add half-day segment parsing helpers"
```

---

### Task 2: Shared half-day segment helpers (mobile)

**Files:**
- Modify: `mobile/lib/utils.js` (append after `computeLeaveBalances`, currently the last export in the file — identical structure to the web copy)

**Interfaces:**
- Produces: same two functions as Task 1, `parseHalfDaySegment` and `stripHalfDaySegmentPrefix`, identical signatures and behavior.

- [ ] **Step 1: Append the identical two helper functions to `mobile/lib/utils.js`**

Use the exact same code block as Task 1 Step 1.

- [ ] **Step 2: Sanity-check with the same throwaway Node script from Task 1 Step 2**

Run the exact same inline `node -e '...'` script as Task 1 Step 2 (the logic is identical between the web and mobile copies). Expected output: `OK`.

- [ ] **Step 3: Commit**

```bash
git add mobile/lib/utils.js
git commit -m "feat: add half-day segment parsing helpers (mobile)"
```

---

### Task 3: Leaves tab — web (`LeavePage.js`)

**Files:**
- Modify: `src/components/LeavePage.js:1-11` (imports and constants), `src/components/LeavePage.js:260-301` (leave card rendering)

**Interfaces:**
- Consumes: `parseHalfDaySegment(leave)` and `stripHalfDaySegmentPrefix(reason)` from Task 1 (`@/lib/utils`).

- [ ] **Step 1: Import the new helpers and add segment constants**

In `src/components/LeavePage.js`, change line 5 from:
```js
import { computeLeaveBalances } from "@/lib/utils";
```
to:
```js
import { computeLeaveBalances, parseHalfDaySegment, stripHalfDaySegmentPrefix } from "@/lib/utils";
```

Then, immediately after the existing `TYPE_ICONS` constant (currently line 10), add:
```js
const SEGMENT_LABELS = { first: "First Half", second: "Second Half" };
const SEGMENT_ICONS = { first: "🌅", second: "🌇" };
```

- [ ] **Step 2: Add the segment badge and strip the reason prefix in the leave card**

Find this block (currently around lines 260-265):
```jsx
                          <span className={`leave-type-badge leave-type-${leave.type}`}>
                            {TYPE_ICONS[leave.type]} {TYPE_LABELS[leave.type]}
                          </span>
                          <span className="leave-type-badge">
                            {leaveTypeById.get(leave.leave_type_id)?.name || "Uncategorized"}
                          </span>
```
Replace it with:
```jsx
                          <span className={`leave-type-badge leave-type-${leave.type}`}>
                            {TYPE_ICONS[leave.type]} {TYPE_LABELS[leave.type]}
                          </span>
                          <span className="leave-type-badge">
                            {leaveTypeById.get(leave.leave_type_id)?.name || "Uncategorized"}
                          </span>
                          {parseHalfDaySegment(leave) && (
                            <span className="leave-type-badge leave-segment-badge">
                              {SEGMENT_ICONS[parseHalfDaySegment(leave)]} {SEGMENT_LABELS[parseHalfDaySegment(leave)]}
                            </span>
                          )}
```

Then find the reason block (currently around lines 297-301):
```jsx
                      {leave.reason && (
                        <div className="leave-card-reason">
                          💬 {leave.reason}
                        </div>
                      )}
```
Replace it with:
```jsx
                      {stripHalfDaySegmentPrefix(leave.reason) && (
                        <div className="leave-card-reason">
                          💬 {stripHalfDaySegmentPrefix(leave.reason)}
                        </div>
                      )}
```

- [ ] **Step 3: Verify with lint**

Run: `npm run lint`
Expected: no new errors/warnings referencing `LeavePage.js`.

- [ ] **Step 4: Manual verification**

Run `npm run dev`, sign in as an employee/admin, go to the Leaves tab, and open a half-day leave record that has `[First Half]` or `[Second Half]` in its reason (create one via "Record Leave" with category "Work From Home", duration "Half Day", segment "First Half", and a reason like "dentist" if none exists yet). Confirm the card shows three badges (duration, category "Work From Home", segment "🌅 First Half") and the reason text shown is `💬 dentist` with no bracket text.

- [ ] **Step 5: Commit**

```bash
git add src/components/LeavePage.js
git commit -m "feat: show half-day segment badge on Leaves tab"
```

---

### Task 4: Leaves tab — mobile (`mobile/app/(tabs)/leaves.js`)

**Files:**
- Modify: `mobile/app/(tabs)/leaves.js:1-17` (imports and constants), `mobile/app/(tabs)/leaves.js:208-236` (leave card rendering)

**Interfaces:**
- Consumes: `parseHalfDaySegment(leave)` and `stripHalfDaySegmentPrefix(reason)` from Task 2 (`../../lib/utils`).

- [ ] **Step 1: Import the new helpers and add segment constants**

Change:
```js
import { computeLeaveBalances } from "../../lib/utils";
```
to:
```js
import { computeLeaveBalances, parseHalfDaySegment, stripHalfDaySegmentPrefix } from "../../lib/utils";
```

Add after the existing `TYPE_COLORS` constant:
```js
const SEGMENT_LABELS = { first: "First Half", second: "Second Half" };
const SEGMENT_ICONS = { first: "🌅", second: "🌇" };
```

- [ ] **Step 2: Append the segment to the summary line and strip the reason prefix**

Find:
```jsx
                    <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>
                      {TYPE_ICONS[leave.type]} {TYPE_LABELS[leave.type]} · {leaveTypeById.get(leave.leave_type_id)?.name || "Uncategorized"}
                    </Text>
```
Replace with:
```jsx
                    <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 2 }}>
                      {TYPE_ICONS[leave.type]} {TYPE_LABELS[leave.type]} · {leaveTypeById.get(leave.leave_type_id)?.name || "Uncategorized"}
                      {parseHalfDaySegment(leave) ? ` · ${SEGMENT_ICONS[parseHalfDaySegment(leave)]} ${SEGMENT_LABELS[parseHalfDaySegment(leave)]}` : ""}
                    </Text>
```

Find:
```jsx
                {leave.reason ? <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 6 }}>💬 {leave.reason}</Text> : null}
```
Replace with:
```jsx
                {stripHalfDaySegmentPrefix(leave.reason) ? <Text style={{ color: t.textMuted, fontSize: 12, marginTop: 6 }}>💬 {stripHalfDaySegmentPrefix(leave.reason)}</Text> : null}
```

- [ ] **Step 3: Manual verification**

Run `npm run web` (or `npx expo start` and open the web/iOS/Android target) from `mobile/`, go to the Leaves tab, and confirm the same half-day WFH leave from Task 3 shows "🌗 Half Day · Work From Home · 🌅 First Half" and a clean reason line.

- [ ] **Step 4: Commit**

```bash
git add "mobile/app/(tabs)/leaves.js"
git commit -m "feat: show half-day segment on mobile Leaves tab"
```

---

### Task 5: Meeting page — web (`MeetingPage.js`)

**Files:**
- Modify: `src/components/MeetingPage.js:13` (import), `src/components/MeetingPage.js` (add constants near top of file, add `leaveTypeById` memo near `activeLeaves` at line 226), `src/components/MeetingPage.js:448-469` (render section)

**Interfaces:**
- Consumes: `parseHalfDaySegment(leave)` from Task 1 (`@/lib/utils`); `leaveTypes` (already destructured from `useApp()` in this component).
- Produces: `leaveTypeById: Map<number, {id, name, ...}>` — a local variable inside `MeetingPage`, used only in this task's render section.

- [ ] **Step 1: Import the new helper and add module-level constants**

Change line 13 from:
```js
import { computeLeaveBalances } from "@/lib/utils";
```
to:
```js
import { computeLeaveBalances, parseHalfDaySegment } from "@/lib/utils";
```

Immediately after that import line, add:
```js

const MEETING_TYPE_LABELS = { full: "Full Day", half: "Half Day", early: "Early Leave" };
const MEETING_TYPE_ICONS = { full: "📅", half: "🌗", early: "🚪" };
const MEETING_SEGMENT_LABELS = { first: "First Half", second: "Second Half" };
const MEETING_SEGMENT_ICONS = { first: "🌅", second: "🌇" };
```
(Prefixed `MEETING_` to avoid colliding with any other module-level constant already in this large file — check with `grep -n "^const TYPE_" src/components/MeetingPage.js` first; if no collision exists, the prefix is still fine to keep as a signal these are meeting-page-local.)

- [ ] **Step 2: Add a `leaveTypeById` lookup next to `activeLeaves`**

Find the `activeLeaves` memo (currently around line 226):
```js
  const activeLeaves = useMemo(() => {
    const d = new Date();
    const dow = d.getDay();
    const dtStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = publicHolidays.some(h => h.date.startsWith(dtStr));

    if (isWeekend || isHoliday) return [];

    return leaves.filter(l => {
      if (l.dates && Array.isArray(l.dates)) {
        return l.dates.includes(dtStr);
      }
      // Legacy fallback
      return dtStr >= l.start_date && dtStr <= l.end_date;
    });
  }, [leaves, publicHolidays]);
```
Add immediately after it:
```js
  const leaveTypeById = useMemo(() => {
    const map = new Map();
    (leaveTypes || []).forEach((t) => map.set(t.id, t));
    return map;
  }, [leaveTypes]);
```

- [ ] **Step 3: Render category and segment in the "On Leave Today" list**

Find (currently around lines 455-458):
```jsx
              activeLeaves.map((l, index) => (
                <div key={`leave-item-${index}`} className="meeting-item group">
                  <span className="item-name">{l.employee_name}</span>
                  <span className="leave-type-tag">{l.type}</span>
```
Replace with:
```jsx
              activeLeaves.map((l, index) => {
                const segment = parseHalfDaySegment(l);
                return (
                <div key={`leave-item-${index}`} className="meeting-item group">
                  <span className="item-name">{l.employee_name}</span>
                  <span className="leave-type-tag">
                    {MEETING_TYPE_ICONS[l.type]} {MEETING_TYPE_LABELS[l.type]} · {leaveTypeById.get(l.leave_type_id)?.name || "Uncategorized"}
                    {segment ? ` · ${MEETING_SEGMENT_ICONS[segment]} ${MEETING_SEGMENT_LABELS[segment]}` : ""}
                  </span>
```
Then find the closing of that `.map` block (currently around lines 459-467):
```jsx
                  {isAdmin && (
                    <div className="item-actions">
                      <button onClick={() => { setEditingLeave(l); setShowEditLeave(true); }} title="Edit">✏️</button>
                      <button onClick={() => { if(confirm("Delete leave?")) deleteLeave(l.id); }} title="Delete">🗑</button>
                    </div>
                  )}
                </div>
              ))
            )}
```
Replace the final two lines (`))` then `)}`) with:
```jsx
                  {isAdmin && (
                    <div className="item-actions">
                      <button onClick={() => { setEditingLeave(l); setShowEditLeave(true); }} title="Edit">✏️</button>
                      <button onClick={() => { if(confirm("Delete leave?")) deleteLeave(l.id); }} title="Delete">🗑</button>
                    </div>
                  )}
                </div>
                );
              })
            )}
```
(This changes the arrow function from an implicit-return `l => (...)` to a block body `(l, index) => { ...; return (...); }` so the `segment` variable can be computed once per item — make sure both the opening `activeLeaves.map((l, index) => {` and the matching `return (` / `);` / `})` are balanced.)

- [ ] **Step 4: Verify with lint**

Run: `npm run lint`
Expected: no new errors/warnings referencing `MeetingPage.js`.

- [ ] **Step 5: Manual verification**

Run `npm run dev`, go to `/meeting`, and using the same WFH half-day leave from Task 3 (make sure its date is today, e.g. via the "+ Leave" quick-add for today with category "Work From Home", duration "Half Day", segment "First Half"), confirm "On Leave Today" shows `🌗 Half Day · Work From Home · 🌅 First Half` for that employee, and that a full-day non-WFH leave for another employee still shows correctly (e.g. `📅 Full Day · Sick Leave`, no segment suffix).

- [ ] **Step 6: Commit**

```bash
git add src/components/MeetingPage.js
git commit -m "feat: show leave category and half-day segment on Meeting page"
```

---

### Task 6: Meeting page — mobile (`mobile/app/meeting.js`)

**Files:**
- Modify: `mobile/app/meeting.js:4` (imports), `mobile/app/meeting.js:17-49` (`useApp()` destructure), `mobile/app/meeting.js` (add constants and `leaveTypeById` memo near `activeLeaves` at line 87), `mobile/app/meeting.js:176-186` (render section)

**Interfaces:**
- Consumes: `parseHalfDaySegment(leave)` from Task 2 (`../lib/utils`); `leaveTypes` from `useApp()` (needs to be added to the destructure — it is not currently pulled in this file).
- Produces: `leaveTypeById: Map<number, {id, name, ...}>` — local variable inside the `MeetingScreen` component.

- [ ] **Step 1: Add `leaveTypes` to the `useApp()` destructure**

Find (currently lines 17-31):
```js
  const {
    fines,
    standupFines,
    leaves,
    words,
    wordSeasons,
    employees,
    publicHolidays,
    standupSubmissions,
    standupQuestions,
    isAdmin,
    deleteFine,
    deleteStandupFine,
    deleteLeave,
    deleteWord,
  } = useApp();
```
Add `leaveTypes,` after `publicHolidays,`:
```js
  const {
    fines,
    standupFines,
    leaves,
    words,
    wordSeasons,
    employees,
    publicHolidays,
    leaveTypes,
    standupSubmissions,
    standupQuestions,
    isAdmin,
    deleteFine,
    deleteStandupFine,
    deleteLeave,
    deleteWord,
  } = useApp();
```

- [ ] **Step 2: Import the helper and add module-level constants**

Change the import block's utils line — currently `mobile/app/meeting.js` has no import from `lib/utils` (check with `grep -n "lib/utils" mobile/app/meeting.js`; if absent, add a new import line after the last `import` at the top of the file, e.g. after `import EditWordModal from "../components/EditWordModal";`):
```js
import { parseHalfDaySegment } from "../lib/utils";
```

Then, after the imports, add:
```js

const MEETING_TYPE_LABELS = { full: "Full Day", half: "Half Day", early: "Early Leave" };
const MEETING_TYPE_ICONS = { full: "📅", half: "🌗", early: "🚪" };
const MEETING_SEGMENT_LABELS = { first: "First Half", second: "Second Half" };
const MEETING_SEGMENT_ICONS = { first: "🌅", second: "🌇" };
```

- [ ] **Step 3: Add a `leaveTypeById` lookup next to `activeLeaves`**

Find the `activeLeaves` memo (currently around line 87):
```js
  const activeLeaves = useMemo(() => {
    const d = new Date();
    const dow = d.getDay();
    const dtStr = d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = publicHolidays.some((h) => h.date.startsWith(dtStr));
    if (isWeekend || isHoliday) return [];
    return leaves.filter((l) => (l.dates && Array.isArray(l.dates) ? l.dates.includes(dtStr) : dtStr >= l.start_date && dtStr <= l.end_date));
  }, [leaves, publicHolidays]);
```
Add immediately after it:
```js

  const leaveTypeById = useMemo(() => {
    const map = new Map();
    (leaveTypes || []).forEach((t) => map.set(t.id, t));
    return map;
  }, [leaveTypes]);
```

- [ ] **Step 4: Render category and segment in the "On Leave Today" list**

Find (currently around lines 179-187):
```jsx
          activeLeaves.map((l, i) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}>
              <Text style={{ color: t.textPrimary, fontSize: 14 }}>{l.employee_name}</Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Text style={{ color: t.textMuted, fontSize: 13 }}>{l.type}</Text>
                {isAdmin && (
                  <AdminItemActions onEdit={() => setEditingLeave(l)} onDelete={() => confirmDeleteLeave(l)} />
                )}
              </View>
            </View>
          ))
```
Replace with:
```jsx
          activeLeaves.map((l, i) => {
            const segment = parseHalfDaySegment(l);
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 6 }}>
                <Text style={{ color: t.textPrimary, fontSize: 14 }}>{l.employee_name}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <Text style={{ color: t.textMuted, fontSize: 13 }}>
                    {MEETING_TYPE_ICONS[l.type]} {MEETING_TYPE_LABELS[l.type]} · {leaveTypeById.get(l.leave_type_id)?.name || "Uncategorized"}
                    {segment ? ` · ${MEETING_SEGMENT_ICONS[segment]} ${MEETING_SEGMENT_LABELS[segment]}` : ""}
                  </Text>
                  {isAdmin && (
                    <AdminItemActions onEdit={() => setEditingLeave(l)} onDelete={() => confirmDeleteLeave(l)} />
                  )}
                </View>
              </View>
            );
          })
```

- [ ] **Step 5: Manual verification**

Run `npm run web` (or `npx expo start`) from `mobile/`, go to the Meeting screen, and confirm "On Leave Today" shows the same `🌗 Half Day · Work From Home · 🌅 First Half` text as the web Meeting page for the same leave record.

- [ ] **Step 6: Commit**

```bash
git add mobile/app/meeting.js
git commit -m "feat: show leave category and half-day segment on mobile Meeting page"
```

---

### Task 7: End-to-end verification and balance sanity check

**Files:** none (verification only)

- [ ] **Step 1: Confirm WFH balance still deducts correctly (regression check, not new behavior)**

In the running web app (`npm run dev`), open the Leaves tab, note an employee's "Work From Home" balance chip (e.g. `Work From Home 20/20`). Record a new half-day WFH leave for that employee for a date with no existing leave. Confirm the chip now reads `Work From Home 19.5/20` (i.e. remaining dropped by 0.5) — this confirms Task 3-6's display changes did not disturb `computeLeaveBalances`, which was already correct before this plan.

- [ ] **Step 2: Confirm the full flow end-to-end across both entry points and both platforms**

- Leaves tab (web) → shows category + segment badges, reason clean (Task 3).
- Leaves tab (mobile) → shows category + segment inline, reason clean (Task 4).
- Meeting page quick-add (web) → new leave appears in "On Leave Today" with category + segment (Task 5).
- Meeting page (mobile) → same leave appears with category + segment (Task 6).

- [ ] **Step 3: Clean up test data**

Delete the leave record(s) created for verification (via the 🗑 delete button, as admin) so they don't skew real balances going forward.

No commit needed for this task — it's verification only, not a code change.
