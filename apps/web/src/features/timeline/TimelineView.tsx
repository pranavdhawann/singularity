const events = [
  {
    type: "workspace.created",
    title: "Future workspace ready",
    detail: "Local storage and permissions initialized"
  },
  {
    type: "memory.review",
    title: "Memory review queue",
    detail: "No proposed memories yet"
  },
  {
    type: "provider.status",
    title: "Mock provider available",
    detail: "External calls require prompt preview"
  }
];

export function TimelineView() {
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
