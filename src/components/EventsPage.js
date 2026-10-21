import { useApp } from "@/context/AppContext";
import { useDialog } from "@/context/DialogContext";
import Icon from "./Icon";

// Events.dc.html "Company events": one row per event with a date block and a countdown
// pill. The page keeps its single list of every event (it has no upcoming/past filter);
// the page heading comes from page.js.

// Events this many days ahead or fewer are "soon": the window the dashboard banner
// announces them in (EventBanner).
const SOON_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

// Parsed as local time: a bare "YYYY-MM-DD" goes through Date() as UTC and can render
// as the day before in timezones behind it.
function toLocalDate(value) {
  return new Date(`${String(value).split("T")[0]}T00:00:00`);
}

// "Today", "Tomorrow", "In 5 days", "Yesterday", "3 days ago".
function countdown(days) {
  if (days < 0) return { text: days === -1 ? "Yesterday" : `${-days} days ago`, past: true };
  const text = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`;
  return { text, soon: days <= SOON_DAYS };
}

export default function EventsPage({ onAddEvent, onEditEvent }) {
  const { companyEvents, deleteCompanyEvent, isAdmin, animationsEnabled } = useApp();
  const { confirmDialog } = useDialog();
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const animated = animationsEnabled !== false;

  const renderEvent = (event) => {
    const date = toLocalDate(event.date);
    const when = countdown(Math.round((date - today) / DAY_MS));
    const fullDate = date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      ...(date.getFullYear() !== today.getFullYear() ? { year: "numeric" } : {}),
    });

    return (
      <article
        key={event.id}
        className={`event-row${when.soon ? " is-soon" : ""}${when.past ? " is-past" : ""}${animated ? " card-lift" : ""}`}
      >
        <div className="event-date" aria-hidden="true">
          <span className="event-date-mon mono">{date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span>
          <span className="event-date-day">{String(date.getDate()).padStart(2, "0")}</span>
          <span className="event-date-dow mono">{date.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase()}</span>
        </div>
        <div className="event-text">
          <div className="event-top">
            <h3 className="event-title">{event.title}</h3>
            <span className={`pill ${when.soon ? "pill-cyan" : "pill-gray"}`}>{when.text}</span>
          </div>
          <span className="event-full mono">{fullDate}</span>
        </div>
        {isAdmin && (
          <div className="event-actions">
            <button
              type="button"
              className="btn-icon btn-sm event-icon-btn"
              onClick={() => onEditEvent(event)}
              aria-label={`Edit event ${event.title}`}
              title="Edit event"
            >
              <Icon name="edit" size={15} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="btn-icon btn-sm event-icon-btn event-icon-delete"
              onClick={async () => {
                if (await confirmDialog(`Delete event "${event.title}"?`, { danger: true })) {
                  deleteCompanyEvent(event.id);
                }
              }}
              aria-label={`Delete event ${event.title}`}
              title="Delete event"
            >
              <Icon name="trash" size={15} strokeWidth={2} />
            </button>
          </div>
        )}
      </article>
    );
  };

  return (
    <section className="events-card glass-card" aria-labelledby="events-title">
      <div className="events-head">
        <div className="events-heading">
          <h2 id="events-title" className="section-title">Company events</h2>
          <span className="events-sub">Lunches, town halls, trips and anything the team should plan around</span>
        </div>
        {isAdmin && (
          <button type="button" className="btn btn-primary" onClick={onAddEvent}>
            <Icon name="plus" size={16} strokeWidth={2.2} /> Add Event
          </button>
        )}
      </div>

      {companyEvents.length === 0 ? (
        <p className="empty-msg">No custom events recorded.</p>
      ) : (
        <div className="event-list">{companyEvents.map(renderEvent)}</div>
      )}
    </section>
  );
}
