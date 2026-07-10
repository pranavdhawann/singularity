interface TimelineItem { type: string; title: string; detail: string; }

export function TimelineView({ events = [] }: { events?: TimelineItem[] }) {
  return (
    <section className="timeline-panel" aria-labelledby="timeline-heading">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Activity</p>
          <h2 id="timeline-heading">Timeline</h2>
        </div>
        <span className="status-pill">Local</span>
      </div>
      <div className="timeline-list">
        {events.length === 0 ? <p className="empty-state">No activity recorded yet.</p> : null}
        {events.map((event) => (
          <article className="timeline-event" key={event.type}>
            <span className="event-type">{event.type}</span>
            <h3>{event.title}</h3>
            <p>{event.detail}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
