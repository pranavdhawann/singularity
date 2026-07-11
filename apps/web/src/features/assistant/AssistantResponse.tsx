import type { SourceReference } from "@future/core";

export interface AssistantResponseProps {
  responseText: string;
  sources?: SourceReference[];
  onSourceClick?(source: SourceReference): void;
}

export function AssistantResponse({ responseText, sources = [], onSourceClick }: AssistantResponseProps) {
  return (
    <article className="assistant-response" aria-label="Assistant response">
      <p>{responseText}</p>
      <div className="source-list">
        {sources.length === 0 ? <span>Answered without stored evidence</span> : null}
        {sources.map((source, index) => (
          <button
            className="citation-button"
            type="button"
            key={`${source.kind}:${source.id}`}
            aria-label={`Citation ${index + 1}: ${source.title}`}
            onClick={() => onSourceClick?.(source)}
          >
            [{index + 1}] {source.title}
          </button>
        ))}
      </div>
    </article>
  );
}
