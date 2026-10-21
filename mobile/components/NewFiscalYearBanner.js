import { AnnouncementCard } from "./EventBanner";

// The day the new fiscal year (and new leave/fine seasons) begins.
const TARGET_DATE = new Date(2026, 6, 17); // July 17, 2026

// The canvas's Announcement card, as EventBanner draws it, on that one day, in the cyan tone: a
// new year is not a people moment, so not orange (intent AC3).
export default function NewFiscalYearBanner() {
  const isTargetDay = new Date().toDateString() === TARGET_DATE.toDateString();
  if (!isTargetDay) return null;

  return (
    <AnnouncementCard
      icon="sparkles"
      kind="fiscal-year"
      title="Oh yeah, a new fiscal year!"
      text="New leaves, a fresh season for fines, and a brand new working year — let's make it a great one!"
    />
  );
}
