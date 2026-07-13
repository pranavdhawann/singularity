import type { PromptPreviewDto } from "@future/core";

export function ExternalPromptPreview({
  preview,
  onApprove,
  onDeny
}: {
  preview: PromptPreviewDto;
  onApprove(): void | Promise<void>;
  onDeny(): void | Promise<void>;
}) {
  return (
    <section className="prompt-preview" role="dialog" aria-modal="true" aria-labelledby="prompt-preview-title">
      <header>
        <div><p className="eyebrow">Permission required</p><h2 id="prompt-preview-title">External prompt preview</h2></div>
        <span>{preview.endpointClassification}</span>
      </header>
      <dl>
        <div><dt>Provider</dt><dd>{preview.providerId}</dd></div>
        <div><dt>Model</dt><dd>{preview.model}</dd></div>
        <div><dt>Estimated tokens</dt><dd>{preview.estimatedTokens}</dd></div>
        <div><dt>Privacy labels</dt><dd>{preview.privacyLabels.join(", ") || "none"}</dd></div>
        <div><dt>Redactions</dt><dd>{Object.entries(preview.redactionCounts).map(([kind, count]) => `${kind}: ${count}`).join(", ") || "none"}</dd></div>
        <div><dt>Binding</dt><dd><code>{preview.bindingHash}</code></dd></div>
      </dl>
      <h3>Exact redacted prompt</h3>
      <pre>{preview.redactedPrompt}</pre>
      <h3>Selected sources</h3>
      <ul>{preview.selectedSources.map((source) => <li key={`${source.kind}:${source.id}`}>
        {source.title}{source.range ? ` · characters ${source.range.start}-${source.range.end}` : ""}
      </li>)}</ul>
      {preview.excludedSources.length > 0 ? <><h3>Excluded sources</h3><ul>
        {preview.excludedSources.map((source) => <li key={`${source.kind}:${source.id}`}>{source.title}</li>)}
      </ul></> : null}
      <footer>
        <button type="button" className="cancel-button" onClick={() => void onDeny()}>Deny external prompt</button>
        <button type="button" onClick={() => void onApprove()}>Approve exact prompt</button>
      </footer>
    </section>
  );
}
