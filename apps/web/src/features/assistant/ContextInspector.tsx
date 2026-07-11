import type { ContextPackInspection } from "@future/core";
import { useEffect, useState } from "react";
import type { FutureApi } from "../../app/api-types";

export function ContextInspector({ api, contextPackId }: { api: FutureApi; contextPackId?: string | undefined }) {
  const [pack, setPack] = useState<ContextPackInspection | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    let active = true;
    setPack(undefined);
    setError(undefined);
    if (!contextPackId) return () => { active = false; };
    void api.getContextPack(contextPackId)
      .then((next) => { if (active) setPack(next); })
      .catch((cause: unknown) => {
        if (active) setError(cause instanceof Error ? cause.message : "Context could not be loaded");
      });
    return () => { active = false; };
  }, [api, contextPackId]);

  return (
    <aside className="inspector context-inspector" aria-label="Inspector">
      <p className="eyebrow">Inspector</p>
      <h2>Context used</h2>
      {!contextPackId ? <p>Select a cited answer to inspect its immutable local context.</p> : null}
      {contextPackId && !pack && !error ? <p>Loading context...</p> : null}
      {error ? <p role="alert" className="turn-error">{error}</p> : null}
      {pack ? (
        <>
          <div className="inspector-group">
            <span>Model</span>
            <strong>Model: {pack.model}</strong>
            <p>{pack.estimatedTokens} estimated tokens</p>
            <p>{pack.redactionCount} redactions</p>
            {pack.retrieval?.mode === "lexical" ? <p className="retrieval-fallback">
              Lexical retrieval only{pack.retrieval.fallbackReason ? ` (${pack.retrieval.fallbackReason})` : ""}
            </p> : null}
          </div>
          <div className="context-source-list">
            {pack.items.length === 0 ? <p>No stored sources selected.</p> : null}
            {pack.items.map((item, index) => (
              <article className="context-source-card" key={`${item.source.kind}:${item.source.id}`}>
                <span>{formatKind(item.source.kind)}</span>
                <h3>[{index + 1}] {item.source.title}</h3>
                <p>{item.text}</p>
                {item.retrieval ? <dl className="retrieval-details">
                  <div><dt>Final</dt><dd>Final score {item.retrieval.finalScore.toFixed(3)}</dd></div>
                  <div><dt>Channels</dt><dd>
                    {item.retrieval.lexicalScore !== undefined ? `Lexical ${item.retrieval.lexicalScore.toFixed(3)}` : "No lexical score"}
                    {item.retrieval.vectorScore !== undefined ? ` · Vector ${item.retrieval.vectorScore.toFixed(3)}` : ""}
                  </dd></div>
                  <div><dt>Reasons</dt><dd>{item.retrieval.reasons.map((reason) => reason.replaceAll("_", " ")).join(", ")}</dd></div>
                </dl> : null}
                {item.compactionSources?.map((source) => <small className="compaction-source" key={`${source.kind}:${source.id}`}>
                  Compacted from {source.kind.replaceAll("_", " ")} {source.id}
                </small>)}
                {item.source.range ? <small>Characters {item.source.range.start}-{item.source.range.end}</small> : null}
              </article>
            ))}
          </div>
        </>
      ) : null}
    </aside>
  );
}

function formatKind(kind: string): string {
  return kind.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}
