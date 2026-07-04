export interface AssistantResponseProps {
  responseText: string;
  sourceIds?: string[];
}

export function AssistantResponse({ responseText, sourceIds = [] }: AssistantResponseProps) {
  return (
    <article className="assistant-response" aria-label="Assistant response">
      <p>{responseText}</p>
      <div className="source-list">
        {sourceIds.length === 0 ? <span>No sources attached</span> : null}
        {sourceIds.map((sourceId) => (
          <span key={sourceId}>{sourceId}</span>
        ))}
      </div>
    </article>
  );
}
