import { useEffect, useRef } from "react";
import type { PromptPreviewDto } from "@future/core";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

export function ExternalPromptPreview({
  preview,
  onApprove,
  onDeny,
}: {
  preview: PromptPreviewDto;
  onApprove(): void | Promise<void>;
  onDeny(): void | Promise<void>;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const denyRef = useRef<HTMLButtonElement>(null);

  // Focus the safe default control (Deny) on open and restore focus to the
  // control that opened the dialog once it closes.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    denyRef.current?.focus();
    return () => previouslyFocused?.focus?.();
  }, []);

  // Keep keyboard focus inside the modal and treat Escape as an explicit,
  // safe deny of the external prompt.
  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void onDeny();
      return;
    }
    if (event.key !== "Tab") return;

    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? []);
    if (focusable.length === 0) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <section
      ref={dialogRef}
      className="prompt-preview"
      role="dialog"
      aria-modal="true"
      aria-labelledby="prompt-preview-title"
      onKeyDown={onKeyDown}
    >
      <header>
        <div>
          <p className="eyebrow">Permission required</p>
          <h2 id="prompt-preview-title">External prompt preview</h2>
        </div>
        <span>{preview.endpointClassification}</span>
      </header>
      <dl>
        <div>
          <dt>Provider</dt>
          <dd>{preview.providerId}</dd>
        </div>
        <div>
          <dt>Model</dt>
          <dd>{preview.model}</dd>
        </div>
        <div>
          <dt>Estimated tokens</dt>
          <dd>{preview.estimatedTokens}</dd>
        </div>
        <div>
          <dt>Privacy labels</dt>
          <dd>{preview.privacyLabels.join(", ") || "none"}</dd>
        </div>
        <div>
          <dt>Redactions</dt>
          <dd>
            {Object.entries(preview.redactionCounts)
              .map(([kind, count]) => `${kind}: ${count}`)
              .join(", ") || "none"}
          </dd>
        </div>
        <div>
          <dt>Binding</dt>
          <dd>
            <code>{preview.bindingHash}</code>
          </dd>
        </div>
      </dl>
      <h3>Exact redacted prompt</h3>
      <pre>{preview.redactedPrompt}</pre>
      <h3>Selected sources</h3>
      <ul>
        {preview.selectedSources.map((source) => (
          <li key={`${source.kind}:${source.id}`}>
            {source.title}
            {source.range ? ` · characters ${source.range.start}-${source.range.end}` : ""}
          </li>
        ))}
      </ul>
      {preview.excludedSources.length > 0 ? (
        <>
          <h3>Excluded sources</h3>
          <ul>
            {preview.excludedSources.map((source) => (
              <li key={`${source.kind}:${source.id}`}>{source.title}</li>
            ))}
          </ul>
        </>
      ) : null}
      <footer>
        <button ref={denyRef} type="button" className="cancel-button" onClick={() => void onDeny()}>
          Deny external prompt
        </button>
        <button type="button" onClick={() => void onApprove()}>
          Approve exact prompt
        </button>
      </footer>
    </section>
  );
}
