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
          </div>
          <div className="context-source-list">
            {pack.items.length === 0 ? <p>No stored sources selected.</p> : null}
            {pack.items.map((item, index) => (
              <article className="context-source-card" key={`${item.source.kind}:${item.source.id}`}>
                <span>{formatKind(item.source.kind)}</span>
                <h3>[{index + 1}] {item.source.title}</h3>
                <p>{item.text}</p>
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
