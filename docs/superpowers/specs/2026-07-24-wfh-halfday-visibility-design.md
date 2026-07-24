# WFH & Half-Day Leave Visibility — Design

## Background

WFH is modeled as a normal row in `leave_types` ("Work From Home", 20 annual days). Any leave recorded with `leave_type_id` pointing to that row already deducts from the WFH balance through `computeLeaveBalances()` (`src/lib/utils.js`) exactly like Sick/Personal/etc. — this was confirmed by code inspection, and no special-casing anywhere excludes WFH from balance math. **No change to deduction logic is needed.**

The actual gap is display:

- **Leaves tab** (`src/components/LeavePage.js`, mobile `mobile/app/(tabs)/leaves.js`) already shows a "🌗 Half Day" duration badge and the leave category name, but the half-day segment (First Half / Second Half) is only present as raw bracketed text (`[First Half]`) leaking through the free-text `reason` field — no clean badge for it.
- **Meeting page "On Leave Today"** (`src/components/MeetingPage.js:455-458`, mobile `mobile/app/meeting.js:184`) is the weakest: it renders only the bare `type` string (`full`/`half`/`early`). It shows **no leave category at all**, so there is no way to tell someone is on WFH vs Sick leave from this page, and no half-day segment either.

## Goal

Display-only change: surface leave category (including WFH) and half-day segment clearly in both the Leaves tab and the Meeting page, on web and mobile. No DB schema change, no change to balance computation, no change to the Add/Edit/Quick-add leave forms.

## Design

### Shared parsing helpers (new)

Add to `src/lib/utils.js` and mirror in `mobile/lib/utils.js`:

```js
const HALF_DAY_SEGMENT_PREFIXES = { first: "[First Half]", second: "[Second Half]" };

export function parseHalfDaySegment(leave) {
  if (!leave || leave.type !== "half") return null;
  const reason = leave.reason || "";
  if (reason.startsWith(HALF_DAY_SEGMENT_PREFIXES.first)) return "first";
  if (reason.startsWith(HALF_DAY_SEGMENT_PREFIXES.second)) return "second";
  return null;
}

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

This replaces the parsing logic that today only exists inline in `EditLeaveModal.js` (used solely to prefill the edit form) — both pages' display code will use this same shared logic so segment detection is consistent everywhere. `EditLeaveModal.js` itself is not required to change (out of scope), but may optionally adopt the helper for consistency if trivial to do while editing nearby code.

Per-page icon/label constants for the segment (`{ first: { icon: "🌅", label: "First Half" }, second: { icon: "🌇", label: "Second Half" } }`) follow the existing local-constant convention already used for `TYPE_ICONS`/`TYPE_LABELS` in each file — not centralized, to match current code style. Icons reuse the same 🌅/🌇 already used in `AddLeaveModal.js`/`QuickAddLeaveModal` for the First/Second Half options.

### Leaves tab

**Web (`src/components/LeavePage.js`):**
- Add a `SEGMENT_ICONS`/`SEGMENT_LABELS` local const map.
- In the leave card (around line 260-265), add a third badge after the duration and category badges, shown only when `parseHalfDaySegment(leave)` returns non-null: `<span className="leave-type-badge leave-segment-badge">🌅 First Half</span>`.
- Change the reason block (line 297-301) to render `stripHalfDaySegmentPrefix(leave.reason)` and only show the block if the stripped text is non-empty.

**Mobile (`mobile/app/(tabs)/leaves.js`):**
- Same segment map.
- Append the segment to the existing "icon label · category" text line (line 214): `{TYPE_ICONS[...]} {TYPE_LABELS[...]} · {categoryName}{segment ? \` · ${icon} ${label}\` : ""}`.
- Reason text (line ~236) passed through `stripHalfDaySegmentPrefix`.

### Meeting page "On Leave Today"

**Web (`src/components/MeetingPage.js`):**
- `leaveTypes` is already destructured from `useApp()` at the top of the component (currently only passed down to `QuickAddLeaveModal`) — add a `leaveTypeById` map built with `useMemo`, following the same pattern as `LeavePage.js`.
- Add module-level `TYPE_ICONS`/`TYPE_LABELS`/`SEGMENT_ICONS`/`SEGMENT_LABELS` consts (same values as `LeavePage.js`).
- Replace the single `<span className="leave-type-tag">{l.type}</span>` (line 458) with icon+label for duration, the category name from `leaveTypeById`, and the segment when present — all using the existing `leave-type-tag` class so no new CSS is needed, joined the same "·"-separated way mobile already does.

**Mobile (`mobile/app/meeting.js`):**
- Add `leaveTypes` to the `useApp()` destructure (currently missing).
- Add a `leaveTypeById` map and the same icon/label consts.
- Replace `<Text>{l.type}</Text>` (line 184) with the same three-part "icon label · category[· segment]" text used on the Leaves tab.

### Out of scope

- `AddLeaveModal.js`, `EditLeaveModal.js`, `QuickAddLeaveModal` — no changes.
- Balance computation (`computeLeaveBalances`, `leaveDayCount`) — no changes.
- DB schema (`leaves`, `leave_types` tables) — no changes.

## Testing

No automated test suite exists in this repo. Verify manually:
1. Record a half-day WFH leave for an employee via the Leaves tab ("Record Leave" → category "Work From Home", duration "Half Day", segment "First Half").
2. Confirm the Leaves tab card shows: duration badge, "Work From Home" category badge, and a "🌅 First Half" segment badge, with clean reason text (no bracket leakage).
3. Confirm the employee's WFH balance chip/jar decreases by 0.5.
4. Repeat via the Meeting page's "+ Leave" quick-add for today, and confirm the "On Leave Today" list shows the same three-part info.
5. Repeat both flows on mobile (`mobile/app/(tabs)/leaves.js`, `mobile/app/meeting.js`).
