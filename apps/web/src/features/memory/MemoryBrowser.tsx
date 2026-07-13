const memoryTabs = ["Facts", "Episodes", "Procedures", "Decisions", "Tasks", "Summaries", "Uncertain", "Pinned"];

export function MemoryBrowser() {
  return (
    <section className="memory-browser" aria-label="Memory browser">
      <div className="memory-tabs">
        {memoryTabs.map((tab) => (
          <button type="button" key={tab}>
            {tab}
          </button>
        ))}
      </div>
      <article className="memory-card">
        <span>Proposed</span>
        <h3>Future uses SQLite for local truth.</h3>
        <p>Confidence 0.92, one source, local privacy label.</p>
        <div className="memory-actions">
          <button type="button">Approve</button>
          <button type="button">Edit</button>
          <button type="button">Delete</button>
          <button type="button">Show sources</button>
        </div>
      </article>
    </section>
  );
}
