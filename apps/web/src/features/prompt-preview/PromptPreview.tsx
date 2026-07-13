export interface PromptPreviewProps {
  providerName?: string;
  modelName?: string;
  items?: Array<{ id: string; text: string }>;
  redactions?: Array<{ kind: string; replacement: string }>;
}

export function PromptPreview({
  providerName = "Mock",
  modelName = "mock",
  items = [],
  redactions = [],
}: PromptPreviewProps) {
  return (
    <section className="prompt-preview" aria-label="Prompt preview">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Prompt preview</p>
          <h2>{providerName}</h2>
        </div>
        <span className="status-pill">{modelName}</span>
      </div>
      <div className="preview-list">
        {items.length === 0 ? <p>No context selected yet.</p> : null}
        {items.map((item) => (
          <article key={item.id}>
            <strong>{item.id}</strong>
            <p>{item.text}</p>
          </article>
        ))}
      </div>
      <p className="preview-redactions">Redactions: {redactions.length}</p>
    </section>
  );
}
